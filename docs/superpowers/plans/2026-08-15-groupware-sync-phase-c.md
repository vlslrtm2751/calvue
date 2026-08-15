# 그룹웨어 캘린더 동기화 Phase C (툴팁 슬롯 + 팝오버 수정) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 소비자가 `#tooltip` 슬롯으로 툴팁 내용을 직접 구성할 수 있게 하고, 툴팁·팝오버의 구조적 버그 5건을 고친다.

**Architecture:** 모듈 싱글턴이던 툴팁 상태를 `provide`/`inject` 인스턴스별 상태로 바꾸고(기존 `CAL_I18N` 패턴을 따름), 그 위에 슬롯을 얹는다. 두 팝오버(월 `+N`, 터치 클러스터)가 따로 구현하던 dismiss 정책을 공용 컴포저블 하나로 모으고, 위치 계산을 하드코딩 추정치에서 실측으로 바꾼다. 월 팝오버는 `.cal-swipe`의 transform에 갇히지 않도록 teleport로 옮긴다.

**Tech Stack:** Vue 3 `<script setup>` + TypeScript, dayjs, `@vueuse/core`(unplugin-auto-import로 자동 임포트 — `ref`/`computed`/`nextTick`/`inject`/`provide`/`useEventListener`/`onClickOutside` 등은 import문 없이 씀), Vite.

**Spec:** [docs/superpowers/specs/2026-08-15-groupware-sync-phase-c-design.md](../specs/2026-08-15-groupware-sync-phase-c-design.md)

## Global Constraints

- 브랜치: `groupware-sync-phase-c`(이미 `main`에서 checkout됨) — 새 브랜치 만들지 말 것.
- 패키지 매니저: **yarn만** 사용. `npm install` 금지.
- 새 런타임 의존성 추가 금지 — calvue의 peerDependencies는 `vue`/`dayjs`/`@vueuse/core`뿐.
- **공개 API 추가는 전부 하위 호환이어야 한다.** `#tooltip` 슬롯과 CSS 변수 2개만 늘어나고, 기존 props·emits·타입은 그대로다. 슬롯 미사용 시 기존 툴팁이 동일하게 렌더링돼야 한다.
- 이번 범위 밖(Phase D 이월): `clickable` 플래그, `eventClick` 두 번째 인자, 키보드 활성화(`role`/`tabindex`/Enter·Space), 팝오버 포커스 관리. **추가하지 말 것.**
- 검증: vitest 없음(도입은 이 계획 범위 밖). 태스크마다 `yarn typecheck`, 마지막 태스크에서 `yarn build` + `yarn play` 렌더 QA.
- 커밋: 태스크당 커밋 하나, **영어** 커밋 메시지, `git commit -m "..." -- <파일>` pathspec 형식으로 그 태스크가 건드린 파일만 커밋.
- 빌드 후 `auto-imports.d.ts`/`components.d.ts`가 수정된 것으로 보일 수 있다. 내용은 같고 줄바꿈(LF/CRLF)만 다른 노이즈이므로 `git checkout -- <파일>`로 되돌린다. 커밋에 포함하지 말 것.

---

### Task 1: use-cal-tooltip.ts — 모듈 싱글턴을 인스턴스별 상태로

**Files:**
- Modify: `src/composables/use-cal-tooltip.ts` (전체 교체)
- Modify: `src/components/cal-calendar.vue`

**Interfaces:**
- Produces:
  - `interface CalTooltipApi { state: TooltipState; setEnabled(v: boolean): void; show(event: CalEvent, el: HTMLElement, clientY?: number): void; hide(): void }`
  - `const CAL_TOOLTIP: InjectionKey<CalTooltipApi>`
  - `provideCalTooltip(): CalTooltipApi` — 루트가 호출
  - `useCalTooltip(): CalTooltipApi` — 내부 컴포넌트가 호출. **반환 형태는 기존과 동일**하므로 `cal-event-bar.vue`·`cal-time-event.vue`·`cal-month-view.vue`의 호출부는 수정 불필요
- Consumes: 기존 `CalEvent`(`src/types.ts`), `canHover`(`./use-cal-device`)

- [ ] **Step 1: `use-cal-tooltip.ts` 전체를 아래 내용으로 교체**

