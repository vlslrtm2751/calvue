# 그룹웨어 캘린더 동기화 Phase B (오늘 포커스) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** '오늘' 버튼이 오늘로 데려가고 2초간 강조한 뒤 알아서 꺼지게 한다 — 이미 오늘을 보고 있어도 반응한다.

**Architecture:** `cal-calendar.vue`가 `todayFocused`(강조 여부)와 `focusSeq`(누른 횟수) 두 상태를 갖고 세 뷰에 prop으로 내린다. 카운터를 쓰는 이유는 이미 오늘이 속한 기간을 보고 있으면 앵커가 바뀌지 않아 **어떤 반응형 의존성도 건드려지지 않기** 때문이다. 강조는 `useTimeoutFn`으로 2초 뒤 꺼지고, CSS `opacity` transition으로 0.5초에 걸쳐 사라진다. 스크롤 정책은 뷰마다 다르므로 각 뷰가 갖고, 공통 부분(엣지 감지 + `nextTick` + 모션 정책)만 컴포저블로 뺀다.

**Tech Stack:** Vue 3 `<script setup>` + TypeScript, dayjs, `@vueuse/core`(unplugin-auto-import로 자동 임포트 — `ref`/`computed`/`watch`/`nextTick`/`useTimeoutFn` 등은 import문 없이 씀), Vite.

**Spec:** [docs/superpowers/specs/2026-08-16-groupware-sync-phase-b-design.md](../specs/2026-08-16-groupware-sync-phase-b-design.md)

## Global Constraints

- 브랜치: `groupware-sync-phase-b`(이미 `main`에서 checkout됨) — 새 브랜치 만들지 말 것.
- 패키지 매니저: **yarn만** 사용. `npm install` 금지.
- 새 런타임 의존성 추가 금지 — peerDependencies는 `vue`/`dayjs`/`@vueuse/core`뿐.
- **강조를 끄는 로직을 만들지 말 것.** 타이머 외에 `clearTodayFocus()`류의 해제 지점을 추가하지 않는다(스펙의 핵심 결정). 업스트림이 10곳에 열거했다가 빠뜨린 조건을 나중에 메운 패턴을 반복하지 않는다.
- **`clusterOpen`/`moreOpen` emit을 만들지 말 것.** 해제 로직이 없으므로 존재 이유가 없다.
- 공개 API 추가는 **CSS 변수 `--cal-today-focus-bg` 하나와 i18n 키 `noEventsOnDay` 하나뿐.** 옵션·emit 추가 금지.
- **CSS 변수는 `var(--cal-today-focus-bg, <기본값>)` 형태로 사용처에서 읽는다.** `.cal`에 선언하면 소비자가 상위 요소에서 덮어쓸 수 없다(Phase C의 `--cal-popover-z`와 같은 이유).
- 검증: vitest 없음(도입은 범위 밖). 태스크마다 `yarn typecheck`, 마지막 태스크에서 `yarn build` + `yarn play` 렌더 QA.
- 커밋: 태스크당 커밋 하나, **영어** 커밋 메시지, `git commit -m "..." -- <파일>` pathspec 형식.
- 빌드 후 `auto-imports.d.ts`/`components.d.ts`가 수정된 것처럼 보이면 줄바꿈(LF/CRLF)만 다른 노이즈이므로 `git checkout -- <파일>`로 되돌린다. 커밋에 포함하지 말 것.

## 공통 패턴 — 포커스 오버레이

세 뷰가 **같은 CSS 패턴**을 쓴다. 각 태스크에서 선택자만 바꿔 반복한다.

```css
  .X::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: var(--cal-today-focus-bg, color-mix(in srgb, var(--cal-primary) 18%, transparent));
    opacity: 0;
    transition: opacity 500ms ease;
  }
  .X--focus::after {
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .X::after {
      transition: none;
    }
  }
```

**왜 배경색 전환이 아니라 별도 오버레이인가**: 요소의 `background-color`에 transition을 걸면 hover·오늘·드롭 배경까지 0.5초에 걸쳐 바뀌어 굼뜨게 느껴진다. 오버레이는 포커스만 페이드하고 나머지 상태에 영향을 주지 않는다.

**왜 `var(--cal-today-focus-bg, ...)` 형태인가**: 기본값을 `.cal`에 선언해버리면 소비자가 상위 요소에 변수를 설정해도 우리 선언이 이겨서 무시된다. 사용처에서 fallback으로 읽어야 소비자 오버라이드가 동작한다.

