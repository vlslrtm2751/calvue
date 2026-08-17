# Phase E — 시각 표기 통일과 `timeFormat` 옵션 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 시각 출력이 카탈로그의 단일 시계 프리미티브를 지나가게 만들고, `timeFormat` 옵션으로 12/24시간을 전역 전환할 수 있게 한다.

**Architecture:** `CalMessages`에 `clockTime(hour, minute)`과 `tooltipDateTime(d)` 두 키를 추가하고, 시각에 의존하는 5개 키(`clockTime`·`eventTime`·`dayLabel`·`gridTimeLabel`·`tooltipDateTime`)를 로케일별 **시계 함수**에서 파생시킨다. `resolveMessages(locale, overrides, timeFormat)`가 `timeFormat`에 따라 시계를 고르고, `overrides`를 마지막에 병합해 소비자의 명시적 지정이 항상 이기게 한다. 하드코딩된 네 자리(눈금·드래그 프리뷰·클러스터·툴팁)를 카탈로그 호출로 바꾼다.

**Tech Stack:** Vue 3 `<script setup>` + TypeScript, dayjs, `unplugin-auto-import`, Vite

**Spec:** `docs/superpowers/specs/2026-08-17-phase-e-time-format-design.md`

## Global Constraints

- **`unplugin-auto-import`가 켜져 있다.** `ref`·`computed`·`watch`·`nextTick`·`inject`·`provide`·`toRef` 등은 **import 문 없이** 그대로 쓴다. 새로 import 문을 추가하지 말 것.
- **테스트 프레임워크가 없다(의도된 상태).** `*.spec.ts`도 vitest 설정도 없다. 검증은 `yarn typecheck` + `yarn build` + 브라우저 QA다. **테스트 파일을 새로 만들지 말 것.**
- **이번 작업은 순수 문자열 출력이라 typecheck이 거의 잡아주지 못한다.** 반환 타입이 전부 `string`이라 "한 함수 안에서 분기마다 표기가 갈리는" 결함은 구조적으로 안 걸린다. **브라우저 QA가 유일한 게이트다.**
- **우선순위는 `locale` → `timeFormat` → `messages`.** `messages`로 넘어온 키가 **항상 이긴다.** 병합에서 `overrides`를 마지막에 spread할 것.
- **`'auto'`의 정의**: `eventTime`만 12시간, 나머지 4개 키는 24시간. `'12h'`/`'24h'`는 5개 키 전부를 한 시계로 통일.
- **기본 옵션에서 월 뷰 이벤트 시각과 목록 뷰 당일 이벤트는 v0.3.0과 동일해야 한다.** 회귀 판정 기준이다.
- **패키지 매니저는 yarn.** `yarn typecheck`, `yarn build`, `yarn play`. **`yarn dev`는 플레이그라운드가 아니다**(`vite build --watch`, `--port`를 거부한다).
- 커밋 메시지는 영어, Conventional Commits(`feat:`/`fix:`/`docs:`/`refactor:`).

---

## File Structure

| 파일 | 책임 | 태스크 |
|---|---|---|
| `src/types.ts` | `TimeFormat` 타입, `CalOptions.timeFormat`, `CalMessages` 2개 키 추가 | 1 |
| `src/i18n/messages.ts` | 시계 함수 3개, 로케일별 시간 키 빌더, `resolveMessages` 확장 | 1 |
| `src/components/cal-calendar.vue` | `DEFAULT_CAL_OPTIONS.timeFormat`, `resolveMessages`에 전달 | 2 |
| `src/components/internal/cal-time-grid.vue` | 눈금·`fmtMin`·클러스터를 카탈로그로, 종일 행에 `time-label` 전달 | 3, 4 |
| `src/components/internal/cal-tooltip.vue` | 시작·종료를 `tooltipDateTime`으로 | 3 |
| `src/components/internal/cal-time-event.vue` | 죽은 하드코딩 폴백 제거, `timeLabel` 필수화 | 3 |
| ~~`src/components/internal/cal-event-bar.vue`~~ | ~~`timeLabel` 선택 prop 추가~~ — Task 4 무효, 건드리지 않음 | ~~4~~ |
| `playground/main.ts` | `?locale=`·`?timeFormat=` 쿼리 파라미터 | 5 |
| `README.md` | `timeFormat` 옵션, 새 키 2개, 얕은 병합 경고 | 7 |

---

## Task 1: i18n 계층 — 타입·시계 함수·리졸버

**Files:**
- Modify: `src/types.ts` (`CalMessages` 인터페이스, `CalOptions`, `TimeFormat` 신규)
- Modify: `src/i18n/messages.ts` (전면 재구성)

**Interfaces:**
- Produces:
  - `export type TimeFormat = 'auto' | '12h' | '24h';` (`src/types.ts`)
  - `CalMessages.clockTime: (hour: number, minute: number) => string`
  - `CalMessages.tooltipDateTime: (d: Dayjs) => string`
  - `CalOptions.timeFormat: TimeFormat`
  - `resolveMessages(locale: string, overrides?: Partial<CalMessages>, timeFormat?: TimeFormat): CalMessages`
  - `export const ko: CalMessages` / `export const en: CalMessages` — `'auto'` 변형 (기존 export 유지)

**Context:** `CalMessages`는 공개 타입이다(`src/index.ts`에서 내보낸다). 현재 키가 27개고 이 태스크로 29개가 된다. `ko`·`en` 상수도 `CalMessages` 타입이 붙어 있어 **키를 추가하면 두 카탈로그 모두 즉시 컴파일 에러**가 난다 — 그래서 타입과 카탈로그를 한 태스크에서 같이 바꾼다.

- [ ] **Step 1: `src/types.ts`에 `TimeFormat` 타입 추가**

`export type CalTooltipField = ...` 줄 **바로 아래**에 넣는다(같은 성격의 옵션 리터럴 타입이 모여 있는 자리):

```ts
/** 시각 표기. 'auto'는 뷰별 관례(월=12시간, 주·일·목록=24시간). */
export type TimeFormat = "auto" | "12h" | "24h";
```

