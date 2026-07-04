# saeroun-cal-ui Library Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the files copied from `saeroun-gw-web`'s `src/components/cal/` into a standalone, dependency-clean Vue 3 component library (`CalCalendar` + `CalMiniMonth`) with no Vuetify/Pinia/groupware-API coupling.

**Architecture:** Two public SFCs (`cal-calendar.vue`, `cal-mini-month.vue`) compose a set of internal SFCs (`src/components/internal/*.vue`) and composables (`src/composables/*.ts`) via relative imports and `unplugin-vue-components` auto-registration. `src/index.ts` re-exports the two public components and their prop/type contracts from `src/types.ts`. Theming is a single `--cal-primary` CSS custom property injected via Vue's `v-bind()` in each root component's `<style>` block.

**Tech Stack:** Vue 3.4 `<script setup>`, TypeScript (strict, `verbatimModuleSyntax`), Vite + `vite-plugin-dts`, `unplugin-auto-import`, `unplugin-vue-components`, dayjs, `@vueuse/core`. Package manager: **yarn** (confirmed via `node_modules/.yarn-integrity`; do not run `npm install`, it will create a second, drifting lockfile).

## Global Constraints

- Peer deps only: `vue ^3.4`, `dayjs ^1.11`, `@vueuse/core ^11`. No Vuetify, no Pinia, no `@tienipia-official/*` packages, no `ical.js`.
- All component styles are scoped CSS (`<style scoped>`). No Tailwind.
- No `@/` alias exists in this repo — every internal import must be a relative path, computed from the *actual* file location (many files currently have stale `./`-relative imports left over from the source repo's flatter directory layout).
- No test framework is set up and none is being added by this plan (not requested) — verification is `yarn typecheck`, `yarn build`, and a manual smoke test in a browser.
- Holiday-specific behavior (`CalOptions.showHolidays`, `event.source === 'korea'`) is being removed outright, per your decision — do not re-add it under a different name.
- `composables/use-recurrence.ts` and `composables/use-calendar-sources.ts` are being deleted outright, per your decision (the latter was already gone from the working tree when this plan was written — if it reappears, delete it too).

---

## Task 1: Vite build config, auto-import setup, dependencies, repo cleanup

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: `tsconfig.app.json`
- Modify: `.gitignore`
- Delete: `package-lock.json` (stray — yarn is the real package manager here, npm never ran)
- Untrack: `dist/` (stale build output committed by the Copilot scaffold; it currently references `CalCalendar.vue`/`CalMiniMonth.vue`, files that don't exist under those names — proof it's already out of sync and shouldn't be tracked)

**Interfaces:**
- Produces: global auto-imports for `vue` APIs (`ref`, `computed`, `watch`, `reactive`, `onMounted`, `nextTick`, `defineProps`, `defineEmits`, `defineModel`, `defineExpose`, `withDefaults`, etc.), `@vueuse/core` APIs (`useSwipe`, `useResizeObserver`, `useNow`, `onClickOutside`), and `dayjs` (as a bare function call) — every later task's `.vue`/`.ts` file relies on these being globally available with **no explicit import**, matching the code as copied from `saeroun-gw-web`.
- Produces: auto-registration of every `.vue` file under `src/components/` (including `internal/`) as a component usable by kebab-case tag name in any template — later tasks' templates reference `<cal-tooltip>`, `<cal-drag-ghost>`, `<cal-month-view>`, `<cal-list-view>`, `<cal-time-grid>`, `<cal-event-bar>`, `<cal-time-event>` with no explicit import, relying on this.

- [ ] **Step 1: Remove the stray npm lockfile**

```bash
git rm package-lock.json
```

- [ ] **Step 2: Stop tracking stale build output**

```bash
git rm -r --cached dist
```

- [ ] **Step 3: Add `dist/` to `.gitignore`**

Current `.gitignore`:
```
node_modules/
*.local

# Editor
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# TypeScript incremental build cache
node_modules/.tmp/
```

New `.gitignore` (add a `dist/` line):
```
node_modules/
dist/
*.local

# Editor
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# TypeScript incremental build cache
node_modules/.tmp/
```

- [ ] **Step 4: Install the new dependencies with yarn**

```bash
yarn add -D dayjs@^1.11.0 @vueuse/core@^11.0.0 unplugin-auto-import unplugin-vue-components
```

This updates `package.json`'s `devDependencies` and `yarn.lock` automatically — do not hand-edit version strings into `package.json`. `vue`, `@vitejs/plugin-vue`, `@vue/tsconfig`, `typescript`, `vite`, `vite-plugin-dts`, `vue-tsc` are already present from the Copilot scaffold; leave them alone. `peerDependencies` (`vue`, `dayjs`, `@vueuse/core`) are already correct; leave them alone too.

- [ ] **Step 5: Rewrite `vite.config.ts`**

Current content:
```ts
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
      include: ['src/**/*.ts', 'src/**/*.vue'],
      outDir: 'dist',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SCalendar',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['vue', 'dayjs', '@vueuse/core'],
    },
    cssCodeSplit: false,
  },
})
```

New content:
```ts
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

export default defineConfig({
  plugins: [
    AutoImport({
      imports: ['vue', '@vueuse/core', { dayjs: [['default', 'dayjs']] }],
      dts: true,
    }),
    Components({
      dirs: ['src/components'],
      deep: true,
      dts: true,
    }),
    vue(),
    dts({
      insertTypesEntry: true,
      include: ['src/**/*.ts', 'src/**/*.vue'],
      outDir: 'dist',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SCalendar',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['vue', 'dayjs', '@vueuse/core'],
    },
    cssCodeSplit: false,
  },
})
```

`AutoImport`/`Components` with `dts: true` write `auto-imports.d.ts` and `components.d.ts` to the project root by default (no path override needed).

- [ ] **Step 6: Add the generated declaration files to `tsconfig.app.json`'s `include`**

`vue-tsc` (the `typecheck` script) does not go through Vite, so it never triggers these plugins — the two generated `.d.ts` files must already exist on disk and be in TypeScript's `include` set for typecheck to see the global types.

Current:
```json
  "include": ["src/**/*.ts", "src/**/*.vue"],
  "exclude": ["node_modules", "dist"]
```

New:
```json
  "include": ["src/**/*.ts", "src/**/*.vue", "auto-imports.d.ts", "components.d.ts"],
  "exclude": ["node_modules", "dist"]
```

- [ ] **Step 7: Generate the declaration files for the first time and commit them**

```bash
yarn build
```

Expected: this will still **fail** at this point in the plan — most files haven't been fixed yet (their imports point at `@/stores`, `@/utils`, `@tienipia-official/...`, or wrong relative paths like `./types` from a file that isn't a sibling of `types.ts`). That's expected. What to check: the failure is a module-resolution error naming one of those known-bad paths (or a downstream file that imports one), **not** an error about `AutoImport`, `Components`, or the plugin setup itself. If you see a plugin-configuration error instead, stop and fix `vite.config.ts` before continuing.

Confirm `auto-imports.d.ts` and `components.d.ts` were written to the project root despite the later build failure (Vite plugins run their `config`/`buildStart` hooks before hitting the unresolved-module error further down the pipeline). If they weren't created, run `yarn dev` briefly (it will also fail the same way, but the plugins still get a chance to write the files) and then stop it.

- [ ] **Step 8: Commit**

```bash
git add package.json yarn.lock vite.config.ts tsconfig.app.json .gitignore auto-imports.d.ts components.d.ts
git add -u dist package-lock.json
git commit -m "build: add auto-import/vue-components, untrack dist, drop stray npm lockfile"
```

---

## Task 2: Rewrite `src/types.ts` — the public type contract

**Files:**
- Modify: `src/types.ts`

**Interfaces:**
- Consumes: nothing (leaf file, only external import is `dayjs`'s `Dayjs` type).
- Produces: `CalView`, `CalEvent` (now includes `source: string`), `CalRange`, `CalBusinessHours`, `CalEventInput` (now `source?: string`, no more `CalSourceKind`), `EventOrder`, `CalTooltipField`, `CalOptions` (now includes `primaryColor: string`, no more `showHolidays`), and a new `CalMiniOptions` interface (`primaryColor: string`, `firstDay: number`, `weekdays: string[]`) — every later task imports one or more of these.

**Context — why this file changes so much:**
- `normalize.ts` already assigns `source: input.source ?? 'cal'` onto the object it returns as `CalEvent`, but the current `CalEvent` interface has no `source` field at all — this is a real, pre-existing compile error. Adding `source: string` fixes it.
- `CalEventInput.source` is typed `CalSourceKind`, but `CalSourceKind` is **never defined anywhere in this repo** (confirmed by grepping the whole tree) — another pre-existing compile error, not just an unused type. Per your decision to drop the holidays feature, `source` becomes a plain, caller-defined `string` with no reserved value.
- `showHolidays` is removed per your decision; `cal-calendar.vue` (Task 7) and `cal-month-view.vue` (Task 5) stop deriving any holiday-highlighting state from it.
- `RecurFreq`, `RecurWeekday`, `RecurrenceForm` are removed because their only consumer, `use-recurrence.ts`, is deleted in Task 3 (confirmed via grep: no other file references them).
- `CalMiniOptions` doesn't exist yet in this file (a placeholder version briefly existed in `src/index.ts`, which Task 9 replaces entirely) — it's created here from scratch. It intentionally does **not** include a `locale` field: `CalOptions.locale` already exists elsewhere in this same file but is never actually read by any component (dead configuration inherited from the source repo) — not worth copying that dead field into a brand-new interface.

- [ ] **Step 1: Replace the full file content**

Current `src/types.ts` (93 lines) has `CalEvent`/`CalEventInput`/`CalOptions` shapes copied verbatim from `saeroun-gw-web`, plus the recurrence types. Replace the entire file with:

```ts
import type { Dayjs } from "dayjs";

export type CalView = "month" | "week" | "day" | "list";

export interface CalEvent {
  /** 렌더 고유키 (반복 인스턴스 구분 포함) */
  key: string;
  /** 원본 이벤트 id (CRUD용) */
  rawId: string;
  calendarId: string;
  /** 호출자가 정의하는 이벤트 출처 문자열 (기본 'cal') */
  source: string;
  title: string;
  start: Dayjs;
  /** 종료(배타적). 종일은 익일 00:00로 정규화 */
  end: Dayjs;
  allDay: boolean;
  color: string;
  /** 드래그/수정 가능 여부 */
  editable: boolean;
  /** 클릭·툴팁 등 상호작용 허용 여부 (기본 true). false면 표시만 되고 클릭/툴팁이 동작하지 않음 */
  interactive?: boolean;
  /** 마스터 이벤트의 RRULE (있으면 반복 일정) */
  rrule?: string;
  extendedProps?: Record<string, unknown>;
}

export interface CalRange {
  start: Dayjs;
  end: Dayjs;
}

export interface CalBusinessHours {
  daysOfWeek: number[]; // 0=일 ~ 6=토
  startTime: string; // 'HH:mm'
  endTime: string; // 'HH:mm'
}

/** 부모 페이지가 주입하는 공개 이벤트 입력 타입(느슨). cal-calendar가 CalEvent로 정규화 */
export interface CalEventInput {
  id: string;
  title: string;
  start: string | Date | Dayjs;
  end?: string | Date | Dayjs; // 생략 시: 종일=익일, 시간=+1h
  allDay?: boolean; // 기본 false
  calendarId?: string;
  color?: string; // 기본 토큰 색
  editable?: boolean; // 기본 false(읽기 전용)
  interactive?: boolean; // 기본 true. false면 클릭/툴팁 비활성(표시만)
  /** 호출자가 정의하는 이벤트 출처 문자열 (기본 'cal') */
  source?: string;
  rrule?: string;
  extendedProps?: Record<string, unknown>;
}

/** 같은 날 내 일정 정렬 비교 함수 (Array.sort 시그니처) */
export type EventOrder = (a: CalEvent, b: CalEvent) => number;

/** fullCalendar calendarOptions의 우리가 쓰는 subset 설정 객체 */
export type CalTooltipField = "creator" | "start" | "end" | "description";

export interface CalOptions {
  views: CalView[]; // 표시할 뷰 (기본 ['day','week','month','list'])
  headerToolbar: { left: string; center: string; right: string };
  locale: string; // 'ko'
  /** 강조색. --cal-primary CSS 커스텀 프로퍼티로 주입됨 (기본 '#1976d2') */
  primaryColor: string;
  firstDay: number; // 주 시작 요일 0=일 (기본 0)
  weekends: boolean; // 주말(토·일) 표시 (기본 true; false면 숨겨 평일만 — 주/월뷰 5컬럼)
  weekdayColors: Record<number, string>; // {0:'#ef4444', 6:'#2563eb'}
  showTooltip: boolean; // 호버 툴팁 (기본 true)
  tooltipFields: CalTooltipField[]; // 툴팁에 표시할 필드·순서 (기본 전부; 예 ['creator','start','end']면 설명 제외)
  businessHours: CalBusinessHours | null; // 업무시간 음영
  slotMinTime: string; // 'HH:mm' (기본 '00:00')
  slotMaxTime: string; // 'HH:mm' (기본 '24:00')
  slotDuration: string; // 시간 그리드 격자 간격 'HH:mm' (기본 '01:00'; '00:30'이면 30분 격자)
  scrollTime: string; // 주/일 뷰 진입 시 스크롤 시작 시각 'HH:mm' (기본 '07:00')
  nowIndicator: boolean; // 현재시각 라인 (기본 true)
  slotEventOverlap: boolean; // 겹치는 timed 일정 표시 — true=계단식 겹침(기본), false=나란히(1/n 컬럼)
  selectable: boolean; // 셀 드래그 선택 (기본 true)
  editable: boolean; // 일정 드래그 이동 (기본 true)
  resizable: boolean; // 일정 가로 리사이즈 (기본 true; editable=true일 때만 동작)
  eventHeight: number; // 이벤트 바 높이(px) (기본 24)
  dayMaxEvents: number | false; // 월뷰 셀당 최대 표시 일정 수, 초과 시 '+N 더보기'. false면 제한 없이 전부 표시 (기본 false)
  eventOrder?: EventOrder; // 같은 날 내 정렬 (미지정 기본: 이른 시작일 먼저=넘어온 일정 위, 같은 날은 종일→멀티데이→당일, 시작시각순)
}

/** Options accepted by CalMiniMonth. */
export interface CalMiniOptions {
  /** 강조색. --cal-primary CSS 커스텀 프로퍼티로 주입됨 (기본 '#1976d2') */
  primaryColor: string;
  firstDay: number; // 주 시작 요일 0=일 (기본 0)
  /** 요일 라벨, 일요일부터 (기본 ['일','월','화','수','목','금','토']) */
  weekdays: string[];
}
```

- [ ] **Step 2: Confirm no other file still references the removed types**

```bash
grep -rn "CalSourceKind\|showHolidays\|RecurFreq\|RecurWeekday\|RecurrenceForm" src/
```

Expected: no output (Task 3 removes the one remaining reference, `use-recurrence.ts`, but if you're executing tasks out of order, seeing that one file here is fine — everything else should be silent).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "refactor(types): drop showHolidays/CalSourceKind, add primaryColor and CalMiniOptions, fix missing CalEvent.source"
```

---

## Task 3: Composables cleanup — fix import paths, delete use-recurrence.ts

**Files:**
- Modify: `src/composables/use-calendar-grid.ts`
- Modify: `src/composables/use-cal-tooltip.ts`
- Modify: `src/composables/use-calendar-dnd.ts`
- Modify: `src/composables/use-daygrid-layout.ts`
- Modify: `src/composables/use-event-layout.ts`
- Modify: `src/composables/use-event-order.ts`
- Delete: `src/composables/use-recurrence.ts`

**Interfaces:**
- Consumes: `CalEvent`, `CalRange`, `CalView`, `EventOrder` from `../types` (Task 2).
- Produces: no signature changes — only import paths change, every exported function name/signature is untouched, so nothing downstream needs to change because of this task.

**Context:** every one of these files lives in `src/composables/`, one directory level below `src/`, but currently imports types via `from './types'` — which resolves to the nonexistent `src/composables/types.ts`. Confirmed by reading each file: this is not hypothetical, `vite build`/`vue-tsc` both fail on these today. `use-cal-device.ts`, `use-calendar-select.ts`, and `use-dayjs-cal.ts` have no bad imports and need no changes. `use-recurrence.ts` depends on the `ical.js` package (not an approved dependency, not installed) and is not imported by `cal-calendar.vue` or `cal-mini-month.vue` or anything else in `src/` — per your decision, delete it rather than fix it.

- [ ] **Step 1: Fix `use-calendar-grid.ts`**

```
old: import type { CalRange, CalView } from './types';
new: import type { CalRange, CalView } from '../types';
```

- [ ] **Step 2: Fix `use-cal-tooltip.ts`**

```
old: import type { CalEvent } from './types';
new: import type { CalEvent } from '../types';
```

- [ ] **Step 3: Fix `use-calendar-dnd.ts`**

```
old: import type { CalEvent } from './types';
new: import type { CalEvent } from '../types';
```

- [ ] **Step 4: Fix `use-daygrid-layout.ts`**

```
old: import type { CalEvent, EventOrder } from './types';
new: import type { CalEvent, EventOrder } from '../types';
```

- [ ] **Step 5: Fix `use-event-layout.ts`**

```
old: import type { CalEvent } from './types';
new: import type { CalEvent } from '../types';
```

- [ ] **Step 6: Fix `use-event-order.ts`**

```
old: import type { CalEvent, EventOrder } from './types';
new: import type { CalEvent, EventOrder } from '../types';
```

- [ ] **Step 7: Delete `use-recurrence.ts`**

```bash
rm src/composables/use-recurrence.ts
```

- [ ] **Step 8: Verify**

```bash
grep -rn "from './types'" src/composables/
grep -rn "use-recurrence\|ical.js" src/
```

Expected: both commands produce no output.

- [ ] **Step 9: Commit**

```bash
git add -A src/composables
git commit -m "fix(composables): correct relative import paths, remove unused use-recurrence.ts"
```

---

## Task 4: Fix `cal-tooltip.vue` — remove groupware coupling

**Files:**
- Modify: `src/components/internal/cal-tooltip.vue`

**Interfaces:**
- Consumes: `useCalTooltip` from `../../composables/use-cal-tooltip` (Task 3), `CalTooltipField` from `../../types` (Task 2).
- Produces: no change to its own props (`fields?: CalTooltipField[]`) or template structure — `cal-calendar.vue` (Task 7) references `<cal-tooltip :fields="opts.tooltipFields" />` unchanged.

**Context:** this file is two directories below `src/` (`src/components/internal/`), so its relative imports need `../../`, not `./` — same bug class as Task 3, just one level deeper. `extendedProps.creator` was typed as groupware's `UserDtoNew` and rendered through `getFullNameWithLevel(creator)`; per the task spec it becomes a plain string, displayed as-is.

- [ ] **Step 1: Fix the template — display `creator` directly**

```
old:         <div class="cal-tip__row" v-if="f === 'creator' && creator">작성자: {{ getFullNameWithLevel(creator) }}</div>
new:         <div class="cal-tip__row" v-if="f === 'creator' && creator">작성자: {{ creator }}</div>
```

- [ ] **Step 2: Fix the imports**

```
old:
  import { getFullNameWithLevel } from '@/utils';
  import type { UserDtoNew } from '@tienipia-official/saeroun-groupware-api';
  import { useCalTooltip } from './use-cal-tooltip';
  import type { CalTooltipField } from './types';

new:
  import { useCalTooltip } from '../../composables/use-cal-tooltip';
  import type { CalTooltipField } from '../../types';
```

- [ ] **Step 3: Fix the `creator` computed's type cast**

```
old: const creator = computed(() => state.event?.extendedProps?.creator as UserDtoNew | undefined);
new: const creator = computed(() => state.event?.extendedProps?.creator as string | undefined);
```

- [ ] **Step 4: Verify**

```bash
grep -n "@/\|tienipia\|UserDtoNew\|getFullNameWithLevel\|'./" src/components/internal/cal-tooltip.vue
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/internal/cal-tooltip.vue
git commit -m "fix(cal-tooltip): remove groupware user-formatting dependency, fix import paths"
```

---

## Task 5: Fix `cal-month-view.vue` — import paths, drop holidays, drop stray CSS var

**Files:**
- Modify: `src/components/internal/cal-month-view.vue`

**Interfaces:**
- Consumes: `CalEvent`, `EventOrder` from `../../types`; `DayGridSegment`, `layoutDayGridRow`, `eventEndDay` from `../../composables/use-daygrid-layout`; `defaultEventOrder` from `../../composables/use-event-order`; `useCalendarDnd` from `../../composables/use-calendar-dnd`; `useCalendarSelect`, `useSelectPreview` from `../../composables/use-calendar-select`; `fmtEventTime`, `dayLabel` from `../../format`; `useCalTooltip` from `../../composables/use-cal-tooltip` (all Task 2/3).
- Produces: `props` no longer includes `holidays: Set<string>` — `cal-calendar.vue` (Task 7) must stop passing a `:holidays` binding to this component, or Vue will warn about an unknown attribute being passed through.

**Context:** this internal component redeclares `--cal-primary: rgb(var(--v-theme-primary))` on its own root class `.cal-month`. Since `.cal-month` is always rendered as a descendant of `cal-calendar.vue`'s `.cal` root (never used standalone), and CSS custom properties resolve to the *closest declaring element*, this local redeclaration **shadows** the real value flowing down from `.cal` — once `.cal`'s `--cal-primary` becomes a caller-configurable color (Task 7), this file's own redeclaration would silently keep the "today" day-number background locked to a broken `rgb(var(--v-theme-primary))` (which resolves to nothing, since Vuetify's variable no longer exists, falling back to the hardcoded `#2563eb` in `var(--cal-primary, #2563eb)`). The fix is to delete the line, not translate it, so the value inherits correctly. Separately, the `holidays` prop and its two call sites are removed per your decision to drop the holidays feature.

- [ ] **Step 1: Fix the import block**

```
old:
  import type { Dayjs } from 'dayjs';
  import type { CalEvent, EventOrder } from './types';
  import type { DayGridSegment } from './use-daygrid-layout';
  import { layoutDayGridRow, eventEndDay } from './use-daygrid-layout';
  import { defaultEventOrder } from './use-event-order';
  import { useCalendarDnd } from './use-calendar-dnd';
  import { useCalendarSelect, useSelectPreview } from './use-calendar-select';
  import { fmtEventTime, dayLabel } from './format';
  import { useCalTooltip } from './use-cal-tooltip';

new:
  import type { Dayjs } from 'dayjs';
  import type { CalEvent, EventOrder } from '../../types';
  import type { DayGridSegment } from '../../composables/use-daygrid-layout';
  import { layoutDayGridRow, eventEndDay } from '../../composables/use-daygrid-layout';
  import { defaultEventOrder } from '../../composables/use-event-order';
  import { useCalendarDnd } from '../../composables/use-calendar-dnd';
  import { useCalendarSelect, useSelectPreview } from '../../composables/use-calendar-select';
  import { fmtEventTime, dayLabel } from '../../format';
  import { useCalTooltip } from '../../composables/use-cal-tooltip';
```

- [ ] **Step 2: Remove `holidays` from `defineProps`**

```
old:
  const props = defineProps<{
    weeks: Dayjs[][];
    events: CalEvent[];
    editable?: boolean;
    holidays: Set<string>;
    today: Dayjs;

new:
  const props = defineProps<{
    weeks: Dayjs[][];
    events: CalEvent[];
    editable?: boolean;
    today: Dayjs;
```

- [ ] **Step 3: Remove holiday handling from `daynumClass`**

```
old:
  function daynumClass(day: Dayjs): Record<string, boolean> {
    const dow = day.day(); // 0=일, 6=토
    const key = day.format('YYYY-MM-DD');
    const isHoliday = props.holidays.has(key);
    const isSun = dow === 0;
    const isSat = dow === 6;
    const isToday = day.isSame(props.today, 'day');
    const isMuted = day.month() !== anchorMonth.value;

    return {
      'cal--sun': isSun && !isToday,
      'cal--sat': isSat && !isToday,
      'cal--holiday': isHoliday && !isToday,
      'cal--today': isToday,
      'cal--muted': isMuted
    };
  }

new:
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
```

- [ ] **Step 4: Remove holiday handling from `dayNumStyle`**

```
old:
  /** today → CSS handles it; muted → let cal--muted class handle grey; holiday → CSS handles it; weekdayColors → inline color; else no style */
  function dayNumStyle(day: Dayjs): Record<string, string> {
    const isToday = day.isSame(props.today, 'day');
    if (isToday) return {};
    const isMuted = day.month() !== anchorMonth.value;
    if (isMuted) return {};
    const key = day.format('YYYY-MM-DD');
    const isHoliday = props.holidays.has(key);
    if (isHoliday) return {};
    const color = props.weekdayColors?.[day.day()];
    return color ? { color } : {};
  }

new:
  /** today → CSS handles it; muted → let cal--muted class handle grey; weekdayColors → inline color; else no style */
  function dayNumStyle(day: Dayjs): Record<string, string> {
    const isToday = day.isSame(props.today, 'day');
    if (isToday) return {};
    const isMuted = day.month() !== anchorMonth.value;
    if (isMuted) return {};
    const color = props.weekdayColors?.[day.day()];
    return color ? { color } : {};
  }
```

- [ ] **Step 5: Remove the stray `--cal-primary` redeclaration**

```
old:
    --cal-sat: #2563eb;
    --cal-primary: rgb(var(--v-theme-primary));

    display: grid;

new:
    --cal-sat: #2563eb;

    display: grid;
```

- [ ] **Step 6: Remove the now-unreachable `.cal--holiday` CSS rule**

```
old:
  .cal-month__daynum.cal--today {
    background: var(--cal-primary, #2563eb);
    color: #fff;
    font-weight: 700;
    font-size: 13px;
  }

  .cal-month__daynum.cal--holiday {
    color: var(--cal-sun);
  }

  /* +N 더보기 */

new:
  .cal-month__daynum.cal--today {
    background: var(--cal-primary, #2563eb);
    color: #fff;
    font-weight: 700;
    font-size: 13px;
  }

  /* +N 더보기 */
```

- [ ] **Step 7: Verify**

```bash
grep -n "holidays\|isHoliday\|v-theme\|'./" src/components/internal/cal-month-view.vue
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/components/internal/cal-month-view.vue
git commit -m "fix(cal-month-view): fix import paths, drop holidays feature, fix --cal-primary inheritance"
```

---

## Task 6: Fix remaining internal components — import paths + one more CSS var

**Files:**
- Modify: `src/components/internal/cal-time-grid.vue`
- Modify: `src/components/internal/cal-event-bar.vue`
- Modify: `src/components/internal/cal-time-event.vue`
- Modify: `src/components/internal/cal-list-view.vue`
- Modify: `src/components/internal/cal-drag-ghost.vue`

**Interfaces:**
- Consumes: same modules as Task 5, from the same `../../types`, `../../format`, `../../composables/*` locations.
- Produces: no signature changes — every prop/emit/export in these 5 files is untouched. Purely import-path fixes, plus one CSS value swap in `cal-time-grid.vue`.

**Context:** same bug class as Tasks 3-5 (these files sit in `src/components/internal/`, imports need `../../`, not `./`). `cal-time-grid.vue` additionally has one real usage (not a redeclaration-shadowing bug like Task 5's) of the removed Vuetify variable, for the drag-and-drop preview highlight on all-day cells — this one needs the `color-mix()` treatment like `cal-calendar.vue` does (Task 7), not a deletion.

- [ ] **Step 1: Fix `cal-time-grid.vue` imports**

```
old:
  import type { Dayjs } from 'dayjs';
  import type { CalEvent, CalBusinessHours, EventOrder } from './types';
  import { layoutDay } from './use-event-layout';
  import { layoutDayGridRow, eventEndDay } from './use-daygrid-layout';
  import { useCalendarDnd, useDragPreview } from './use-calendar-dnd';
  import { useCalendarSelect, useSelectPreview } from './use-calendar-select';
  import { isTouch } from './use-cal-device';
  import { gridTimeLabel } from './format';

new:
  import type { Dayjs } from 'dayjs';
  import type { CalEvent, CalBusinessHours, EventOrder } from '../../types';
  import { layoutDay } from '../../composables/use-event-layout';
  import { layoutDayGridRow, eventEndDay } from '../../composables/use-daygrid-layout';
  import { useCalendarDnd, useDragPreview } from '../../composables/use-calendar-dnd';
  import { useCalendarSelect, useSelectPreview } from '../../composables/use-calendar-select';
  import { isTouch } from '../../composables/use-cal-device';
  import { gridTimeLabel } from '../../format';
```

- [ ] **Step 2: Fix `cal-time-grid.vue`'s drop-highlight CSS**

```
old:
  .tg-allday__cell--drop {
    background: rgba(var(--v-theme-primary), 0.12);
  }

new:
  .tg-allday__cell--drop {
    background: color-mix(in srgb, var(--cal-primary) 12%, transparent);
  }
```

- [ ] **Step 3: Fix `cal-event-bar.vue` imports**

```
old:
  import type { CalEvent } from './types';
  import { fmtEventTime } from './format';
  import { useCalTooltip } from './use-cal-tooltip';

new:
  import type { CalEvent } from '../../types';
  import { fmtEventTime } from '../../format';
  import { useCalTooltip } from '../../composables/use-cal-tooltip';
```

- [ ] **Step 4: Fix `cal-time-event.vue` imports**

```
old:
  import type { TimeBox } from './use-event-layout';
  import type { CalEvent } from './types';
  import { useCalTooltip } from './use-cal-tooltip';

new:
  import type { TimeBox } from '../../composables/use-event-layout';
  import type { CalEvent } from '../../types';
  import { useCalTooltip } from '../../composables/use-cal-tooltip';
```

- [ ] **Step 5: Fix `cal-list-view.vue` imports**

```
old:
  import type { CalEvent, CalRange, EventOrder } from './types';
  import type { Dayjs } from 'dayjs';
  import { defaultEventOrder } from './use-event-order';
  import { dayLabel } from './format';

new:
  import type { CalEvent, CalRange, EventOrder } from '../../types';
  import type { Dayjs } from 'dayjs';
  import { defaultEventOrder } from '../../composables/use-event-order';
  import { dayLabel } from '../../format';
```

- [ ] **Step 6: Fix `cal-drag-ghost.vue` imports**

```
old:
  import { useDragGhost } from './use-calendar-dnd';
  import { fmtEventTime } from './format';

new:
  import { useDragGhost } from '../../composables/use-calendar-dnd';
  import { fmtEventTime } from '../../format';
```

- [ ] **Step 7: Verify**

```bash
grep -rn "from '\./\|v-theme" src/components/internal/cal-time-grid.vue src/components/internal/cal-event-bar.vue src/components/internal/cal-time-event.vue src/components/internal/cal-list-view.vue src/components/internal/cal-drag-ghost.vue
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/components/internal/cal-time-grid.vue src/components/internal/cal-event-bar.vue src/components/internal/cal-time-event.vue src/components/internal/cal-list-view.vue src/components/internal/cal-drag-ghost.vue
git commit -m "fix(internal): correct relative import paths, replace remaining --v-theme-primary usage"
```

---

## Task 7: Fix `cal-calendar.vue` — v-ripple, theming, holidays removal, import paths

**Files:**
- Modify: `src/components/cal-calendar.vue`

**Interfaces:**
- Consumes: `CalEvent`, `CalEventInput`, `CalOptions`, `CalRange`, `CalView` from `../types` (Task 2); `useCalendarGrid` from `../composables/use-calendar-grid`; `normalizeEvent` from `../normalize`; `useCalTooltip` from `../composables/use-cal-tooltip`; `isTouch` from `../composables/use-cal-device` (all Task 2/3).
- Produces: `CalOptions.primaryColor` now actually drives the rendered accent color (previously inert/nonexistent); `<cal-month-view>` is no longer passed a `:holidays` prop (matches Task 5's prop removal).

**Context:** `v-ripple` was a Vuetify directive — this repo has no Vuetify, so it's already dead weight (would throw at runtime: "Failed to resolve directive"). Its removal needs no CSS replacement because `.cal-btn:active`/`.cal-iconbtn:active` rules already exist further down in this same file. `--v-theme-primary` was Vuetify's theme variable; it's replaced with `v-bind(primaryColor)`, Vue's native CSS-binding feature, per your original instruction. The two `rgba(var(--v-theme-primary), X)` usages become `color-mix(in srgb, var(--cal-primary) X%, transparent)`, since `--cal-primary` is now a full color value (e.g. `#1976d2`), not an "R, G, B" triplet that `rgba()` needed. `visibleEvents`/`holidays` existed solely to implement `showHolidays` filtering — since that option is gone (Task 2, your decision), both computeds collapse into just using `normalized` directly.

- [ ] **Step 1: Remove `v-ripple` from the three toolbar buttons**

```
old:
      <button class="cal-btn" v-ripple @click="today">오늘</button>
      <button class="cal-iconbtn" v-ripple @click="prev" aria-label="이전">‹</button>
      <button class="cal-iconbtn" v-ripple @click="next" aria-label="다음">›</button>

new:
      <button class="cal-btn" @click="today">오늘</button>
      <button class="cal-iconbtn" @click="prev" aria-label="이전">‹</button>
      <button class="cal-iconbtn" @click="next" aria-label="다음">›</button>
```

- [ ] **Step 2: Drop `:holidays` and rename `:events="visibleEvents"` on `<cal-month-view>`**

```
old:
        <cal-month-view
          v-if="view === 'month'"
          :day-max-events="opts.dayMaxEvents"
          :editable="opts.editable"
          :event-height="opts.eventHeight"
          :event-order="opts.eventOrder"
          :events="visibleEvents"
          :first-day="firstDay"
          :holidays="holidays"
          :resizable="opts.resizable"
          :selectable="opts.selectable"
          :today="todayDate"
          :weekday-colors="opts.weekdayColors"
          :weeks="weeks"
          @event-click="(e) => emit('eventClick', e)"
          @event-move="(p) => emit('eventMove', p)"
          @event-resize="(p) => emit('eventResize', p)"
          @more="(d) => emit('more', d)"
          @select="(r) => emit('select', r)" />

new:
        <cal-month-view
          v-if="view === 'month'"
          :day-max-events="opts.dayMaxEvents"
          :editable="opts.editable"
          :event-height="opts.eventHeight"
          :event-order="opts.eventOrder"
          :events="normalized"
          :first-day="firstDay"
          :resizable="opts.resizable"
          :selectable="opts.selectable"
          :today="todayDate"
          :weekday-colors="opts.weekdayColors"
          :weeks="weeks"
          @event-click="(e) => emit('eventClick', e)"
          @event-move="(p) => emit('eventMove', p)"
          @event-resize="(p) => emit('eventResize', p)"
          @more="(d) => emit('more', d)"
          @select="(r) => emit('select', r)" />
```

- [ ] **Step 3: Rename `:events="visibleEvents"` on `<cal-list-view>`**

```
old:
        <cal-list-view
          v-else-if="view === 'list'"
          :event-order="opts.eventOrder"
          :events="visibleEvents"
          :range="range"
          @event-click="(e) => emit('eventClick', e)" />

new:
        <cal-list-view
          v-else-if="view === 'list'"
          :event-order="opts.eventOrder"
          :events="normalized"
          :range="range"
          @event-click="(e) => emit('eventClick', e)" />
```

- [ ] **Step 4: Rename `:events="visibleEvents"` on `<cal-time-grid>`**

```
old:
        <cal-time-grid
          v-else-if="view === 'week' || view === 'day'"
          :business-hours="opts.businessHours"
          :days="days"
          :editable="opts.editable"
          :event-order="opts.eventOrder"
          :events="visibleEvents"
          :now-indicator="opts.nowIndicator"

new:
        <cal-time-grid
          v-else-if="view === 'week' || view === 'day'"
          :business-hours="opts.businessHours"
          :days="days"
          :editable="opts.editable"
          :event-order="opts.eventOrder"
          :events="normalized"
          :now-indicator="opts.nowIndicator"
```

- [ ] **Step 5: Fix the import block**

```
old:
  import type { Dayjs } from 'dayjs';
  import type { CalEvent, CalEventInput, CalOptions, CalRange, CalView } from './types';
  import { useCalendarGrid } from './use-calendar-grid';
  import { normalizeEvent } from './normalize';
  import { useCalTooltip } from './use-cal-tooltip';
  import { isTouch } from './use-cal-device';

new:
  import type { Dayjs } from 'dayjs';
  import type { CalEvent, CalEventInput, CalOptions, CalRange, CalView } from '../types';
  import { useCalendarGrid } from '../composables/use-calendar-grid';
  import { normalizeEvent } from '../normalize';
  import { useCalTooltip } from '../composables/use-cal-tooltip';
  import { isTouch } from '../composables/use-cal-device';
```

- [ ] **Step 6: Update `DEFAULT_CAL_OPTIONS` and add the `primaryColor` computed**

```
old:
  const DEFAULT_CAL_OPTIONS: CalOptions = {
    views: ['day', 'week', 'month', 'list'],
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'day,week,month,list' },
    locale: 'ko',
    firstDay: 0,
    weekends: true,
    weekdayColors: { 0: '#ef4444', 6: '#2563eb' },
    showHolidays: true,
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
  const rootStyle = computed(() => {

new:
  const DEFAULT_CAL_OPTIONS: CalOptions = {
    views: ['day', 'week', 'month', 'list'],
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'day,week,month,list' },
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
  const rootStyle = computed(() => {
```

- [ ] **Step 7: Collapse `visibleEvents`/`holidays` into plain `normalized`**

```
old:
  const normalized = computed<CalEvent[]>(() => props.events.map((e, i) => normalizeEvent(e, i)));
  const visibleEvents = computed<CalEvent[]>(() =>
    opts.value.showHolidays ? normalized.value : normalized.value.filter((e) => e.source !== 'korea')
  );
  const holidays = computed(() =>
    opts.value.showHolidays
      ? new Set(normalized.value.filter((e) => e.source === 'korea').map((e) => e.start.format('YYYY-MM-DD')))
      : new Set<string>()
  );

new:
  const normalized = computed<CalEvent[]>(() => props.events.map((e, i) => normalizeEvent(e, i)));
```

- [ ] **Step 8: Inject `primaryColor` via CSS `v-bind` on the root class**

```
old:
    --cal-sat: #2563eb;
    --cal-primary: rgb(var(--v-theme-primary));
    --cal-hour-h: 48px;

new:
    --cal-sat: #2563eb;
    --cal-primary: v-bind(primaryColor);
    --cal-hour-h: 48px;
```

- [ ] **Step 9: Replace the pill-indicator's `rgba(var(--v-theme-primary), X)`**

```
old:
    background: var(--cal-primary);
    box-shadow: 0 1px 4px rgba(var(--v-theme-primary), 0.35);

new:
    background: var(--cal-primary);
    box-shadow: 0 1px 4px color-mix(in srgb, var(--cal-primary) 35%, transparent);
```

- [ ] **Step 10: Replace the loading-bar's `rgba(var(--v-theme-primary), X)`**

```
old:
    overflow: hidden;
    background: rgba(var(--v-theme-primary), 0.12);
    z-index: 60;

new:
    overflow: hidden;
    background: color-mix(in srgb, var(--cal-primary) 12%, transparent);
    z-index: 60;
```

- [ ] **Step 11: Verify**

```bash
grep -n "v-ripple\|v-theme\|showHolidays\|visibleEvents\|holidays\|from '\./" src/components/cal-calendar.vue
```

Expected: no output.

- [ ] **Step 12: Commit**

```bash
git add src/components/cal-calendar.vue
git commit -m "fix(cal-calendar): remove v-ripple/Vuetify theming, drop holidays feature, fix import paths"
```

---

## Task 8: Fix `cal-mini-month.vue` — remove Pinia dependency, add `defineModel` + options

**Files:**
- Modify: `src/components/cal-mini-month.vue`

**Interfaces:**
- Consumes: `CalView`, `CalMiniOptions` from `../types` (Task 2); `useCalendarGrid` from `../composables/use-calendar-grid` (Task 3).
- Produces: `CalMiniMonth` now takes a plain `v-model` (`string`, ISO date) instead of reading/writing a Pinia store, and an optional `options?: Partial<CalMiniOptions>` prop (`primaryColor`, `firstDay`, `weekdays`) — `src/index.ts` (Task 9) exports `CalMiniOptions` for consumers to type this against.

**Context:** the template needs **no changes at all** — it already iterates a variable named `weekdays` and reads `selectedDate`/`title`/`days`/`today`, and this task's new script keeps those exact names, just changes what feeds them. `miniAnchor` (the currently-displayed month, moved by prev/next) stays a separate local `ref` from `selectedDate` (the `defineModel`, i.e. the actually-selected day) — clicking prev/next does not change the selection, only what's displayed; clicking a day updates both (matching the original casStore-based behavior, where a `watch` on the store synced `miniAnchor` on every change including self-triggered ones from `selectDay`). `CalMiniOptions.weekdays` lets a caller override the Korean defaults, per your original instruction; it deliberately doesn't include a `locale` field the way the placeholder in the old `index.ts` did, since nothing in this component (or `CalOptions.locale` elsewhere in this codebase) actually applies a locale — no point adding a field that does nothing.

- [ ] **Step 1: Replace the entire `<script>` block**

```
old:
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

new:
<script lang="ts" setup>
  import type { CalView, CalMiniOptions } from '../types';
  import { useCalendarGrid } from '../composables/use-calendar-grid';

  const props = defineProps<{ options?: Partial<CalMiniOptions> }>();
  const selectedDate = defineModel<string>({ default: () => dayjs().toISOString() });

  const DEFAULT_CAL_MINI_OPTIONS: CalMiniOptions = {
    primaryColor: '#1976d2',
    firstDay: 0,
    weekdays: ['일', '월', '화', '수', '목', '금', '토']
  };
  const opts = computed<CalMiniOptions>(() => ({ ...DEFAULT_CAL_MINI_OPTIONS, ...props.options }));
  const primaryColor = computed(() => opts.value.primaryColor);
  const weekdays = computed(() => opts.value.weekdays);
  const firstDay = computed(() => opts.value.firstDay);

  const view = ref<CalView>('month');
  const miniAnchor = ref(dayjs(selectedDate.value));
  const today = computed(() => dayjs());

  watch(selectedDate, (d) => {
    if (d) miniAnchor.value = dayjs(d);
  });

  const { days, title } = useCalendarGrid(view, miniAnchor, firstDay);

  function prevMonth(): void {
    miniAnchor.value = miniAnchor.value.subtract(1, 'month');
  }

  function nextMonth(): void {
    miniAnchor.value = miniAnchor.value.add(1, 'month');
  }

  function selectDay(day: ReturnType<typeof dayjs>): void {
    selectedDate.value = day.toISOString();
  }
</script>
```

- [ ] **Step 2: Inject `primaryColor` via CSS `v-bind`**

```
old:
  .cal-mini-month {
    --cal-primary: rgb(var(--v-theme-primary));
    padding: 8px;

new:
  .cal-mini-month {
    --cal-primary: v-bind(primaryColor);
    padding: 8px;
```

- [ ] **Step 3: Verify**

```bash
grep -n "casStore\|@/stores\|v-theme\|from '\./" src/components/cal-mini-month.vue
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/cal-mini-month.vue
git commit -m "fix(cal-mini-month): replace Pinia store with defineModel + CalMiniOptions"
```

---

## Task 9: Rewrite `src/index.ts` — public API surface

**Files:**
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `CalCalendar` from `./components/cal-calendar.vue` (Task 7), `CalMiniMonth` from `./components/cal-mini-month.vue` (Task 8), all six type names from `./types` (Task 2).
- Produces: the package's entire public surface — anything a consumer of this library can import.

**Context:** the current `src/index.ts` is a Copilot-scaffolded placeholder: it defines its own inline copies of `CalView`/`CalRange`/`CalEventInput`/`CalEvent`/`CalOptions`/`CalMiniOptions` (a *different*, minimal shape than the real ones in `types.ts`) and exports components from `./components/CalCalendar.vue`/`./components/CalMiniMonth.vue` — PascalCase filenames that don't exist (the real files are `cal-calendar.vue`/`cal-mini-month.vue`). None of this file's current content survives; it becomes a pure re-export.

- [ ] **Step 1: Replace the full file content**

```ts
export { default as CalCalendar } from './components/cal-calendar.vue'
export { default as CalMiniMonth } from './components/cal-mini-month.vue'
export type { CalEvent, CalEventInput, CalOptions, CalMiniOptions, CalView, CalRange } from './types'
```

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat(index): export the real components and types, drop placeholder scaffold"
```

---

## Task 10: Full verification — typecheck, build, manual smoke test

**Files:**
- Create (temporary, not committed): `playground/index.html`, `playground/main.ts`, `playground/vite.config.ts`
- No permanent source files change in this task.

**Interfaces:**
- Consumes: the public API produced by Task 9 (`CalCalendar`, `CalMiniMonth`, `CalEventInput`).

**Context:** every prior task verified itself locally (grep for leftover bad patterns in the files it touched). This task is the first point where the *whole* project is expected to be clean — every file from Tasks 1-9 is now consistent with every other file's final state.

- [ ] **Step 1: Full typecheck**

```bash
yarn typecheck
```

Expected: exits 0, no errors.

- [ ] **Step 2: Full build**

```bash
yarn build
```

Expected: exits 0. `dist/index.js`, `dist/index.d.ts`, `dist/style.css` are (re)generated.

- [ ] **Step 3: Create a throwaway playground to visually verify both components**

`playground/index.html`:
```html
<!doctype html>
<html>
  <head><meta charset="UTF-8" /><title>s-calendar playground</title></head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

`playground/main.ts`:
```ts
import { createApp, ref } from 'vue'
import { CalCalendar, CalMiniMonth } from '../src/index'
import type { CalEventInput } from '../src/index'

const App = {
  components: { CalCalendar, CalMiniMonth },
  setup() {
    const selectedDate = ref(new Date().toISOString())
    const events = ref<CalEventInput[]>([
      { id: '1', title: 'Team sync', start: new Date().toISOString(), color: '#1976d2' },
      { id: '2', title: 'Vacation', start: new Date().toISOString(), allDay: true, color: '#16a34a' }
    ])
    return { selectedDate, events }
  },
  template: `
    <div style="display:flex; gap:16px; height:100vh; padding:16px; box-sizing:border-box; font-family:sans-serif;">
      <div style="width:280px;">
        <CalMiniMonth v-model="selectedDate" :options="{ primaryColor: '#e11d48' }" />
      </div>
      <div style="flex:1;">
        <CalCalendar :events="events" :options="{ primaryColor: '#e11d48' }" />
      </div>
    </div>
  `
}

createApp(App).mount('#app')
```

`playground/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve(__dirname),
  plugins: [
    AutoImport({ imports: ['vue', '@vueuse/core', { dayjs: [['default', 'dayjs']] }] }),
    Components({ dirs: [resolve(__dirname, '../src/components')], deep: true }),
    vue()
  ]
})
```

- [ ] **Step 4: Run it and check in a browser**

```bash
npx vite --config playground/vite.config.ts
```

Open the printed `localhost` URL. Check, with the browser console open:

- No console errors (no "Failed to resolve component", no "Failed to resolve directive", no 404s for missing modules).
- `CalMiniMonth`: today and the selected day are highlighted in the red (`#e11d48`) accent color, not the default blue — confirms `primaryColor` theming actually reaches the DOM. Click a different day; the selection follows. Click ‹/›; the displayed month changes without moving the selection.
- `CalCalendar`: the view pills (일/주/월/목록) switch views; ‹/›/오늘 navigate; the two sample events render in month view; the pill indicator and loading-bar tint (best seen by throttling network, or briefly setting `:loading="true"`) use the red accent, not blue.
- Resize the window narrow (< 600px) — toolbar and pills reflow to the mobile layout without errors.

If anything above fails, stop and fix the relevant task's file before proceeding — do not patch around it from the playground.

- [ ] **Step 5: Remove the throwaway playground**

```bash
rm -rf playground
git status
```

Expected: `git status` shows no playground files (they were never staged/committed) and a clean tree relative to the last commit from Task 9.

- [ ] **Step 6: Final full-repo check**

```bash
grep -rn "@/\|v-ripple\|v-theme\|useCasStore\|tienipia\|showHolidays\|CalSourceKind\|ical\.js" src/ vite.config.ts package.json
```

Expected: no output. This is the single grep that should have caught everything this whole plan set out to fix.

---

## Self-Review

**Spec coverage:** all 7 numbered tasks and both "Groupware-specific code to remove" call-outs from the original request map onto a task above (types.ts → Task 2; cal-mini-month.vue → Task 8; cal-calendar.vue → Task 7; cal-tooltip.vue → Task 4; index.ts → Task 9; import paths → Tasks 3/4/5/6/7/8; dependencies → Task 1). Three issues were found during file-reading that weren't in the original request and are covered anyway: the undefined `CalSourceKind` / missing `CalEvent.source` compile error (Task 2), the `--v-theme-primary` reference in `cal-month-view.vue` and `cal-time-grid.vue` that the original request didn't mention (Tasks 5/6), and the stray `package-lock.json` / stale tracked `dist/` (Task 1). The `use-calendar-sources.ts` deletion from the original request needed no task — it was already absent from the working tree when this plan was written.

**Placeholder scan:** no TBD/TODO markers; every step shows the literal before/after code or an exact shell command with its expected output.

**Type consistency:** `CalMiniOptions` (defined in Task 2) has exactly the fields Task 8's `cal-mini-month.vue` reads (`primaryColor`, `firstDay`, `weekdays`) — no extra, no missing. `CalOptions.primaryColor` (Task 2) matches the field name read in Task 7's `primaryColor` computed. `CalEvent.source`/`CalEventInput.source` (Task 2, both `string`) match what `normalize.ts` already assigns and what Task 7 no longer filters on.

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-04-cal-ui-library-extraction.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
