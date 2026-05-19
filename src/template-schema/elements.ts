/**
 * Element schema — discriminated union of freeform children that render
 * inside any FreeformBand (header, footer, or a dedicated template's
 * main band).
 *
 * Text and Logo elements support an optional `bind` so dedicated
 * templates can substitute live flight values at render time. Rect is
 * decorative-only and never binds.
 */

import type { FieldAnimation, LogoAnimation } from './animation'
import type { LogoSource } from './column'
import type { FidsField } from './fields'
import type { StyleRule } from './status'

export type FontFamily = 'board' | 'sans' | 'mono'
export type TextAlign = 'left' | 'center' | 'right'

/**
 * LogoBucketSize — which pre-rasterized GCS variant a LogoElement
 * resolves against. Three fixed buckets keyed by pixel dimensions:
 *   'small'  — 180×45
 *   'medium' — 350×90
 *   'banner' — 1366×200
 * The editor's `airlineLogo.ts` is the source-of-truth for the dim
 * mapping; backend just stores the discriminator. Mirrors the
 * frontend's `LogoBucketSize` so wire validation can pass it through.
 */
export type LogoBucketSize = 'small' | 'medium' | 'banner'

export interface BaseElement {
  id: string
  x: number
  y: number
  w: number
  h: number
  hidden?: boolean
  locked?: boolean
  aspectLocked?: boolean
  /**
   * Group membership — every element in the same band sharing the same
   * `groupId` is treated as one unit by selection, drag, snap, and gap
   * math in the editor. Flat membership: no nested groups, no
   * group-level properties. The renderer ignores this field today;
   * grouping is editor-only state that round-trips through the wire
   * format without affecting playback.
   */
  groupId?: string
}

/**
 * FieldBinding — when present on a TextElement, the element renders the
 * flight value for `field` instead of its literal `text`. Logo binding
 * lives on LogoElement directly via `syncWithFlightNo`.
 */
export interface FieldBinding {
  field: FidsField
  animation?: FieldAnimation
}

export interface RectElement extends BaseElement {
  type: 'rect'
  fill?: string
}

export interface TextElement extends BaseElement {
  type: 'text'
  text?: string
  textColor?: string
  fontSize?: number
  fontFamily?: FontFamily
  fontWeight?: number
  textAlign?: TextAlign
  bind?: FieldBinding
  /**
   * Cycling literals — when present and non-empty AND `bind` is unset,
   * the element renders `cycleValues[tick % length]` and rotates with
   * the template's `cycleMs` cadence (the same heartbeat that drives
   * codeshare/translation cycling). Useful for bilingual labels
   * ("BOARDING" / "MASUK PESAWAT") that aren't a FidsField.
   *
   * Precedence: bind > cycleValues > text.
   */
  cycleValues?: string[]
  /**
   * Static background painted behind the text. Useful for "pill"
   * shapes (e.g. the REMARK badge) without stacking a separate Rect
   * element underneath. Status-driven `styleRules` win over this
   * value when they match.
   */
  background?: string
  /**
   * Status-driven style overrides. Honoured only when `bind` resolves
   * to a status field (`remarkStatus`, `overallStatus`,
   * `carouselStatus`); the renderer reads the active flight's
   * `FlightStatus`, walks the rules first-match-wins, and applies
   * `textColor`/`background`/`fontWeight` over the static defaults.
   */
  styleRules?: StyleRule[]
  /**
   * When true the renderer wraps overflowing text inside the authored
   * box (whiteSpace: pre-wrap, overflowWrap: break-word) and clips
   * vertically. Defaults to false (legacy single-line nowrap).
   *
   * Trade-off: cycle animations are bypassed in wrap mode because
   * FadeText / SlideText / SplitFlap assume a single line. Cycling
   * itself still works — the renderer shows the active value.
   */
  wrap?: boolean
  /** wrap-only: line-height multiplier. Defaults to 1.2 in the
   *  renderer when wrap is on. */
  lineHeight?: number
  /**
   * Mirrors `FidsColumn.showAirportCode`. When `bind.field` is
   * `'destination'` or `'origin'`, setting this to `false` drops the
   * `(IATA)` suffix and renders just the city. Undefined / true keeps
   * legacy `City (IATA)` formatting.
   */
  showAirportCode?: boolean
  /**
   * Mirrors `FidsColumn.compactNumeric`. When true, the renderer strips
   * leading zeros from numeric segments of the resolved value
   * (e.g. "B011" → "B11"). Useful for short gate / time labels.
   */
  compactNumeric?: boolean
}

