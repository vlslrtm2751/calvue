import type { CalEvent, EventOrder } from '../types';
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

/** 세로로 그리는 시간대(자정 기준 분). slotMinTime~slotMaxTime에 대응하며 기본은 하루 전체 */
export interface TimeWindow {
  start: number;
  end: number;
}

export const FULL_DAY_WINDOW: TimeWindow = { start: 0, end: 1440 };

export function layoutDay(
  events: CalEvent[],
  dayStart: Dayjs,
  overlap = true,
  win: TimeWindow = FULL_DAY_WINDOW,
  order?: EventOrder
): TimeBox[] {
  const span = Math.max(1, win.end - win.start);
  const timed = events
    .filter((e) => !e.allDay)
    .map((e) => ({ event: e, from: e.start.diff(dayStart, 'minute'), to: e.end.diff(dayStart, 'minute') }))
    // 창 밖의 일정은 그리지 않는다 — 클램프만 하면 경계에 납작한 상자가 남는다
    .filter((b) => b.to > win.start && b.from < win.end)
    .map((b) => {
      const s = Math.max(win.start, b.from);
      const en = Math.min(win.end, b.to);
      return { event: b.event, s, e: Math.max(en, s + 15) };
    })
    // 시작·끝이 같으면 컬럼 배정 순서가 조회 순서에 좌우된다 — order가 있으면 그걸로 가른다
    .sort((a, b) => a.s - b.s || b.e - a.e || (order ? order(a.event, b.event) : 0));

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
        topPct: ((it.s - win.start) / span) * 100,
        heightPct: ((it.e - it.s) / span) * 100,
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
