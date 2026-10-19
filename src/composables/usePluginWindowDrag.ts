import { onBeforeUnmount, onMounted, type Ref } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriRuntime } from '../services/music';

export function usePluginWindowDrag(frame: Ref<HTMLIFrameElement | null>, url: Ref<string>, enabled: () => boolean) {
  function onMessage(event: MessageEvent) {
    if (!enabled() || !url.value || !frame.value?.contentWindow || event.source !== frame.value.contentWindow) return;
    if (event.origin !== new URL(url.value).origin || event.data?.type !== 'mono:window-drag') return;
    if (isTauriRuntime()) void getCurrentWindow().startDragging().catch(error => console.warn('[Plugin window drag]', error));
  }

  onMounted(() => window.addEventListener('message', onMessage));
  onBeforeUnmount(() => window.removeEventListener('message', onMessage));
}
