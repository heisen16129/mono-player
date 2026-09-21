<script setup lang="ts">
import { computed } from 'vue';
import type { Track } from '../../types/music';
import { useKaraokePlayback } from '../../composables/useKaraokePlayback';
import { useKaraokeAvailability } from '../../composables/useKaraokeAvailability';
import PlaybackOptionMenu from './PlaybackOptionMenu.vue';
import KaraokeVocalsControl from './KaraokeVocalsControl.vue';

const props = defineProps<{ track: Track | null }>();
const { label, message, mode, pluginId, preparing, switching, select } = useKaraokePlayback(computed(() => props.track?.path), computed(() => props.track));
const hasAccompaniment = useKaraokeAvailability(computed(() => props.track), pluginId);
const items = computed(() => [
  { id: 'original', label: '原声', disabled: switching.value },
  { id: 'karaoke', label: 'K歌', disabled: !props.track || preparing.value || switching.value, title: '使用已分离的伴奏' },
]);
</script>

<template>
  <div v-if="pluginId && hasAccompaniment" class="karaoke-control">
    <PlaybackOptionMenu :active-value="preparing ? 'karaoke' : mode" :button-label="label" :items="items" menu-label="K歌模式" :trigger-label="`播放模式：${label}`" @select="select" />
    <KaraokeVocalsControl v-if="mode === 'karaoke' && track" :key="track.path" :track="track" />
    <div v-if="message" class="karaoke-message" role="status">
      <span>{{ message }}</span>
      <button v-if="!preparing" type="button" aria-label="关闭提示" @click="message = ''">×</button>
    </div>
  </div>
</template>

<style scoped>
.karaoke-control { position: relative; display: flex; align-items: center; gap: 8px; }
.karaoke-message { position: absolute; bottom: calc(100% + 14px); right: 0; display: flex; align-items: start; gap: 8px; width: 240px; padding: 12px; border: 1px solid var(--smw-border); border-radius: 8px; background: var(--smw-bg-panel); color: var(--smw-text-body); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; box-shadow: 0 6px 20px #0002; z-index: 45; pointer-events: none; }
button { pointer-events: auto; background: none; border: 0; color: inherit; cursor: pointer; }
</style>
