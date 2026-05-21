/**
 * Field catalogue — every data binding the editor can express, plus
 * the per-template-type allowlist that gates which appear in the
 * column-add menu and the "Bind to field" picker for dedicated screens.
 *
 * `FidsField` is intentionally short and editor-friendly. The runtime
 * (pos_frontend) owns the mapping from these IDs to its internal flight
 * keys; that mapping is the single contract surface between the two.
 *
 * `FidsFieldMeta.kind` drives the renderer:
 *   - 'text'   → plain string substitution (with optional animation)
 *   - 'logo'   → IATA-derived image; cycles in lockstep with `flightNo`
 *   - 'status' → reads a FlightStatus, supports translation rotation;
 *                colours resolve from the RemarkStyleSet at render time
 */

import type { FieldAnimation } from './animation'
import type { StatusSource } from './status'
import type { TemplateType } from './template'

export const FIDS_FIELDS = [
  // Identity
  'flightNo',
  'mainFlight',
  'codeshares',
  'airlineLogo',
  'aircraftType',
  // Route
  'destination',
  'origin',
  'terminal',
  // Times
  'scheduled',
  'estimated',
  'actual',
  'boardingTime',
  // Departure-side location
  'gate',
  'lounge',
  'loungeOpens',
  'loungeCloses',
  'finalCallTime',
  // Arrival / baggage
  'carousel',
  'lastBagAt',
  // Check-in
  'checkInRow',
  'checkInOpens',
  'checkInCloses',
  // Status (each binds to one FlightStatus on the flight payload)
  'remarkStatus',
  'overallStatus',
  'carouselStatus',
  'checkInStatus',
] as const

export type FidsField = (typeof FIDS_FIELDS)[number]

export type FieldKind = 'text' | 'logo' | 'status'
export type FieldAlign = 'left' | 'center' | 'right'

export interface FidsFieldMeta {
  id: FidsField
  label: string
  kind: FieldKind
  defaultWidth: number
  defaultAlign: FieldAlign
  defaultAnimation: FieldAnimation
  /** Status fields name which FlightStatus the runtime should read. */
  statusSource?: StatusSource
  /** Logo fields cycle in lockstep with the column bound to `syncTarget`. */
  syncTarget?: 'flightNo'
  mockHeader: string
  mockCell: string
}

