# s-calendar

월 / 주 / 일 / 목록 뷰와 드래그 이동·리사이즈·범위 선택을 지원하는 경량 Vue 3 캘린더 컴포넌트 라이브러리입니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<!-- TODO: 스크린샷 추가 (라이브러리 추출 Task 10 스모크 테스트 시 캡처) -->

## 특징

- **뷰 4종** — 월 / 주 / 일 / 목록, `v-model:view`로 전환
- **이벤트 드래그 이동·리사이즈** — 전역 옵션과 이벤트별 `editable` 플래그로 제어
- **셀 드래그 범위 선택** — `select` 이벤트로 일정 생성 UI에 연결
- **호버 툴팁** — 표시 필드와 순서 지정(`tooltipFields`)
- **업무시간 음영 · 현재시각 라인 · 주말 숨김**
- **모바일 스와이프**로 이전/다음 기간 이동(터치 디바이스)
- **월뷰 `+N 더보기`** — 셀당 표시 개수 제한(`dayMaxEvents`)과 내장 팝오버
- **미니 먼스**(`CalMiniMonth`) — 사이드바용 날짜 선택 위젯
- **CSS 변수 테마** — `primaryColor` 옵션 하나로 강조색 일괄 변경
- **내장 i18n** — `ko`·`en` 로케일 + `messages` 카탈로그 오버라이드
- **가벼운 의존성** — peer 3종(vue · dayjs · @vueuse/core)뿐, Vuetify/Pinia 무관

## 설치

```bash
yarn add s-calendar dayjs @vueuse/core
# 또는
npm install s-calendar dayjs @vueuse/core
```

`vue ^3.4` · `dayjs ^1.11` · `@vueuse/core ^11`은 peer dependency로 소비 앱에 설치되어 있어야 합니다. 스타일은 별도 파일이므로 앱 진입점에서 한 번 import 합니다.

## 빠른 시작

```vue
<template>
  <CalCalendar
    v-model:view="view"
    v-model:date="date"
    :events="events"
    :options="{ primaryColor: '#1976d2', firstDay: 0 }"
    @range-change="onRangeChange"
    @event-click="onEventClick"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { CalCalendar } from 's-calendar';
import type { CalEvent, CalEventInput, CalRange, CalView } from 's-calendar';
import 's-calendar/style.css';

const view = ref<CalView>('month');
const date = ref(new Date().toISOString());

const events = ref<CalEventInput[]>([
  { id: '1', title: '팀 회의', start: '2026-07-06T10:00:00', end: '2026-07-06T11:30:00', color: '#1976d2', editable: true },
  // 종일 일정의 end는 배타적: 7/8~7/10 사흘짜리면 end는 7/11
  { id: '2', title: '워크숍', start: '2026-07-08', end: '2026-07-11', allDay: true, color: '#2e7d32' }
]);

function onRangeChange(range: CalRange) {
  // range.start ~ range.end (Dayjs) 구간의 일정을 서버에서 조회해 events에 반영
}

function onEventClick(ev: CalEvent) {
  console.log(ev.rawId, ev.title);
}
</script>
```

## CalCalendar

### Props

