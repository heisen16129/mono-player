<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  DESKTOP_LYRICS_ACTION_EVENT,
  DESKTOP_LYRICS_READY_EVENT,
  DESKTOP_LYRICS_UPDATE_EVENT,
  type DesktopLyricsAction,
  type DesktopLyricsState,
} from '../services/desktopLyrics';
import { useDesktopLyricsCurrentLine } from '../composables/useDesktopLyricsCurrentLine';
import { useDesktopLyricsLoader } from '../composables/useDesktopLyricsLoader';
import { useDesktopLyricsRuntimeState } from '../composables/useDesktopLyricsRuntimeState';
import { useDesktopLyricsWindowPosition } from '../composables/useDesktopLyricsWindowPosition';
import { isTauriRuntime } from '../services/music';
import DesktopLyricsControls from './desktop-lyrics/DesktopLyricsControls.vue';
import DesktopLyricsText from './desktop-lyrics/DesktopLyricsText.vue';

const isLocked = ref(false);
const isShellHovered = ref(false);
let unlistenLyricsUpdate: UnlistenFn | null = null;
let unlistenWindowMoved: UnlistenFn | null = null;

const { activeTrack, applyDesktopLyricsState, currentTime, isPlaying, lyricColor, lyricContent, lyricFormat } = useDesktopLyricsRuntimeState();

const { isLoading, lyricLines, stopLyricsLoading } = useDesktopLyricsLoader({
  activeTrack,
  lyricContent,
  lyricFormat,
});

const { currentLyric, currentTitle } = useDesktopLyricsCurrentLine({
  activeTrack,
  currentTime,
  isLoading,
  lyricLines,
});

const { clearScheduledPositionSave, saveCurrentWindowPosition, scheduleSaveWindowPosition } = useDesktopLyricsWindowPosition();

async function startDrag(event: PointerEvent) {
  if (!isTauriRuntime() || isLocked.value || event.button !== 0) return;
  await getCurrentWindow().startDragging();
}

async function closeWindow() {
  if (!isTauriRuntime()) return;
  await saveCurrentWindowPosition();
  await getCurrentWindow().close();
}

function toggleLocked() {
  isLocked.value = !isLocked.value;
}

async function runAction(action: DesktopLyricsAction) {
  if (action === 'close') {
    await closeWindow();
    return;
  }

  if (!isTauriRuntime()) return;
  await emit(DESKTOP_LYRICS_ACTION_EVENT, action);
}

onMounted(async () => {
  document.body.classList.add('desktop-lyrics-page');
  unlistenLyricsUpdate = await listen<DesktopLyricsState>(DESKTOP_LYRICS_UPDATE_EVENT, (event) => {
    applyDesktopLyricsState(event.payload);
  });
  if (isTauriRuntime()) {
    unlistenWindowMoved = await getCurrentWindow().onMoved(() => {
      scheduleSaveWindowPosition();
    });
    await emit(DESKTOP_LYRICS_READY_EVENT);
  }
});

onBeforeUnmount(() => {
  document.body.classList.remove('desktop-lyrics-page');
  stopLyricsLoading();
  clearScheduledPositionSave();
  unlistenLyricsUpdate?.();
  unlistenLyricsUpdate = null;
  unlistenWindowMoved?.();
  unlistenWindowMoved = null;
  void saveCurrentWindowPosition();
});
</script>

<template>
  <main
    class="desktop-lyrics-shell"
    :class="{ 'is-playing': isPlaying, 'is-locked': isLocked }"
    :style="{ '--desktop-lyric-color': lyricColor }"
    @mouseenter="isShellHovered = true"
    @mouseleave="isShellHovered = false"
    @pointerdown="startDrag"
    @dblclick="closeWindow"
  >
    <DesktopLyricsControls
      :current-title="currentTitle"
      :is-locked="isLocked"
      :is-playing="isPlaying"
      :is-shell-hovered="isShellHovered"
      @close="runAction('close')"
      @next="runAction('next')"
      @previous="runAction('previous')"
      @toggle-locked="toggleLocked"
      @toggle-play="runAction('toggle-play')"
    />
    <DesktopLyricsText :lyric="currentLyric" />
  </main>
</template>

<style scoped>
.desktop-lyrics-shell {
  display: grid;
  grid-template-rows: 34px minmax(0, 1fr);
  width: 100vw;
  height: 100vh;
  align-items: center;
  justify-items: center;
  padding: 8px 28px 12px;
  color: var(--desktop-lyric-color, #ff2c69);
  background: transparent;
  border-radius: 10px;
  transition: background 140ms ease, box-shadow 140ms ease;
  user-select: none;
}

.desktop-lyrics-shell:hover {
  background: rgba(210, 210, 210, 0.46);
  box-shadow:
    inset 0 0 0 1px rgba(160, 160, 160, 0.3),
    0 8px 28px rgba(0, 0, 0, 0.08);
}

</style>
