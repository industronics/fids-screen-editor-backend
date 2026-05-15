/**
 * templateSchema — runtime zod schemas mirroring the TS Template type.
 * Used to validate imported JSON before loading it into the editor.
 *
 * The TS types in src/schema/* are the source of truth at compile time;
 * these schemas duplicate that shape for runtime checks. The duplication
 * is deliberate: exported templates are a versioned wire format, and we
 * want the import path to fail loudly on any unexpected shape rather
 * than silently corrupt the editor state.
 *
 * Schema version mismatches reject by default — when SCHEMA_VERSION
 * bumps, add a migration here and decide whether to accept older
 * versions read-only or migrate them in place.
 */

import { z } from 'zod'
import { FIELD_ANIMATIONS, LOGO_ANIMATIONS } from './animation'
import { FIDS_FIELDS } from './fields'
import { REMARK_CODES } from './status'
import { DEFAULT_TEMPLATE_CYCLE_MS, ORIENTATIONS, SCHEMA_VERSION } from './template'

// zod v4 accepts readonly tuples directly; spreading into a mutable
// tuple preserves the literal members so the inferred z.infer result
// keeps the narrow union types (rather than widening to `string`).
const fidsField = z.enum([...FIDS_FIELDS] as unknown as readonly [(typeof FIDS_FIELDS)[number], ...(typeof FIDS_FIELDS)[number][]])
const fieldAnimation = z.enum([...FIELD_ANIMATIONS] as unknown as readonly [(typeof FIELD_ANIMATIONS)[number], ...(typeof FIELD_ANIMATIONS)[number][]])
const logoAnimation = z.enum([...LOGO_ANIMATIONS] as unknown as readonly [(typeof LOGO_ANIMATIONS)[number], ...(typeof LOGO_ANIMATIONS)[number][]])
const remarkCode = z.enum([...REMARK_CODES] as unknown as readonly [(typeof REMARK_CODES)[number], ...(typeof REMARK_CODES)[number][]])
const orientation = z.enum([...ORIENTATIONS] as unknown as readonly [(typeof ORIENTATIONS)[number], ...(typeof ORIENTATIONS)[number][]])

const fieldAlign = z.enum(['left', 'center', 'right'])
const fontFamily = z.enum(['board', 'sans', 'mono'])
const textAlign = z.enum(['left', 'center', 'right'])

// ── Element schemas ────────────────────────────────────────────────

const baseElement = {
  id: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
  aspectLocked: z.boolean().optional(),
}

const fieldBinding = z.object({
  field: fidsField,
  animation: fieldAnimation.optional(),
})

const styleRule = z.object({
  when: z.object({ key: remarkCode }),
  textColor: z.string().optional(),
  fontWeight: z.number().optional(),
  background: z.string().optional(),
})

const rectElement = z.object({
  ...baseElement,
  type: z.literal('rect'),
  fill: z.string().optional(),
})

const textElement = z.object({
  ...baseElement,
  type: z.literal('text'),
  text: z.string().optional(),
  textColor: z.string().optional(),
  fontSize: z.number().optional(),
  fontFamily: fontFamily.optional(),
  fontWeight: z.number().optional(),
  textAlign: textAlign.optional(),
  bind: fieldBinding.optional(),
  cycleValues: z.array(z.string()).optional(),
  background: z.string().optional(),
  styleRules: z.array(styleRule).optional(),
  wrap: z.boolean().optional(),
  lineHeight: z.number().optional(),
  showAirportCode: z.boolean().optional(),
  compactNumeric: z.boolean().optional(),
})

const logoSourceEnum = z.enum(['flightNo', 'mainFlight', 'codeshares'])
const logoBucketSize = z.enum(['small', 'medium', 'banner'])
const imageObjectFit = z.enum(['cover', 'contain', 'fill'])

const logoElement = z.object({
  ...baseElement,
  type: z.literal('logo'),
  fill: z.string().optional(),
  iataCode: z.string().optional(),
  syncWithFlightNo: z.boolean().optional(),
  logoSource: logoSourceEnum.optional(),
  bucketSize: logoBucketSize.optional(),
  animation: logoAnimation.optional(),
  objectFit: imageObjectFit.optional(),
})

