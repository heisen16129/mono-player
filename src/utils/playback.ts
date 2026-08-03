import { resolveLocale } from '../i18n';
import type { Locale, Track } from '../types/music';
import { getErrorMessage } from './error';

export function normalizePlaybackQueuePath(path: string) {
  const normalized = path.split('\\').join('/');
  return (normalized.startsWith('//?/') ? normalized.slice(4) : normalized).toLocaleLowerCase();
}

export function dedupePlaybackQueue(tracks: Track[]) {
  const seenPaths = new Set<string>();
  return tracks.filter((track) => {
    const path = normalizePlaybackQueuePath(track.path);
    if (!path || seenPaths.has(path)) return false;
    seenPaths.add(path);
    return true;
  });
}

export function isRemoteTrack(track: Track) {
  return track.path.startsWith('plugin://') || /^https?:\/\//i.test(track.path);
}

export function normalizeOnlineErrorMessage(error: unknown, fallback: string, locale: Locale) {
  const message = getErrorMessage(error, fallback);
  if (
    message === 'Plugin for selected track is not installed.'
    || message === '\u63d2\u4ef6\u672a\u5b89\u88c5\u6216\u5df2\u505c\u7528\uff0c\u65e0\u6cd5\u64ad\u653e\u5f53\u524d\u5728\u7ebf\u6b4c\u66f2\u3002'
  ) {
    return resolveLocale(locale) === 'en-US'
      ? 'The plugin for this track is not installed or enabled. Open Plugin Manager and enable it before playing.'
      : '\u63d2\u4ef6\u672a\u5b89\u88c5\u6216\u5df2\u505c\u7528\uff0c\u8bf7\u5230\u63d2\u4ef6\u7ba1\u7406\u5b89\u88c5/\u542f\u7528\u540e\u518d\u64ad\u653e\u3002';
  }
  return message || fallback;
}

export function isPlaybackRequestReplacedError(error: unknown) {
  return getErrorMessage(error).includes('Playback request was replaced.');
}

export function normalizePlaybackErrorMessage(error: unknown, fallback = '\u64ad\u653e\u5931\u8d25') {
  const message = getErrorMessage(error, fallback);
  if (message.includes('No next queue source')) {
    return '\u6ca1\u6709\u4e0b\u4e00\u9996\u53ef\u64ad\u653e';
  }
  return message || fallback;
}
