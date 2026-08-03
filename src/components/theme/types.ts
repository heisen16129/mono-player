import type { AppTheme, CustomTheme, Locale } from '../../types/music';

export type BuiltInThemeCard = {
  value: Exclude<AppTheme, `custom:${string}`>;
  title: string;
  author: string;
  tone: string;
  previewUrl?: string;
};

export interface LocalThemeGridProps {
  customPreviewSrc: (theme: CustomTheme) => string;
  customPreviewStyle: (variables: Record<string, string>) => Record<string, string>;
  customThemeCards: CustomTheme[];
  deleteThemeText: string;
  localThemeCards: BuiltInThemeCard[];
  locale: Locale;
  selectedTheme: AppTheme;
}

export interface LocalThemeGridEmits {
  removeCustomTheme: [themeId: `custom:${string}`];
  selectTheme: [theme: AppTheme];
}

export interface LocalThemeGridListeners {
  onRemoveCustomTheme: (...args: LocalThemeGridEmits['removeCustomTheme']) => void;
  onSelectTheme: (...args: LocalThemeGridEmits['selectTheme']) => void;
}
