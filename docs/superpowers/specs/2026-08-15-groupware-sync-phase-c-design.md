# 그룹웨어 캘린더 동기화 Phase C (툴팁 커스터마이즈 + 팝오버 수정) 설계

**목적:** 소비자가 툴팁 내용을 직접 구성할 수 있게 슬롯을 열고, 툴팁·팝오버에 남아 있는 구조적 버그 5건을 고친다. 공개 API 추가는 전부 하위 호환이다.

## 배경

`saeroun-gw-web`(형제 프로젝트) 캘린더에서 나온 변경을 calvue에 역이식하는 6개 phase(A~F) 중 세 번째다. Phase A(버그 수정)는 v0.2.0으로 배포 완료됐다.

**원칙**: 원본 코드를 옮기지 않는다. calvue는 `vue`/`dayjs`/`@vueuse/core`만 peer로 두는 자체완결 라이브러리이고, **그룹웨어는 calvue를 채택하지 않고 독립적으로 존재한다**(사용자 결정, 2026-08-15). 따라서 업스트림 커밋은 "맞춰야 할 사양"이 아니라 **버그 리포트이자 설계 힌트**다. 기능 동등성은 목표가 아니며, calvue는 범용 라이브러리로서 자기 판단으로 API를 설계한다.

### Phase C 범위 재조정 (중요)

원래 스펙(`2026-08-15-groupware-sync-phase-a-design.md`)은 Phase C를 upstream 5개 커밋(`40a2d8c52` `d3c839130` `ec4ea9ad7` `56aea7be3` `66443d339`)으로 정의했다. 착수 전 조사에서 **그 5개 중 독립적으로 이식 가능한 건 2개뿐**임이 드러나 범위를 재조정했다.

| upstream 커밋 | 원래 배정 | 실제 의존 | 이번 처리 |
|---|---|---|---|
| `d3c839130` 툴팁 본문 주입 | C | 없음 | **이번에 진행** |
| `56aea7be3` 팝오버 z-index·dismiss 수정 | C | 없음 | **이번에 진행** |
| `40a2d8c52` `eventClick`에 클릭 요소 전달 | C | 포커스 복귀 = 접근성 | **Phase D로 이월** |
| `66443d339` `clickable` 분리 | C | `ab73cd7a6`(키보드) 선행 필수 | **Phase D로 이월** |
| `ec4ea9ad7` `clusterOpen` 이벤트 | C | 오늘-포커스 기능(Phase B) | **Phase B로 이월** |

조사 중 스펙이 누락한 6번째 커밋 `ab73cd7a6`(키보드 활성화 — `role="button"`/`tabindex`/Enter·Space)이 발견됐다. `66443d339`의 `clickable` 분리는 **`ab73cd7a6`가 만든 문제**(모든 이벤트가 탭 정지점이 되어 "눌러도 아무 일 없는 버튼"이 생김)를 고치는 커밋이다. calvue엔 키보드 지원이 전무하므로 `clickable`을 지금 도입하면 존재하지 않는 문제를 푸는 API가 된다.

**`clusterOpen`도 같은 이유로 제외한다.** 팝오버가 열릴 때 '오늘' 강조를 해제하려는 신호인데 calvue엔 그 기능이 없어, 지금 넣으면 아무도 구독하지 않는 이벤트가 된다. `more` emit이 선언만 되고 발화되지 않은 채 남아 있다가 v0.2.0에서 제거된 전례가 있다.

## 브랜치

`main` 위에 `groupware-sync-phase-c`. Phase A의 스택(`ci-workflow ← v0.2-api-cleanup ← groupware-sync-phase-a`)은 전부 머지됐으므로 스택 없이 `main`에서 분기한다.

## 범위 — calvue 6개 파일

| calvue 파일 | 변경 |
|---|---|
| [src/composables/use-cal-tooltip.ts](../../../src/composables/use-cal-tooltip.ts) | 모듈 싱글턴 → provide/inject 인스턴스별 상태 |
| [src/components/cal-calendar.vue](../../../src/components/cal-calendar.vue) | 툴팁 상태 provide, `#tooltip` 슬롯 선언·전달 |
| [src/components/internal/cal-tooltip.vue](../../../src/components/internal/cal-tooltip.vue) | 슬롯 렌더링 + 기존 내용을 폴백으로, z-index 변수화 |
| src/composables/use-cal-popover.ts | **신규** — `useCalPopoverDismiss` |
| [src/components/internal/cal-month-view.vue](../../../src/components/internal/cal-month-view.vue) | `+N` 팝오버: teleport, 실측 위치, dismiss 공용화, z-index 변수 |
| [src/components/internal/cal-time-grid.vue](../../../src/components/internal/cal-time-grid.vue) | 클러스터 팝오버: 실측 위치, dismiss 공용화, z-index 변수 |

