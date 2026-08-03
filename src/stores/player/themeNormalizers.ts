import type { AppTheme, CustomTheme, SystemThemeState } from '../../types/music';

export interface CachedSystemThemeState {
  state: SystemThemeState;
  savedAt: number;
}

export function normalizeCustomThemes(value: unknown): CustomTheme[] {
  return Array.isArray(value)
    ? value.filter((theme): theme is CustomTheme => {
        return (
          typeof theme?.id === 'string' &&
          theme.id.startsWith('custom:') &&
          typeof theme.name === 'string' &&
          typeof theme.author === 'string' &&
          theme.variables &&
          typeof theme.variables === 'object'
        );
      })
    : [];
}

export function isBuiltInTheme(theme: string): theme is Exclude<AppTheme, `custom:${string}`> {
  return theme === 'dark' || theme === 'light' || theme === 'blueWhite' || theme === 'wallpaperTone' || theme === 'desktopGlass';
}

export function isCustomTheme(theme: AppTheme): theme is `custom:${string}` {
  return theme.startsWith('custom:');
}

export function normalizeCachedSystemThemeState(value: unknown): CachedSystemThemeState | null {
  try {
    if (!value || typeof value !== 'object') return null;
    const parsed = value as CachedSystemThemeState;
    if (
      typeof parsed.savedAt !== 'number' ||
      (parsed.state?.mode !== 'light' && parsed.state?.mode !== 'dark') ||
      typeof parsed.state.appsUseLightTheme !== 'boolean' ||
      typeof parsed.state.systemUsesLightTheme !== 'boolean'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
