import { connectToHost } from '../../../../../packages/plugin-sdk/src/connect';
import { initializeHost } from './mono';
import { createApp } from 'vue';
import App from './App.vue';
import { installListCoverVisibilityRecovery } from './covers';
import { installIconFontWatch } from './ui/iconFont';
import './style.css';
import './mono-theme.css';


// 必须在 mount 之前：探针要抢到 WebF 字体懒加载的「第一个请求者」位置，
// 那是唯一会在字体到货后被重排的节点。详见 ui/iconFont.ts。
installIconFontWatch();
installListCoverVisibilityRecovery();

connectToHost().then(async mono => {
  await initializeHost(mono);
  const app = createApp(App); app.mount('#app');
  window.addEventListener('pagehide', () => { app.unmount(); mono.dispose(); }, { once: true });
}).catch(error => { document.querySelector('#app')!.textContent = error.message; });
