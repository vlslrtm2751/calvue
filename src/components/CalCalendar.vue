<script lang="ts" setup>
import type { CalEventInput, CalOptions, CalView, CalRange, CalEvent } from '../index'

withDefaults(
  defineProps<{
    date?: string
    view?: CalView
    events?: CalEventInput[]
    options?: Partial<CalOptions>
    loading?: boolean
  }>(),
  {
    date: () => new Date().toISOString().slice(0, 10),
    view: 'month',
    events: () => [],
    options: () => ({}),
    loading: false,
  },
)

defineEmits<{
  'update:date': [date: string]
  'update:view': [view: CalView]
  rangeChange: [range: CalRange]
  eventClick: [event: CalEvent]
  select: [range: CalRange]
  eventMove: [payload: { event: CalEvent; newStart: string; newEnd: string }]
  eventResize: [payload: { event: CalEvent; newEnd: string }]
}>()
</script>

<template>
  <div class="cal-calendar" />
</template>

<style scoped>
.cal-calendar {
  --cal-primary: v-bind("options?.primaryColor ?? '#1976d2'");
}
</style>
