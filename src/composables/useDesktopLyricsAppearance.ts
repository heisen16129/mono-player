import { invokeApi } from '../services/api';
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { defaultDesktopAppearance, loadDesktopAppearance, normalizeDesktopAppearance, DESKTOP_APPEARANCE_EVENT, type DesktopAppearance } from '../services/desktopLyricsAppearance';
export function useDesktopLyricsAppearance(width: number, height: number) {
  const appearance = ref({ ...defaultDesktopAppearance });
  let unlisten: UnlistenFn | undefined;
  let disposed = false;
  let appliedScale: number | undefined;
  let pending = Promise.resolve();
  function apply(value: DesktopAppearance) {
    pending = pending.catch(() => {}).then(async () => {
      if (disposed) return;
      appearance.value = normalizeDesktopAppearance(value);
      const window = getCurrentWindow();
      await window.setIgnoreCursorEvents(appearance.value.locked);
      if (appliedScale !== appearance.value.scale) {
        await invokeApi('resize_desktop_lyrics', { width: width * appearance.value.scale, height: height * appearance.value.scale, preserveCenter: appliedScale !== undefined });
        appliedScale = appearance.value.scale;
      }
    });
    return pending;
  }
  onMounted(async () => {
    unlisten = await listen<DesktopAppearance>(DESKTOP_APPEARANCE_EVENT, event => { void apply(event.payload); });
    if (disposed) { unlisten(); return; }
    await apply(await loadDesktopAppearance());
  });
  onBeforeUnmount(() => { disposed = true; unlisten?.(); });
  const appearanceStyle = computed(() => ({ opacity: appearance.value.opacity, zoom: appearance.value.scale, width: `${100 / appearance.value.scale}vw`, height: `${100 / appearance.value.scale}vh` }));
  return { appearance, appearanceStyle };
}

