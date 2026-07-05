import type { CalEvent } from '../types';
import type { Dayjs } from 'dayjs';

export interface TimeBox {
  event: CalEvent;
  topPct: number;
  heightPct: number;
  leftPct: number;
  widthPct: number;
  zIndex?: number; // cascade(overlap) stacking — later column on top; undefined in side-by-side
}

/** timed events occupy this % of the day column; the rest is a click/drag strip on the right */
const COLUMN_USABLE_PCT = 98;

export function layoutDay(events: CalEvent[], dayStart: Dayjs, overlap = true): TimeBox[] {
  const timed = events
    .filter((e) => !e.allDay)
    .map((e) => {
      const s = Math.max(0, e.start.diff(dayStart, 'minute'));
      const en = Math.min(1440, e.end.diff(dayStart, 'minute'));
      return { event: e, s, e: Math.max(en, s + 15) };
    })
    .sort((a, b) => a.s - b.s || b.e - a.e);

  const out: TimeBox[] = [];
  let cluster: typeof timed = [];
  let clusterEnd = -1;

  const flush = () => {
    // 컬럼 그리디 배정
    const cols: number[] = []; // 각 컬럼의 현재 끝 시간
    const placed = cluster.map((it) => {
      let col = cols.findIndex((end) => end <= it.s);
      if (col === -1) {
        col = cols.length;
        cols.push(it.e);
      } else {
        cols[col] = it.e;
      }
      return { it, col };
    });
    const n = cols.length;
    const cascade = overlap && n > 1;
    // cascade(overlap) = FullCalendar slotEventOverlap: each box offset right by half its width so a
    // later event obscures at most the right half of the one before — every title (top-left) stays
    // visible and the last box reaches the right edge. side-by-side(!overlap): equal 1/n columns.
    const cascadeW = cascade ? (COLUMN_USABLE_PCT * 2) / (n + 1) : 0;
    for (const { it, col } of placed) {
      const box: TimeBox = {
        event: it.event,
        topPct: (it.s / 1440) * 100,
        heightPct: ((it.e - it.s) / 1440) * 100,
        leftPct: cascade ? (col * cascadeW) / 2 : (col / n) * COLUMN_USABLE_PCT,
        widthPct: cascade ? cascadeW : (1 / n) * COLUMN_USABLE_PCT
      };
      if (cascade) box.zIndex = col + 1;
      out.push(box);
    }
    cluster = [];
  };

  for (const it of timed) {
    if (cluster.length && it.s >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  if (cluster.length) flush();
  return out;
}
