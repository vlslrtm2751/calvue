// ─── Types ────────────────────────────────────────────────────────────────────

/** The four supported calendar view modes. */
export type CalView = 'month' | 'week' | 'day' | 'list'

/** An inclusive date-range expressed as ISO-8601 strings. */
export interface CalRange {
  start: string
  end: string
}

/** Raw event shape accepted by the `:events` prop. */
export interface CalEventInput {
  id: string | number
  title: string
  /** ISO-8601 date/datetime string */
  start: string
  /** ISO-8601 date/datetime string (defaults to `start` when omitted) */
  end?: string
  allDay?: boolean
  color?: string
  /** Arbitrary user data passed through unchanged */
  data?: unknown
}

/** Normalised event used internally and emitted in event callbacks. */
export interface CalEvent extends Required<Omit<CalEventInput, 'data'>> {
  data?: unknown
}

/** Theming and behaviour options for CalCalendar. */
export interface CalOptions {
  /** Accent colour applied via the `--cal-primary` CSS custom property. @default '#1976d2' */
  primaryColor: string
  /** First day of the week (0 = Sunday, 1 = Monday). @default 0 */
  firstDayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
  /** Whether events can be dragged to a new date/time. @default false */
  draggable: boolean
  /** Whether events can be resized. @default false */
  resizable: boolean
  /** Locale string forwarded to Day.js (e.g. 'en', 'ko'). @default 'en' */
  locale: string
}

/** Options accepted by CalMiniMonth. */
export interface CalMiniOptions {
  /** Accent colour applied via `--cal-primary`. @default '#1976d2' */
  primaryColor: string
  /** First day of the week. @default 0 */
  firstDayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
  /** Locale string forwarded to Day.js. @default 'en' */
  locale: string
}

// ─── Components ───────────────────────────────────────────────────────────────

export { default as CalCalendar } from './components/CalCalendar.vue'
export { default as CalMiniMonth } from './components/CalMiniMonth.vue'