**주의**: `::after`는 요소 내용 **위에** 그려진다. 18% 알파라 글자 가독성에는 문제가 없지만, QA에서 지나치게 흐려 보이면 알파를 낮춘다.

---

### Task 1: 상태 + 공용 컴포저블

**Files:**
- Create: `src/composables/use-cal-today-focus.ts`
- Modify: `src/components/cal-calendar.vue`

**Interfaces:**
- Produces:
  - `useCalTodayFocus(seq: Ref<number | undefined>, scrollToToday: (behavior: ScrollBehavior) => void): void` — 각 뷰가 호출
  - `cal-calendar.vue`가 세 뷰에 내리는 prop: `todayFocused?: boolean`, `focusSeq?: number`
- Consumes: 기존 `today()` 함수, `useTimeoutFn`(`@vueuse/core`, 자동 임포트)

이 태스크만으로는 화면에 보이는 변화가 없다. 상태가 만들어져 뷰까지 흘러가고 typecheck이 통과하는 것이 산출물이다.

- [ ] **Step 1: `src/composables/use-cal-today-focus.ts` 생성**

```ts
import type { Ref } from 'vue';

/**
 * '오늘' 버튼 스크롤 신호 — seq가 오를 때마다 뷰가 자기 정책대로 오늘 위치로 스크롤한다.
 *
 * seq(누른 횟수)를 신호로 쓰는 이유: 이미 오늘이 속한 기간을 보고 있으면 앵커가 그대로라
 * days/weeks/range 어느 것도 바뀌지 않고, 따라서 관찰할 반응형 의존성이 아예 없다.
 * 카운터는 값과 무관하게 매번 엣지를 만든다.
 *
 * nextTick을 거치는 이유: 앵커가 바뀐 경우 그리드가 다시 그려지므로, 그 전에 측정하면 옛 위치가 나온다.
 */
export function useCalTodayFocus(seq: Ref<number | undefined>, scrollToToday: (behavior: ScrollBehavior) => void): void {
  watch(seq, async (next, prev) => {
    if (next == null || next === prev) return;
    await nextTick();
    scrollToToday(prefersReducedMotion() ? 'auto' : 'smooth');
  });
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false; // SSR 안전
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
```

- [ ] **Step 2: `cal-calendar.vue` — 상태와 타이머 추가**

`function today()` 정의 바로 위(`src/components/cal-calendar.vue:211` 부근)에 추가한다.

Before:
```ts
  function today() {
    anchor.value = dayjs();
  }
```

After:
```ts
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
```

(`ref`·`useTimeoutFn`은 자동 임포트된다 — 이 저장소는 `unplugin-auto-import`를 쓴다.)

- [ ] **Step 3: `cal-calendar.vue` — 월 뷰에 prop 전달**

Before (`src/components/cal-calendar.vue:33-40` 부근):
```html
        <cal-month-view
          v-if="view === 'month'"
          :day-max-events="opts.dayMaxEvents"
          :editable="opts.editable"
          :event-height="opts.eventHeight"
          :event-order="opts.eventOrder"
          :events="normalized"
          :first-day="firstDay"
```

After:
```html
        <cal-month-view
          v-if="view === 'month'"
          :day-max-events="opts.dayMaxEvents"
          :editable="opts.editable"
          :event-height="opts.eventHeight"
          :event-order="opts.eventOrder"
          :events="normalized"
          :first-day="firstDay"
          :focus-seq="focusSeq"
          :today-focused="todayFocused"
```

- [ ] **Step 4: `cal-calendar.vue` — 목록 뷰에 prop 전달**

목록 뷰는 `today`도 받지 않고 있다. 함께 넘긴다(Task 2에서 쓴다).

Before:
```html
        <cal-list-view
          v-else-if="view === 'list'"
          :event-order="opts.eventOrder"
          :events="normalized"
          :range="range"
          @event-click="(e) => emit('eventClick', e)" />
```

After:
```html
        <cal-list-view
          v-else-if="view === 'list'"
          :event-order="opts.eventOrder"
          :events="normalized"
          :focus-seq="focusSeq"
          :range="range"
          :today="todayDate"
          :today-focused="todayFocused"
          @event-click="(e) => emit('eventClick', e)" />
```

