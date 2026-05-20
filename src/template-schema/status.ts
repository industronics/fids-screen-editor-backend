/**
 * Status surface — the structured shape that lets a remarks-bound column
 * render rotation and conditional styling.
 *
 * `RemarkCode` mirrors `RemarkToCodeMapping` from
 * `@industronics/fids-utils` (pos_frontend's runtime). The members are
 * the friendly keys that the editor stores in templates; the runtime
 * maps each to a 3-letter code via `REMARK_TO_CODE` below — that mapping
 * is the export contract.
 *
 * `NIL` is editor-only: it represents "no status" in mock previews where
 * a status field doesn't apply (e.g. carouselRemarks on a departure
 * row). Templates exported to the runtime should never carry NIL on a
 * required status field.
 *
 * `ON_TIME` is also editor-only — a friendlier alias for pos_frontend's
 * `CONFIRMED` (FCF), the runtime's "no special remark / on schedule"
 * marker. Maps to `'FCF'` on export.
 */

export const REMARK_CODES = [
  // editor-only sentinels
  'NIL',
  'ON_TIME',

  // mirrored from RemarkToCodeMapping (40 values)
  'OPEN',
  'OPEN_CKS',
  'STAND_F01',
  'NO_OPE',
  'CANCELLED',
  'DELAYED',
  'DEPARTED',
  'LANDED',
  'CAROUSEL_CLOSED',
  'FIRST_BAG',
  'LAST_BAG',
  'BAG_DELAY',
  'CAROUSEL_OPEN',
  'GATE_OPEN',
  'GATE_CLOSED',
  'BOARDING',
  'FINAL_CALL',
  'NEW_GATE',
  'DESK_OPEN',
  'REOPEN',
  'DESK_CLOSED',
  'RECLOSE',
  'OPEN_IOP',
  'CLOSED_ICL',
  'CONFIRMED',
  'INQUIRE',
  'DIVERTED',
  'RETIME',
  'DELAYED_CAR',
  'AT_LCCT_LCC',
  'AT_LCCT_ICC',
  'NEXT_FLIGHT',
  'NEXT_FLIGHT_NXF',
  'USE_KIOSK',
  'RETURN_FLIGHT',
  'TESTING',
  'NEW_TIME',
  'GO_TO_GATE',
  'GATE_SHOWN',
  'GATE_CHANGE',
] as const

export type RemarkCode = (typeof REMARK_CODES)[number]

/**
 * REMARK_TO_CODE — friendly key → 3-letter code (matches
 * `RemarkToCodeMapping` enum values verbatim). Used at export / import
 * time to round-trip with pos_frontend's runtime payload, where
 * `FlightStatus.key` carries the 3-letter code rather than the friendly
 * key.
 */
export const REMARK_TO_CODE: Record<RemarkCode, string> = {
  NIL: '',
  ON_TIME: 'FCF',

  OPEN: 'CDK',
  OPEN_CKS: 'CKS',
  STAND_F01: 'STD',
  NO_OPE: 'OPE',
  CANCELLED: 'FCL',
  DELAYED: 'FDL',
  DEPARTED: 'FDP',
  LANDED: 'FLD',
  CAROUSEL_CLOSED: 'CCL',
  FIRST_BAG: 'CFB',
  LAST_BAG: 'CLB',
  BAG_DELAY: 'CDL',
  CAROUSEL_OPEN: 'COP',
  GATE_OPEN: 'GOP',
  GATE_CLOSED: 'GCL',
  BOARDING: 'GBD',
  FINAL_CALL: 'GFC',
  NEW_GATE: 'GCH',
  DESK_OPEN: 'DOP',
  REOPEN: 'DRO',
  DESK_CLOSED: 'DCL',
  RECLOSE: 'DRC',
  OPEN_IOP: 'IOP',
  CLOSED_ICL: 'ICL',
  CONFIRMED: 'FCF',
  INQUIRE: 'FIN',
  DIVERTED: 'FDV',
  RETIME: 'FRT',
  DELAYED_CAR: 'CAR',
  AT_LCCT_LCC: 'LCC',
  AT_LCCT_ICC: 'ICC',
  NEXT_FLIGHT: 'NXT',
  NEXT_FLIGHT_NXF: 'NXF',
  USE_KIOSK: 'KSK',
  RETURN_FLIGHT: 'FRB',
  TESTING: 'TST',
  NEW_TIME: 'NTM',
  GO_TO_GATE: 'GTG',
  GATE_SHOWN: 'GSH',
  GATE_CHANGE: 'GCN',
}

/**
 * STATUS_SOURCE — names which of the runtime's parallel status fields a
 * column reads from. The editor never sees real flight data, but the
 * binding has to make the choice explicit so the export contract is
 * unambiguous.
 */
export const STATUS_SOURCES = ['remarkCode', 'currentStatus', 'carouselRemarks', 'checkInStatus'] as const
export type StatusSource = (typeof STATUS_SOURCES)[number]

export interface StatusTranslation {
  /** ISO-639-1 language tag, e.g. 'en', 'zh', 'ms'. */
  lang: string
  value: string
}

export interface FlightStatus {
  key: RemarkCode
  description: string
  translations?: StatusTranslation[]
}

/**
 * StyleRule — first-match wins. Applied per-cell (tabular) and per
 * bound-text element (dedicated) at render time: the runtime resolves
 * the relevant `FlightStatus`, then walks `styleRules` for the first
 * rule whose `when.key` matches and applies its overrides.
 *
 * `background` is honoured by the dedicated text path only — tabular
 * cells already paint a row-level zebra/bg and don't currently expose
 * per-cell backgrounds.
 */
export interface StyleRule {
  when: { key: RemarkCode }
  textColor?: string
  fontWeight?: number
  background?: string
}
