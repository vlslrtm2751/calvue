<template>
  <div class="cal-month" :style="{ '--cal-cols': colCount }">
    <!-- Day of week header -->
    <div class="cal-month__dow">
      <div
        class="cal-month__dow-cell"
        v-for="col in DOW_LABELS"
        :key="col.dow"
        :style="props.weekdayColors?.[col.dow] ? { color: props.weekdayColors[col.dow] } : {}">
        {{ col.label }}
      </div>
    </div>

    <!-- Weeks grid -->
    <div class="cal-month__weeks" ref="weeksEl">
      <div
        class="cal-month__week"
        v-for="(week, wi) in weeks"
        :key="wi"
        :style="{ minHeight: weekMinHeights[wi] + 'px' }">
        <!-- Day cells (background layer: daynum, hover, click-select, +N trigger) -->
        <div
          class="cal-month__cell"
          v-for="(day, di) in week"
          :class="{
            'cal-month__cell--drop': inDropPreview(day),
            'cal-month__cell--sel': isInSelection(day),
            'cal-month__cell--today': day.isSame(today, 'day'),
            'cal-month__cell--focus': isFocusDay(day)
          }"
          :data-cal-date="day.format('YYYY-MM-DD')"
          :key="di"
          @click.self="onCellClick(day)"
          @pointerdown="(e) => startMonthSelect(day, e)">
          <!-- Day number -->
          <span :class="['cal-month__daynum', daynumClass(day)]" :style="dayNumStyle(day)">{{ day.date() }}</span>
        </div>

        <!-- Event overlay: bars + dots + per-column more, all in the same lane grid -->
        <div class="cal-month__events">
          <template v-for="seg in rowLayouts[wi].segments" :key="seg.event.key">
            <cal-event-bar
              v-if="seg.lane < maxEvents && isBar(seg.event)"
              :class="{ 'is-dragging-bar': draggingKey === seg.event.key, 'cal-evt--today': segCrossesToday(seg, wi) }"
              :continued="!weeks[wi][seg.startCol].isSame(seg.event.start, 'day')"
              :event="seg.event"
              :resizable-end="
                editable !== false &&
                resizable !== false &&
                seg.event.editable &&
                seg.event.interactive !== false &&
                weeks[wi][seg.endCol].isSame(eventEndDay(seg.event), 'day')
              "
              :style="{
                gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`,
                gridRow: seg.lane + 1,
                pointerEvents: draggingKey || resizingKey || selectPreview.active ? 'none' : 'auto'
              }"
              @click="
                (e) => {
                  if (consumeDrag()) return;
                  emit('eventClick', e);
                }
              "
              @pointerdown="(p) => startMonthDrag(p.ev, p.native)"
              @resize-pointerdown="(p) => startResizeEnd(p.ev, p.native)" />
            <div
              class="cal-month__dot-row"
              v-else-if="seg.lane < maxEvents"
              :class="{
                'is-dragging-bar': draggingKey === seg.event.key,
                'cal-month__dot-row--today': segCrossesToday(seg, wi),
                'cal-month__dot-row--static': seg.event.interactive === false
              }"
              :style="{
                gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`,
                gridRow: seg.lane + 1,
                pointerEvents: draggingKey || selectPreview.active ? 'none' : 'auto'
              }"
              @click.stop="
                () => {
                  if (seg.event.interactive === false || consumeDrag()) return;
                  emit('eventClick', seg.event);
                }
              "
              @mouseenter="
                seg.event.interactive !== false &&
                tip.show(seg.event, $event.currentTarget as HTMLElement, $event.clientY)
              "
              @mouseleave="tip.hide()"
              @pointerdown="
                (e) => {
                  tip.hide();
                  startMonthDrag(seg.event, e);
                }
              ">
              <span class="cal-month__dot" :style="{ background: seg.event.color }" />
              <span class="cal-month__dot-time">{{ m.eventTime(seg.event.start) }}</span>
              <span class="cal-month__dot-title">{{ seg.event.title }}</span>
            </div>
          </template>
          <template v-for="(day, di) in weeks[wi]" :key="`more-${di}`">
            <div
              class="cal-month__more"
              v-if="rowLayouts[wi].overflowByCol[di] > 0"
              :style="{ gridColumn: `${di + 1} / ${di + 2}`, gridRow: maxEvents + 1 }"
              @click.stop="openPopover(day, $event)">
              {{ m.more(rowLayouts[wi].overflowByCol[di]) }}
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Popover — .cal-swipe transform 밖으로 teleport(fixed를 뷰포트 기준으로), 위치는 실측 후 확정 -->
    <Teleport to="body">
      <div class="cal-month__popover" v-if="popoverDay" :style="popoverStyle" @click.stop ref="popoverEl">
        <div class="cal-month__popover-header">
          <span class="cal-month__popover-date">{{ m.popoverDate(popoverDay) }}</span>
          <button class="cal-month__popover-close" @click="closePopover" :aria-label="m.close">×</button>
        </div>
        <div class="cal-month__popover-events">
          <div
            class="cal-month__popover-row"
            v-for="ev in eventsByDay(popoverDay)"
            :class="{ 'cal-month__popover-row--static': ev.interactive === false }"
            :key="ev.key"
            @click="onPopoverEventClick(ev)">
            <span class="cal-month__popover-dot" :style="{ backgroundColor: ev.color }" />
            <span class="cal-month__popover-title">{{ ev.title }}</span>
            <span class="cal-month__popover-time">{{ m.dayLabel(ev, popoverDay) }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script lang="ts" setup>
  import type { Dayjs } from 'dayjs';
  import type { CalEvent, CalEventChange, EventOrder } from '../../types';
  import type { DayGridSegment } from '../../composables/use-daygrid-layout';
  import { layoutDayGridRow, eventEndDay } from '../../composables/use-daygrid-layout';
  import { defaultEventOrder } from '../../composables/use-event-order';
  import { useCalendarDnd } from '../../composables/use-calendar-dnd';
  import { useCalendarSelect, useSelectPreview } from '../../composables/use-calendar-select';
  import { useCalI18n } from '../../composables/use-cal-i18n';
  import { useCalTooltip } from '../../composables/use-cal-tooltip';
  import { useCalPopoverDismiss } from '../../composables/use-cal-popover';
  import { useCalTodayFocus } from '../../composables/use-cal-today-focus';

  const props = defineProps<{
    weeks: Dayjs[][];
    events: CalEvent[];
    editable?: boolean;
    today: Dayjs;
    weekdayColors?: Record<number, string>;
    firstDay?: number;
    dayMaxEvents?: number | false;
    eventOrder?: EventOrder;
    selectable?: boolean;
    resizable?: boolean;
    eventHeight?: number;
    todayFocused?: boolean;
    focusSeq?: number;
  }>();

  /** 셀당 최대 표시 일정 수(바+점 합산). 초과분은 '+N 더보기'. false/미지정이면 Infinity = 전부 표시 */
  const maxEvents = computed(() => (typeof props.dayMaxEvents === 'number' ? props.dayMaxEvents : Infinity));

  // 요일 헤더·컬럼 수는 실제 그리드(weeks[0])에서 도출 → weekends=false면 자동으로 평일만(5컬럼)
  const DOW_LABELS = computed(() => {
    const base = m.value.weekdaysShort;
    return (props.weeks[0] ?? []).map((d) => ({ label: base[d.day()], dow: d.day() }));
  });
  const colCount = computed(() => props.weeks[0]?.length ?? 7);

  const emit = defineEmits<{
    eventClick: [CalEvent];
    select: [{ start: Dayjs; end: Dayjs; allDay: boolean }];
    eventMove: [CalEventChange];
    eventResize: [CalEventChange];
  }>();

  const { draggingKey, resizingKey, inDropPreview, startMonthDrag, startResizeEnd, consumeDrag } = useCalendarDnd(
    (ev, deltaDays) =>
      emit('eventMove', { ev, start: ev.start.add(deltaDays, 'day'), end: ev.end.add(deltaDays, 'day') }),
    () => props.editable !== false,
    (ev, start, end) => emit('eventResize', { ev, start, end })
  );

  const { startMonthSelect, consumeSelect } = useCalendarSelect(
    (range) => emit('select', range),
    () => props.selectable !== false
  );
  const selectPreview = useSelectPreview();
  const tip = useCalTooltip();
  const m = useCalI18n();

  function onCellClick(day: Dayjs): void {
    if (props.selectable === false) return;
    if (consumeDrag() || consumeSelect()) return; // suppress the click trailing an event-move or select drag
    emit('select', { start: day, end: day.add(1, 'day'), allDay: true });
  }
  function isInSelection(day: Dayjs): boolean {
    if (!selectPreview.active || selectPreview.mode !== 'month' || !selectPreview.startDate || !selectPreview.endDate) {
      return false;
    }
    const k = day.format('YYYY-MM-DD');
    return k >= selectPreview.startDate && k <= selectPreview.endDate; // ISO 문자열 비교 = 날짜순
  }

  /** 종일이 아니면서 하루를 넘기는(자정을 가로지르는) 이벤트인지 — 스패닝 바 대상 판별용 */
  function isMultiDay(e: CalEvent): boolean {
    return !e.start.startOf('day').isSame(e.end.subtract(1, 'millisecond').startOf('day'), 'day');
  }

  /** event를 바로 그릴지(종일·멀티데이) 점으로 그릴지(당일 시간) 판별 */
  function isBar(e: CalEvent): boolean {
    return e.allDay || isMultiDay(e);
  }

  /** 주별 day-grid 레이아웃: 모든 일정을 하나의 lane 시스템에 배치(first-fit) — 점도 빈 lane을 채운다 */
  const rowLayouts = computed(() =>
    props.weeks.map((w) => layoutDayGridRow(w, props.events, maxEvents.value, props.eventOrder))
  );

  /**
   * 주별 최소 높이(px): 일수 행 + 표시 레인 + (더보기 행). flex로 여유 있으면 균등하게 더 커지고,
   * 합이 영역을 넘으면 .cal-month__weeks가 세로 스크롤된다. '전부 표시'(maxEvents=Infinity)면 그 주 셀이 늘어나 다 보임.
   */
  const weekMinHeights = computed(() => {
    const eh = props.eventHeight ?? 22;
    const DAYNUM_H = 30; // .cal-month__events top
    const ROW_GAP = 2; // .cal-month__events row-gap
    const PAD_B = 4;
    return rowLayouts.value.map((rl) => {
      const shown = Math.min(rl.laneCount, maxEvents.value);
      const hasMore = rl.overflowByCol.some((o) => o > 0);
      const rows = shown + (hasMore ? 1 : 0);
      const content = DAYNUM_H + rows * eh + Math.max(0, rows - 1) * ROW_GAP + PAD_B;
      const floor = DAYNUM_H + 2 * eh + PAD_B; // 빈/적은 주도 최소 2행 높이 확보
      return Math.max(floor, content);
    });
  });

  /** 해당 날짜에 겹치는 이벤트 목록 (start < day+1 && end > day) — 팝오버 본문용 */
  function eventsByDay(day: Dayjs): CalEvent[] {
    const dayStart = day.startOf('day');
    const dayEnd = day.add(1, 'day').startOf('day');
    return props.events
      .filter((ev) => ev.start.isBefore(dayEnd) && ev.end.isAfter(dayStart))
      .sort(props.eventOrder ?? defaultEventOrder);
  }

  /** 해당 주차에서 오늘 칼럼을 이 세그먼트가 가로지르는지 — 오늘 강조 보더용 */
  function segCrossesToday(seg: DayGridSegment, wi: number): boolean {
    const di = props.weeks[wi].findIndex((d) => d.isSame(props.today, 'day'));
    return di >= 0 && di >= seg.startCol && di <= seg.endCol;
  }

  /** 앵커 월: weeks[2]?.[0]의 month() */
  const anchorMonth = computed(() => props.weeks[2]?.[0]?.month() ?? -1);

  function daynumClass(day: Dayjs): Record<string, boolean> {
    const dow = day.day(); // 0=일, 6=토
    const isSun = dow === 0;
    const isSat = dow === 6;
    const isToday = day.isSame(props.today, 'day');
    const isMuted = day.month() !== anchorMonth.value;

    return {
      'cal--sun': isSun && !isToday,
      'cal--sat': isSat && !isToday,
      'cal--today': isToday,
      'cal--muted': isMuted
    };
  }

  /** today → CSS handles it; muted → let cal--muted class handle grey; weekdayColors → inline color; else no style */
  function dayNumStyle(day: Dayjs): Record<string, string> {
    const isToday = day.isSame(props.today, 'day');
    if (isToday) return {};
    const isMuted = day.month() !== anchorMonth.value;
    if (isMuted) return {};
    const color = props.weekdayColors?.[day.day()];
    return color ? { color } : {};
  }

  // --- Today Focus ---
  const weeksEl = ref<HTMLElement | null>(null);

  function isFocusDay(day: Dayjs): boolean {
    return !!props.todayFocused && day.isSame(props.today, 'day');
  }

  /**
   * 오늘 칸이 이미 다 보이면 스크롤하지 않는다 — 맨 위로 올리면 앞선 주들이 가려진다.
   * 그 경우 강조의 페이드인/아웃 자체가 피드백 역할을 한다.
   */
  function scrollToToday(behavior: ScrollBehavior): void {
    const host = weeksEl.value;
    if (!host) return;
    const key = props.today.format('YYYY-MM-DD');
    const cell = host.querySelector<HTMLElement>(`[data-cal-date="${key}"]`);
    if (!cell) return; // 오늘이 이번 달 그리드에 없음
    const hostRect = host.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    if (cellRect.top >= hostRect.top && cellRect.bottom <= hostRect.bottom) return; // 이미 다 보임
    host.scrollTo({ top: host.scrollTop + (cellRect.top - hostRect.top), behavior });
  }

  useCalTodayFocus(toRef(props, 'focusSeq'), scrollToToday);

  // --- +N Popover ---
  /** 뷰포트 가장자리에서 유지할 최소 여백 */
  const POPOVER_MARGIN = 8;
  /** 앵커(+N 칸)와 팝오버 사이 간격 */
  const POPOVER_GAP = 4;

  const popoverEl = ref<HTMLElement | null>(null);
  const popoverDay = ref<Dayjs | null>(null);
  const popoverStyle = ref<Record<string, string>>({});
  // 반응형일 필요 없음 — 렌더링에 쓰지 않고 위치 계산에만 쓴다
  let popoverAnchor: DOMRect | null = null;

  function openPopover(day: Dayjs, event: MouseEvent) {
    popoverAnchor = (event.currentTarget as HTMLElement).getBoundingClientRect();
    // 측정 전에는 숨긴 채로 렌더 — 없으면 잘못된 위치에 한 프레임 깜빡인다
    popoverStyle.value = { visibility: 'hidden', top: '0px', left: '0px' };
    popoverDay.value = day;
    nextTick(() => positionPopover());
  }

  /** 실제 렌더 크기를 재서 뒤집기·클램프를 결정한다(하드코딩 추정치는 실제 높이와 맞지 않았다) */
  function positionPopover() {
    const box = popoverEl.value?.getBoundingClientRect();
    const a = popoverAnchor;
    if (!box || !a) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 기본: 앵커 왼쪽 정렬. 오른쪽으로 넘치면 뷰포트 안으로 당긴다
    let left = a.left;
    if (left + box.width > vw - POPOVER_MARGIN) left = vw - box.width - POPOVER_MARGIN;
    if (left < POPOVER_MARGIN) left = POPOVER_MARGIN;

    // 기본: 앵커 아래. 아래 공간이 부족하면 앵커 위로 뒤집는다
    let top = a.bottom + POPOVER_GAP;
    if (top + box.height > vh - POPOVER_MARGIN) top = a.top - box.height - POPOVER_GAP;
    if (top < POPOVER_MARGIN) top = POPOVER_MARGIN;

    popoverStyle.value = { top: `${top}px`, left: `${left}px` };
  }

  function closePopover() {
    popoverDay.value = null;
  }

  function onPopoverEventClick(ev: CalEvent) {
    if (ev.interactive === false) return; // 공용설비/휴가/공휴일 등 표시 전용 — 다이얼로그 없음
    emit('eventClick', ev);
    closePopover();
  }

  useCalPopoverDismiss(popoverEl, () => popoverDay.value !== null, closePopover);
</script>

<style scoped>
  /* CSS token fallbacks — parent .cal will override */
  .cal-month {
    --cal-line: #e5e7eb;
    --cal-line-soft: #f1f3f5;
    --cal-ink: #1f2937;
    --cal-muted: #6b7280;
    --cal-sun: #ef4444;
    --cal-sat: #2563eb;

    display: grid;
    grid-template-rows: auto 1fr;
    height: 100%;
    color: var(--cal-ink);
    position: relative; /* 방어적으로 유지 — 현재 절대배치 자식 중 이 컨테이너를 기준으로 삼는 것은 없다 */
  }

  /* Day-of-week header */
  .cal-month__dow {
    display: grid;
    grid-template-columns: repeat(var(--cal-cols, 7), 1fr);
    border-bottom: 1px solid var(--cal-line);
  }

  .cal-month__dow-cell {
    text-align: center;
    font-size: 12px;
    color: var(--cal-muted);
    padding: 8px 0;
  }

  /* Weeks grid */
  .cal-month__weeks {
    display: flex;
    flex-direction: column;
    min-height: 0; /* shrink within the 1fr grid row so it can scroll instead of forcing 6 fixed rows */
    overflow-y: auto;
  }

  .cal-month__week {
    flex: 1 1 0; /* fill evenly when there's slack; inline min-height is the floor → grows + scrolls when busy */
    display: grid;
    grid-template-columns: repeat(var(--cal-cols, 7), 1fr);
    position: relative; /* event overlay (.cal-month__events) resolves against this row */
  }

  /* Spanning event overlay — sits on top of the day cells */
  .cal-month__events {
    position: absolute;
    left: 4px;
    right: 4px;
    top: 30px; /* clears the day-number row (~30px incl. margin-bottom) */
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(var(--cal-cols, 7), 1fr);
    grid-auto-rows: var(--cal-event-height, 22px);
    row-gap: 2px;
    column-gap: 2px;
    pointer-events: none; /* empty space passes clicks through to cells; bars opt back in */
  }

  /* Neutralize the bar's intrinsic top margin so grid rows align cleanly */
  .cal-month__events :deep(.cal-evt) {
    margin-top: 0;
    min-width: 0;
    margin-right: 6px; /* small click strip at the bar's right end (cell stays selectable) */
  }

  /* Drag feedback: dim the bar being dragged */
  .cal-month__events :deep(.is-dragging-bar) {
    opacity: 0.5;
  }

  /* Bars crossing today's column get a highlight ring */
  .cal-month__events :deep(.cal-evt--today) {
    box-shadow: 0 0 0 1px #93c5fd inset;
  }

  /* Cell */
  .cal-month__cell {
    border-right: 1px solid var(--cal-line-soft);
    border-bottom: 1px solid var(--cal-line-soft);
    padding: 4px 6px;
    min-width: 0;
    overflow: visible;
    position: relative;
    cursor: pointer;
  }

  @media (hover: hover) {
    .cal-month__cell:hover {
      background: #fafbfc;
    }
  }

  .cal-month__cell::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: var(--cal-today-focus-bg, color-mix(in srgb, var(--cal-primary) 18%, transparent));
    opacity: 0;
    transition: opacity 500ms ease;
  }
  .cal-month__cell--focus::after {
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .cal-month__cell::after {
      transition: none;
    }
  }

  /* Today cell tint — subtle; placed before drop/sel/hover overrides so they win when active */
  .cal-month__cell--today {
    background: #f5f9ff;
  }

  /* Drag-select range highlight — doubled specificity beats :hover */
  .cal-month__cell.cal-month__cell--sel {
    background: #dbeafe;
  }

  /* Drop target highlight while dragging an event over a day cell */
  .cal-month__cell--drop {
    background: #eff6ff;
  }

  /* Single-day timed events: dot + time + title row */
  .cal-month__dot-row {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-right: 6px; /* small click strip on the right (cell stays selectable) */
    padding: 0 4px;
    height: var(--cal-event-height, 22px);
    cursor: pointer;
    border-radius: 5px;
    overflow: hidden;
  }
  .cal-month__dot-row--static {
    cursor: default;
  }

  @media (hover: hover) {
    .cal-month__dot-row:hover:not(.cal-month__dot-row--static) {
      background: #f3f4f6;
    }
  }

  .cal-month__dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    flex: none;
  }

  .cal-month__dot-time {
    font-size: 12px;
    color: var(--cal-muted);
    flex: none;
  }

  .cal-month__dot-title {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--cal-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Today's dot-rows get a border (month-view only) */
  .cal-month__dot-row--today {
    border: 1px solid #bfdbfe;
  }

  /* Day number chip */
  .cal-month__daynum {
    font-size: 15px;
    color: var(--cal-ink);
    display: inline-flex;
    min-width: 20px;
    height: 20px;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    margin-bottom: 6px;
  }

  .cal-month__daynum.cal--sun {
    color: var(--cal-sun);
  }

  .cal-month__daynum.cal--sat {
    color: var(--cal-sat);
  }

  .cal-month__daynum.cal--muted {
    color: #c4c8ce;
  }

  .cal-month__daynum.cal--today {
    background: var(--cal-primary, #2563eb);
    color: #fff;
    font-weight: 700;
    font-size: 13px;
  }

  /* +N 더보기 */
  .cal-month__more {
    font-size: 12px;
    color: var(--cal-muted);
    cursor: pointer;
    padding-left: 2px;
    pointer-events: auto;
    display: flex;
    align-items: center;
  }

  @media (hover: hover) {
    .cal-month__more:hover {
      text-decoration: underline;
    }
  }

  /* Popover */
  .cal-month__popover {
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
    width: 220px;
    background: #fff;
    border: 1px solid var(--cal-line);
    border-radius: 10px;
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.12),
      0 1px 4px rgba(0, 0, 0, 0.07);
    padding: 10px 0 6px;
    pointer-events: auto;
  }

  .cal-month__popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px 8px;
    border-bottom: 1px solid var(--cal-line-soft);
  }

  .cal-month__popover-date {
    font-size: 13px;
    font-weight: 600;
    color: var(--cal-ink);
  }

  .cal-month__popover-close {
    background: none;
    border: none;
    font-size: 16px;
    line-height: 1;
    color: var(--cal-muted);
    cursor: pointer;
    padding: 0 2px;
  }

  .cal-month__popover-close:hover {
    color: var(--cal-ink);
  }

  .cal-month__popover-events {
    padding: 4px 0;
    max-height: 240px;
    overflow-y: auto;
  }

  .cal-month__popover-row {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 5px 12px;
    cursor: pointer;
    border-radius: 6px;
    margin: 1px 4px;
    font-size: 13px;
    color: var(--cal-ink);
    transition: background 0.1s;
  }

  @media (hover: hover) {
    .cal-month__popover-row:hover {
      background: #f3f4f6;
    }
  }

  .cal-month__popover-row--static {
    cursor: default;
  }

  .cal-month__popover-row--static:hover {
    background: transparent;
  }

  .cal-month__popover-dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .cal-month__popover-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cal-month__popover-time {
    font-size: 12px;
    color: var(--cal-muted);
    flex-shrink: 0;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .cal-month__cell {
      padding: 2px 3px;
    }
  }
</style>
