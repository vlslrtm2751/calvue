import type { CalEvent, CalEventInput } from './types';

export function normalizeEvent(input: CalEventInput, index = 0): CalEvent {
  const start = dayjs(input.start as never);
  const allDay = input.allDay ?? false;
  const end = input.end ? dayjs(input.end as never) : allDay ? start.add(1, 'day') : start.add(1, 'hour');
  return {
    key: `${input.source ?? 'cal'}:${input.id}:${index}`,
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
