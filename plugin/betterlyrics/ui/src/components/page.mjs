// SPDX-License-Identifier: GPL-3.0-only
import { fanSettingKeys } from '../utils/rendererProfile.mjs';
const paths = {
  play: '<path d="m9 5 11 7-11 7Z"/>', pause: '<path d="M9 5v14M16 5v14"/>',
  previous: '<path d="M5 5v14m14-14L8 12l11 7Z"/>', next: '<path d="M19 5v14M5 5l11 7-11 7Z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  queue: '<path d="M4 5h16M4 12h16M4 19h10"/>', search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  volume: '<path d="m11 5-6 4H2v6h3l6 4Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  note: '<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
};
export const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.note}</svg>`;
const button = (name, label, action = name) => `<button type="button" class="icon-button" data-action="${action}" title="${label}" aria-label="${label}">${icon(name)}</button>`;

export function createPage(root, css) {
  root.innerHTML = `<style>${css}</style><main class="betterlyrics" tabindex="-1">
    <div class="background" aria-hidden="true"><div class="wash"></div><div class="wash wash-two"></div><video muted loop playsinline></video><div class="shade"></div></div>
    <header class="topbar"><span>BetterLyrics</span></header>
    <div class="stage"><section class="record" aria-label="正在播放"><div class="artwork"><div class="cover-placeholder">${icon('note')}</div><img class="cover" alt="专辑封面" hidden></div><div class="metadata"><h1>未在播放</h1><p class="artist"></p><p class="album"></p></div></section>
    <section class="lyrics-area" aria-label="歌词"><div class="lyrics-scroll" tabindex="0" aria-label="歌词，点击已同步的行跳转"></div><div class="empty" role="status"></div><button class="return-live" hidden>回到当前歌词</button></section></div>
    <footer class="controls"><div class="timeline"><time class="elapsed">0:00</time><input class="seek" type="range" min="0" max="0" step="0.1" value="0" aria-label="播放进度"><time class="duration">0:00</time></div><div class="control-row"><div class="control-left">${button('heart', '收藏', 'toggleFavorite')}${button('search', '搜索歌词', 'openSearch')}<span class="offset"></span></div><div class="transport">${button('previous', '上一曲', 'playPrevious')}${button('play', '播放', 'togglePlayback')}${button('next', '下一曲', 'playNext')}</div><div class="control-right">${button('volume', '静音', 'toggleMute')}<input class="volume" type="range" min="0" max="100" value="100" aria-label="音量">${button('queue', '播放队列')}${button('settings', '显示设置')}</div></div></footer>
    <aside class="panel" hidden aria-label="显示设置"><div class="panel-heading"><h2>显示设置</h2><button data-action="dismiss" aria-label="关闭面板">×</button></div><div class="settings-content"></div></aside>
    <aside class="queue-panel panel" hidden aria-label="播放队列"><div class="panel-heading"><h2>播放队列</h2><button data-action="dismiss" aria-label="关闭面板">×</button></div><div class="queue-list"></div></aside>
  </main>`;
  const app = root.querySelector('.betterlyrics');
  const get = (selector) => app.querySelector(selector);
  return { app, get, scroll: get('.lyrics-scroll'), empty: get('.empty'), cover: get('.cover'),
    seek: get('.seek'), volume: get('.volume'), panel: get('.panel'), queuePanel: get('.queue-panel') };
}

export function createSettings(container, fanOnly = false) {
  container.innerHTML = `<p class="word-timing-note" hidden></p><button class="style-reset" data-action="resetStyle" hidden>恢复此样式默认效果</button><label>字号 <input data-config="fontSize" type="range" min="20" max="72" step="1"></label>
    <label>歌词样式 <select data-config="lyricStyle"><option value="standard">标准</option><option value="glow">辉光上浮</option><option value="fan">扇形歌词</option><option value="vertical">竖排歌词</option><option value="perspective">3D 透视</option></select></label>
    <label>扇形角度 <input data-config="fanAngle" type="range" min="-45" max="45" step="1"></label>
    <label>透视角度 <input data-config="tiltAngle" type="range" min="-45" max="45" step="1"></label>
    <label>辉光强度 <input data-config="glowAmount" type="range" min="0" max="24" step="1"></label>
    <label>上浮幅度 <input data-config="floatAmount" type="range" min="0" max="16" step="1"></label>
    <label>辉光范围 <select data-config="glowScope"><option value="long">仅长音</option><option value="all">行首到当前字</option></select></label>
    <label data-vertical-setting hidden>上下位置 <input data-config="verticalOffset" type="range" min="0" max="60" step="1"></label>
    <label>行间距 <input data-config="lineGap" type="range" min="0" max="1.5" step="0.05"></label>
    <label>对齐 <select data-config="alignment"><option value="left">左对齐</option><option value="center">居中</option></select></label>
    <label>背景 <select data-config="backgroundMode"><option value="fluid">封面流动</option><option value="blur">封面模糊</option><option value="host">跟随播放器</option></select></label>
    ${[['blur','远处歌词模糊'],['glow','逐字辉光'],['float','逐字浮动'],['scale','歌词缩放'],['showCover','显示封面']].map(([key,label]) => `<label>${label}<input type="checkbox" data-config="${key}"></label>`).join('')}
    <div class="timing"><span>歌词同步</span><button data-action="earlier" title="歌词提前 0.5 秒">−0.5 s</button><button data-action="later" title="歌词延后 0.5 秒">+0.5 s</button></div>`;
  for (const input of container.querySelectorAll('[data-config]')) {
    if (fanOnly ? !fanSettingKeys.includes(input.dataset.config) : input.dataset.config === 'fanAngle') input.closest('label').remove();
  }
  if (fanOnly) {
    container.querySelector('[data-config="scale"]').closest('label').firstChild.textContent = '远处歌词缩放';
    container.querySelector('[data-action="resetStyle"]').textContent = '恢复扇形默认设置';
  }
  if (!fanOnly) container.querySelector('option[value="fan"]').remove();
}