export interface LogoElement extends BaseElement {
  type: 'logo'
  fill?: string
  /** Static IATA — used when `syncWithFlightNo` is false/undefined. */
  iataCode?: string
  /** When true, the rendered logo cycles in lockstep with the
   *  template's flightNo binding (single source of truth: the
   *  flight-number string itself, IATA derived via split-on-space). */
  syncWithFlightNo?: boolean
  /** Which flightNo slice drives the cycle. Defaults to `'flightNo'`
   *  (master + codeshares) when omitted. Mirrors `FidsColumn.logoSource`. */
  logoSource?: LogoSource
  /** Which GCS bucket variant to fetch. When unset, the renderer
   *  auto-picks the smallest variant that meets the element's w/h. */
  bucketSize?: LogoBucketSize
  /** Entry transition replayed each tick when the cycling IATA changes.
   *  Same closed set as tabular-column `logoAnimation`. Omitted = no
   *  animation (`'none'`). */
  animation?: LogoAnimation
  /** How the resolved logo image sits inside its element box. Default
   *  render = `'contain'`. */
  objectFit?: ImageObjectFit
}

/**
 * ImageObjectFit — how the image should sit inside its element box.
 *   'cover'    crop to fill (default — what legacy header bmps want)
 *   'contain'  fit fully, may letterbox
 *   'fill'     stretch to box (distorts aspect)
 */
export type ImageObjectFit = 'cover' | 'contain' | 'fill'

/**
 * ImageElement — raster (bmp/png/jpg) drop. Source is a URL relative to
 * the deployment root (Vite serves anything under `public/` at `/<file>`),
 * or any absolute URL. Empty src renders a placeholder so the layer is
 * visible while the user wires it up.
 *
 * Animated GIFs are supported via the same `<img>` render path — pick an
 * asset from the `'animation'` category and it plays natively.
 */
export interface ImageElement extends BaseElement {
  type: 'image'
  src?: string
  objectFit?: ImageObjectFit
}

/**
 * IconElement — pictogram element. Same render contract as ImageElement
 * (asset URL + objectFit), but kept as a distinct discriminator so the
 * add-element menu, layer tree, and inspector can route picks to the
 * `'icon'` asset category by default. Useful for signage boards
 * (weather, directional, info pictograms) but valid in any FreeformBand.
 */
export interface IconElement extends BaseElement {
  type: 'icon'
  src?: string
  objectFit?: ImageObjectFit
  /**
   * Optional tint. When set, the icon renders via CSS `mask-image` +
   * `background-color`, painting the asset's alpha shape in the given
   * colour — so the same monochrome SVG (or alpha-PNG) can be recoloured
   * per placement without uploading a recoloured copy. Multi-colour SVGs
   * collapse to the tint; that's the intended pictogram behaviour. When
   * undefined the icon renders as an `<img>` and preserves its authored
   * colours.
   */
  tint?: string
}

/**
 * ClockFormat — what the clock element renders. Time, date, and
 * combined variants share the element shape; they're just different
 * format strings on the same live-updating component.
 *
 *   Time:
 *     'HH:mm'              24-hour, no seconds  (default)
 *     'HH:mm:ss'           24-hour, with seconds
 *     'h:mm a'             12-hour with AM/PM
 *   Date:
 *     'd MMM'              18 Jan
 *     'd MMM yyyy'         18 Jan 2026
 *     'EEE, d MMM'         Mon, 18 Jan
 *   Date & time (combined, ' · ' separator):
 *     'HH:mm · d MMM'      14:32 · 18 Jan
 *     'd MMM · HH:mm'      18 Jan · 14:32
 *     'EEE · HH:mm'        Mon · 14:32
 *     'EEE d MMM · HH:mm'  Mon 18 Jan · 14:32
 */
export type ClockFormat =
  | 'HH:mm'
  | 'HH:mm:ss'
  | 'h:mm a'
  | 'd MMM'
  | 'd MMM yyyy'
  | 'EEE, d MMM'
  | 'HH:mm · d MMM'
  | 'd MMM · HH:mm'
  | 'EEE · HH:mm'
  | 'EEE d MMM · HH:mm'

