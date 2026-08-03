import { getCurrentWindow } from '@tauri-apps/api/window';
import { DESKTOP_LYRICS_POSITION_KEY } from '../services/desktopLyrics';
import { isTauriRuntime } from '../services/music';
import { writePersistentValue } from '../services/persistentStore';

export function useDesktopLyricsWindowPosition() {
  let savePositionTimer = 0;

  async function saveCurrentWindowPosition() {
    if (!isTauriRuntime()) return;
    const position = await getCurrentWindow().outerPosition();
    await writePersistentValue(DESKTOP_LYRICS_POSITION_KEY, {
      x: position.x,
      y: position.y,
    });
  }

  function clearScheduledPositionSave() {
    if (!savePositionTimer) return;
    window.clearTimeout(savePositionTimer);
    savePositionTimer = 0;
  }

  function scheduleSaveWindowPosition() {
    clearScheduledPositionSave();
    savePositionTimer = window.setTimeout(() => {
      savePositionTimer = 0;
      void saveCurrentWindowPosition();
    }, 240);
  }

  return {
    clearScheduledPositionSave,
    saveCurrentWindowPosition,
    scheduleSaveWindowPosition,
  };
}
