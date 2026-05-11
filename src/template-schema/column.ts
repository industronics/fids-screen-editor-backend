/**
 * FidsColumn — one vertical stripe shared by the ColumnHeaderBand and
 * the TabularMainBand. Tabular templates only.
 *
 * Knobs are split by field kind:
 *   - logo*     applies when FIDS_FIELD_META[field].kind === 'logo'
 *   - rotateTranslations / scrollDurationSec / styleRules
 *               apply when kind === 'status'
 *
 * Validation that ignored knobs aren't present is intentionally not
 * enforced in the type — it's an export-time check, not a render-time
 * concern.
 */

import type { FieldAnimation, LogoAnimation } from './animation'
import type { LogoBucketSize } from './elements'
import type { FidsField, FieldAlign } from './fields'
import type { StyleRule } from './status'

export interface ColumnCellStyle {
  fontWeight?: number
  fontSize?: number
  textColor?: string
}

export type LogoMode = 'fit' | 'fill' | 'freeform'

/**
 * Which slice of `flightNo` drives the airline-logo cycle:
 *   'flightNo'   — master + codeshares (default, current behaviour)
 *   'mainFlight' — just the master carrier (single logo, no cycle)
 *   'codeshares' — only the codeshare carriers (cycles through them)
 *
 * Mirrors the new `mainFlight` / `codeshares` text fields so a logo
 * column can pair with whichever flightNo column it sits next to.
 */
export type LogoSource = 'flightNo' | 'mainFlight' | 'codeshares'

/**
 * Date-overflow rendering for time-typed columns (scheduled / estimated /
 * actual / boardingTime / loungeOpens / loungeCloses / finalCallTime /
 * lastBagAt). When configured, the cell renders the time on the first line
 * and an overflow indicator on a second line below — either a calendar
 * date ("06 MAY") or a signed day offset ("+1" / "-1") relative to the
 * operating day. The runtime decides whether the day actually differs;
 * the editor only owns the styling and visibility policy.
 *
 * Both the time line and the date line are independently colourable —
 * the time line uses cellStyle.textColor (Body typography), the date
 * line uses dateOverflow.textColor.
 */
export type DateOverflowWhen = 'differentDay' | 'always' | 'never'
export type DateOverflowMode = 'date' | 'offset'
export type DateOverflowFormat = 'DD MMM' | 'D MMM' | 'DD/MM' | 'EEE DD'

export interface DateOverflow {
  /** Visibility policy. Default 'differentDay' (only when day differs). */
  when?: DateOverflowWhen
  /** Calendar date vs signed offset. Default 'date'. */
  mode?: DateOverflowMode
  /** Format string for mode='date'. Ignored when mode='offset'. */
  format?: DateOverflowFormat
  /** Date-line font size as a fraction of the time-line font size. Range
   *  0.3–1.0; default 0.5. Relative on purpose so overflow stays in
   *  proportion when band typography changes. */
  scale?: number
  /** Independent colour for the date line. Defaults to the time colour. */
  textColor?: string
  /** Independent weight for the date line. Defaults to the time weight. */
  fontWeight?: number
  /** Vertical gap (px) between the time and date lines. Default 2. */
  gap?: number
}

export interface FidsColumn {
  id: string
  field: FidsField
  width: number
  align: FieldAlign

  headerLabel?: string
  hideHeader?: boolean
  headerCellStyle?: ColumnCellStyle
  cellStyle?: ColumnCellStyle

  /** Animation override; falls back to FIDS_FIELD_META[field].defaultAnimation. */
  animation?: FieldAnimation

  /**
   * compactNumeric — when true, strips leading zeros from numeric
   * segments at render time. Examples: B011 → B11, A005 → A5, H006R → H6R.
   * Useful in tight portrait columns (gate, terminal). Off by default.
   * Don't enable on time/date columns where leading zeros are
   * meaningful (08:00 would become 8:0).
   */
  compactNumeric?: boolean

  // ── Logo-only knobs ──
  logoMode?: LogoMode
  logoW?: number
  logoH?: number
  logoOffsetX?: number
  logoOffsetY?: number
  /** Entry animation for cycling logos. Defaults to LOGO_ANIMATION_DEFAULT. */
  logoAnimation?: LogoAnimation
  /** Which flightNo slice drives the logo cycle. Defaults to 'flightNo'. */
  logoSource?: LogoSource
  /** Which GCS bucket variant to fetch. Auto-picks the smallest variant
   *  that meets the cell's logoW/logoH when unset. */
  bucketSize?: LogoBucketSize

  // ── Origin / Destination knobs ──
  /** When false, suppresses the "(XXX)" IATA code suffix. Defaults to true. */
  showAirportCode?: boolean

  // ── Time-field knobs ──
  /** Stacked second-line indicator for cross-day times. See `DateOverflow`. */
  dateOverflow?: DateOverflow

  // ── Status-only knobs ──
  rotateTranslations?: boolean
  scrollDurationSec?: number
  styleRules?: StyleRule[]
}
