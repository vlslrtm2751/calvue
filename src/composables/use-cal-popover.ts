import type { Ref } from 'vue';

/**
 * 팝오버 dismiss 정책 — 월 `+N`과 터치 클러스터가 공유한다.
 *
 * - 바깥 pointerdown: **capture 단계 필수**. 시간 블록(`cal-time-event.vue`)이 드래그 처리를 위해
 *   pointerdown에 `.stop`을 걸어, 그 위에서는 버블 단계 리스너가 아예 호출되지 않는다.
 * - 스크롤: 위치를 열 때 한 번만 계산하고 재측정하지 않으므로, 스크롤하면 엉뚱한 곳에 남는다.
 * - Esc: 기존 `@keydown.esc`는 포커스 불가능한 div에 붙어 있어 동작하지 않았다.
 *   window 리스너면 포커스가 어디 있든 동작한다.
 *
 * 여는 탭이 스스로를 닫지 않는 이유: 그 이벤트가 전파될 시점엔 팝오버가 아직 없어 `isOpen()`이 false다.
 */
export function useCalPopoverDismiss(popoverEl: Ref<HTMLElement | null>, isOpen: () => boolean, close: () => void): void {
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

  // scroll 이벤트는 버블링하지 않지만 capture 단계에서는 window→target으로 전파된다.
  // 그래서 window 하나로 내부 스크롤 컨테이너와 페이지 스크롤을 모두 잡는다.
  // (팝오버가 position: fixed라 페이지가 스크롤되면 앵커와 분리된 채 화면에 남는다)
  useEventListener(
    window,
    'scroll',
    () => {
      if (isOpen()) close();
    },
    { capture: true }
  );

  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (isOpen() && e.key === 'Escape') close();
  });
}
