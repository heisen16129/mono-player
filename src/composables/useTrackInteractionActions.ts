import type { Ref } from 'vue';
import type { Track } from '../types/music';
import type { PluginSearchTrack } from '../types/plugin';
import { createOnlineQueueTrack } from '../utils/onlineTrack';

interface UseTrackInteractionActionsOptions {
  selectedTrack: Ref<Track | null>;
  closeContextMenus: () => void;
  findPluginTrackForQueueTrack: (track: Track) => PluginSearchTrack | null;
  openTrackContextMenu: (track: Track, x: number, y: number) => void;
  queueTrackNext: (track: Track) => Promise<void> | void;
}

export function useTrackInteractionActions({
  selectedTrack,
  closeContextMenus,
  findPluginTrackForQueueTrack,
  openTrackContextMenu,
  queueTrackNext,
}: UseTrackInteractionActionsOptions) {
  function selectTrack(track: Track) {
    selectedTrack.value = track;
  }

  function openOnlineTrackContextMenu(track: PluginSearchTrack, x: number, y: number) {
    openTrackContextMenu(createOnlineQueueTrack(track), x, y);
  }

  async function queueTrackNextFromContext(track: Track) {
    const pluginTrack = findPluginTrackForQueueTrack(track);
    if (!pluginTrack) {
      await queueTrackNext(track);
      return;
    }

    closeContextMenus();
    await queueTrackNext(createOnlineQueueTrack(pluginTrack));
  }

  return {
    openOnlineTrackContextMenu,
    queueTrackNextFromContext,
    selectTrack,
  };
}
