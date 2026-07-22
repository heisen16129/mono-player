<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Lock, Pause, Play, SkipBack, SkipForward, Unlock, X } from '@lucide/vue';
import {
  DESKTOP_LYRICS_ACTION_EVENT,
  DESKTOP_LYRICS_POSITION_KEY,
  DESKTOP_LYRICS_READY_EVENT,
  DESKTOP_LYRICS_UPDATE_EVENT,
  type DesktopLyricsAction,
  type DesktopLyricsState,
} from '../services/desktopLyrics';
import { isTauriRuntime, resolveLyricsSource } from '../services/music';
import { writePersistentValue } from '../services/persistentStore';
import type { LyricLine, Track } from '../types/music';
import { parseRawLyrics } from '../utils/lyrics';
import { normalizeTrackLyrics } from '../utils/trackLyrics';

const activeTrack = ref<Track | null>(null);
const currentTime = ref(0);
const isPlaying = ref(false);
const lyricLines = ref<LyricLine[]>([]);
const lyricContent = ref<string | null>(null);
const lyricFormat = ref<string | null>(null);
const isLoading = ref(false);
const isLocked = ref(false);
const lyricColor = ref('#ff2c69');
let unlistenLyricsUpdate: UnlistenFn | null = null;
let unlistenWindowMoved: UnlistenFn | null = null;
let lyricsLoadRequestId = 0;
let savePositionTimer = 0;

const activeLyricIndex = computed(() => {
  let index = -1;
  for (let lineIndex = 0; lineIndex < lyricLines.value.length; lineIndex += 1) {
    const line = lyricLines.value[lineIndex];
    if (line.time !== null && line.time <= currentTime.value) {
      index = lineIndex;
    }
  }

  if (index >= 0) return index;
  return lyricLines.value.length > 0 ? 0 : -1;
});

const currentLyric = computed(() => {
  if (activeLyricIndex.value < 0) {
    if (isLoading.value) return 'Loading lyrics';
    if (activeTrack.value) return activeTrack.value.title;
    return 'Mono Player';
  }

  return lyricLines.value[activeLyricIndex.value]?.text ?? activeTrack.value?.title ?? 'Mono Player';
});

const currentTitle = computed(() => activeTrack.value?.title?.trim() || 'Mono Player');

function normalizeLyricLines(lines: LyricLine[]) {
  return lines.filter((line) => {
    const text = line.text.trim();
    return text && text !== '...';
  });
}

function trackLyricsKey(track: Track | null) {
  const lyrics = normalizeTrackLyrics(track);
  return `${track?.path ?? ''}\n${lyricContent.value ?? ''}\n${lyricFormat.value ?? ''}\n${lyrics?.defaultFormat ?? ''}`;
}

function applyDesktopLyricsState(state: DesktopLyricsState) {
  currentTime.value = state.currentTime;
  isPlaying.value = state.isPlaying;
  lyricColor.value = state.lyricColor || lyricColor.value;
  lyricContent.value = state.lyricContent;
  lyricFormat.value = state.lyricFormat;

  if (trackLyricsKey(activeTrack.value) !== trackLyricsKey(state.track)) {
    activeTrack.value = state.track;
  }
}

watch(
  () => [activeTrack.value?.path, lyricContent.value, lyricFormat.value] as const,
  async ([path, content, format]) => {
    const requestId = (lyricsLoadRequestId += 1);
    lyricLines.value = [];
    if (!path && !content) {
      isLoading.value = false;
      return;
    }

    isLoading.value = true;
    try {
      const lines = isTauriRuntime()
        ? await resolveLyricsSource({ content, format })
        : parseRawLyrics(content ?? '');
      if (requestId !== lyricsLoadRequestId) return;
      lyricLines.value = normalizeLyricLines(lines);
    } finally {
      if (requestId === lyricsLoadRequestId) {
        isLoading.value = false;
      }
    }
  },
  { immediate: true },
);

async function startDrag(event: PointerEvent) {
  if (!isTauriRuntime() || isLocked.value || event.button !== 0) return;
  await getCurrentWindow().startDragging();
}

