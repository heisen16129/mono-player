import { invokeApi } from './api';
import type { AppTheme, CustomTheme } from '../types/music';

export interface ThemeSnapshot {
  themes: CustomTheme[];
  activeTheme: AppTheme;
}

export const listThemes = () => invokeApi<ThemeSnapshot>('theme_list');
export const saveCustomTheme = (theme: CustomTheme, activate: boolean) => invokeApi<ThemeSnapshot>('theme_upsert', { theme, activate });
export const deleteCustomTheme = (id: CustomTheme['id']) => invokeApi<ThemeSnapshot>('theme_remove', { id });
export const selectTheme = (id: AppTheme) => invokeApi<ThemeSnapshot>('theme_select', { id });
