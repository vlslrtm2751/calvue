import type { CalRange, CalView } from '../types';
import { useDayjsCal } from './use-dayjs-cal';
import type { Dayjs } from 'dayjs';

function startOfWeekBy(d: Dayjs, firstDay: number): Dayjs {
  const diff = (d.day() - firstDay + 7) % 7;
  return d.subtract(diff, 'day').startOf('day');
}

export function useCalendarGrid(
  view: Ref<CalView>,
  anchor: Ref<Dayjs>,
  firstDay: Ref<number> = ref(0),
  weekends: Ref<boolean> = ref(true)
) {
  useDayjsCal();

  // weekends=false면 토·일을 빼고 평일만 (주뷰 5컬럼, 월뷰 5컬럼/주). 일뷰는 해당 날짜 그대로.
  const isWeekday = (d: Dayjs) => weekends.value || (d.day() !== 0 && d.day() !== 6);

  const days = computed<Dayjs[]>(() => {
    const a = anchor.value;
    const fd = firstDay.value;
    if (view.value === 'week') {
      const start = startOfWeekBy(a, fd);
      return Array.from({ length: 7 }, (_, i) => start.add(i, 'day')).filter(isWeekday);
    }
    if (view.value === 'day') {
      return [a.startOf('day')];
    }
    // month / list — 항상 6주(7×6=42셀) 고정(달마다 높이 불변). 인접 달은 뷰에서 muted
    const gridStart = startOfWeekBy(a.startOf('month'), fd);
    return Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day')).filter(isWeekday);
  });

  const weeks = computed<Dayjs[][]>(() => {
    const out: Dayjs[][] = [];
    const d = days.value;
    const perWeek = weekends.value ? 7 : 5;
    for (let i = 0; i < d.length; i += perWeek) out.push(d.slice(i, i + perWeek));
    return out;
  });

  const range = computed<CalRange>(() => {
    const d = days.value;
    return { start: d[0].startOf('day'), end: d[d.length - 1].add(1, 'day').startOf('day') };
  });

  const title = computed<string>(() => {
    const a = anchor.value;
    if (view.value === 'day') return a.format('YYYY년 M월 D일 (ddd)');
    if (view.value === 'week') {
      const s = startOfWeekBy(a, firstDay.value);
      const e = s.add(6, 'day');
      if (s.year() !== e.year()) {
        return `${s.format('YYYY년 M월 D일')} – ${e.format('YYYY년 M월 D일')}`;
      }
      return s.month() === e.month()
        ? `${s.format('YYYY년 M월 D')}–${e.format('D일')}`
        : `${s.format('YYYY년 M월 D일')} – ${e.format('M월 D일')}`;
    }
    return a.format('YYYY년 M월');
  });

  return { range, days, weeks, title };
}
