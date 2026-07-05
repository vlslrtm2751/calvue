import type { Dayjs } from 'dayjs';
import type { CalEvent, CalMessages } from '../types';

// ─── ko helpers (현 format.ts / use-calendar-grid.ts 로직 그대로) ──────────────
const KO_WD = ['일', '월', '화', '수', '목', '금', '토'];

function koEventTime(d: Dayjs): string {
  const h = d.hour();
  const m = d.minute();
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${ampm} ${h12}시` : `${ampm} ${h12}:${String(m).padStart(2, '0')}`;
}

function koDayLabel(ev: CalEvent, day: Dayjs): string {
  if (ev.allDay) return '종일';
  const d = day.startOf('day');
  const startsHere = ev.start.startOf('day').isSame(d);
  const endsHere = ev.end.subtract(1, 'millisecond').startOf('day').isSame(d);
  if (startsHere && endsHere) return `${ev.start.format('HH:mm')}–${ev.end.format('HH:mm')}`;
  if (startsHere) return koEventTime(ev.start);
  if (endsHere) return `${koEventTime(ev.end)} 종료`;
  return '종일';
}

function koGridTimeLabel(ev: CalEvent, day: Dayjs): string {
  if (ev.allDay) return '종일';
  const d = day.startOf('day');
  const startsHere = ev.start.startOf('day').isSame(d);
  const endsHere = ev.end.subtract(1, 'millisecond').startOf('day').isSame(d);
  if (startsHere && endsHere) return `${ev.start.format('HH:mm')}–${ev.end.format('HH:mm')}`;
  if (startsHere) return `${ev.start.format('HH:mm')}~`;
  if (endsHere) return `~${ev.end.format('HH:mm')}`;
  return '종일';
}

function koWeekTitle(s: Dayjs, e: Dayjs): string {
  if (s.year() !== e.year()) return `${s.format('YYYY년 M월 D일')} – ${e.format('YYYY년 M월 D일')}`;
  return s.month() === e.month()
    ? `${s.format('YYYY년 M월 D')}–${e.format('D일')}`
    : `${s.format('YYYY년 M월 D일')} – ${e.format('M월 D일')}`;
}

export const ko: CalMessages = {
  today: '오늘',
  prev: '이전',
  next: '다음',
  viewDay: '일',
  viewWeek: '주',
  viewMonth: '월',
  viewList: '목록',
  allDay: '종일',
  creator: '작성자',
  start: '시작',
  end: '종료',
  close: '닫기',
  resizeHint: '기간 조절',
  noEvents: '이 기간에 일정이 없습니다.',
  todaySuffix: '오늘',
  more: (n) => `+${n} 더보기`,
  overlapCount: (n) => `겹친 일정 ${n}건`,
  weekdaysShort: KO_WD,
  monthTitle: (d) => d.format('YYYY년 M월'),
  dayTitle: (d) => `${d.format('YYYY년 M월 D일')} (${KO_WD[d.day()]})`,
  weekTitle: koWeekTitle,
  eventTime: koEventTime,
  dayLabel: koDayLabel,
  gridTimeLabel: koGridTimeLabel,
  popoverDate: (d) => `${d.format('M월 D일')} (${KO_WD[d.day()]})`,
  listMonthHeader: (d) => d.format('YYYY년 M월')
};

// ─── en helpers ───────────────────────────────────────────────────────────────
const EN_WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EN_MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EN_MON_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function enEventTime(d: Dayjs): string {
  const h = d.hour();
  const m = d.minute();
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function enDayLabel(ev: CalEvent, day: Dayjs): string {
  if (ev.allDay) return 'All day';
  const d = day.startOf('day');
  const startsHere = ev.start.startOf('day').isSame(d);
  const endsHere = ev.end.subtract(1, 'millisecond').startOf('day').isSame(d);
  if (startsHere && endsHere) return `${ev.start.format('HH:mm')}–${ev.end.format('HH:mm')}`;
  if (startsHere) return enEventTime(ev.start);
  if (endsHere) return `${enEventTime(ev.end)} ends`;
  return 'All day';
}

function enGridTimeLabel(ev: CalEvent, day: Dayjs): string {
  if (ev.allDay) return 'All day';
  const d = day.startOf('day');
  const startsHere = ev.start.startOf('day').isSame(d);
  const endsHere = ev.end.subtract(1, 'millisecond').startOf('day').isSame(d);
  if (startsHere && endsHere) return `${ev.start.format('HH:mm')}–${ev.end.format('HH:mm')}`;
  if (startsHere) return `${ev.start.format('HH:mm')}~`;
  if (endsHere) return `~${ev.end.format('HH:mm')}`;
  return 'All day';
}

function enWeekTitle(s: Dayjs, e: Dayjs): string {
  if (s.year() !== e.year()) {
    return `${EN_MON_SHORT[s.month()]} ${s.date()}, ${s.year()} – ${EN_MON_SHORT[e.month()]} ${e.date()}, ${e.year()}`;
  }
  return s.month() === e.month()
    ? `${EN_MON_SHORT[s.month()]} ${s.date()}–${e.date()}, ${s.year()}`
    : `${EN_MON_SHORT[s.month()]} ${s.date()} – ${EN_MON_SHORT[e.month()]} ${e.date()}, ${s.year()}`;
}

export const en: CalMessages = {
  today: 'Today',
  prev: 'Previous',
  next: 'Next',
  viewDay: 'Day',
  viewWeek: 'Week',
  viewMonth: 'Month',
  viewList: 'List',
  allDay: 'All day',
  creator: 'Creator',
  start: 'Start',
  end: 'End',
  close: 'Close',
  resizeHint: 'Resize',
  noEvents: 'No events in this period.',
  todaySuffix: 'Today',
  more: (n) => `+${n} more`,
  overlapCount: (n) => `${n} overlapping`,
  weekdaysShort: EN_WD,
  monthTitle: (d) => `${EN_MON_FULL[d.month()]} ${d.year()}`,
  dayTitle: (d) => `${EN_WD[d.day()]}, ${EN_MON_SHORT[d.month()]} ${d.date()}, ${d.year()}`,
  weekTitle: enWeekTitle,
  eventTime: enEventTime,
  dayLabel: enDayLabel,
  gridTimeLabel: enGridTimeLabel,
  popoverDate: (d) => `${EN_MON_SHORT[d.month()]} ${d.date()} (${EN_WD[d.day()]})`,
  listMonthHeader: (d) => `${EN_MON_FULL[d.month()]} ${d.year()}`
};

// ─── resolver ─────────────────────────────────────────────────────────────────
const BUILTINS: Record<string, CalMessages> = { ko, en };

/** locale로 내장 카탈로그 선택(미지원 → ko) 후 overrides를 키 단위 얕은 병합. */
export function resolveMessages(locale: string, overrides?: Partial<CalMessages>): CalMessages {
  const base = Object.prototype.hasOwnProperty.call(BUILTINS, locale) ? BUILTINS[locale] : ko;
  return overrides ? { ...base, ...overrides } : base;
}
