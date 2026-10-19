<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { songCoverUrl } from '../covers';
import SlIcon from '../ui/SlIcon.vue';
import { get, query, messageOf } from '../api';
import { playerCommand, state } from '../store';
import type { Song } from '../types';
import SlButton from '../ui/SlButton.vue';
const emit = defineEmits<{ close: [] }>();
const songs = ref<Song[]>([]);
const playlistId = ref(0);
const loading = ref(true);
const error = ref('');
const scrolling = ref(false);
const failedCovers = ref(new Set<number>());
let scrollTimer: ReturnType<typeof setTimeout>;
function onScroll() {
  scrolling.value = true;
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => { scrolling.value = false; }, 800);
}
onUnmounted(() => clearTimeout(scrollTimer));
async function load() {
  loading.value = true; error.value = '';
  try {
    const result = await get<{ songs: Song[]; playlist_id: number }>(`/player/queue${query({ account_id: state.currentAccountId, device_id: state.currentDeviceId })}`);
    songs.value = result.songs; playlistId.value = result.playlist_id;
  } catch (cause) { error.value = messageOf(cause); }
  finally { loading.value = false; }
}
async function play(song: Song, index: number) {
  try {
    await playerCommand('/player/play', { playlist_id: playlistId.value, song_id: song.id, start_index: index, play_mode: state.player.play_mode || 'order' });
  } catch { /* playerCommand displays failures. */ }
}
onMounted(load);
</script>
<template>
  <div class="dialog-overlay" @click.self="emit('close')" @keydown.esc="emit('close')">
    <section class="dialog queue-dialog" role="dialog" aria-modal="true" aria-label="播放列表">
      <header><h2 class="dialog-title">播放列表 <small>{{ songs.length }} 首</small></h2><SlButton variant="icon" icon="close" title="关闭播放列表" @click="emit('close')" /></header>
      <div v-if="loading" class="empty-state">正在加载…</div>
      <div v-else-if="error" class="empty-state">{{ error }}<SlButton label="重试" @click="load" /></div>
      <div v-else-if="!songs.length" class="empty-state">暂无播放列表</div>
      <div v-else class="queue-list" :class="{ scrolling }" @scroll.passive="onScroll">
        <button v-for="(song, index) in songs" :key="`${song.id}-${index}`" type="button" :class="{ current: song.id === state.player.current_song?.id }" :disabled="state.playerBusy" @click="play(song, index)">
          <span>{{ index + 1 }}</span>
          <span class="queue-cover">
            <img v-if="song.cover_url && !failedCovers.has(song.id)" :src="songCoverUrl(song, 96)" alt="" loading="lazy" @error="failedCovers.add(song.id)" />
            <SlIcon v-else name="music_note" player-icon :size="24" />
          </span>
          <span class="song-copy"><strong>{{ song.title }}</strong><small>{{ song.artist }}</small></span>
        </button>
      </div>
    </section>
  </div>
</template>
<style scoped>
.queue-dialog{width:560px;max-width:100%;padding:20px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px}h2{margin:0}small{font-size:12px;font-weight:400;color:var(--md-on-surface-variant)}
.queue-list{max-height:55vh;overflow:auto;margin-top:12px;scrollbar-width:thin;scrollbar-color:transparent transparent}
.queue-list.scrolling{scrollbar-color:var(--md-outline) transparent}
.queue-list::-webkit-scrollbar{width:6px}
.queue-list::-webkit-scrollbar-track{background:transparent}
.queue-list::-webkit-scrollbar-thumb{background:transparent;border-radius:4px}
.queue-list.scrolling::-webkit-scrollbar-thumb{background:var(--md-outline)}
.queue-list::-webkit-scrollbar-button{display:none}
.queue-cover{width:40px;height:40px;flex:0 0 40px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:5px;background:var(--md-surface-container-high);color:var(--md-on-surface-variant)}
.queue-cover img{width:100%;height:100%;object-fit:cover}
.queue-list button{display:flex;align-items:center;gap:16px;width:100%;padding:12px;border:0;border-radius:6px;background:transparent;color:var(--md-on-surface);text-align:left;cursor:pointer;font:inherit}
.queue-list button:hover{background:var(--md-surface-container-high)}.queue-list button.current{background:var(--md-primary-container);color:var(--md-primary)}
.song-copy{display:grid;gap:4px;min-width:0}.song-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}
</style>
