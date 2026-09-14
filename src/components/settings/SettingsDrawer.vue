<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { t } from '../../i18n';
import { usePlayerStore } from '../../stores/player';
import SettingsView from '../SettingsView.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const player = usePlayerStore();
const locale = computed(() => player.settings.locale);
const panel = ref<HTMLElement | null>(null);
let previousFocus: HTMLElement | null = null;

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  // Let nested dialogs handle Escape first.
  if (document.querySelector('.base-dialog-overlay')) return;
  event.preventDefault();
  emit('close');
}

watch(() => props.open, async (open) => {
  if (open) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    await nextTick();
    if (!props.open) return;
    panel.value?.focus({ preventScroll: true });
    window.addEventListener('keydown', handleKeydown);
  } else {
    window.removeEventListener('keydown', handleKeydown);
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
}, { immediate: true });

onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown));
</script>

<template>
  <Transition name="settings-drawer">
    <div v-if="open" class="settings-drawer-layer" @pointerdown.stop.self="emit('close')" @wheel.self.prevent>
      <section ref="panel" class="settings-drawer-panel" role="dialog" :aria-label="t(locale, 'preferences')" tabindex="-1">
        <SettingsView @close="emit('close')" />
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.settings-drawer-layer {
  --settings-glass-fill: color-mix(in srgb, var(--smw-bg-workspace) 60%, transparent);
  --settings-glass-card: color-mix(in srgb, var(--smw-bg-panel) 8%, transparent);
  --settings-glass-input: color-mix(in srgb, var(--smw-bg-input) 12%, transparent);
  --settings-glass-selected: color-mix(in srgb, var(--smw-bg-selected) 30%, transparent);
  --settings-glass-hover: color-mix(in srgb, var(--smw-bg-hover) 20%, transparent);
  --settings-solid-fill: var(--smw-bg-workspace);
  --settings-text-secondary: color-mix(in srgb, var(--smw-text-primary) 92%, var(--smw-bg-workspace));
  --settings-text-muted: color-mix(in srgb, var(--smw-text-primary) 90%, var(--smw-bg-workspace));
  --smw-border: color-mix(in srgb, var(--smw-text-body) 12%, transparent);
  --smw-border-soft: color-mix(in srgb, var(--smw-text-body) 7%, transparent);
  position: fixed;
  inset: 44px 0 calc(var(--player-height) + 12px);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
  padding: 8px 18px 0;
}

.settings-drawer-panel {
  --smw-text-secondary: var(--settings-text-secondary);
  --smw-text-muted: var(--settings-text-muted);
  --smw-icon-muted: var(--settings-text-muted);
  --smw-bg-canvas: var(--settings-glass-card);
  --smw-bg-page: var(--settings-glass-card);
  --smw-bg-elevated: var(--settings-glass-input);
  --smw-bg-workspace: var(--settings-glass-card);
  --smw-bg-panel: var(--settings-glass-card);
  --smw-bg-input: var(--settings-glass-input);
  --smw-bg-selected: var(--settings-glass-selected);
  --smw-bg-hover: var(--settings-glass-hover);
  width: min(420px, 100%);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--smw-border);
  border-radius: 18px;
  background: var(--settings-glass-fill);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  box-shadow: 0 16px 48px rgb(0 0 0 / 12%), 0 2px 8px rgb(0 0 0 / 4%);
  outline: none;
  color: var(--smw-text-body);
}

.settings-drawer-panel :deep(.settings-view) {
  background: transparent;
}

.settings-drawer-panel :deep(.device-menu) {
  background: var(--settings-solid-fill);
}

.settings-drawer-panel :deep(select option) {
  color: var(--smw-text-primary);
  background: var(--settings-solid-fill);
}

@media (prefers-reduced-transparency: reduce) {
  .settings-drawer-panel {
    background: var(--settings-solid-fill);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

.settings-drawer-enter-active,
.settings-drawer-leave-active {
  transition: opacity 180ms ease;
}

.settings-drawer-enter-active .settings-drawer-panel,
.settings-drawer-leave-active .settings-drawer-panel {
  transition: transform 260ms cubic-bezier(.22, 1, .36, 1);
}

.settings-drawer-enter-from,
.settings-drawer-leave-to {
  opacity: 0;
}

.settings-drawer-enter-from .settings-drawer-panel,
.settings-drawer-leave-to .settings-drawer-panel {
  transform: translateX(36px);
}

@media (max-width: 600px) {
  .settings-drawer-layer {
    padding: 4px 8px 0;
  }

  .settings-drawer-panel {
    width: 100%;
    border-radius: 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .settings-drawer-enter-active,
  .settings-drawer-leave-active,
  .settings-drawer-enter-active .settings-drawer-panel,
  .settings-drawer-leave-active .settings-drawer-panel {
    transition: none;
  }
}
</style>
