import type { TimeWindow } from './use-event-layout';
import { FULL_DAY_WINDOW } from './use-event-layout';
import { isTouch } from './use-cal-device';
import type { Dayjs } from 'dayjs';
import { reactive } from 'vue';

// 선택 드래그 프리뷰 싱글톤 (이벤트 이동 프리뷰와 별개)
interface SelectPreview {
  active: boolean;
  mode: 'month' | 'time' | null;
  startDate: string | null; // month: 포함 ISO 시작(lo)
  endDate: string | null; // month: 포함 ISO 끝(hi)
  startKey: string | null; // time: 범위 시작 날짜(ISO)
  startMin: number; // time: 시작 자정기준 분
  endKey: string | null; // time: 범위 끝 날짜(ISO)
  endMin: number; // time: 끝 자정기준 분
}
const preview = reactive<SelectPreview>({
  active: false,
  mode: null,
  startDate: null,
  endDate: null,
  startKey: null,
  startMin: 0,
  endKey: null,
  endMin: 0
});
export function useSelectPreview() {
  return preview;
}

const SNAP = 30; // 주/일 선택은 30분 스냅

export function useCalendarSelect(
  onSelect: (range: { start: Dayjs; end: Dayjs; allDay: boolean }) => void,
  isEnabled: () => boolean = () => true,
  /** 시간 그리드가 그리는 시간대(자정 기준 분) — 포인터 위치를 시각으로 바꿀 때 쓴다 */
  timeWindow: () => TimeWindow = () => FULL_DAY_WINDOW
) {
  const didSelect = ref<boolean>(false);

  // ── 월: 날짜 셀 가로 드래그 → 종일 날짜범위 ─────────────────────────────
  function startMonthSelect(anchorDay: Dayjs, e: PointerEvent): void {
    if (!isEnabled()) return;
    if (e.target !== e.currentTarget) return; // 셀 배경에서만 시작(요일숫자/+N 자식 제외)
    if (isTouch()) return; // mobile: defer to swipe-nav; tap to create
    const el = e.currentTarget as HTMLElement | null;
    try {
      el?.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    const downX = e.clientX;
    const downY = e.clientY;
    const anchorKey = anchorDay.format('YYYY-MM-DD');
    let curKey = anchorKey;
    let started = false;

    const refresh = (): void => {
      const a = dayjs(anchorKey);
      const c = dayjs(curKey);
      const lo = a.isAfter(c) ? c : a;
      const hi = a.isAfter(c) ? a : c;
      preview.active = true;
      preview.mode = 'month';
      preview.startDate = lo.format('YYYY-MM-DD');
      preview.endDate = hi.format('YYYY-MM-DD');
    };

    const onMove = (me: PointerEvent): void => {
      if (!started) {
        if (Math.hypot(me.clientX - downX, me.clientY - downY) < 8) return;
        started = true;
      }
      const t = document.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null;
      const cell = t?.closest<HTMLElement>('[data-cal-date]');
      if (cell?.dataset.calDate) {
        curKey = cell.dataset.calDate;
        refresh();
      }
    };
    const ac = new AbortController();
    const reset = (): void => {
      preview.active = false;
      preview.mode = null;
    };
    const onUp = (): void => {
      ac.abort();
      if (started) {
        didSelect.value = true;
        const a = dayjs(anchorKey);
        const c = dayjs(curKey);
        const lo = a.isAfter(c) ? c : a;
        const hi = a.isAfter(c) ? a : c;
        onSelect({ start: lo.startOf('day'), end: hi.startOf('day').add(1, 'day'), allDay: true });
      }
      reset();
    };
    const onCancel = (): void => {
      ac.abort();
      reset();
    };
    document.addEventListener('pointermove', onMove, { signal: ac.signal });
    document.addEventListener('pointerup', onUp, { signal: ac.signal });
    document.addEventListener('pointercancel', onCancel, { signal: ac.signal });
  }

  // ── 주/일: 세로 드래그(같은 주 다른 날까지 가능) → 시간범위(30분 스냅) ────
  function startTimeSelect(day: Dayjs, e: PointerEvent): void {
    if (!isEnabled()) return;
    const el = e.currentTarget as HTMLElement | null; // .tg-col[data-cal-col]
    if (!el) return;
    if ((e.target as HTMLElement)?.closest('.tev')) return; // 이벤트 칩에서 시작하면 이동 드래그 담당
    if (isTouch()) return; // mobile: defer to swipe-nav; tap to create
    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    const anchorRect = el.getBoundingClientRect();
    const anchorKey = day.format('YYYY-MM-DD');
    const downX = e.clientX;
    const downY = e.clientY;

    const win = timeWindow();
    const span = Math.max(1, win.end - win.start);
    const minAt = (clientY: number, rect: DOMRect, round: boolean): number => {
      const raw = win.start + ((clientY - rect.top) / rect.height) * span;
      const snapped = (round ? Math.round(raw / SNAP) : Math.floor(raw / SNAP)) * SNAP;
      return Math.max(win.start, Math.min(win.end, snapped));
    };

    const anchorMin = minAt(downY, anchorRect, false); // 누른 슬롯(floor)
    let curKey = anchorKey;
    let curMin = anchorMin;
    let started = false;

    const refresh = (): void => {
      const aDT = dayjs(anchorKey).startOf('day').add(anchorMin, 'minute');
      const cDT = dayjs(curKey).startOf('day').add(curMin, 'minute');
      const startDT = aDT.isAfter(cDT) ? cDT : aDT;
      const endDT = aDT.isAfter(cDT) ? aDT : cDT;
      preview.active = true;
      preview.mode = 'time';
      preview.startKey = startDT.format('YYYY-MM-DD');
      preview.startMin = startDT.diff(startDT.startOf('day'), 'minute');
      preview.endKey = endDT.format('YYYY-MM-DD');
      preview.endMin = endDT.diff(endDT.startOf('day'), 'minute');
    };

    const onMove = (me: PointerEvent): void => {
      if (!started) {
        if (Math.hypot(me.clientX - downX, me.clientY - downY) < 8) return;
        started = true;
      }
      const t = document.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null;
      const col = t?.closest<HTMLElement>('[data-cal-col]');
      if (col?.dataset.calDate) {
        curKey = col.dataset.calDate;
        curMin = minAt(me.clientY, col.getBoundingClientRect(), true); // 가까운 30분으로 round
      } else {
        // 컬럼 밖(거터/헤더 등): 세로 위치만 갱신
        curMin = minAt(me.clientY, anchorRect, true);
      }
      refresh();
    };
    const ac = new AbortController();
    const reset = (): void => {
      preview.active = false;
      preview.mode = null;
    };
    const onUp = (): void => {
      ac.abort();
      if (started) {
        didSelect.value = true;
        const aDT = dayjs(anchorKey).startOf('day').add(anchorMin, 'minute');
        const cDT = dayjs(curKey).startOf('day').add(curMin, 'minute');
        const startDT = aDT.isAfter(cDT) ? cDT : aDT;
        let endDT = aDT.isAfter(cDT) ? aDT : cDT;
        if (!endDT.isAfter(startDT)) endDT = startDT.add(SNAP, 'minute');
        onSelect({ start: startDT, end: endDT, allDay: false });
      }
      reset();
    };
    const onCancel = (): void => {
      ac.abort();
      reset();
    };
    document.addEventListener('pointermove', onMove, { signal: ac.signal });
    document.addEventListener('pointerup', onUp, { signal: ac.signal });
    document.addEventListener('pointercancel', onCancel, { signal: ac.signal });
  }

  /** 드래그 직후 트레일링 클릭 1회 억제용 (consumeDrag와 동일 패턴) */
  function consumeSelect(): boolean {
    if (didSelect.value) {
      didSelect.value = false;
      return true;
    }
    return false;
  }

  return { startMonthSelect, startTimeSelect, consumeSelect };
}
