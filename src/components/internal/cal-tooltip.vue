<template>
  <teleport to="body">
    <div class="cal-tip" v-if="state.event" :style="{ left: pos.left + 'px', top: pos.top + 'px' }" ref="el">
      <slot :event="state.event">
        <div class="cal-tip__title">{{ state.event.title }}</div>
        <hr class="cal-tip__hr" v-if="props.fields.length" />
        <template v-for="f in props.fields" :key="f">
          <div class="cal-tip__row" v-if="f === 'creator' && creator">{{ m.creator }}: {{ creator }}</div>
          <div class="cal-tip__row" v-else-if="f === 'start'"
            >{{ m.start }}: {{ m.tooltipDateTime(state.event.start) }}</div
          >
          <div class="cal-tip__row" v-else-if="f === 'end'"
            >{{ m.end }}: {{ m.tooltipDateTime(state.event.end) }}</div
          >
          <div class="cal-tip__desc" v-else-if="f === 'description' && description">{{ description }}</div>
        </template>
      </slot>
    </div>
  </teleport>
</template>

<script lang="ts" setup>
  import { useCalTooltip } from '../../composables/use-cal-tooltip';
  import { useCalI18n } from '../../composables/use-cal-i18n';
  import type { CalTooltipField } from '../../types';

  const props = withDefaults(defineProps<{ fields?: CalTooltipField[] }>(), {
    fields: () => ['creator', 'start', 'end', 'description']
  });

  const GAP = 8;

  const { state } = useCalTooltip();
  const m = useCalI18n();
  const el = ref<HTMLElement | null>(null);
  const pos = reactive({ left: 0, top: 0 });

  const creator = computed(() => state.event?.extendedProps?.creator as string | undefined);
  const description = computed(() => state.event?.extendedProps?.description as string | undefined);

  function reposition() {
    if (!el.value || !state.anchor) return;
    const width = el.value.offsetWidth;
    const height = el.value.offsetHeight;
    const anchor = state.anchor;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // default: right of the event; flip left if no room
    let left = anchor.right + GAP;
    if (left + width > vw - GAP) left = anchor.left - width - GAP;
    if (left < GAP) left = GAP;

    // align tops; clamp bottom
    let top = anchor.top;
    if (top + height > vh - GAP) top = vh - height - GAP;
    if (top < GAP) top = GAP;

    pos.left = left;
    pos.top = top;
  }

  watch([() => state.event, () => state.anchor], async () => {
    await nextTick();
    reposition();
  });
</script>

<style scoped>
  .cal-tip {
    position: fixed;
    background: #444;
    color: #f6f6f6;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 13px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: var(--cal-tooltip-z, 10000);
    pointer-events: none;
    max-width: 320px;
  }
  .cal-tip__title {
    font-weight: 700;
    margin-bottom: 4px;
  }
  .cal-tip__hr {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    margin: 4px 0;
  }
  .cal-tip__row {
    line-height: 1.6;
  }
  .cal-tip__desc {
    margin-top: 2px;
    white-space: pre-wrap;
    max-width: 320px;
    opacity: 0.85;
  }
</style>
