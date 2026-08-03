import type { Ref } from 'vue';
import { resolveLocale } from '../../i18n';
import { getSystemThemeState } from '../../services/music';
import { writePersistentValue } from '../../services/persistentStore';
import type { CustomTheme, PlayerSettings, SystemThemeState } from '../../types/music';
import { CUSTOM_THEMES_KEY, SETTINGS_KEY, STARTUP_BG_KEY, STARTUP_THEME_KEY, SYSTEM_THEME_KEY } from './constants';
import { isCustomTheme, type CachedSystemThemeState } from './normalizers';
import { themeAssetSrc } from './themeAssets';
import { systemThemeVariables } from './systemThemeVariables';

interface PlayerThemeControllerOptions {
  settings: Ref<PlayerSettings>;
  customThemes: Ref<CustomTheme[]>;
  cachedSystemThemeState: Ref<CachedSystemThemeState | null>;
}

export function createPlayerThemeController({ settings, customThemes, cachedSystemThemeState }: PlayerThemeControllerOptions) {
  let systemThemeRefreshTask: Promise<void> | null = null;
  let systemThemeRefreshTimer: number | null = null;
  let lastSystemThemeRefreshRequestedAt = 0;
  let lastSystemThemeMode = '';
  const appliedCustomThemeVariables = new Set<string>();
  const appliedSystemThemeVariables = new Set<string>();

  function writeCachedSystemThemeState(state: SystemThemeState) {
    void writePersistentValue(SYSTEM_THEME_KEY, { state, savedAt: Date.now() });
  }

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
    if (settings.value.theme === 'wallpaperTone') {
      applyCachedSystemTheme();
    } else {
      clearSystemThemeVariables();
    }
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
    if (settings.value.theme === 'wallpaperTone') {
      settings.value.theme = 'blueWhite';
      persistSettings();
      return;
    }

    settings.value.theme =
      settings.value.theme === 'dark'
        ? 'light'
        : settings.value.theme === 'light'
          ? 'blueWhite'
          : settings.value.theme === 'blueWhite'
            ? 'desktopGlass'
            : 'dark';
    persistSettings();
  }

  function setTheme(theme: PlayerSettings['theme']) {
    if (settings.value.theme === theme) {
      applyCustomThemeVariables();
      if (theme === 'wallpaperTone') {
        scheduleSystemThemeRefresh(true);
      }
      return;
    }

    settings.value.theme = theme;
    persistSettings();
    if (theme === 'wallpaperTone') {
      scheduleSystemThemeRefresh(true);
    }
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

  function clearSystemThemeVariables() {
    const rootStyle = document.documentElement.style;
    for (const name of appliedSystemThemeVariables) {
      rootStyle.removeProperty(name);
    }
    appliedSystemThemeVariables.clear();
    lastSystemThemeMode = '';
  }

  function applySystemThemeState(state: SystemThemeState) {
    if (settings.value.theme !== 'wallpaperTone') return;
    const systemThemeKey = JSON.stringify(state);
    if (systemThemeKey === lastSystemThemeMode && appliedSystemThemeVariables.size > 0) return;

    clearSystemThemeVariables();
    lastSystemThemeMode = systemThemeKey;

    const rootStyle = document.documentElement.style;
    Object.entries(systemThemeVariables(state)).forEach(([name, value]) => {
      rootStyle.setProperty(name, value);
      appliedSystemThemeVariables.add(name);
    });
    persistStartupBackground();
  }

  function applyCachedSystemTheme() {
    applySystemThemeState(cachedSystemThemeState.value?.state ?? {
      mode: 'light',
      appsUseLightTheme: true,
      systemUsesLightTheme: true,
      wallpaperColor: null,
    });
  }

  function scheduleSystemThemeRefresh(force = false) {
    applyCachedSystemTheme();

    if (systemThemeRefreshTask) return;
    if (systemThemeRefreshTimer !== null) {
      if (!force) return;
      window.clearTimeout(systemThemeRefreshTimer);
      systemThemeRefreshTimer = null;
    }

    systemThemeRefreshTimer = window.setTimeout(() => {
      systemThemeRefreshTimer = null;
      systemThemeRefreshTask = refreshSystemTheme().finally(() => {
        systemThemeRefreshTask = null;
      });
    }, force ? 0 : 240);
  }

  function refreshSystemThemeOnFocus() {
    if (settings.value.theme !== 'wallpaperTone') return;

    const now = Date.now();
    if (now - lastSystemThemeRefreshRequestedAt < 2_000) return;

    lastSystemThemeRefreshRequestedAt = now;
    scheduleSystemThemeRefresh(true);
  }

  async function refreshSystemTheme() {
    try {
      const state = await getSystemThemeState();
      cachedSystemThemeState.value = { state, savedAt: Date.now() };
      writeCachedSystemThemeState(state);
      applySystemThemeState(state);
    } catch {
      applyCachedSystemTheme();
    }
  }

  function handleSystemThemeChanged(state: SystemThemeState) {
    writeCachedSystemThemeState(state);
    cachedSystemThemeState.value = { state, savedAt: Date.now() };
    applySystemThemeState(state);
  }

  return {
    addCustomTheme,
    applySettingsSideEffects,
    applySystemThemeState,
    handleSystemThemeChanged,
    persistCustomThemes,
    persistSettings,
    refreshSystemThemeOnFocus,
    removeCustomTheme,
    scheduleSystemThemeRefresh,
    setTheme,
    toggleTheme,
  };
}