`useCalTooltip()` 호출부 중 `cal-event-bar.vue`·`cal-time-event.vue`·`cal-month-view.vue`는 **반환 형태가 그대로라 수정이 필요 없다**. `cal-calendar.vue`도 호출부이지만 provide와 슬롯 때문에 어차피 바뀐다.

## 공개 API 변경 — 전부 하위 호환

### 1. `#tooltip` 슬롯

```vue
<CalCalendar :events="events">
  <template #tooltip="{ event }">
    <strong>{{ event.title }}</strong>
    <p>{{ event.extendedProps.reason }}</p>
  </template>
</CalCalendar>
```

슬롯이 있으면 **툴팁 내용 전체를 대체**한다(제목 포함). 없으면 기존 `tooltipFields` 렌더링이 그대로 동작하므로 기존 사용자는 변화가 없다. 슬롯 prop은 `{ event: CalEvent }` 하나이며, 위치·플립·클램프는 라이브러리가 계속 담당한다.

업스트림은 `extendedProps.tooltip: CalTooltipRow[]` 배열 방식을 택했으나(HTML 문자열을 받지 않아 이스케이프가 보장된다는 이유), calvue는 슬롯을 택한다 — Vue 라이브러리로서 더 자연스럽고, `CalTooltipRow` 타입을 공개 API로 짊어지지 않아도 된다. Vue 템플릿은 기본적으로 이스케이프되므로 안전성도 유지된다.

### 2. CSS 커스텀 프로퍼티 2개

```css
--cal-popover-z: 1500;   /* 신규 */
--cal-tooltip-z: 10000;  /* 기존 하드코딩 값을 변수화 */
```

라이브러리는 소비자 앱의 레이어링을 알 수 없다. 현재 클러스터 팝오버가 `z-index: 300`이라 앱 셸이 그보다 높으면 팝오버가 가려져 **탭해도 아무 일 없는 것처럼 보인다**. 툴팁은 팝오버 위에 떠야 하므로 별도 변수를 둔다.

### 이번에 공개하지 않는 것

- `CalTooltipRow` 등 툴팁 행 타입 — 슬롯을 택했으므로 불필요
- `clickable`, `eventClick` 두 번째 인자 — Phase D로 이월. 둘 다 **추가만 하는 변경**이라 나중에 넣어도 breaking이 아니다
- `clusterOpen`/`moreOpen` — Phase B 의존
- 팝오버 열림/닫힘 이벤트 — 요구 없음

## 파일별 변경 상세

### 1. `use-cal-tooltip.ts` — 인스턴스별 상태

현재 모듈 최상단의 `reactive` 상태를 모든 곳이 공유한다. 한 페이지에 `<CalCalendar>`가 둘이면 툴팁 상태를 공유하고, 두 인스턴스의 `showTooltip` watcher가 같은 `enabled` 플래그를 서로 덮어쓴다.

`use-cal-i18n.ts`의 `CAL_I18N` inject key 패턴을 그대로 따른다(새 패턴을 만들지 않는다):

```ts
const CAL_TOOLTIP: InjectionKey<CalTooltipApi> = Symbol('cal-tooltip');

/** cal-calendar.vue가 호출 — 인스턴스마다 독립된 상태를 만든다 */
export function provideCalTooltip(): CalTooltipApi;

/** 하위 컴포넌트가 호출 — 반환 형태는 기존과 동일({ state, setEnabled, show, hide }) */
export function useCalTooltip(): CalTooltipApi;
```

provider가 없을 때는 무해한 no-op 스텁을 반환해 단독 렌더링된 내부 컴포넌트가 죽지 않게 한다.

`show()`의 `canHover()` 게이트, 포인터 `clientY` 기준 세로 앵커링 등 기존 동작은 그대로 유지한다.

### 2. `cal-calendar.vue` — provide + 슬롯 전달

```ts
defineSlots<{ tooltip?(props: { event: CalEvent }): unknown }>();
```

`provideCalTooltip()`을 setup에서 호출하고, 슬롯을 `<cal-tooltip>`에 전달한다:

```vue
<cal-tooltip :fields="opts.tooltipFields">
  <template v-if="$slots.tooltip" #default="slotProps">
    <slot name="tooltip" v-bind="slotProps" />
  </template>
</cal-tooltip>
```

**`v-if="$slots.tooltip"`이 필수다.** 조건 없이 항상 템플릿을 넘기면 `cal-tooltip.vue`의 폴백 내용이 렌더링되지 않아 기본 툴팁이 빈 채로 뜬다.

### 3. `cal-tooltip.vue` — 슬롯 + 폴백