`src/index.ts`는 **건드리지 않는다.** `CalTooltipField`도 내보내지 않고 있고, 소비자는 `{ timeFormat: '12h' }` 리터럴로 구조적 타이핑을 통과한다.

- [ ] **Step 2: `CalOptions`에 `timeFormat` 추가**

`src/types.ts`의 `CalOptions` 안, `locale`·`messages` 바로 아래에 넣는다(i18n 관련 옵션끼리 모으기 위해):

```ts
  /** 시각 표기 (기본 'auto' = 월 12시간 / 주·일·목록 24시간). messages로 넘긴 포맷터가 이보다 우선한다 */
  timeFormat: TimeFormat;
```

- [ ] **Step 3: `CalMessages`에 키 2개 추가**

`src/types.ts`의 `CalMessages` 안, `gridTimeLabel` 줄 **바로 아래**에 넣는다:

```ts
  /** 시:분 한 지점. 주/일 눈금·드래그 프리뷰·클러스터 팝오버가 공유한다.
      Dayjs가 아니라 (hour, minute)인 이유: 드래그 프리뷰는 자정 기준 분만 들고 있고 Dayjs가 없다 */
  clockTime: (hour: number, minute: number) => string;
  /** 툴팁의 날짜+시각. 날짜가 필요해 clockTime과 분리한다 */
  tooltipDateTime: (d: Dayjs) => string;
```

- [ ] **Step 4: `messages.ts` — 시계 함수 3개를 파일 상단에 추가**

`import` 문 바로 아래, `const KO_WD = ...` **위**에 넣는다:

```ts
type Clock = (hour: number, minute: number) => string;

/** 24시간 시계 — 로케일 무관 */
const clock24: Clock = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** 한국어 12시간 시계. 정각은 '오전 9시', 그 외는 '오전 9:30' */
const koClock12: Clock = (h, m) => {
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${ampm} ${h12}시` : `${ampm} ${h12}:${String(m).padStart(2, '0')}`;
};

