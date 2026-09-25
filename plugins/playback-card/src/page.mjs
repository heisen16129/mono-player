import { cardStyles } from './cardStyles.mjs';
const icons = {
  previous: '<path d="M6 5v14M18 5 8 12l10 7Z"/>',
  next: '<path d="M18 5v14M6 5l10 7-10 7Z"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  settings: '<path d="M4 7h16M4 17h16M8 4v6M16 14v6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
};
export const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${icons[name]}</svg>`;
export function createPage(root, css) {
  root.innerHTML = `<style>${css}</style><main class="surface"><div class="card-shell"><div id="card-settings" class="style-toolbar" role="region" aria-label="卡片设置" hidden><label for="card-style">卡片样式</label><select id="card-style" aria-label="卡片样式">${cardStyles.map(style => `<option value="${style.id}">${style.name}</option>`).join('')}</select><span class="style-count">${cardStyles.length} 款</span></div><section class="card" aria-label="播放卡片">
    <header class="drag"><span>MONO <i>NOW PLAYING</i></span><div class="header-actions"><button class="settings-toggle" aria-label="卡片设置" aria-expanded="false" aria-controls="card-settings">${icon('settings')}</button><button data-action="close" aria-label="关闭卡片">${icon('close')}</button></div></header>
    <div class="decoration" aria-hidden="true"><span class="style-mark">NOW PLAYING</span><span class="seal">撰</span><span class="barcode"></span><span class="edition">Mono · ISSUE 01</span><span class="sleeve-disc"></span><span class="spine-artist"></span><div class="ticket-details"><small>DATE</small><br><span class="card-date"></span><div class="ticket-location"><small>LOCATION</small><br>Mono</div></div><span class="receipt-total">TOTAL: PRICELESS</span></div>
    <div class="meta"><div class="art"><span aria-hidden="true">♫</span><img alt="专辑封面" hidden></div><div class="track"><h1><span class="title-text">等待播放</span></h1><div class="artist-credit"><p class="artist">选择一首喜欢的歌</p></div></div></div>
    <div class="lyrics" aria-live="off"></div>
    <div class="progress" role="slider" tabindex="0" aria-label="播放进度" aria-valuemin="0" aria-valuemax="100"><span></span></div>
    <footer><time class="elapsed">0:00</time><div class="controls"><button data-action="playPrevious" aria-label="上一首">${icon('previous')}</button><button class="play" data-action="togglePlayback" aria-label="播放">${icon('play')}</button><button data-action="playNext" aria-label="下一首">${icon('next')}</button></div><time class="duration">0:00</time></footer>

  </section></div><button class="desktop-launch" data-action="openDesktopCard">放到桌面右下角 ↗</button></main>`;
  return selector => root.querySelector(selector);
}
