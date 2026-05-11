import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { TemplateEntity, TemplateDocument, type TemplateStatus } from './schemas/template.schema'
import type { CreateTemplateDto } from './dto/create-template.dto'
import type { UpdateTemplateDto } from './dto/update-template.dto'
import type { Orientation, Template, TemplateType } from '../template-schema'
import { IStorageService, TEMPLATE_STORAGE_SERVICE } from '../storage/storage.service'

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
  /** Provenance — null for templates authored in the editor; non-null
   *  for imported templates. */
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

  async list(): Promise<TemplateMetaDto[]> {
    const docs = await this.model
      .find()
      .sort({ updatedAt: -1 })
      .lean({ virtuals: false })
      .exec()
    return docs.map((d) => toMeta(d as unknown as TemplateDocument))
  }

  async getOne(id: string): Promise<SavedTemplateDto> {
    const doc = await this.findByIdOrThrow(id)
    const template = await this.readBodyOrThrow(String(doc._id))
    return { meta: toMeta(doc), template }
  }

  async create(dto: CreateTemplateDto): Promise<SavedTemplateDto> {
    // Pre-mint the _id so we can compute sourceRef before the doc is
    // written. Caller-supplied sourceRef wins (e.g. import scripts);
    // otherwise we record where the JSON actually lands in storage.
    const _id = new Types.ObjectId()
    const id = String(_id)
    const resolvedSourceRef = dto.sourceRef ?? this.storage.getStorageRef(id)

    // Pull denormalized fields from the body so the document is
    // queryable without a body parse on every list/filter.
    const created = await this.model.create({
      _id,
      name: dto.name.trim() || 'Untitled',
      type: dto.body.type,
      orientation: dto.body.orientation,
      schemaVersion: dto.body.schemaVersion,
      status: 'draft',
      publishedAt: null,
      sourceRef: resolvedSourceRef,
    })
    try {
      await this.writeBody(id, dto.body)
    } catch (err) {
      // Storage write failed — roll back the meta record so we don't
      // leave a dangling pointer to nothing.
      await this.model.deleteOne({ _id }).exec()
      throw err
    }
    return { meta: toMeta(created), template: dto.body }
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<SavedTemplateDto> {
    const doc = await this.findByIdOrThrow(id)

    if (dto.name !== undefined) {
      doc.name = dto.name.trim() || 'Untitled'
    }
    if (dto.body !== undefined) {
      // Body's denormalized fields can change (orientation flip, type
      // swap) — keep the document-level copies in sync.
      doc.type = dto.body.type
      doc.orientation = dto.body.orientation
      doc.schemaVersion = dto.body.schemaVersion
      // The actual body lives in storage, so when only element-level
      // edits happen the denormalized assignments above are no-ops
      // and Mongoose's `save()` becomes a no-op too — leaving
      // `updatedAt` stale. Force-mark the doc modified so the
      // timestamp bumps and the editor's "saved Xs ago" reflects the
      // real write.
      doc.set('updatedAt', new Date())
    }
    if (dto.sourceRef !== undefined) {
      doc.sourceRef = dto.sourceRef
    }

    await doc.save()

    // If the body changed, persist it. Otherwise re-read for the response
    // (callers expect a SavedTemplateDto regardless of what fields moved).
    let template: Template
    if (dto.body !== undefined) {
      await this.writeBody(String(doc._id), dto.body)
      template = dto.body
    } else {
      template = await this.readBodyOrThrow(String(doc._id))
    }

    return { meta: toMeta(doc), template }
  }

  async setStatus(id: string, status: TemplateStatus): Promise<SavedTemplateDto> {
    const doc = await this.findByIdOrThrow(id)
    if (doc.status === status) {
      // No-op transition still returns the current doc; keeps the
      // toolbar's Publish button idempotent if the user double-clicks.
      const template = await this.readBodyOrThrow(String(doc._id))
      return { meta: toMeta(doc), template }
    }
    doc.status = status
    doc.publishedAt = status === 'published' ? new Date() : null
    await doc.save()
    const template = await this.readBodyOrThrow(String(doc._id))
    return { meta: toMeta(doc), template }
  }

  async remove(id: string): Promise<void> {
    const _id = this.toObjectId(id)
    if (!_id) throw new NotFoundException(`Template ${id} not found`)
    const result = await this.model.deleteOne({ _id }).exec()
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Template ${id} not found`)
    }
    // Storage cleanup is best-effort — the user-facing op is the Mongo
    // delete; an orphan body in storage is a minor reconciliation
    // concern, not a request failure.
    try {
      await this.storage.remove(id)
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

  private async findByIdOrThrow(id: string): Promise<TemplateDocument> {
    const _id = this.toObjectId(id)
    if (!_id) throw new NotFoundException(`Template ${id} not found`)
    const doc = await this.model.findById(_id).exec()
    if (!doc) throw new NotFoundException(`Template ${id} not found`)
    return doc
  }

  /** Tolerant cast — if the id isn't a valid ObjectId we treat it as
   *  not-found rather than 500ing the request. */
  private toObjectId(id: string): Types.ObjectId | null {
    return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null
  }
}

function toMeta(doc: TemplateDocument): TemplateMetaDto {
  // `lean()` returns a plain object so timestamps are Date instances or
  // already millis depending on the path. `getTime()` covers both.
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
