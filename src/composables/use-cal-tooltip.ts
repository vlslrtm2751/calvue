import type { CalEvent } from '../types';
import { canHover } from './use-cal-device';
import { reactive } from 'vue';

export interface TooltipAnchor {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

interface TooltipState {
  event: CalEvent | null;
  anchor: TooltipAnchor | null;
  enabled: boolean;
}

const state = reactive<TooltipState>({ event: null, anchor: null, enabled: true });

export function useCalTooltip() {
  return {
    state,
    setEnabled(v: boolean) {
      state.enabled = v;
      if (!v) {
        state.event = null;
        state.anchor = null;
      }
    },
    show(event: CalEvent, el: HTMLElement, clientY?: number) {
      if (!state.enabled || !canHover()) return;
      const r = el.getBoundingClientRect();
      state.event = event;
      // 세로 기준은 포인터(clientY) — 긴 멀티데이 블록의 top은 스크롤로 뷰포트 위(음수)가 되어
      // clamp가 툴팁을 화면 맨 위로 밀어버린다. 포인터는 호버 중이라 항상 화면 안.
      state.anchor = { top: clientY ?? r.top, left: r.left, right: r.right, bottom: r.bottom };
    },
    hide() {
      state.event = null;
      state.anchor = null;
    }
  };
}
