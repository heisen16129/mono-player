<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import LyricsSearchDialog from './lyrics/LyricsSearchDialog.vue';
import { listPluginLyricSearchProviders, searchPluginCoverCandidates } from '../services/pluginSearch';
import { artworkUrlDataUrl, artworkBlobDataUrl } from '../utils/artwork';
import { isTauriRuntime } from '../services/music';
import { invokeApi } from '../services/api';
import type { PluginSearchProvider, PluginSearchTrack } from '../types/plugin';
const props = defineProps<{ initialQuery: string }>();
const emit = defineEmits<{ close: []; select: [image: string] }>();
const query = ref(props.initialQuery), providerId = ref<string | null>(null);
const providers = ref<PluginSearchProvider[]>([]), results = ref<PluginSearchTrack[]>([]);
const busy = ref(false), status = ref(''), resolving = ref<string | null>(null);
const tabs = computed(() => providers.value.map(p => ({ id: p.id, label: p.name })));
const key = (track: PluginSearchTrack) => `${track.providerId}:${track.id}`;
let generation = 0;
onBeforeUnmount(() => { generation++; });
async function search() {
  const request = ++generation;
  busy.value = true; status.value = ''; results.value = [];
  try {
    const page = await searchPluginCoverCandidates(query.value, providerId.value);
    if (request !== generation) return;
    results.value = page.tracks.filter(track => track.artwork);
    if (!results.value.length) status.value = '没有找到封面，请更换关键词或来源';
  } catch (error) { if (request === generation) status.value = String(error); }
  finally { if (request === generation) busy.value = false; }
}
async function select(track: PluginSearchTrack) {
  if (!track.artwork || resolving.value) return;
  resolving.value = key(track);
  const request = generation;
  try {
    let image: string;
    if (isTauriRuntime() && /^https?:\/\//i.test(track.artwork)) {
      const cover = await invokeApi<{ data: number[]; mime_type: string }>('read_remote_cover', { url: track.artwork });
      image = await artworkBlobDataUrl(new Blob([new Uint8Array(cover.data)], { type: cover.mime_type }));
    } else image = await artworkUrlDataUrl(track.artwork);
    if (!image) throw new Error('封面加载失败');
    if (request === generation) emit('select', image);
  } catch (error) { status.value = String(error); }
  finally { resolving.value = null; }
}
onMounted(async () => {
  try {
    providers.value = (await listPluginLyricSearchProviders()).filter(p => p.enabled);
    providerId.value = providers.value[0]?.id || null;
    if (query.value.trim()) await search();
  } catch (error) { status.value = String(error); }
});
</script>
<template>
  <LyricsSearchDialog label="搜索封面" :z-index="400" :query="query" :provider-id="providerId" :providers="providers" :tab-items="tabs" :results="results" :status="status" :is-searching="busy" :is-loading-more="false" :resolving-track-key="resolving" :track-key="key" @update:query="query = $event" @search="search" @select-provider="providerId = $event; search()" @apply="select" @close="emit('close')" />
</template>
