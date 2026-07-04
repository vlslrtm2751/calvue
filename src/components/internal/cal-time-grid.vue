<template>
  <div class="tg">
    <!-- Header row -->
    <div class="tg-head" :style="gridCols">
      <div class="tg-corner"></div>
      <div class="tg-dcol" v-for="day in days" :class="dayHeadClass(day)" :key="day.format('YYYY-MM-DD')">
        <div class="tg-dn" :style="dayNameStyle(day)">{{ day.format('dd') }}</div>
        <div class="tg-dd" :style="dayNumStyle(day)">{{ day.format('D') }}</div>
      </div>
    </div>

    <!-- All-day row -->
    <div class="tg-allday">
      <div class="tg-corner tg-corner--allday">종일</div>
      <div class="tg-allday__grid" :style="allDayGridStyle">
        <!-- per-day cells (behind the bars): click → 1-day all-day, drag → multi-day all-day,
             and drop targets for horizontal drag of existing all-day events (model A). -->
        <div class="tg-allday__drops">
          <div
            class="tg-allday__cell"
            v-for="day in days"
            :class="{ 'tg-allday__cell--drop': inDropPreview(day), 'tg-allday__cell--sel': inAllDaySelect(day) }"
            :data-cal-date="day.format('YYYY-MM-DD')"
            :key="day.format('YYYY-MM-DD')"
            @click="onAllDayClick(day)"
            @pointerdown="(e) => startMonthSelect(day, e)" />
        </div>
        <cal-event-bar
          v-for="seg in allDayLayout.segments"
          :event="seg.event"
          :key="seg.event.key"
          :resizable-end="
            canDragAllDay &&
            editable !== false &&
            resizable !== false &&
            seg.event.editable &&
            seg.event.interactive !== false &&
            days[seg.endCol].isSame(eventEndDay(seg.event), 'day')
          "
          :style="{
            gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`,
            gridRow: seg.lane + 1,
            pointerEvents: draggingKey || resizingKey ? 'none' : undefined
          }"
          @click="
            (e) => {
              if (consumeDrag()) return;
              emit('eventClick', e);
            }
          "
          @pointerdown="(p) => canDragAllDay && startMonthDrag(p.ev, p.native)"
          @resize-pointerdown="(p) => startResizeEnd(p.ev, p.native)" />
      </div>
    </div>

    <!-- Scrollable body -->
    <div class="tg-scroll" ref="scrollEl">
      <div class="tg-body" :style="gridCols">
        <!-- Hour gutter -->
        <div class="tg-gutter">
          <div class="tg-hour" v-for="h in HOURS" :key="h">{{ h > 0 ? `${String(h).padStart(2, '0')}:00` : '' }}</div>
        </div>

        <!-- Per-day columns -->
        <div
          class="tg-col"
          v-for="day in days"
          :class="{ 'tg-col--biz': isBizDay(day) }"
          :data-cal-date="day.format('YYYY-MM-DD')"
          :key="day.format('YYYY-MM-DD')"
          @click="onColClick($event, day)"
          @pointerdown="(e) => startTimeSelect(day, e)"
          data-cal-col>
          <!-- Now indicator -->
          <div class="tg-nowline" v-if="nowIndicator && day.isSame(today, 'day')" :style="{ top: nowPct + '%' }"></div>
          <!-- Timed events -->
          <cal-time-event
            v-for="box in layoutDay(timedEventsFor(day), day.startOf('day'), slotEventOverlap !== false)"
            :box="box"
            :key="box.event.key"
            :resizable-end="
              editable !== false &&
              resizable !== false &&
              box.event.editable &&
              box.event.interactive !== false &&
              eventEndDay(box.event).isSame(box.event.start, 'day')
            "
            :style="{
              pointerEvents: draggingKey || resizingKey ? 'none' : undefined,
              opacity: draggingKey === box.event.key || resizingKey === box.event.key ? 0.5 : undefined
            }"
            :time-label="gridTimeLabel(box.event, day)"
            @click="(p) => onTimedClick(p, day)"
            @pointerdown="(p) => startTimeDrag(p.ev, p.native)"
            @resize-pointerdown="(p) => startTimeResize(p.ev, p.native)" />
          <!-- Drag placement preview -->
          <div
            class="tg-preview"
            v-if="preview.active && preview.event && preview.dateKey === day.format('YYYY-MM-DD')"
            :style="{
              top: `${(preview.startMin / 1440) * 100}%`,
              height: `${(preview.durationMin / 1440) * 100}%`,
              backgroundColor: preview.event.color
            }">
            <div class="tg-preview__title">{{ preview.event.title }}</div>
            <div class="tg-preview__time"
              >{{ fmtMin(preview.startMin) }}–{{ fmtMin(preview.startMin + preview.durationMin) }}</div
            >
          </div>
          <!-- Select range preview (may span multiple days) -->
          <div
            class="tg-select"
            v-if="selectSeg(day).show"
            :style="{ top: `${selectSeg(day).top}%`, height: `${selectSeg(day).height}%` }">
            <div class="tg-select__time" v-if="selectSeg(day).label">{{ selectSeg(day).label }}</div>
          </div>
        </div>
      </div>
    </div>
    <!-- 터치: 겹친 일정 클러스터 팝오버 — .cal-swipe transform 밖으로 teleport(fixed를 뷰포트 기준으로) -->
    <Teleport to="body">
      <div
        class="tg-cluster"
        v-if="cluster"
        :style="{ top: cluster.top + 'px', left: cluster.left + 'px' }"
        @click.stop
        ref="clusterEl">
        <div class="tg-cluster__head">
          <span>겹친 일정 {{ cluster.events.length }}건</span>
          <button class="tg-cluster__close" @click="cluster = null" aria-label="닫기">×</button>
        </div>
        <div class="tg-cluster__list">
          <div
            class="tg-cluster__row"
            v-for="ev in cluster.events"
            :class="{ 'tg-cluster__row--static': ev.interactive === false }"
            :key="ev.key"
            @click="onClusterRow(ev)">
            <span class="tg-cluster__dot" :style="{ background: ev.color }" />
            <span class="tg-cluster__time">{{ ev.start.format('HH:mm') }}–{{ ev.end.format('HH:mm') }}</span>
            <span class="tg-cluster__title">{{ ev.title }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script lang="ts" setup>
  import type { Dayjs } from 'dayjs';
  import type { CalEvent, CalBusinessHours, EventOrder } from './types';
  import { layoutDay } from './use-event-layout';
  import { layoutDayGridRow, eventEndDay } from './use-daygrid-layout';
  import { useCalendarDnd, useDragPreview } from './use-calendar-dnd';
  import { useCalendarSelect, useSelectPreview } from './use-calendar-select';
  import { isTouch } from './use-cal-device';
  import { gridTimeLabel } from './format';

  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const HOUR_H_PX = 48;

  const props = defineProps<{
    days: Dayjs[];
    editable?: boolean;
    resizable?: boolean;
    events: CalEvent[];
    today: Dayjs;
    businessHours: CalBusinessHours | null;
    selectable?: boolean;
    slotMinTime: string;
    slotMaxTime: string;
    nowIndicator: boolean;
    slotEventOverlap?: boolean;
    scrollTime?: string;
    weekdayColors?: Record<number, string>;
    eventOrder?: EventOrder;
  }>();

  const emit = defineEmits<{
    eventClick: [CalEvent];
    select: [{ start: Dayjs; end: Dayjs; allDay: boolean }];
    eventMove: [unknown];
    eventResize: [unknown];
  }>();

  const {
    draggingKey,
    resizingKey,
    inDropPreview,
    startMonthDrag,
    startTimeDrag,
    startResizeEnd,
    startTimeResize,
    consumeDrag
  } = useCalendarDnd(
    (ev, deltaDays, deltaMinutes) =>
      emit('eventMove', {
        ev,
        start: ev.start.add(deltaDays, 'day').add(deltaMinutes, 'minute'),
        end: ev.end.add(deltaDays, 'day').add(deltaMinutes, 'minute')
      }),
    () => props.editable !== false,
    (ev, start, end) => emit('eventResize', { ev, start, end })
  );

  const preview = useDragPreview();

  const { startMonthSelect, startTimeSelect, consumeSelect } = useCalendarSelect(
    (range) => emit('select', range),
    () => props.selectable !== false
  );
  const selectPreview = useSelectPreview();

  /** click an empty all-day cell → create a 1-day all-day event */
  function onAllDayClick(day: Dayjs): void {
    if (props.selectable === false) return;
    if (consumeDrag() || consumeSelect()) return; // suppress click trailing a move/select drag
    emit('select', { start: day.startOf('day'), end: day.add(1, 'day').startOf('day'), allDay: true });
  }
  /** all-day cell is inside the current drag-select range (month mode) */
  function inAllDaySelect(day: Dayjs): boolean {
    if (!selectPreview.active || selectPreview.mode !== 'month' || !selectPreview.startDate || !selectPreview.endDate) {
      return false;
    }
    const k = day.format('YYYY-MM-DD');
    return k >= selectPreview.startDate && k <= selectPreview.endDate;
  }

  function fmtMin(m: number): string {
    const t = ((m % 1440) + 1440) % 1440;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }

  // Selection-drag highlight segment for one day column (range may span days).
  function selectSeg(day: Dayjs): { show: boolean; top: number; height: number; label: string } {
    const p = selectPreview;
    const key = day.format('YYYY-MM-DD');
    if (!p.active || p.mode !== 'time' || !p.startKey || !p.endKey || key < p.startKey || key > p.endKey) {
      return { show: false, top: 0, height: 0, label: '' };
    }
    const segStart = key === p.startKey ? p.startMin : 0;
    const segEnd = key === p.endKey ? p.endMin : 1440;
    if (segEnd <= segStart) return { show: false, top: 0, height: 0, label: '' };
    return {
      show: true,
      top: (segStart / 1440) * 100,
      height: ((segEnd - segStart) / 1440) * 100,
      label: key === p.startKey ? `${fmtMin(p.startMin)}–${fmtMin(p.endMin)}` : ''
    };
  }

  const scrollEl = ref<HTMLElement | null>(null);

  // grid-template-columns: var(--cal-gutter, 56px) repeat(N, 1fr)
  const gridCols = computed(() => ({
    gridTemplateColumns: `var(--cal-gutter, 56px) repeat(${props.days.length}, 1fr)`
  }));

  // All-day spanning layout
  const allDayEvents = computed(() => props.events.filter((e) => e.allDay));
  const allDayLayout = computed(() => layoutDayGridRow(props.days, allDayEvents.value, Infinity, props.eventOrder));
  const allDayGridStyle = computed(() => ({
    gridTemplateColumns: `repeat(${props.days.length}, 1fr)`
  }));
  // day view has a single column — no room to move an all-day event, so disable its drag
  const canDragAllDay = computed(() => props.days.length > 1);

  // Now indicator top %
  const nowPct = computed(() => {
    const now = props.today; // 반응형(cal-calendar useNow) → 1분마다 라인 위치 갱신
    return (now.diff(now.startOf('day'), 'minute') / 1440) * 100;
  });

  function isBizDay(day: Dayjs): boolean {
    if (!props.businessHours) return false;
    return props.businessHours.daysOfWeek.includes(day.day());
  }

  function timedEventsFor(day: Dayjs): CalEvent[] {
    return props.events.filter((e) => {
      if (e.allDay) return false;
      return e.start.isSame(day, 'day') || (e.start.isBefore(day.endOf('day')) && e.end.isAfter(day.startOf('day')));
    });
  }

  // 터치: 겹친 일정 탭 시 그 시간대에 겹친 일정 목록 팝오버 (데스크톱은 바로 상세). hover 없는 기기에서
  // 좁아진 cascade 박스를 정확히 집기 어려우므로, 대충 탭해도 겹친 일정들을 모아 보여주고 거기서 선택.
  const cluster = ref<{ events: CalEvent[]; top: number; left: number } | null>(null);
  const clusterEl = ref<HTMLElement | null>(null);

  function onTimedClick(p: { event: CalEvent; native: MouseEvent }, day: Dayjs): void {
    if (consumeDrag()) return;
    if (isTouch()) {
      // 탭한 '지점의 시각'에 실제로 겹치는 일정만 모은다 — 일정의 '전체 범위'가 아니라 탭한 y=시각 기준.
      // (그래서 10–19시 일정을 18시에 탭하면 그 시각엔 혼자뿐 → 팝오버 없이 바로 상세.)
      const col = (p.native.currentTarget as HTMLElement | null)?.closest<HTMLElement>('[data-cal-col]');
      const colRect = col?.getBoundingClientRect();
      if (colRect) {
        const tapMin = ((p.native.clientY - colRect.top) / colRect.height) * 1440;
        const tapTime = day.startOf('day').add(tapMin, 'minute');
        const atPoint = timedEventsFor(day)
          .filter((e) => !e.start.isAfter(tapTime) && e.end.isAfter(tapTime)) // start ≤ 탭시각 < end
          .sort((a, b) => a.start.valueOf() - b.start.valueOf());
        if (atPoint.length > 1) {
          const W = 248;
          const h = Math.min(320, 44 + atPoint.length * 40);
          const left = Math.max(8, Math.min(p.native.clientX - W / 2, window.innerWidth - W - 8));
          const top =
            p.native.clientY + 12 + h > window.innerHeight - 8
              ? Math.max(8, p.native.clientY - h - 12) // 아래 공간 부족 → 탭 지점 위로
              : p.native.clientY + 12; // 기본: 탭 지점 바로 아래
          cluster.value = { events: atPoint, top, left };
          return;
        }
      }
    }
    emit('eventClick', p.event);
  }
  function onClusterRow(ev: CalEvent): void {
    cluster.value = null;
    if (ev.interactive !== false) emit('eventClick', ev);
  }
  onClickOutside(clusterEl, () => (cluster.value = null));

  function dayHeadClass(day: Dayjs): Record<string, boolean> {
    return {
      'tg-dcol--today': day.isSame(props.today, 'day'),
      'tg-dcol--sun': day.day() === 0,
      'tg-dcol--sat': day.day() === 6
    };
  }

  function dayNameStyle(day: Dayjs): Record<string, string> {
    const color = props.weekdayColors?.[day.day()];
    return color ? { color } : {};
  }

  function dayNumStyle(day: Dayjs): Record<string, string> {
    if (day.isSame(props.today, 'day')) return {};
    const color = props.weekdayColors?.[day.day()];
    return color ? { color } : {};
  }

  function onColClick(event: MouseEvent, day: Dayjs): void {
    if (props.selectable === false) return;
    if (consumeDrag() || consumeSelect()) return;
    // Ignore clicks that originated on an event chip
    const target = event.target as HTMLElement;
    if (target.closest('.tev')) return;

    const col = event.currentTarget as HTMLElement;
    const rect = col.getBoundingClientRect();
    const rawMins = ((event.clientY - rect.top) / rect.height) * 1440;
    // FLOOR to 30-min boundary: top half of hour → :00, bottom half → :30
    const min = Math.max(0, Math.min(1440 - 30, Math.floor(rawMins / 30) * 30));
    const start = day.startOf('day').add(min, 'minute');
    const end = start.add(60, 'minute');
    emit('select', { start, end, allDay: false });
  }

  onMounted(() => {
    if (scrollEl.value) {
      const [h, m] = (props.scrollTime ?? '07:00').split(':').map(Number);
      scrollEl.value.scrollTop = (((h || 0) * 60 + (m || 0)) / 60) * HOUR_H_PX;
    }
  });
</script>

<style scoped>
  .tg {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  /* Header */
  .tg-head {
    flex: none;
    display: grid;
    border-bottom: 1px solid var(--cal-line);
  }
  .tg-corner {
    border-right: 1px solid var(--cal-line);
  }
  .tg-dcol {
    text-align: center;
    padding: 6px 0;
    border-right: 1px solid var(--cal-line-soft);
  }
  .tg-dn {
    font-size: 12px;
    color: var(--cal-muted);
  }
  .tg-dd {
    font-size: 18px;
    font-weight: 700;
  }
  .tg-dcol--today .tg-dd {
    color: var(--cal-primary);
  }
  .tg-dcol--sun .tg-dn,
  .tg-dcol--sun .tg-dd {
    color: var(--cal-sun);
  }
  .tg-dcol--sat .tg-dn,
  .tg-dcol--sat .tg-dd {
    color: var(--cal-sat);
  }

  /* All-day row */
  .tg-allday {
    flex: none;
    display: grid;
    grid-template-columns: var(--cal-gutter, 56px) 1fr;
    border-bottom: 1px solid var(--cal-line);
    min-height: 26px;
  }
  .tg-corner--allday {
    font-size: 10px;
    color: var(--cal-muted);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tg-allday__grid {
    position: relative;
    display: grid;
    grid-auto-rows: var(--cal-event-height, 22px);
    row-gap: 2px;
    column-gap: 2px;
    padding: 2px;
    align-content: start;
  }
  /* per-day drop targets behind the bars (all-day horizontal drag within the week) */
  .tg-allday__drops {
    position: absolute;
    inset: 2px;
    display: flex;
    gap: 2px;
    z-index: 0;
  }
  .tg-allday__cell {
    flex: 1;
    border-radius: 4px;
    transition: background 0.1s;
  }
  .tg-allday__cell--drop {
    background: rgba(var(--v-theme-primary), 0.12);
  }
  .tg-allday__cell--sel {
    background: #dbeafe;
  }
  .tg-allday__grid :deep(.cal-evt) {
    margin-top: 0;
    min-width: 0;
    margin-right: 10px; /* leave a click strip at the all-day bar's right end */
    position: relative;
    z-index: 1;
  }

  /* Scroll body */
  .tg-scroll {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
  }
  .tg-body {
    display: grid;
    position: relative;
  }

  /* Gutter */
  .tg-gutter {
    border-right: 1px solid var(--cal-line);
  }
  .tg-hour {
    height: var(--cal-hour-h, 48px);
    font-size: 11px;
    color: var(--cal-muted);
    text-align: right;
    padding-right: 6px;
    transform: translateY(-7px);
    box-sizing: border-box;
  }

  /* Day columns */
  .tg-col {
    position: relative;
    border-right: 1px solid var(--cal-line-soft);
    height: calc(24 * var(--cal-hour-h, 48px));
    background-image: repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent calc(var(--cal-slot-h, 48px) - 1px),
      var(--cal-line-soft) calc(var(--cal-slot-h, 48px) - 1px),
      var(--cal-line-soft) var(--cal-slot-h, 48px)
    );
    cursor: pointer;
  }
  .tg-col--biz {
    background-color: #fbfdff;
    background-image: repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent calc(var(--cal-slot-h, 48px) - 1px),
      var(--cal-line-soft) calc(var(--cal-slot-h, 48px) - 1px),
      var(--cal-line-soft) var(--cal-slot-h, 48px)
    );
  }

  /* Now line */
  .tg-nowline {
    position: absolute;
    left: 0;
    right: 0;
    height: 0;
    border-top: 2px solid var(--cal-sun);
    z-index: 100; /* above cascade-overlapped events (each box takes z 1..n) */
    pointer-events: none;
  }
  .tg-nowline::before {
    content: '';
    position: absolute;
    left: -4px;
    top: -5px;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--cal-sun);
  }

  /* Drag placement preview */
  .tg-preview {
    position: absolute;
    left: 3px;
    right: 3px;
    border-radius: 6px;
    padding: 2px 6px;
    color: #fff;
    font-size: 11.5px;
    line-height: 1.4;
    opacity: 0.7;
    pointer-events: none;
    overflow: hidden;
    z-index: 110; /* above events + now-line */
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  }
  .tg-preview__title {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tg-preview__time {
    font-size: 10.5px;
    opacity: 0.95;
  }

  @media (max-width: 600px) {
    .tg {
      --cal-gutter: 42px;
    }
    .tg-hour {
      font-size: 10px;
      padding-right: 4px;
    }
    .tg-dd {
      font-size: 15px;
    }
    .tg-dn {
      font-size: 11px;
    }
  }

  /* Drag-select range highlight */
  .tg-select {
    position: absolute;
    left: 3px;
    right: 3px;
    background: rgba(37, 99, 235, 0.18);
    border: 1px solid var(--cal-primary, #2563eb);
    border-radius: 6px;
    pointer-events: none;
    z-index: 110; /* above events + now-line */
    overflow: hidden;
  }
  .tg-select__time {
    font-size: 10.5px;
    color: var(--cal-primary, #2563eb);
    padding: 1px 4px;
    font-weight: 600;
  }

  /* 터치 겹침 클러스터 팝오버 */
  .tg-cluster {
    position: fixed;
    z-index: 300;
    width: 248px;
    max-height: 320px;
    display: flex;
    flex-direction: column;
    background: #fff;
    border: 1px solid var(--cal-line);
    border-radius: 10px;
    box-shadow:
      0 6px 20px rgba(0, 0, 0, 0.16),
      0 1px 4px rgba(0, 0, 0, 0.08);
    overflow: hidden;
  }
  .tg-cluster__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--cal-muted);
    border-bottom: 1px solid var(--cal-line-soft);
  }
  .tg-cluster__close {
    background: none;
    border: none;
    font-size: 16px;
    line-height: 1;
    color: var(--cal-muted);
    cursor: pointer;
    padding: 0 2px;
  }
  .tg-cluster__list {
    overflow-y: auto;
    padding: 4px;
  }
  .tg-cluster__row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 8px;
    border-radius: 7px;
    cursor: pointer;
  }
  .tg-cluster__row:active {
    background: #f1f5f9;
  }
  .tg-cluster__row--static {
    cursor: default;
  }
  .tg-cluster__dot {
    width: 9px;
    height: 9px;
    border-radius: 3px;
    flex: none;
  }
  .tg-cluster__time {
    font-size: 12px;
    color: var(--cal-muted);
    flex: none;
    width: 88px;
  }
  .tg-cluster__title {
    font-size: 13px;
    color: var(--cal-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
