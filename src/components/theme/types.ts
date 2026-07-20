import type { AppTheme, CustomTheme } from '../../types/music';

export type BuiltInThemeCard = {
  value: Exclude<AppTheme, `custom:${string}`>;
  title: string;
  author: string;
  tone: string;
  previewUrl?: string;
};

export type MarketThemeCard = {
  id: CustomTheme['id'];
  title: string;
  author: string;
  tone: string;
  previewUrl: string;
  variables: Record<string, string>;
};
