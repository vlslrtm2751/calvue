<template>
  <div class="list">
    <template v-for="group in groupedByDay" :key="group.dateKey">
      <div class="list-month" v-if="group.monthLabel">{{ group.monthLabel }}</div>
      <div class="list-day">
        <div class="list-date" :class="{ 'list-date--today': group.isToday }">
          <span class="big">{{ group.dayNum }}</span>
          {{ group.weekday }}<template v-if="group.isToday"> · 오늘</template>
        </div>
        <div>
          <div
            class="list-evt"
            v-for="ev in group.events"
            :class="{ 'list-evt--static': ev.interactive === false }"
            :key="ev.key"
            @click="ev.interactive !== false && emit('eventClick', ev)">
            <span class="dot" :style="{ background: ev.color }"></span>
            <span class="time">{{ dayLabel(ev, group.day) }}</span>
            <span class="title">{{ ev.title }}</span>
          </div>
        </div>
      </div>
    </template>
    <div class="list-empty" v-if="groupedByDay.length === 0">이 기간에 일정이 없습니다.</div>
  </div>
</template>

<script lang="ts" setup>
  import type { CalEvent, CalRange, EventOrder } from './types';
  import type { Dayjs } from 'dayjs';
  import { defaultEventOrder } from './use-event-order';
  import { dayLabel } from './format';

  const props = defineProps<{ events: CalEvent[]; range: CalRange; eventOrder?: EventOrder }>();
  const emit = defineEmits<{ eventClick: [CalEvent] }>();

  interface DayGroup {
    day: Dayjs;
    dateKey: string;
    dayNum: number;
    weekday: string;
    isToday: boolean;
    monthLabel: string; // non-empty on the first group of each month → section header
    events: CalEvent[];
  }

  const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

  const groupedByDay = computed<DayGroup[]>(() => {
    const { start, end } = props.range;
    const today = dayjs().startOf('day');
    const groups: DayGroup[] = [];

    let cursor = start.startOf('day');
    let prevYm = '';
    while (cursor.isBefore(end)) {
      const dayStart = cursor;
      const dayEnd = cursor.add(1, 'day');

      const dayEvents = props.events
        .filter((ev) => ev.start.isBefore(dayEnd) && ev.end.isAfter(dayStart))
        .sort(props.eventOrder ?? defaultEventOrder);

      if (dayEvents.length > 0) {
        const ym = cursor.format('YYYY-MM');
        groups.push({
          day: dayStart,
          dateKey: cursor.format('YYYY-MM-DD'),
          dayNum: cursor.date(),
          weekday: WEEKDAY_LABELS[cursor.day()],
          isToday: cursor.isSame(today, 'day'),
          monthLabel: ym !== prevYm ? cursor.format('YYYY년 M월') : '',
          events: dayEvents
        });
        prevYm = ym;
      }

      cursor = cursor.add(1, 'day');
    }

    return groups;
  });
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
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--cal-line-soft);
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
    width: 110px;
    font-size: 12.5px;
    color: var(--cal-muted);
    flex: none;
  }
  .title {
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
