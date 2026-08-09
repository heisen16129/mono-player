<script setup lang="ts">
import { Pause, Play, Settings, SkipBack, SkipForward, X } from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { invokeApi } from '../services/api';
import { readPersistentValue } from '../services/persistentStore';
import TrayMenuActionButton from './TrayMenuActionButton.vue';
import TrayMenuNowPlayingButton from './TrayMenuNowPlayingButton.vue';
import TrayMenuPlaybackModeSubmenu from './TrayMenuPlaybackModeSubmenu.vue';

const TRAY_STATE_KEY = 'mono-player-tray-state';
const SETTINGS_KEY = 'mono-player-settings';

const fallbackState = {
  title: 'Mono Player',
  artist: '',
  isPlaying: false,
};

async function readJson<T extends Record<string, unknown>>(key: string, fallback: T): Promise<T> {
  const value = await readPersistentValue<Partial<T>>(key);
  if (!value) return fallback;

  return { ...fallback, ...value };
}

const state = ref(fallbackState);

const title = computed(() => state.value.title || 'Mono Player');
const artist = computed(() => state.value.artist || 'Mono Player');
const playLabel = computed(() => (state.value.isPlaying ? '\u6682\u505c' : '\u64ad\u653e'));

async function runAction(action: string) {
  await invokeApi<void>('tray_popup_action', { action });
}

async function refreshTrayState() {
  const [nextState, settings] = await Promise.all([
    readJson(TRAY_STATE_KEY, fallbackState),
    readJson(SETTINGS_KEY, { theme: 'blueWhite' }),
  ]);
  state.value = nextState;
  const theme = String(settings.theme || 'blueWhite');
  document.documentElement.dataset.theme = theme.startsWith('custom:') ? 'custom' : 'blueWhite';
}

onMounted(async () => {
  await refreshTrayState();
  document.body.classList.add('tray-menu-page');
  window.addEventListener('focus', refreshTrayState);
});

onBeforeUnmount(() => {
  window.removeEventListener('focus', refreshTrayState);
  document.body.classList.remove('tray-menu-page');
});
</script>

<template>
  <main class="tray-menu-shell">
    <TrayMenuNowPlayingButton :artist="artist" :title="title" @show="runAction('show')" />

    <div class="tray-menu-section">
      <TrayMenuActionButton :label="playLabel" @action="runAction('toggle-play')">
        <template #icon>
          <Play v-if="!state.isPlaying" :size="15" fill="currentColor" />
          <Pause v-else :size="15" fill="currentColor" />
        </template>
      </TrayMenuActionButton>
      <TrayMenuActionButton label="上一首" @action="runAction('previous')">
        <template #icon><SkipBack :size="15" fill="currentColor" /></template>
      </TrayMenuActionButton>
      <TrayMenuActionButton label="下一首" @action="runAction('next')">
        <template #icon><SkipForward :size="15" fill="currentColor" /></template>
      </TrayMenuActionButton>
      <TrayMenuPlaybackModeSubmenu @action="runAction($event)" />
    </div>

    <div class="tray-menu-section">
      <TrayMenuActionButton label="设置" @action="runAction('settings')">
        <template #icon><Settings :size="15" /></template>
      </TrayMenuActionButton>
      <TrayMenuActionButton label="退出" @action="runAction('exit')">
        <template #icon><X :size="15" /></template>
      </TrayMenuActionButton>
    </div>
  </main>
</template>

<style scoped>
.tray-menu-shell {
  display: grid;
  grid-template-rows: auto auto auto;
  gap: 7px;
  width: 100vw;
  height: 100vh;
  padding: 8px;
  border: 1px solid var(--smw-border);
  border-radius: 10px;
  color: var(--smw-text-body);
  background: color-mix(in srgb, var(--smw-bg-workspace) 96%, transparent);
  box-shadow: 0 14px 34px rgb(0 0 0 / 18%);
  font-family: var(--smw-font-sans);
  box-sizing: border-box;
}

.tray-menu-section {
  display: grid;
  gap: 2px;
  padding-top: 7px;
  border-top: 1px solid var(--smw-border-soft);
}
</style>
