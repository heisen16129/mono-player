import type { AppTheme } from '../../types/music';

export type BuiltInThemeCard = {
  value: Exclude<AppTheme, `custom:${string}`>;
  title: string;
  author: string;
  tone: string;
  previewUrl?: string;
};
