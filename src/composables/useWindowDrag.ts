import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriRuntime } from '../services/music';
import { shouldSkipWindowDrag } from '../utils/windowDrag';

export function useWindowDrag() {
  let starting = false;
  async function startWindowDrag(event: MouseEvent) {
    if (event.defaultPrevented || starting || !isTauriRuntime() || event.button !== 0 || event.clientY > 64 || shouldSkipWindowDrag(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    starting = true;
    try {
      await getCurrentWindow().startDragging();
    } catch (error) {
      console.warn('[Window drag]', error);
    } finally {
      starting = false;
    }
  }

  return {
    startWindowDrag,
  };
}
