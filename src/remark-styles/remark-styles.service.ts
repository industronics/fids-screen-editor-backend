import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { AuthRequest } from '@industronics/remote-auth'
import {
  RemarkStyleSetDocument,
  RemarkStyleSetEntity,
} from './schemas/remark-style-set.schema'
import type {
  CreateRemarkStyleSetDto,
  UpdateRemarkStyleSetDto,
} from './dto/upsert-remark-style-set.dto'
import { buildScopedQuery } from '../common/scoped-query'

/** RemarkStyleEntryDto — fully-resolved entry shape on the wire (nulls
 *  rather than absent fields, so the editor reads a stable schema). */
export interface RemarkStyleEntryDto {
  code: string
  background: string | null
  textColor: string | null
  fontWeight: number | null
}

export interface RemarkStyleSetDto {
  id: string
  name: string
  isDefault: boolean
  entries: RemarkStyleEntryDto[]
  lastModified: number
  createdAt: number
}

@Injectable()
export class RemarkStylesService {
  constructor(
    @InjectModel(RemarkStyleSetEntity.name)
    private readonly model: Model<RemarkStyleSetEntity>,
  ) {}

  async list(req: AuthRequest): Promise<RemarkStyleSetDto[]> {
    const docs = await this.model
      .find(buildScopedQuery(req))
      .sort({ isDefault: -1, updatedAt: -1 })
      .exec()
    return docs.map(toDto)
  }

  async create(req: AuthRequest, dto: CreateRemarkStyleSetDto): Promise<RemarkStyleSetDto> {
    const created = await this.model.create({
      name: dto.name.trim() || 'Default',
      isDefault: dto.isDefault ?? false,
      entries: normalizeEntries(dto.entries),
      ownerType: req.scope.ownerType,
      ownerId: req.scope.ownerId,
      createdBy: req.user.userId ? new Types.ObjectId(req.user.userId) : null,
      updatedBy: req.user.userId ? new Types.ObjectId(req.user.userId) : null,
      isActive: true,
    })
    if (created.isDefault) await this.clearOtherDefaults(req, created._id)
    return toDto(created)
  }

  async update(req: AuthRequest, id: string, dto: UpdateRemarkStyleSetDto): Promise<RemarkStyleSetDto> {
    const doc = await this.findScopedOrThrow(req, id)
    if (dto.name !== undefined) doc.name = dto.name.trim() || 'Default'
    if (dto.isDefault !== undefined) doc.isDefault = dto.isDefault
    if (dto.entries !== undefined) doc.set('entries', normalizeEntries(dto.entries))
    if (req.user.userId) doc.updatedBy = new Types.ObjectId(req.user.userId)
    await doc.save()
    if (doc.isDefault) await this.clearOtherDefaults(req, doc._id)
    return toDto(doc)
  }

  async remove(req: AuthRequest, id: string): Promise<void> {
    // Resolve under scope first so wrong-tenant requests get the same
    // 404 as not-found (mirrors templates.remove — never leak existence
    // across tenants).
    const doc = await this.findScopedOrThrow(req, id)
    const wasDefault = doc.isDefault
    const result = await this.model.deleteOne({ _id: doc._id }).exec()
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Remark style set ${id} not found`)
    }
    // Preserve the "one default per airport" invariant: if we removed the
    // default and other sets remain, promote the most recently updated.
    if (wasDefault) await this.promoteNewDefault(req)
  }

  // ── Internals ────────────────────────────────────────────────────

  /** After the default is deleted, flag the most recently updated
   *  remaining set as default so the airport always resolves a set. */
  private async promoteNewDefault(req: AuthRequest): Promise<void> {
    const next = await this.model
      .findOne(buildScopedQuery(req))
      .sort({ updatedAt: -1 })
      .exec()
    if (next && !next.isDefault) {
      next.isDefault = true
      await next.save()
    }
  }

  /** Demote any other set that's flagged default for this owner, so the
   *  "one default per airport" invariant holds. */
  private async clearOtherDefaults(req: AuthRequest, keepId: Types.ObjectId): Promise<void> {
    await this.model
      .updateMany(
        { ...buildScopedQuery(req), _id: { $ne: keepId }, isDefault: true },
        { $set: { isDefault: false } },
      )
      .exec()
  }

  private async findScopedOrThrow(req: AuthRequest, id: string): Promise<RemarkStyleSetDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Remark style set ${id} not found`)
    }
    const doc = await this.model.findOne(buildScopedQuery(req, id)).exec()
    if (!doc) throw new NotFoundException(`Remark style set ${id} not found`)
    return doc
  }
}

function normalizeEntries(
  entries: { code: string; background?: string | null; textColor?: string | null; fontWeight?: number | null }[] = [],
): RemarkStyleEntryDto[] {
  return entries.map((e) => ({
    code: e.code,
    background: e.background ?? null,
    textColor: e.textColor ?? null,
    fontWeight: e.fontWeight ?? null,
  }))
}

function toDto(doc: RemarkStyleSetDocument): RemarkStyleSetDto {
  const createdAt = doc.get('createdAt') as Date | undefined
  const updatedAt = doc.get('updatedAt') as Date | undefined
  return {
    id: String(doc._id),
    name: doc.name,
    isDefault: doc.isDefault,
    entries: (doc.entries ?? []).map((e) => ({
      code: e.code,
      background: e.background ?? null,
      textColor: e.textColor ?? null,
      fontWeight: e.fontWeight ?? null,
    })),
    lastModified: updatedAt ? updatedAt.getTime() : 0,
    createdAt: createdAt ? createdAt.getTime() : 0,
  }
}