**제목과 본문을 모두** `<slot :event="state.event">…기존 내용…</slot>` 안에 넣는다. 슬롯은 툴팁 내용 전체를 대체하므로 제목이 슬롯 밖에 남으면 안 된다(소비자가 제목을 빼거나 다르게 쓸 수 없게 된다). 슬롯이 전달되지 않으면 폴백(제목 + `<hr>` + `tooltipFields` 행)이 그대로 렌더링된다.

위치 계산 컨테이너(`position: fixed`, 클램프, 플립)는 슬롯 바깥에 그대로 남는다.

`z-index: 10000` → `z-index: var(--cal-tooltip-z, 10000)`.

### 4. `use-cal-popover.ts` — 신규

```ts
export function useCalPopoverDismiss(
  popoverEl: Ref<HTMLElement | null>,
  isOpen: () => boolean,
  close: () => void,
  scrollTarget: Ref<HTMLElement | null>
): void;
```

세 가지 dismiss 경로를 한 곳에서 담당한다:

- **capture 단계 `pointerdown`** — 버블 단계로는 안 된다. 시간 블록과 월 셀이 드래그 처리를 위해 `pointerdown`에 `.stop`을 걸어 버블 리스너가 아예 호출되지 않는다.
- **`scrollTarget`의 `scroll`** — 위치를 열 때 한 번만 계산하고 재측정하지 않으므로, 스크롤하면 팝오버가 엉뚱한 곳에 남는다.
- **`window`의 Esc `keydown`** — 현재 `@keydown.esc`가 포커스 불가능한 `div`에 붙어 있어 동작하지 않는다. window 리스너면 포커스 관리 없이도 동작한다.

여는 탭이 스스로를 닫지 않는 이유: 그 이벤트가 전파될 시점엔 팝오버가 아직 없어 `isOpen()`이 `false`다.

기존 `onClickOutside`를 대체한다. `onClickOutside`는 `click`을 기다리는데, 모바일에서 누른 채 드래그해 스크롤하는 제스처는 `click`을 만들지 않아 팝오버가 닫히지 않는다.

호출부: `cal-month-view.vue`는 주 컨테이너(`weeksEl`), `cal-time-grid.vue`는 `.tg-scroll`(`scrollEl`)을 `scrollTarget`으로 넘긴다.

### 5. `cal-month-view.vue` — `+N` 팝오버

**teleport로 전환.** 현재 `.cal-month` 안 `position: absolute`인데, 상위 `.cal-swipe`에 `translateX` 변환이 걸려 있다. CSS 변환은 하위 요소의 containing block을 만들어 팝오버가 그 안에 갇힌다(클러스터 팝오버가 겪어서 teleport로 도망친 것과 같은 문제). `Teleport to="body"` + `position: fixed`로 클러스터 팝오버와 통일한다.

**실측 위치.** 현재 `POPOVER_W = 220`, `POPOVER_H = 300` 하드코딩인데 `POPOVER_H`는 실제 렌더 높이와 맞지 않는 추측값이라 위/아래 뒤집기 판단이 부정확하다. 마운트 후 실측으로 바꾼다:

1. 앵커(`+N` 요소) 뷰포트 좌표를 저장하고 팝오버를 `visibility: hidden`으로 렌더
2. `nextTick` 후 `getBoundingClientRect()`로 실제 크기 측정
3. 뒤집기·클램프를 실측값으로 계산해 위치 확정 후 `visibility` 해제

`visibility: hidden` 단계가 없으면 잘못된 위치에 한 프레임 깜빡인다.

`z-index: 200` → `var(--cal-popover-z, 1500)`. `onClickOutside` → `useCalPopoverDismiss`.

### 6. `cal-time-grid.vue` — 클러스터 팝오버

이미 teleport + fixed이므로 위치 계산만 실측으로 바꾼다(현재 `W = 248`, `h = Math.min(320, 44 + n * 40)` 추정식). **월 팝오버와 동일한 `visibility: hidden` → 측정 → 위치 확정 → 노출 순서를 쓴다** — 여기도 같은 한 프레임 깜빡임 문제가 있다. `z-index: 300` → `var(--cal-popover-z, 1500)`. `onClickOutside` → `useCalPopoverDismiss`.

## 검증

vitest 없음(도입은 이 계획 범위 밖) — Phase A와 동일하게 태스크마다 `yarn typecheck`, 마지막에 `yarn build` + 플레이그라운드 렌더 QA.

### 회귀 위험

**툴팁 상태 전환이 유일한 고위험 지점이다.** 호출부가 6곳이고 표시/숨김 트리거가 `mouseenter`/`mouseleave`/`pointerdown`/`dragstart`/호스트 `mouseleave`/뷰 전환으로 흩어져 있다. 각 뷰마다 표시와 숨김을 **모두** 확인한다.