- [ ] **Step 5: `cal-calendar.vue` — 주/일 뷰에 prop 전달**

Before:
```html
        <cal-time-grid
          v-else-if="view === 'week' || view === 'day'"
          :business-hours="opts.businessHours"
          :days="days"
          :editable="opts.editable"
          :event-order="opts.eventOrder"
          :events="normalized"
          :now-indicator="opts.nowIndicator"
```

After:
```html
        <cal-time-grid
          v-else-if="view === 'week' || view === 'day'"
          :business-hours="opts.businessHours"
          :days="days"
          :editable="opts.editable"
          :event-order="opts.eventOrder"
          :events="normalized"
          :focus-seq="focusSeq"
          :now-indicator="opts.nowIndicator"
          :today-focused="todayFocused"
```

- [ ] **Step 6: typecheck**

Run: `yarn typecheck`
Expected: 에러 없이 통과. (세 뷰가 아직 이 prop들을 선언하지 않았지만, Vue는 선언되지 않은 prop을 fallthrough attribute로 처리하므로 타입 에러가 나지 않는다. Task 2~4에서 각 뷰가 선언한다.)

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(today-focus): add focus state and the shared scroll-signal composable" -- src/composables/use-cal-today-focus.ts src/components/cal-calendar.vue
```

---

### Task 2: 목록 뷰 — 오늘로 스크롤 (이 기능의 핵심)

**Files:**
- Modify: `src/types.ts`
- Modify: `src/i18n/messages.ts`
- Modify: `src/components/internal/cal-list-view.vue`

**Interfaces:**
- Consumes: Task 1의 `useCalTodayFocus`, prop `todayFocused`/`focusSeq`/`today`
- Produces: i18n 키 `CalMessages.noEventsOnDay: string`

스펙 기준 **이 기능의 원래 존재 이유**가 목록 뷰 내비게이션이다. 판단이 갈리면 목록 뷰를 우선한다.

현재 목록 뷰는 `if (dayEvents.length > 0)`으로 일정 없는 날을 걸러내므로, 오늘 일정이 없으면 강조할 대상도 스크롤할 대상도 없다.

- [ ] **Step 1: `src/types.ts` — i18n 키 추가**

`CalMessages`의 `noEvents` 바로 아래(`src/types.ts:49` 부근)에 추가한다.

Before:
```ts
  noEvents: string;
  todaySuffix: string;
```

After:
```ts
  noEvents: string;
  /** 오늘 행에 일정이 하나도 없을 때 표시. 기간 전체가 빈 `noEvents`와는 다른 문구다 */
  noEventsOnDay: string;
  todaySuffix: string;
```

- [ ] **Step 2: `src/i18n/messages.ts` — ko/en 값 추가**

ko 카탈로그, `noEvents` 바로 아래:
```ts
  noEventsOnDay: '일정 없음',
```

en 카탈로그, `noEvents` 바로 아래:
```ts
  noEventsOnDay: 'No events',
```

- [ ] **Step 3: `cal-list-view.vue` — props 확장**

Before (`src/components/internal/cal-list-view.vue:34`):
```ts
  const props = defineProps<{ events: CalEvent[]; range: CalRange; eventOrder?: EventOrder }>();
```

After:
```ts
  const props = defineProps<{
    events: CalEvent[];
    range: CalRange;
    today: Dayjs;
    eventOrder?: EventOrder;
    todayFocused?: boolean;
    focusSeq?: number;
  }>();
```

`today`를 prop으로 받는 이유: 지금은 `groupedByDay` 안에서 `dayjs()`로 계산해 **반응형이 아니다.** 자정을 넘겨도 갱신되지 않는 잠재 버그가 이미 있고, prop으로 바꾸면 함께 해결된다.

- [ ] **Step 4: `cal-list-view.vue` — 오늘 행을 항상 렌더링**

Before (`groupedByDay` computed 내부):
```ts
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
```

After:
```ts
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
```

그리고 같은 블록 안의 `isToday` 계산을 새 변수로 바꾼다.

Before:
```ts
          isToday: cursor.isSame(today, 'day'),
```

After:
```ts
          isToday,