```ts
import type { CalEvent } from '../types';
import type { InjectionKey } from 'vue';
import { canHover } from './use-cal-device';
import { reactive } from 'vue';

export interface TooltipAnchor {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

interface TooltipState {
  event: CalEvent | null;
  anchor: TooltipAnchor | null;
  enabled: boolean;
}

export interface CalTooltipApi {
  state: TooltipState;
  setEnabled(v: boolean): void;
  show(event: CalEvent, el: HTMLElement, clientY?: number): void;
  hide(): void;
}

/** 루트 컴포넌트가 인스턴스별 상태를 provide, 내부 컴포넌트가 inject. */
export const CAL_TOOLTIP: InjectionKey<CalTooltipApi> = Symbol('cal-tooltip');

function createTooltipApi(): CalTooltipApi {
  const state = reactive<TooltipState>({ event: null, anchor: null, enabled: true });
  return {
    state,
    setEnabled(v: boolean) {
      state.enabled = v;
      if (!v) {
        state.event = null;
        state.anchor = null;
      }
    },
    show(event: CalEvent, el: HTMLElement, clientY?: number) {
      if (!state.enabled || !canHover()) return;
      const r = el.getBoundingClientRect();
      state.event = event;
      // 세로 기준은 포인터(clientY) — 긴 멀티데이 블록의 top은 스크롤로 뷰포트 위(음수)가 되어
      // clamp가 툴팁을 화면 맨 위로 밀어버린다. 포인터는 호버 중이라 항상 화면 안.
      state.anchor = { top: clientY ?? r.top, left: r.left, right: r.right, bottom: r.bottom };
    },
    hide() {
      state.event = null;
      state.anchor = null;
    }
  };
}

/**
 * 루트(cal-calendar.vue)가 호출 — 이 인스턴스 전용 상태를 만들어 provide한다.
 * 모듈 싱글턴이면 한 페이지의 캘린더 두 개가 툴팁 상태를 공유하고
 * 각자의 showTooltip watcher가 같은 enabled 플래그를 서로 덮어쓴다.
 */
export function provideCalTooltip(): CalTooltipApi {
  const api = createTooltipApi();
  provide(CAL_TOOLTIP, api);
  return api;
}

// provider 없이 내부 컴포넌트를 단독 사용해도 안전하도록 모듈 공유 폴백 (use-cal-i18n의 KO_FALLBACK과 같은 취지)
const FALLBACK = createTooltipApi();

/** 내부 컴포넌트에서 호출. 반환 형태는 기존과 동일하므로 호출부는 바뀌지 않는다. */
export function useCalTooltip(): CalTooltipApi {
  return inject(CAL_TOOLTIP, FALLBACK);
}
```

(`provide`/`inject`는 unplugin-auto-import로 자동 임포트된다 — `use-cal-i18n.ts`가 `inject`를 import문 없이 쓰는 것과 같다. `reactive`는 기존 파일이 명시적으로 import하고 있었으므로 그대로 둔다.)

- [ ] **Step 2: `cal-calendar.vue` — import 교체**

Before (`src/components/cal-calendar.vue:82`):
```ts
  import { useCalTooltip } from '../composables/use-cal-tooltip';
```

After:
```ts
  import { provideCalTooltip } from '../composables/use-cal-tooltip';
```

- [ ] **Step 3: `cal-calendar.vue` — 호출부 교체**

Before (`src/components/cal-calendar.vue:159`):
```ts
  const tip = useCalTooltip();
```

After:
```ts
  const tip = provideCalTooltip();
```

(주변의 `watch(() => opts.value.showTooltip, (v) => tip.setEnabled(v), ...)`와 `watch(view, () => tip.hide())`는 그대로 둔다.)

- [ ] **Step 4: typecheck**

Run: `yarn typecheck`
Expected: 에러 없이 통과.

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(tooltip): give each calendar instance its own tooltip state" -- src/composables/use-cal-tooltip.ts src/components/cal-calendar.vue
```

---

### Task 2: #tooltip 슬롯 + 툴팁 z-index 변수화

**Files:**
- Modify: `src/components/internal/cal-tooltip.vue`
- Modify: `src/components/cal-calendar.vue`

**Interfaces:**
- Consumes: Task 1의 `useCalTooltip()` (변경 없음)
- Produces: 공개 슬롯 `#tooltip`, slot prop `{ event: CalEvent }`. CSS 변수 `--cal-tooltip-z`(기본 10000)

- [ ] **Step 1: `cal-tooltip.vue` — 내용 전체를 슬롯으로 감싼다**

