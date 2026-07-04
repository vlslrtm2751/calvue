import isBetween from 'dayjs/plugin/isBetween';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekday from 'dayjs/plugin/weekday';

let extended = false;

/** 캘린더에서 쓰는 dayjs 플러그인을 1회 등록한다. 각 컴포저블/컴포넌트 setup 최상단에서 호출. */
export function useDayjsCal(): void {
  if (extended) return;
  dayjs.extend(weekday);
  dayjs.extend(isoWeek);
  dayjs.extend(isBetween);
  dayjs.extend(isSameOrAfter);
  dayjs.extend(isSameOrBefore);
  extended = true;
}