export const FIDS_FIELD_META: Record<FidsField, FidsFieldMeta> = {
  flightNo: {
    id: 'flightNo',
    label: 'Flight No',
    kind: 'text',
    defaultWidth: 220,
    defaultAlign: 'left',
    defaultAnimation: 'splitFlap',
    mockHeader: 'FLIGHT',
    mockCell: 'SQ 3021',
  },
  mainFlight: {
    id: 'mainFlight',
    label: 'Main Flight',
    kind: 'text',
    defaultWidth: 180,
    defaultAlign: 'left',
    // Single value — no cycling, so no transition.
    defaultAnimation: 'none',
    mockHeader: 'FLIGHT',
    mockCell: 'MH 2612',
  },
  codeshares: {
    id: 'codeshares',
    label: 'Codeshares',
    kind: 'text',
    defaultWidth: 220,
    defaultAlign: 'left',
    defaultAnimation: 'fade',
    mockHeader: 'CODESHARE',
    mockCell: 'QR 5441',
  },
  airlineLogo: {
    id: 'airlineLogo',
    label: 'Airline Logo',
    kind: 'logo',
    defaultWidth: 150,
    defaultAlign: 'center',
    defaultAnimation: 'none',
    syncTarget: 'flightNo',
    mockHeader: '',
    mockCell: 'SQ',
  },
  aircraftType: {
    id: 'aircraftType',
    label: 'Aircraft',
    kind: 'text',
    defaultWidth: 140,
    defaultAlign: 'center',
    defaultAnimation: 'none',
    mockHeader: 'A/C',
    mockCell: 'B777',
  },
  destination: {
    id: 'destination',
    label: 'Destination',
    kind: 'text',
    defaultWidth: 540,
    defaultAlign: 'left',
    defaultAnimation: 'slideUp',
    mockHeader: 'DESTINATION',
    mockCell: 'New York (JFK)',
  },
  origin: {
    id: 'origin',
    label: 'Origin',
    kind: 'text',
    defaultWidth: 540,
    defaultAlign: 'left',
    defaultAnimation: 'slideUp',
    mockHeader: 'ORIGIN',
    mockCell: 'Singapore (SIN)',
  },
  terminal: {
    id: 'terminal',
    label: 'Terminal',
    kind: 'text',
    defaultWidth: 120,
    defaultAlign: 'center',
    defaultAnimation: 'none',
    mockHeader: 'T',
    mockCell: 'T1',
  },
  scheduled: {
    id: 'scheduled',
    label: 'Scheduled',
    kind: 'text',
    defaultWidth: 180,
    defaultAlign: 'center',
    defaultAnimation: 'none',
    mockHeader: 'SCHED',
    mockCell: '14:35',
  },
  estimated: {
    id: 'estimated',
    label: 'Estimated',
    kind: 'text',
    defaultWidth: 180,
    defaultAlign: 'center',
    defaultAnimation: 'none',
    mockHeader: 'EST',
    mockCell: '14:50',
  },
  actual: {
    id: 'actual',
    label: 'Actual',
    kind: 'text',
    defaultWidth: 180,
    defaultAlign: 'center',
    defaultAnimation: 'none',
    mockHeader: 'ACT',
    mockCell: '14:48',
  },
  boardingTime: {
    id: 'boardingTime',
    label: 'Boarding Time',
    kind: 'text',
    defaultWidth: 180,
    defaultAlign: 'center',
    defaultAnimation: 'none',
    mockHeader: 'BRD',
    mockCell: '14:05',
  },
  gate: {
    id: 'gate',
    label: 'Gate',
    kind: 'text',
    defaultWidth: 140,
    defaultAlign: 'center',
    defaultAnimation: 'none',
    mockHeader: 'GATE',
    mockCell: 'B12',
  },
  lounge: {
    id: 'lounge',
    label: 'Lounge',
    kind: 'text',
    defaultWidth: 160,
    defaultAlign: 'center',
    defaultAnimation: 'none',
    mockHeader: 'LOUNGE',
    mockCell: 'L2',
  },
  loungeOpens: {
    id: 'loungeOpens',
    label: 'Lounge Opens',
    kind: 'text',
    defaultWidth: 180,
    defaultAlign: 'center',
    defaultAnimation: 'none',
    mockHeader: 'L OPEN',
    mockCell: '13:15',
  },
  loungeCloses: {
    id: 'loungeCloses',
    label: 'Lounge Closes',
    kind: 'text',
    defaultWidth: 180,
    defaultAlign: 'center',
    defaultAnimation: 'none',
    mockHeader: 'L CLOSE',
    mockCell: '14:25',
  },
  finalCallTime: {
    id: 'finalCallTime',
    label: 'Final Call',
    kind: 'text',
    defaultWidth: 180,
    defaultAlign: 'center',
    defaultAnimation: 'none',
    mockHeader: 'FINAL',
    mockCell: '14:20',
  },
  carousel: {
    id: 'carousel',
    label: 'Carousel',
    kind: 'text',
    defaultWidth: 160,
    defaultAlign: 'center',
    defaultAnimation: 'none',
    mockHeader: 'BELT',
    mockCell: '7',
  },
  lastBagAt: {
    id: 'lastBagAt',
    label: 'Last Bag',
    kind: 'text',
    defaultWidth: 180,
    defaultAlign: 'center',
    defaultAnimation: 'none',
    mockHeader: 'LAST BAG',
    mockCell: '15:42',
  },
  remarkStatus: {
    id: 'remarkStatus',
    label: 'Remarks',
    kind: 'status',
    defaultWidth: 380,
    defaultAlign: 'left',
    defaultAnimation: 'fade',
    statusSource: 'remarkCode',
    mockHeader: 'REMARKS',
    mockCell: 'BOARDING',
  },
  overallStatus: {
    id: 'overallStatus',
    label: 'Status',
    kind: 'status',
    defaultWidth: 320,
    defaultAlign: 'left',
    defaultAnimation: 'fade',
    statusSource: 'currentStatus',
    mockHeader: 'STATUS',
    mockCell: 'LANDED',
  },
  carouselStatus: {
    id: 'carouselStatus',
    label: 'Belt Status',
    kind: 'status',
    defaultWidth: 320,
    defaultAlign: 'left',
    defaultAnimation: 'fade',
    statusSource: 'carouselRemarks',
    mockHeader: 'BELT STATUS',
    mockCell: 'BAG DELIVERY',
  },
  checkInRow: {
    id: 'checkInRow',
    label: 'Check-in Row',
    kind: 'text',
    defaultWidth: 220,
    defaultAlign: 'center',
    defaultAnimation: 'none',
    mockHeader: 'CHECK-IN',
    mockCell: 'C1–C12',
  },
  checkInOpens: {
    id: 'checkInOpens',
    label: 'Check-in Opens',
    kind: 'text',
    defaultWidth: 160,
    defaultAlign: 'center',
    defaultAnimation: 'none',
    mockHeader: 'OPENS',
    mockCell: '10:30',
  },
  checkInCloses: {
    id: 'checkInCloses',
    label: 'Check-in Closes',
    kind: 'text',
    defaultWidth: 160,
    defaultAlign: 'center',
    defaultAnimation: 'none',
    mockHeader: 'CLOSES',
    mockCell: '13:45',
  },
  checkInStatus: {
    id: 'checkInStatus',
    label: 'Check-in Status',
    kind: 'status',
    defaultWidth: 360,
    defaultAlign: 'left',
    defaultAnimation: 'fade',
    statusSource: 'checkInStatus',
    mockHeader: 'STATUS',
    mockCell: 'COUNTER OPEN',
  },
}

