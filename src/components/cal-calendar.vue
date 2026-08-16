<template>
  <div class="cal" :style="rootStyle">
    <div class="cal-toolbar">
      <button class="cal-btn" @click="today">{{ messages.today }}</button>
      <button class="cal-iconbtn" @click="prev" :aria-label="messages.prev">‹</button>
      <button class="cal-iconbtn" @click="next" :aria-label="messages.next">›</button>
      <span class="cal-title">{{ title }}</span>
      <span class="cal-spacer" />
      <span class="cal-pills" ref="pillsEl">
        <span class="cal-pill-indicator" :style="indicatorStyle" />
        <button
          class="cal-pill"
          v-for="v in views"
          :class="{ 'cal-pill--active': view === v.key }"
          :key="v.key"
          @click="setView(v.key)">
          {{ v.label }}
        </button>
      </span>
    </div>
    <div class="cal-host" @mouseleave="tip.hide()" ref="host">
      <div class="cal-loadbar" v-if="loading" aria-hidden="true" />
      <cal-tooltip :fields="opts.tooltipFields">
        <template v-if="$slots.tooltip" #default="slotProps">
          <slot name="tooltip" v-bind="slotProps" />
        </template>
      </cal-tooltip>
      <cal-drag-ghost />
      <div
        class="cal-swipe"
        :class="{ 'cal-swipe--dragging': isSwiping && isTouch() }"
        :style="{ transform: `translateX(${dragOffset}px)` }">
        <cal-month-view
          v-if="view === 'month'"
          :day-max-events="opts.dayMaxEvents"
          :editable="opts.editable"
          :event-height="opts.eventHeight"
          :event-order="opts.eventOrder"
          :events="normalized"
          :first-day="firstDay"
          :focus-seq="focusSeq"
          :resizable="opts.resizable"
          :selectable="opts.selectable"
          :today="todayDate"
          :today-focused="todayFocused"
          :weekday-colors="opts.weekdayColors"
          :weeks="weeks"
          @event-click="(e) => emit('eventClick', e)"
          @event-move="(p) => emit('eventMove', p)"
          @event-resize="(p) => emit('eventResize', p)"
          @select="(r) => emit('select', r)" />
        <cal-list-view
          v-else-if="view === 'list'"
          :event-order="opts.eventOrder"
          :events="normalized"
          :focus-seq="focusSeq"
          :range="range"
          :today="todayDate"
          :today-focused="todayFocused"
          @event-click="(e) => emit('eventClick', e)" />
        <cal-time-grid
          v-else-if="view === 'week' || view === 'day'"
          :business-hours="opts.businessHours"
          :days="days"
          :editable="opts.editable"
          :event-order="opts.eventOrder"
          :events="normalized"
          :focus-seq="focusSeq"
          :now-indicator="opts.nowIndicator"
          :resizable="opts.resizable"
          :scroll-time="opts.scrollTime"
          :selectable="opts.selectable"
          :slot-event-overlap="opts.slotEventOverlap"
          :slot-max-time="opts.slotMaxTime"
          :slot-min-time="opts.slotMinTime"
          :today="todayDate"
          :today-focused="todayFocused"
          :weekday-colors="opts.weekdayColors"
          @event-click="(e) => emit('eventClick', e)"
          @event-move="(p) => emit('eventMove', p)"
          @event-resize="(p) => emit('eventResize', p)"
          @select="(r) => emit('select', r)" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import type { Dayjs } from 'dayjs';
  import type { CalEvent, CalEventChange, CalEventInput, CalOptions, CalRange, CalView } from '../types';
  import { useCalendarGrid } from '../composables/use-calendar-grid';
  import { normalizeEvent } from '../normalize';
  import { provideCalTooltip } from '../composables/use-cal-tooltip';
  import { isTouch } from '../composables/use-cal-device';
  import { resolveMessages } from '../i18n/messages';
  import { CAL_I18N } from '../composables/use-cal-i18n';

  const props = withDefaults(
    defineProps<{ events?: CalEventInput[]; options?: Partial<CalOptions>; loading?: boolean }>(),
    {
      events: () => []
    }
  );
  const view = defineModel<CalView>('view', { default: 'month' });
  const date = defineModel<string>('date', { default: () => dayjs().toISOString() });
  const emit = defineEmits<{
    rangeChange: [CalRange];
    eventClick: [CalEvent];
    select: [{ start: Dayjs; end: Dayjs; allDay: boolean }];
    eventMove: [CalEventChange];
    eventResize: [CalEventChange];
  }>();

  /** 툴팁 내용 전체를 대체한다. 미지정 시 tooltipFields 기반 기본 툴팁이 렌더링된다. */
  defineSlots<{ tooltip?(props: { event: CalEvent }): unknown }>();

  const DEFAULT_CAL_OPTIONS: CalOptions = {
    views: ['day', 'week', 'month', 'list'],
    locale: 'ko',
    primaryColor: '#1976d2',
    firstDay: 0,
    weekends: true,
    weekdayColors: { 0: '#ef4444', 6: '#2563eb' },
    showTooltip: true,
    tooltipFields: ['creator', 'start', 'end', 'description'],
    businessHours: { daysOfWeek: [1, 2, 3, 4, 5], startTime: '00:00', endTime: '24:00' },
    slotMinTime: '00:00',
    slotMaxTime: '24:00',
    slotDuration: '01:00',
    scrollTime: '07:00',
    nowIndicator: true,
    slotEventOverlap: true,
    selectable: true,
    editable: true,
    resizable: true,
    eventHeight: 24,
    dayMaxEvents: false
  };
  const opts = computed<CalOptions>(() => ({ ...DEFAULT_CAL_OPTIONS, ...props.options }));
  const primaryColor = computed(() => opts.value.primaryColor);
  const messages = computed(() => resolveMessages(opts.value.locale, opts.value.messages));
  provide(CAL_I18N, messages);
  const rootStyle = computed(() => {
    const [sh, sm] = (opts.value.slotDuration || '01:00').split(':').map(Number);
    const slotMin = (sh || 0) * 60 + (sm || 0);
    const slotH = slotMin > 0 ? (slotMin / 60) * 48 : 48;
    return {
      '--cal-event-height': `${opts.value.eventHeight}px`,
      '--cal-slot-h': `${slotH}px`
    };
  });
  const firstDay = computed(() => opts.value.firstDay);
  const weekends = computed(() => opts.value.weekends);

  const host = ref<HTMLElement | null>(null);
  const SWIPE_CAP = 110; // max px the view follows the finger
  const SWIPE_COMMIT = 80; // min px swipe to flip the month
  const { isSwiping, lengthX, coordsStart } = useSwipe(host, {
    threshold: 40,
    onSwipeEnd(_e, direction) {
      if (!isTouch() || coordsStart.x < 24) return; // left edge → let the sidebar drawer open
      if (Math.abs(lengthX.value) < SWIPE_COMMIT) return; // too short → snap back, no change
      if (direction === 'left') next();
      else if (direction === 'right') prev();
    }
  });
  // during a mobile swipe the view follows the finger (damped) so the gesture is felt
  const dragOffset = computed(() => {
    if (!isSwiping.value || !isTouch() || coordsStart.x < 24) return 0;
    return Math.max(-SWIPE_CAP, Math.min(SWIPE_CAP, -lengthX.value * 0.55));
  });

  const tip = provideCalTooltip();
  watch(
    () => opts.value.showTooltip,
    (v) => tip.setEnabled(v),
    { immediate: true }
  );
  watch(view, () => tip.hide());

  const anchor = computed<Dayjs>({ get: () => dayjs(date.value), set: (d) => (date.value = d.toISOString()) });
  // 반응형 now — 1분마다 갱신해 now-라인이 흐르고 자정 넘김(오늘 판정)도 반영. (computed(dayjs())는 고정됨)
  const now = useNow({ interval: 60000 });
  const todayDate = computed(() => dayjs(now.value));

  const { days, weeks, range, title } = useCalendarGrid(view, anchor, firstDay, weekends, messages);
  watch(range, (r) => emit('rangeChange', r), { immediate: true });

  const normalized = computed<CalEvent[]>(() => props.events.map((e) => normalizeEvent(e)));

  const ALL_VIEW_KEYS: CalView[] = ['day', 'week', 'month', 'list'];
  const VIEW_LABEL_KEY: Record<CalView, 'viewDay' | 'viewWeek' | 'viewMonth' | 'viewList'> = {
    day: 'viewDay',
    week: 'viewWeek',
    month: 'viewMonth',
    list: 'viewList'
  };
  const views = computed(() =>
    ALL_VIEW_KEYS.filter((k) => opts.value.views.includes(k)).map((key) => ({
      key,
      label: messages.value[VIEW_LABEL_KEY[key]]
    }))
  );

  function setView(v: CalView) {
    view.value = v;
  }
  function step(dir: number) {
    const unit = view.value === 'day' ? 'day' : view.value === 'week' ? 'week' : 'month';
    anchor.value = anchor.value.add(dir, unit);
  }
  function prev() {
    step(-1);
  }
  function next() {
    step(1);
  }

  /** 강조 유지 시간(ms). 이후 CSS transition으로 0.5초에 걸쳐 사라진다. */
  const FOCUS_HOLD_MS = 2000;

  const todayFocused = ref(false);
  /** 누른 횟수 — 앵커가 그대로여도(이미 오늘이 속한 기간) 매번 올라 각 뷰가 반응한다 */
  const focusSeq = ref(0);

  // start()를 다시 부르면 이전 타이머가 취소되므로 '오늘' 연타에도 마지막 것만 남는다
  const { start: startFocusTimer } = useTimeoutFn(
    () => {
      todayFocused.value = false;
    },
    FOCUS_HOLD_MS,
    { immediate: false }
  );

  function today() {
    anchor.value = dayjs();
    todayFocused.value = true;
    focusSeq.value++;
    startFocusTimer();
  }
  function gotoDate(d: Dayjs) {
    anchor.value = d;
  }

  const pillsEl = ref<HTMLElement | null>(null);
  const indicatorStyle = ref<{ transform: string; width: string; opacity: string }>({
    transform: 'translateX(0)',
    width: '0px',
    opacity: '0'
  });

  function updateIndicator(): void {
    const wrap = pillsEl.value;
    if (!wrap) return;
    const idx = views.value.findIndex((v) => v.key === view.value);
    const el = wrap.querySelectorAll<HTMLElement>('.cal-pill')[idx];
    if (!el) return;
    indicatorStyle.value = { transform: `translateX(${el.offsetLeft}px)`, width: `${el.offsetWidth}px`, opacity: '1' };
  }

  watch(view, async () => {
    await nextTick();
    updateIndicator();
  });
  watch(views, async () => {
    await nextTick();
    updateIndicator();
  });
  onMounted(async () => {
    await nextTick();
    updateIndicator();
  });
  useResizeObserver(pillsEl, () => updateIndicator());

  defineExpose({ prev, next, today, setView, gotoDate });
