import { convertFileSrc } from '@tauri-apps/api/core';
import type { Ref } from 'vue';
import { resolveLocale } from '../../i18n';
import { getSystemThemeState } from '../../services/music';
import { writePersistentValue } from '../../services/persistentStore';
import type { CustomTheme, PlayerSettings, SystemThemeState } from '../../types/music';
import { CUSTOM_THEMES_KEY, SETTINGS_KEY, STARTUP_BG_KEY, STARTUP_THEME_KEY, SYSTEM_THEME_KEY } from './constants';
import { isCustomTheme, type CachedSystemThemeState } from './normalizers';

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
    settings.value.theme =
      settings.value.theme === 'dark'
        ? 'light'
        : settings.value.theme === 'light'
          ? 'blueWhite'
          : settings.value.theme === 'blueWhite'
            ? 'wallpaperTone'
            : settings.value.theme === 'wallpaperTone'
              ? 'desktopGlass'
            : 'dark';
    persistSettings();
    if (settings.value.theme === 'wallpaperTone') {
      scheduleSystemThemeRefresh(true);
    }
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
      setTheme('wallpaperTone');
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

  function themeAssetSrc(path: string) {
    if (/^(https?:|data:|blob:|\/)/.test(path)) return path;
    return convertFileSrc(path);
  }

  function systemThemeAccent(state: SystemThemeState, fallback: string) {
    const color = state.wallpaperColor;
    if (!color) return fallback;

    return `rgb(${color.r} ${color.g} ${color.b})`;
  }

  function systemThemeVariables(state: SystemThemeState) {
    const mode = state.mode;
    const systemAccent = systemThemeAccent(state, mode === 'dark' ? '#6d7480' : '#dfe4f2');

    if (mode === 'dark') {
      return {
        '--smw-system-base': '#0f0f10',
        '--smw-system-accent': systemAccent,
        '--smw-bg-canvas': 'var(--smw-system-base)',
        '--smw-bg-page': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 8%)',
        '--smw-bg-sidebar': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 10%)',
        '--smw-bg-panel': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 12%)',
        '--smw-library-bg': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 12%)',
        '--smw-library-border': 'color-mix(in srgb, var(--smw-system-base), white 14%)',
        '--smw-bg-workspace': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 8%)',
        '--smw-bg-input': 'color-mix(in srgb, var(--smw-system-base), white 10%)',
        '--smw-bg-selected': 'color-mix(in srgb, var(--smw-system-base), white 13%)',
        '--smw-bg-hover': 'color-mix(in srgb, var(--smw-system-base), white 10%)',
        '--smw-border': 'color-mix(in srgb, var(--smw-system-base), white 17%)',
        '--smw-border-soft': 'color-mix(in srgb, var(--smw-system-base), white 12%)',
        '--smw-border-strong': 'color-mix(in srgb, var(--smw-system-base), white 54%)',
        '--smw-window-border': 'color-mix(in srgb, var(--smw-system-base), white 14%)',
        '--smw-player-bg': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 10%)',
        '--smw-shell-bg': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 6%)',
        '--smw-text-primary': '#f2f2f2',
        '--smw-text-body': '#e2e2e2',
        '--smw-text-secondary': '#b5b7bc',
        '--smw-text-muted': '#7d8088',
        '--smw-icon-muted': '#b5b7bc',
        '--smw-button-primary': '#f2f2f2',
        '--smw-scrollbar-thumb': 'rgba(242, 242, 242, 0.22)',
        '--smw-scrollbar-thumb-hover': 'rgba(242, 242, 242, 0.38)',
        '--smw-accent-blue': 'color-mix(in srgb, var(--smw-system-accent), white 28%)',
        '--smw-lyrics-bg': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 8%)',
        '--smw-lyrics-glow-left': 'color-mix(in srgb, var(--smw-system-accent) 14%, transparent)',
        '--smw-lyrics-glow-right': 'color-mix(in srgb, var(--smw-system-accent) 18%, transparent)',
        '--smw-lyrics-current': '#f2f2f2',
        '--smw-volume-bg': 'color-mix(in srgb, var(--smw-system-base), white 10%)',
        '--smw-volume-track': 'color-mix(in srgb, var(--smw-system-base), white 18%)',
        '--smw-volume-fill': '#f2f2f2',
        '--smw-volume-thumb': '#f2f2f2',
        '--smw-volume-text': '#b5b7bc',
        '--smw-progress-track': 'color-mix(in srgb, var(--smw-system-base), white 18%)',
        '--smw-progress-fill': '#f2f2f2',
        '--smw-progress-thumb': '#f2f2f2',
        '--smw-progress-thumb-border': 'color-mix(in srgb, var(--smw-system-base), white 8%)',
        '--smw-progress-thumb-ring': 'rgba(242, 242, 242, 0.22)',
        '--smw-error-text': '#ffb0a8',
        '--smw-error-bg': 'color-mix(in srgb, #4a1f1f, var(--smw-system-base) 62%)',
        '--smw-error-border': 'color-mix(in srgb, #b05a5a, var(--smw-system-base) 54%)',
      };
    }

    return {
      '--smw-system-base': '#fbfbfd',
      '--smw-system-accent': systemAccent,
      '--smw-bg-canvas': 'var(--smw-system-base)',
      '--smw-bg-page': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 12%)',
      '--smw-bg-sidebar': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 18%)',
      '--smw-bg-panel': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 14%)',
      '--smw-library-bg': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 14%)',
      '--smw-library-border': 'color-mix(in srgb, var(--smw-system-base), black 12%)',
      '--smw-bg-workspace': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 8%)',
      '--smw-bg-input': '#ffffff',
      '--smw-bg-selected': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 24%)',
      '--smw-bg-hover': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 18%)',
      '--smw-border': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 34%)',
      '--smw-border-soft': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 24%)',
      '--smw-border-strong': '#242426',
      '--smw-window-border': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 38%)',
      '--smw-player-bg': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 20%)',
      '--smw-shell-bg': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 18%)',
      '--smw-text-primary': '#111113',
      '--smw-text-body': '#252529',
      '--smw-text-secondary': '#6f7178',
      '--smw-text-muted': '#9a9ca3',
      '--smw-icon-muted': '#676970',
      '--smw-button-primary': '#242426',
      '--smw-scrollbar-thumb': 'rgba(17, 17, 19, 0.18)',
      '--smw-scrollbar-thumb-hover': 'rgba(17, 17, 19, 0.34)',
      '--smw-accent-blue': 'color-mix(in srgb, var(--smw-system-accent), #4f8fe8 36%)',
      '--smw-lyrics-bg': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 10%)',
      '--smw-lyrics-glow-left': 'color-mix(in srgb, var(--smw-system-accent) 16%, transparent)',
      '--smw-lyrics-glow-right': 'color-mix(in srgb, var(--smw-system-accent) 24%, transparent)',
      '--smw-lyrics-current': '#242426',
      '--smw-volume-bg': '#ffffff',
      '--smw-volume-track': 'color-mix(in srgb, var(--smw-system-base), black 12%)',
      '--smw-volume-fill': '#242426',
      '--smw-volume-thumb': '#242426',
      '--smw-volume-text': '#6f7178',
      '--smw-progress-track': 'color-mix(in srgb, var(--smw-system-base), black 12%)',
      '--smw-progress-fill': '#4f8fe8',
      '--smw-progress-thumb': '#4f8fe8',
      '--smw-progress-thumb-border': 'color-mix(in srgb, var(--smw-system-base), black 3%)',
      '--smw-progress-thumb-ring': 'rgba(79, 143, 232, 0.24)',
      '--smw-error-text': '#8a3333',
      '--smw-error-bg': '#fff7f7',
      '--smw-error-border': '#d8b8b8',
    };
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
