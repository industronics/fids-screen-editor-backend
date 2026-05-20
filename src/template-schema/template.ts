/**
 * Template — the top-level editor document. Discriminated by `type`:
 *
 *   tabular    multi-user screens — column-driven, paginated rows
 *              (multiUserDepartures, multiUserArrivals, multiUserBaggage)
 *
 *   dedicated  single-flight screens — freeform main band with
 *              field-bound text/logo elements
 *              (dedicatedGate, dedicatedBaggage)
 *
 * The two shapes share header/footer; everything else differs. The
 * runtime decides what to fetch (single flight vs. cluster feed) from
 * `type` alone.
 */

import type {
  ColumnHeaderBand,
  DedicatedMainBand,
  DedicatedMultiMainBand,
  FreeformBand,
  SplitAxis,
  TabularMainBand,
} from './bands'
import type { FidsColumn } from './column'

export const TEMPLATE_TYPES = [
  'multiUserDepartures',
  'multiUserArrivals',
  'multiUserBaggage',
  'multiUserCheckIn',
  'dedicatedGate',
  'dedicatedBaggage',
  'dedicatedFreeform',
  'dedicatedDoubleGate',
  'dedicatedGateEntry',
  'dedicatedCarousel',
  'dedicatedFreeformMulti',
  'signageRibbon',
  'signagePillar',
  'signageDisplay',
] as const
export type TemplateType = (typeof TEMPLATE_TYPES)[number]

/** Signage types — standalone LED signboards / billboards. Distinct
 *  from the FIDS template families: no flight binding contract, no
 *  header / footer chrome, no orientation (width/height fully
 *  user-picked, any aspect). */
export const SIGNAGE_TYPES = ['signageRibbon', 'signagePillar', 'signageDisplay'] as const
export type SignageTemplateType = (typeof SIGNAGE_TYPES)[number]

export const TABULAR_TYPES = [
  'multiUserDepartures',
  'multiUserArrivals',
  'multiUserBaggage',
  'multiUserCheckIn',
] as const
export type TabularTemplateType = (typeof TABULAR_TYPES)[number]

/** Single-flight dedicated types — one freeform main band, no stamping.
 *  `dedicatedFreeform` is the blank-canvas variant — same shape, empty seed. */
export const DEDICATED_SINGLE_TYPES = ['dedicatedGate', 'dedicatedBaggage', 'dedicatedFreeform'] as const
export type DedicatedSingleTemplateType = (typeof DEDICATED_SINGLE_TYPES)[number]

/** Multi-flight dedicated types — band carries one row template stamped N times.
 *  `dedicatedFreeformMulti` is the blank-canvas variant; its axis is
 *  user-picked and stored on `main.axis` instead of being type-derived. */
export const DEDICATED_MULTI_TYPES = [
  'dedicatedDoubleGate',
  'dedicatedGateEntry',
  'dedicatedCarousel',
  'dedicatedFreeformMulti',
] as const
export type DedicatedMultiTemplateType = (typeof DEDICATED_MULTI_TYPES)[number]

/** Union of all dedicated types — single + multi. */
export const DEDICATED_TYPES = [
  ...DEDICATED_SINGLE_TYPES,
  ...DEDICATED_MULTI_TYPES,
] as const
export type DedicatedTemplateType = (typeof DEDICATED_TYPES)[number]

export const SCHEMA_VERSION = 1
export type SchemaVersion = typeof SCHEMA_VERSION

/** Default cycle period (ms) for fresh templates and the fallback when older
 *  saved/exported templates lack the field. Mirrored in tickStore for the
 *  runtime interval driver. */
export const DEFAULT_TEMPLATE_CYCLE_MS = 4000

export const ORIENTATIONS = ['landscape', 'portrait'] as const
export type Orientation = (typeof ORIENTATIONS)[number]

