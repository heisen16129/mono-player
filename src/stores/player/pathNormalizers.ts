import type { Track } from '../../types/music';

export function normalizeTrackPath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/\/\?\//, '').toLocaleLowerCase();
}

export function normalizeLocalPathInput(path: string) {
  const trimmed = path.trim();
  if (!trimmed.toLocaleLowerCase().startsWith('file:///')) return trimmed;

  try {
    return decodeURIComponent(trimmed)
      .replace(/^file:\/\/\//i, '')
      .replace(/\//g, '\\');
  } catch {
    return trimmed.replace(/^file:\/\/\//i, '').replace(/\//g, '\\');
  }
}

export function dedupeTracksByPath(items: Track[]) {
  const seenPaths = new Set<string>();
  return items.filter((track) => {
    const path = normalizeTrackPath(track.path);
    if (!path || seenPaths.has(path)) return false;
    seenPaths.add(path);
    return true;
  });
}