/** 영어 12시간 시계. 정각은 '9 AM', 그 외는 '9:30 AM' */
const enClock12: Clock = (h, m) => {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

/**
 * timeFormat에 따라 두 시계를 고른다.
 * - event: 월 뷰 이벤트 시각·드래그 고스트 (eventTime 키)
 * - grid:  주/일 눈금·이벤트 바·목록 뷰·툴팁 (나머지 4개 키)
 * 'auto'가 둘을 다르게 고르는 게 "월 12시간 / 주·일·목록 24시간" 규칙의 전부다.
 */
function pickClocks(tf: TimeFormat, clock12: Clock): { event: Clock; grid: Clock } {
  if (tf === '12h') return { event: clock12, grid: clock12 };
  if (tf === '24h') return { event: clock24, grid: clock24 };
  return { event: clock12, grid: clock24 };
}
```

`import type { CalEvent, CalMessages } from '../types';`를 `import type { CalEvent, CalMessages, TimeFormat } from '../types';`로 바꾼다.

- [ ] **Step 5: `messages.ts` — ko 시간 키 빌더로 교체**

기존 `koEventTime`·`koDayLabel`·`koGridTimeLabel` 함수 **세 개를 통째로 지우고** 그 자리에 넣는다:

```ts
type TimeKeys = Pick<CalMessages, 'clockTime' | 'eventTime' | 'dayLabel' | 'gridTimeLabel' | 'tooltipDateTime'>;

function koTimeKeys(tf: TimeFormat): TimeKeys {
  const { event, grid } = pickClocks(tf, koClock12);
  const at = (d: Dayjs) => grid(d.hour(), d.minute());
  return {
    clockTime: grid,
    eventTime: (d) => event(d.hour(), d.minute()),
    dayLabel: (ev, day) => {
      if (ev.allDay) return '종일';
      const d = day.startOf('day');
      const startsHere = ev.start.startOf('day').isSame(d);
      const endsHere = ev.end.subtract(1, 'millisecond').startOf('day').isSame(d);
      if (startsHere && endsHere) return `${at(ev.start)}–${at(ev.end)}`;
      if (startsHere) return at(ev.start);
      if (endsHere) return `${at(ev.end)} 종료`;
      return '종일';
    },
    gridTimeLabel: (ev, day) => {
      if (ev.allDay) return '종일';
      const d = day.startOf('day');
      const startsHere = ev.start.startOf('day').isSame(d);
      const endsHere = ev.end.subtract(1, 'millisecond').startOf('day').isSame(d);
      if (startsHere && endsHere) return `${at(ev.start)}–${at(ev.end)}`;
      if (startsHere) return `${at(ev.start)}~`;
      if (endsHere) return `~${at(ev.end)}`;
      return '종일';
    },
    // 날짜부는 두 로케일 모두 ISO를 유지한다 — 이번 phase는 '시각' 표기가 대상이고,
    // ISO 날짜는 로케일 중립이라 바꿀 이유가 없다. 시각부만 시계를 따른다.
    tooltipDateTime: (d) => `${d.format('YYYY-MM-DD')} ${at(d)}`
  };
}
```

**핵심**: `dayLabel`·`gridTimeLabel`의 **모든 분기가 `at()` 하나만 쓴다.** 이게 혼용을 구조적으로 불가능하게 만드는 지점이다. 분기마다 `.format('HH:mm')`을 다시 쓰지 말 것 — 그게 원래 결함이었다.

- [ ] **Step 6: `messages.ts` — en 시간 키 빌더로 교체**

기존 `enEventTime`·`enDayLabel`·`enGridTimeLabel` 함수 **세 개를 통째로 지우고** 그 자리에 넣는다:

```ts
function enTimeKeys(tf: TimeFormat): TimeKeys {
  const { event, grid } = pickClocks(tf, enClock12);
  const at = (d: Dayjs) => grid(d.hour(), d.minute());
  return {
    clockTime: grid,
    eventTime: (d) => event(d.hour(), d.minute()),
    dayLabel: (ev, day) => {
      if (ev.allDay) return 'All day';
      const d = day.startOf('day');
      const startsHere = ev.start.startOf('day').isSame(d);
      const endsHere = ev.end.subtract(1, 'millisecond').startOf('day').isSame(d);
      if (startsHere && endsHere) return `${at(ev.start)}–${at(ev.end)}`;
      if (startsHere) return at(ev.start);
      if (endsHere) return `${at(ev.end)} ends`;
      return 'All day';
    },
    gridTimeLabel: (ev, day) => {
      if (ev.allDay) return 'All day';
      const d = day.startOf('day');
      const startsHere = ev.start.startOf('day').isSame(d);
      const endsHere = ev.end.subtract(1, 'millisecond').startOf('day').isSame(d);
      if (startsHere && endsHere) return `${at(ev.start)}–${at(ev.end)}`;
      if (startsHere) return `${at(ev.start)}~`;
      if (endsHere) return `~${at(ev.end)}`;
      return 'All day';
    },
    tooltipDateTime: (d) => `${d.format('YYYY-MM-DD')} ${at(d)}`
  };
}
```

- [ ] **Step 7: `messages.ts` — 카탈로그를 정적부/시간부로 분리**

기존 `export const ko: CalMessages = { ... };`를 아래로 바꾼다. **시간 키 5개를 객체 리터럴에서 빼고** 이름을 `koStatic`으로 바꾼 뒤 타입 주석을 제거한다(더 이상 `CalMessages` 전체를 만족하지 않는다):

```ts
const koStatic = {
  today: '오늘',
  prev: '이전',
  next: '다음',
  viewDay: '일',
  viewWeek: '주',
  viewMonth: '월',
  viewList: '목록',
  allDay: '종일',
  creator: '작성자',
  start: '시작',
  end: '종료',
  close: '닫기',
  resizeHint: '기간 조절',
  noEvents: '이 기간에 일정이 없습니다.',
  noEventsOnDay: '일정 없음',
  todaySuffix: '오늘',
  more: (n: number) => `+${n} 더보기`,
  overlapCount: (n: number) => `겹친 일정 ${n}건`,
  weekdaysShort: KO_WD,
  monthTitle: (d: Dayjs) => d.format('YYYY년 M월'),
  dayTitle: (d: Dayjs) => `${d.format('YYYY년 M월 D일')} (${KO_WD[d.day()]})`,
  weekTitle: koWeekTitle,
  popoverDate: (d: Dayjs) => `${d.format('M월 D일')} (${KO_WD[d.day()]})`,
  listMonthHeader: (d: Dayjs) => d.format('YYYY년 M월')
};
```

**주의**: 타입 주석을 떼면 화살표 함수 인자의 타입 추론이 사라진다. 위처럼 `(n: number)`·`(d: Dayjs)`로 **명시적으로 붙여야** 한다. 빠뜨리면 `implicit any` 에러가 난다.

`en`도 동일하게 `enStatic`으로 바꾼다 — 시간 키 5개(`eventTime`·`dayLabel`·`gridTimeLabel`)를 빼고, 인자 타입을 명시한다:

```ts
const enStatic = {
  today: 'Today',
  prev: 'Previous',
  next: 'Next',
  viewDay: 'Day',
  viewWeek: 'Week',
  viewMonth: 'Month',
  viewList: 'List',
  allDay: 'All day',
  creator: 'Creator',
  start: 'Start',
  end: 'End',
  close: 'Close',
  resizeHint: 'Resize',
  noEvents: 'No events in this period.',
  noEventsOnDay: 'No events',
  todaySuffix: 'Today',
  more: (n: number) => `+${n} more`,
  overlapCount: (n: number) => `${n} overlapping`,
  weekdaysShort: EN_WD,
  monthTitle: (d: Dayjs) => `${EN_MON_FULL[d.month()]} ${d.year()}`,
  dayTitle: (d: Dayjs) => `${EN_WD[d.day()]}, ${EN_MON_SHORT[d.month()]} ${d.date()}, ${d.year()}`,
  weekTitle: enWeekTitle,
  popoverDate: (d: Dayjs) => `${EN_MON_SHORT[d.month()]} ${d.date()} (${EN_WD[d.day()]})`,
  listMonthHeader: (d: Dayjs) => `${EN_MON_FULL[d.month()]} ${d.year()}`
};
```

- [ ] **Step 8: `messages.ts` — 리졸버 교체**

파일 맨 아래 `// ─── resolver ───` 블록 전체를 바꾼다:

```ts
// ─── resolver ─────────────────────────────────────────────────────────────────
const BUILTINS: Record<string, (tf: TimeFormat) => CalMessages> = {
  ko: (tf) => ({ ...koStatic, ...koTimeKeys(tf) }),
  en: (tf) => ({ ...enStatic, ...enTimeKeys(tf) })
};

/** 'auto' 변형. 기존 export 호환을 위해 유지한다.
    ko는 지우면 안 된다 — use-cal-i18n.ts가 provider 없는 단독 사용 폴백으로 쓴다. */
export const ko: CalMessages = BUILTINS.ko('auto');
export const en: CalMessages = BUILTINS.en('auto');

/**
 * locale로 내장 카탈로그 선택(미지원 → ko) → timeFormat으로 시계 변형 선택 →
 * overrides를 키 단위 얕은 병합.
 * overrides가 **마지막**이라 소비자가 messages로 넘긴 포맷터는 timeFormat을 이긴다.
 */
export function resolveMessages(
  locale: string,
  overrides?: Partial<CalMessages>,
  timeFormat: TimeFormat = 'auto'
): CalMessages {
  const build = Object.prototype.hasOwnProperty.call(BUILTINS, locale) ? BUILTINS[locale] : BUILTINS.ko;
  const base = build(timeFormat);
  return overrides ? { ...base, ...overrides } : base;
}
```

- [ ] **Step 9: typecheck**

```bash
yarn typecheck
```

기대: 통과. 실패하면 대부분 Step 7의 인자 타입 누락(`implicit any`)이다.

- [ ] **Step 10: 커밋**

```bash
git add src/types.ts src/i18n/messages.ts
git commit -m "feat(i18n): derive time keys from a per-locale clock, add timeFormat

dayLabel and gridTimeLabel returned 24-hour for a same-day range and
12-hour for the partial-day branches, in both catalogs, so one list
column could show 10:00-11:00 and 10 PM at the same time. Every branch
now goes through a single clock function, which makes the split
impossible to reintroduce by editing one branch.

Adds clockTime and tooltipDateTime so the hardcoded call sites in the
grid and tooltip have somewhere to move to (next task)."
```

---

## Task 2: 옵션 배선

**Files:**
- Modify: `src/components/cal-calendar.vue` (`DEFAULT_CAL_OPTIONS`, `messages` computed)

**Interfaces:**
- Consumes: `resolveMessages(locale, overrides?, timeFormat?)`, `CalOptions.timeFormat` (Task 1)
- Produces: 없음 — 이 태스크 이후 `timeFormat`이 실제로 동작한다

- [ ] **Step 1: `DEFAULT_CAL_OPTIONS`에 기본값 추가**

`src/components/cal-calendar.vue`의 `DEFAULT_CAL_OPTIONS` 객체에서 `locale: 'ko',` **바로 아래**에 넣는다:

```ts
    timeFormat: 'auto',
```

- [ ] **Step 2: `resolveMessages` 호출에 전달**

같은 파일에서 이 줄을 찾는다:

```ts
  const messages = computed(() => resolveMessages(opts.value.locale, opts.value.messages));
```

이렇게 바꾼다:

```ts
  const messages = computed(() => resolveMessages(opts.value.locale, opts.value.messages, opts.value.timeFormat));
```

- [ ] **Step 3: typecheck**

```bash
yarn typecheck
```

기대: 통과.

- [ ] **Step 4: 커밋**

```bash
git add src/components/cal-calendar.vue
git commit -m "feat(options): wire timeFormat through to message resolution"
```

---

## Task 3: 하드코딩된 시각 출력을 카탈로그로

**Files:**
- Modify: `src/components/internal/cal-time-grid.vue` (눈금, `fmtMin`, 클러스터 팝오버)
- Modify: `src/components/internal/cal-tooltip.vue` (시작·종료)
- Modify: `src/components/internal/cal-time-event.vue` (죽은 폴백 제거)

**Interfaces:**
- Consumes: `m.clockTime(hour, minute)`, `m.tooltipDateTime(d)` (Task 1)

**Context:** 네 자리가 카탈로그를 우회해 직접 `.format('HH:mm')`을 부른다. 남겨두면 `timeFormat`을 무시한다.

- [ ] **Step 1: 시간 눈금**

`src/components/internal/cal-time-grid.vue`에서 이 블록을 찾는다:

```html
          <div class="tg-hour" v-for="(h, i) in HOURS" :key="h">{{
            i > 0 ? `${String(h).padStart(2, '0')}:00` : ''
          }}</div>
```

이렇게 바꾼다:

```html
          <div class="tg-hour" v-for="(h, i) in HOURS" :key="h">{{ i > 0 ? m.clockTime(h, 0) : '' }}</div>
```

`i > 0` 조건은 그대로 둔다 — 첫 칸은 헤더와 겹쳐서 원래 비운다.

- [ ] **Step 2: `fmtMin`**

같은 파일에서 이 함수를 찾는다:

```ts
  function fmtMin(m: number): string {
    const t = ((m % 1440) + 1440) % 1440;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }
```

이렇게 바꾼다. **인자 이름을 `m` → `min`으로 바꿔야 한다** — 이 파일에서 `m`은 i18n 카탈로그(`const m = useCalI18n()`)라 인자가 그걸 가린다:

```ts
  function fmtMin(min: number): string {
    const t = ((min % 1440) + 1440) % 1440;
    return m.value.clockTime(Math.floor(t / 60), t % 60);
  }
```

`useCalI18n()`은 `Ref<CalMessages>`를 돌려준다. 그래서 `<script>` 안에서는 **`m.value.clockTime`**, 템플릿에서는 자동 unwrap되어 `m.clockTime`이다. 이 파일의 `<script>`에는 아직 `m`을 쓰는 곳이 `const m = useCalI18n()` 선언 하나뿐이라 참고할 기존 호출부가 없다 — `fmtMin`이 첫 번째다. `.value`를 빠뜨리면 런타임에 `undefined is not a function`이 나고 typecheck에서는 잡힌다.

- [ ] **Step 3: 터치 클러스터 팝오버**

같은 파일에서 이 줄을 찾는다:

```html
            <span class="tg-cluster__time">{{ ev.start.format('HH:mm') }}–{{ ev.end.format('HH:mm') }}</span>
```

이렇게 바꾼다:

```html
            <span class="tg-cluster__time"
              >{{ m.clockTime(ev.start.hour(), ev.start.minute()) }}–{{
                m.clockTime(ev.end.hour(), ev.end.minute())
              }}</span
            >
```

- [ ] **Step 4: 툴팁**

`src/components/internal/cal-tooltip.vue`에서 이 두 줄을 찾는다:

```html
          <div class="cal-tip__row" v-else-if="f === 'start'"
            >{{ m.start }}: {{ state.event.start.format('YYYY-MM-DD HH:mm') }}</div
          >
          <div class="cal-tip__row" v-else-if="f === 'end'"
            >{{ m.end }}: {{ state.event.end.format('YYYY-MM-DD HH:mm') }}</div
          >
```

이렇게 바꾼다:

```html
          <div class="cal-tip__row" v-else-if="f === 'start'"
            >{{ m.start }}: {{ m.tooltipDateTime(state.event.start) }}</div
          >
          <div class="cal-tip__row" v-else-if="f === 'end'"
            >{{ m.end }}: {{ m.tooltipDateTime(state.event.end) }}</div
          >
```

- [ ] **Step 5: `cal-time-event.vue`의 죽은 폴백 제거**

`src/components/internal/cal-time-event.vue`에서 이 부분을 찾는다:

```ts
  // per-day 라벨(멀티데이: 시작일 "HH:mm~" / 중간일 "종일" / 종료일 "~HH:mm")이 넘어오면 그걸, 없으면 당일 범위
  const label = computed(
    () => props.timeLabel ?? `${props.box.event.start.format('HH:mm')}–${props.box.event.end.format('HH:mm')}`
  );
```

유일한 호출부(`cal-time-grid.vue`의 `:time-label="m.gridTimeLabel(box.event, day)"`)가 **항상** 값을 넘기므로 `??` 뒤는 도달 불가능하다. 남겨두면 나중에 규칙 밖으로 샌다. 폴백을 지우고 prop을 필수로 바꾼다:

```ts
  // per-day 라벨(멀티데이: 시작일 "HH:mm~" / 중간일 "종일" / 종료일 "~HH:mm"). 카탈로그에서 나온다
  const label = computed(() => props.timeLabel);
```

같은 파일의 `defineProps`에서 `timeLabel?: string`을 `timeLabel: string`으로 바꾼다(물음표 제거).

- [ ] **Step 6: 남은 하드코딩이 없는지 확인**

```bash
grep -rn "format('HH:mm')\|padStart(2, '0')}:00\|YYYY-MM-DD HH:mm" src/components/
```

기대: **출력 없음.** 무언가 남았다면 그 자리도 `clockTime`/`tooltipDateTime`으로 바꾼다.

(`src/i18n/messages.ts`는 검색 대상이 아니다 — 시계 함수가 거기 살아야 한다.)

- [ ] **Step 7: typecheck**

```bash
yarn typecheck
```

기대: 통과. `cal-time-event.vue`의 prop을 필수로 바꿨으므로, 호출부가 값을 안 넘기고 있었다면 여기서 잡힌다.

- [ ] **Step 8: 커밋**

```bash
git add src/components/internal/cal-time-grid.vue src/components/internal/cal-tooltip.vue src/components/internal/cal-time-event.vue
git commit -m "refactor(i18n): route hardcoded clock output through the catalog

The hour gutter, drag preview, cluster popover and tooltip each formatted
time themselves, so they ignored locale entirely and would have ignored
timeFormat too. Also drops cal-time-event's unreachable HH:mm fallback --
the grid always passes time-label -- so there is no hardcoded path left
for a future edit to revive."
```

---

## Task 4: 주/일 종일 행을 24시간으로 — ❌ 무효 (구현 후 되돌림)

> **이 태스크는 존재하지 않는 문제를 고쳤다. 구현했다가 되돌렸으니 다시 실행하지 말 것.**
>
> `cal-time-grid.vue:328`이 `allDayEvents = props.events.filter((e) => e.allDay)`라 **종일 행에는 `allDay: true` 이벤트만 들어간다.** 그런데 `cal-event-bar.vue`의 시각 span은 `v-if="!event.allDay && !continued"`로 막혀 있어, 그 행이 담을 수 있는 모든 이벤트에서 시각이 **아예 렌더링되지 않는다.**
>
> 시간이 있는 멀티데이 이벤트는 종일 행이 아니라 시간 그리드로 간다(같은 파일 348행). 거기 라벨인 `gridTimeLabel`은 모든 분기가 원래부터 24시간이다. **주/일 뷰에는 혼용이 없다.**
>
> 아래 원문은 기록으로 남긴다. 스펙의 정정 절 참조.

**Files:**
- Modify: `src/components/internal/cal-event-bar.vue` (`timeLabel` 선택 prop 추가)
- Modify: `src/components/internal/cal-time-grid.vue` (종일 행에서 `time-label` 전달)

**Interfaces:**
- Consumes: `m.clockTime(hour, minute)` (Task 1)
- Produces: `cal-event-bar`의 `timeLabel?: string` prop

**Context — 이 태스크가 왜 따로 있나:** `cal-event-bar`는 **두 곳**에서 쓰인다. 월 뷰(`cal-month-view.vue`)와 주/일 뷰의 **종일 행**(`cal-time-grid.vue`)이다. 그런데 `'auto'`에서 월 뷰는 12시간, 주/일은 24시간이어야 한다. **같은 컴포넌트, 같은 키(`m.eventTime`), 다른 요구.** 그래서 키 변형만으로는 표현할 수 없고, 호출부가 라벨을 넘기는 방식이 필요하다.

이 패턴은 이 저장소에 이미 있다 — `cal-time-event`가 `timeLabel`을 부모에게서 받는다. 같은 방식을 따른다.

- [ ] **Step 1: `cal-event-bar`에 선택 prop 추가**

`src/components/internal/cal-event-bar.vue`의 `defineProps`를 찾는다:

```ts
  const props = defineProps<{ event: CalEvent; resizableEnd?: boolean; continued?: boolean }>();
```

이렇게 바꾼다:

```ts
  // timeLabel: 부모가 표기를 지정할 때 쓴다(주/일 종일 행은 24시간, 월 뷰는 기본 eventTime).
  // 미지정 시 카탈로그의 eventTime — 월 뷰의 기존 동작이 그대로 유지된다.
  const props = defineProps<{
    event: CalEvent;
    resizableEnd?: boolean;
    continued?: boolean;
    timeLabel?: string;
  }>();
```

- [ ] **Step 2: 템플릿에서 사용**

같은 파일에서 이 줄을 찾는다:

```html
    <span class="cal-evt__time" v-if="!event.allDay && !continued">{{ m.eventTime(event.start) }}</span>
```

이렇게 바꾼다:

```html
    <span class="cal-evt__time" v-if="!event.allDay && !continued">{{
      timeLabel ?? m.eventTime(event.start)
    }}</span>
```

- [ ] **Step 3: 주/일 종일 행에서 전달**

`src/components/internal/cal-time-grid.vue`의 종일 행 `<cal-event-bar>`를 찾는다. `v-for="seg in allDayLayout.segments"`가 붙은 쪽이다(월 뷰의 것과 헷갈리지 말 것 — 이 파일에는 하나뿐이다). `:event="seg.event"` **바로 아래**에 넣는다:

```html
          :time-label="m.clockTime(seg.event.start.hour(), seg.event.start.minute())"
```

- [ ] **Step 4: 월 뷰는 건드리지 않는지 확인**

```bash
grep -n "time-label" src/components/internal/cal-month-view.vue
```

기대: **출력 없음.** 월 뷰는 `timeLabel`을 넘기지 않아야 `m.eventTime`(12시간) 기존 동작이 유지된다.

- [ ] **Step 5: typecheck**

```bash
yarn typecheck
```

기대: 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/components/internal/cal-event-bar.vue src/components/internal/cal-time-grid.vue
git commit -m "fix(week-view): show 24-hour time in the all-day row

cal-event-bar renders in both the month view and the week/day all-day
row, so its single m.eventTime call forced one convention on both. The
all-day row sits directly above a 24-hour gutter while showing 12-hour
labels. Parent now passes an explicit time-label there; the month view
passes nothing and keeps eventTime."
```

---

## Task 5: 플레이그라운드 쿼리 파라미터

**Files:**
- Modify: `playground/main.ts`

**Context — 왜 필요한가:** 이 결함이 살아남은 **원인**이 "`en` 경로가 개발 중 한 번도 실행된 적 없음"이다. `playground/main.ts`의 `<CalCalendar>`에 `:options`가 아예 없다. 원인을 안 고치면 다음 로케일 결함도 똑같이 안 걸린다. `view`를 쿼리스트링으로 받는 기존 방식을 그대로 따른다.

- [ ] **Step 1: setup에서 쿼리 파라미터 읽기**

`playground/main.ts`의 `setup()` 안, `const view = ref(...)` 줄 **바로 아래**에 넣는다:

```ts
    const q = new URLSearchParams(location.search)
    // 로케일·시각표기를 쿼리로 바꿀 수 있어야 한다 — 이게 없어서 en 경로가 개발 중 한 번도 안 돌았다
    const calOptions = {
      locale: q.get('locale') || 'ko',
      timeFormat: (q.get('timeFormat') as 'auto' | '12h' | '24h') || 'auto'
    }
```

- [ ] **Step 2: setup 반환값에 추가**

같은 파일에서 이 줄을 찾는다:

```ts
    return { view, selectedDate, events }
```

이렇게 바꾼다:

```ts
    return { view, selectedDate, events, calOptions }
```

- [ ] **Step 3: 템플릿에서 전달**

같은 파일의 템플릿에서 이 줄을 찾는다:

```html
        <CalCalendar v-model:view="view" :events="events" />
```

이렇게 바꾼다:

```html
        <CalCalendar v-model:view="view" :events="events" :options="calOptions" />
```

- [ ] **Step 4: 시간이 있는 멀티데이 이벤트를 픽스처에 추가**

**이게 없으면 12시간 분기에 도달조차 못 한다.** 기존 픽스처의 멀티데이 이벤트(`워크숍`, `휴가`)는 전부 `allDay: true`라 `dayLabel`의 부분일 분기를 타지 않는다. 조사 때 실제로 이것 때문에 결함이 처음엔 재현되지 않았다.

`events` 배열의 마지막 항목(`id: '10'`) 뒤에 쉼표를 붙이고 추가한다:

```ts
      // 시간이 있는 멀티데이 — dayLabel의 부분일 분기(시작만/끝만 걸침)를 타는 유일한 형태다.
      // 이게 없으면 12/24시간 혼용 결함이 화면에 나타나지 않는다
      { id: '11', title: '출장 (시간 멀티데이)', start: `${M}-11T22:00:00`, end: `${M}-13T03:00:00`, color: '#db2777' }
```

- [ ] **Step 5: 구동 확인**

```bash
yarn play --port 5250 --strictPort
```

브라우저에서 `http://localhost:5250/?view=list&locale=en`을 열어 툴바가 `Today`·`Day`·`Week`·`Month`·`List`로 나오는지 확인한다. 안 바뀌면 `:options`가 전달되지 않은 것이다.

- [ ] **Step 6: 커밋**

```bash
git add playground/main.ts
git commit -m "chore(playground): expose locale and timeFormat as query params

The playground never passed :options, so the en catalog had never once
rendered in development -- which is why a 12/24-hour split inside a
single function survived. Also adds a timed multi-day event: the
partial-day branches of dayLabel are unreachable with all-day events,
so without it the split does not appear on screen at all."
```

---

## Task 6: 눈금 폭 실측과 대응

**Files:**
- Modify: `src/components/internal/cal-time-grid.vue` (실측 결과에 따라 CSS 또는 시계 함수)

**Context:** 스펙이 미해결로 남긴 항목이다. `timeFormat: '12h'` + 한국어에서 `오후 12시`가 눈금 폭을 넘길 것으로 **추정**된다. 눈금은 `--cal-gutter` 기본 56px, `max-width: 600px`에서 42px이고 `padding-right`는 6px/4px, 글꼴은 11px/10px이다.

**추정치로 코드를 고치지 말 것. 먼저 측정한다.**

- [ ] **Step 1: 측정 스크립트 작성**

스크래치패드에 만든다(저장소에 커밋하지 않는다). Playwright는 프로젝트 의존성이 아니라 npx 캐시에 있다 — `NODE_PATH`로 지정해야 한다:

```js
const { chromium } = require('playwright');
const BASE = 'http://localhost:5250';

(async () => {
  const b = await chromium.launch({ headless: true });
  const out = {};
  for (const [label, w] of [['default', 1200], ['narrow', 560]]) {
    for (const locale of ['ko', 'en']) {
      const p = await b.newPage({ viewport: { width: w, height: 800 } });
      await p.goto(`${BASE}/?view=week&locale=${locale}&timeFormat=12h`, { waitUntil: 'networkidle' });
      await p.waitForSelector('.tg-hour', { timeout: 15000 });
      await p.waitForTimeout(300);
      out[`${label}-${locale}`] = await p.evaluate(() => {
        const cells = [...document.querySelectorAll('.tg-hour')].filter((e) => e.textContent.trim());
        const over = cells.filter((e) => e.scrollWidth > e.clientWidth);
        return {
          gutterWidth: Math.round(document.querySelector('.tg-gutter').getBoundingClientRect().width),
          sample: cells.slice(0, 3).map((e) => e.textContent.trim()),
          widest: Math.max(...cells.map((e) => e.scrollWidth)),
          clientWidth: cells[0] ? cells[0].clientWidth : null,
          overflowCount: over.length,
          overflowSamples: over.slice(0, 3).map((e) => e.textContent.trim())
        };
      });
      await p.close();
    }
  }
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
```

- [ ] **Step 2: 실행**

```bash
yarn play --port 5250 --strictPort   # 별도 셸에서
NODE_PATH="C:/Users/GE63/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules" node <스크립트경로>
```

`_npx` 해시 디렉터리가 여러 개 있고 버전이 다르다. `chromium.launch()`가 "Executable doesn't exist"로 실패하면 다른 해시를 쓰거나 `npx --no-install playwright install chromium`을 한 번 돌린다.

- [ ] **Step 3: 결과에 따라 대응**

**`overflowCount`가 모든 조합에서 0이면** — 아무것도 고치지 않는다. Step 4로 건너뛴다.

**넘치는 조합이 있으면** 아래 중에서 고른다. 판단 기준은 "`'auto'`(기본값)를 건드리지 않을 것":

- **(a) `'12h'`일 때만 눈금 폭 상향** — `.tg`에 `--cal-gutter`를 키우는 클래스를 붙인다. 기본값에 영향이 없어 가장 안전하다. `cal-time-grid.vue`가 `timeFormat`을 prop으로 받아야 하는지 확인할 것(현재는 안 받는다 — 받아야 하면 `cal-calendar.vue`에서 내려야 한다).
- **(b) 한국어 12시간 눈금만 압축형** — `koClock12`를 그대로 두고, 눈금 호출부에서 `m.clockTime(h, 0)` 대신 압축 표기를 쓴다. 다만 이러면 눈금만 다른 규칙을 갖게 되어 이번 phase의 취지에 어긋난다. 권장하지 않는다.
- **(c) 눈금은 `'12h'`에서도 24시간 유지** — 가장 단순하지만 옵션의 의미가 부분적으로 무너진다. 다른 방법이 다 나쁠 때만.

**(a)를 우선 검토한다.** 어느 쪽을 골랐든 **왜 골랐는지와 측정값을 커밋 메시지에 남긴다.**

- [ ] **Step 4: 대응했다면 재측정**

Step 1의 스크립트를 다시 돌려 `overflowCount`가 0이 되었는지 확인한다.

- [ ] **Step 5: 커밋**

변경이 있었을 때만:

```bash
git add src/components/internal/cal-time-grid.vue
git commit -m "fix(week-view): keep the hour gutter from clipping 12-hour labels

<측정값과 선택한 방안을 여기 적는다>"
```

변경이 없었으면(넘침 0) 커밋하지 않고 다음 태스크로 간다.

---

## Task 7: README와 최종 QA

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: 앞선 모든 태스크

- [ ] **Step 1: `CalOptions` 표에 `timeFormat` 추가**

`README.md`의 `### CalOptions` 표에서 `locale` 행 **바로 아래**에 넣는다:

```markdown
| `timeFormat` | `'auto' \| '12h' \| '24h'` | `'auto'` | 시각 표기. `'auto'`는 뷰별 관례(월=12시간, 주·일·목록=24시간). `messages`로 넘긴 포맷터가 이 옵션보다 우선합니다 |
```

- [ ] **Step 2: 로케일 절의 과장된 문장 수정**

`## 로케일 (i18n)` 절에서 이 문장을 찾는다:

```
`ko`(기본)·`en` 카탈로그가 내장되어 있습니다. 버튼·라벨 같은 UI 문자열과 날짜·시간 포맷터가 전부 카탈로그에서 나오므로, 옵션 하나로 전체가 전환됩니다.
```

이 문장은 이번 작업 **전에는 사실이 아니었다**(눈금·툴팁이 카탈로그를 우회했다). 이제 사실이 되었으므로 문장은 유지하되, 시각 표기 축을 덧붙인다:

```markdown
`ko`(기본)·`en` 카탈로그가 내장되어 있습니다. 버튼·라벨 같은 UI 문자열과 날짜·시간 포맷터가 전부 카탈로그에서 나오므로, 옵션 하나로 전체가 전환됩니다.

12/24시간 표기는 언어와 별개 축입니다. `timeFormat` 옵션으로 로케일과 무관하게 전환할 수 있습니다:

| `timeFormat` | 월 뷰 | 주/일 뷰 | 목록 뷰 | 툴팁 |
|---|---|---|---|---|
| `'auto'` (기본) | 12시간 | 24시간 | 24시간 | 24시간 |
| `'12h'` | 12시간 | 12시간 | 12시간 | 12시간 |
| `'24h'` | 24시간 | 24시간 | 24시간 | 24시간 |

`'auto'`가 뷰마다 다른 이유: 월 뷰는 단일 시각을 여백 속에 찍어 `오전 9시`가 자연스럽지만, 주/일 뷰에는 시간 눈금이라는 24시간 기준 축이 화면에 있어 그 옆 라벨이 12시간이면 대조되지 않습니다.
```

- [ ] **Step 3: 얕은 병합 경고에 새 키 2개 반영**

`README.md`에서 `noEventsOnDay`를 경고하는 문단을 찾는다(`완전한 커스텀 로케일을 채울 때는 `noEventsOnDay` 키를...`로 시작한다). 그 **바로 아래**에 문단을 추가한다:

```markdown
같은 이유로 `clockTime`(시:분 한 지점)과 `tooltipDateTime`(툴팁의 날짜+시각)도 빠뜨리지 마세요. 이 둘이 없으면 주/일 눈금·드래그 프리뷰·클러스터 팝오버·툴팁이 한국어 기본 표기로 조용히 폴백합니다. `clockTime`은 `Dayjs`가 아니라 `(hour, minute)`을 받습니다 — 드래그 프리뷰는 자정 기준 분만 들고 있어 `Dayjs`가 없기 때문입니다.
```

- [ ] **Step 4: `CalMessages` 설명에 두 키 언급**

`README.md`에서 `` `CalMessages`에는 정적 문자열 외에 ``로 시작하는 문장을 찾아, 포맷터 예시 목록에 두 키를 넣는다:

```
(`monthTitle`, `eventTime`, `popoverDate` 등)
```
→
```
(`monthTitle`, `eventTime`, `clockTime`, `tooltipDateTime`, `popoverDate` 등)
```

- [ ] **Step 5: 최종 브라우저 QA**

`yarn play --port 5250 --strictPort`로 띄우고 Playwright로 확인한다. **조건을 먼저 증명할 것** — 목록에 시간 멀티데이 이벤트(`출장`)가 실제로 3일치 행으로 나타나는지부터 확인하고, 그 다음에 표기를 판정한다.

확인 항목:

1. **혼용 소멸 (핵심)** — `?view=list&locale=ko`와 `&locale=en` 각각에서 `.list-evt .time` 텍스트를 전부 수집해, 12시간 패턴(`/\d{1,2}(:\d{2})?\s?(AM|PM)/` 또는 `/오전|오후/`)과 24시간 패턴(`/\b([01]\d|2[0-3]):[0-5]\d\b/`)이 **동시에 나오지 않는지**. `timeFormat` 3값 × 로케일 2개 = 6조합 전부.
2. **뷰별 관례 (`'auto'`)** — 월 뷰 `.cal-month__dot-time`은 12시간, 주/일 `.tg-hour`와 `.cal-evt__time`(종일 행)은 24시간, 목록 `.time`은 24시간.
3. **옵션 전환** — `timeFormat=12h`에서 위 셀렉터가 **전부** 12시간, `timeFormat=24h`에서 **전부** 24시간. 툴팁도 포함(이벤트에 호버해 `.cal-tip__row` 확인).
4. **우선순위** — 플레이그라운드를 임시로 패치해 `messages: { clockTime: () => 'XX' }`를 넘기고, `timeFormat=12h`여도 눈금이 `XX`로 나오는지. **확인 후 패치를 되돌릴 것.**
5. **회귀** — `timeFormat` 미지정 + `locale=ko`(기본)에서 월 뷰 이벤트 시각이 `오전 9시` 꼴이고 목록 당일 이벤트가 `09:00–10:30` 꼴인지. v0.3.0과 같아야 한다.
6. 콘솔·페이지 에러 0건.

- [ ] **Step 6: 빌드**

```bash
yarn typecheck && yarn build
```

기대: 둘 다 통과.

- [ ] **Step 7: 커밋**

```bash
git add README.md
git commit -m "docs: document timeFormat and the two new catalog keys

The i18n section claimed every formatter came from the catalog, which
was not true before this branch -- the gutter and tooltip formatted time
themselves. It is true now, so the claim stays and gains the timeFormat
axis. Also extends the shallow-merge warning: clockTime and
tooltipDateTime join noEventsOnDay as keys a full custom locale must
supply or silently get Korean."
```

---

## Self-Review

**1. 스펙 커버리지**

| 스펙 요구 | 태스크 |
|---|---|
| `timeFormat` 옵션 3값 | 1(타입), 2(배선) |
| 우선순위 locale → timeFormat → messages | 1 Step 8 (overrides 마지막 spread), 7 Step 5-4 (검증) |
| `clockTime`·`tooltipDateTime` 키 추가 | 1 Step 3 |
| 눈금·`fmtMin`·클러스터·툴팁 카탈로그화 | 3 |
| `cal-time-event` 죽은 폴백 제거 | 3 Step 5 |
| 목록 뷰 24시간 통일 | 1 Step 5·6 (`dayLabel` 전 분기 `at()`) |
| 주/일 종일 행 24시간 | 4 |
| 월 뷰 12시간 유지 | 4 Step 4 (월 뷰가 `time-label`을 안 넘기는지 확인) |
| 플레이그라운드 쿼리 파라미터 | 5 |
| 눈금 폭 실측 | 6 |
| README 수정 + 얕은 병합 경고 | 7 |
| 시간 멀티데이 픽스처 | 5 Step 4 |

**스펙에 있으나 플랜에 없던 것 — 추가함**: 스펙의 "en 툴팁이 en 관례를 따른다"는 서술을 플랜에서 **좁혔다**. `tooltipDateTime`의 날짜부는 두 로케일 모두 ISO(`YYYY-MM-DD`)를 유지하고 시각부만 시계를 따른다(Task 1 Step 5 주석에 근거를 적었다). 이유: 이번 phase의 대상은 '시각' 표기고, ISO 날짜는 로케일 중립이며, 날짜 표기를 바꾸면 `ko` 툴팁까지 불필요하게 흔들린다. 이 좁힘 덕분에 **`'auto'`에서 두 로케일 툴팁 모두 현행과 동일**해져 동작 변화가 하나 줄었다.

**2. 플레이스홀더 스캔**

Task 6이 유일하게 "결과에 따라 분기"하는 태스크다. 이건 미완성이 아니라 **의도된 측정 게이트**다 — 추정 폭으로 코드를 고치면 안 되기 때문이고, 세 후보와 선택 기준("`'auto'`를 건드리지 말 것"), 권장안((a)), 재측정 절차까지 명시돼 있다. 넘침이 0이면 아무것도 안 하고 넘어가는 것도 명시했다.

**3. 타입 일관성**

- `TimeFormat`: Task 1 Step 1에서 정의 → Step 4 `pickClocks`, Step 5·6 빌더, Step 8 리졸버, Task 2 Step 1 기본값, Task 5 Step 1 플레이그라운드 캐스트에서 동일하게 사용.
- `Clock = (hour: number, minute: number) => string`: Step 4 정의 → `CalMessages.clockTime` 시그니처(Step 3)와 일치.
- `TimeKeys`: Step 5에서 정의하고 Step 6에서 재사용 — 5개 키 이름이 Step 3의 인터페이스 추가분 및 기존 3개 키와 정확히 일치.
- `fmtMin`: Task 3 Step 2에서 인자를 `m` → `min`으로 개명. 이 파일의 `m`이 i18n ref라 가림 문제가 생긴다 — 플랜에 명시함.
- `cal-event-bar`의 `timeLabel?: string`(Task 4)과 `cal-time-event`의 `timeLabel: string`(Task 3, 필수화)은 **서로 다른 컴포넌트**다. 이름은 같지만 선택/필수가 다른 것이 의도된 것임을 각 태스크에 적었다.

---

## 실행

이 플랜은 `groupware-sync-phase-e` 브랜치에서 실행한다(이미 생성됨, 분기점은 `c44478f` 스펙 커밋).
