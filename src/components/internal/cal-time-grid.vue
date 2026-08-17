<template>
  <div class="tg" :class="{ 'tg--12h': timeFormat === '12h' }">
    <!-- Header row -->
    <div class="tg-head" :style="headCols">
      <div class="tg-corner"></div>
      <div class="tg-dcol" v-for="day in days" :class="dayHeadClass(day)" :key="day.format('YYYY-MM-DD')">
        <div class="tg-dn" :style="dayNameStyle(day)">{{ m.weekdaysShort[day.day()] }}</div>
        <div class="tg-dd" :style="dayNumStyle(day)">{{ day.format('D') }}</div>
      </div>
    </div>

    <!-- All-day row -->
    <div class="tg-allday" :style="allDayCols">
      <div class="tg-corner tg-corner--allday">{{ m.allDay }}</div>
      <div class="tg-allday__grid" :style="allDayGridStyle">
        <!-- Today-focus background, painted before the drop layer: .tg-allday__cell (flex, inset,
             gaps, radius) doesn't line up with the square full-bleed header/body overlay, so this
             reuses allDayGridStyle to match their column edges instead. -->
        <div class="tg-allday__bg" :style="allDayGridStyle" aria-hidden="true">
          <div
            class="tg-allday__bg-cell"
            v-for="day in days"
            :class="{ 'tg-allday__bg-cell--focus': isFocusDay(day) }"
            :key="day.format('YYYY-MM-DD')" />
        </div>
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
          <div class="tg-hour" v-for="(h, i) in HOURS" :key="h">{{ i > 0 ? m.clockTime(h, 0) : '' }}</div>
        </div>

        <!-- Per-day columns -->
        <div
          class="tg-col"
          v-for="day in days"
          :class="{ 'tg-col--biz': isBizDay(day), 'tg-col--focus': isFocusDay(day) }"
          :data-cal-date="day.format('YYYY-MM-DD')"
          :key="day.format('YYYY-MM-DD')"
          @click="onColClick($event, day)"
          @pointerdown="(e) => startTimeSelect(day, e)"
          data-cal-col>
          <!-- Now indicator -->
          <div
            class="tg-nowline"
            v-if="nowIndicator && nowInWindow && day.isSame(today, 'day')"
            :style="{ top: nowPct + '%' }"></div>
          <!-- Timed events -->
          <cal-time-event
            v-for="box in layoutDay(
              timedEventsFor(day),
              day.startOf('day'),
              slotEventOverlap !== false,
              timeWindow,
              eventOrder
            )"
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
            :time-label="m.gridTimeLabel(box.event, day)"
            @click="(p) => onTimedClick(p, day)"
            @pointerdown="(p) => startTimeDrag(p.ev, p.native)"
            @resize-pointerdown="(p) => startTimeResize(p.ev, p.native)" />
          <!-- Drag placement preview -->
          <div
            class="tg-preview"
            v-if="preview.active && preview.event && preview.dateKey === day.format('YYYY-MM-DD')"
            :style="{
              top: `${pctOf(preview.startMin)}%`,
              height: `${(preview.durationMin / winSpan) * 100}%`,
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
        :class="{ 'tg-cluster--12h': timeFormat === '12h' }"
        v-if="cluster"
        :style="clusterStyle"
        @click.stop
        ref="clusterEl">
        <div class="tg-cluster__head">
          <span>{{ m.overlapCount(cluster.events.length) }}</span>
          <button class="tg-cluster__close" @click="cluster = null" :aria-label="m.close">×</button>
        </div>
        <div class="tg-cluster__list">
          <div
            class="tg-cluster__row"
            v-for="ev in cluster.events"
            :class="{ 'tg-cluster__row--static': ev.interactive === false }"
            :key="ev.key"
            @click="onClusterRow(ev)">
            <span class="tg-cluster__dot" :style="{ background: ev.color }" />
            <span class="tg-cluster__time"
              >{{ m.clockTime(ev.start.hour(), ev.start.minute()) }}–{{
                m.clockTime(ev.end.hour(), ev.end.minute())
              }}</span
            >
            <span class="tg-cluster__title">{{ ev.title }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script lang="ts" setup>
  import type { Dayjs } from 'dayjs';
  import type { CalEvent, CalEventChange, CalBusinessHours, EventOrder, TimeFormat } from '../../types';
  import type { TimeWindow } from '../../composables/use-event-layout';
  import { layoutDay } from '../../composables/use-event-layout';
  import { layoutDayGridRow, eventEndDay } from '../../composables/use-daygrid-layout';
  import { useCalendarDnd, useDragPreview } from '../../composables/use-calendar-dnd';
  import { useCalendarSelect, useSelectPreview } from '../../composables/use-calendar-select';
  import { isTouch } from '../../composables/use-cal-device';
  import { useCalI18n } from '../../composables/use-cal-i18n';
  import { useCalPopoverDismiss } from '../../composables/use-cal-popover';
  import { useCalTodayFocus } from '../../composables/use-cal-today-focus';

  const HOUR_H_PX = 48;

  function toMinutes(hhmm: string | undefined, fallback: number): number {
    if (!hhmm) return fallback;
    const [h, m] = hhmm.split(':').map(Number);
    return Number.isFinite(h) ? (h || 0) * 60 + (m || 0) : fallback;
  }

  const props = defineProps<{
    days: Dayjs[];
    editable?: boolean;
    resizable?: boolean;
    events: CalEvent[];
    today: Dayjs;
    todayFocused?: boolean;
    focusSeq?: number;
    businessHours: CalBusinessHours | null;
    selectable?: boolean;
    slotMinTime: string;
    slotMaxTime: string;
    nowIndicator: boolean;
    slotEventOverlap?: boolean;
    scrollTime?: string;
    weekdayColors?: Record<number, string>;
    eventOrder?: EventOrder;
    /** the timeFormat OPTION with defaults applied (cal-calendar passes opts.timeFormat) --
        deliberately not the effective clock. A messages.clockTime override changes what
        renders but must not also widen the gutter, so this prop stays the raw option;
        only '12h' widens it (tg--12h), 'auto' stays untouched. */
    timeFormat?: TimeFormat;
  }>();

  const emit = defineEmits<{
    eventClick: [CalEvent];
    select: [{ start: Dayjs; end: Dayjs; allDay: boolean }];
    eventMove: [CalEventChange];
    eventResize: [CalEventChange];
  }>();

  const m = useCalI18n();

  // 세로로 그리는 시간대. 기본은 하루 전체(0~1440)이고, 그때의 계산은 자정 기준 분과 같다.
  const timeWindow = computed<TimeWindow>(() => {
    const start = Math.max(0, Math.min(1380, toMinutes(props.slotMinTime, 0)));
    const end = Math.max(start + 60, Math.min(1440, toMinutes(props.slotMaxTime, 1440)));
    return { start, end };
  });
  const winSpan = computed(() => timeWindow.value.end - timeWindow.value.start);
  /** 시간 눈금 — 창의 시작 시부터 끝 시까지 */
  const HOURS = computed(() => {
    const from = Math.floor(timeWindow.value.start / 60);
    const to = Math.ceil(timeWindow.value.end / 60);
    return Array.from({ length: to - from }, (_, i) => from + i);
  });
  /** 자정 기준 분 → 컬럼 안 세로 위치(%) */
  function pctOf(minute: number): number {
    return ((minute - timeWindow.value.start) / winSpan.value) * 100;
  }

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
    (ev, start, end) => emit('eventResize', { ev, start, end }),
    () => timeWindow.value
  );

  const preview = useDragPreview();

  const { startMonthSelect, startTimeSelect, consumeSelect } = useCalendarSelect(
    (range) => emit('select', range),
    () => props.selectable !== false,
    () => timeWindow.value
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

  function fmtMin(min: number): string {
    const t = ((min % 1440) + 1440) % 1440;
    return m.value.clockTime(Math.floor(t / 60), t % 60);
  }

  // Selection-drag highlight segment for one day column (range may span days).
  function selectSeg(day: Dayjs): { show: boolean; top: number; height: number; label: string } {
    const p = selectPreview;
    const key = day.format('YYYY-MM-DD');
    if (!p.active || p.mode !== 'time' || !p.startKey || !p.endKey || key < p.startKey || key > p.endKey) {
      return { show: false, top: 0, height: 0, label: '' };
    }
    const { start: winStart, end: winEnd } = timeWindow.value;
    const segStart = Math.max(winStart, key === p.startKey ? p.startMin : winStart);
    const segEnd = Math.min(winEnd, key === p.endKey ? p.endMin : winEnd);
    if (segEnd <= segStart) return { show: false, top: 0, height: 0, label: '' };
    return {
      show: true,
      top: pctOf(segStart),
      height: ((segEnd - segStart) / winSpan.value) * 100,
      label: key === p.startKey ? `${fmtMin(p.startMin)}–${fmtMin(p.endMin)}` : ''
    };
  }

  const scrollEl = ref<HTMLElement | null>(null);

  // grid-template-columns: var(--cal-gutter, 56px) repeat(N, 1fr)
  const gridCols = computed(() => ({
    gridTemplateColumns: `var(--cal-gutter, 56px) repeat(${props.days.length}, 1fr)`,
    // 컬럼 높이는 그리는 시간 수를 따른다 — 눈금(.tg-hour)과 어긋나지 않게
    '--tg-hours': String(HOURS.value.length)
  }));

  // .tg-body만 .tg-scroll 안이라 스크롤바 폭만큼 좁다. 헤더·종일 행은 밖이라 전체 폭을 쓰므로,
  // 같은 repeat(N, 1fr)을 서로 다른 총폭에 나누면 컬럼 경계가 조금씩 벌어진다(주 뷰에서 드러남).
  // 스크롤바 폭을 헤더·종일 행의 padding-right로 빼서 셋을 같은 폭 위에 올린다.
  // 오버레이 스크롤바 환경에서는 0이라 아무것도 바뀌지 않는다.
  const scrollbarW = ref<number>(0);

  function measureScrollbar(): void {
    const el = scrollEl.value;
    scrollbarW.value = el ? el.offsetWidth - el.clientWidth : 0;
  }

  const headCols = computed(() => ({ ...gridCols.value, paddingRight: `${scrollbarW.value}px` }));
  const allDayCols = computed(() => ({ paddingRight: `${scrollbarW.value}px` }));

  // All-day spanning layout
  const allDayEvents = computed(() => props.events.filter((e) => e.allDay));
  const allDayLayout = computed(() => layoutDayGridRow(props.days, allDayEvents.value, Infinity, props.eventOrder));
  const allDayGridStyle = computed(() => ({
    gridTemplateColumns: `repeat(${props.days.length}, 1fr)`
  }));
  // day view has a single column — no room to move an all-day event, so disable its drag
  const canDragAllDay = computed(() => props.days.length > 1);

  // Now indicator top %
  const nowMin = computed(() => props.today.diff(props.today.startOf('day'), 'minute')); // 반응형(useNow) → 1분마다 갱신
  const nowInWindow = computed(() => nowMin.value >= timeWindow.value.start && nowMin.value <= timeWindow.value.end);
  const nowPct = computed(() => pctOf(nowMin.value));

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
  /** 뷰포트 가장자리에서 유지할 최소 여백 */
  const CLUSTER_MARGIN = 8;
  /** 탭 지점과 팝오버 사이 간격 */
  const CLUSTER_GAP = 12;

  const cluster = ref<{ events: CalEvent[] } | null>(null);
  const clusterEl = ref<HTMLElement | null>(null);
  const clusterStyle = ref<Record<string, string>>({});
  // 반응형일 필요 없음 — 렌더링에 쓰지 않고 위치 계산에만 쓴다
  let clusterTap: { x: number; y: number } | null = null;

  function onTimedClick(p: { event: CalEvent; native: MouseEvent }, day: Dayjs): void {
    if (consumeDrag()) return;
    if (isTouch()) {
      // 탭한 '지점의 시각'에 실제로 겹치는 일정만 모은다 — 일정의 '전체 범위'가 아니라 탭한 y=시각 기준.
      // (그래서 10–19시 일정을 18시에 탭하면 그 시각엔 혼자뿐 → 팝오버 없이 바로 상세.)
      const col = (p.native.currentTarget as HTMLElement | null)?.closest<HTMLElement>('[data-cal-col]');
      const colRect = col?.getBoundingClientRect();
      if (colRect) {
        const tapMin = timeWindow.value.start + ((p.native.clientY - colRect.top) / colRect.height) * winSpan.value;
        const tapTime = day.startOf('day').add(tapMin, 'minute');
        const atPoint = timedEventsFor(day)
          .filter((e) => !e.start.isAfter(tapTime) && e.end.isAfter(tapTime)) // start ≤ 탭시각 < end
          .sort((a, b) => a.start.valueOf() - b.start.valueOf());
        if (atPoint.length > 1) {
          clusterTap = { x: p.native.clientX, y: p.native.clientY };
          // 측정 전에는 숨긴 채로 렌더 — 없으면 잘못된 위치에 한 프레임 깜빡인다
          clusterStyle.value = { visibility: 'hidden', top: '0px', left: '0px' };
          cluster.value = { events: atPoint };
          nextTick(() => positionCluster());
          return;
        }
      }
    }
    emit('eventClick', p.event);
  }

  /** 실제 렌더 크기를 재서 뒤집기·클램프를 결정한다(행 높이 40px 가정 추정식은 실제와 어긋날 수 있다) */
  function positionCluster(): void {
    const box = clusterEl.value?.getBoundingClientRect();
    const tap = clusterTap;
    if (!box || !tap) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const left = Math.max(CLUSTER_MARGIN, Math.min(tap.x - box.width / 2, vw - box.width - CLUSTER_MARGIN));
    const top =
      tap.y + CLUSTER_GAP + box.height > vh - CLUSTER_MARGIN
        ? Math.max(CLUSTER_MARGIN, tap.y - box.height - CLUSTER_GAP) // 아래 공간 부족 → 탭 지점 위로
        : tap.y + CLUSTER_GAP; // 기본: 탭 지점 바로 아래

    clusterStyle.value = { top: `${top}px`, left: `${left}px` };
  }
  function onClusterRow(ev: CalEvent): void {
    cluster.value = null;
    if (ev.interactive !== false) emit('eventClick', ev);
  }
  useCalPopoverDismiss(clusterEl, () => cluster.value !== null, () => (cluster.value = null));

  function dayHeadClass(day: Dayjs): Record<string, boolean> {
    return {
      'tg-dcol--today': day.isSame(props.today, 'day'),
      'tg-dcol--sun': day.day() === 0,
      'tg-dcol--sat': day.day() === 6,
      'tg-dcol--focus': isFocusDay(day)
    };
  }

  function isFocusDay(day: Dayjs): boolean {
    return !!props.todayFocused && day.isSame(props.today, 'day');
  }

  /**
   * 현재 시각이 세로 중앙에 오도록 스크롤한다. onMounted의 scrollTime 이동은 한 번뿐이라
   * 오후가 되면 현재시각 라인이 화면 밖에 있다.
   *
   * 현재 시각이 TimeWindow 밖이어도(예: slotMinTime='09:00'인데 지금 07시) 별도 분기가 필요 없다 —
   * Math.max(0, ...)가 창 맨 위로, 브라우저의 최대 스크롤 제한이 창 맨 아래로 각각 클램프한다.
   */
  function scrollToToday(behavior: ScrollBehavior): void {
    const host = scrollEl.value;
    if (!host) return;
    if (!props.days.some((d) => d.isSame(props.today, 'day'))) return; // 오늘이 표시 범위 밖
    const nowTop = ((nowMin.value - timeWindow.value.start) / 60) * HOUR_H_PX;
    host.scrollTo({ top: Math.max(0, nowTop - host.clientHeight / 2), behavior });
  }

  useCalTodayFocus(toRef(props, 'focusSeq'), scrollToToday);

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
    const { start: winStart, end: winEnd } = timeWindow.value;
    const rawMins = winStart + ((event.clientY - rect.top) / rect.height) * winSpan.value;
    // FLOOR to 30-min boundary: top half of hour → :00, bottom half → :30
    const min = Math.max(winStart, Math.min(winEnd - 30, Math.floor(rawMins / 30) * 30));
    const start = day.startOf('day').add(min, 'minute');
    const end = start.add(60, 'minute');
    emit('select', { start, end, allDay: false });
  }

  useResizeObserver(scrollEl, measureScrollbar);

  onMounted(() => {
    measureScrollbar();
    if (scrollEl.value) {
      const scrollMin = toMinutes(props.scrollTime, 420); // 420 = 07:00, 기존 기본값과 동일
      scrollEl.value.scrollTop = Math.max(0, ((scrollMin - timeWindow.value.start) / 60) * HOUR_H_PX);
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
    position: relative; /* 포커스 오버레이(::after)의 기준 */
    text-align: center;
    padding: 6px 0;
    border-right: 1px solid var(--cal-line-soft);
  }
  .tg-dcol::after,
  .tg-col::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: var(--cal-today-focus-bg, color-mix(in srgb, var(--cal-primary) 18%, transparent));
    opacity: 0;
    transition: opacity 500ms ease;
  }
  .tg-dcol--focus::after,
  .tg-col--focus::after {
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .tg-dcol::after,
    .tg-col::after {
      transition: none;
    }
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
  .tg-allday__bg {
    position: absolute;
    inset: 0;
    display: grid;
    z-index: 0;
    pointer-events: none;
  }
  .tg-allday__bg-cell {
    position: relative;
  }
  .tg-allday__bg-cell::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: var(--cal-today-focus-bg, color-mix(in srgb, var(--cal-primary) 18%, transparent));
    opacity: 0;
    transition: opacity 500ms ease;
  }
  .tg-allday__bg-cell--focus::after {
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .tg-allday__bg-cell::after {
      transition: none;
    }
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
    background: color-mix(in srgb, var(--cal-primary) 12%, transparent);
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
    /* without this, a label too wide for the gutter wraps to two lines instead of
       overflowing -- which hides the problem from the ordinary scrollWidth > clientWidth
       check. nowrap turns silent wrapping into measurable overflow. */
    white-space: nowrap;
  }

  /* Day columns */
  .tg-col {
    position: relative;
    border-right: 1px solid var(--cal-line-soft);
    height: calc(var(--tg-hours, 24) * var(--cal-hour-h, 48px));
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
    /* measured: narrow + ko + 12h needs ~44.5px for the widest label ('오전 10시' etc.,
       double-digit 12-hour numbers) against a 41px content width at 42px -- the only
       combination of the 8 measured (2 widths x 2 locales x auto/12h) that overflows once
       .tg-hour is nowrap. 50px gutter clears it with a few px to spare. Must come after
       .tg above: same specificity, source order decides which --cal-gutter wins. */
    .tg--12h {
      --cal-gutter: 50px;
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
    /* Teleport로 <body> 아래로 나가 .cal / .cal-month의 토큰·글꼴을 상속받지 못한다 — 여기서 자급한다 */
    --cal-line: #e5e7eb;
    --cal-line-soft: #f1f3f5;
    --cal-ink: #1f2937;
    --cal-muted: #6b7280;
    color: var(--cal-ink);
    font-family:
      'Pretendard',
      'Apple SD Gothic Neo',
      system-ui,
      -apple-system,
      sans-serif;
    position: fixed;
    z-index: var(--cal-popover-z, 1500);
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
    /* without this, a label too wide for the box wraps instead of overflowing, which the
       ordinary scrollWidth > clientWidth check can't see -- nowrap turns it into measurable
       overflow. Mirrors .tg-hour above. */
    white-space: nowrap;
  }
  /* measured (natural, unwrapped width against the 88px box): ko 12h's widest label
     ('오전 12:45–오후 11:45', double-digit hour + minute on both sides) is ~120.7px; even the
     compact on-the-hour form ('오전 10시–오전 11시') is ~113px. en 12h's widest
     ('12:45 AM–11:45 PM') is ~109.5px. 130px clears the ko worst case with ~9px to spare.
     auto/24h max out at ~64.3px in either language (clock24 in both), well inside 88px, so
     they're untouched. .tg-cluster is teleported to <body> -- a plain `.tg--12h .tg-cluster__time`
     descendant selector would never match once teleport moves it out of .tg's subtree, so the
     modifier lives on .tg-cluster itself instead. */
  .tg-cluster--12h .tg-cluster__time {
    width: 130px;
  }
  .tg-cluster__title {
    font-size: 13px;
    color: var(--cal-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
