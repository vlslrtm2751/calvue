# 그룹웨어 캘린더 동기화 Phase A (버그 수정) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `saeroun-gw-web`(형제 프로젝트) 캘린더 컴포넌트에서 나온 5개 버그 수정을 calvue의 자체 컴포저블/타입 경계 안에서 재구현한다 — API 변경 없음.

**Architecture:** `cal-time-grid.vue`가 그려온 고정 24시간 그리드를 `slotMinTime`~`slotMaxTime` 기반 `TimeWindow`로 대체하고, 이 창을 이벤트 배치(`use-event-layout`)·드래그/선택 좌표 변환(`use-calendar-dnd`/`use-calendar-select`)까지 일관되게 전달한다. 여기에 이벤트 key 안정화, 시간그리드 글자색 반영, 목록 뷰 말줄임, 헤더/스크롤바 컬럼 정렬 4개의 독립적인 저위험 수정을 곁들인다. 전부 비공개 컴포저블 시그니처 변경이며 `src/index.ts`가 export하는 공개 API는 그대로다.

**Tech Stack:** Vue 3 `<script setup>` + TypeScript, dayjs, `@vueuse/core`(unplugin-auto-import로 자동 임포트됨 — `useResizeObserver`·`onClickOutside` 등은 import문 없이 바로 씀), Vite.

**Spec:** [docs/superpowers/specs/2026-08-15-groupware-sync-phase-a-design.md](../specs/2026-08-15-groupware-sync-phase-a-design.md)

## Global Constraints

- 브랜치: `groupware-sync-phase-a`(이미 `v0.2-api-cleanup` 위에서 checkout됨) — 새 브랜치 만들지 말 것.
- 패키지 매니저: **yarn만** 사용. `npm install` 금지.
- 새 런타임 의존성 추가 금지 — calvue의 peerDependencies는 `vue`/`dayjs`/`@vueuse/core`뿐.
- 공개 API 변경 없음 — `src/index.ts`가 export하는 건 `CalCalendar`/`CalMiniMonth`/타입뿐이고, 이번에 시그니처가 바뀌는 `normalizeEvent`·`layoutDay`·`useCalendarSelect`·`useCalendarDnd`는 전부 비공개.
- 검증: vitest 없음(도입은 이 계획 범위 밖). 태스크마다 `yarn typecheck`, 마지막 태스크에서 `yarn build` + `yarn play` 렌더 스모크.
- 기본값(창 = 00:00~24:00, 즉 `slotMinTime`/`slotMaxTime` 미지정)에서는 모든 수식이 이전과 동일한 값을 내야 한다 — 회귀 금지.
- 커밋: 태스크당 커밋 하나, **영어** 커밋 메시지(calvue 자체 컨벤션 — 그룹웨어의 한국어 커밋 메시지와는 다름), `git commit -m "..." -- <파일>` pathspec 형식으로 이 태스크가 건드린 파일만 커밋.

---

### Task 1: cal-time-event.vue — extendedProps.textColor 반영

**Files:**
- Modify: `src/components/internal/cal-time-event.vue`

**Interfaces:**
- Consumes: 기존 `CalEvent.extendedProps?: Record<string, unknown>` (`src/types.ts`, 변경 없음)
- Produces: 없음 (leaf 변경)

- [ ] **Step 1: boxStyle에 글자색 추가**

`extendedProps`가 `Record<string, unknown>`이라 `.textColor`는 `unknown` 타입이다. `??`의 결과를 그대로 `:style`에 넣으면 vue-tsc가 `unknown`을 style 값으로 거부할 수 있어 `as string | undefined`로 좁혀준다.

Before:
```ts
  const boxStyle = computed(() => ({
    top: `${props.box.topPct}%`,
    height: `${props.box.heightPct}%`,
    left: `${props.box.leftPct}%`,
    width: `${props.box.widthPct}%`,
    background: props.box.event.color,
    zIndex: props.box.zIndex
  }));
```

After:
```ts
  const boxStyle = computed(() => ({
    top: `${props.box.topPct}%`,
    height: `${props.box.heightPct}%`,
    left: `${props.box.leftPct}%`,
    width: `${props.box.widthPct}%`,
    background: props.box.event.color,
    color: (props.box.event.extendedProps?.textColor as string | undefined) ?? '#fff',
    zIndex: props.box.zIndex
  }));
```

- [ ] **Step 2: typecheck**

Run: `yarn typecheck`
Expected: 에러 없이 통과.

- [ ] **Step 3: Commit**

```bash
git commit -m "fix(time-event): respect extendedProps.textColor" -- src/components/internal/cal-time-event.vue
```

---

### Task 2: normalize.ts + cal-calendar.vue — 이벤트 key를 시작 시각 기준으로

**Files:**
- Modify: `src/normalize.ts`
- Modify: `src/components/cal-calendar.vue:175`

**Interfaces:**
- Produces: `normalizeEvent(input: CalEventInput): CalEvent` — **시그니처 변경**(기존 `(input, index = 0)`에서 `index` 파라미터 제거). 이 함수를 호출하는 곳은 `cal-calendar.vue` 한 곳뿐(이번 태스크에서 같이 고침).

