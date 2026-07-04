import type { CalEvent } from './types';
import type { Dayjs } from 'dayjs';

/** 이벤트 시작 시각 표기: 12시간제 "오전 9시" / "오후 1:30" (정각은 'h시'). 종일 일정엔 쓰지 않음 */
export function fmtEventTime(d: Dayjs): string {
  const h = d.hour();
  const m = d.minute();
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${ampm} ${h12}시` : `${ampm} ${h12}:${String(m).padStart(2, '0')}`;
}

/**
 * 특정 날짜(day)에서 이벤트가 보일 시각 라벨. 멀티데이 일정은 날짜별로 다르게 읽힘:
 * 시작일 → 시작 시각, 중간일 → 종일, 종료일 → "<종료 시각> 종료". 종일·당일 일정은 그대로.
 */
export function dayLabel(ev: CalEvent, day: Dayjs): string {
  if (ev.allDay) return '종일';
  const d = day.startOf('day');
  const startsHere = ev.start.startOf('day').isSame(d);
  const endsHere = ev.end.subtract(1, 'millisecond').startOf('day').isSame(d);
  if (startsHere && endsHere) return `${ev.start.format('HH:mm')}–${ev.end.format('HH:mm')}`;
  if (startsHere) return fmtEventTime(ev.start);
  if (endsHere) return `${fmtEventTime(ev.end)} 종료`;
  return '종일'; // 멀티데이 중간일
}

/**
 * 시간그리드(주/일)의 per-day 시각 라벨 — 24시간제(그리드 축과 일치). 멀티데이는 날짜별로:
 * 시작일 "HH:mm~", 중간일 "종일", 종료일 "~HH:mm". 당일 일정은 "HH:mm–HH:mm".
 */
export function gridTimeLabel(ev: CalEvent, day: Dayjs): string {
  if (ev.allDay) return '종일';
  const d = day.startOf('day');
  const startsHere = ev.start.startOf('day').isSame(d);
  const endsHere = ev.end.subtract(1, 'millisecond').startOf('day').isSame(d);
  if (startsHere && endsHere) return `${ev.start.format('HH:mm')}–${ev.end.format('HH:mm')}`;
  if (startsHere) return `${ev.start.format('HH:mm')}~`;
  if (endsHere) return `~${ev.end.format('HH:mm')}`;
  return '종일'; // 멀티데이 중간일
}
