import type { CalEvent, EventOrder } from '../types';

/** event spans more than one calendar day */
function isMultiDay(e: CalEvent): boolean {
  return e.end.subtract(1, 'millisecond').startOf('day').isAfter(e.start.startOf('day'));
}

/**
 * Default within-day event order:
 *  1) earliest start DAY first — an event carried over from a previous day leads on each day it spans
 *     (so a multi-day event keeps the top lane across its whole span).
 *  2) within the same start day: all-day first, then timed multi-day, then same-day timed.
 *  3) ties resolved by start time (all-day ties by longest first).
 *
 * The greedy first-fit packing in layoutDayGridRow then fills the gaps a carried-over event leaves.
 */
export const defaultEventOrder: EventOrder = (a, b) => {
  const sd = a.start.startOf('day').valueOf() - b.start.startOf('day').valueOf();
  if (sd !== 0) return sd;

  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;

  if (a.allDay && b.allDay) {
    const dur = b.end.valueOf() - b.start.valueOf() - (a.end.valueOf() - a.start.valueOf());
    if (dur !== 0) return dur; // longer first
    return a.start.valueOf() - b.start.valueOf();
  }

  // same-day timed: multi-day before single-day, then earliest start time
  const ma = isMultiDay(a) ? 0 : 1;
  const mb = isMultiDay(b) ? 0 : 1;
  if (ma !== mb) return ma - mb;
  return a.start.valueOf() - b.start.valueOf();
};