- [ ] **Step 1: normalize.ts — key 생성 방식 변경**

Before (`src/normalize.ts`):
```ts
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
```

After:
```ts
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
```

- [ ] **Step 2: cal-calendar.vue — 호출부 갱신**

Before (`src/components/cal-calendar.vue:175`):
```ts
  const normalized = computed<CalEvent[]>(() => props.events.map((e, i) => normalizeEvent(e, i)));
```

After:
```ts
  const normalized = computed<CalEvent[]>(() => props.events.map((e) => normalizeEvent(e)));
```

- [ ] **Step 3: typecheck**

Run: `yarn typecheck`
Expected: 에러 없이 통과. (호출부를 안 고치면 "Expected 1 arguments, but got 2" 에러가 난다 — 이게 이 스텝의 실질적 회귀 방지 역할)

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(normalize): derive event key from start time, not array index" -- src/normalize.ts src/components/cal-calendar.vue
```

---

### Task 3: cal-list-view.vue — 긴 제목 말줄임

**Files:**
- Modify: `src/components/internal/cal-list-view.vue`

**Interfaces:** 없음 (CSS + 클래스 추가만)

- [ ] **Step 1: 이벤트 목록 wrapper에 클래스 추가**

Before (템플릿):
```html
        <div>
          <div
            class="list-evt"
```

After:
```html
        <div class="list-evts">
          <div
            class="list-evt"
```

- [ ] **Step 2: `.list-day` 그리드 트랙 + `.list-evts` min-width**

Before:
```css
  .list-day {
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--cal-line-soft);
  }
```

After:
```css
  .list-day {
    display: grid;
    /* minmax(0, 1fr): auto 최소값(=제목 폭)이 남으면 트랙이 제목 길이만큼 늘어나 가로 스크롤이 생긴다 */
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--cal-line-soft);
  }
  .list-evts {
    min-width: 0;
  }
```

- [ ] **Step 3: `.time`/`.title` 폭 조정**

Before:
```css
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
```

After:
```css
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
```

- [ ] **Step 4: typecheck**

Run: `yarn typecheck`
Expected: 에러 없이 통과 (템플릿/CSS만 바뀌었으므로 사실상 no-op 확인).

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(list-view): let long event titles ellipsize instead of overflowing" -- src/components/internal/cal-list-view.vue
```

---

### Task 4: use-event-layout.ts — TimeWindow 도입 + eventOrder tie-break

**Files:**
- Modify: `src/composables/use-event-layout.ts` (전체 교체)

**Interfaces:**
- Produces:
  - `interface TimeWindow { start: number; end: number }`
  - `const FULL_DAY_WINDOW: TimeWindow`
  - `layoutDay(events: CalEvent[], dayStart: Dayjs, overlap = true, win: TimeWindow = FULL_DAY_WINDOW, order?: EventOrder): TimeBox[]` — 기존 3-파라미터 시그니처에 `win`·`order` 추가(둘 다 기본값 있어 기존 호출부는 안 고쳐도 typecheck는 통과하지만, Task 7에서 `cal-time-grid.vue` 호출부도 새 파라미터를 넘기도록 갱신한다).
- Consumes: `src/types.ts`의 `CalEvent`, `EventOrder`(기존, 변경 없음)

- [ ] **Step 1: 파일 전체를 아래 내용으로 교체**