| Prop | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `events` | `CalEventInput[]` | `[]` | 표시할 이벤트 목록. 내부에서 `CalEvent`로 정규화됩니다 |
| `options` | `Partial<CalOptions>` | `{}` | 동작·표시 옵션 ([아래 표](#caloptions) 참조) |
| `loading` | `boolean` | `false` | 상단 로딩 바 표시 |

### v-model

| 이름 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `v-model:view` | `CalView` (`'month' \| 'week' \| 'day' \| 'list'`) | `'month'` | 현재 뷰 |
| `v-model:date` | `string` (ISO 8601) | 현재 시각 | 표시 기준 날짜. 툴바 이동·스와이프 시 갱신됩니다 |

### 이벤트

| 이벤트 | 페이로드 | 발생 시점 |
| --- | --- | --- |
| `range-change` | `CalRange` (`{ start: Dayjs; end: Dayjs }`) | 마운트 직후 1회 + 표시 범위가 바뀔 때. 이 범위로 서버에서 일정을 조회하세요 |
| `event-click` | `CalEvent` | 이벤트 클릭 시 (`interactive: false`인 이벤트 제외) |
| `select` | `{ start: Dayjs; end: Dayjs; allDay: boolean }` | 빈 셀/시간대 드래그 선택 완료 시 (`selectable` 옵션 필요) |
| `event-move` | `unknown` | 이벤트 드래그 이동 완료 시. 페이로드 타입이 아직 `unknown`으로 선언되어 있어 사용 전 소스 확인이 필요합니다 |
| `event-resize` | `unknown` | 이벤트 리사이즈 완료 시. 위와 동일 |
| `more` | `Dayjs` | **현재 미발생** — `+N 더보기` 클릭은 내장 팝오버로 처리되며 이 이벤트를 발화하는 코드가 없습니다 |

### 메서드 (템플릿 ref)

| 메서드 | 설명 |
| --- | --- |
| `prev()` / `next()` | 이전/다음 기간으로 이동 (뷰에 따라 일·주·월 단위) |
| `today()` | 오늘로 이동 |
| `setView(view: CalView)` | 뷰 전환 |
| `gotoDate(date: Dayjs)` | 특정 날짜로 이동 |

```vue
<CalCalendar ref="cal" />
```

```ts
const cal = ref<InstanceType<typeof CalCalendar> | null>(null);
cal.value?.next();
cal.value?.gotoDate(dayjs('2026-08-01'));
```

### CalOptions

| 옵션 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `views` | `CalView[]` | `['day','week','month','list']` | 툴바에 노출할 뷰 필터 (표시 순서는 일·주·월·목록 고정) |
| `headerToolbar` | `{ left; center; right }` | `{ left: 'prev,next today', center: 'title', right: 'day,week,month,list' }` | **현재 미적용** — 툴바 레이아웃은 고정입니다 |
| `locale` | `string` | `'ko'` | UI 문자열·날짜 포맷 로케일. `'ko'`·`'en'` 내장, 그 외는 `messages`로 공급 ([로케일](#로케일-i18n) 참조) |
| `messages` | `Partial<CalMessages>` | — | 선택한 로케일 카탈로그 위에 키 단위로 얕게 병합하는 오버라이드 |
| `primaryColor` | `string` | `'#1976d2'` | 강조색. `--cal-primary` CSS 변수로 주입됩니다 |
| `firstDay` | `number` | `0` | 주 시작 요일 (0=일요일) |
| `weekends` | `boolean` | `true` | 주말 표시. `false`면 평일만 5컬럼으로 표시 |
| `weekdayColors` | `Record<number, string>` | `{ 0: '#ef4444', 6: '#2563eb' }` | 요일(0=일~6=토)별 헤더·날짜 숫자 색 |
| `showTooltip` | `boolean` | `true` | 이벤트 호버 툴팁 |
| `tooltipFields` | `('creator' \| 'start' \| 'end' \| 'description')[]` | 전부 | 툴팁에 표시할 필드와 순서. `creator`·`description`은 이벤트의 `extendedProps.creator`·`extendedProps.description`에서 읽습니다 |
| `businessHours` | `{ daysOfWeek: number[]; startTime: string; endTime: string } \| null` | `{ daysOfWeek: [1,2,3,4,5], startTime: '00:00', endTime: '24:00' }` | 업무시간 영역 표시(주/일 뷰 음영). `null`이면 비활성 |
| `slotMinTime` | `string` (`'HH:mm'`) | `'00:00'` | 시간 그리드 표시 시작 시각 |
| `slotMaxTime` | `string` (`'HH:mm'`) | `'24:00'` | 시간 그리드 표시 종료 시각 |
| `slotDuration` | `string` (`'HH:mm'`) | `'01:00'` | 시간 그리드 격자 간격 (`'00:30'`이면 30분 격자) |
| `scrollTime` | `string` (`'HH:mm'`) | `'07:00'` | 주/일 뷰 진입 시 스크롤 시작 시각 |
| `nowIndicator` | `boolean` | `true` | 현재시각 라인 |
| `slotEventOverlap` | `boolean` | `true` | 겹치는 시간 일정 표시 — `true`=계단식 겹침, `false`=나란히(1/n 컬럼) |
| `selectable` | `boolean` | `true` | 셀 드래그 범위 선택 |
| `editable` | `boolean` | `true` | 일정 드래그 이동 허용(전역). 이벤트별 `editable: true`인 일정만 실제로 움직입니다 |
| `resizable` | `boolean` | `true` | 일정 리사이즈 허용. `editable: true`일 때만 동작 |
| `eventHeight` | `number` | `24` | 이벤트 바 높이(px) |
| `dayMaxEvents` | `number \| false` | `false` | 월뷰 셀당 최대 표시 일정 수. 초과분은 `+N 더보기`(내장 팝오버). `false`면 전부 표시 |
| `eventOrder` | `(a: CalEvent, b: CalEvent) => number` | 내장 정렬 | 같은 날 안에서의 정렬. 기본: 이른 시작일 먼저, 같은 날은 종일→멀티데이→당일, 시작시각순 |

### CalEventInput

`:events`로 넘기는 느슨한 입력 타입입니다. 내부에서 `CalEvent`로 정규화됩니다.

| 필드 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `id` | `string` | (필수) | 원본 이벤트 id. 콜백에서 `CalEvent.rawId`로 돌려받습니다 |
| `title` | `string` | (필수) | 제목 |
| `start` | `string \| Date \| Dayjs` | (필수) | 시작 |
| `end` | `string \| Date \| Dayjs` | 종일=익일, 시간=+1시간 | 종료(**배타적**). 종일 일정은 표시 마지막 날 + 1일로 지정합니다 |
| `allDay` | `boolean` | `false` | 종일 여부 |
| `calendarId` | `string` | `''` | 소속 캘린더 구분자 (그대로 전달) |
| `color` | `string` | `'#409eff'` | 이벤트 색. `#RRGGBB` hex 권장 — 7자 초과분은 잘립니다(`#RRGGBBAA`→`#RRGGBB`, `rgb()`·색상명은 깨짐) |
| `editable` | `boolean` | `false` | 드래그 이동·리사이즈 대상 여부 (옵션 `editable`도 `true`여야 동작) |
| `interactive` | `boolean` | `true` | `false`면 표시 전용 — 클릭·툴팁·드래그가 비활성화됩니다 |
| `source` | `string` | `'cal'` | 호출자가 정의하는 출처 문자열. 렌더 키 생성에 사용됩니다 |
| `rrule` | `string` | — | **현재 미적용** — 값이 보존만 되고 반복 일정 전개 로직이 없습니다 |
| `extendedProps` | `Record<string, unknown>` | — | 임의 데이터. 툴팁의 `creator`·`description`이 여기서 읽힙니다 |

### CalEvent (콜백 수신 타입)

`event-click` 등으로 돌려받는 정규화된 이벤트입니다. 알아야 할 것:

- `start`·`end`는 **Dayjs 객체**입니다 (입력의 문자열이 아님).
- `end`는 **배타적**입니다 — 종일 일정의 `end`는 익일 00:00.
- `key`는 렌더용 고유키, `rawId`가 입력의 `id`입니다. CRUD에는 `rawId`를 쓰세요.
- 나머지 필드(`calendarId`, `source`, `title`, `allDay`, `color`, `editable`, `interactive`, `extendedProps`)는 입력이 기본값과 병합된 값입니다.

## CalMiniMonth

사이드바용 미니 달력. 날짜를 클릭하면 `v-model`이 갱신됩니다. 이전/다음 달 이동은 표시 월만 바꾸고 선택은 유지합니다.

```vue
<template>
  <CalMiniMonth v-model="selected" :options="{ firstDay: 0 }" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { CalMiniMonth } from 's-calendar';
import 's-calendar/style.css';

const selected = ref(new Date().toISOString());
</script>
```

| 이름 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `v-model` | `string` (ISO 8601) | 현재 시각 | 선택된 날짜 |
| `options.primaryColor` | `string` | `'#1976d2'` | 강조색 (`--cal-primary`) |
| `options.firstDay` | `number` | `0` | 주 시작 요일 (0=일요일) |
| `options.locale` | `string` | `'ko'` | `'ko'`·`'en'` 내장 로케일 |
| `options.messages` | `Partial<CalMessages>` | — | 카탈로그 키 단위 오버라이드 |
| `options.weekdays` | `string[]` | 카탈로그 `weekdaysShort` | 요일 라벨 직접 지정(일요일부터 7개). 지정 시 카탈로그보다 우선합니다 |

## 테마

강조색은 컴포넌트별 `options.primaryColor` 하나로 바꿉니다. 내부적으로 `--cal-primary` CSS 커스텀 프로퍼티에 주입되어 오늘 날짜, 선택 상태, 뷰 전환 pill 등에 일괄 적용됩니다. 이벤트 색은 테마와 무관하게 이벤트별 `color` 필드를 따릅니다.

```vue
<CalCalendar :options="{ primaryColor: '#6750a4' }" />
<CalMiniMonth :options="{ primaryColor: '#6750a4' }" />
```

## 로케일 (i18n)

`ko`(기본)·`en` 카탈로그가 내장되어 있습니다. 버튼·라벨 같은 UI 문자열과 날짜·시간 포맷터가 전부 카탈로그에서 나오므로, 옵션 하나로 전체가 전환됩니다.

```vue
<CalCalendar :options="{ locale: 'en' }" />
```

특정 문구만 바꾸거나 다른 언어를 쓰려면 `messages`에 `Partial<CalMessages>`를 넘기세요. 선택한 로케일 카탈로그 위에 키 단위로 얕게 병합됩니다.

```ts
import type { CalMessages } from 's-calendar';

const messages: Partial<CalMessages> = {
  today: 'TODAY',
  noEvents: '표시할 일정이 없어요.',
  monthTitle: (d) => d.format('YYYY.MM')
};
```

```vue
<CalCalendar :options="{ locale: 'ko', messages }" />
```

`CalMessages`에는 정적 문자열 외에 요일 배열(`weekdaysShort`)과 날짜·시간 포맷터 함수(`monthTitle`, `eventTime`, `popoverDate` 등)가 포함되어 있어, 전체를 채우면 완전한 커스텀 로케일을 공급할 수 있습니다. `CalMiniMonth`도 동일한 `locale`·`messages` 옵션을 받습니다.

## 알아둘 점

- 기본 로케일은 **한국어**입니다. 영어 UI는 `options.locale: 'en'`, 미지원 locale 값은 한국어로 폴백됩니다.
- 날짜·시간 표기는 로케일 카탈로그의 포맷터가 직접 생성하므로 **dayjs 전역 로케일 설정과 무관**합니다.
- 컴포넌트를 사용하면 소비 앱의 dayjs 인스턴스에 플러그인 5종(`weekday`, `isoWeek`, `isBetween`, `isSameOrAfter`, `isSameOrBefore`)이 자동 등록됩니다. 기능 추가일 뿐 기존 동작은 바꾸지 않습니다.
- 이벤트의 `end`는 시작~종료 어디서나 **배타적**입니다. 종일 사흘짜리(7/8~7/10)의 `end`는 `'2026-07-11'`입니다.

## 개발

```bash
yarn            # 의존성 설치 (yarn 전용 — npm install 금지)
yarn build      # dist/ 빌드 (ES 모듈 + 타입 선언 + style.css)
yarn dev        # watch 빌드
yarn typecheck  # vue-tsc 타입 검사
```

## 라이선스

[MIT](LICENSE)
