import { convertFileSrc } from '@tauri-apps/api/core';
import { computed, onBeforeUnmount, shallowRef, watch, type ComputedRef } from 'vue';
import { getWallpaperEngineSceneStatus, listWallpaperEngineProjects, startWallpaperEngineScene, stopWallpaperEngineScene } from '../services/wallpaperEngine';
import { isTauriRuntime } from '../services/music';
import type { LyricsBackgroundSettings } from '../types/music';

export const wallpaperEngineRuntime = shallowRef({
  phase: 'idle' as 'idle' | 'loading' | 'active' | 'error',
  projectId: '', sessionId: '', error: '', frameUrl: '',
});
const retryRevision = shallowRef(0);
export function retryWallpaperEngineBackground() { retryRevision.value += 1; }

export function useWallpaperEngineBackground(
  background: ComputedRef<LyricsBackgroundSettings>,
  isLyricsOpen: ComputedRef<boolean>,
) {
  let generation = 0;
  let disposed = false;
  let healthTimer = 0;
  let transition = Promise.resolve();

  function publish(phase: typeof wallpaperEngineRuntime.value.phase, projectId = '', sessionId = '', error = '') {
    wallpaperEngineRuntime.value = {
      phase, projectId, sessionId, error,
      frameUrl: phase === 'active' ? convertFileSrc(sessionId, 'wallpaper-frame') : '',
    };
    document.documentElement.classList.toggle('wallpaper-engine-scene-active', phase === 'active');
  }

  function pollHealth(request: number, sessionId: string, projectId: string) {
    window.clearTimeout(healthTimer);
    healthTimer = window.setTimeout(async () => {
      try {
        const status = await getWallpaperEngineSceneStatus();
        if (request !== generation || disposed) return;
        if (!status.active || status.sessionId !== sessionId) throw new Error('Wallpaper Engine 背景连接已断开');
        pollHealth(request, sessionId, projectId);
      } catch (error) {
        if (request !== generation || disposed) return;
        publish('error', projectId, '', String(error));
        void stopWallpaperEngineScene(sessionId).catch(console.warn);
      }
    }, 1200);
  }

  watch(
    () => [isLyricsOpen.value, background.value.source, background.value.wallpaperProjectType,
      background.value.wallpaperProjectId, retryRevision.value] as const,
    ([open, source, type, projectId]) => {
      const request = ++generation;
      window.clearTimeout(healthTimer);
      const selected = open && source === 'wallpaper' && type === 'scene' && !!projectId;
      publish(selected ? 'loading' : 'idle', selected ? projectId : '');
      if (!isTauriRuntime()) {
        if (selected) publish('error', projectId, '', 'Wallpaper Engine 场景需要在桌面程序中运行');
        return;
      }
      // Cancel pending native work immediately when closing or switching.
      const stopped = stopWallpaperEngineScene().catch((error) => console.warn('[Wallpaper Engine] 停止失败', error));
      transition = transition.then(async () => {
        await stopped;
        if (disposed || request !== generation || !selected) return;
        try {
          // The project index is process-local; restore it after app restart.
          await listWallpaperEngineProjects(background.value.wallpaperRoot);
          if (disposed || request !== generation) return;
          const status = await startWallpaperEngineScene(projectId);
          if (disposed || request !== generation) {
            await stopWallpaperEngineScene(status.sessionId);
            return;
          }
          if (!status.active) throw new Error('Wallpaper Engine 背景窗口未就绪');
          publish('active', projectId, status.sessionId);
          pollHealth(request, status.sessionId, projectId);
        } catch (error) {
          if (disposed || request !== generation) return;
          console.error('[Wallpaper Engine] 背景启动失败', error);
          publish('error', projectId, '', String(error));
        }
      });
    }, { immediate: true },
  );

  onBeforeUnmount(() => {
    disposed = true;
    generation += 1;
    window.clearTimeout(healthTimer);
    publish('idle');
    if (isTauriRuntime()) void stopWallpaperEngineScene().catch(console.warn);
  });

  return {
    sceneActive: computed(() => wallpaperEngineRuntime.value.phase === 'active'),
    frameUrl: computed(() => wallpaperEngineRuntime.value.frameUrl),
    error: computed(() => wallpaperEngineRuntime.value.error),
  };
}