</script>

<style scoped>
  .cal {
    --cal-line: #e5e7eb;
    --cal-line-soft: #f1f3f5;
    --cal-ink: #1f2937;
    --cal-muted: #6b7280;
    --cal-sun: #ef4444;
    --cal-sat: #2563eb;
    --cal-primary: v-bind(primaryColor);
    --cal-hour-h: 48px;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    color: var(--cal-ink);
    background: #fff;
    font-family:
      'Pretendard',
      'Apple SD Gothic Neo',
      system-ui,
      -apple-system,
      sans-serif;
  }
  .cal-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--cal-line);
    flex-wrap: wrap;
  }
  .cal-title {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.2px;
  }
  .cal-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--cal-line);
    background: #fff;
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 13px;
    cursor: pointer;
    transition:
      background 0.12s,
      transform 0.08s;
  }
  .cal-btn:hover {
    background: #f8fafc;
  }
  .cal-btn:active {
    transform: scale(0.96);
    background: #eef1f5;
  }
  .cal-iconbtn {
    position: relative;
    overflow: hidden;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--cal-ink);
    font-size: 18px;
    transition:
      background 0.12s,
      transform 0.08s;
  }
  .cal-iconbtn:hover {
    background: #f1f5f9;
  }
  .cal-iconbtn:active {
    transform: scale(0.9);
    background: #e8edf3;
  }
  .cal-spacer {
    flex: 1;
  }
  .cal-pills {
    display: inline-flex;
    background: #f3f4f6;
    border-radius: 999px;
    padding: 3px;
    position: relative;
  }
  .cal-pill-indicator {
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: 0;
    border-radius: 999px;
    background: var(--cal-primary);
    box-shadow: 0 1px 4px color-mix(in srgb, var(--cal-primary) 35%, transparent);
    transition:
      transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
      width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 0;
  }
  .cal-pill {
    position: relative;
    z-index: 1;
    border: none;
    background: transparent;
    border-radius: 999px;
    padding: 5px 14px;
    font-size: 13px;
    cursor: pointer;
    color: var(--cal-muted);
  }
  .cal-pill--active {
    color: #fff;
    font-weight: 600;
  }
  .cal-host {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative; /* anchor for the loading bar */
  }
  /* 상단 인디터미넌트 로딩바 — 이벤트 패치 중 표시(네비게이션마다 리로드되므로 화면을 가리지 않는 얇은 바) */
  .cal-loadbar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    overflow: hidden;
    background: color-mix(in srgb, var(--cal-primary) 12%, transparent);
    z-index: 60;
  }
  .cal-loadbar::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 35%;
    border-radius: 0 3px 3px 0;
    background: var(--cal-primary);
    animation: cal-loadbar 1.1s ease-in-out infinite;
  }
  @keyframes cal-loadbar {
    0% {
      left: -35%;
    }
    100% {
      left: 100%;
    }
  }
  /* the view follows the finger during a mobile swipe, then transitions to rest */
  .cal-swipe {
    height: 100%;
    transition: transform 0.25s ease;
  }
  .cal-swipe--dragging {
    transition: none;
  }
  @media (max-width: 600px) {
    .cal-toolbar {
      padding: 8px 10px;
      gap: 6px;
    }
    .cal-title {
      font-size: 15px;
    }
    .cal-btn {
      padding: 6px 10px;
      font-size: 12px;
    }
    .cal-iconbtn {
      width: 28px;
      height: 28px;
      font-size: 16px;
    }
    /* keep the view pills on their own full-width row so wrapping doesn't
       oscillate with the title length (day title is longer than month) */
    .cal-pills {
      flex-basis: 100%;
      margin-top: 4px;
    }
    .cal-pill {
      padding: 4px 10px;
      font-size: 12px;
      flex: 1;
    }
  }
</style>
