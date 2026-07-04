import type { CalEvent, EventOrder } from '../types';
import { defaultEventOrder } from './use-event-order';
import type { Dayjs } from 'dayjs';

export interface DayGridSegment {
  event: CalEvent;
  startCol: number;
  endCol: number;
  lane: number;
}

export interface DayGridRowLayout {
  segments: DayGridSegment[];
  overflowByCol: number[];
  laneCount: number;
}

/** 이벤트가 점유하는 마지막 '일'(포함). end는 배타적이라 1ms 빼서 계산 — 리사이즈 종료-조각 판별 등에 사용 */
export function eventEndDay(e: CalEvent): Dayjs {
  return e.end.subtract(1, 'millisecond').startOf('day');
}

/** Lay out events across a row of day columns: multi-day events become one segment spanning [startCol,endCol]; greedy lane assignment avoids overlap. */
export function layoutDayGridRow(
  days: Dayjs[],
  events: CalEvent[],
  maxLanes: number,
  order: EventOrder = defaultEventOrder
): DayGridRowLayout {
  const n = days.length;
  const first = days[0].startOf('day');
  const last = days[n - 1].startOf('day');

  const segs = events
    .map((event) => {
      const startDay = event.start.startOf('day');
      const endDayIncl = event.end.subtract(1, 'millisecond').startOf('day');
      const segStart = startDay.isBefore(first) ? first : startDay;
      const segEnd = endDayIncl.isAfter(last) ? last : endDayIncl;
      return { event, segStart, segEnd };
    })
    .filter((s) => !s.segStart.isAfter(s.segEnd))
    .map((s) => ({
      event: s.event,
      startCol: s.segStart.diff(first, 'day'),
      endCol: s.segEnd.diff(first, 'day')
    }))
    // `order` sets lane priority; the greedy first-fit below still fills gaps (compaction)
    .sort((a, b) => order(a.event, b.event));

  const lanes: Array<Array<{ startCol: number; endCol: number }>> = [];
  const placed: DayGridSegment[] = [];
  for (const s of segs) {
    let lane = 0;
    for (;;) {
      const occupied = lanes[lane] ?? (lanes[lane] = []);
      const conflict = occupied.some((o) => s.startCol <= o.endCol && s.endCol >= o.startCol);
      if (!conflict) {
        occupied.push({ startCol: s.startCol, endCol: s.endCol });
        placed.push({ event: s.event, startCol: s.startCol, endCol: s.endCol, lane });
        break;
      }
      lane++;
    }
  }

  const overflowByCol = Array.from({ length: n }, () => 0);
  for (const p of placed) {
    if (p.lane >= maxLanes) {
      for (let c = p.startCol; c <= p.endCol; c++) overflowByCol[c] += 1;
    }
  }

  return { segments: placed, overflowByCol, laneCount: lanes.length };
}