```

- [ ] **Step 5: `cal-list-view.vue` — 템플릿: `data-cal-date`, 포커스 클래스, 빈 오늘 문구**

Before (`src/components/internal/cal-list-view.vue:5-22`):
```html
      <div class="list-day">
        <div class="list-date" :class="{ 'list-date--today': group.isToday }">
          <span class="big">{{ group.dayNum }}</span>
          {{ group.weekday }}<template v-if="group.isToday"> · {{ m.todaySuffix }}</template>
        </div>
        <div class="list-evts">
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
```

After:
```html
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
```

- [ ] **Step 6: `cal-list-view.vue` — 스크롤 컨테이너 ref와 스크롤 구현**

`<script setup>` 안, `groupedByDay` computed 다음에 추가한다.

```ts
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
```

import를 추가한다:
```ts
  import { useCalTodayFocus } from '../../composables/use-cal-today-focus';
```

(`ref`·`toRef`는 자동 임포트된다.)

- [ ] **Step 7: `cal-list-view.vue` — 루트에 ref 연결**

Before:
```html
  <div class="list">
```

After:
```html
  <div class="list" ref="listEl">
```

- [ ] **Step 8: `cal-list-view.vue` — CSS**

`.list-day`에는 `position: relative`가 **없다**(확인됨). 오버레이의 `inset: 0`이 이 요소를 기준으로 잡히도록 먼저 추가한다.

Before (`src/components/internal/cal-list-view.vue:94-101`):
```css
  .list-day {
    display: grid;
    /* minmax(0, 1fr): auto 최소값(=제목 폭)이 남으면 트랙이 제목 길이만큼 늘어나 가로 스크롤이 생긴다 */
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--cal-line-soft);
  }
```

After:
```css
  .list-day {
    position: relative; /* 포커스 오버레이(::after)의 기준 */
    display: grid;
    /* minmax(0, 1fr): auto 최소값(=제목 폭)이 남으면 트랙이 제목 길이만큼 늘어나 가로 스크롤이 생긴다 */
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--cal-line-soft);
  }
```

그리고 `.list-day` 규칙 다음에 추가:
```css
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
```

- [ ] **Step 9: typecheck**

Run: `yarn typecheck`
Expected: 에러 없이 통과.

- [ ] **Step 10: Commit**

```bash
git commit -m "feat(list-view): scroll to today and highlight it on the Today button" -- src/types.ts src/i18n/messages.ts src/components/internal/cal-list-view.vue
```

---

### Task 3: 월 뷰 — 오늘 칸 강조 + 조건부 스크롤

**Files:**
- Modify: `src/components/internal/cal-month-view.vue`

**Interfaces:**
- Consumes: Task 1의 `useCalTodayFocus`, prop `todayFocused`/`focusSeq`, 기존 prop `today`

`.cal-month__cell`은 이미 `position: relative`이고 `::after`를 쓰지 않는다(확인됨).

- [ ] **Step 1: props 확장**

Before (`src/components/internal/cal-month-view.vue:150` 부근):
```ts
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
  }>();
```

After:
```ts
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
```

- [ ] **Step 2: 템플릿 — 셀에 포커스 클래스**

Before:
```html
          :class="{
            'cal-month__cell--drop': inDropPreview(day),
            'cal-month__cell--sel': isInSelection(day),
            'cal-month__cell--today': day.isSame(today, 'day')
          }"
```

After:
```html
          :class="{
            'cal-month__cell--drop': inDropPreview(day),
            'cal-month__cell--sel': isInSelection(day),
            'cal-month__cell--today': day.isSame(today, 'day'),
            'cal-month__cell--focus': isFocusDay(day)
          }"
```

- [ ] **Step 3: 템플릿 — 주 컨테이너에 ref**

Before:
```html
    <div class="cal-month__weeks">
```

After:
```html
    <div class="cal-month__weeks" ref="weeksEl">
```

- [ ] **Step 4: 스크립트 — 스크롤 구현**

`<script setup>` 안, 기존 `const popoverEl = ...` 등 ref 선언부 근처에 추가한다.

```ts
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
```

import를 추가한다:
```ts
  import { useCalTodayFocus } from '../../composables/use-cal-today-focus';
```

- [ ] **Step 5: CSS — 포커스 오버레이**

`.cal-month__cell` 규칙 다음에 추가한다.

```css
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
```

- [ ] **Step 6: typecheck**

Run: `yarn typecheck`
Expected: 에러 없이 통과.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(month-view): highlight today and scroll to it when off-screen" -- src/components/internal/cal-month-view.vue
```

