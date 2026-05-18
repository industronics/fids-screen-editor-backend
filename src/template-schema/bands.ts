/**
 * Band shapes — the four stacked strips that compose the artboard.
 *
 *   header        FreeformBand          freeform children only
 *   columnHeader  ColumnHeaderBand      tabular templates only
 *   main          TabularMainBand       tabular templates
 *                 DedicatedMainBand     dedicated templates
 *   footer        FreeformBand          freeform children only
 *
 * Tabular vs. dedicated is decided by Template.type; this file only
 * defines the shapes a band can take. Composition lives in template.ts.
 */

import type { ClockElement, IconElement, ImageElement, LogoElement, RectElement, TextElement, WeatherElement } from './elements'

export const BAND_IDS = ['header', 'columnHeader', 'main', 'footer'] as const
export type BandId = (typeof BAND_IDS)[number]

/** Bands that host freeform children. Dedicated `main` is freeform too. */
export type FreeformBandId = 'header' | 'main' | 'footer'

export type FreeformChild = RectElement | TextElement | LogoElement | ClockElement | ImageElement | IconElement | WeatherElement

export interface FreeformBand {
  enabled: boolean
  height: number
  bg?: string
  children: FreeformChild[]
  /** Optional DCMM-driven scrolling text overlay. Editor owns styling;
   *  DCMM injects `lines[]` at deployment. `previewLines` is editor-only
   *  sample content, ignored at runtime. */
  scrollText?: ScrollTextConfig
}

export type BandFont = 'board' | 'sans' | 'mono'

/**
 * ScrollTextConfig — footer marquee styling mirroring the DCMM
 * `messageContent` payload. `backgroundColor` is folded into the band's
 * `bg` field; `lines` is editor-only (`previewLines`) since DCMM owns
 * runtime content + schedule. `direction` chooses motion direction —
 * 'left' (default, classic news-ticker) = enters right, exits left.
 */
export type ScrollDirection = 'left' | 'right'

export interface ScrollTextConfig {
  textColor: string
  font: BandFont
  fontSize: number
  /** px/sec — matches DCMM (default 35) */
  speed: number
  noScroll: boolean
  direction?: ScrollDirection
  /** px reserved on the band's left/right edges so adjacent logos/text
   *  in the footer band aren't run over by the marquee. */
  insetLeft?: number
  insetRight?: number
  previewLines: string[]
}

/**
 * BoundBandStyle — per-band defaults for the FIDS-bound bands. One font
 * / colour / bg / padding per band; per-cell or per-column overrides
 * live on FidsColumn.
 */
export interface BoundBandStyle {
  font: BandFont
  fontSize: number
  fontWeight: number
  textColor: string
  bg?: string
  padding: number
}

export interface ColumnHeaderBand {
  enabled: boolean
  height: number
  style: BoundBandStyle
}

export interface TabularMainBand {
  height: number
  rowHeight: number
  zebra: boolean
  zebraColor?: string
  style: BoundBandStyle
}

export interface DedicatedMainBand {
  height: number
  bg?: string
  children: FreeformChild[]
}

/**
 * SplitAxis — how a multi-row main band lays out its row stamps:
 *
 *   'vertical'   columns split left-to-right by a vertical divider
 *                (dedicatedDoubleGate — design ONE column, render `rowCount`)
 *   'horizontal' rows stacked top-to-bottom, divided by a horizontal line
 *                (dedicatedGateEntry — design ONE row, render `rowCount`)
 *
 * For the typed multi templates (doubleGate / gateEntry / carousel) the
 * axis is fixed by `dedicatedSplitAxis(type)` in template.ts. For
 * `dedicatedFreeformMulti` the axis is user-configurable and lives on
 * the band as `DedicatedMultiMainBand.axis`. `dedicatedSplitAxis()`
 * checks the band first and falls back to the type-derived value.
 */
export type SplitAxis = 'vertical' | 'horizontal'

/**
 * DedicatedMultiMainBand — the multi-flight dedicated variant. The
 * `children` array describes ONE row, authored at row-relative
 * coordinates (origin = top-left of one row stamp). The canvas stamps
 * it `rowCount` times along the axis derived from the template type
 * (`dedicatedSplitAxis(template.type)`), separated by `rowGap` and an
 * optional `rowDivider`. Each stamp resolves bound text + sync logos
 * against `previewFlights[(previewFlightIndex + rowIdx) % flights.length]`,
 * giving an N-flight split-screen preview.
 *
 * Modelled with the same `children` field name as DedicatedMainBand so
 * the existing band-walking helpers (findChildContext,
 * updateFreeformBandIn, layers panel, template-IO asset walker, etc.)
 * keep working without per-band branches.
 */
export interface DedicatedMultiMainBand {
  height: number
  rowCount: number
  rowGap: number
  rowDivider?: { color: string; thickness: number }
  bg?: string
  children: FreeformChild[]
  /** User-picked split direction. Only consulted for template types whose
   *  axis is not fixed (currently `dedicatedFreeformMulti`); for the typed
   *  variants the axis comes from `dedicatedSplitAxis(type)` and this
   *  field is ignored. Absent on legacy templates. */
  axis?: SplitAxis
}
