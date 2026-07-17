<script setup lang="ts">
import { Maximize2, Minimize2, Minus, X } from '@lucide/vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { onMounted, ref } from 'vue';
import { t } from '../i18n';
import { isTauriRuntime } from '../services/music';
import { usePlayerStore } from '../stores/player';

const emit = defineEmits<{
  requestClose: [];
}>();

const player = usePlayerStore();
const isMaximized = ref(false);

async function updateMaximizedState() {
  if (!isTauriRuntime()) return;
  isMaximized.value = await getCurrentWindow().isMaximized();
}

async function minimizeWindow() {
  if (!isTauriRuntime()) return;
  await getCurrentWindow().minimize();
}

async function toggleMaximizeWindow() {
  if (!isTauriRuntime()) return;
  const window = getCurrentWindow();
  await window.toggleMaximize();
  isMaximized.value = await window.isMaximized();
}

async function closeWindow() {
  if (!isTauriRuntime()) return;
  emit('requestClose');
}

onMounted(() => {
  void updateMaximizedState();
});
</script>

<template>
  <div class="window-controls">
    <button class="window-control" type="button" aria-label="最小化" title="最小化" @click.stop="minimizeWindow">
      <Minus :size="18" />
    </button>
    <button
      class="window-control"
      type="button"
      :aria-label="isMaximized ? '还原' : '最大化'"
      :title="isMaximized ? '还原' : '最大化'"
      @click.stop="toggleMaximizeWindow"
    >
      <Minimize2 v-if="isMaximized" class="window-control-maximize-icon" :size="14" />
      <Maximize2 v-else class="window-control-maximize-icon" :size="14" />
    </button>
    <button class="window-control close" type="button" :aria-label="t(player.settings.locale, 'close')" :title="t(player.settings.locale, 'close')" @click.stop="closeWindow">
      <X :size="18" />
    </button>
  </div>
</template>
