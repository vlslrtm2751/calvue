<template>
  <div
    class="cal-evt"
    :class="{ 'cal-evt--grab': event.editable, 'cal-evt--static': !interactive }"
    :style="{ backgroundColor: event.color, color: textColor }"
    @click.stop="interactive && $emit('click', event)"
    @mouseenter="interactive && tip.show(event, $event.currentTarget as HTMLElement, $event.clientY)"
    @mouseleave="tip.hide()"
    @pointerdown="
      (e) => {
        tip.hide();
        $emit('pointerdown', { ev: event, native: e });
      }
    ">
    <span class="cal-evt__dot" v-if="!event.allDay && !continued" />
    <span class="cal-evt__time" v-if="!event.allDay && !continued">{{ fmtEventTime(event.start) }}</span>
    <span class="cal-evt__label" :class="{ 'cal-evt__label--timed': !event.allDay }">{{ event.title }}</span>
    <span
      class="cal-evt__resize"
      v-if="resizableEnd"
      @click.stop
      @pointerdown.stop="(e) => $emit('resizePointerdown', { ev: event, native: e })"
      title="기간 조절" />
  </div>
</template>

<script lang="ts" setup>
  import type { CalEvent } from './types';
  import { fmtEventTime } from './format';
  import { useCalTooltip } from './use-cal-tooltip';

  // continued: 멀티위크 일정의 '시작 주가 아닌' 이어지는 조각 → 시각/점을 숨기고 제목만(시작 주에만 시간 표시)
  const props = defineProps<{ event: CalEvent; resizableEnd?: boolean; continued?: boolean }>();
  defineEmits<{
    click: [CalEvent];
    pointerdown: [{ ev: CalEvent; native: PointerEvent }];
    resizePointerdown: [{ ev: CalEvent; native: PointerEvent }];
  }>();

  const textColor = computed(() => (props.event.extendedProps?.textColor as string) ?? '#fff');
  const interactive = computed(() => props.event.interactive !== false);
  const tip = useCalTooltip();
</script>

<style scoped>
  .cal-evt {
    font-size: 12.5px;
    line-height: 1.5;
    border-radius: 5px;
    padding: 1px 6px;
    margin-top: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    min-height: var(--cal-event-height, 22px);
    display: flex;
    align-items: center;
    position: relative;
    transition:
      filter 0.1s,
      box-shadow 0.1s;
  }

  @media (hover: hover) {
    .cal-evt:hover {
      filter: brightness(0.94);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
    }
  }

  .cal-evt--grab {
    cursor: grab;
  }

  .cal-evt--grab:active {
    cursor: grabbing;
  }

  /* non-interactive event: display only (no click/tooltip/hover feedback) */
  .cal-evt--static {
    cursor: default;
  }
  .cal-evt--static:hover {
    filter: none;
    box-shadow: none;
  }

  /* right-edge date-resize handle — revealed on hover (editable bars only) */
  .cal-evt__resize {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: ew-resize;
    opacity: 0;
    pointer-events: none; /* 숨김 상태(터치 sticky-hover 포함)에선 탭을 가로채지 않음(데드존 방지) */
    transition: opacity 0.1s;
  }
  .cal-evt__resize::before {
    content: '';
    width: 3px;
    height: 58%;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.18);
  }
  /* hover 가능한 기기에서만 핸들 노출·상호작용 — 터치는 리사이즈 자체가 막혀 있음 */
  @media (hover: hover) {
    .cal-evt:hover .cal-evt__resize {
      opacity: 1;
      pointer-events: auto;
    }
  }

  .cal-evt__dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 2px;
    background: currentColor;
    margin-right: 5px;
    vertical-align: middle;
    flex: none;
  }

  /* time vs title distinction: time lighter + spaced, title bold */
  .cal-evt__time {
    flex: none;
    margin-right: 5px;
    opacity: 0.85;
  }
  .cal-evt__label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  /* bold title only when a time is shown on the left (timed events) */
  .cal-evt__label--timed {
    font-weight: 600;
  }
</style>
