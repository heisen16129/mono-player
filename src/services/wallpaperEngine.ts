import { invokeApi } from './api';

export type WallpaperEngineProject = {
  id: string;
  title: string;
  projectType: 'image' | 'video' | 'scene' | 'web' | 'application' | 'unknown';
  mediaType: '' | 'image' | 'video';
  mediaPath: string;
  previewPath: string;
  playable: boolean;
  enginePlayable: boolean;
  sourceLabel: string;
};

export type WallpaperEngineLibrarySnapshot = {
  projects: WallpaperEngineProject[];
  count: number;
  engineAvailable: boolean;
  engineExecutable: string;
};

export type WallpaperEngineSceneStatus = {
  active: boolean;
  projectId: string;
  sessionId: string;
};

export function listWallpaperEngineProjects(manualRoot = '') {
  return invokeApi<WallpaperEngineLibrarySnapshot>('wallpaper_engine_list_projects', {
    manualRoot: manualRoot || null,
  });
}

export function startWallpaperEngineScene(projectId: string) {
  return invokeApi<WallpaperEngineSceneStatus>('wallpaper_engine_start_scene', { projectId });
}

export function getWallpaperEngineSceneStatus() {
  return invokeApi<WallpaperEngineSceneStatus>('wallpaper_engine_scene_status');
}

export function stopWallpaperEngineScene(sessionId?: string) {
  return invokeApi<WallpaperEngineSceneStatus>('wallpaper_engine_stop_scene', { sessionId: sessionId || null });
}
