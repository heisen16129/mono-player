<script setup lang="ts">
import { ref } from 'vue';
import type { Track } from '../../types/music';
import { resolveKaraokePlaybackSource, setKaraokeVocals } from '../../services/karaoke';
import { getErrorMessage } from '../../utils/error';

const props = defineProps<{ track: Track }>();
const volume = ref(0);
const busy = ref(false);
const error = ref('');
async function change(event: Event) {
  const next = Number((event.target as HTMLInputElement).value);
  busy.value = true;
  error.value = '';
  try {
    const source = await resolveKaraokePlaybackSource(props.track.path, props.track.sourceProviderId, props.track.sourceId);
    if (!source) throw new Error('歌曲尚未加载');
    await setKaraokeVocals(source, next / 100);
    volume.value = next;
  } catch (cause) { error.value = getErrorMessage(cause); }
  finally { busy.value = false; }
}
</script>

<template>
  <details class="vocals-control">
    <summary>人声 {{ volume }}%</summary>
    <div class="vocals-panel">
      <label>人声音量 {{ volume }}%
        <input type="range" min="0" max="100" step="1" :value="volume" :disabled="busy" @change="change" />
      </label>
      <small>0% 为纯伴奏，100% 为完整人声</small>
      <span v-if="error" role="alert">{{ error }}</span>
    </div>
  </details>
</template>

<style scoped>
.vocals-control { position: relative; font-size: 12px; }
summary { cursor: pointer; white-space: nowrap; color: var(--smw-text-body); }
.vocals-panel { position: absolute; bottom: calc(100% + 14px); right: 0; width: 220px; padding: 14px; display: grid; gap: 10px; background: var(--smw-bg-panel); border: 1px solid var(--smw-border); border-radius: 8px; box-shadow: 0 6px 20px #0002; z-index: 45; }
label { display: grid; gap: 8px; }
input { width: 100%; }
small { color: var(--smw-text-secondary); }
</style>