제목까지 슬롯 안에 넣는다. 슬롯은 툴팁 내용 **전체**를 대체하므로 제목이 슬롯 밖에 남으면 소비자가 제목을 바꾸거나 뺄 수 없다. 위치 계산 컨테이너(`.cal-tip`)는 슬롯 바깥에 그대로 둔다.

Before (`src/components/internal/cal-tooltip.vue:1-16`):
```html
<template>
  <teleport to="body">
    <div class="cal-tip" v-if="state.event" :style="{ left: pos.left + 'px', top: pos.top + 'px' }" ref="el">
      <div class="cal-tip__title">{{ state.event.title }}</div>
      <hr class="cal-tip__hr" v-if="props.fields.length" />
      <template v-for="f in props.fields" :key="f">
        <div class="cal-tip__row" v-if="f === 'creator' && creator">{{ m.creator }}: {{ creator }}</div>
        <div class="cal-tip__row" v-else-if="f === 'start'"
          >{{ m.start }}: {{ state.event.start.format('YYYY-MM-DD HH:mm') }}</div
        >
        <div class="cal-tip__row" v-else-if="f === 'end'">{{ m.end }}: {{ state.event.end.format('YYYY-MM-DD HH:mm') }}</div>
        <div class="cal-tip__desc" v-else-if="f === 'description' && description">{{ description }}</div>
      </template>
    </div>
  </teleport>
</template>
```

After:
```html
<template>
  <teleport to="body">
    <div class="cal-tip" v-if="state.event" :style="{ left: pos.left + 'px', top: pos.top + 'px' }" ref="el">
      <slot :event="state.event">
        <div class="cal-tip__title">{{ state.event.title }}</div>
        <hr class="cal-tip__hr" v-if="props.fields.length" />
        <template v-for="f in props.fields" :key="f">
          <div class="cal-tip__row" v-if="f === 'creator' && creator">{{ m.creator }}: {{ creator }}</div>
          <div class="cal-tip__row" v-else-if="f === 'start'"
            >{{ m.start }}: {{ state.event.start.format('YYYY-MM-DD HH:mm') }}</div
          >
          <div class="cal-tip__row" v-else-if="f === 'end'"
            >{{ m.end }}: {{ state.event.end.format('YYYY-MM-DD HH:mm') }}</div
          >
          <div class="cal-tip__desc" v-else-if="f === 'description' && description">{{ description }}</div>
        </template>
      </slot>
    </div>
  </teleport>
</template>
```

- [ ] **Step 2: `cal-tooltip.vue` — z-index 변수화**

Before (`src/components/internal/cal-tooltip.vue`, `.cal-tip` 규칙 안):
```css
    z-index: 10000;
```

After:
```css
    z-index: var(--cal-tooltip-z, 10000);
```

- [ ] **Step 3: `cal-calendar.vue` — 슬롯 선언**

`defineEmits` 선언 바로 뒤(`src/components/cal-calendar.vue:101` 부근)에 추가:

```ts
  /** 툴팁 내용 전체를 대체한다. 미지정 시 tooltipFields 기반 기본 툴팁이 렌더링된다. */
  defineSlots<{ tooltip?(props: { event: CalEvent }): unknown }>();
```

(`CalEvent`는 이 파일이 이미 타입 import하고 있다.)

- [ ] **Step 4: `cal-calendar.vue` — 슬롯 전달**

Before (`src/components/cal-calendar.vue:23`):
```html
      <cal-tooltip :fields="opts.tooltipFields" />
```

After:
```html
      <cal-tooltip :fields="opts.tooltipFields">
        <template v-if="$slots.tooltip" #default="slotProps">
          <slot name="tooltip" v-bind="slotProps" />
        </template>
      </cal-tooltip>
```

**`v-if="$slots.tooltip"`이 필수다.** 조건 없이 항상 템플릿을 넘기면 `cal-tooltip.vue`의 폴백 내용이 렌더링되지 않아, 슬롯을 안 쓴 소비자의 툴팁이 빈 상자로 뜬다.

- [ ] **Step 5: typecheck**

Run: `yarn typecheck`
Expected: 에러 없이 통과.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(tooltip): add #tooltip slot and --cal-tooltip-z variable" -- src/components/internal/cal-tooltip.vue src/components/cal-calendar.vue
```

---

### Task 3: use-cal-popover.ts 신규 + 두 팝오버 dismiss 공용화

**Files:**
- Create: `src/composables/use-cal-popover.ts`
- Modify: `src/components/internal/cal-month-view.vue`
- Modify: `src/components/internal/cal-time-grid.vue`

**Interfaces:**
- Produces: `useCalPopoverDismiss(popoverEl: Ref<HTMLElement | null>, isOpen: () => boolean, close: () => void, scrollTarget: Ref<HTMLElement | null>): void`
- Consumes: `useEventListener`(`@vueuse/core`, 자동 임포트)

- [ ] **Step 1: `src/composables/use-cal-popover.ts` 생성**

```ts
import type { Ref } from 'vue';

