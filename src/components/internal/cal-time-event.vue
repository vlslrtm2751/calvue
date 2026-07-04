<template>
  <div
    class="tev"
    :class="{ 'tev--static': !interactive }"
    :style="boxStyle"
    @click.stop="interactive && emit('click', { event: box.event, native: $event })"
    @dragstart="tip.hide()"
    @mouseenter="interactive && tip.show(box.event, $event.currentTarget as HTMLElement, $event.clientY)"
    @mouseleave="tip.hide()"
    @pointerdown.stop="
      (e) => {
        tip.hide();
        emit('pointerdown', { ev: box.event, native: e });
      }
    ">
    <div class="tev-title">{{ box.event.title }}</div>
    <div class="tev-time">{{ timeText }}</div>
    <div
      class="tev__resize"
      v-if="resizableEnd"
      @click.stop
      @pointerdown.stop="(e) => emit('resizePointerdown', { ev: box.event, native: e })" />
  </div>
</template>

<script lang="ts" setup>
  import type { TimeBox } from '../../composables/use-event-layout';
  import type { CalEvent } from '../../types';
  import { useCalTooltip } from '../../composables/use-cal-tooltip';

  const props = defineProps<{ box: TimeBox; resizableEnd?: boolean; timeLabel?: string }>();

  const emit = defineEmits<{
    click: [{ event: CalEvent; native: MouseEvent }];
    pointerdown: [{ ev: CalEvent; native: PointerEvent }];
    resizePointerdown: [{ ev: CalEvent; native: PointerEvent }];
  }>();

  const tip = useCalTooltip();
  const interactive = computed(() => props.box.event.interactive !== false);
  // per-day 라벨(멀티데이: 시작일 "HH:mm~" / 중간일 "종일" / 종료일 "~HH:mm")이 넘어오면 그걸, 없으면 당일 범위
  const timeText = computed(
    () => props.timeLabel ?? `${props.box.event.start.format('HH:mm')}–${props.box.event.end.format('HH:mm')}`
  );

  const boxStyle = computed(() => ({
    top: `${props.box.topPct}%`,
    height: `${props.box.heightPct}%`,
    left: `${props.box.leftPct}%`,
    width: `${props.box.widthPct}%`,
    background: props.box.event.color,
    zIndex: props.box.zIndex
  }));
</script>

<style scoped>
  .tev {
    position: absolute;
    border-radius: 6px;
    padding: 3px 6px;
    font-size: 11.5px;
    color: #fff;
    overflow: hidden;
    cursor: pointer;
    box-shadow: inset 3px 0 0 rgba(0, 0, 0, 0.18);
    box-sizing: border-box;
    min-height: 18px;
  }
  .tev--static {
    cursor: default;
  }

  /* bottom-edge time-resize handle — revealed on hover (editable same-day timed only) */
  .tev__resize {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: ns-resize;
    opacity: 0;
    pointer-events: none; /* 숨김 상태(터치 sticky-hover 포함)에선 탭을 가로채지 않음(데드존 방지) */
    transition: opacity 0.1s;
  }
  .tev__resize::before {
    content: '';
    height: 3px;
    width: 24px;
    max-width: 50%;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
  }
  /* hover 가능한 기기에서만 핸들 노출·상호작용 — 터치는 리사이즈 자체가 막혀 있음 */
  @media (hover: hover) {
    /* cascade에서 겹쳐 가려진 뒤 일정도 hover하면 앞으로 올라와 완전히 보이게 (인라인 z-index 위로) */
    .tev:hover {
      z-index: 50 !important;
    }
    .tev:hover .tev__resize {
      opacity: 1;
      pointer-events: auto;
    }
  }
  .tev-title {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tev-time {
    opacity: 0.9;
    font-size: 10.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