async function closeWindow() {
  if (!isTauriRuntime()) return;
  await saveCurrentWindowPosition();
  await getCurrentWindow().close();
}

async function saveCurrentWindowPosition() {
  if (!isTauriRuntime()) return;
  const position = await getCurrentWindow().outerPosition();
  await writePersistentValue(DESKTOP_LYRICS_POSITION_KEY, {
    x: position.x,
    y: position.y,
  });
}

function scheduleSaveWindowPosition() {
  if (savePositionTimer) {
    window.clearTimeout(savePositionTimer);
  }
  savePositionTimer = window.setTimeout(() => {
    savePositionTimer = 0;
    void saveCurrentWindowPosition();
  }, 240);
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
  if (savePositionTimer) {
    window.clearTimeout(savePositionTimer);
    savePositionTimer = 0;
  }
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
    @pointerdown="startDrag"
    @dblclick="closeWindow"
  >
    <div class="desktop-lyrics-controls" @pointerdown.stop @dblclick.stop>
      <span class="desktop-lyrics-title">{{ currentTitle }}</span>
      <span class="desktop-lyrics-actions">
        <button type="button" :aria-label="isLocked ? 'Unlock' : 'Lock'" :title="isLocked ? 'Unlock' : 'Lock'" @click="toggleLocked">
          <Lock v-if="isLocked" :size="17" />
          <Unlock v-else :size="17" />
        </button>
        <button v-if="!isLocked" type="button" aria-label="Previous" title="Previous" @click="runAction('previous')">
          <SkipBack :size="17" />
        </button>
        <button v-if="!isLocked" type="button" :aria-label="isPlaying ? 'Pause' : 'Play'" :title="isPlaying ? 'Pause' : 'Play'" @click="runAction('toggle-play')">
          <Pause v-if="isPlaying" :size="18" />
          <Play v-else :size="18" />
        </button>
        <button v-if="!isLocked" type="button" aria-label="Next" title="Next" @click="runAction('next')">
          <SkipForward :size="17" />
        </button>
        <button v-if="!isLocked" type="button" aria-label="Close" title="Close" @click="runAction('close')">
          <X :size="18" />
        </button>
      </span>
      <span class="desktop-lyrics-control-spacer" aria-hidden="true"></span>
    </div>
    <div class="desktop-lyrics-text">
      <strong>{{ currentLyric }}</strong>
    </div>
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

.desktop-lyrics-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  width: min(100%, 760px);
  min-height: 30px;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 140ms ease, transform 140ms ease;
}

.desktop-lyrics-shell:hover .desktop-lyrics-controls {
  opacity: 1;
  transform: translateY(0);
}

.desktop-lyrics-title {
  justify-self: end;
  max-width: min(220px, 100%);
  overflow: hidden;
  padding-right: 28px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 650;
  line-height: 24px;
  text-overflow: ellipsis;
  text-shadow: 0 1px 5px rgba(0, 0, 0, 0.34);
  white-space: nowrap;
}

.desktop-lyrics-actions {
  display: inline-flex;
  grid-column: 2;
  gap: 14px;
  align-items: center;
  justify-content: center;
}

.desktop-lyrics-control-spacer {
  min-width: 0;
}

.desktop-lyrics-controls button {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.96);
  background: rgba(120, 120, 120, 0.32);
  cursor: pointer;
}

.desktop-lyrics-controls button:hover {
  color: #fff;
  background: rgba(90, 90, 90, 0.48);
}

.desktop-lyrics-text {
  display: grid;
  width: min(100%, 900px);
  padding: 0 20px;
  border: 0;
  background: transparent;
  box-shadow: none;
  text-align: center;
}

.desktop-lyrics-text strong {
  overflow: hidden;
  font-size: clamp(18px, 4vh, 24px);
  font-weight: 800;
  line-height: 1.2;
  text-overflow: ellipsis;
  text-shadow:
    0 1px 0 rgba(255, 255, 255, 0.5),
    0 2px 8px rgba(0, 0, 0, 0.26);
  white-space: nowrap;
}

.desktop-lyrics-shell.is-playing .desktop-lyrics-text {
  background: transparent;
}
</style>
