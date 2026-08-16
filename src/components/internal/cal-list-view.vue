<template>
  <div class="list" ref="listEl">
    <template v-for="group in groupedByDay" :key="group.dateKey">
      <div class="list-month" v-if="group.monthLabel">{{ group.monthLabel }}</div>
      <div
        class="list-day"
        :class="{ 'list-day--focus': isFocusRow(group) }"
        :data-cal-date="group.dateKey">
        <div class="list-date" :class="{ 'list-date--today': group.isToday }">
          <span class="big">{{ group.dayNum }}</span>
          {{ group.weekday }}<template v-if="group.isToday"> · {{ m.todaySuffix }}</template>
        </div>
        <div class="list-evts">
          <div class="list-evt list-evt--empty" v-if="group.events.length === 0">{{ m.noEventsOnDay }}</div>
          <div
            class="list-evt"
            v-for="ev in group.events"
            :class="{ 'list-evt--static': ev.interactive === false }"
            :key="ev.key"
            @click="ev.interactive !== false && emit('eventClick', ev)">
            <span class="dot" :style="{ background: ev.color }"></span>
            <span class="time">{{ m.dayLabel(ev, group.day) }}</span>
            <span class="title">{{ ev.title }}</span>
          </div>
        </div>
      </div>
    </template>
    <div class="list-empty" v-if="groupedByDay.length === 0">{{ m.noEvents }}</div>
  </div>
</template>

<script lang="ts" setup>
  import type { CalEvent, CalRange, EventOrder } from '../../types';
  import type { Dayjs } from 'dayjs';
  import { defaultEventOrder } from '../../composables/use-event-order';
  import { useCalI18n } from '../../composables/use-cal-i18n';
  import { useCalTodayFocus } from '../../composables/use-cal-today-focus';

  const props = defineProps<{
    events: CalEvent[];
    range: CalRange;
    today: Dayjs;
    eventOrder?: EventOrder;
    todayFocused?: boolean;
    focusSeq?: number;
  }>();
  const emit = defineEmits<{ eventClick: [CalEvent] }>();
  const m = useCalI18n();

  interface DayGroup {
    day: Dayjs;
    dateKey: string;
    dayNum: number;
    weekday: string;
    isToday: boolean;
    monthLabel: string; // non-empty on the first group of each month → section header
    events: CalEvent[];
  }

  const groupedByDay = computed<DayGroup[]>(() => {
    const { start, end } = props.range;
    const today = props.today.startOf('day');
    const groups: DayGroup[] = [];

    let cursor = start.startOf('day');
    let prevYm = '';
    while (cursor.isBefore(end)) {
      const dayStart = cursor;
      const dayEnd = cursor.add(1, 'day');
      const isToday = cursor.isSame(today, 'day');

      const dayEvents = props.events
        .filter((ev) => ev.start.isBefore(dayEnd) && ev.end.isAfter(dayStart))
        .sort(props.eventOrder ?? defaultEventOrder);

      // 오늘은 일정이 없어도 행을 남긴다 — '오늘' 버튼의 강조·스크롤 대상이 필요하다
      if (dayEvents.length > 0 || isToday) {
        const ym = cursor.format('YYYY-MM');
        groups.push({
          day: dayStart,
          dateKey: cursor.format('YYYY-MM-DD'),
          dayNum: cursor.date(),
          weekday: m.value.weekdaysShort[cursor.day()],
          isToday,
          monthLabel: ym !== prevYm ? m.value.listMonthHeader(cursor) : '',
          events: dayEvents
        });
        prevYm = ym;
      }

      cursor = cursor.add(1, 'day');
    }

    return groups;
  });

  const listEl = ref<HTMLElement | null>(null);

  function isFocusRow(group: DayGroup): boolean {
    return !!props.todayFocused && group.isToday;
  }

  /** 오늘 행을 스크롤 컨테이너 맨 위로 — sticky 월 헤더에 가리지 않게 그 높이만큼 뺀다 */
  function scrollToToday(behavior: ScrollBehavior): void {
    const host = listEl.value;
    if (!host) return;
    const key = props.today.format('YYYY-MM-DD');
    const row = host.querySelector<HTMLElement>(`[data-cal-date="${key}"]`);
    if (!row) return; // 오늘이 현재 표시 범위 밖
    const stickyH = host.querySelector<HTMLElement>('.list-month')?.offsetHeight ?? 0;
    // offsetTop이 아니라 rect 차이를 쓰는 이유: .list가 position:relative가 아니라 offsetParent가 어긋난다
    const delta = row.getBoundingClientRect().top - host.getBoundingClientRect().top;
    host.scrollTo({ top: host.scrollTop + delta - stickyH, behavior });
  }

  useCalTodayFocus(toRef(props, 'focusSeq'), scrollToToday);
</script>

<style scoped>
  .list {
    height: 100%;
    overflow-y: auto;
    /* no padding-top: a sticky child with top:0 would otherwise stick below it,
       leaving a gap where scrolled content peeks through above the month header */
    padding: 0 16px 8px;
    background: #fff;
    color: var(--cal-ink);
  }
  .list-day {
    position: relative; /* 포커스 오버레이(::after)의 기준 */
    display: grid;
    /* minmax(0, 1fr): auto 최소값(=제목 폭)이 남으면 트랙이 제목 길이만큼 늘어나 가로 스크롤이 생긴다 */
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--cal-line-soft);
  }
  .list-day::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: var(--cal-today-focus-bg, color-mix(in srgb, var(--cal-primary) 18%, transparent));
    opacity: 0;
    transition: opacity 500ms ease;
  }
  .list-day--focus::after {
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .list-day::after {
      transition: none;
    }
  }
  .list-evt--empty {
    color: var(--cal-muted);
    font-size: 13px;
    cursor: default;
  }
  .list-evts {
    min-width: 0;
  }
  /* month section header — sticks to the top while scrolling the agenda */
  .list-month {
    position: sticky;
    top: 0;
    background: #fff;
    font-size: 13px;
    font-weight: 700;
    color: var(--cal-ink);
    padding: 10px 0 6px;
    border-bottom: 2px solid var(--cal-line);
    z-index: 1;
  }
  .list-date {
    font-size: 13px;
    color: var(--cal-muted);
  }
  .list-date .big {
    font-size: 20px;
    font-weight: 700;
    color: var(--cal-ink);
    display: block;
  }
  .list-date--today .big {
    color: var(--cal-primary);
  }
  .list-evt {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 8px;
    margin: 0 -8px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.12s;
  }
  @media (hover: hover) {
    .list-evt:hover {
      background: #f1f5f9;
    }
  }
  .list-evt--static {
    cursor: default;
  }
  .list-evt--static:hover {
    background: transparent;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    flex: none;
  }
  .time {
    width: 100px;
    font-size: 12.5px;
    color: var(--cal-muted);
    flex: none;
  }
  .title {
    min-width: 0;
    font-size: 13.5px;
    color: var(--cal-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .list-empty {
    padding: 40px 0;
    text-align: center;
    font-size: 13.5px;
    color: var(--cal-muted);
  }
</style>
