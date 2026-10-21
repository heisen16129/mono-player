import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import PluginDesktopHost from './components/plugins/PluginDesktopHost.vue';
import DesktopLyrics from './components/DesktopLyrics.vue';
import TrayMenu from './components/TrayMenu.vue';
import './styles.css';
import { traceStartup } from './services/startup';

traceStartup('frontend-loaded');

const searchParams = new URLSearchParams(window.location.search);
const Root = searchParams.has('pluginDesktop') || searchParams.has('desktopCard') ? PluginDesktopHost : searchParams.has('tray') ? TrayMenu : searchParams.has('desktopLyrics') ? DesktopLyrics : App;
if (searchParams.has('desktopLyrics') || searchParams.has('desktopCard')) {
  document.body.classList.add('desktop-lyrics-page');
}

function bootstrap() {
  document.documentElement.dataset.theme ||= 'blueWhite';
  createApp(Root).use(createPinia()).mount('#app');
}

bootstrap();
