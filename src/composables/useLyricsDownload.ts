import type { ComputedRef } from 'vue';
import { downloadCoverFile, downloadLyricsFile } from '../services/downloads';
import { clearCoverThumbnailCache, resolveLocalTrackLyrics } from '../services/music';
import { getPluginLyricsMetadata } from '../services/pluginSearch';
import type { usePlayerStore } from '../stores/player';
import type { Track, TrackLyrics } from '../types/music';
import type { PluginSearchTrack } from '../types/plugin';
import { getErrorMessage } from '../utils/error';
import { normalizeTrackLyrics } from '../utils/trackLyrics';

type PlayerStore = ReturnType<typeof usePlayerStore>;

interface LyricsDownloadOptions {
  activeLyricFormats: ComputedRef<string[]>;
  activeLyrics: ComputedRef<TrackLyrics | null | undefined>;
  activeTrack: ComputedRef<Track | null>;
  closeMenu: () => void;
  onCoverChanged: () => void;
  onNotify: (message: string, variant?: 'success' | 'error') => void;
  player: PlayerStore;
}

function isOnlineTrackPath(path: string) {
  return /^https?:\/\//i.test(path) || path.startsWith('plugin://');
}

function isLocalTrackPath(path?: string | null) {
  if (!path) return false;
  return !path.startsWith('http://') && !path.startsWith('https://') && !path.startsWith('plugin://');
}

function localTrackFolder(path: string) {
  if (!path || isOnlineTrackPath(path)) return '';

  const normalizedPath = path.replace(/\//g, '\\');
  const separatorIndex = normalizedPath.lastIndexOf('\\');
  return separatorIndex > 0 ? normalizedPath.slice(0, separatorIndex) : '';
}

function lyricsDownloadTitle(track: Track) {
  const title = track.title.trim();
  const artist = track.artist?.trim();
  if (!artist || title.endsWith(` - ${artist}`)) {
    return title;
  }
  return `${title} - ${artist}`;
}

export function useLyricsDownload({ activeLyricFormats, activeLyrics, activeTrack, closeMenu, onCoverChanged, onNotify, player }: LyricsDownloadOptions) {
  function lyricsDownloadDir(track: Track) {
    return localTrackFolder(track.path) || player.settings.downloadDir;
  }

  function linkedLyricsLabel(track: Track) {
    const lyrics = normalizeTrackLyrics(track);
    if (lyrics?.lyricsUrl) return lyrics.lyricsUrl;
    if (lyrics?.providerName) return lyrics.providerName;
    if (isOnlineTrackPath(track.path)) return track.sourceName || '在线歌词';
    return '本地歌词';
  }

  function activeTrackAsPluginTrack(): PluginSearchTrack | null {
    const track = activeTrack.value;
    const lyrics = activeLyrics.value;
    const providerId = lyrics?.providerId ?? track?.sourceProviderId;
    const trackId = lyrics?.trackId ?? track?.sourceId;
    if (!track || !providerId || !trackId) return null;
    return {
      id: trackId,
      providerId,
      providerName: lyrics?.providerName ?? track.sourceName ?? providerId,
      title: track.title,
      artist: track.artist ?? '',
      album: track.album ?? '',
      duration: track.duration ?? null,
      artwork: track.artwork ?? null,
      raw: lyrics?.trackRaw ?? track.sourceRaw ?? {
        id: trackId,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
      },
    };
  }

  async function rawLyricsForDownload(format: string) {
    const track = activeTrack.value;
    const associatedLyrics = track?.associatedLyrics ?? null;
    if (!track || !associatedLyrics?.rawLyrics?.trim()) return '';

    const sourceFormat = format === 'txt' && activeLyricFormats.value.includes('lrc') ? 'lrc' : format;
    const associatedFormat = associatedLyrics.format ?? associatedLyrics.defaultFormat ?? null;
    if (sourceFormat === associatedFormat) {
      return associatedLyrics.rawLyrics.trim();
    }

    const pluginTrack = activeTrackAsPluginTrack();
    const source = pluginTrack
      ? await getPluginLyricsMetadata(pluginTrack, sourceFormat)
      : isLocalTrackPath(track.path)
        ? await resolveLocalTrackLyrics(track, sourceFormat)
        : null;

    return source?.rawLyrics?.trim() || '';
  }

  function hasDownloadableCover() {
    return Boolean(activeTrack.value?.associatedArtwork);
  }

  async function downloadLyrics(format: string) {
    const track = activeTrack.value;
    if (!track) {
      onNotify('当前歌曲没有可下载的歌词');
      return;
    }

    const downloadDir = lyricsDownloadDir(track);
    if (!downloadDir) {
      onNotify('请先在设置中选择下载位置');
      return;
    }

    try {
      const rawLyrics = await rawLyricsForDownload(format);
      if (!rawLyrics) {
        onNotify('当前歌曲没有可下载的歌词');
        return;
      }

      await downloadLyricsFile({
        downloadDir,
        title: lyricsDownloadTitle(track),
        artist: null,
        lyrics: rawLyrics,
        format,
      });
      onNotify('下载成功', 'success');
      closeMenu();
    } catch (error) {
      const message = getErrorMessage(error);
      onNotify(`歌词下载失败：${message}`);
    }
  }

  async function downloadCover() {
    const track = activeTrack.value;
    if (!track || !hasDownloadableCover()) {
      onNotify('当前歌曲没有可下载的封面');
      return;
    }

    if (!player.settings.downloadDir) {
      onNotify('请先在设置中选择下载位置');
      return;
    }

    try {
      const result = await downloadCoverFile({
        downloadDir: player.settings.downloadDir,
        trackPath: track.path,
        title: track.title,
        artist: track.artist,
        artworkUrl: track.associatedArtwork ?? null,
        mimeType: null,
        data: null,
      });
      if (result.embeddedInTrack) {
        await clearCoverThumbnailCache(track.path);
        onCoverChanged();
      }
      onNotify(result.embeddedInTrack ? '封面已写入歌曲文件' : '封面已保存为图片', 'success');
      closeMenu();
    } catch (error) {
      const message = getErrorMessage(error);
      onNotify(`封面下载失败：${message}`);
    }
  }

  return {
    downloadCover,
    downloadLyrics,
    hasDownloadableCover,
    linkedLyricsLabel,
  };
}
