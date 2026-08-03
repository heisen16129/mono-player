import { convertFileSrc } from '@tauri-apps/api/core';

export function themeAssetSrc(path: string) {
  if (/^(https?:|data:|blob:|\/)/.test(path)) return path;
  return convertFileSrc(path);
}