/**
 * Page rotation policy for tabular and dedicatedMulti templates.
 *
 * The editor owns *speed* and *transition*; the page count is decided by
 * DCMM at deployment time based on flight load vs. visible row capacity.
 * Mapping at the runtime boundary:
 *   periodSec  → Flutter `flipOffsetAtSeconds` / pos_frontend offsetSec
 *   transition → editor-side promise; Flutter currently snaps (none)
 *
 * `periodSec` is constrained to divisors of 60 in the inspector so any
 * page count DCMM picks yields a cycle that divides 60 evenly.
 */
export const FLIP_TRANSITIONS = ['none', 'fade', 'slideUp', 'slideLeft'] as const
export type FlipTransition = (typeof FLIP_TRANSITIONS)[number]

export interface FlipPagesConfig {
  periodSec: number
  transition?: FlipTransition
}

interface TemplateBase {
  schemaVersion: SchemaVersion
  orientation: Orientation
  /** Period of one animation cycle in milliseconds. Drives every AnimatedText
   *  cell's `tick % values.length`. Editable in the Animation inspector;
   *  persisted with the template so saved/exported boards keep their tempo. */
  cycleMs: number
  /** Custom artboard dimensions. Only set for freeform / signage
   *  template types where the user picks the canvas size. When absent
   *  (fixed templates), dims fall back to the global 1920×1080 /
   *  1080×1920 presets driven by `orientation`. */
  width?: number
  height?: number
  header: FreeformBand
  footer: FreeformBand
}

export interface TabularTemplate extends TemplateBase {
  type: TabularTemplateType
  columnHeader: ColumnHeaderBand
  main: TabularMainBand
  /** Column set rendered when orientation === 'landscape'. Sums to 1920. */
  columnsLandscape: FidsColumn[]
  /** Column set rendered when orientation === 'portrait'. Sums to 1080.
   *  Independent edit surface — flipping orientation does not migrate
   *  edits between the two lists. */
  columnsPortrait: FidsColumn[]
  /** Page rotation policy. Absent = no rotation. */
  flipPages?: FlipPagesConfig
}

export interface DedicatedTemplate extends TemplateBase {
  type: DedicatedSingleTemplateType
  main: DedicatedMainBand
}

export interface DedicatedMultiTemplate extends TemplateBase {
  type: DedicatedMultiTemplateType
  main: DedicatedMultiMainBand
  /** Page rotation policy. Absent = no rotation. */
  flipPages?: FlipPagesConfig
}

/**
 * SignageTemplate — standalone signboard. Width/height required;
 * header/footer present but seeded with enabled=false so the canvas
 * is pure main band. Orientation auto-syncs from w/h; UI hides toggle.
 */
export interface SignageTemplate extends TemplateBase {
  type: SignageTemplateType
  width: number
  height: number
  main: FreeformBand
}

export type AnyDedicatedTemplate = DedicatedTemplate | DedicatedMultiTemplate

export type Template = TabularTemplate | DedicatedTemplate | DedicatedMultiTemplate | SignageTemplate

export const isTabular = (t: Template): t is TabularTemplate =>
  (TABULAR_TYPES as readonly string[]).includes(t.type)

export const isDedicated = (t: Template): t is AnyDedicatedTemplate =>
  (DEDICATED_TYPES as readonly string[]).includes(t.type)

export const isDedicatedSingle = (t: Template): t is DedicatedTemplate =>
  (DEDICATED_SINGLE_TYPES as readonly string[]).includes(t.type)

export const isDedicatedMulti = (t: Template): t is DedicatedMultiTemplate =>
  (DEDICATED_MULTI_TYPES as readonly string[]).includes(t.type)

export const isSignage = (t: Template): t is SignageTemplate =>
  (SIGNAGE_TYPES as readonly string[]).includes(t.type)

/**
 * Layout direction for a dedicated-multi template's row stamping.
 *
 * Typed variants (doubleGate / gateEntry / carousel) have a fixed axis
 * baked into the type. The freeform variant (`dedicatedFreeformMulti`)
 * is user-picked and stored on `band.axis` — pass the band to resolve
 * it correctly. Without a band the freeform variant defaults to
 * 'vertical'.
 */
