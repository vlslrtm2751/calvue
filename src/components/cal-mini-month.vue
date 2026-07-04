<template>
  <div class="cal-mini-month">
    <div class="cmm-header">
      <button class="cmm-nav" @click="prevMonth" type="button">‹</button>
      <span class="cmm-title">{{ title }}</span>
      <button class="cmm-nav" @click="nextMonth" type="button">›</button>
    </div>

    <div class="cmm-weekdays">
      <span
        v-for="(wd, i) in weekdays"
        :class="['cmm-wd', i === 0 && 'cmm-wd--sun', i === 6 && 'cmm-wd--sat']"
        :key="wd">
        {{ wd }}
      </span>
    </div>

    <div class="cmm-grid">
      <button
        v-for="day in days"
        :class="[
          'cmm-day',
          day.isSame(today, 'day') && 'cmm-day--today',
          day.isSame(selectedDate, 'day') && 'cmm-day--selected',
          day.month() !== miniAnchor.month() && 'cmm-day--muted',
          day.day() === 0 && 'cmm-day--sun',
          day.day() === 6 && 'cmm-day--sat'
        ]"
        :key="day.valueOf()"
        @click="selectDay(day)"
        type="button">
        {{ day.date() }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import type { CalView } from './types';
  import { useCalendarGrid } from './use-calendar-grid';
  import { useCasStore } from '@/stores';

  const casStore = useCasStore();

  const view = ref<CalView>('month');
  const miniAnchor = ref(dayjs(casStore.currentDate));
  const selectedDate = computed(() => dayjs(casStore.currentDate));
  const today = computed(() => dayjs());

  watch(
    () => casStore.currentDate,
    (d) => {
      miniAnchor.value = dayjs(d);
    }
  );

  const { days, title } = useCalendarGrid(view, miniAnchor);

  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  function prevMonth(): void {
    miniAnchor.value = miniAnchor.value.subtract(1, 'month');
  }

  function nextMonth(): void {
    miniAnchor.value = miniAnchor.value.add(1, 'month');
  }

  function selectDay(day: ReturnType<typeof dayjs>): void {
    casStore.currentDate = day.toISOString();
  }
</script>

<style scoped>
  .cal-mini-month {
    --cal-primary: rgb(var(--v-theme-primary));
    padding: 8px;
    font-size: 12px;
    background: #fff;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }

  .cmm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .cmm-title {
    font-size: 12px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.75);
    letter-spacing: -0.01em;
  }

  .cmm-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    color: rgba(0, 0, 0, 0.5);
    transition: background 0.15s;
  }

  .cmm-nav:hover {
    background: rgba(0, 0, 0, 0.06);
    color: rgba(0, 0, 0, 0.8);
  }

  .cmm-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-bottom: 2px;
  }

  .cmm-wd {
    text-align: center;
    padding: 2px 0;
    font-size: 10px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.4);
  }

  .cmm-wd--sun {
    color: #ef4444;
    opacity: 0.7;
  }

  .cmm-wd--sat {
    color: #2563eb;
    opacity: 0.7;
  }

  .cmm-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
  }

  .cmm-day {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    justify-self: center;
    border: none;
    background: transparent;
    border-radius: 50%;
    cursor: pointer;
    font-size: 11px;
    color: rgba(0, 0, 0, 0.75);
    transition: background 0.12s;
    margin: 1px;
  }

  .cmm-day:hover:not(.cmm-day--selected) {
    background: rgba(0, 0, 0, 0.06);
  }

  .cmm-day--today {
    font-weight: 700;
    color: var(--cal-primary, #1976d2);
  }

  .cmm-day--selected {
    background: var(--cal-primary, #1976d2);
    color: #fff !important;
    font-weight: 600;
  }

  .cmm-day--muted {
    color: rgba(0, 0, 0, 0.25);
  }

  .cmm-day--sun:not(.cmm-day--selected):not(.cmm-day--muted) {
    color: #ef4444;
  }

  .cmm-day--sat:not(.cmm-day--selected):not(.cmm-day--muted) {
    color: #2563eb;
  }
</style>