export const TIME_FORMATS: readonly ClockFormat[] = ['HH:mm', 'HH:mm:ss', 'h:mm a']
export const DATE_FORMATS: readonly ClockFormat[] = ['d MMM', 'd MMM yyyy', 'EEE, d MMM']
export const COMBINED_FORMATS: readonly ClockFormat[] = [
  'HH:mm · d MMM',
  'd MMM · HH:mm',
  'EEE · HH:mm',
  'EEE d MMM · HH:mm',
]

export function isDateFormat(f: ClockFormat): boolean {
  return (DATE_FORMATS as readonly string[]).includes(f)
}

/** True for any format containing a time portion (used to decide
 *  the live-clock interval and the auto editorial label). */
export function hasTime(f: ClockFormat): boolean {
  return (TIME_FORMATS as readonly string[]).includes(f) || (COMBINED_FORMATS as readonly string[]).includes(f)
}

/**
 * ClockStyle — visual treatment for the clock element. Each style
 * applies to both time AND date formats; the renderer handles the
 * substring layout consistently.
 *
 *   'plain'      naked text (default)
 *   'splitFlap'  Solari board cards — each char in a flip-style panel
 *   'pillChip'   value inside a rounded pill with contrasting bg
 *   'editorial'  small uppercase label above + value below
 */
export type ClockStyle = 'plain' | 'splitFlap' | 'pillChip' | 'editorial'

export interface ClockElement extends BaseElement {
  type: 'clock'
  format?: ClockFormat
  style?: ClockStyle
  textColor?: string
  fontSize?: number
  fontFamily?: FontFamily
  fontWeight?: number
  textAlign?: TextAlign
  /** Box background for the whole clock element (any variant).
   *  Undefined = transparent (legacy behavior). */
  background?: string
  /** editorial-only: label shown above the value. Auto-derived from
   *  format when omitted (LOCAL / TODAY / DATE). */
  label?: string
  /** editorial-only: label tint. Falls back to textColor at 70% opacity. */
  labelColor?: string
  /** pillChip-only: pill background. Defaults to '#0A0A0A'. */
  pillBg?: string
  /** splitFlap-only: chip base color. Renderer derives a 3-stop
   *  gradient (lighter top, dark seam, base bottom) so the user picks
   *  one color and keeps the mechanical look. Defaults to '#1A1A1A'. */
  chipBg?: string
}

export type WeatherVariant = 'fill' | 'flat' | 'line' | 'monochrome'

export type WeatherLayout =
  | 'icon-only'
  | 'icon-top'
  | 'icon-bottom'
  | 'icon-left'
  | 'icon-right'

/**
 * WeatherSlot — per-data-piece config for the Weather widget. Each of
 * the four slots (temp / condition / city / highLow) gets its own
 * visibility toggle and full typography override.
 */
export interface WeatherSlot {
  show: boolean
  color?: string
  fontSize?: number
  fontWeight?: number
  fontFamily?: FontFamily
  textAlign?: TextAlign
}

/**
 * WeatherElement — live weather widget. The runtime (DCMM + processor)
 * substitutes live values for temp/condition/city/highLow based on the
 * screen's deploy-site coordinates; the template only stores appearance
 * and design-time previews. `previewCondition` uses the OWM icon-code
 * vocabulary ('01d', '10n', …).
 */
export interface WeatherElement extends BaseElement {
  type: 'weather'
  layout: WeatherLayout
  variant: WeatherVariant
  animated: boolean
  iconScale?: number

  temp: WeatherSlot
  condition: WeatherSlot
  city: WeatherSlot
  highLow: WeatherSlot

  background?: string
  borderRadius?: number
  padding?: number

  previewCondition: string
  previewCity: string
  cyclePreview?: boolean
}

export type CanvasElement = RectElement | TextElement | LogoElement | ClockElement | ImageElement | IconElement | WeatherElement

type DistributiveOmit<T, K extends keyof T> = T extends T ? Omit<T, K> : never
export type ElementInit = DistributiveOmit<CanvasElement, 'id'>

export const isRect = (e: CanvasElement): e is RectElement => e.type === 'rect'
export const isText = (e: CanvasElement): e is TextElement => e.type === 'text'
export const isLogo = (e: CanvasElement): e is LogoElement => e.type === 'logo'
export const isClock = (e: CanvasElement): e is ClockElement => e.type === 'clock'
export const isWeather = (e: CanvasElement): e is WeatherElement => e.type === 'weather'
export const isImage = (e: CanvasElement): e is ImageElement => e.type === 'image'
export const isIcon = (e: CanvasElement): e is IconElement => e.type === 'icon'