### 플레이그라운드 임시 설정 (확인 후 되돌림)

현재 플레이그라운드로는 이번 변경의 절반을 볼 수 없다:

- **`dayMaxEvents`를 숫자로** — 기본값이 `false`라 `+N 더보기` 팝오버가 아예 나타나지 않는다. 이걸 켜지 않으면 월 팝오버 수정을 하나도 검증할 수 없다
- **캘린더 2개를 나란히** — 툴팁 인스턴스 분리를 검증하는 유일한 방법. 한쪽은 `#tooltip` 슬롯 사용, 다른 쪽은 미사용으로 두어 슬롯 동작과 폴백을 동시에 확인
- **터치 에뮬레이션** — 클러스터 팝오버는 `isTouch()` 게이트라 일반 브라우저로는 열리지 않는다(Playwright `hasTouch: true` 컨텍스트 필요)

### 확인 항목

**툴팁**
- 4개 뷰 × 표시/숨김, 드래그 시작·뷰 전환 시 사라지는지
- 슬롯 있을 때 내용 대체, 없을 때 기존 `tooltipFields` 그대로
- 캘린더 2개 독립 동작 — 한쪽 호버가 다른 쪽에 영향 없는지, `showTooltip`을 서로 다르게 줬을 때 각자 지켜지는지

**팝오버 (월 `+N`, 터치 클러스터 둘 다)**
- **뷰포트 아래쪽·오른쪽 가장자리에서 열기** — 뒤집기와 클램프가 실측 크기로 정확히 동작하는지. 잘 되는 값만 테스트하면 잘 되는 것만 확인된다
- 바깥 pointerdown / **누른 채 드래그해 스크롤** / 스크롤 / Esc — 4가지 dismiss 경로
- 월 뷰 좌우 스와이프 중 팝오버가 같이 밀리지 않는지(teleport 검증)
- `--cal-popover-z`를 낮게 덮어써서 실제로 반영되는지

**회귀 없음**
- 슬롯 미사용·변수 미지정 기본 상태에서 v0.2.0과 시각적으로 동일한지

## 알려진 미구현 (의도적)

Phase D 이후로 미룬다. 놓친 것이 아니라 알고 뺀 것이다.

- **키보드 활성화** — 이벤트에 `role="button"`/`tabindex`/Enter·Space. 현재 calvue는 `tabindex`가 0개다
- **`clickable` 플래그** — "툴팁은 띄우되 클릭은 막기". 키보드 지원과 함께 도입해야 정당화된다
- **`eventClick` 포커스 복귀 인자** — 다이얼로그 닫은 뒤 포커스 복귀 대상
- **팝오버 포커스 관리** — 열 때 포커스 이동, 닫을 때 트리거로 복귀
- **포커스 트랩** — 팝오버가 모달이 아니므로 표준상 부적절. 업스트림도 하지 않았다
- **방향키 그리드 내비게이션** — 로빙 tabindex 설계가 필요한 별도 규모
- **`aria-live` 안내** — 뷰 전환·날짜 이동 알림

## 결정 로그

- **그룹웨어는 calvue를 채택하지 않는다**(사용자 결정) — 기능 동등성이 목표가 아니므로 업스트림 API 형태를 복제하지 않는다. 툴팁이 행 배열 대신 슬롯인 이유.
- **툴팁 커스터마이즈는 슬롯**(사용자 승인) — calvue에 첫 슬롯이며, 이 라이브러리의 확장 지점 형태를 정하는 선례가 된다.
- **접근성 작업은 이번에 하지 않는다**(사용자 결정) — 이에 따라 `clickable`과 `eventClick` 두 번째 인자도 함께 이월. 근거가 얇은 채로 공개 API를 늘리지 않는다.
- **구조 정리 범위는 "이번에 손대는 코드"까지**(사용자 승인, 3개 안 중 B) — 툴팁 싱글턴과 팝오버 dismiss 중복은 지금 손대는 파일 안에 있어 함께 고친다. 반면 툴팁·팝오버를 아우르는 공통 anchored-overlay 프리미티브는 만들지 않는다 — 용례가 3개뿐이고 요구사항이 서로 달라(툴팁은 `pointer-events:none` hover 전용, 팝오버는 포커스 받는 대화상자) 추상화를 정당화할 근거가 없다.
- **팝오버 위치는 실측**(사용자 승인) — 매직넘버 `POPOVER_H = 300`이 실제 높이와 달라 뒤집기 판단이 부정확했다.
- vitest 도입은 이 스펙 범위 밖 — 기존 typecheck+build+플레이그라운드 스모크로 검증(Phase A와 동일).
