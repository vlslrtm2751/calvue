# s-calendar README 설계

**목적:** GitHub 저장소 첫 화면과 npm 패키지 페이지에 표시될 `README.md`를 작성한다. 소비자가 소스를 열어보지 않고 README만으로 설치·사용·옵션 설정까지 가능한 수준(풀 API 레퍼런스)을 목표로 한다.

**언어:** 한국어. 라이브러리 UI 문자열('오늘', '종일', 오전/오후)이 한국어 고정이라 실사용자가 한국어권이며, 코드 주석도 한국어다. i18n 도입 시 영어판을 추가한다.

## 작성 기준 시점 (핵심 결정)

**현재 코드가 아니라 추출 계획([2026-07-04-cal-ui-library-extraction.md](../plans/2026-07-04-cal-ui-library-extraction.md)) 완료 후의 최종 공개 API를 문서화한다.** 브랜치 머지 시점에 문서=코드가 되도록 한다.

근거:
- API 표의 원천인 `src/types.ts`는 Task 2에서 최종본으로 커밋 완료.
- 잔여 Task 5~7은 내부 결합 제거로 공개 API 불변. 공개 표면이 바뀌는 Task 8(CalMiniMonth)·Task 9(index.ts)는 계획 문서에 완성 코드가 그대로 명시됨.
- 병행 세션이 계획을 태스크 단위로 충실히 실행 중임이 커밋 4개(Task 1~4)로 확인됨.

따라서 현재 코드에 남은 잔존물(`showHolidays`, `v-ripple`, Pinia, `--v-theme-primary`)은 문서화하지 않는다.

## 정직성 원칙

선언만 되고 코드 어디서도 읽지 않는 옵션은 표에 **"현재 미적용"을 명기**한다. 문서가 코드보다 좋게 포장하지 않는다.

- `CalOptions.headerToolbar` — 기본값만 존재, 템플릿은 고정 레이아웃. 미적용.
- `CalOptions.locale` — 기본값 `'ko'`만 존재, 어디에도 전달 안 됨. 미적용 (UI는 한국어 고정).
- `CalEventInput.rrule` — normalize에서 전달만 되고 반복 전개 로직 없음(`use-recurrence.ts` 삭제됨). 미적용.
- `more` emit — cal-calendar가 선언·중계하지만 cal-month-view는 `+N 더보기` 클릭을 내장 팝오버(`openPopover`)로 처리할 뿐 `emit('more')` 호출이 없음. 현재 미발생. (계획 승인 후 코드 확인으로 추가 발견된 항목)

## 섹션 구성

1. **헤더** — `# s-calendar` + 한 줄 소개("월/주/일/목록 뷰와 드래그 이동·리사이즈·범위 선택을 지원하는 경량 Vue 3 캘린더 컴포넌트") + License 배지(MIT) 1개. npm 버전 배지는 배포 후 추가(배포 전엔 깨져 보임).
2. **스크린샷 placeholder** — `<!-- TODO: Task 10 스모크 테스트 시 캡처 추가 -->` HTML 주석으로 자리만.
3. **특징** — bullet 목록: 뷰 4종(월/주/일/목록), 이벤트 드래그 이동·리사이즈, 셀 드래그 범위 선택, 호버 툴팁, 업무시간 음영, 현재시각 라인, 모바일 스와이프 내비게이션, 월뷰 `+N 더보기`, 미니 먼스 위젯, `--cal-primary` CSS 변수 테마, 의존성은 peer 3종뿐(Vuetify/Pinia 무관).
4. **설치** — `yarn add s-calendar dayjs @vueuse/core` / npm 동등 커맨드. peer dependencies(vue ^3.4, dayjs ^1.11, @vueuse/core ^11)를 소비자가 직접 설치해야 함을 명시.
5. **빠른 시작** — 동작하는 SFC 예제 1개(~25줄): `import { CalCalendar } from 's-calendar'` + `import 's-calendar/style.css'` + events 배열 + `v-model:view`/`v-model:date` + `@event-click`.
6. **CalCalendar 레퍼런스**
   - Props 표: `events?: CalEventInput[]`(기본 `[]`), `options?: Partial<CalOptions>`, `loading?: boolean`.
   - v-model 표: `v-model:view`(`CalView`, 기본 `'month'`), `v-model:date`(ISO 문자열, 기본 현재 시각).
   - 이벤트(emits) 표: `rangeChange(CalRange)`(마운트 직후 1회 + 표시 범위 변경 시), `eventClick(CalEvent)`, `select({ start, end, allDay })`, `eventMove(payload)`, `eventResize(payload)`, `more(Dayjs)`. `eventMove`/`eventResize` payload는 현재 `unknown` 타입임을 그대로 표기.
   - 메서드(defineExpose) 표: `prev()`, `next()`, `today()`, `setView(view)`, `gotoDate(date)`.
   - `CalOptions` 전체 표(22개 필드): types.ts의 한국어 주석을 설명 컬럼으로 이관, 기본값 컬럼은 `DEFAULT_CAL_OPTIONS`(계획 Task 7 Step 6 최종본: `showHolidays` 제거, `primaryColor: '#1976d2'` 추가) 기준. `headerToolbar`·`locale`은 "현재 미적용" 표기.
   - `CalEventInput` 표: 필드별 기본값(end 생략 시 종일=익일/시간=+1h, editable 기본 false, interactive 기본 true, color 기본 `#409eff`·hex 권장, source 기본 `'cal'`). `rrule` 미적용 표기.
   - `CalEvent`(정규화 결과·콜백 수신 타입) 요점: `start`/`end`가 **Dayjs 객체**이고 **`end`는 배타적**(종일 일정은 익일 00:00)임을 강조. `key`/`rawId` 구분 설명.
