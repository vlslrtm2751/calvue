// 입력장치(hover) 기준 판별 — 뷰포트 폭(smAndDown)이 아니라 실제 hover 가능 여부로 본다.
// 터치 기기(폰·태블릿; 화면 폭 무관)는 드래그·리사이즈·셀 생성·스와이프·hover 툴팁을 막는다:
// 세로 스크롤과 충돌하고, 정밀도가 낮으며, hover 개념이 없기 때문. 마우스 기기는 폭과 무관하게 허용.
// (레이아웃 반응형은 여전히 폭 기준 smAndDown/미디어쿼리를 쓴다 — 이건 '상호작용' 게이트 전용.)
const hoverMql = typeof window !== 'undefined' ? window.matchMedia('(hover: hover)') : null;

/** 마우스 등 hover 가능한(primary 입력) 기기인가 */
export const canHover = (): boolean => hoverMql?.matches ?? false;

/** 터치 기기인가 — 위 상호작용을 막는 신호 */
export const isTouch = (): boolean => !canHover();
