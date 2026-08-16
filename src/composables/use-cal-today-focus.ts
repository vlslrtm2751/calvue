import type { Ref } from 'vue';

/**
 * '오늘' 버튼 스크롤 신호 — seq가 오를 때마다 뷰가 자기 정책대로 오늘 위치로 스크롤한다.
 *
 * seq(누른 횟수)를 신호로 쓰는 이유: 이미 오늘이 속한 기간을 보고 있으면 앵커가 그대로라
 * days/weeks/range 어느 것도 바뀌지 않고, 따라서 관찰할 반응형 의존성이 아예 없다.
 * 카운터는 값과 무관하게 매번 엣지를 만든다.
 *
 * nextTick을 거치는 이유: 앵커가 바뀐 경우 그리드가 다시 그려지므로, 그 전에 측정하면 옛 위치가 나온다.
 */
export function useCalTodayFocus(seq: Ref<number | undefined>, scrollToToday: (behavior: ScrollBehavior) => void): void {
  watch(seq, async (next, prev) => {
    if (next == null || next === prev) return;
    await nextTick();
    scrollToToday(prefersReducedMotion() ? 'auto' : 'smooth');
  });
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false; // SSR 안전
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
