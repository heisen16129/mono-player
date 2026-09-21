import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { hasKaraokeAccompaniment } from '../services/karaoke';
import type { Track } from '../types/music';

export function useKaraokeAvailability(track: Ref<Track | null>, pluginId: Ref<string>) {
  const available = ref(false);
  let generation = 0;
  watch(() => [pluginId.value, track.value?.path, track.value?.sourceProviderId, track.value?.sourceId], async () => {
    const current = ++generation;
    available.value = false;
    const selected = track.value;
    if (!pluginId.value || !selected?.path) return;
    try {
      const result = await hasKaraokeAccompaniment(selected.path, selected.sourceProviderId, selected.sourceId);
      if (current === generation) available.value = result;
    } catch { if (current === generation) available.value = false; }
  }, { immediate: true });
  onBeforeUnmount(() => { generation++; });
  return available;
}