/**
 * 팝오버 dismiss 정책 — 월 `+N`과 터치 클러스터가 공유한다.
 *
 * - 바깥 pointerdown: **capture 단계 필수**. 시간 블록·월 셀이 드래그 처리를 위해
 *   pointerdown에 `.stop`을 걸어 버블 단계 리스너는 아예 호출되지 않는다.
 * - 스크롤: 위치를 열 때 한 번만 계산하고 재측정하지 않으므로, 스크롤하면 엉뚱한 곳에 남는다.
 * - Esc: 기존 `@keydown.esc`는 포커스 불가능한 div에 붙어 있어 동작하지 않았다.
 *   window 리스너면 포커스가 어디 있든 동작한다.
 *
 * 여는 탭이 스스로를 닫지 않는 이유: 그 이벤트가 전파될 시점엔 팝오버가 아직 없어 `isOpen()`이 false다.
 */
export function useCalPopoverDismiss(
  popoverEl: Ref<HTMLElement | null>,
  isOpen: () => boolean,
  close: () => void,
  scrollTarget: Ref<HTMLElement | null>
): void {
  useEventListener(
    window,
    'pointerdown',
    (e: PointerEvent) => {
      if (!isOpen()) return;
      if (popoverEl.value?.contains(e.target as Node)) return;
      close();
    },
    { capture: true }
  );

  useEventListener(scrollTarget, 'scroll', () => {
    if (isOpen()) close();
  });

  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (isOpen() && e.key === 'Escape') close();
  });
}
```

- [ ] **Step 2: `cal-month-view.vue` — `.cal-month__weeks`에 ref 추가**

Before (`src/components/internal/cal-month-view.vue:15`):
```html
    <div class="cal-month__weeks">
```

After:
```html
    <div class="cal-month__weeks" ref="weeksEl">
```

- [ ] **Step 3: `cal-month-view.vue` — 죽은 `@keydown.esc` 두 개 제거**

Esc를 컴포저블이 담당하므로 포커스 불가능한 div에 붙어 동작하지 않던 핸들러를 지운다.

Before (`src/components/internal/cal-month-view.vue:2`):
```html
  <div class="cal-month" :style="{ '--cal-cols': colCount }" @keydown.esc="closePopover" ref="calMonthEl">
```

After:
```html
  <div class="cal-month" :style="{ '--cal-cols': colCount }" ref="calMonthEl">
```

Before (`src/components/internal/cal-month-view.vue:115-121`):
```html
    <div
      class="cal-month__popover"
      v-if="popoverDay"
      :style="popoverStyle"
      @click.stop
      @keydown.esc="closePopover"
      ref="popoverEl">
```

After:
```html
    <div class="cal-month__popover" v-if="popoverDay" :style="popoverStyle" @click.stop ref="popoverEl">
```

(`@click.stop`은 남긴다 — 팝오버 안쪽 클릭이 아래 셀의 드래그 선택을 트리거하지 않게 하는 역할이 여전히 있다.)

- [ ] **Step 4: `cal-month-view.vue` — `weeksEl` 선언 + `onClickOutside` 교체**

Before (`src/components/internal/cal-month-view.vue:293-296`):
```ts
  const calMonthEl = ref<HTMLElement | null>(null);
  const popoverEl = ref<HTMLElement | null>(null);
  const popoverDay = ref<Dayjs | null>(null);
  const popoverStyle = ref<Record<string, string>>({});
```

After:
```ts
  const calMonthEl = ref<HTMLElement | null>(null);
  const weeksEl = ref<HTMLElement | null>(null);
  const popoverEl = ref<HTMLElement | null>(null);
  const popoverDay = ref<Dayjs | null>(null);
  const popoverStyle = ref<Record<string, string>>({});
```

Before (`src/components/internal/cal-month-view.vue:339-344`):
```ts
  // Close when clicking outside the popover element itself.
  // Because the +N trigger uses @click.stop, opening won't immediately self-close.
  // Clicking any other cell (outside the popover) will now correctly close it.
  onClickOutside(popoverEl, () => {
    closePopover();
  });