const clockFormat = z.enum([
  'HH:mm', 'HH:mm:ss', 'h:mm a',
  'd MMM', 'd MMM yyyy', 'EEE, d MMM',
  'HH:mm · d MMM', 'd MMM · HH:mm', 'EEE · HH:mm', 'EEE d MMM · HH:mm',
])
const clockStyle = z.enum(['plain', 'splitFlap', 'pillChip', 'editorial'])

const clockElement = z.object({
  ...baseElement,
  type: z.literal('clock'),
  format: clockFormat.optional(),
  style: clockStyle.optional(),
  textColor: z.string().optional(),
  fontSize: z.number().optional(),
  fontFamily: fontFamily.optional(),
  fontWeight: z.number().optional(),
  textAlign: textAlign.optional(),
  background: z.string().optional(),
  label: z.string().optional(),
  labelColor: z.string().optional(),
  pillBg: z.string().optional(),
  chipBg: z.string().optional(),
})

const imageElement = z.object({
  ...baseElement,
  type: z.literal('image'),
  src: z.string().optional(),
  objectFit: imageObjectFit.optional(),
})

const freeformChild = z.discriminatedUnion('type', [
  rectElement, textElement, logoElement, clockElement, imageElement,
])

// ── Band schemas ───────────────────────────────────────────────────

const boundBandStyle = z.object({
  font: fontFamily,
  fontSize: z.number(),
  fontWeight: z.number(),
  textColor: z.string(),
  bg: z.string().optional(),
  padding: z.number(),
})

const scrollTextConfig = z.object({
  textColor: z.string(),
  font: fontFamily,
  fontSize: z.number().positive(),
  speed: z.number().nonnegative(),
  noScroll: z.boolean(),
  direction: z.enum(['left', 'right']).optional(),
  insetLeft: z.number().nonnegative().optional(),
  insetRight: z.number().nonnegative().optional(),
  previewLines: z.array(z.string()),
})

const freeformBand = z.object({
  enabled: z.boolean(),
  height: z.number(),
  bg: z.string().optional(),
  children: z.array(freeformChild),
  scrollText: scrollTextConfig.optional(),
})

const columnHeaderBand = z.object({
  enabled: z.boolean(),
  height: z.number(),
  style: boundBandStyle,
})

const tabularMainBand = z.object({
  height: z.number(),
  rowHeight: z.number(),
  zebra: z.boolean(),
  zebraColor: z.string().optional(),
  style: boundBandStyle,
})

const dedicatedMainBand = z.object({
  height: z.number(),
  bg: z.string().optional(),
  children: z.array(freeformChild),
})

const dedicatedMultiMainBand = z.object({
  height: z.number(),
  rowCount: z.number().int().positive(),
  rowGap: z.number().nonnegative(),
  rowDivider: z.object({
    color: z.string(),
    thickness: z.number().nonnegative(),
  }).optional(),
  bg: z.string().optional(),
  children: z.array(freeformChild),
  // User-picked split direction. Only meaningful for dedicatedFreeformMulti;
  // ignored (but tolerated) on the typed variants where axis is fixed.
  axis: z.enum(['vertical', 'horizontal']).optional(),
})

// ── Column schema ──────────────────────────────────────────────────

const columnCellStyle = z.object({
  fontWeight: z.number().optional(),
  fontSize: z.number().optional(),
  textColor: z.string().optional(),
})

const logoMode = z.enum(['fit', 'fill', 'freeform'])
const logoSource = z.enum(['flightNo', 'mainFlight', 'codeshares'])

const dateOverflow = z.object({
  when: z.enum(['differentDay', 'always', 'never']).optional(),
  mode: z.enum(['date', 'offset']).optional(),
  format: z.enum(['DD MMM', 'D MMM', 'DD/MM', 'EEE DD']).optional(),
  scale: z.number().min(0.3).max(1).optional(),
  textColor: z.string().optional(),
  fontWeight: z.number().optional(),
  gap: z.number().nonnegative().optional(),
})

