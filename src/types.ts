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
  extendedProps?: Record<string, unknown>;
}

/** event-move / event-resize 페이로드. start·end는 변경 후의 새 값 (end는 배타적 종료). */
export interface CalEventChange {
  ev: CalEvent;
  start: Dayjs;
  end: Dayjs;
}

/** 로케일별 UI 문자열 + 요일 배열 + 날짜/시간 포맷터. 내장 ko/en 카탈로그가 구현한다. */
export interface CalMessages {
  // 정적 UI 문자열
  today: string;
  prev: string;
  next: string;
  viewDay: string;
  viewWeek: string;
  viewMonth: string;
  viewList: string;
  allDay: string;
  creator: string;
  start: string;
  end: string;
  close: string;
  resizeHint: string;
  noEvents: string;
  /** 오늘 행에 일정이 하나도 없을 때 표시. 기간 전체가 빈 `noEvents`와는 다른 문구다 */
  noEventsOnDay: string;
  todaySuffix: string;
  more: (n: number) => string;
  overlapCount: (n: number) => string;
  // 요일 이름 (일요일 = index 0, 7개)
  weekdaysShort: string[];
  // 로케일별 날짜/시간 포맷터
  monthTitle: (d: Dayjs) => string;
  dayTitle: (d: Dayjs) => string;
  weekTitle: (start: Dayjs, end: Dayjs) => string;
  eventTime: (d: Dayjs) => string;
  dayLabel: (ev: CalEvent, day: Dayjs) => string;
  gridTimeLabel: (ev: CalEvent, day: Dayjs) => string;
  /** 시:분 한 지점. 주/일 눈금·드래그 프리뷰·클러스터 팝오버가 공유한다.
      Dayjs가 아니라 (hour, minute)인 이유: 드래그 프리뷰는 자정 기준 분만 들고 있고 Dayjs가 없다 */
  clockTime: (hour: number, minute: number) => string;
  /** 툴팁의 날짜+시각. 날짜가 필요해 clockTime과 분리한다 */
  tooltipDateTime: (d: Dayjs) => string;
  popoverDate: (d: Dayjs) => string;
  listMonthHeader: (d: Dayjs) => string;
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
  // id, source, and the event's start time combined must be unique — colliding combinations create duplicate render keys
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
  extendedProps?: Record<string, unknown>;
}

/** 같은 날 내 일정 정렬 비교 함수 (Array.sort 시그니처) */
export type EventOrder = (a: CalEvent, b: CalEvent) => number;

/** fullCalendar calendarOptions의 우리가 쓰는 subset 설정 객체 */
export type CalTooltipField = "creator" | "start" | "end" | "description";

/** 시각 표기. 'auto'는 뷰별 관례(월=12시간, 주·일·목록=24시간). */
export type TimeFormat = "auto" | "12h" | "24h";

export interface CalOptions {
  views: CalView[]; // 표시할 뷰 (기본 ['day','week','month','list'])
  locale: string; // 'ko' | 'en' 내장; 그 외는 messages로 공급 (기본 'ko')
  messages?: Partial<CalMessages>; // 선택: 선택 로케일 기본값 위 키 단위 얕은 병합
  /** 시각 표기 (기본 'auto' = 월 12시간 / 주·일·목록 24시간). messages로 넘긴 포맷터가 이보다 우선한다 */
  timeFormat: TimeFormat;
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
  /** 요일 라벨, 일요일부터. 미지정 시 로케일 카탈로그의 weekdaysShort 사용 (명시 시 우선) */
  weekdays?: string[];
  locale: string; // 'ko' | 'en' 내장 (기본 'ko')
  messages?: Partial<CalMessages>; // 선택: 키 단위 얕은 병합
}
