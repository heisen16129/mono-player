import { ref, type Ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import type { TrackMetadataFormValue } from '../components/TrackMetadataDialog.vue';
import { clearCoverThumbnailCache, refreshTrackDuration, updateTrackCover, updateTrackMetadata } from '../services/music';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import { getErrorMessage } from '../utils/error';

type PlayerStore = ReturnType<typeof usePlayerStore>;

interface TrackMetadataDialogOptions {
  canChangeTrackCover: Ref<boolean>;
  canEditTrackMetadata: Ref<boolean>;
  canRefreshTrackDuration: Ref<boolean>;
  closeContextMenus: () => void;
  currentPlaybackTrack: Ref<Track | null>;
  onlineActiveTrack: Ref<Track | null>;
  player: PlayerStore;
  rustPlaybackQueue: Ref<Track[]>;
  selectedTrack: Ref<Track | null>;
  showToast: (message: string, variant?: 'success' | 'error') => void;
}

function normalizeMetadataText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalPositiveInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseOptionalYear(value: string) {
  const parsed = parseOptionalPositiveInteger(value);
  if (parsed === null) return null;
  return parsed >= 1000 && parsed <= 9999 ? parsed : null;
}

function isRemoteTrack(track: Track) {
  return track.path.startsWith('plugin://') || /^https?:\/\//i.test(track.path);
}

function patchTrackMetadata(
  track: Track,
  trackId: number,
  patch: Pick<Track, 'title' | 'artist' | 'album'> & { year?: number | null; genre?: string | null; trackNumber?: number | null },
): Track {
  return track.id === trackId ? { ...track, ...patch } : track;
}

function patchTrackCoverRefresh(track: Track, trackId: number): Track {
  return track.id === trackId ? { ...track, artwork: null, coverVersion: Date.now() } : track;
}

function patchTrackDuration(track: Track, trackId: number, duration: number): Track {
  return track.id === trackId ? { ...track, duration } : track;
}

export function useTrackMetadataDialog({
  canChangeTrackCover,
  canEditTrackMetadata,
  canRefreshTrackDuration,
  closeContextMenus,
  currentPlaybackTrack,
  onlineActiveTrack,
  player,
  rustPlaybackQueue,
  selectedTrack,
  showToast,
}: TrackMetadataDialogOptions) {
  const metadataEditingTrack = ref<Track | null>(null);
  const isSavingTrackMetadata = ref(false);
  const trackMetadataError = ref<string | null>(null);

  function applyTrackDurationUpdate(trackId: number, duration: number) {
    const patch = (track: Track) => patchTrackDuration(track, trackId, duration);

    player.tracks = player.tracks.map(patch);
    player.queue = player.queue.map(patch);
    rustPlaybackQueue.value = rustPlaybackQueue.value.map(patch);
    player.settings.playlists = player.settings.playlists.map((playlist) => ({
      ...playlist,
      tracks: (playlist.tracks ?? []).map(patch),
    }));

    if (player.currentTrack?.id === trackId) {
      player.setCurrentTrack(patch(player.currentTrack));
    }
    if (currentPlaybackTrack.value?.id === trackId) {
      currentPlaybackTrack.value = patch(currentPlaybackTrack.value);
    }
    if (selectedTrack.value?.id === trackId) {
      selectedTrack.value = patch(selectedTrack.value);
    }
  }

  function applyTrackMetadataUpdate(
    trackId: number,
    patchValue: Pick<Track, 'title' | 'artist' | 'album'> & { year?: number | null; genre?: string | null; trackNumber?: number | null },
  ) {
    const patch = (track: Track) => patchTrackMetadata(track, trackId, patchValue);

    player.tracks = player.tracks.map(patch);
    player.queue = player.queue.map(patch);
    rustPlaybackQueue.value = rustPlaybackQueue.value.map(patch);
    player.settings.playlists = player.settings.playlists.map((playlist) => ({
      ...playlist,
      tracks: (playlist.tracks ?? []).map(patch),
    }));

    if (player.currentTrack?.id === trackId) {
      player.setCurrentTrack(patch(player.currentTrack));
    }
    if (currentPlaybackTrack.value?.id === trackId) {
      currentPlaybackTrack.value = patch(currentPlaybackTrack.value);
    }
    if (selectedTrack.value?.id === trackId) {
      selectedTrack.value = patch(selectedTrack.value);
    }
    if (onlineActiveTrack.value?.id === trackId) {
      onlineActiveTrack.value = patch(onlineActiveTrack.value);
    }
  }

  function applyTrackCoverRefresh(trackId: number) {
    const patch = (track: Track) => patchTrackCoverRefresh(track, trackId);

    player.tracks = player.tracks.map(patch);
    player.queue = player.queue.map(patch);
    rustPlaybackQueue.value = rustPlaybackQueue.value.map(patch);
    player.settings.playlists = player.settings.playlists.map((playlist) => ({
      ...playlist,
      tracks: (playlist.tracks ?? []).map(patch),
    }));

    if (player.currentTrack?.id === trackId) {
      player.setCurrentTrack(patch(player.currentTrack));
    }
    if (currentPlaybackTrack.value?.id === trackId) {
      currentPlaybackTrack.value = patch(currentPlaybackTrack.value);
    }
    if (selectedTrack.value?.id === trackId) {
      selectedTrack.value = patch(selectedTrack.value);
    }
  }

  function openTrackMetadataDialog(track: Track) {
    if (!canEditTrackMetadata.value || isRemoteTrack(track)) return;
    metadataEditingTrack.value = track;
    trackMetadataError.value = null;
    closeContextMenus();
  }

  function closeTrackMetadataDialog() {
    if (isSavingTrackMetadata.value) return;
    metadataEditingTrack.value = null;
    trackMetadataError.value = null;
  }

  async function saveTrackMetadata(value: TrackMetadataFormValue) {
    const track = metadataEditingTrack.value;
    if (!track) return;

    const title = value.title.trim();
    if (!title) {
      trackMetadataError.value = '歌名不能为空。';
      return;
    }

    const artist = normalizeMetadataText(value.artist);
    const album = normalizeMetadataText(value.album);
    const year = parseOptionalYear(value.year);
    const genre = normalizeMetadataText(value.genre);
    const trackNumber = parseOptionalPositiveInteger(value.trackNumber);
    isSavingTrackMetadata.value = true;
    trackMetadataError.value = null;

    try {
      const result = await updateTrackMetadata({
        id: track.id,
        path: track.path,
        title,
        artist,
        album,
        year,
        genre,
        trackNumber,
      });

      applyTrackMetadataUpdate(track.id, {
        title: result.title,
        artist: result.artist,
        album: result.album,
        year: result.year,
        genre: result.genre,
        trackNumber: result.trackNumber,
      });
      metadataEditingTrack.value = null;
      showToast('元数据已更新', 'success');
    } catch (error) {
      const message = getErrorMessage(error);
      trackMetadataError.value = null;
      showToast(`元数据更新失败：${message}`);
    } finally {
      isSavingTrackMetadata.value = false;
    }
  }

  async function changeTrackCover(track: Track) {
    if (!canChangeTrackCover.value || isRemoteTrack(track)) return;
    closeContextMenus();

    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tif', 'tiff'] }],
      });
      if (typeof selected !== 'string') return;

      await clearCoverThumbnailCache(track.path);
      await updateTrackCover({ path: track.path, coverPath: selected });
      applyTrackCoverRefresh(track.id);
      showToast('封面已更新', 'success');
    } catch (error) {
      const message = getErrorMessage(error);
      showToast(`封面更新失败：${message}`);
    }
  }

  async function refreshLocalTrackDuration(track: Track) {
    if (!canRefreshTrackDuration.value || isRemoteTrack(track)) return;
    closeContextMenus();

    try {
      const result = await refreshTrackDuration({ id: track.id, path: track.path });
      applyTrackDurationUpdate(track.id, result.duration);
      showToast('歌曲时长已更新', 'success');
    } catch (error) {
      const message = getErrorMessage(error);
      showToast(`读取歌曲时长失败：${message}`);
    }
  }

  return {
    applyTrackCoverRefresh,
    changeTrackCover,
    closeTrackMetadataDialog,
    isSavingTrackMetadata,
    metadataEditingTrack,
    openTrackMetadataDialog,
    refreshLocalTrackDuration,
    saveTrackMetadata,
    trackMetadataError,
  };
}
