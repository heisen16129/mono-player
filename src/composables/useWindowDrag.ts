import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriRuntime } from '../services/music';
import { shouldSkipWindowDrag } from '../utils/windowDrag';

export function useWindowDrag() {
  async function startWindowDrag(event: PointerEvent) {
    if (!isTauriRuntime() || event.button !== 0 || event.clientY > 64 || shouldSkipWindowDrag(event.target)) {
      return;
    }

    await getCurrentWindow().startDragging();
  }

  return {
    startWindowDrag,
  };
}
