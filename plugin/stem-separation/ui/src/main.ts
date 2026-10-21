import { createApp } from 'vue';
import { connectToHost } from '../../../../packages/plugin-sdk/src/connect';
import Page from './components/stem-separation/StemSeparationPage.vue';
import { setMono } from './mono';

const abort = new AbortController();
window.addEventListener('pagehide', () => abort.abort(), { once: true });
connectToHost({ signal: abort.signal }).then(mono => {
  setMono(mono);
  const app = createApp(Page);
  app.mount('#app');
  window.addEventListener('pagehide', () => { app.unmount(); mono.dispose(); }, { once: true });
}).catch(error => { document.querySelector('#app')!.textContent = String(error.message); });