```

After:
```ts
  useCalPopoverDismiss(popoverEl, () => popoverDay.value !== null, closePopover, weeksEl);
```

- [ ] **Step 5: `cal-month-view.vue` — import 추가**

`<script lang="ts" setup>` 안의 기존 import 목록에 추가:
```ts
  import { useCalPopoverDismiss } from '../../composables/use-cal-popover';
```

- [ ] **Step 6: `cal-time-grid.vue` — `onClickOutside` 교체**

Before (`src/components/internal/cal-time-grid.vue:378`):
```ts
  onClickOutside(clusterEl, () => (cluster.value = null));
```

After:
```ts
  useCalPopoverDismiss(clusterEl, () => cluster.value !== null, () => (cluster.value = null), scrollEl);
```

- [ ] **Step 7: `cal-time-grid.vue` — import 추가**

`<script lang="ts" setup>` 안의 기존 import 목록에 추가:
```ts
  import { useCalPopoverDismiss } from '../../composables/use-cal-popover';
```

- [ ] **Step 8: typecheck**

Run: `yarn typecheck`
Expected: 에러 없이 통과.

- [ ] **Step 9: Commit**

```bash
git commit -m "fix(popover): share one dismiss policy — outside pointerdown, scroll, Esc" -- src/composables/use-cal-popover.ts src/components/internal/cal-month-view.vue src/components/internal/cal-time-grid.vue
```

---

### Task 4: 월 +N 팝오버 — teleport + 실측 위치 + z-index 변수

**Files:**
- Modify: `src/components/internal/cal-month-view.vue` (Task 3과 같은 파일 — Task 3 완료 후 진행)

**Interfaces:**
- Consumes: Task 3의 `useCalPopoverDismiss`(변경 없음), `weeksEl`
- Produces: CSS 변수 `--cal-popover-z`(기본 1500)

`.cal-month` 안 `position: absolute`인데 상위 `.cal-swipe`에 `translateX` 변환이 걸려 있다. CSS 변환은 하위 요소의 containing block을 만들어 팝오버가 그 안에 갇힌다(터치 클러스터 팝오버가 겪어서 teleport로 도망친 것과 같은 문제). 뷰포트 기준 `fixed`로 바꾸고 실측으로 위치를 잡는다.

- [ ] **Step 1: 템플릿 — 팝오버를 Teleport로 감싼다**

Before (`src/components/internal/cal-month-view.vue:114-138`, Task 3 적용 후 상태):
```html
    <!-- Popover — single instance at .cal-month root, positioned via absolute offset against this container -->
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
```

After:
```html
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
```

- [ ] **Step 2: 스크립트 — 하드코딩 크기를 버리고 실측 위치 계산으로 교체**

Before (`src/components/internal/cal-month-view.vue:289-327`, Task 3 적용 후 상태):
```ts
  // --- +N Popover ---
  const POPOVER_W = 220;
  const POPOVER_H = 300;

  const calMonthEl = ref<HTMLElement | null>(null);
  const weeksEl = ref<HTMLElement | null>(null);
  const popoverEl = ref<HTMLElement | null>(null);
  const popoverDay = ref<Dayjs | null>(null);
  const popoverStyle = ref<Record<string, string>>({});

  function openPopover(day: Dayjs, event: MouseEvent) {
    // Use the +N element itself as anchor (event.currentTarget)
    const anchor = event.currentTarget as HTMLElement;
    const anchorRect = anchor.getBoundingClientRect();
    const parentRect = calMonthEl.value?.getBoundingClientRect();

    if (anchorRect && parentRect) {
      // Compute offset relative to the .cal-month container (which is position:relative)
      let top = anchorRect.bottom - parentRect.top + 4;
      let left = anchorRect.left - parentRect.left;

      // Clamp right edge: shift left if popover would overflow container width
      if (left + POPOVER_W > parentRect.width) {
        left = Math.max(0, parentRect.width - POPOVER_W - 8);
      }

      // Clamp bottom edge: flip above anchor if popover would overflow container height
      if (top + POPOVER_H > parentRect.height) {
        const anchorTopRelative = anchorRect.top - parentRect.top;
        top = Math.max(0, anchorTopRelative - POPOVER_H - 4);
      }

      popoverStyle.value = {
        top: `${top}px`,
        left: `${left}px`
      };
    }

    popoverDay.value = day;
  }