7. **CalMiniMonth 레퍼런스** — `v-model`(ISO 문자열, 기본 현재 시각) + `options?: Partial<CalMiniOptions>` 표(`primaryColor` 기본 `'#1976d2'`, `firstDay` 기본 0, `weekdays` 기본 `['일'..'토']`).
8. **테마** — `options.primaryColor` 하나로 강조색 일괄 변경(`--cal-primary`로 주입되는 메커니즘 한 단락). 이벤트 색은 이벤트별 `color` 필드.
9. **알아둘 점** — (a) UI 문자열은 현재 한국어 고정, (b) 라이브러리가 소비 앱의 dayjs 인스턴스에 플러그인 5종(weekday, isoWeek, isBetween, isSameOrAfter, isSameOrBefore)을 자동 extend, (c) `CalEvent.end`는 배타적 종료.
10. **개발** — `yarn` / `yarn build` / `yarn typecheck` (yarn 전용, npm install 금지).
11. **라이선스** — MIT.

## 전제 및 머지 전 검증 항목

README가 전제하는 후속 작업(이 README 작업의 범위 밖, 배포 전 필수):

- [x] `package.json` `exports`에 CSS 서브패스 별칭 추가 — 병행 세션 커밋 `dc844de`로 완료(2026-07-05). 별칭 형태(`"./style.css"`)가 README 표기와 일치함을 확인.
- [x] Task 10 빌드 후 실제 CSS 산출 파일명 확인 — `dist/style.css` 실재 확인 완료(2026-07-04, 병행 세션 빌드 산출물).
- [x] Task 8·9 실제 커밋과 README의 CalMiniMonth·export 목록 대조 — 커밋 `4a66aa7`·`4ec6a6d`가 계획과 일치함을 확인 완료.
- [ ] 스크린샷 캡처 후 placeholder 교체.
- [x] npm에서 `s-calendar` 패키지명 사용 가능 여부 확인(2026-07-05) — **선점됨**(타인의 `s-calendar` v2.0.0 존재). 대안 `saeroun-cal-ui`는 미선점 확인. → 개명 결정 대기: 결정 시 package.json `name`과 README의 패키지명 문자열(설치 커맨드 2곳, import 4곳) 일괄 변경 필요.

## 작업 범위와 격리

- 이 작업이 수정하는 파일: `README.md` 하나(+ 본 설계 문서). 추출 계획의 어느 태스크도 README.md를 건드리지 않으므로 병행 세션과 충돌 없음.
- 커밋 시 해당 파일만 명시적으로 stage(`git add README.md`). `git add -A` 금지(병행 세션의 작업 트리 오염 방지).

## 갱신 이력

- 2026-07-05: 병행 세션의 i18n 구현(커밋 `1b0dd70`~`ed404f0`)이 본 스펙의 전제 두 가지를 해소 — `CalOptions.locale`이 실제 적용되고(내장 ko/en + `messages` 오버라이드, 미지원 값은 ko 폴백), "UI 문자열 한국어 고정"이 사라짐. README를 갱신함(`78af949`): 로케일 섹션 신설, CalOptions에 `messages` 추가(23필드), CalMiniMonth 카탈로그 폴백 반영. "현재 미적용" 잔여는 `headerToolbar`·`rrule` 2건, `more`는 여전히 미발생. 계획 문서(2026-07-05-readme.md)에 임베드된 README 본문·검증 기대값은 i18n 이전 기준의 실행 기록이며, 현행 원본은 README.md.
- 2026-07-05: npm `s-calendar` 선점 확인 → 패키지명 변경 결정 대기 중. 결정 시 package.json `name`·`repository`와 README의 패키지명 문자열(설치 2곳·import 4곳·배지 링크) 일괄 변경.
- 2026-07-05: 패키지명 **calvue** 확정(`52bc003`, npm 미선점 확인) — package.json name/repository URL, README 문자열 9곳, vite lib name(`Calvue`) 변경 완료. 잔여 수동 단계: GitHub 리포 rename(Settings → calvue, 옛 URL 자동 리다이렉트) 후 로컬 `git remote set-url origin https://github.com/vlslrtm2751/calvue.git`.
