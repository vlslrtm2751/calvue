<script lang="ts" setup>
import type { CalMiniOptions } from '../index'

withDefaults(
  defineProps<{
    modelValue?: string
    options?: Partial<CalMiniOptions>
  }>(),
  {
    modelValue: () => new Date().toISOString().slice(0, 10),
    options: () => ({}),
  },
)

defineEmits<{
  'update:modelValue': [date: string]
}>()
</script>

<template>
  <div class="cal-mini-month" />
</template>

<style scoped>
.cal-mini-month {
  --cal-primary: v-bind("options?.primaryColor ?? '#1976d2'");
}
</style>
