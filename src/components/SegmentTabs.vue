<script setup lang="ts">
export interface SegmentTabItem {
  disabled?: boolean;
  id: string | null;
  label: string;
}

withDefaults(defineProps<{
  items: SegmentTabItem[];
  label: string;
  modelValue: string | null;
  rootClass?: string;
}>(), {
  rootClass: 'segment-tabs',
});

defineEmits<{
  select: [id: string | null];
}>();
</script>

<template>
  <nav :class="rootClass" :aria-label="label">
    <button
      v-for="item in items"
      :key="item.id ?? '__all__'"
      type="button"
      :class="{ active: modelValue === item.id, disabled: item.disabled }"
      :disabled="item.disabled"
      @click="$emit('select', item.id)"
    >
      {{ item.label }}
    </button>
  </nav>
</template>

<style scoped>
.provider-tabs,
.lyrics-provider-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  padding: 0;
}

.provider-tabs button {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 999px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-input);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.provider-tabs button.active {
  border-color: transparent;
  color: #fff;
  background: var(--smw-button-primary);
}

.provider-tabs button.disabled,
.provider-tabs button:disabled {
  color: var(--smw-text-secondary);
  cursor: default;
  opacity: 0.68;
}

.lyrics-provider-tabs {
  gap: 22px;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 12px 16px 4px;
  border-bottom: 1px solid var(--smw-border-soft);
  scrollbar-width: thin;
}

.lyrics-provider-tabs button {
  position: relative;
  flex: 0 0 auto;
  min-height: 30px;
  padding: 0;
  border: 0;
  color: var(--smw-text-secondary);
  background: transparent;
  font: inherit;
  font-size: 14px;
  white-space: nowrap;
  cursor: pointer;
}

.lyrics-provider-tabs button.active {
  color: var(--smw-text-primary);
  font-weight: 620;
}

.lyrics-provider-tabs button.active::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 3px;
  border-radius: 999px;
  background: var(--smw-accent-blue, #2f7df6);
  content: "";
}

.lyrics-provider-tabs button:disabled {
  cursor: default;
  opacity: 0.42;
}

.download-tabs {
  display: flex;
  gap: 26px;
  align-items: center;
  min-height: 36px;
  padding: 0 0 14px;
}

.download-tabs button {
  position: relative;
  height: 30px;
  padding: 0 0 4px;
  border: 0;
  color: var(--smw-text-secondary);
  background: transparent;
  font: inherit;
  font-size: 15px;
  cursor: pointer;
}

.download-tabs button.active {
  color: var(--smw-text-primary);
  font-weight: 700;
}

.download-tabs button.active::after {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  border-radius: 999px;
  background: var(--smw-button-primary);
  content: "";
}

.settings-tabs,
.theme-tabs {
  display: flex;
  gap: 30px;
  overflow-x: auto;
}

.settings-tabs button,
.theme-tabs button {
  position: relative;
  padding: 0;
  border: 0;
  color: var(--smw-text-body);
  background: transparent;
  white-space: nowrap;
  cursor: pointer;
}

.settings-tabs button.active,
.theme-tabs button.active {
  color: var(--smw-button-primary);
  font-weight: 680;
}

.settings-tabs button.active::after,
.theme-tabs button.active::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  border-radius: 999px;
  background: var(--smw-button-primary);
  content: "";
}

.settings-tabs button {
  height: 34px;
  font-size: 15px;
}

.theme-tabs {
  border-bottom: 1px solid var(--smw-border-soft);
}

.theme-tabs button {
  height: 38px;
  font-size: 14px;
}

.theme-tabs button.active {
  color: var(--smw-text-primary);
  font-weight: 700;
}
</style>
