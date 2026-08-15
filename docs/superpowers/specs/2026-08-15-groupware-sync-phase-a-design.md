# 그룹웨어 캘린더 동기화 Phase A — 버그 수정 설계

**목적:** 형제 프로젝트 `saeroun-gw-web`의 `src/components/calendar/`(추출 시점 이후 자체 발전 중인 원본)에서 나온 버그 수정을 calvue에 역이식한다. 이번 스펙은 6개 phase 중 **Phase A(API 변경 없는 저위험 버그 수정)**만 다룬다.

## 배경

- calvue는 2026-07-05 `saeroun-gw-web`(당시 `src/components/cal/`)에서 추출됐다. 이후 원본은 `src/components/calendar/`로 리네임(7/16)되며 독자적으로 계속 발전 중이고, 마지막 검토 시점(2026-08-02) 이후 캘린더 관련 커밋이 약 20개 쌓였다.
- 커밋을 6개 주제로 분류했다: **A 버그수정**(이 스펙) · B 오늘-포커스 기능 · C 이벤트/팝오버/툴팁 API 확장 · D 키보드 접근성 · E i18n 문구(재평가 필요 — 아래 결정 로그 참고) · F 목록뷰 작성자 표시. B~F는 각각 별도 스펙으로 다룬다.
- **원칙**: 원본 코드를 그대로 옮기지 않는다. calvue는 `vue`/`dayjs`/`@vueuse/core`만 peer로 두는 자체완결 라이브러리이고(그룹웨어의 `useResponsive`·`@/stores`·`saeroun-groupware-api` 타입 등에 무의존), i18n도 자체 `CalMessages` 카탈로그로 해결한다. 원본의 버그 수정 **로직**만 가져와 calvue 자신의 컴포저블/타입 경계 안에서 재구현한다.

## 브랜치

`v0.2-api-cleanup` 위에 스택: `groupware-sync-phase-a` (이 브랜치). 기존 `ci-workflow ← v0.2-api-cleanup` 스택 패턴을 따른다 — v0.2.0 API 정리 PR의 diff를 건드리지 않고 그 위에 쌓는다.

## 범위 — upstream 5개 커밋 → calvue 7개 파일

두 upstream 커밋(slotMinTime/slotMaxTime 수정, eventOrder 반영)이 같은 함수(`layoutDay`)를 건드려 얽혀 있어 파일 단위로 재편성했다.

| calvue 파일 | 변경 | 근거 커밋(saeroun-gw-web) |
|---|---|---|
| [src/components/internal/cal-time-event.vue](../../src/components/internal/cal-time-event.vue) | `boxStyle`에 글자색 반영 | `98c4dc540` |
| [src/composables/use-event-layout.ts](../../src/composables/use-event-layout.ts) | `TimeWindow` 도입, `layoutDay`에 창·정렬 파라미터 추가 | `9e1bdc1f8` + `479a337c6` |
| [src/composables/use-calendar-select.ts](../../src/composables/use-calendar-select.ts) | `timeWindow` 파라미터, 클램프를 창 기준으로 | `9e1bdc1f8` |
| [src/composables/use-calendar-dnd.ts](../../src/composables/use-calendar-dnd.ts) | `timeWindow` 파라미터, 클램프를 창 기준으로 | `9e1bdc1f8` |
| [src/components/internal/cal-time-grid.vue](../../src/components/internal/cal-time-grid.vue) | 창 계산 도입 + 호출부 배선 + 스크롤바 폭 보정 | `9e1bdc1f8` + `6a4943837`(절반) |
| [src/normalize.ts](../../src/normalize.ts) + [src/components/cal-calendar.vue](../../src/components/cal-calendar.vue) | 이벤트 key를 배열 인덱스 대신 시작 시각 기준으로 | `479a337c6` |
| [src/components/internal/cal-list-view.vue](../../src/components/internal/cal-list-view.vue) | 긴 제목 말줄임이 실제로 걸리도록 그리드 트랙 수정 | `2faa3d0a9` |

**스킵(Phase B로 이연)**: `6a4943837`의 나머지 절반(종일 행 '오늘' 포커스 배경을 별도 레이어로 분리하는 부분, `isFocusDay`)은 calvue에 아직 없는 오늘-포커스 기능(`focusSeq`) 전제라 지금은 적용 대상이 아니다.

## 파일별 변경 상세

### 1. `cal-time-event.vue` — 글자색

`boxStyle`에 한 줄 추가:

```ts
const boxStyle = computed(() => ({
  ...
  background: props.box.event.color,
  color: props.box.event.extendedProps?.textColor ?? '#fff',
  ...
}));
```

`CalEvent.extendedProps`는 이미 `Record<string, unknown>`이라 타입 변경 불필요.

### 2. `use-event-layout.ts` — 시간 창 + 정렬

```ts
export interface TimeWindow {
  start: number; // 자정 기준 분
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
    .filter((b) => b.to > win.start && b.from < win.end) // 창 밖 일정은 그리지 않음(클램프만 하면 납작한 상자가 남음)
    .map((b) => {
      const s = Math.max(win.start, b.from);
      const en = Math.min(win.end, b.to);
      return { event: b.event, s, e: Math.max(en, s + 15) };
    })
    // 시작·끝이 같으면 컬럼 배정 순서가 조회 순서에 좌우된다 — order가 있으면 그걸로 가른다
    .sort((a, b) => a.s - b.s || b.e - a.e || (order ? order(a.event, b.event) : 0));
  // ... topPct/heightPct 계산은 (it.s - win.start) / span 기준으로 (기존의 /1440 대체)
}
```

