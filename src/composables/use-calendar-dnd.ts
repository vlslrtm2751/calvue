import type { CalEvent } from '../types';
import { isTouch } from './use-cal-device';
import type { Dayjs } from 'dayjs';
import { reactive } from 'vue';

interface DragGhostState {
  active: boolean;
  event: CalEvent | null;
  x: number;
  y: number;
  width: number;
}
const ghost = reactive<DragGhostState>({ active: false, event: null, x: 0, y: 0, width: 160 });
export function useDragGhost() {
  return ghost;
}

interface DragTimePreview {
  active: boolean;
  dateKey: string | null;
  startMin: number;
  durationMin: number;
  event: CalEvent | null;
}
const timePreview = reactive<DragTimePreview>({
  active: false,
  dateKey: null,
  startMin: 0,
  durationMin: 60,
  event: null
});
export function useDragPreview() {
  return timePreview;
}

export function useCalendarDnd(
  onDrop: (ev: CalEvent, deltaDays: number, deltaMinutes: number) => void,
  isEnabled: () => boolean = () => true,
  onResize?: (ev: CalEvent, start: Dayjs, end: Dayjs) => void
) {
  const draggingKey = ref<string | null>(null);
  const resizingKey = ref<string | null>(null);
  const hoverDate = ref<string | null>(null);
  // inclusive day range (ms) the dragged event would occupy at the current drop position
  const dropPreview = ref<{ startMs: number; endMs: number } | null>(null);
  const didDrag = ref<boolean>(false);

  function startMonthDrag(ev: CalEvent, e: PointerEvent): void {
    if (!isEnabled()) return;
    if (!ev.editable) return;
    if (isTouch()) return; // mobile: defer to swipe-nav; edit via tap
    const el = e.currentTarget as HTMLElement | null;
    try {
      el?.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    const rect = el?.getBoundingClientRect();
    const grabDx = rect ? e.clientX - rect.left : 0;
    const grabDy = rect ? e.clientY - rect.top : 0;
    const ghostW = rect?.width ?? 160;

    const downX = e.clientX;
    const downY = e.clientY;
    // Model A (grab-aware): anchor the shift on the day under the pointer at grab time,
    // so the grabbed day lands on the drop target (duration preserved). Falls back to the
    // event's start day if the grab point isn't over a day cell.
    const grabCell = document
      .elementsFromPoint(e.clientX, e.clientY)
      .map((el) => el.closest<HTMLElement>('[data-cal-date]'))
      .find((c): c is HTMLElement => !!c);
    const grabDate = grabCell?.dataset.calDate ? dayjs(grabCell.dataset.calDate) : ev.start;
    let started = false;

    const onMove = (me: PointerEvent): void => {
      if (!started) {
        if (Math.hypot(me.clientX - downX, me.clientY - downY) < 8) return;
        started = true;
        draggingKey.value = ev.key;
        ghost.active = true;
        ghost.event = ev;
        ghost.width = ghostW;
      }
      ghost.x = me.clientX - grabDx;
      ghost.y = me.clientY - grabDy;
      const targetEl = document.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null;
      const cell = targetEl?.closest<HTMLElement>('[data-cal-date]');
      hoverDate.value = cell?.dataset.calDate ?? null;
      if (hoverDate.value) {
        // shift the event's whole span by (drop − grab); highlight those cells (model A)
        const delta = dayjs(hoverDate.value).startOf('day').diff(grabDate.startOf('day'), 'day');
        dropPreview.value = {
          startMs: ev.start.startOf('day').add(delta, 'day').valueOf(),
          endMs: ev.end.subtract(1, 'millisecond').startOf('day').add(delta, 'day').valueOf()
        };
      } else {
        dropPreview.value = null;
      }
    };
    const ac = new AbortController();
    const reset = (): void => {
      draggingKey.value = null;
      hoverDate.value = null;
      dropPreview.value = null;
      ghost.active = false;
      ghost.event = null;
    };
    const onUp = (): void => {
      ac.abort();
      if (started) {
        didDrag.value = true;
        if (hoverDate.value) {
          const target = dayjs(hoverDate.value).startOf('day');
          const delta = target.diff(grabDate.startOf('day'), 'day');
          if (delta !== 0) {
            onDrop(ev, delta, 0);
          }
        }
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

  function startTimeDrag(ev: CalEvent, e: PointerEvent): void {
    if (!isEnabled()) return;
    if (!ev.editable || ev.allDay) return; // timed events only
    if (isTouch()) return; // mobile: defer to swipe-nav; edit via tap
    const originEl = e.currentTarget as HTMLElement | null;
    try {
      originEl?.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }

    const downX = e.clientX;
    const downY = e.clientY;
    let started = false;
    const SNAP = 15;
    const origStartMin = ev.start.diff(ev.start.startOf('day'), 'minute');
    const durationMin = Math.max(15, ev.end.diff(ev.start, 'minute'));

    // how far (in minutes) below the event's start the user grabbed, measured in the origin column
    let grabOffsetMin = 0;
    const startCol = originEl?.closest<HTMLElement>('[data-cal-col]');
    if (startCol) {
      const r = startCol.getBoundingClientRect();
      grabOffsetMin = ((downY - r.top) / r.height) * 1440 - origStartMin;
    }

    let dropDays = 0;
    let dropStartMin = origStartMin;

    const onMove = (me: PointerEvent): void => {
      if (!started) {
        if (Math.hypot(me.clientX - downX, me.clientY - downY) < 8) return;
        started = true;
        draggingKey.value = ev.key;
      }
      const el = document.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null;
      const col = el?.closest<HTMLElement>('[data-cal-col]');
      if (!col) return;
      const r = col.getBoundingClientRect();
      let min = ((me.clientY - r.top) / r.height) * 1440 - grabOffsetMin;
      min = Math.max(0, Math.min(1440 - SNAP, Math.round(min / SNAP) * SNAP));
      dropStartMin = min;
      const colDate = col.dataset.calDate;
      if (colDate) dropDays = dayjs(colDate).startOf('day').diff(ev.start.startOf('day'), 'day');
      hoverDate.value = colDate ?? null;
      timePreview.active = true;
      timePreview.event = ev;
      timePreview.durationMin = durationMin;
      timePreview.dateKey = colDate ?? null;
      timePreview.startMin = dropStartMin;
    };
    const ac = new AbortController();
    const reset = (): void => {
      draggingKey.value = null;
      hoverDate.value = null;
      timePreview.active = false;
      timePreview.event = null;
    };
    const onUp = (): void => {
      ac.abort();
      if (started) {
        didDrag.value = true;
        const deltaMinutes = dropStartMin - origStartMin;
        if (dropDays !== 0 || deltaMinutes !== 0) {
          onDrop(ev, dropDays, deltaMinutes);
        }
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

  /**
   * Horizontal (date) resize of a bar's END edge: the grabbed handle follows the day under the
   * pointer; start stays put. All-day → exclusive midnight after the new last day; timed multi-day
   * → keeps the end's time-of-day. Min 1 day. Reuses dropPreview to highlight the resulting span.
   */
  function startResizeEnd(ev: CalEvent, e: PointerEvent): void {
    if (!isEnabled()) return;
    if (!ev.editable) return;
    if (isTouch()) return; // mobile: edit via tap, no hover handle
    const el = e.currentTarget as HTMLElement | null;
    try {
      el?.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    const startDay = ev.start.startOf('day');
    const endTimeMin = ev.end.diff(ev.end.startOf('day'), 'minute'); // end's time-of-day (timed)
    const downX = e.clientX;
    const downY = e.clientY;
    let started = false;
    let newEnd: Dayjs | null = null;

    const onMove = (me: PointerEvent): void => {
      if (!started) {
        if (Math.hypot(me.clientX - downX, me.clientY - downY) < 6) return;
        started = true;
        resizingKey.value = ev.key;
      }
      const targetEl = document.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null;
      const cell = targetEl?.closest<HTMLElement>('[data-cal-date]');
      if (!cell?.dataset.calDate) return;
      let endDay = dayjs(cell.dataset.calDate).startOf('day');
      if (endDay.isBefore(startDay)) endDay = startDay; // min 1 day
      newEnd = ev.allDay ? endDay.add(1, 'day') : endDay.add(endTimeMin, 'minute');
      dropPreview.value = { startMs: startDay.valueOf(), endMs: endDay.valueOf() };
    };
    const ac = new AbortController();
    const reset = (): void => {
      resizingKey.value = null;
      dropPreview.value = null;
    };
    const onUp = (): void => {
      ac.abort();
      if (started) {
        didDrag.value = true;
        if (newEnd && newEnd.valueOf() !== ev.end.valueOf() && newEnd.isAfter(ev.start)) {
          onResize?.(ev, ev.start, newEnd);
        }
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

  /**
   * Vertical (time) resize of a same-day timed event's END edge: the bottom handle follows the
   * pointer's Y within the event's own column → new end minute (15-min snap, min 15-min duration,
   * clamped to the same day). Reuses timePreview to show the resulting box live.
   */
  function startTimeResize(ev: CalEvent, e: PointerEvent): void {
    if (!isEnabled()) return;
    if (!ev.editable || ev.allDay) return; // timed only
    if (isTouch()) return;
    const originEl = e.currentTarget as HTMLElement | null;
    const originCol = originEl?.closest<HTMLElement>('[data-cal-col]');
    try {
      originEl?.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    const SNAP = 15;
    const dayStart = ev.start.startOf('day');
    const startMin = ev.start.diff(dayStart, 'minute');
    const downX = e.clientX;
    const downY = e.clientY;
    let started = false;
    let endMin = ev.end.diff(dayStart, 'minute');

    const onMove = (me: PointerEvent): void => {
      if (!started) {
        if (Math.hypot(me.clientX - downX, me.clientY - downY) < 6) return;
        started = true;
        resizingKey.value = ev.key;
      }
      if (!originCol) return;
      const r = originCol.getBoundingClientRect();
      let min = ((me.clientY - r.top) / r.height) * 1440;
      min = Math.round(min / SNAP) * SNAP;
      endMin = Math.max(startMin + SNAP, Math.min(1440, min)); // min 15-min duration, same day
      timePreview.active = true;
      timePreview.event = ev;
      timePreview.dateKey = ev.start.format('YYYY-MM-DD');
      timePreview.startMin = startMin;
      timePreview.durationMin = endMin - startMin;
    };
    const ac = new AbortController();
    const reset = (): void => {
      resizingKey.value = null;
      timePreview.active = false;
      timePreview.event = null;
    };
    const onUp = (): void => {
      ac.abort();
      if (started) {
        didDrag.value = true;
        const newEnd = dayStart.add(endMin, 'minute');
        if (newEnd.valueOf() !== ev.end.valueOf() && newEnd.isAfter(ev.start)) {
          onResize?.(ev, ev.start, newEnd);
        }
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

  /** Returns true once if a drag just completed — callers use it to suppress the trailing click. */
  function consumeDrag(): boolean {
    if (didDrag.value) {
      didDrag.value = false;
      return true;
    }
    return false;
  }

  function inDropPreview(day: Dayjs): boolean {
    const p = dropPreview.value;
    if (!p) return false;
    const ms = day.startOf('day').valueOf();
    return ms >= p.startMs && ms <= p.endMs;
  }

  return {
    draggingKey,
    resizingKey,
    hoverDate,
    inDropPreview,
    startMonthDrag,
    startTimeDrag,
    startResizeEnd,
    startTimeResize,
    consumeDrag
  };
}
