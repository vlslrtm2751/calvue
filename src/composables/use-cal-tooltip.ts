import type { CalEvent } from '../types';
import type { InjectionKey } from 'vue';
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

export interface CalTooltipApi {
  state: TooltipState;
  setEnabled(v: boolean): void;
  show(event: CalEvent, el: HTMLElement, clientY?: number): void;
  hide(): void;
}

/** 루트 컴포넌트가 인스턴스별 상태를 provide, 내부 컴포넌트가 inject. */
export const CAL_TOOLTIP: InjectionKey<CalTooltipApi> = Symbol('cal-tooltip');

function createTooltipApi(): CalTooltipApi {
  const state = reactive<TooltipState>({ event: null, anchor: null, enabled: true });
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

/**
 * 루트(cal-calendar.vue)가 호출 — 이 인스턴스 전용 상태를 만들어 provide한다.
 * 모듈 싱글턴이면 한 페이지의 캘린더 두 개가 툴팁 상태를 공유하고
 * 각자의 showTooltip watcher가 같은 enabled 플래그를 서로 덮어쓴다.
 */
export function provideCalTooltip(): CalTooltipApi {
  const api = createTooltipApi();
  provide(CAL_TOOLTIP, api);
  return api;
}

// provider 없이 내부 컴포넌트를 단독 사용해도 안전하도록 모듈 공유 폴백 (use-cal-i18n의 KO_FALLBACK과 같은 취지)
const FALLBACK = createTooltipApi();

/** 내부 컴포넌트에서 호출. 반환 형태는 기존과 동일하므로 호출부는 바뀌지 않는다. */
export function useCalTooltip(): CalTooltipApi {
  return inject(CAL_TOOLTIP, FALLBACK);
}
