import type { LyricsBackgroundSettings } from '../../types/music';
import { DEFAULT_LYRICS_BACKGROUND } from './constants';

// Only used for immediate, unsaved background previews. Saved settings are validated by Rust.
function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.min(max, Math.max(min, numberValue)) : fallback;
}

export function normalizeLyricsBackground(value: unknown): LyricsBackgroundSettings {
  const source = value && typeof value === 'object' ? value as Partial<LyricsBackgroundSettings> : {};
  return {
    source: source.source === 'color' || source.source === 'media' || source.source === 'wallpaper'
      ? source.source
      : 'cover',
    color: typeof source.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(source.color)
      ? source.color
      : DEFAULT_LYRICS_BACKGROUND.color,
    colorMode: source.colorMode === 'cover' ? 'cover' : 'custom',
    coverColor: typeof source.coverColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(source.coverColor)
      ? source.coverColor
      : '',
    mediaPath: typeof source.mediaPath === 'string' ? source.mediaPath.trim() : '',
    mediaKind: source.mediaKind === 'video' ? 'video' : 'image',
    wallpaperRoot: typeof source.wallpaperRoot === 'string' ? source.wallpaperRoot.trim() : '',
    wallpaperProjectId: typeof source.wallpaperProjectId === 'string' ? source.wallpaperProjectId.trim() : '',
    wallpaperTitle: typeof source.wallpaperTitle === 'string' ? source.wallpaperTitle.trim() : '',
    wallpaperProjectType: ['image', 'video', 'scene', 'web', 'application'].includes(String(source.wallpaperProjectType))
      ? source.wallpaperProjectType as LyricsBackgroundSettings['wallpaperProjectType']
      : 'unknown',
    wallpaperMediaPath: typeof source.wallpaperMediaPath === 'string' ? source.wallpaperMediaPath.trim() : '',
    wallpaperPreviewPath: typeof source.wallpaperPreviewPath === 'string' ? source.wallpaperPreviewPath.trim() : '',
    opacity: clampNumber(source.opacity, 0, 1, DEFAULT_LYRICS_BACKGROUND.opacity),
    blur: clampNumber(source.blur, 0, 60, DEFAULT_LYRICS_BACKGROUND.blur),
    windowOpacity: clampNumber(source.windowOpacity, 0, 1, DEFAULT_LYRICS_BACKGROUND.windowOpacity),
    positionX: clampNumber(source.positionX, 0, 100, DEFAULT_LYRICS_BACKGROUND.positionX),
    positionY: clampNumber(source.positionY, 0, 100, DEFAULT_LYRICS_BACKGROUND.positionY),
    scale: clampNumber(source.scale, 1, 2.8, DEFAULT_LYRICS_BACKGROUND.scale),
  };
}
