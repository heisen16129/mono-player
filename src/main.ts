import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import DesktopLyrics from './components/DesktopLyrics.vue';
import TrayMenu from './components/TrayMenu.vue';
import { readPersistentValue } from './services/persistentStore';
import './styles.css';

const searchParams = new URLSearchParams(window.location.search);
const Root = searchParams.has('tray') ? TrayMenu : searchParams.has('desktopLyrics') ? DesktopLyrics : App;
if (searchParams.has('desktopLyrics')) {
  document.body.classList.add('desktop-lyrics-page');
}

const STARTUP_THEME_KEY = 'mono-player-startup-theme';
const STARTUP_BG_KEY = 'mono-player-startup-bg';

async function applyStartupAppearance() {
  try {
    const [theme, startupBg] = await Promise.all([
      readPersistentValue<string>(STARTUP_THEME_KEY),
      readPersistentValue<string>(STARTUP_BG_KEY),
    ]);

    if (theme) {
      document.documentElement.dataset.theme = theme.startsWith('custom:') ? 'custom' : theme;
    }

    if (startupBg) {
      document.documentElement.style.setProperty('--smw-startup-bg', startupBg);
    }
  } catch {
    // Keep the default theme below when cached startup settings cannot be read.
  }
  document.documentElement.dataset.theme ||= 'blueWhite';
}

async function bootstrap() {
  await applyStartupAppearance();
  createApp(Root).use(createPinia()).mount('#app');
}

void bootstrap();
