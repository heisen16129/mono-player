<script setup lang="ts">
import { ref } from 'vue';
import PlaybackOptionMenuItem from './PlaybackOptionMenuItem.vue';

export interface PlaybackOptionMenuItem {
  disabled?: boolean;
  id: string;
  label: string;
  title?: string;
}

defineProps<{
  activeValue: string | null;
  buttonLabel: string;
  items: PlaybackOptionMenuItem[];
  menuLabel: string;
  triggerLabel: string;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

const control = ref<HTMLElement | null>(null);

function closeControlPopover() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && control.value?.contains(activeElement)) {
    activeElement.blur();
  }
}
</script>

<template>
  <div ref="control" class="quality-control" @mouseleave="closeControlPopover">
    <div class="quality-popover" role="menu" :aria-label="menuLabel">
      <PlaybackOptionMenuItem
        v-for="item in items"
        :key="item.id"
        :active="activeValue === item.id"
        :item="item"
        @select="emit('select', $event)"
      />
    </div>
    <button class="quality-button" type="button" :aria-label="triggerLabel" :title="triggerLabel">
      <span>{{ buttonLabel }}</span>
    </button>
  </div>
</template>

<style scoped>
.quality-control {
  position: relative;
  display: grid;
  place-items: center;
}

.quality-control:hover,
.quality-control:focus-within {
  z-index: 44;
}

.quality-control::before {
  position: absolute;
  left: 50%;
  bottom: 20px;
  width: 92px;
  height: 26px;
  content: "";
  transform: translateX(-50%);
}

.quality-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-button-primary-text, #fff);
  background: var(--smw-button-primary);
  box-shadow: 0 6px 14px color-mix(in srgb, var(--smw-button-primary) 22%, transparent);
  font: inherit;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}

.quality-button:hover,
.quality-button:focus-visible {
  outline: none;
  box-shadow: 0 8px 18px color-mix(in srgb, var(--smw-button-primary) 28%, transparent);
}

.quality-popover {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 12px);
  z-index: 20;
  display: grid;
  min-width: 86px;
  padding: 6px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 10px;
  color: var(--smw-text-body);
  background: var(--smw-player-bg);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.16);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 4px);
  transition: opacity 120ms ease, transform 120ms ease;
}

.quality-control:hover .quality-popover,
.quality-control:focus-within .quality-popover {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 0);
}

</style>
