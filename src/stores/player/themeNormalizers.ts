import type { AppTheme, CustomTheme } from '../../types/music';

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
  return theme === 'blueWhite';
}

export function isCustomTheme(theme: AppTheme): theme is `custom:${string}` {
  return theme.startsWith('custom:');
}