const fidsColumn = z.object({
  id: z.string(),
  field: fidsField,
  width: z.number(),
  align: fieldAlign,
  headerLabel: z.string().optional(),
  hideHeader: z.boolean().optional(),
  headerCellStyle: columnCellStyle.optional(),
  cellStyle: columnCellStyle.optional(),
  animation: fieldAnimation.optional(),
  compactNumeric: z.boolean().optional(),
  logoMode: logoMode.optional(),
  logoW: z.number().optional(),
  logoH: z.number().optional(),
  logoOffsetX: z.number().optional(),
  logoOffsetY: z.number().optional(),
  logoAnimation: logoAnimation.optional(),
  logoSource: logoSource.optional(),
  bucketSize: logoBucketSize.optional(),
  showAirportCode: z.boolean().optional(),
  dateOverflow: dateOverflow.optional(),
  rotateTranslations: z.boolean().optional(),
  scrollDurationSec: z.number().optional(),
  styleRules: z.array(styleRule).optional(),
})

// ── Template schemas ───────────────────────────────────────────────

const templateBase = {
  schemaVersion: z.literal(SCHEMA_VERSION),
  orientation,
  // Optional with a default: older exports that predate this field still
  // validate, and the parsed result always exposes a number so the editor
  // never has to handle `undefined`. Bump to a versioned migration if a
  // future change ever needs to be non-additive.
  cycleMs: z.number().positive().default(DEFAULT_TEMPLATE_CYCLE_MS),
  // Custom canvas dims for freeform templates; absent on fixed types.
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  header: freeformBand,
  footer: freeformBand,
}

const flipPages = z.object({
  periodSec: z.number().int().positive(),
  transition: z.enum(['none', 'fade', 'slideUp', 'slideLeft']).optional(),
})

const tabularTemplate = z.object({
  ...templateBase,
  type: z.enum(['multiUserDepartures', 'multiUserArrivals', 'multiUserBaggage']),
  columnHeader: columnHeaderBand,
  main: tabularMainBand,
  columnsLandscape: z.array(fidsColumn),
  columnsPortrait: z.array(fidsColumn),
  flipPages: flipPages.optional(),
})

const dedicatedTemplate = z.object({
  ...templateBase,
  type: z.enum(['dedicatedGate', 'dedicatedBaggage', 'dedicatedFreeform']),
  main: dedicatedMainBand,
})

const dedicatedMultiTemplate = z.object({
  ...templateBase,
  type: z.enum([
    'dedicatedDoubleGate',
    'dedicatedGateEntry',
    'dedicatedCarousel',
    'dedicatedFreeformMulti',
  ]),
  main: dedicatedMultiMainBand,
  flipPages: flipPages.optional(),
})

// Signage — width/height required (shadow the base's optional fields);
// main is a FreeformBand (reuses the freeform editing surface).
const signageTemplate = z.object({
  ...templateBase,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  type: z.enum(['signageRibbon', 'signagePillar', 'signageDisplay']),
  main: freeformBand,
})

export const templateSchema = z.discriminatedUnion('type', [
  tabularTemplate,
  dedicatedTemplate,
  dedicatedMultiTemplate,
  signageTemplate,
])

// ── Export envelope ────────────────────────────────────────────────
//
// Wraps the template body with format/version markers so the import
// path can fail fast on the wrong file kind. The envelope's `version`
// is the export-format version, separate from the template's
// schemaVersion (one tracks the wire format, the other tracks the
// in-editor data model).

export const EXPORT_FORMAT = 'rocket-builder/template'
export const EXPORT_VERSION = 1

export const exportEnvelopeSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(EXPORT_VERSION),
  name: z.string(),
  exportedAt: z.number(),
  template: templateSchema,
})

export type TemplateValidationResult =
  | { ok: true; name: string; template: z.infer<typeof templateSchema> }
  | { ok: false; error: string }

/**
 * Parse a JSON text payload into a validated template envelope.
 * Returns a discriminated result so callers can branch on outcome
 * without needing try/catch.
 */
export function parseTemplateJson(text: string): TemplateValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid JSON' }
  }
  const result = exportEnvelopeSchema.safeParse(parsed)
  if (!result.success) {
    const first = result.error.issues[0]
    const where = first?.path.length ? first.path.join('.') : '<root>'
    const what = first?.message ?? 'Validation failed'
    return { ok: false, error: `${where}: ${what}` }
  }
  return { ok: true, name: result.data.name, template: result.data.template }
}
