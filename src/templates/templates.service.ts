import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { AuthRequest } from '@industronics/remote-auth'
import { TemplateEntity, TemplateDocument, type TemplateStatus } from './schemas/template.schema'
import type { CreateTemplateDto } from './dto/create-template.dto'
import type { UpdateTemplateDto } from './dto/update-template.dto'
import type { Orientation, Template, TemplateType } from '../template-schema'
import { IStorageService, TEMPLATE_STORAGE_SERVICE } from '../storage/storage.service'
import { buildScopedListQuery, buildScopedQuery } from '../common/scoped-query'

/**
 * TemplateMeta — the wire shape the editor's library list reads. Mirrors
 * the editor's local `templateStorage.TemplateMeta` so swapping the
 * editor's storage adapter to HTTP is a 1:1 field map.
 *
 * Dates serialize as epoch ms because that's what the editor stores
 * locally; keeping the wire format unchanged means relative-time
 * formatting in the cards keeps working without conversion.
 */
export interface TemplateMetaDto {
  id: string
  name: string
  type: TemplateType
  orientation: Orientation
  status: TemplateStatus
  schemaVersion: number
  publishedAt: number | null
  lastModified: number
  createdAt: number
  sourceRef: string | null
}

export interface SavedTemplateDto {
  meta: TemplateMetaDto
  template: Template
}

const TEMPLATE_MIME = 'application/json'

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name)

  constructor(
    @InjectModel(TemplateEntity.name)
    private readonly model: Model<TemplateEntity>,
    @Inject(TEMPLATE_STORAGE_SERVICE)
    private readonly storage: IStorageService,
  ) {}

  async list(req: AuthRequest): Promise<TemplateMetaDto[]> {
    const docs = await this.model
      .find(buildScopedListQuery(req))
      .sort({ updatedAt: -1 })
      .lean({ virtuals: false })
      .exec()
    return docs.map((d) => toMeta(d as unknown as TemplateDocument))
  }

  async getOne(req: AuthRequest, id: string): Promise<SavedTemplateDto> {
    const doc = await this.findScopedOrThrow(req, id)
    const template = await this.readBodyOrThrow(String(doc._id))
    return { meta: toMeta(doc), template }
  }

  async create(req: AuthRequest, dto: CreateTemplateDto): Promise<SavedTemplateDto> {
    // Pre-mint the _id so we can compute sourceRef before the doc is
    // written. Caller-supplied sourceRef wins (e.g. import scripts);
    // otherwise we record where the JSON actually lands in storage.
    const _id = new Types.ObjectId()
    const id = String(_id)
    const resolvedSourceRef = dto.sourceRef ?? this.storage.getStorageRef(id)

    const created = await this.model.create({
      _id,
      name: dto.name.trim() || 'Untitled',
      type: dto.body.type,
      orientation: dto.body.orientation,
      schemaVersion: dto.body.schemaVersion,
      status: 'draft',
      publishedAt: null,
      sourceRef: resolvedSourceRef,
      ownerType: req.scope.ownerType,
      ownerId: req.scope.ownerId,
      createdBy: req.user.userId ? new Types.ObjectId(req.user.userId) : null,
      updatedBy: req.user.userId ? new Types.ObjectId(req.user.userId) : null,
      isActive: true,
    })
    try {
      await this.writeBody(id, dto.body)
    } catch (err) {
      await this.model.deleteOne({ _id }).exec()
      throw err
    }
    return { meta: toMeta(created), template: dto.body }
  }

  async update(req: AuthRequest, id: string, dto: UpdateTemplateDto): Promise<SavedTemplateDto> {
    const doc = await this.findScopedOrThrow(req, id)

    if (dto.name !== undefined) {
      doc.name = dto.name.trim() || 'Untitled'
    }
    if (dto.body !== undefined) {
      doc.type = dto.body.type
      doc.orientation = dto.body.orientation
      doc.schemaVersion = dto.body.schemaVersion
      doc.set('updatedAt', new Date())
    }
    if (dto.sourceRef !== undefined) {
      doc.sourceRef = dto.sourceRef
    }
    if (req.user.userId) {
      doc.updatedBy = new Types.ObjectId(req.user.userId)
    }

    await doc.save()

    let template: Template
    if (dto.body !== undefined) {
      await this.writeBody(String(doc._id), dto.body)
      template = dto.body
    } else {
      template = await this.readBodyOrThrow(String(doc._id))
    }

    return { meta: toMeta(doc), template }
  }

  async setStatus(req: AuthRequest, id: string, status: TemplateStatus): Promise<SavedTemplateDto> {
    const doc = await this.findScopedOrThrow(req, id)
    if (doc.status === status) {
      const template = await this.readBodyOrThrow(String(doc._id))
      return { meta: toMeta(doc), template }
    }
    doc.status = status
    doc.publishedAt = status === 'published' ? new Date() : null
    if (req.user.userId) {
      doc.updatedBy = new Types.ObjectId(req.user.userId)
    }
    await doc.save()
    const template = await this.readBodyOrThrow(String(doc._id))
    return { meta: toMeta(doc), template }
  }

  async remove(req: AuthRequest, id: string): Promise<void> {
    // Resolve under scope first so wrong-tenant requests get the same
    // 404 as not-found (per D2 — never leak existence across tenants).
    const doc = await this.findScopedOrThrow(req, id)
    const result = await this.model.deleteOne({ _id: doc._id }).exec()
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Template ${id} not found`)
    }
    try {
      await this.storage.remove(String(doc._id))
    } catch (err) {
      this.logger.warn(`failed to remove body for ${id}: ${(err as Error).message}`)
    }
  }

  // ── Internals ────────────────────────────────────────────────────

  private async writeBody(id: string, template: Template): Promise<void> {
    const buffer = Buffer.from(JSON.stringify(template), 'utf-8')
    await this.storage.put(id, buffer, TEMPLATE_MIME)
  }

  private async readBodyOrThrow(id: string): Promise<Template> {
    const buffer = await this.storage.getBuffer(id)
    if (!buffer) {
      this.logger.warn(`template ${id} has meta but no body — orphan`)
      throw new NotFoundException(`Template ${id} body missing in storage`)
    }
    return JSON.parse(buffer.toString('utf-8')) as Template
  }

  private async findScopedOrThrow(
    req: AuthRequest,
    id: string,
  ): Promise<TemplateDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Template ${id} not found`)
    }
    const doc = await this.model.findOne(buildScopedQuery(req, id)).exec()
    if (!doc) throw new NotFoundException(`Template ${id} not found`)
    return doc
  }
}

function toMeta(doc: TemplateDocument): TemplateMetaDto {
  const createdAt = (doc.get?.('createdAt') ?? (doc as any).createdAt) as Date | number | undefined
  const updatedAt = (doc.get?.('updatedAt') ?? (doc as any).updatedAt) as Date | number | undefined
  const publishedAt = (doc.get?.('publishedAt') ?? doc.publishedAt) as Date | null | undefined

  return {
    id: String(doc._id),
    name: doc.name,
    type: doc.type,
    orientation: doc.orientation,
    status: doc.status,
    schemaVersion: doc.schemaVersion,
    publishedAt: toMs(publishedAt),
    lastModified: toMs(updatedAt) ?? 0,
    createdAt: toMs(createdAt) ?? 0,
    sourceRef: doc.sourceRef ?? null,
  }
}

function toMs(v: Date | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  return v.getTime()
}