```ts
import type { CalEvent, EventOrder } from '../types';
import type { Dayjs } from 'dayjs';

export interface TimeBox {
  event: CalEvent;
  topPct: number;
  heightPct: number;
  leftPct: number;
  widthPct: number;
  zIndex?: number; // cascade(overlap) stacking — later column on top; undefined in side-by-side
}

/** timed events occupy this % of the day column; the rest is a click/drag strip on the right */
const COLUMN_USABLE_PCT = 98;

/** 세로로 그리는 시간대(자정 기준 분). slotMinTime~slotMaxTime에 대응하며 기본은 하루 전체 */
export interface TimeWindow {
  start: number;
  end: number;
}

export const FULL_DAY_WINDOW: TimeWindow = { start: 0, end: 1440 };

export function layoutDay(
  events: CalEvent[],
  dayStart: Dayjs,
  overlap = true,
  win: TimeWindow = FULL_DAY_WINDOW,
  order?: EventOrder
): TimeBox[] {
  const span = Math.max(1, win.end - win.start);
  const timed = events
    .filter((e) => !e.allDay)
    .map((e) => ({ event: e, from: e.start.diff(dayStart, 'minute'), to: e.end.diff(dayStart, 'minute') }))
    // 창 밖의 일정은 그리지 않는다 — 클램프만 하면 경계에 납작한 상자가 남는다
    .filter((b) => b.to > win.start && b.from < win.end)
    .map((b) => {
      const s = Math.max(win.start, b.from);
      const en = Math.min(win.end, b.to);
      return { event: b.event, s, e: Math.max(en, s + 15) };
    })
    // 시작·끝이 같으면 컬럼 배정 순서가 조회 순서에 좌우된다 — order가 있으면 그걸로 가른다
    .sort((a, b) => a.s - b.s || b.e - a.e || (order ? order(a.event, b.event) : 0));

  const out: TimeBox[] = [];
  let cluster: typeof timed = [];
  let clusterEnd = -1;

  const flush = () => {
    // 컬럼 그리디 배정
    const cols: number[] = []; // 각 컬럼의 현재 끝 시간
    const placed = cluster.map((it) => {
      let col = cols.findIndex((end) => end <= it.s);
      if (col === -1) {
        col = cols.length;
        cols.push(it.e);
      } else {
        cols[col] = it.e;
      }
      return { it, col };
    });
    const n = cols.length;
    const cascade = overlap && n > 1;
    // cascade(overlap) = FullCalendar slotEventOverlap: each box offset right by half its width so a
    // later event obscures at most the right half of the one before — every title (top-left) stays
    // visible and the last box reaches the right edge. side-by-side(!overlap): equal 1/n columns.
    const cascadeW = cascade ? (COLUMN_USABLE_PCT * 2) / (n + 1) : 0;
    for (const { it, col } of placed) {
      const box: TimeBox = {
        event: it.event,
        topPct: ((it.s - win.start) / span) * 100,
        heightPct: ((it.e - it.s) / span) * 100,
        leftPct: cascade ? (col * cascadeW) / 2 : (col / n) * COLUMN_USABLE_PCT,
        widthPct: cascade ? cascadeW : (1 / n) * COLUMN_USABLE_PCT
      };
      if (cascade) box.zIndex = col + 1;
      out.push(box);
    }
    cluster = [];
  };

  for (const it of timed) {
    if (cluster.length && it.s >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  if (cluster.length) flush();
  return out;
}
```

기본값(`FULL_DAY_WINDOW` = `{start:0, end:1440}`, `order` 미지정)에서는 `win.start=0`·`span=1440`이라 모든 수식이 이전 버전과 동일한 값을 낸다.

- [ ] **Step 2: typecheck**

