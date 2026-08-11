<script setup lang="ts">
import { X } from '@lucide/vue';
import { onBeforeUnmount, ref } from 'vue';
import type { BaseDialogEmits, BaseDialogProps } from '../types/baseDialog';
import { shouldSkipWindowDrag } from '../utils/windowDrag';

withDefaults(defineProps<BaseDialogProps>(), {
  closeDisabled: false,
  closeOnOverlay: false,
  gridTemplateRows: 'none',
  headerPadding: '16px 18px 14px',
  maxHeight: 'none',
  overlayBackground: 'transparent',
  overlayBackdropFilter: 'none',
  overflow: 'visible',
  panelClass: '',
  title: '',
  width: 'min(490px, calc(100vw - 32px))',
  zIndex: 120,
});

defineEmits<BaseDialogEmits>();

const dragOffset = ref({ x: 0, y: 0 });
let dragStart: { pointerId: number; startX: number; startY: number; originX: number; originY: number } | null = null;

function startDialogDrag(event: PointerEvent) {
  if (event.button !== 0 || shouldSkipWindowDrag(event.target)) return;

  dragStart = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: dragOffset.value.x,
    originY: dragOffset.value.y,
  };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function moveDialog(event: PointerEvent) {
  if (!dragStart || event.pointerId !== dragStart.pointerId) return;
  dragOffset.value = {
    x: dragStart.originX + event.clientX - dragStart.startX,
    y: dragStart.originY + event.clientY - dragStart.startY,
  };
}

function stopDialogDrag(event: PointerEvent) {
  if (!dragStart || event.pointerId !== dragStart.pointerId) return;
  if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }
  dragStart = null;
}

onBeforeUnmount(() => {
  dragStart = null;
});

function handleOverlayWheel(event: WheelEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function handleDialogWheel(event: WheelEvent) {
  event.stopPropagation();
  const scrollTarget = findScrollableTarget(event.target as Element | null, event.currentTarget as Element);
  if (!scrollTarget || !canScrollWheelTarget(scrollTarget, event.deltaY)) {
    event.preventDefault();
  }
}

function findScrollableTarget(target: Element | null, boundary: Element): HTMLElement | null {
  let element = target;
  while (element && element !== boundary) {
    if (element instanceof HTMLElement) {
      const style = window.getComputedStyle(element);
      const canScrollY = ['auto', 'scroll'].includes(style.overflowY) && element.scrollHeight > element.clientHeight;
      if (canScrollY) return element;
    }
    element = element.parentElement;
  }
  return null;
}

function canScrollWheelTarget(target: HTMLElement, deltaY: number) {
  if (deltaY < 0) return target.scrollTop > 0;
  if (deltaY > 0) return target.scrollTop + target.clientHeight < target.scrollHeight;
  return true;
}
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
    @wheel="handleOverlayWheel"
  >
    <section
      class="base-dialog"
      :class="panelClass"
      :style="{
        '--base-dialog-grid-template-rows': gridTemplateRows,
        '--base-dialog-header-padding': headerPadding,
        '--base-dialog-max-height': maxHeight,
        '--base-dialog-overflow': overflow,
        '--base-dialog-translate-x': `${dragOffset.x}px`,
        '--base-dialog-translate-y': `${dragOffset.y}px`,
        '--base-dialog-width': width,
      }"
      role="dialog"
      aria-modal="true"
      :aria-label="label"
      @click.stop
      @wheel="handleDialogWheel"
    >
      <header
        class="base-dialog-head"
        @pointerdown="startDialogDrag"
        @pointermove="moveDialog"
        @pointerup="stopDialogDrag"
        @pointercancel="stopDialogDrag"
      >
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
  overscroll-behavior: contain;
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
  box-shadow: 0 18px 46px rgba(15, 23, 42, 0.14);
  overscroll-behavior: contain;
  transform: translate(var(--base-dialog-translate-x, 0), var(--base-dialog-translate-y, 0));
}

.base-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 64px;
  padding: var(--base-dialog-header-padding, 16px 18px 14px);
  border-bottom: 1px solid var(--smw-border-soft);
  cursor: move;
  user-select: none;
}

.base-dialog-head h2 {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 17px;
  font-weight: 650;
}

.base-dialog-head .icon-button {
  width: 30px;
  height: 30px;
  margin-right: -4px;
  border-radius: 7px;
  color: var(--smw-text-secondary);
  cursor: pointer;
}

.base-dialog-head .icon-button:hover:not(:disabled),
.base-dialog-head .icon-button:focus-visible {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
  outline: none;
}
</style>
