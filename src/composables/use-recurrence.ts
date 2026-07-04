import type { RecurFreq, RecurWeekday, RecurrenceForm } from './types';
import type { Dayjs } from 'dayjs';
import ICAL from 'ical.js';

// Ordered Sun→Sat to match dayjs .day() index
const WD: RecurWeekday[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const DEFAULT_FORM: RecurrenceForm = {
  enabled: false,
  freq: 'WEEKLY',
  interval: 1,
  byday: [],
  end: { type: 'none' }
};

export function useRecurrence() {
  /**
   * Convert a RecurrenceForm to an RFC-5545 RRULE value string.
   * Returns '' when form.enabled is false.
   * Builds the string manually so INTERVAL=1 is always explicit.
   */
  function buildRRule(form: RecurrenceForm): string {
    if (!form.enabled) return '';

    const interval = Math.max(1, form.interval);
    const parts: string[] = [`FREQ=${form.freq}`, `INTERVAL=${interval}`];

    if (form.freq === 'WEEKLY' && form.byday.length > 0) {
      parts.push(`BYDAY=${form.byday.join(',')}`);
    }

    if (form.end.type === 'count' && form.end.count != null && form.end.count > 0) {
      parts.push(`COUNT=${form.end.count}`);
    } else if (form.end.type === 'until' && form.end.until != null) {
      const d = form.end.until;
      const icalTime = ICAL.Time.fromData({
        year: d.year(),
        month: d.month() + 1, // dayjs months are 0-indexed; ICAL months are 1-indexed
        day: d.date(),
        isDate: true
      });
      parts.push(`UNTIL=${icalTime.toICALString()}`);
    }

    return parts.join(';');
  }

  /**
   * Parse an RFC-5545 RRULE value string back into a RecurrenceForm.
   * Returns a disabled default form for empty / invalid input.
   */
  function parseRRule(rrule: string): RecurrenceForm {
    if (!rrule || !rrule.trim()) return { ...DEFAULT_FORM };

    try {
      const r = ICAL.Recur.fromString(rrule);

      const form: RecurrenceForm = {
        enabled: true,
        freq: (r.freq as RecurFreq) ?? 'WEEKLY',
        interval: r.interval ?? 1,
        byday: [],
        end: { type: 'none' }
      };

      // BYDAY lives in r.parts.BYDAY after parsing (uppercase key)
      const rawByday = r.parts?.BYDAY as string[] | string | undefined;
      if (rawByday != null) {
        const bydayArr = Array.isArray(rawByday) ? rawByday : [rawByday];
        form.byday = bydayArr.filter((d): d is RecurWeekday => (WD as string[]).includes(d));
      }

      if (r.count != null) {
        form.end = { type: 'count', count: r.count };
      } else if (r.until != null) {
        form.end = { type: 'until', until: dayjs(r.until.toJSDate()) };
      }

      return form;
    } catch {
      return { ...DEFAULT_FORM };
    }
  }

  /**
   * Produce a Korean human-readable summary of a RecurrenceForm.
   * Examples: '반복 안 함' / '매일' / '매주 월·수요일' / '2주마다' / '매월' / '매년'
   */
  function describe(form: RecurrenceForm): string {
    if (!form.enabled) return '반복 안 함';

    const unitMap: Record<RecurFreq, string> = {
      DAILY: '일',
      WEEKLY: '주',
      MONTHLY: '개월',
      YEARLY: '년'
    };
    const unit = unitMap[form.freq];
    const every = form.interval > 1 ? `${form.interval}${unit}마다` : `매${unit}`;

    if (form.freq === 'WEEKLY' && form.byday.length > 0) {
      const dayNames = '일월화수목금토';
      const days = form.byday.map((d) => dayNames[WD.indexOf(d)]).join('·');
      return `${every} ${days}요일`;
    }

    return every;
  }

  /**
   * Map a preset key to a RecurrenceForm anchored to the given date.
   * Presets: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'weekday' | 'custom'
   */
  function presetToForm(preset: string, anchor: Dayjs): RecurrenceForm {
    const base: RecurrenceForm = {
      enabled: true,
      freq: 'WEEKLY',
      interval: 1,
      byday: [],
      end: { type: 'none' }
    };

    switch (preset) {
      case 'none':
        return { ...base, enabled: false };
      case 'daily':
        return { ...base, freq: 'DAILY' };
      case 'weekly':
        return { ...base, freq: 'WEEKLY', byday: [WD[anchor.day()]] };
      case 'monthly':
        return { ...base, freq: 'MONTHLY' };
      case 'yearly':
        return { ...base, freq: 'YEARLY' };
      case 'weekday':
        return { ...base, freq: 'WEEKLY', byday: ['MO', 'TU', 'WE', 'TH', 'FR'] };
      default:
        // 'custom' or unknown: return base (weekly, no byday, no end)
        return base;
    }
  }

  return { buildRRule, parseRRule, describe, presetToForm };
}
