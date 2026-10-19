import { invokeApi } from './api';
import type { PlayerSettings } from '../types/music';

export function saveSettings(value: PlayerSettings): Promise<PlayerSettings> {
  return invokeApi<PlayerSettings>('settings_set', { value });
}