export function dedicatedSplitAxis(
  type: DedicatedMultiTemplateType,
  band?: DedicatedMultiMainBand,
): SplitAxis {
  if (band?.axis) return band.axis
  switch (type) {
    case 'dedicatedDoubleGate':    return 'vertical'
    case 'dedicatedGateEntry':     return 'horizontal'
    case 'dedicatedCarousel':      return 'horizontal'
    case 'dedicatedFreeformMulti': return 'vertical'
  }
}

/** Active column list for the template's current orientation. */
export function activeColumns(t: TabularTemplate): FidsColumn[] {
  return t.orientation === 'portrait' ? t.columnsPortrait : t.columnsLandscape
}

/** Returns a new template with `cols` written to the orientation's column slot. */
export function setActiveColumns(t: TabularTemplate, cols: FidsColumn[]): TabularTemplate {
  return t.orientation === 'portrait'
    ? { ...t, columnsPortrait: cols }
    : { ...t, columnsLandscape: cols }
}

export const TEMPLATE_TYPE_LABEL: Record<TemplateType, string> = {
  multiUserDepartures: 'Multi-user · Departures',
  multiUserArrivals: 'Multi-user · Arrivals',
  multiUserBaggage: 'Multi-user · Baggage',
  multiUserCheckIn: 'Multi-user · Check-in',
  dedicatedGate: 'Dedicated · Gate',
  dedicatedBaggage: 'Dedicated · Baggage',
  dedicatedFreeform: 'Dedicated · Freeform',
  dedicatedDoubleGate: 'Dedicated · Gate (Double)',
  dedicatedGateEntry: 'Dedicated · Gate Entry',
  dedicatedCarousel: 'Dedicated · Carousel',
  dedicatedFreeformMulti: 'Dedicated · Freeform (Multi)',
  signageRibbon: 'Signage · Ribbon',
  signagePillar: 'Signage · Pillar',
  signageDisplay: 'Signage · Display',
}

/**
 * TEMPLATE_TYPE_TO_DISPLAY_TYPE — export contract. Maps the editor's
 * friendly `TemplateType` keys to pos_frontend's numeric `DisplayType`
 * enum (mirrors `@industronics/fids-utils/dist/.../display.type.d.ts`):
 *
 *   1 MultiUserDeparture · 2 MultiUserArrival · 3 MultiUserBaggage
 *   4 MultiUserCheckIn   · 5 DedicatedGate    · 6 DedicatedCheckIn
 *   7 DedicatedCarousel  · 8 DedicatedCheckInRow
 *
 * The editor models 6 of those 8 today; the dedicated check-in
 * variants (6 DedicatedCheckIn, 8 DedicatedCheckInRow) have no entry yet.
 */
export const TEMPLATE_TYPE_TO_DISPLAY_TYPE: Record<TemplateType, number> = {
  multiUserDepartures: 1,
  multiUserArrivals: 2,
  multiUserBaggage: 3,
  multiUserCheckIn: 4,
  dedicatedGate: 5,
  dedicatedBaggage: 7,
  // POS DisplayType doesn't yet distinguish single vs. double-gate vs.
  // gate-entry displays — they all map to 5 (DedicatedGate). Revisit
  // when the POS contract adds dedicated variants. The freeform
  // variants follow the same provisional mapping (single→5, multi→5).
  dedicatedFreeform: 5,
  dedicatedDoubleGate: 5,
  dedicatedGateEntry: 5,
  dedicatedCarousel: 7,
  dedicatedFreeformMulti: 5,
  // Signage isn't part of the pos_frontend DisplayType contract yet —
  // map to 0 as a placeholder until the runtime team adds an explicit
  // signage display type.
  signageRibbon: 0,
  signagePillar: 0,
  signageDisplay: 0,
}
