import type { AppTheme } from '../../types/music';

export function isBuiltInTheme(theme: string): theme is Exclude<AppTheme, `custom:${string}`> {
  return theme === 'blueWhite';
}

export function isCustomTheme(theme: AppTheme): theme is `custom:${string}` {
  return theme.startsWith('custom:');
}
