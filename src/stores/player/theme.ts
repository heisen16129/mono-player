import type { Ref } from 'vue';
import { resolveLocale } from '../../i18n';
import { writePersistentValue } from '../../services/persistentStore';
import type { CustomTheme, PlayerSettings } from '../../types/music';
import { CUSTOM_THEMES_KEY, SETTINGS_KEY, STARTUP_BG_KEY, STARTUP_THEME_KEY } from './constants';
import { isCustomTheme } from './normalizers';
import { themeAssetSrc } from './themeAssets';

interface PlayerThemeControllerOptions {
  settings: Ref<PlayerSettings>;
  customThemes: Ref<CustomTheme[]>;
}

export function createPlayerThemeController({ settings, customThemes }: PlayerThemeControllerOptions) {
  const appliedCustomThemeVariables = new Set<string>();

  function persistSettings() {
    void writePersistentValue(SETTINGS_KEY, settings.value);
    applySettingsSideEffects();
  }

  function persistCustomThemes() {
    void writePersistentValue(CUSTOM_THEMES_KEY, customThemes.value);
  }

  function applySettingsSideEffects() {
    document.documentElement.dataset.theme = isCustomTheme(settings.value.theme) ? 'custom' : settings.value.theme;
    document.documentElement.lang = resolveLocale(settings.value.locale);
    void writePersistentValue(STARTUP_THEME_KEY, settings.value.theme);
    applyCustomThemeVariables();
    persistStartupBackground();
  }

  function persistStartupBackground() {
    requestAnimationFrame(() => {
      const startupBg = getComputedStyle(document.documentElement).getPropertyValue('--smw-startup-bg').trim();
      if (startupBg) {
        void writePersistentValue(STARTUP_BG_KEY, startupBg);
      }
    });
  }

  function toggleTheme() {
    settings.value.theme = 'blueWhite';
    persistSettings();
  }

  function setTheme(theme: PlayerSettings['theme']) {
    if (settings.value.theme === theme) {
      applyCustomThemeVariables();
      return;
    }

    settings.value.theme = theme;
    persistSettings();
  }

  function addCustomTheme(theme: CustomTheme, useImmediately = true) {
    customThemes.value = [theme, ...customThemes.value.filter((item) => item.id !== theme.id)];
    persistCustomThemes();
    if (useImmediately) {
      setTheme(theme.id);
    }
  }

  function removeCustomTheme(themeId: CustomTheme['id']) {
    customThemes.value = customThemes.value.filter((theme) => theme.id !== themeId);
    persistCustomThemes();
    if (settings.value.theme === themeId) {
      setTheme('blueWhite');
      return;
    }

    applyCustomThemeVariables();
  }

  function applyCustomThemeVariables() {
    const rootStyle = document.documentElement.style;
    for (const name of appliedCustomThemeVariables) {
      rootStyle.removeProperty(name);
    }
    appliedCustomThemeVariables.clear();

    if (!isCustomTheme(settings.value.theme)) return;

    const theme = customThemes.value.find((item) => item.id === settings.value.theme);
    if (!theme) return;

    Object.entries(theme.variables).forEach(([name, value]) => {
      rootStyle.setProperty(name, value);
      appliedCustomThemeVariables.add(name);
    });

    if (theme.background) {
      rootStyle.setProperty('--smw-theme-bg-image', `url("${themeAssetSrc(theme.background)}")`);
      appliedCustomThemeVariables.add('--smw-theme-bg-image');
    }

    if (typeof theme.backgroundOpacity === 'number') {
      rootStyle.setProperty('--smw-theme-bg-opacity', `${theme.backgroundOpacity}`);
      appliedCustomThemeVariables.add('--smw-theme-bg-opacity');
    }
  }

  return {
    addCustomTheme,
    applySettingsSideEffects,
    persistCustomThemes,
    persistSettings,
    removeCustomTheme,
    setTheme,
    toggleTheme,
  };
}
