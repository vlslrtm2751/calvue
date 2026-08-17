import type { Dayjs } from 'dayjs';
import type { CalMessages, TimeFormat } from '../types';

type Clock = (hour: number, minute: number) => string;

/** 24시간 시계 — 로케일 무관 */
const clock24: Clock = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** 한국어 12시간 시계. 정각은 '오전 9시', 그 외는 '오전 9:30' */
const koClock12: Clock = (h, m) => {
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${ampm} ${h12}시` : `${ampm} ${h12}:${String(m).padStart(2, '0')}`;
};

/** 영어 12시간 시계. 정각은 '9 AM', 그 외는 '9:30 AM' */
const enClock12: Clock = (h, m) => {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

/**
 * timeFormat에 따라 두 시계를 고른다.
 * - event: 월 뷰 이벤트 시각·드래그 고스트 (eventTime 키)
 * - grid:  주/일 눈금·이벤트 바·목록 뷰·툴팁 (나머지 4개 키)
 * 'auto'가 둘을 다르게 고르는 게 "월 12시간 / 주·일·목록 24시간" 규칙의 전부다.
 */
function pickClocks(tf: TimeFormat, clock12: Clock): { event: Clock; grid: Clock } {
  if (tf === '12h') return { event: clock12, grid: clock12 };
  if (tf === '24h') return { event: clock24, grid: clock24 };
  if (tf === 'auto') return { event: clock12, grid: clock24 };
  // Exhaustiveness check: if TimeFormat ever grows a fourth member, tf's narrowed type here
  // stops being `never` and this line fails to compile instead of silently falling through.
  const _exhaustive: never = tf;
  return _exhaustive;
}

// ─── ko helpers (현 format.ts / use-calendar-grid.ts 로직 그대로) ──────────────
const KO_WD = ['일', '월', '화', '수', '목', '금', '토'];

type TimeKeys = Pick<CalMessages, 'clockTime' | 'eventTime' | 'dayLabel' | 'gridTimeLabel' | 'tooltipDateTime'>;

function koTimeKeys(tf: TimeFormat): TimeKeys {
  const { event, grid } = pickClocks(tf, koClock12);
  const at = (d: Dayjs) => grid(d.hour(), d.minute());
  return {
    clockTime: grid,
    eventTime: (d) => event(d.hour(), d.minute()),
    dayLabel: (ev, day) => {
      if (ev.allDay) return '종일';
      const d = day.startOf('day');
      const startsHere = ev.start.startOf('day').isSame(d);
      const endsHere = ev.end.subtract(1, 'millisecond').startOf('day').isSame(d);
      if (startsHere && endsHere) return `${at(ev.start)}–${at(ev.end)}`;
      if (startsHere) return at(ev.start);
      if (endsHere) return `${at(ev.end)} 종료`;
      return '종일';
    },
    gridTimeLabel: (ev, day) => {
      if (ev.allDay) return '종일';
      const d = day.startOf('day');
      const startsHere = ev.start.startOf('day').isSame(d);
      const endsHere = ev.end.subtract(1, 'millisecond').startOf('day').isSame(d);
      if (startsHere && endsHere) return `${at(ev.start)}–${at(ev.end)}`;
      if (startsHere) return `${at(ev.start)}~`;
      if (endsHere) return `~${at(ev.end)}`;
      return '종일';
    },
    // 날짜부는 두 로케일 모두 ISO를 유지한다 — 이번 phase는 '시각' 표기가 대상이고,
    // ISO 날짜는 로케일 중립이라 바꿀 이유가 없다. 시각부만 시계를 따른다.
    tooltipDateTime: (d) => `${d.format('YYYY-MM-DD')} ${at(d)}`
  };
}

function koWeekTitle(s: Dayjs, e: Dayjs): string {
  if (s.year() !== e.year()) return `${s.format('YYYY년 M월 D일')} – ${e.format('YYYY년 M월 D일')}`;
  return s.month() === e.month()
    ? `${s.format('YYYY년 M월 D')}–${e.format('D일')}`
    : `${s.format('YYYY년 M월 D일')} – ${e.format('M월 D일')}`;
}

const koStatic = {
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
  noEventsOnDay: '일정 없음',
  todaySuffix: '오늘',
  more: (n: number) => `+${n} 더보기`,
  overlapCount: (n: number) => `겹친 일정 ${n}건`,
  weekdaysShort: KO_WD,
  monthTitle: (d: Dayjs) => d.format('YYYY년 M월'),
  dayTitle: (d: Dayjs) => `${d.format('YYYY년 M월 D일')} (${KO_WD[d.day()]})`,
  weekTitle: koWeekTitle,
  popoverDate: (d: Dayjs) => `${d.format('M월 D일')} (${KO_WD[d.day()]})`,
  listMonthHeader: (d: Dayjs) => d.format('YYYY년 M월')
};

// ─── en helpers ───────────────────────────────────────────────────────────────
const EN_WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EN_MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EN_MON_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function enTimeKeys(tf: TimeFormat): TimeKeys {
  const { event, grid } = pickClocks(tf, enClock12);
  const at = (d: Dayjs) => grid(d.hour(), d.minute());
  return {
    clockTime: grid,
    eventTime: (d) => event(d.hour(), d.minute()),
    dayLabel: (ev, day) => {
      if (ev.allDay) return 'All day';
      const d = day.startOf('day');
      const startsHere = ev.start.startOf('day').isSame(d);
      const endsHere = ev.end.subtract(1, 'millisecond').startOf('day').isSame(d);
      if (startsHere && endsHere) return `${at(ev.start)}–${at(ev.end)}`;
      if (startsHere) return at(ev.start);
      if (endsHere) return `${at(ev.end)} ends`;
      return 'All day';
    },
    gridTimeLabel: (ev, day) => {
      if (ev.allDay) return 'All day';
      const d = day.startOf('day');
      const startsHere = ev.start.startOf('day').isSame(d);
      const endsHere = ev.end.subtract(1, 'millisecond').startOf('day').isSame(d);
      if (startsHere && endsHere) return `${at(ev.start)}–${at(ev.end)}`;
      if (startsHere) return `${at(ev.start)}~`;
      if (endsHere) return `~${at(ev.end)}`;
      return 'All day';
    },
    tooltipDateTime: (d) => `${d.format('YYYY-MM-DD')} ${at(d)}`
  };
}

function enWeekTitle(s: Dayjs, e: Dayjs): string {
  if (s.year() !== e.year()) {
    return `${EN_MON_SHORT[s.month()]} ${s.date()}, ${s.year()} – ${EN_MON_SHORT[e.month()]} ${e.date()}, ${e.year()}`;
  }
  return s.month() === e.month()
    ? `${EN_MON_SHORT[s.month()]} ${s.date()}–${e.date()}, ${s.year()}`
    : `${EN_MON_SHORT[s.month()]} ${s.date()} – ${EN_MON_SHORT[e.month()]} ${e.date()}, ${s.year()}`;
}

const enStatic = {
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
  noEventsOnDay: 'No events',
  todaySuffix: 'Today',
  more: (n: number) => `+${n} more`,
  overlapCount: (n: number) => `${n} overlapping`,
  weekdaysShort: EN_WD,
  monthTitle: (d: Dayjs) => `${EN_MON_FULL[d.month()]} ${d.year()}`,
  dayTitle: (d: Dayjs) => `${EN_WD[d.day()]}, ${EN_MON_SHORT[d.month()]} ${d.date()}, ${d.year()}`,
  weekTitle: enWeekTitle,
  popoverDate: (d: Dayjs) => `${EN_MON_SHORT[d.month()]} ${d.date()} (${EN_WD[d.day()]})`,
  listMonthHeader: (d: Dayjs) => `${EN_MON_FULL[d.month()]} ${d.year()}`
};

// ─── resolver ─────────────────────────────────────────────────────────────────
const BUILTINS: Record<string, (tf: TimeFormat) => CalMessages> = {
  ko: (tf) => ({ ...koStatic, ...koTimeKeys(tf) }),
  en: (tf) => ({ ...enStatic, ...enTimeKeys(tf) })
};

/** 'auto' 변형. 기존 export 호환을 위해 유지한다.
    ko는 지우면 안 된다 — use-cal-i18n.ts가 provider 없는 단독 사용 폴백으로 쓴다. */
export const ko: CalMessages = BUILTINS.ko('auto');
export const en: CalMessages = BUILTINS.en('auto');

/**
 * locale로 내장 카탈로그 선택(미지원 → ko) → timeFormat으로 시계 변형 선택 →
 * overrides를 키 단위 얕은 병합.
 * overrides가 **마지막**이라 소비자가 messages로 넘긴 포맷터는 timeFormat을 이긴다.
 */
export function resolveMessages(
  locale: string,
  overrides?: Partial<CalMessages>,
  timeFormat: TimeFormat = 'auto'
): CalMessages {
  const build = Object.prototype.hasOwnProperty.call(BUILTINS, locale) ? BUILTINS[locale] : BUILTINS.ko;
  const base = build(timeFormat);
  return overrides ? { ...base, ...overrides } : base;
}
