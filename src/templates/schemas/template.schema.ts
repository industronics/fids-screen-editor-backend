import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'
import { OwnerType } from '@industronics/fids-utils'
import {
  ORIENTATIONS,
  TEMPLATE_TYPES,
  type Orientation,
  type TemplateType,
} from '../../template-schema'

const OWNER_TYPE_VALUES = Object.values(OwnerType) as OwnerType[]

export type TemplateStatus = 'draft' | 'published'
export const TEMPLATE_STATUSES: readonly TemplateStatus[] = ['draft', 'published']

export type TemplateDocument = HydratedDocument<TemplateEntity>

/**
 * TemplateEntity — Mongo-side metadata for a template. The actual
 * template JSON (bands, elements, etc.) lives in the storage backend
 * keyed by `_id`; this document holds only the queryable fields that
 * power the library list and routing decisions. The service keeps the
 * denormalized `type` / `orientation` / `schemaVersion` in sync with
 * the body at write time.
 */
@Schema({ collection: 'templates', timestamps: true, versionKey: false })
export class TemplateEntity {
  @Prop({ required: true, type: String, default: 'Untitled' })
  name: string

  @Prop({ required: true, type: String, enum: TEMPLATE_TYPES })
  type: TemplateType

  @Prop({ required: true, type: String, enum: ORIENTATIONS })
  orientation: Orientation

  @Prop({ required: true, type: String, enum: TEMPLATE_STATUSES, default: 'draft' })
  status: TemplateStatus

  @Prop({ required: true, type: Number })
  schemaVersion: number

  @Prop({ type: Date, default: null })
  publishedAt: Date | null

  /** Provenance — where this template came from when imported from
   *  another system. Null for templates authored directly in the editor;
   *  set by import scripts or migrations. Free-form string. */
  @Prop({ type: String, default: null })
  sourceRef: string | null

  // ── Tenancy (P1: nullable; tightened to required after backfill) ──

  @Prop({ type: String, enum: OWNER_TYPE_VALUES, default: null, index: true })
  ownerType: OwnerType | null

  @Prop({ type: Types.ObjectId, default: null, index: true })
  ownerId: Types.ObjectId | null

  @Prop({ type: Boolean, default: false })
  isPublic: boolean

  @Prop({ type: [Types.ObjectId], default: [] })
  accessAirportIds: Types.ObjectId[]

  @Prop({ type: Types.ObjectId, default: null })
  createdBy: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, default: null })
  updatedBy: Types.ObjectId | null

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean
}

export const TemplateSchema = SchemaFactory.createForClass(TemplateEntity)

TemplateSchema.index({ ownerType: 1, ownerId: 1, isActive: 1 })
TemplateSchema.index({ isPublic: 1 }, { sparse: true })
TemplateSchema.index({ ownerType: 1, ownerId: 1, status: 1, isActive: 1 })
TemplateSchema.index({ accessAirportIds: 1, isActive: 1 }, { sparse: true })
TemplateSchema.index({ createdBy: 1, isActive: 1 }, { sparse: true })
