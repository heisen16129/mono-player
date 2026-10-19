import { emit } from '@tauri-apps/api/event';
import { getPluginConfig, savePluginConfig } from './plugins';
export const DESKTOP_APPEARANCE_EVENT = 'desktop-lyrics://appearance';
export interface DesktopAppearance { locked: boolean; scale: number; opacity: number }
export const defaultDesktopAppearance: DesktopAppearance = { locked: false, scale: 1, opacity: 1 };
export function normalizeDesktopAppearance(value: Partial<DesktopAppearance>): DesktopAppearance {
  const clamp = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 1;
  return { locked: value.locked === true, scale: clamp(value.scale, .75, 1.5), opacity: clamp(value.opacity, .2, 1) };
}
export async function loadDesktopAppearance() {
  return normalizeDesktopAppearance(await getPluginConfig('desktop-lyrics.appearance'));
}
let pending: Promise<unknown> = Promise.resolve();
export function saveDesktopAppearance(value: DesktopAppearance) {
  const settings = normalizeDesktopAppearance(value);
  pending = pending.catch(() => {}).then(async () => {
    await savePluginConfig('desktop-lyrics.appearance', { ...settings });
    await emit(DESKTOP_APPEARANCE_EVENT, settings);
  });
  return pending;
}
