import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import sharp from 'sharp'
import { imageSize } from 'image-size'
import { AuthRequest } from '@industronics/remote-auth'
import {
  ASSET_CATEGORIES,
  type AssetCategory,
} from '../template-schema/asset'
import { AssetEntity, type AssetDocument } from './schemas/asset.schema'
import type { UpdateAssetDto } from './dto/update-asset.dto'
import { ASSET_STORAGE_SERVICE, IStorageService } from '../storage/storage.service'
import { buildScopedListQuery, buildScopedQuery } from '../common/scoped-query'

/**
 * AssetMetaDto — response shape for the editor's library list. Mirrors
 * `editor's local AssetMeta` so the client adapter can drop straight
 * in. `url` is the absolute path the editor / renderer render an
 * `<img src=...>` against; today that's our `/assets/:id/raw` route,
 * tomorrow it could be a signed GCS URL.
 */
export interface AssetMetaDto {
  id: string
  name: string
  mime: string
  size: number
  width: number | null
  height: number | null
  category: AssetCategory
  createdAt: number
  url: string
  sourceRef: string | null
}

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name)
  private readonly publicBase: string

  constructor(
    @InjectModel(AssetEntity.name)
    private readonly model: Model<AssetEntity>,
    @Inject(ASSET_STORAGE_SERVICE)
    private readonly storage: IStorageService,
    config: ConfigService,
  ) {
    const port = Number(config.get<string>('PORT') ?? 3010)
    const fallback = `http://localhost:${port}`
    const base = config.get<string>('PUBLIC_BASE_URL') ?? fallback
    this.publicBase = base.replace(/\/$/, '')
  }

  async list(req: AuthRequest): Promise<AssetMetaDto[]> {
    const docs = await this.model
      .find(buildScopedListQuery(req))
      .sort({ createdAt: -1 })
      .lean({ virtuals: false })
      .exec()
    return docs.map((d) => this.toMeta(d as unknown as AssetDocument))
  }

  async upload(
    req: AuthRequest,
    file: Express.Multer.File,
    category: AssetCategory | undefined,
    sourceRef?: string | null,
  ): Promise<AssetMetaDto> {
    if (!file?.buffer || file.size === 0) {
      throw new Error('No file uploaded')
    }
    const dims = await this.decodeDimensions(file.buffer, file.mimetype)
    const cat = ASSET_CATEGORIES.includes(category as AssetCategory)
      ? (category as AssetCategory)
      : 'other'

    const _id = new Types.ObjectId()
    const id = String(_id)
    const resolvedSourceRef = sourceRef ?? this.storage.getStorageRef(id)

    const created = await this.model.create({
      _id,
      name: file.originalname,
      mime: file.mimetype || 'application/octet-stream',
      size: file.size,
      width: dims.width,
      height: dims.height,
      category: cat,
      sourceRef: resolvedSourceRef,
      ownerType: req.scope.ownerType,
      ownerId: req.scope.ownerId,
      createdBy: req.user.userId ? new Types.ObjectId(req.user.userId) : null,
      updatedBy: req.user.userId ? new Types.ObjectId(req.user.userId) : null,
      isActive: true,
    })
    try {
      await this.storage.put(
        id,
        file.buffer,
        file.mimetype || 'application/octet-stream',
      )
    } catch (err) {
      await this.model.deleteOne({ _id }).exec()
      throw err
    }
    return this.toMeta(created)
  }

  /**
   * Raw-bytes endpoints intentionally don't take an AuthRequest — see
   * AssetsController header comment. Existence check by id only.
   */
  async getStream(id: string): Promise<{ stream: NodeJS.ReadableStream; mime: string } | null> {
    const doc = await this.findByIdOrNull(id)
    if (!doc) return null
    const stream = await this.storage.getStream(id)
    if (!stream) {
      this.logger.warn(`asset ${id} has meta but no bytes — orphan`)
      return null
    }
    return { stream, mime: doc.mime }
  }

  async getRedirectUrl(id: string): Promise<string | null> {
    const doc = await this.findByIdOrNull(id)
    if (!doc) return null
    return this.storage.getReadUrl(id)
  }

  async update(req: AuthRequest, id: string, dto: UpdateAssetDto): Promise<AssetMetaDto> {
    const doc = await this.findScopedOrThrow(req, id)
    if (dto.name !== undefined) doc.name = dto.name.trim() || doc.name
    if (dto.category !== undefined) doc.category = dto.category
    if (dto.sourceRef !== undefined) doc.sourceRef = dto.sourceRef
    if (req.user.userId) {
      doc.updatedBy = new Types.ObjectId(req.user.userId)
    }
    await doc.save()
    return this.toMeta(doc)
  }

  async remove(req: AuthRequest, id: string): Promise<void> {
    const doc = await this.findScopedOrThrow(req, id)
    await this.storage.remove(String(doc._id))
    await this.model.deleteOne({ _id: doc._id }).exec()
  }

  resolveUrl(id: string): string {
    return `${this.publicBase}/assets/${id}/raw`
  }

  // ── Internals ────────────────────────────────────────────────────

  private async decodeDimensions(buffer: Buffer, mime: string): Promise<{ width: number | null; height: number | null }> {
    try {
      const sized = imageSize(buffer)
      if (sized?.width && sized?.height) {
        return { width: sized.width, height: sized.height }
      }
    } catch {
      // fall through to sharp
    }
    try {
      const meta = await sharp(buffer).metadata()
      return {
        width: meta.width ?? null,
        height: meta.height ?? null,
      }
    } catch (err) {
      this.logger.warn(`could not decode dimensions for ${mime}: ${(err as Error).message}`)
      return { width: null, height: null }
    }
  }

  private async findByIdOrNull(id: string): Promise<AssetDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null
    return this.model.findOne({ _id: new Types.ObjectId(id), isActive: true }).exec()
  }

  private async findScopedOrThrow(req: AuthRequest, id: string): Promise<AssetDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Asset ${id} not found`)
    }
    const doc = await this.model.findOne(buildScopedQuery(req, id)).exec()
    if (!doc) throw new NotFoundException(`Asset ${id} not found`)
    return doc
  }

  private toMeta(doc: AssetDocument): AssetMetaDto {
    const id = String(doc._id)
    const createdAt = (doc.get?.('createdAt') ?? (doc as any).createdAt) as Date | number | undefined
    return {
      id,
      name: doc.name,
      mime: doc.mime,
      size: doc.size,
      width: doc.width ?? null,
      height: doc.height ?? null,
      category: doc.category,
      createdAt: toMs(createdAt) ?? 0,
      url: this.resolveUrl(id),
      sourceRef: doc.sourceRef ?? null,
    }
  }
}

function toMs(v: Date | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  return v.getTime()
}
