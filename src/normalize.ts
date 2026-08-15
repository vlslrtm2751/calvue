import type { CalEvent, CalEventInput } from './types';

export function normalizeEvent(input: CalEventInput): CalEvent {
  const start = dayjs(input.start as never);
  const allDay = input.allDay ?? false;
  const end = input.end ? dayjs(input.end as never) : allDay ? start.add(1, 'day') : start.add(1, 'hour');
  return {
    // 시작 시각으로 반복 인스턴스까지 구분된다. 배열 위치를 쓰면 앞쪽 소스(공휴일 등)의 개수가 달라질
    // 때마다 뒤쪽 일정의 key가 통째로 밀려 멀쩡한 DOM 노드가 파괴·재생성된다
    // (호버 중이던 바의 mouseleave가 안 불려 툴팁이 화면에 남는 원인).
    key: `${input.source ?? 'cal'}:${input.id}:${start.valueOf()}`,
    rawId: input.id,
    calendarId: input.calendarId ?? '',
    source: input.source ?? 'cal',
    title: input.title,
    start,
    end,
    allDay,
    color: (input.color ?? '#409eff').slice(0, 7),
    editable: input.editable ?? false,
    interactive: input.interactive,
    extendedProps: input.extendedProps
  };
}