---

### Task 4: 주/일 뷰 — 오늘 컬럼 강조 + 현재 시각으로 스크롤

**Files:**
- Modify: `src/components/internal/cal-time-grid.vue`

**Interfaces:**
- Consumes: Task 1의 `useCalTodayFocus`, prop `todayFocused`/`focusSeq`, 기존 `today`/`nowMin`/`timeWindow`/`scrollEl`/`HOUR_H_PX`

- [ ] **Step 1: props 확장**

`const props = defineProps<{ ... }>()` 안, `today: Dayjs;` 다음에 두 줄 추가한다:
```ts
    todayFocused?: boolean;
    focusSeq?: number;
```

- [ ] **Step 2: 헤더 날짜 칸 — 템플릿 수정 없음**

헤더는 `:class="dayHeadClass(day)"`로 클래스를 받으므로 **템플릿은 건드리지 않는다.** 함수만 Step 4에서 고친다. 이 스텝은 확인용이다 — 템플릿을 찾아 고치려 하지 말 것.

- [ ] **Step 3: 템플릿 — 본문 컬럼에 포커스 클래스**

Before:
```html
        <div
          class="tg-col"
          v-for="day in days"
          :class="{ 'tg-col--biz': isBizDay(day) }"
```

After:
```html
        <div
          class="tg-col"
          v-for="day in days"
          :class="{ 'tg-col--biz': isBizDay(day), 'tg-col--focus': isFocusDay(day) }"
```

- [ ] **Step 4: 스크립트 — `isFocusDay`, `dayHeadClass` 수정, 스크롤 구현**

Before (`dayHeadClass`, `src/components/internal/cal-time-grid.vue:398` 부근):
```ts
  function dayHeadClass(day: Dayjs): Record<string, boolean> {
    return {
      'tg-dcol--today': day.isSame(props.today, 'day'),
      'tg-dcol--sun': day.day() === 0,
      'tg-dcol--sat': day.day() === 6
    };
  }
```

After:
```ts
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
```

import를 추가한다:
```ts
  import { useCalTodayFocus } from '../../composables/use-cal-today-focus';
```

- [ ] **Step 5: CSS — 헤더·본문 포커스 오버레이**

확인 결과 **`.tg-col`에는 이미 `position: relative`가 있고(`:566`), `.tg-dcol`에는 없다(`:463-467`).** `.tg-dcol`에만 추가한다 — `.tg-col`은 건드리지 말 것.

Before:
```css
  .tg-dcol {
    text-align: center;
    padding: 6px 0;
    border-right: 1px solid var(--cal-line-soft);
  }
```

After:
```css
  .tg-dcol {
    position: relative; /* 포커스 오버레이(::after)의 기준 */
    text-align: center;
    padding: 6px 0;
    border-right: 1px solid var(--cal-line-soft);
  }
```

그 다음 오버레이를 붙인다.

```css
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
```

- [ ] **Step 6: 종일 행 — 실제 증상을 보고 판단한다**

`yarn play`로 주 뷰를 열고 '오늘'을 눌러 **헤더와 본문 사이의 종일 행에서 강조 밴드가 끊겨 보이는지** 확인한다.

- **끊겨 보이지 않으면**: 아무것도 하지 않는다. 이 스텝을 건너뛴다.
- **끊겨 보이면**: 종일 행 셀(`.tg-allday__cell`)이 드래그 드롭 대상이라 `inset`·`gap`·`border-radius`를 갖고 있어 각진 헤더·본문 밴드와 폭이 맞지 않는 것이다. 그 경우 `.tg-allday__grid` 안에 `pointer-events: none`인 배경 레이어를 **드롭 레이어보다 먼저** 넣고, 같은 `allDayGridStyle`을 적용해 컬럼 경계를 일치시킨다:

```html
        <div class="tg-allday__bg" :style="allDayGridStyle" aria-hidden="true">
          <div
            v-for="day in days"
            :class="{ 'tg-allday__bg-cell--focus': isFocusDay(day) }"
            :key="day.format('YYYY-MM-DD')" />
        </div>
```