```

After:
```ts
  // --- +N Popover ---
  /** 뷰포트 가장자리에서 유지할 최소 여백 */
  const POPOVER_MARGIN = 8;
  /** 앵커(+N 칸)와 팝오버 사이 간격 */
  const POPOVER_GAP = 4;

  const calMonthEl = ref<HTMLElement | null>(null);
  const weeksEl = ref<HTMLElement | null>(null);
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
```

(`nextTick`은 자동 임포트된다 — `cal-tooltip.vue`가 import문 없이 쓰고 있다.)

템플릿에 남아 있는 `@click.stop`은 teleport 이후 **불필요해진다** — 팝오버가 body 아래로 옮겨져 클릭이 캘린더 DOM을 타고 올라가지 않기 때문이다. 해로울 것도 없으므로 그대로 두되, 리뷰에서 지적되면 이 이유를 답하면 된다. (Task 3 시점에는 아직 `.cal-month` 안에 있어 실제로 필요했다.)

- [ ] **Step 3: CSS — fixed + z-index 변수**

Before (`src/components/internal/cal-month-view.vue`, `.cal-month__popover` 규칙 앞부분):
```css
  .cal-month__popover {
    position: absolute;
    z-index: 200;
    width: 220px;
```

After:
```css
  .cal-month__popover {
    position: fixed;
    z-index: var(--cal-popover-z, 1500);
    width: 220px;
```

- [ ] **Step 4: CSS — `.cal-month`의 stale 주석 수정**

팝오버가 teleport로 빠졌으므로 `position: relative`의 이유가 더는 팝오버가 아니다. 다른 절대배치 자식에 영향이 갈 수 있으므로 **선언은 남기고 주석만 고친다.**

Before (`src/components/internal/cal-month-view.vue:361` 부근):
```css
    position: relative; /* popover's position:absolute resolves against this container */
```

After:
```css
    position: relative; /* 내부 절대배치 요소들의 기준 컨테이너 */
```

- [ ] **Step 5: typecheck**

Run: `yarn typecheck`
Expected: 에러 없이 통과.

- [ ] **Step 6: Commit**

```bash
git commit -m "fix(month-view): teleport the +N popover and position it from measured size" -- src/components/internal/cal-month-view.vue
```

---

### Task 5: 터치 클러스터 팝오버 — 실측 위치 + z-index 변수

**Files:**
- Modify: `src/components/internal/cal-time-grid.vue` (Task 3과 같은 파일 — Task 3 완료 후 진행)

**Interfaces:**
- Consumes: Task 3의 `useCalPopoverDismiss`(변경 없음)
- Produces: 없음 (CSS 변수 `--cal-popover-z`는 Task 4와 동일한 이름·기본값)

이미 teleport + fixed이므로 위치 계산만 실측으로 바꾼다. 현재 `h = Math.min(320, 44 + n * 40)`은 행 높이를 40px로 가정한 추정식이라 실제와 어긋나면 뒤집기 판단이 틀린다.

- [ ] **Step 1: 스크립트 — 상태를 events만 담도록 좁히고 위치는 별도 ref로**

Before (`src/components/internal/cal-time-grid.vue:341-373`, Task 3 적용 후 상태):
```ts
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
        const tapMin = timeWindow.value.start + ((p.native.clientY - colRect.top) / colRect.height) * winSpan.value;
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
```

After:
```ts
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
```

- [ ] **Step 2: 템플릿 — 인라인 위치를 `clusterStyle`로 교체**

Before (`src/components/internal/cal-time-grid.vue:133-138`):
```html
      <div
        class="tg-cluster"
        v-if="cluster"
        :style="{ top: cluster.top + 'px', left: cluster.left + 'px' }"
        @click.stop
        ref="clusterEl">
```

After:
```html
      <div class="tg-cluster" v-if="cluster" :style="clusterStyle" @click.stop ref="clusterEl">
```

- [ ] **Step 3: CSS — z-index 변수화**

Before (`src/components/internal/cal-time-grid.vue`, `.tg-cluster` 규칙 앞부분):
```css
  .tg-cluster {
    position: fixed;
    z-index: 300;
```

After:
```css
  .tg-cluster {
    position: fixed;
    z-index: var(--cal-popover-z, 1500);
```

- [ ] **Step 4: typecheck**

Run: `yarn typecheck`
Expected: 에러 없이 통과. (`cluster.top`/`cluster.left`를 참조하는 곳이 남아 있으면 여기서 잡힌다 — 템플릿에서 위치를 `clusterStyle`로 옮겼으므로 없어야 한다.)

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(time-grid): position the overlap cluster popover from measured size" -- src/components/internal/cal-time-grid.vue
```

---

### Task 6: 검증 — 플레이그라운드 QA + 최종 빌드

**Files:**
- Temporarily modify (커밋 안 함, 확인 후 되돌림): `playground/main.ts`

vitest가 없으므로 이 태스크가 Phase C 전체의 최종 게이트다. **현재 플레이그라운드로는 이번 변경의 절반을 볼 수 없다** — `dayMaxEvents` 기본값이 `false`라 `+N 더보기` 팝오버가 아예 나타나지 않고, 캘린더가 하나뿐이라 툴팁 인스턴스 분리를 검증할 수 없다.

- [ ] **Step 1: playground/main.ts에 QA용 설정 임시 추가**

`setup()`의 return과 template을 아래처럼 바꾼다. (`events`·`view`·`selectedDate`는 파일에 이미 있는 것을 그대로 쓴다.)

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
    const leftOptions = { dayMaxEvents: 2 }
    const rightOptions = { dayMaxEvents: 2, showTooltip: false }
    const view2 = ref(view.value)
    return { view, view2, selectedDate, events, leftOptions, rightOptions }
  },
  template: `
    <div style="display:flex; gap:16px; height:100vh; padding:16px; box-sizing:border-box; font-family:sans-serif; background:#fff;">
      <div style="flex:1; min-width:0;">
        <CalCalendar v-model:view="view" :events="events" :options="leftOptions">
          <template #tooltip="{ event }">
            <div style="font-weight:700;">SLOT: {{ event.title }}</div>
            <div>{{ event.start.format('MM-DD HH:mm') }}</div>
          </template>
        </CalCalendar>
      </div>
      <div style="flex:1; min-width:0;">
        <CalCalendar v-model:view="view2" :events="events" :options="rightOptions" />
      </div>
    </div>
  `
```

왼쪽은 `#tooltip` 슬롯 사용 + 툴팁 켬, 오른쪽은 슬롯 미사용 + `showTooltip: false`. 이 조합이 **툴팁 인스턴스 분리를 검증하는 핵심**이다 — 싱글턴이면 오른쪽의 `showTooltip: false`가 왼쪽 툴팁까지 꺼버린다.

`CalMiniMonth`는 자리를 비우기 위해 뺐다.

- [ ] **Step 2: 플레이그라운드 실행**

Run: `yarn play --port 5199`

- [ ] **Step 3: 툴팁 확인**

- `http://localhost:5199/?view=month` — 왼쪽 캘린더의 이벤트에 호버하면 **`SLOT: <제목>`** 형태의 툴팁이 뜨는지 (슬롯 동작)
- 오른쪽 캘린더의 이벤트에 호버하면 **툴팁이 뜨지 않는지** (`showTooltip: false`가 그쪽에만 적용)
- **왼쪽 툴팁이 여전히 뜨는지** — 이게 인스턴스 분리 검증의 핵심이다. 싱글턴이면 왼쪽도 같이 꺼진다
- `?view=week`, `?view=day`로 바꿔가며 각 뷰에서 표시/숨김 확인. 마우스를 뗐을 때(`mouseleave`), 이벤트를 드래그하기 시작했을 때, 뷰를 전환했을 때 툴팁이 사라지는지
- 오른쪽 `rightOptions`에서 `showTooltip: false`를 잠시 지우고 슬롯 없이도 기존 툴팁(제목 + creator/시작/종료/설명)이 그대로 나오는지 — **슬롯 폴백 회귀 확인**

- [ ] **Step 4: 월 `+N` 팝오버 확인**

`dayMaxEvents: 2`라 이벤트가 3개 이상인 날에 `+N 더보기`가 보인다.

- `+N`을 눌러 팝오버가 뜨는지, 잘못된 위치에 깜빡였다가 이동하지 않는지(`visibility` 처리 확인)
- **브라우저 창을 작게 만들거나 화면 아래쪽 주(週)의 `+N`을 눌러** 팝오버가 위로 뒤집히는지, 오른쪽 끝 날짜에서 왼쪽으로 당겨지는지 — 실측 위치 계산의 핵심 검증 지점. 잘 되는 값만 눌러보면 잘 되는 것만 확인된다
- 팝오버를 연 채 **월 뷰를 좌우로 스와이프**(또는 이전/다음 달 버튼) — 팝오버가 달력과 함께 밀려나지 않는지 (teleport 검증)
- dismiss 4경로: 바깥 클릭 / **주 영역을 스크롤** / **Esc 키** / 닫기(×) 버튼
- 팝오버 행을 클릭하면 `eventClick`이 나가고 팝오버가 닫히는지

- [ ] **Step 5: 터치 클러스터 팝오버 확인**

클러스터 팝오버는 `isTouch()` 게이트라 일반 브라우저로는 열리지 않는다. **터치 에뮬레이션이 필요하다** — 브라우저 개발자도구의 기기 에뮬레이션 모드를 켜거나, Playwright라면 `hasTouch: true` 컨텍스트로 띄운다.

- `?view=week`에서 겹치는 시간 일정(예: 같은 시간대에 2개 이상)을 탭해 팝오버가 뜨는지
- **화면 아래쪽에서 탭**해 위로 뒤집히는지, 좌우 끝에서 클램프되는지
- dismiss 4경로: 바깥 탭 / **누른 채 드래그해 스크롤**(기존 `onClickOutside`가 못 잡던 케이스) / Esc / 닫기 버튼
- 팝오버가 앱 콘텐츠 뒤로 숨지 않는지

- [ ] **Step 6: z-index 변수 확인**

개발자도구에서 `.cal` 요소(또는 `:root`)에 `--cal-popover-z: 1` 을 임시로 주입하고 팝오버를 연다. 팝오버가 다른 요소 뒤로 내려가면 변수가 실제로 반영되는 것이다. 확인 후 되돌린다.

- [ ] **Step 7: 기본 상태 회귀 확인**

`leftOptions`/`rightOptions`를 `{}`로 바꾸고 슬롯 `<template #tooltip>`을 지운 뒤, 월/주/일/목록 뷰가 v0.2.0과 시각적으로 동일한지 확인한다. `dayMaxEvents`가 기본값 `false`로 돌아가 `+N`이 사라지는 것도 정상이다.

- [ ] **Step 8: 서버 종료 후 임시 변경 되돌리기**

Playground 서버를 중지(Ctrl+C 또는 background 프로세스 종료)한 뒤:

```bash
git checkout -- playground/main.ts
```

- [ ] **Step 9: 최종 빌드**

Run: `yarn typecheck && yarn build`
Expected: 둘 다 에러 없이 통과. `dist/` 산출물 생성 확인.

- [ ] **Step 10: 작업 트리 정리 확인**

Run: `git status --porcelain`
Expected: 출력 없음(clean).

빌드가 `auto-imports.d.ts`/`components.d.ts`를 재생성해 수정된 것처럼 보이면 `git diff`로 내용 변화가 없음을 확인한 뒤 `git checkout -- <파일>`로 되돌린다.

이 태스크는 코드 변경이 없으므로 커밋하지 않는다.

---

## 완료 후

6개 태스크, 5개 커밋이 `groupware-sync-phase-c` 브랜치(`main` 위)에 쌓인다. 이후 흐름:

- `main`으로 PR. CI(`typecheck` + `build`)가 검증한다.
- 배포는 [docs/RELEASING.md](../../RELEASING.md) 참조. 공개 API가 늘어났으므로(슬롯 + CSS 변수 2개) **minor 범프**(0.2.0 → 0.3.0)가 맞다. 전부 하위 호환이지만 pre-1.0에서는 기능 추가도 minor로 올린다.
- 릴리스 노트에 `#tooltip` 슬롯 사용법과 CSS 변수 2개를 적는다. **동작이 달라지는 변경이 하나 있다** — 팝오버 기본 `z-index`가 월 `+N`은 200→1500, 터치 클러스터는 300→1500으로 바뀐다. 그 사이 값으로 자기 앱 chrome의 z-index를 잡아둔 소비자는 코드를 바꾸지 않아도 팝오버가 chrome 뒤에서 앞으로 튀어나온다 — 의도된 변경이지만 화면이 눈에 띄게 달라지므로 릴리스 노트에 명시해야 한다. (팝오버 위치가 실측으로 바뀌어 가장자리에서 더 정확해지는 것은 이와 별개로, 동작을 바꾸는 변경은 아니다.)
- Phase D(접근성 — 키보드 활성화, `clickable`, `eventClick` 포커스 복귀 인자, 팝오버 포커스 관리)가 이 위에 얹힌다. 이번 스펙의 "알려진 미구현" 절이 그 출발점이다.
