<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  x: number;
  y: number;
  minWidth?: string;
  zIndex?: number;
}>(), {
  minWidth: '238px',
  zIndex: 320,
});

const menuRef = ref<HTMLElement | null>(null);
const menuPosition = ref({ left: props.x, top: props.y });

function updateMenuPosition() {
  const element = menuRef.value;
  if (!element) return;

  const margin = 10;
  const rect = element.getBoundingClientRect();
  const maxLeft = window.innerWidth - rect.width - margin;
  const maxTop = window.innerHeight - rect.height - margin;
  const shouldOpenAbove = props.y + rect.height + margin > window.innerHeight;

  menuPosition.value = {
    left: Math.max(margin, Math.min(props.x, maxLeft)),
    top: shouldOpenAbove
      ? Math.max(margin, props.y - rect.height)
      : Math.max(margin, Math.min(props.y, maxTop)),
  };
}

async function scheduleMenuPositionUpdate() {
  await nextTick();
  updateMenuPosition();
}

watch(() => [props.x, props.y], scheduleMenuPositionUpdate);

onMounted(() => {
  void scheduleMenuPositionUpdate();
  window.addEventListener('resize', updateMenuPosition);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateMenuPosition);
});
</script>

<template>
  <div
    ref="menuRef"
    class="base-context-menu"
    :style="{ left: `${menuPosition.left}px`, top: `${menuPosition.top}px`, '--base-context-menu-min-width': minWidth, '--base-context-menu-z-index': zIndex }"
    role="menu"
    @click.stop
    @contextmenu.prevent.stop
  >
    <slot />
  </div>
</template>

<style scoped>
.base-context-menu {
  position: fixed;
  z-index: var(--base-context-menu-z-index);
  display: grid;
  min-width: var(--base-context-menu-min-width);
  max-width: min(310px, calc(100vw - 24px));
  max-height: calc(100vh - 20px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  background: color-mix(in srgb, var(--smw-bg-workspace) 96%, transparent);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(12px);
}

.base-context-menu :deep(button) {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 0 10px;
  border: 0;
  border-radius: 7px;
  color: var(--smw-text-body);
  background: transparent;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.base-context-menu :deep(button:hover:not(:disabled)) {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
}

.base-context-menu :deep(svg) {
  color: var(--smw-icon-muted);
}

.base-context-menu :deep(button:disabled) {
  cursor: default;
  opacity: 0.48;
}

.base-context-menu :deep(.context-menu-meta) {
  display: grid;
  gap: 2px;
  padding: 4px 0 6px;
  border-bottom: 1px solid var(--smw-border-soft);
}

.base-context-menu :deep(.context-menu-meta > div) {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 0 10px;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.base-context-menu :deep(.context-menu-meta span) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.base-context-menu :deep(.context-menu-actions) {
  display: grid;
  gap: 2px;
  padding-top: 6px;
}
</style>