```css
  .tg-allday__bg {
    position: absolute;
    inset: 0;
    display: grid;
    z-index: 0;
    pointer-events: none;
  }
  .tg-allday__bg > div {
    position: relative;
  }
  .tg-allday__bg-cell--focus::after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--cal-today-focus-bg, color-mix(in srgb, var(--cal-primary) 18%, transparent));
    opacity: 1;
    transition: opacity 500ms ease;
  }
```

**어느 쪽을 택했는지 보고서에 반드시 적는다.** 스펙이 "구현 중 실제 증상을 보고 판단한다"로 남겨둔 유일한 항목이다.

- [ ] **Step 7: typecheck**

Run: `yarn typecheck`
Expected: 에러 없이 통과.

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(time-grid): highlight today's column and center the current time" -- src/components/internal/cal-time-grid.vue
```

---

### Task 5: 검증 — 플레이그라운드 QA + 최종 빌드

**Files:**
- Temporarily modify (커밋 안 함, 확인 후 되돌림): `playground/main.ts`

vitest가 없으므로 이 태스크가 최종 게이트다. **이번 기능은 타이밍·스크롤·시각 효과라 typecheck으로 잡히는 게 거의 없다** — Phase C에서 발견된 회귀 두 건이 모두 런타임 동작이었고 실제 브라우저에서만 드러났다.

- [ ] **Step 1: 조건 성립을 먼저 증명한다는 원칙**

Phase C에서 **세 번** "통과/실패"가 사실은 조건 미성립이었다(컨테이너가 넘치지 않아 스크롤 이벤트가 없었음, 아래 공간이 남아 뒤집을 이유가 없었음, QA 이벤트가 다른 날에 있어 목록이 넘치지 않았음).

각 검증에서 **조건이 실제로 성립했는지 먼저 확인**한다:
- 스크롤 검증 → `scrollTop`이 실제로 변했는가
- "이미 보이면 스크롤 안 함" 검증 → 정말 다 보이는 상태였는가
- 목록 스크롤 검증 → 목록이 실제로 넘쳤는가(`scrollHeight > clientHeight`)

조건이 성립하지 않은 결과는 통과로 세지 않는다.

- [ ] **Step 2: playground/main.ts에 QA용 설정 임시 추가**

목록 뷰 스크롤을 검증하려면 오늘 앞뒤로 일정이 많아야 한다. `events` 배열 끝에 추가한다(`M`은 파일에 이미 정의된 "이번 달" 상수):

```ts
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `qa${i}`,
        title: `QA 일정 ${i}`,
        start: `${M}-${String((i % 28) + 1).padStart(2, '0')}T10:00:00`,
        end: `${M}-${String((i % 28) + 1).padStart(2, '0')}T11:00:00`,
        color: '#0ea5e9'
      }))
