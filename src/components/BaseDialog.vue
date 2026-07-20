<script setup lang="ts">
import { X } from '@lucide/vue';

withDefaults(defineProps<{
  closeLabel: string;
  closeDisabled?: boolean;
  closeOnOverlay?: boolean;
  gridTemplateRows?: string;
  label: string;
  maxHeight?: string;
  overlayBackground?: string;
  overlayBackdropFilter?: string;
  overflow?: string;
  panelClass?: string;
  title?: string;
  width?: string;
  zIndex?: number;
}>(), {
  closeDisabled: false,
  closeOnOverlay: false,
  gridTemplateRows: 'none',
  maxHeight: 'none',
  overlayBackground: 'transparent',
  overlayBackdropFilter: 'none',
  overflow: 'visible',
  panelClass: '',
  title: '',
  width: 'min(490px, calc(100vw - 32px))',
  zIndex: 120,
});

defineEmits<{
  close: [];
}>();
</script>

<template>
  <div
    class="base-dialog-overlay"
    role="presentation"
    :style="{
      '--base-dialog-backdrop-filter': overlayBackdropFilter,
      '--base-dialog-overlay-background': overlayBackground,
      '--base-dialog-z-index': zIndex,
    }"
    @click="closeOnOverlay && $emit('close')"
  >
    <section
      class="base-dialog"
      :class="panelClass"
      :style="{
        '--base-dialog-grid-template-rows': gridTemplateRows,
        '--base-dialog-max-height': maxHeight,
        '--base-dialog-overflow': overflow,
        '--base-dialog-width': width,
      }"
      role="dialog"
      aria-modal="true"
      :aria-label="label"
      @click.stop
    >
      <header class="base-dialog-head">
        <slot name="header">
          <h2>{{ title }}</h2>
        </slot>
        <button class="icon-button" type="button" :aria-label="closeLabel" :disabled="closeDisabled" @click="$emit('close')">
          <X :size="18" />
        </button>
      </header>

      <slot />
    </section>
  </div>
</template>

<style scoped>
.base-dialog-overlay {
  position: fixed;
  inset: 0 0 var(--player-height) 0;
  z-index: var(--base-dialog-z-index, 120);
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--base-dialog-overlay-background);
  backdrop-filter: var(--base-dialog-backdrop-filter);
}

.base-dialog {
  display: grid;
  grid-template-rows: var(--base-dialog-grid-template-rows, none);
  width: var(--base-dialog-width, min(490px, calc(100vw - 32px)));
  max-height: var(--base-dialog-max-height, none);
  overflow: var(--base-dialog-overflow, visible);
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  background: var(--smw-bg-workspace);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.18);
}

.base-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 12px 12px;
  border-bottom: 1px solid var(--smw-border-soft);
}

.base-dialog-head h2 {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 17px;
  font-weight: 560;
}
</style>