기본값(`FULL_DAY_WINDOW`)에서는 이전과 동일한 수식이 나와 회귀 없음.

### 3. `use-calendar-select.ts` / `use-calendar-dnd.ts` — 포인터→시각 변환의 창 인식

두 컴포저블 모두 4번째(dnd는 4번째) 파라미터로 `timeWindow: () => TimeWindow = () => FULL_DAY_WINDOW`를 추가하고, `1440`을 하드코딩한 클램프 지점(`startTimeSelect`의 `minAt`, `startTimeDrag`/`startTimeResize`의 min 계산)을 `win.start`/`win.end`/`span` 기준으로 바꾼다.

### 4. `cal-time-grid.vue` — 배선 + 스크롤바 폭 보정

- `toMinutes(hhmm, fallback)` 헬퍼, `timeWindow`/`winSpan`/`HOURS`(창 기준 눈금)/`pctOf(min)` computed 추가.
- `nowPct`를 `pctOf` 기반으로, `nowInWindow`로 창 밖이면 현재시각 라인 숨김.
- `layoutDay(...)` 호출에 `timeWindow.value`·`eventOrder` 전달, `useCalendarSelect`/`useCalendarDnd` 호출에 `() => timeWindow.value` 전달.
- `selectSeg`·드래그 프리뷰·`onColClick` 탭 위치 계산을 창 기준으로.
- `onMounted` 스크롤 위치 계산을 창 기준으로.
- CSS `--tg-hours` 변수 추가, `.tg-col` 높이를 `calc(24 * ...)`에서 `calc(var(--tg-hours, 24) * ...)`로.
- **스크롤바 폭 보정**(별도 버그, `6a4943837` 후반부): `.tg-body`만 `.tg-scroll` 내부라 스크롤바 폭만큼 좁아 헤더·종일행과 컬럼 경계가 어긋난다. `measureScrollbar()` + `useResizeObserver(scrollEl, measureScrollbar)`로 폭을 재서 `headCols`/`allDayCols` computed의 `padding-right`로 빼고, `.tg-head`/`.tg-allday` 바인딩을 `gridCols`에서 이걸로 교체.

### 5. `normalize.ts` + `cal-calendar.vue` — 안정적인 이벤트 key

```ts
export function normalizeEvent(input: CalEventInput): CalEvent {
  ...
  key: `${input.source ?? 'cal'}:${input.id}:${start.valueOf()}`,
  ...
}
```

`cal-calendar.vue:175`의 호출부도 `props.events.map((e, i) => normalizeEvent(e, i))` → `props.events.map((e) => normalizeEvent(e))`로 맞춘다. 배열 인덱스 기반 key는 앞쪽 이벤트 개수가 바뀔 때마다 뒤쪽 key가 밀려 멀쩡한 DOM 노드가 파괴·재생성되고(호버 중이던 툴팁이 안 닫히는 등) 원인이었다.

### 6. `cal-list-view.vue` — 목록 뷰 긴 제목 말줄임

```css
.list-day {
  grid-template-columns: 64px minmax(0, 1fr); /* 96px 1fr → 트랙이 제목 길이만큼 늘어나 가로 스크롤 발생 */
}
.list-evts { min-width: 0; } /* 새 wrapper 클래스 — calvue 템플릿의 이벤트 목록 div에 추가 */
.time { width: 100px; } /* 110px */
.title { min-width: 0; ... }
```

## 검증

calvue엔 아직 vitest가 없어(기존 메모 잔여 항목) 기존 검증 패턴을 그대로 따른다:

- `yarn typecheck` · `yarn build` 통과
- `yarn play` 렌더 스모크: 커스텀 `slotMinTime`/`slotMaxTime`(예 08:00~20:00)로 주/일 뷰 확인, `extendedProps.textColor` 지정 이벤트 색 확인, 목록 뷰에 긴 제목 이벤트로 말줄임 확인, 기본값(00:00~24:00)에서 기존 스크린샷과 시각적 회귀 없는지 확인

## 결정 로그

- 브랜치: `v0.2-api-cleanup` 위에 스택(사용자 결정) — main에서 새로 분리하지 않음.
- 시작 phase: A(버그 수정)부터(사용자 결정) — API 확장(C)은 다음.
- vitest 도입은 이 스펙 범위 밖 — 기존 typecheck+build+playground 스모크로 검증.
- Phase E(i18n 문구)는 재평가 필요: 원본 커밋(`bb67d9e65`)은 그룹웨어 자체 vue-i18n 키 전환이라 calvue의 독립적인 `CalMessages` 카탈로그와는 다른 축 — Phase E 스펙 작성 시 실제 갭이 있는지부터 다시 확인한다.
- `6a4943837`(종일 행 경계 버그)은 절반만 이번에 적용 — 오늘-포커스 배경 레이어 분리는 Phase B(그 기능이 생긴 뒤)로 이연.
