<template>
  <teleport to="body">
    <!-- 종일·멀티데이 → 색 막대(bar) / 단일일 timed → 점+시간(월뷰 dot-row와 같은 형태) -->
    <div
      class="cal-drag-ghost cal-drag-ghost--bar"
      v-if="ghost.active && ghost.event && isBar"
      :style="{
        left: `${ghost.x}px`,
        top: `${ghost.y}px`,
        width: `${ghost.width}px`,
        backgroundColor: ghost.event.color
      }">
      {{ ghost.event.title }}
    </div>
    <div
      class="cal-drag-ghost cal-drag-ghost--dot"
      v-else-if="ghost.active && ghost.event"
      :style="{ left: `${ghost.x}px`, top: `${ghost.y}px`, width: `${ghost.width}px` }">
      <span class="cal-drag-ghost__dot" :style="{ background: ghost.event.color }" />
      <span class="cal-drag-ghost__time">{{ fmtEventTime(ghost.event.start) }}</span>
      <span class="cal-drag-ghost__title">{{ ghost.event.title }}</span>
    </div>
  </teleport>
</template>

<script lang="ts" setup>
  import { useDragGhost } from '../../composables/use-calendar-dnd';
  import { fmtEventTime } from '../../format';

  const ghost = useDragGhost();
  // 종일이거나 멀티데이면 막대 형태, 아니면(단일일 timed) 점+시간 형태 — 월뷰 표시와 일치
  const isBar = computed(() => {
    const e = ghost.event;
    if (!e) return false;
    if (e.allDay) return true;
    return !e.start.startOf('day').isSame(e.end.subtract(1, 'millisecond').startOf('day'), 'day');
  });
</script>

<style scoped>
  .cal-drag-ghost {
    position: fixed;
    z-index: 10001;
    pointer-events: none;
    font-size: 12px;
    line-height: 1.6;
    border-radius: 6px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
    opacity: 0.92;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transform: translateZ(0);
  }
  .cal-drag-ghost--bar {
    color: #fff;
    padding: 2px 8px;
  }
  .cal-drag-ghost--dot {
    display: flex;
    align-items: center;
    gap: 5px;
    background: #fff;
    padding: 3px 8px;
  }
  .cal-drag-ghost__dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    flex: none;
  }
  .cal-drag-ghost__time {
    color: #6b7280;
    flex: none;
  }
  .cal-drag-ghost__title {
    color: #1f2937;
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