Run: `yarn typecheck`
Expected: 에러 없이 통과. (아직 이 함수를 호출하는 `cal-time-grid.vue`는 3-파라미터로 호출 중이지만, `win`·`order`에 기본값이 있어 문제없다.)

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(event-layout): add TimeWindow-aware layoutDay with order tiebreak" -- src/composables/use-event-layout.ts
```

---

### Task 5: use-calendar-select.ts — startTimeSelect가 시간 창을 인식하도록

**Files:**
- Modify: `src/composables/use-calendar-select.ts`

**Interfaces:**
- Consumes: `TimeWindow`, `FULL_DAY_WINDOW` from `./use-event-layout` (Task 4)
- Produces: `useCalendarSelect(onSelect, isEnabled?, timeWindow?: () => TimeWindow)` — 반환값(`{ startMonthSelect, startTimeSelect, consumeSelect }`)은 그대로.

- [ ] **Step 1: import 추가**

Before (파일 최상단):
```ts
import { isTouch } from './use-cal-device';
import type { Dayjs } from 'dayjs';
import { reactive } from 'vue';
```

After:
```ts
import type { TimeWindow } from './use-event-layout';
import { FULL_DAY_WINDOW } from './use-event-layout';
import { isTouch } from './use-cal-device';
import type { Dayjs } from 'dayjs';
import { reactive } from 'vue';
```

- [ ] **Step 2: useCalendarSelect 시그니처에 timeWindow 파라미터 추가**

Before:
```ts
export function useCalendarSelect(
  onSelect: (range: { start: Dayjs; end: Dayjs; allDay: boolean }) => void,
  isEnabled: () => boolean = () => true
) {
```

After:
```ts
export function useCalendarSelect(
  onSelect: (range: { start: Dayjs; end: Dayjs; allDay: boolean }) => void,
  isEnabled: () => boolean = () => true,
  /** 시간 그리드가 그리는 시간대(자정 기준 분) — 포인터 위치를 시각으로 바꿀 때 쓴다 */
  timeWindow: () => TimeWindow = () => FULL_DAY_WINDOW
) {
```

- [ ] **Step 3: startTimeSelect 안의 minAt 클램프를 창 기준으로**

Before (`startTimeSelect` 함수 내부):
```ts
    const minAt = (clientY: number, rect: DOMRect, round: boolean): number => {
      const raw = ((clientY - rect.top) / rect.height) * 1440;
      const snapped = (round ? Math.round(raw / SNAP) : Math.floor(raw / SNAP)) * SNAP;
      return Math.max(0, Math.min(1440, snapped));
    };
```

After:
```ts
    const win = timeWindow();
    const span = Math.max(1, win.end - win.start);
    const minAt = (clientY: number, rect: DOMRect, round: boolean): number => {
      const raw = win.start + ((clientY - rect.top) / rect.height) * span;
      const snapped = (round ? Math.round(raw / SNAP) : Math.floor(raw / SNAP)) * SNAP;
      return Math.max(win.start, Math.min(win.end, snapped));
    };
```

(이 두 줄 `const win = ...`/`const span = ...`은 기존 `const anchorRect = ...` 등이 있는 지점, `minAt` 정의 바로 위에 넣는다.)

- [ ] **Step 4: typecheck**

Run: `yarn typecheck`
Expected: 에러 없이 통과.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(calendar-select): make startTimeSelect respect the time window" -- src/composables/use-calendar-select.ts
```

---

### Task 6: use-calendar-dnd.ts — 시간 드래그/리사이즈가 시간 창을 인식하도록

**Files:**
- Modify: `src/composables/use-calendar-dnd.ts`

**Interfaces:**
- Consumes: `TimeWindow`, `FULL_DAY_WINDOW` from `./use-event-layout` (Task 4)
- Produces: `useCalendarDnd(onDrop, isEnabled?, onResize?, timeWindow?: () => TimeWindow)` — 반환값은 그대로.

- [ ] **Step 1: import 추가**

Before:
```ts
import type { CalEvent } from '../types';
import { isTouch } from './use-cal-device';
import type { Dayjs } from 'dayjs';
import { reactive } from 'vue';
```

After:
```ts
import type { CalEvent } from '../types';
import type { TimeWindow } from './use-event-layout';
import { FULL_DAY_WINDOW } from './use-event-layout';
import { isTouch } from './use-cal-device';
import type { Dayjs } from 'dayjs';
import { reactive } from 'vue';
```

- [ ] **Step 2: useCalendarDnd 시그니처에 timeWindow 파라미터 추가**

Before:
```ts
export function useCalendarDnd(
  onDrop: (ev: CalEvent, deltaDays: number, deltaMinutes: number) => void,
  isEnabled: () => boolean = () => true,
  onResize?: (ev: CalEvent, start: Dayjs, end: Dayjs) => void
) {
```

After:
```ts
export function useCalendarDnd(
  onDrop: (ev: CalEvent, deltaDays: number, deltaMinutes: number) => void,
  isEnabled: () => boolean = () => true,
  onResize?: (ev: CalEvent, start: Dayjs, end: Dayjs) => void,
  /** 시간 그리드가 그리는 시간대(자정 기준 분) — 포인터 위치를 시각으로 바꿀 때 쓴다 */
  timeWindow: () => TimeWindow = () => FULL_DAY_WINDOW
) {
```

- [ ] **Step 3: startTimeDrag — grabOffsetMin·onMove의 min 계산을 창 기준으로**

Before (`startTimeDrag` 함수 내부):
```ts
    // how far (in minutes) below the event's start the user grabbed, measured in the origin column
    let grabOffsetMin = 0;
    const startCol = originEl?.closest<HTMLElement>('[data-cal-col]');
    if (startCol) {
      const r = startCol.getBoundingClientRect();
      grabOffsetMin = ((downY - r.top) / r.height) * 1440 - origStartMin;
    }

    let dropDays = 0;
    let dropStartMin = origStartMin;

    const onMove = (me: PointerEvent): void => {
      if (!started) {
        if (Math.hypot(me.clientX - downX, me.clientY - downY) < 8) return;
        started = true;
        draggingKey.value = ev.key;
      }
      const el = document.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null;
      const col = el?.closest<HTMLElement>('[data-cal-col]');
      if (!col) return;
      const r = col.getBoundingClientRect();
      let min = ((me.clientY - r.top) / r.height) * 1440 - grabOffsetMin;
      min = Math.max(0, Math.min(1440 - SNAP, Math.round(min / SNAP) * SNAP));
      dropStartMin = min;
```

After:
```ts
    // how far (in minutes) below the event's start the user grabbed, measured in the origin column
    let grabOffsetMin = 0;
    const win = timeWindow();
    const span = Math.max(1, win.end - win.start);
    const startCol = originEl?.closest<HTMLElement>('[data-cal-col]');
    if (startCol) {
      const r = startCol.getBoundingClientRect();
      grabOffsetMin = win.start + ((downY - r.top) / r.height) * span - origStartMin;
    }

    let dropDays = 0;
    let dropStartMin = origStartMin;

    const onMove = (me: PointerEvent): void => {
      if (!started) {
        if (Math.hypot(me.clientX - downX, me.clientY - downY) < 8) return;
        started = true;
        draggingKey.value = ev.key;
      }
      const el = document.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null;
      const col = el?.closest<HTMLElement>('[data-cal-col]');
      if (!col) return;
      const r = col.getBoundingClientRect();
      let min = win.start + ((me.clientY - r.top) / r.height) * span - grabOffsetMin;
      min = Math.max(win.start, Math.min(win.end - SNAP, Math.round(min / SNAP) * SNAP));
      dropStartMin = min;
```

(이후 줄들 — `const colDate = col.dataset.calDate;`부터 `};`까지 — 은 그대로 둔다.)

- [ ] **Step 4: startTimeResize — onMove의 min 계산을 창 기준으로**

Before (`startTimeResize` 함수 내부의 `onMove`):
```ts
      if (!originCol) return;
      const r = originCol.getBoundingClientRect();
      let min = ((me.clientY - r.top) / r.height) * 1440;
      min = Math.round(min / SNAP) * SNAP;
      endMin = Math.max(startMin + SNAP, Math.min(1440, min)); // min 15-min duration, same day
```

After:
```ts
      if (!originCol) return;
      const win = timeWindow();
      const span = Math.max(1, win.end - win.start);
      const r = originCol.getBoundingClientRect();
      let min = win.start + ((me.clientY - r.top) / r.height) * span;
      min = Math.round(min / SNAP) * SNAP;
      endMin = Math.max(startMin + SNAP, Math.min(win.end, min)); // min 15-min duration, same day
```

- [ ] **Step 5: typecheck**

Run: `yarn typecheck`
Expected: 에러 없이 통과.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(calendar-dnd): make time drag/resize respect the time window" -- src/composables/use-calendar-dnd.ts
```

---

### Task 7: cal-time-grid.vue — slotMinTime/slotMaxTime 실제 반영

**Files:**
- Modify: `src/components/internal/cal-time-grid.vue`

**Interfaces:**
- Consumes: `TimeWindow`(Task 4) · 새 `layoutDay` 시그니처(Task 4) · 새 `useCalendarSelect`/`useCalendarDnd` 시그니처(Task 5, 6)
- Produces: 없음 (leaf 컴포넌트)

- [ ] **Step 1: import 및 HOURS/HOUR_H_PX 정리**

Before:
```ts
  import type { Dayjs } from 'dayjs';
  import type { CalEvent, CalEventChange, CalBusinessHours, EventOrder } from '../../types';
  import { layoutDay } from '../../composables/use-event-layout';
  import { layoutDayGridRow, eventEndDay } from '../../composables/use-daygrid-layout';
  import { useCalendarDnd, useDragPreview } from '../../composables/use-calendar-dnd';
  import { useCalendarSelect, useSelectPreview } from '../../composables/use-calendar-select';
  import { isTouch } from '../../composables/use-cal-device';
  import { useCalI18n } from '../../composables/use-cal-i18n';

  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const HOUR_H_PX = 48;
```

After:
```ts
  import type { Dayjs } from 'dayjs';
  import type { CalEvent, CalEventChange, CalBusinessHours, EventOrder } from '../../types';
  import type { TimeWindow } from '../../composables/use-event-layout';
  import { layoutDay } from '../../composables/use-event-layout';
  import { layoutDayGridRow, eventEndDay } from '../../composables/use-daygrid-layout';
  import { useCalendarDnd, useDragPreview } from '../../composables/use-calendar-dnd';
  import { useCalendarSelect, useSelectPreview } from '../../composables/use-calendar-select';
  import { isTouch } from '../../composables/use-cal-device';
  import { useCalI18n } from '../../composables/use-cal-i18n';

  const HOUR_H_PX = 48;

  function toMinutes(hhmm: string | undefined, fallback: number): number {
    const [h, m] = (hhmm ?? '').split(':').map(Number);
    return Number.isFinite(h) ? (h || 0) * 60 + (m || 0) : fallback;
  }
```

(`const HOURS = Array.from(...)` 줄은 삭제 — Step 2에서 computed로 다시 만든다.)

- [ ] **Step 2: timeWindow computed 추가 + useCalendarDnd/useCalendarSelect 호출부에 전달**

Before:
```ts
  const m = useCalI18n();

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
```

After:
```ts
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
```

- [ ] **Step 3: selectSeg를 창 기준으로**

Before:
```ts
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
```

After:
```ts
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
```

- [ ] **Step 4: gridCols에 `--tg-hours` 추가**

Before:
```ts
  // grid-template-columns: var(--cal-gutter, 56px) repeat(N, 1fr)
  const gridCols = computed(() => ({
    gridTemplateColumns: `var(--cal-gutter, 56px) repeat(${props.days.length}, 1fr)`
  }));
```

After:
```ts
  // grid-template-columns: var(--cal-gutter, 56px) repeat(N, 1fr)
  const gridCols = computed(() => ({
    gridTemplateColumns: `var(--cal-gutter, 56px) repeat(${props.days.length}, 1fr)`,
    // 컬럼 높이는 그리는 시간 수를 따른다 — 눈금(.tg-hour)과 어긋나지 않게
    '--tg-hours': String(HOURS.value.length)
  }));
```

- [ ] **Step 5: nowPct를 창 인식으로**

Before:
```ts
  // Now indicator top %
  const nowPct = computed(() => {
    const now = props.today; // 반응형(cal-calendar useNow) → 1분마다 라인 위치 갱신
    return (now.diff(now.startOf('day'), 'minute') / 1440) * 100;
  });
```

After:
```ts
  // Now indicator top %
  const nowMin = computed(() => props.today.diff(props.today.startOf('day'), 'minute')); // 반응형(useNow) → 1분마다 갱신
  const nowInWindow = computed(() => nowMin.value >= timeWindow.value.start && nowMin.value <= timeWindow.value.end);
  const nowPct = computed(() => pctOf(nowMin.value));
```

- [ ] **Step 6: onTimedClick — 탭 위치 계산을 창 기준으로**

Before (`onTimedClick` 함수 내부):
```ts
        const tapMin = ((p.native.clientY - colRect.top) / colRect.height) * 1440;
```

After:
```ts
        const tapMin = timeWindow.value.start + ((p.native.clientY - colRect.top) / colRect.height) * winSpan.value;
```

- [ ] **Step 7: onColClick — 클릭 위치 계산을 창 기준으로**

Before:
```ts
    const col = event.currentTarget as HTMLElement;
    const rect = col.getBoundingClientRect();
    const rawMins = ((event.clientY - rect.top) / rect.height) * 1440;
    // FLOOR to 30-min boundary: top half of hour → :00, bottom half → :30
    const min = Math.max(0, Math.min(1440 - 30, Math.floor(rawMins / 30) * 30));
    const start = day.startOf('day').add(min, 'minute');
    const end = start.add(60, 'minute');
    emit('select', { start, end, allDay: false });
```

After:
```ts
    const col = event.currentTarget as HTMLElement;
    const rect = col.getBoundingClientRect();
    const { start: winStart, end: winEnd } = timeWindow.value;
    const rawMins = winStart + ((event.clientY - rect.top) / rect.height) * winSpan.value;
    // FLOOR to 30-min boundary: top half of hour → :00, bottom half → :30
    const min = Math.max(winStart, Math.min(winEnd - 30, Math.floor(rawMins / 30) * 30));
    const start = day.startOf('day').add(min, 'minute');
    const end = start.add(60, 'minute');
    emit('select', { start, end, allDay: false });
```

- [ ] **Step 8: onMounted — 초기 스크롤 위치를 창 기준으로**

Before:
```ts
  onMounted(() => {
    if (scrollEl.value) {
      const [h, m] = (props.scrollTime ?? '07:00').split(':').map(Number);
      scrollEl.value.scrollTop = (((h || 0) * 60 + (m || 0)) / 60) * HOUR_H_PX;
    }
  });
```

After:
```ts
  onMounted(() => {
    if (scrollEl.value) {
      const scrollMin = toMinutes(props.scrollTime, 420); // 420 = 07:00, 기존 기본값과 동일
      scrollEl.value.scrollTop = Math.max(0, ((scrollMin - timeWindow.value.start) / 60) * HOUR_H_PX);
    }
  });
```

- [ ] **Step 9: 템플릿 — 시간 눈금 라벨(창 맨 위 줄은 라벨 생략)**

Before:
```html
        <div class="tg-gutter">
          <div class="tg-hour" v-for="h in HOURS" :key="h">{{ h > 0 ? `${String(h).padStart(2, '0')}:00` : '' }}</div>
        </div>
```

After:
```html
        <div class="tg-gutter">
          <div class="tg-hour" v-for="(h, i) in HOURS" :key="h">{{
            i > 0 ? `${String(h).padStart(2, '0')}:00` : ''
          }}</div>
        </div>
```

- [ ] **Step 10: 템플릿 — now 라인에 nowInWindow 가드**

Before:
```html
          <div class="tg-nowline" v-if="nowIndicator && day.isSame(today, 'day')" :style="{ top: nowPct + '%' }"></div>
```

After:
```html
          <div
            class="tg-nowline"
            v-if="nowIndicator && nowInWindow && day.isSame(today, 'day')"
            :style="{ top: nowPct + '%' }"></div>
```

- [ ] **Step 11: 템플릿 — layoutDay 호출에 timeWindow·eventOrder 전달**

Before:
```html
          <cal-time-event
            v-for="box in layoutDay(timedEventsFor(day), day.startOf('day'), slotEventOverlap !== false)"
```

After:
```html
          <cal-time-event
            v-for="box in layoutDay(
              timedEventsFor(day),
              day.startOf('day'),
              slotEventOverlap !== false,
              timeWindow,
              eventOrder
            )"
```

(템플릿 안에서는 `timeWindow`가 `<script setup>`의 computed ref를 자동 언랩하므로 `.value` 없이 그대로 쓴다.)

- [ ] **Step 12: 템플릿 — 드래그 프리뷰 위치를 pctOf 기준으로**

Before:
```html
            :style="{
              top: `${(preview.startMin / 1440) * 100}%`,
              height: `${(preview.durationMin / 1440) * 100}%`,
              backgroundColor: preview.event.color
            }">
