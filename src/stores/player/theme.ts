import { listThemes, saveCustomTheme, deleteCustomTheme, selectTheme, type ThemeSnapshot } from '../../services/themes';
import { saveSettings } from '../../services/settings';
import type { Ref } from 'vue';
import { resolveLocale } from '../../i18n';
import { writePersistentValue } from '../../services/persistentStore';
import type { CustomTheme, PlayerSettings } from '../../types/music';
import { STARTUP_BG_KEY } from './constants';
import { isCustomTheme } from './normalizers';
import { themeAssetSrc } from './themeAssets';

interface PlayerThemeControllerOptions {
  settings: Ref<PlayerSettings>;
  customThemes: Ref<CustomTheme[]>;
  onSettingsError: (error: unknown) => void;
}

export function createPlayerThemeController({ settings, customThemes, onSettingsError }: PlayerThemeControllerOptions) {
  const appliedCustomThemeVariables = new Set<string>();

  let saveQueue: Promise<void> = Promise.resolve();

  function persistSettings(refreshTheme = true) {
    const snapshot = JSON.stringify(settings.value);
    saveQueue = saveQueue.then(async () => {
      const normalized = await saveSettings(JSON.parse(snapshot));
      // Do not replace edits or previews made while this save was in flight.
      if (JSON.stringify(settings.value) === snapshot) settings.value = normalized;
      if (refreshTheme) applySettingsSideEffects();
    }).catch(onSettingsError);
  }

  function applySettingsSideEffects() {
    document.documentElement.dataset.theme = isCustomTheme(settings.value.theme) ? 'custom' : settings.value.theme;
    document.documentElement.lang = resolveLocale(settings.value.locale);
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

  function mutateTheme(action: () => Promise<ThemeSnapshot>) {
    const mutation = saveQueue.then(async () => {
      const snapshot = await action();
      customThemes.value = snapshot.themes;
      settings.value.theme = snapshot.activeTheme;
      applySettingsSideEffects();
    });
    saveQueue = mutation.catch(onSettingsError);
    return mutation;
  }

  function setTheme(theme: PlayerSettings['theme']) {
    return mutateTheme(() => selectTheme(theme));
  }

  function addCustomTheme(theme: CustomTheme, useImmediately = true) {
    return mutateTheme(() => saveCustomTheme(theme, useImmediately));
  }

  function removeCustomTheme(themeId: CustomTheme['id']) {
    return mutateTheme(() => deleteCustomTheme(themeId));
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
    reloadThemes: () => mutateTheme(listThemes),
    addCustomTheme,
    applySettingsSideEffects,
    persistSettings,
    removeCustomTheme,
    setTheme,
  };
}