```

- [ ] **Step 3: 플레이그라운드 실행**

Run: `yarn play --port 5220`

**포트가 점유돼 있으면 Vite가 다른 포트로 옮긴다.** 출력에 찍힌 실제 포트를 확인하고 그 포트로 접속한다 — Phase C에서 요청한 포트로 접속했다가 다른 서버에 붙어 QA가 무의미해진 적이 있다.

- [ ] **Step 4: "이미 오늘을 보고 있을 때" 확인 — 이 기능의 존재 이유**

4개 뷰(`?view=month`, `week`, `day`, `list`) 각각에서, **화면을 그대로 둔 채**(앵커가 안 바뀌는 상태) '오늘' 버튼을 누른다.

- 강조가 켜지는가
- 뷰별 스크롤 정책대로 움직이는가(월은 안 움직일 수 있음 — Step 7 참조)

이게 안 되면 나머지는 볼 필요가 없다. `focusSeq` 카운터가 존재하는 이유가 정확히 이 케이스다.

- [ ] **Step 5: 자동 소멸 확인**

'오늘'을 누른 뒤 3초를 기다린다. 강조가 사라지는가.

**내부 상태가 아니라 computed style로 확인한다** — 오버레이 `::after`의 `opacity`가 `1` → `0`이 되는지. (`getComputedStyle(el, '::after').opacity`)

- [ ] **Step 6: 연타 확인**

'오늘'을 0.5초 간격으로 두 번 누르고, 마지막 클릭 기준 2초 뒤에 꺼지는지 확인한다(첫 클릭 기준 2초에 꺼지면 타이머가 겹친 것이다).

- [ ] **Step 7: 뷰별 스크롤 정책 확인**

**목록 뷰** — 오늘 행이 sticky 월 헤더에 가리지 않고 컨테이너 맨 위에 오는가. `scrollTop`이 실제로 변했는지 확인한다. **오늘 일정이 0개인 상태**(QA 일정에서 오늘 날짜를 빼고)에서도 행이 있고 "일정 없음"이 보이고 스크롤되는가.

**주/일 뷰** — 현재 시각이 세로 중앙 근처에 오는가. 스크롤 전후 `scrollTop`을 비교한다.

**주/일 뷰 + 창 밖 케이스** — `slotMinTime`을 현재 시각보다 **늦게** 설정하고(예: 지금이 14시면 `'16:00'`) '오늘'을 누른다. 창 밖으로 스크롤되지 않고 창 맨 위에서 멈추는가.

**월 뷰(이미 보임)** — 큰 뷰포트에서 오늘이 다 보이는 상태로 '오늘'을 누른다. `scrollTop`이 **변하지 않아야** 한다. 강조만 켜지는 게 의도된 동작이다.

**월 뷰(안 보임)** — 뷰포트 높이를 줄여 `.cal-month__weeks`가 넘치게 하고 오늘이 화면 밖으로 가도록 스크롤한 뒤 '오늘'을 누른다. 이번엔 `scrollTop`이 변해야 한다.

- [ ] **Step 8: 종일 행 밴드 확인**

주 뷰에서 '오늘'을 눌러 헤더 → 종일 행 → 본문으로 이어지는 강조가 **끊기지 않고 한 줄로 보이는지** 확인한다. Task 4 Step 6의 판단 근거가 된다.

- [ ] **Step 9: 회귀 없음 확인**

'오늘'을 누르지 않은 상태에서 4개 뷰가 v0.3.0과 시각적으로 동일한지 확인한다. 특히 기존 상시 '오늘' 스타일(월 셀 배경, 목록의 "· 오늘", 주/일 헤더 날짜 색)이 그대로인가.

- [ ] **Step 10: CSS 변수 오버라이드 확인**

개발자도구에서 `:root`에 `--cal-today-focus-bg: rgba(255,0,0,0.4)`를 주입하고 '오늘'을 누른다. 강조가 빨갛게 나오면 변수가 실제로 반영되는 것이다. 확인 후 되돌린다.

- [ ] **Step 11: 서버 종료 후 임시 변경 되돌리기**

Playground 서버를 중지한 뒤:

```bash
git checkout -- playground/main.ts
```

- [ ] **Step 12: 최종 빌드**

Run: `yarn typecheck && yarn build`
Expected: 둘 다 에러 없이 통과.

- [ ] **Step 13: 작업 트리 정리 확인**

Run: `git status --porcelain`
Expected: 출력 없음(clean). 빌드가 재생성한 `auto-imports.d.ts`/`components.d.ts`가 보이면 `git diff`로 내용 변화가 없음을 확인한 뒤 되돌린다.

이 태스크는 코드 변경이 없으므로 커밋하지 않는다.

---

## 완료 후

5개 태스크, 4개 커밋이 `groupware-sync-phase-b` 브랜치(`main` 위)에 쌓인다.

- `main`으로 PR. CI(`typecheck` + `build`)가 검증한다.
- 배포는 [docs/RELEASING.md](../../RELEASING.md) 참조. 공개 API가 늘었으므로(CSS 변수 1개 + i18n 키 1개) **minor 범프**가 맞다.
- **릴리스 노트 필수 항목 — 눈에 보이는 동작 변화 2건:**
  1. **목록 뷰가 오늘 일정이 없어도 오늘 행을 렌더링한다.** 코드를 안 바꿔도 화면이 달라진다.
  2. **'오늘' 버튼이 강조와 스크롤을 하게 된다.** 기존에는 앵커만 옮겼다.
  - 참고로 `CalMessages`에 `noEventsOnDay`가 추가된다. `messages` 옵션은 `Partial<CalMessages>` 얕은 병합이라 기존 소비자에게 영향이 없지만, `CalMessages` 전체를 직접 타이핑한 소비자는 타입 에러를 볼 수 있다.
- 남은 phase: **E**(i18n — 실제 갭이 있는지 조사부터), **F**(목록 뷰 작성자 표시). 접근성(D)은 사용자 결정으로 보류 중이며, Phase C 스펙의 "알려진 미구현" 절이 재개 시 출발점이다.