```

After:
```html
            :style="{
              top: `${pctOf(preview.startMin)}%`,
              height: `${(preview.durationMin / winSpan) * 100}%`,
              backgroundColor: preview.event.color
            }">
```

- [ ] **Step 13: CSS — `.tg-col` 높이를 `--tg-hours` 기준으로**

Before:
```css
  .tg-col {
    position: relative;
    border-right: 1px solid var(--cal-line-soft);
    height: calc(24 * var(--cal-hour-h, 48px));
```

After:
```css
  .tg-col {
    position: relative;
    border-right: 1px solid var(--cal-line-soft);
    height: calc(var(--tg-hours, 24) * var(--cal-hour-h, 48px));
```

- [ ] **Step 14: typecheck**

Run: `yarn typecheck`
Expected: 에러 없이 통과.

- [ ] **Step 15: Commit**

```bash
git commit -m "fix(time-grid): honor slotMinTime/slotMaxTime in the time grid" -- src/components/internal/cal-time-grid.vue
```

---

### Task 8: cal-time-grid.vue — 헤더/종일행과 스크롤 본문의 컬럼 경계 정렬

**Files:**
- Modify: `src/components/internal/cal-time-grid.vue` (Task 7과 같은 파일 — Task 7 완료 후 진행)

**Interfaces:** 없음 (같은 leaf 컴포넌트 내부 CSS/레이아웃 보정)

`.tg-body`만 `.tg-scroll` 안이라 스크롤바 폭만큼 좁다. 헤더(`.tg-head`)·종일 행(`.tg-allday`)은 스크롤 컨테이너 밖이라 전체 폭을 쓰므로, 같은 `repeat(N, 1fr)`을 서로 다른 총폭에 나누면 컬럼 경계가 왼쪽부터 조금씩 벌어진다. 스크롤바 폭을 측정해 헤더·종일 행에 `padding-right`로 되돌려준다(오버레이 스크롤바 환경에서는 폭이 0이라 아무것도 안 바뀐다).

- [ ] **Step 1: scrollbarW 측정 + headCols/allDayCols computed 추가**

Before (`gridCols` 바로 다음, Task 7에서 이미 `--tg-hours`가 추가된 상태):
```ts
  const scrollEl = ref<HTMLElement | null>(null);

  // grid-template-columns: var(--cal-gutter, 56px) repeat(N, 1fr)
  const gridCols = computed(() => ({
    gridTemplateColumns: `var(--cal-gutter, 56px) repeat(${props.days.length}, 1fr)`,
    // 컬럼 높이는 그리는 시간 수를 따른다 — 눈금(.tg-hour)과 어긋나지 않게
    '--tg-hours': String(HOURS.value.length)
  }));
```

After:
```ts
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
```

- [ ] **Step 2: onMounted에서 측정 실행 + 리사이즈 시 재측정**

Before (Task 7에서 만든 상태):
```ts
  onMounted(() => {
    if (scrollEl.value) {
      const scrollMin = toMinutes(props.scrollTime, 420); // 420 = 07:00, 기존 기본값과 동일
      scrollEl.value.scrollTop = Math.max(0, ((scrollMin - timeWindow.value.start) / 60) * HOUR_H_PX);
    }
  });
```

After:
```ts
  useResizeObserver(scrollEl, measureScrollbar);

  onMounted(() => {
    measureScrollbar();
    if (scrollEl.value) {
      const scrollMin = toMinutes(props.scrollTime, 420); // 420 = 07:00, 기존 기본값과 동일
      scrollEl.value.scrollTop = Math.max(0, ((scrollMin - timeWindow.value.start) / 60) * HOUR_H_PX);
    }
  });
```

`useResizeObserver`는 `@vueuse/core`에서 auto-import되므로 import문 불필요(`auto-imports.d.ts:223`에 이미 선언돼 있음 — `onClickOutside`도 같은 방식으로 이 파일에서 이미 쓰이고 있다).

- [ ] **Step 3: 템플릿 — 헤더·종일행에 보정된 스타일 바인딩**

Before:
```html
    <div class="tg-head" :style="gridCols">
```

After:
```html
    <div class="tg-head" :style="headCols">
```

Before:
```html
    <div class="tg-allday">
```

After:
```html
    <div class="tg-allday" :style="allDayCols">
```

- [ ] **Step 4: typecheck**

Run: `yarn typecheck`
Expected: 에러 없이 통과.

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(time-grid): align header/all-day columns with the scrollbar-narrowed body" -- src/components/internal/cal-time-grid.vue
```

---

### Task 9: 검증 — playground 렌더 스모크 + 최종 빌드

**Files:**
- Temporarily modify (커밋 안 함, 확인 후 되돌림): `playground/main.ts`

vitest가 없으므로 이 태스크가 Phase A 전체의 최종 게이트다. 8개 태스크가 건드린 동작(시간 창, 글자색, 목록 뷰 말줄임, 컬럼 정렬, 안정적 key)을 실제로 렌더해서 눈으로 확인한다.

- [ ] **Step 1: playground/main.ts에 QA용 이벤트·옵션 임시 추가**

`playground/main.ts`의 `events` 배열 끝에 두 항목을 추가하고, `<CalCalendar>`에 커스텀 `slotMinTime`/`slotMaxTime`을 전달한다.

`events` 배열에 추가(`M`은 파일에 이미 정의된 "이번 달" 상수):
```ts
      {
        id: '11',
        title: 'QA: 옅은 배경 + 지정 글자색',
        start: `${M}-06T08:30:00`,
        end: `${M}-06T09:30:00`,
        color: '#bae6fd',
        editable: true,
        extendedProps: { textColor: '#000' }
      },
      {
        id: '12',
        title: 'QA: 아주 아주 아주 긴 일정 제목이 목록 뷰에서 말줄임되는지 확인하기 위한 텍스트',
        start: `${M}-06`,
        allDay: true,
        color: '#64748b'
      }
```

`setup()`의 return과 template을 아래처럼 바꾼다:

Before:
```ts
    return { view, selectedDate, events }
  },
  template: `
    <div style="display:flex; gap:16px; height:100vh; padding:16px; box-sizing:border-box; font-family:sans-serif; background:#fff;">
      <div style="width:280px;">
        <CalMiniMonth v-model="selectedDate" />
      </div>
      <div style="flex:1; min-width:0;">
        <CalCalendar v-model:view="view" :events="events" />
      </div>
    </div>
  `
```

After:
```ts
    const testOptions = { slotMinTime: '08:00', slotMaxTime: '20:00' }
    return { view, selectedDate, events, testOptions }
  },
  template: `
    <div style="display:flex; gap:16px; height:100vh; padding:16px; box-sizing:border-box; font-family:sans-serif; background:#fff;">
      <div style="width:280px;">
        <CalMiniMonth v-model="selectedDate" />
      </div>
      <div style="flex:1; min-width:0;">
        <CalCalendar v-model:view="view" :events="events" :options="testOptions" />
      </div>
    </div>
  `
```

- [ ] **Step 2: 플레이그라운드 실행**

Run: `yarn play --port 5199`

(포트 5173은 다른 프로젝트가 상시 점유하는 경우가 있어 5199 사용 — 이미 비어 있으면 아무 포트나 무방.)

- [ ] **Step 3: 브라우저로 아래 항목을 확인**

- `http://localhost:5199/?view=week` (또는 day) — 시간축이 08~20시로만 그려지는지(00~24시가 아니라), 08:30 QA 이벤트가 옅은 파란 배경에 **검은 글자**로 제목·시각이 보이는지 확인.
- 같은 주/일 뷰에서 헤더 요일 칸과 본문 시간 칸의 세로 경계선이 스크롤 유무와 무관하게 일직선인지 확인(어긋나면 Task 8 실패).
- 시간 그리드 빈 칸을 위쪽/아래쪽 경계 근처에서 드래그 선택 — 08:00/20:00을 넘어가지 않고 그 안에서 클램프되는지 확인.
- 08:30 QA 이벤트(editable:true)를 세로로 드래그 이동 — 마찬가지로 08:00~20:00 안에서만 움직이는지 확인.
- `http://localhost:5199/?view=list` — 긴 제목 QA 이벤트(id 12)가 가로 스크롤을 만들지 않고 말줄임(…)되는지 확인. 브라우저 폭을 좁혀도(모바일 폭) 목록 전체에 가로 스크롤이 안 생기는지 확인.
- `http://localhost:5199/?view=month` — 기존 이벤트들이 이전과 동일하게 보이는지(회귀 없음) 확인.
- `testOptions`를 잠시 지우거나 `{ slotMinTime: '00:00', slotMaxTime: '24:00' }`로 바꿔서 주/일 뷰가 원래(00~24시 풀 그리드)와 시각적으로 동일한지 확인 — 기본값 회귀 없음 확인.

- [ ] **Step 4: 서버 종료 후 임시 변경 되돌리기**

Playground 서버를 중지(Ctrl+C 또는 background 프로세스 종료)한 뒤:

```bash
git checkout -- playground/main.ts
```

- [ ] **Step 5: 최종 빌드**

Run: `yarn typecheck && yarn build`
Expected: 둘 다 에러 없이 통과. `dist/` 산출물 생성 확인.

- [ ] **Step 6: 작업 트리 정리 확인**

Run: `git status --porcelain`
Expected: 출력 없음(clean) — Step 4에서 playground 변경을 되돌렸고, Task 1~8에서 이미 다 커밋했으므로 남는 게 없어야 한다.

이 태스크는 코드 변경이 없으므로 커밋하지 않는다.

---

## 완료 후

9개 태스크, 8개 커밋이 `groupware-sync-phase-a` 브랜치(`v0.2-api-cleanup` 위)에 쌓인다. 이후 흐름은 사용자 결정 대기:

- `groupware-sync-phase-a` → `v0.2-api-cleanup` → `ci-workflow` → `main` 순으로 PR을 쌓을지, 아니면 이 브랜치를 별도 PR로 `v0.2-api-cleanup` 위에 얹을지.
- Phase B(오늘-포커스 기능)는 이 Phase A가 머지된 뒤 별도 스펙으로 브레인스토밍한다 — `6a4943837`에서 스킵한 종일 행 포커스 배경 레이어가 그때 다시 등장한다.
