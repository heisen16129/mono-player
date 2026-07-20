<script setup lang="ts">
import { ChevronRight, Pause, Play, Settings, SkipBack, SkipForward, X } from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { invokeApi } from '../services/api';
import { readPersistentValue } from '../services/persistentStore';

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
  document.documentElement.dataset.theme = String(settings.theme || 'blueWhite');
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
    <button class="tray-menu-now" type="button" @click="runAction('show')">
      <strong>{{ title }}</strong>
      <span>{{ artist }}</span>
    </button>

    <div class="tray-menu-section">
      <button type="button" @click="runAction('toggle-play')">
        <Play v-if="!state.isPlaying" :size="15" fill="currentColor" />
        <Pause v-else :size="15" fill="currentColor" />
        <span>{{ playLabel }}</span>
      </button>
      <button type="button" @click="runAction('previous')">
        <SkipBack :size="15" fill="currentColor" />
        <span>&#x4e0a;&#x4e00;&#x9996;</span>
      </button>
      <button type="button" @click="runAction('next')">
        <SkipForward :size="15" fill="currentColor" />
        <span>&#x4e0b;&#x4e00;&#x9996;</span>
      </button>
      <div class="tray-menu-mode">
        <button type="button">
          <span>&#x64ad;&#x653e;&#x6a21;&#x5f0f;</span>
          <ChevronRight :size="15" />
        </button>
        <div class="tray-menu-submenu">
          <button type="button" @click="runAction('mode-shuffle')">&#x968f;&#x673a;&#x64ad;&#x653e;</button>
          <button type="button" @click="runAction('mode-repeat')">&#x5faa;&#x73af;&#x64ad;&#x653e;</button>
          <button type="button" @click="runAction('mode-fixed')">&#x56fa;&#x5b9a;&#x64ad;&#x653e;</button>
        </div>
      </div>
    </div>

    <div class="tray-menu-section">
      <button type="button" @click="runAction('settings')">
        <Settings :size="15" />
        <span>&#x8bbe;&#x7f6e;</span>
      </button>
      <button type="button" @click="runAction('exit')">
        <X :size="15" />
        <span>&#x9000;&#x51fa;</span>
      </button>
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

.tray-menu-now,
.tray-menu-section button {
  width: 100%;
  border: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}

.tray-menu-now {
  display: grid;
  gap: 4px;
  padding: 9px 10px;
  border-radius: 7px;
  background: var(--smw-bg-selected);
}

.tray-menu-now strong,
.tray-menu-now span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tray-menu-now strong {
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 700;
}

.tray-menu-now span {
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.tray-menu-section {
  display: grid;
  gap: 2px;
  padding-top: 7px;
  border-top: 1px solid var(--smw-border-soft);
}

.tray-menu-section button,
.tray-menu-mode > button,
.tray-menu-submenu button {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  color: var(--smw-text-body);
  font-size: 13px;
  line-height: 1;
}

.tray-menu-section button:hover,
.tray-menu-mode:hover > button,
.tray-menu-submenu button:hover {
  background: var(--smw-bg-hover);
}

.tray-menu-mode {
  position: relative;
}

.tray-menu-mode > button {
  justify-content: space-between;
}

.tray-menu-submenu {
  position: absolute;
  right: calc(100% + 6px);
  bottom: 0;
  display: none;
  width: 116px;
  padding: 6px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--smw-bg-workspace) 97%, transparent);
  box-shadow: 0 12px 30px rgb(0 0 0 / 16%);
}

.tray-menu-mode:hover .tray-menu-submenu {
  display: grid;
}

.tray-menu-submenu button {
  justify-content: flex-start;
  padding: 0 9px;
  white-space: nowrap;
}
</style>
