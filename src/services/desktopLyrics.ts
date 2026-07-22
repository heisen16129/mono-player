import { emit } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { Track } from '../types/music';
import { isTauriRuntime } from './music';
import { readPersistentValue } from './persistentStore';

export const DESKTOP_LYRICS_LABEL = 'desktop-lyrics';
export const DESKTOP_LYRICS_ACTION_EVENT = 'desktop-lyrics://action';
export const DESKTOP_LYRICS_READY_EVENT = 'desktop-lyrics://ready';
export const DESKTOP_LYRICS_UPDATE_EVENT = 'desktop-lyrics://update';

export type DesktopLyricsAction = 'previous' | 'toggle-play' | 'next' | 'close';

export const DESKTOP_LYRICS_POSITION_KEY = 'desktopLyrics.position';

export interface DesktopLyricsPosition {
  x: number;
  y: number;
}

export interface DesktopLyricsState {
  track: Track | null;
  lyricContent: string | null;
  lyricFormat: string | null;
  currentTime: number;
  isPlaying: boolean;
  lyricColor: string;
}

export async function openDesktopLyricsWindow() {
  if (!isTauriRuntime()) return null;

  const existingWindow = await WebviewWindow.getByLabel(DESKTOP_LYRICS_LABEL);
  if (existingWindow) {
    await existingWindow.show();
    await existingWindow.setAlwaysOnTop(true);
    return existingWindow;
  }

  const position = await readPersistentValue<DesktopLyricsPosition>(DESKTOP_LYRICS_POSITION_KEY);
  const hasSavedPosition = (
    typeof position?.x === 'number' &&
    typeof position.y === 'number' &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y)
  );

  const lyricsWindow = new WebviewWindow(DESKTOP_LYRICS_LABEL, {
    title: 'Desktop Lyrics',
    url: '/?desktopLyrics',
    ...(hasSavedPosition ? { x: Math.round(position.x), y: Math.round(position.y) } : {}),
    width: 880,
    height: 120,
    minWidth: 480,
    minHeight: 88,
    decorations: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    shadow: false,
    focus: false,
  });

  await new Promise<void>((resolve) => {
    const fallbackTimer = window.setTimeout(resolve, 300);
    void lyricsWindow.once('tauri://created', () => {
      window.clearTimeout(fallbackTimer);
      resolve();
    });
    void lyricsWindow.once('tauri://error', () => {
      window.clearTimeout(fallbackTimer);
      resolve();
    });
  });

  return lyricsWindow;
}

export async function broadcastDesktopLyricsState(state: DesktopLyricsState) {
  if (!isTauriRuntime()) return;
  await emit(DESKTOP_LYRICS_UPDATE_EVENT, state);
}