/**
 * Per-template-type allowlist. Drives the column-add menu (tabular
 * templates) and the bind-to-field picker (dedicated templates).
 * Fields not in the list for a given type cannot be bound there.
 */
export const FIELDS_BY_TYPE: Record<TemplateType, readonly FidsField[]> = {
  multiUserDepartures: [
    'flightNo', 'mainFlight', 'codeshares', 'airlineLogo', 'aircraftType', 'destination', 'terminal',
    'scheduled', 'estimated', 'actual', 'gate', 'boardingTime', 'finalCallTime',
    'remarkStatus',
  ],
  multiUserArrivals: [
    'flightNo', 'mainFlight', 'codeshares', 'airlineLogo', 'aircraftType', 'origin', 'terminal',
    'scheduled', 'estimated', 'actual',
    'remarkStatus', 'overallStatus',
  ],
  multiUserBaggage: [
    'flightNo', 'mainFlight', 'codeshares', 'airlineLogo', 'origin', 'terminal',
    'scheduled', 'estimated',
    'carousel', 'lastBagAt',
    'overallStatus', 'carouselStatus',
  ],
  multiUserCheckIn: [
    'flightNo', 'mainFlight', 'codeshares', 'airlineLogo', 'destination', 'terminal',
    'scheduled', 'estimated',
    'checkInRow', 'checkInOpens', 'checkInCloses',
    'checkInStatus',
  ],
  dedicatedGate: [
    'flightNo', 'mainFlight', 'codeshares', 'airlineLogo', 'aircraftType', 'destination', 'terminal',
    'scheduled', 'estimated', 'actual', 'gate',
    'boardingTime', 'finalCallTime',
    'lounge', 'loungeOpens', 'loungeCloses',
    'remarkStatus',
  ],
  dedicatedDoubleGate: [
    'flightNo', 'mainFlight', 'codeshares', 'airlineLogo', 'aircraftType', 'destination', 'terminal',
    'scheduled', 'estimated', 'actual', 'gate',
    'boardingTime', 'finalCallTime',
    'lounge', 'loungeOpens', 'loungeCloses',
    'remarkStatus',
  ],
  dedicatedGateEntry: [
    'flightNo', 'mainFlight', 'codeshares', 'airlineLogo', 'aircraftType', 'destination', 'terminal',
    'scheduled', 'estimated', 'actual', 'gate',
    'boardingTime', 'finalCallTime',
    'lounge', 'loungeOpens', 'loungeCloses',
    'remarkStatus',
  ],
  dedicatedBaggage: [
    'flightNo', 'mainFlight', 'codeshares', 'airlineLogo', 'origin', 'terminal',
    'scheduled', 'estimated', 'actual',
    'carousel', 'lastBagAt',
    'overallStatus', 'carouselStatus',
  ],
  dedicatedCarousel: [
    'flightNo', 'mainFlight', 'codeshares', 'airlineLogo', 'origin', 'terminal',
    'scheduled', 'estimated', 'actual',
    'carousel', 'lastBagAt',
    'overallStatus', 'carouselStatus', 'remarkStatus',
  ],
  // Freeform templates are intentionally unopinionated — every field is
  // bindable so users can compose any layout from scratch.
  dedicatedFreeform: FIDS_FIELDS,
  dedicatedFreeformMulti: FIDS_FIELDS,
  // Signage isn't flight-bound by intent; empty allowlist.
  signageRibbon: [],
  signagePillar: [],
  signageDisplay: [],
}
