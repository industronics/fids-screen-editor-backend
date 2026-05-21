import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'
import { OwnerType } from '@industronics/fids-utils'

const OWNER_TYPE_VALUES = Object.values(OwnerType) as OwnerType[]

export type RemarkStyleSetDocument = HydratedDocument<RemarkStyleSetEntity>

/**
 * RemarkStyleEntry — one per-code style override within a set. `code`
 * is the 3-letter remark code sourced from flight-trips-api (e.g. FDP,
 * FCL) — intentionally NOT enum-constrained, so codes added upstream
 * flow through without a backend deploy. Any style facet may be null
 * (no override for that facet).
 */
@Schema({ _id: false })
export class RemarkStyleEntry {
  @Prop({ required: true, type: String })
  code: string

  @Prop({ type: String, default: null })
  background: string | null

  @Prop({ type: String, default: null })
  textColor: string | null

  @Prop({ type: Number, default: null })
  fontWeight: number | null
}

export const RemarkStyleEntrySchema = SchemaFactory.createForClass(RemarkStyleEntry)

/**
 * RemarkStyleSetEntity — a named, owner-scoped palette mapping remark
 * codes → display style. A display (template) references one set by id;
 * the editor flattens the resolved styles into pos_frontend's
 * `specificStyles[code]` at export. Owner scope == airport/tenant,
 * mirroring TemplateEntity's tenancy fields so the same scoped-query
 * helpers apply.
 */
@Schema({ collection: 'remarkStyleSets', timestamps: true, versionKey: false })
export class RemarkStyleSetEntity {
  @Prop({ required: true, type: String, default: 'Default' })
  name: string

  /** The set applied to displays that don't pick one explicitly. At
   *  most one default per owner — enforced at the service layer. */
  @Prop({ type: Boolean, default: false })
  isDefault: boolean

  @Prop({ type: [RemarkStyleEntrySchema], default: [] })
  entries: RemarkStyleEntry[]

  // ── Tenancy (mirrors TemplateEntity; P1 nullable, tightened later) ──

  @Prop({ type: String, enum: OWNER_TYPE_VALUES, default: null, index: true })
  ownerType: OwnerType | null

  @Prop({ type: Types.ObjectId, default: null, index: true })
  ownerId: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, default: null })
  createdBy: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, default: null })
  updatedBy: Types.ObjectId | null

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean
}

export const RemarkStyleSetSchema = SchemaFactory.createForClass(RemarkStyleSetEntity)

RemarkStyleSetSchema.index({ ownerType: 1, ownerId: 1, isActive: 1 })
RemarkStyleSetSchema.index({ ownerType: 1, ownerId: 1, isDefault: 1 }, { sparse: true })
