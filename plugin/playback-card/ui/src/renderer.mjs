import css from './styles.css';
import { createSeek } from './seek.mjs';
import { createTitleScroll } from './titleScroll.mjs';
import themes from './themes.css';
import { cardStyle, createStyleSelection } from './cardStyles.mjs';
import { createPage, icon } from './page.mjs';
import { clock } from './lyrics.mjs';
import { createLyricPanel } from './lyricPanel.mjs';
let root, get, api, controller;
let track = null, key = '', lines = [], playback = {}, offset = 0, previousPlaying;
let config = {}, selection = createStyleSelection();
let paintLyrics, titleScroll, seek;
function applyStyle(id) {
  const style = cardStyle(id);
  get('.card').dataset.style = style.id;
  get('#card-style').value = style.id;
  text('.style-mark', style.mark);
  text('.edition', style.edition || 'Mono · ISSUE 01');
  if (paintLyrics) paint();
}
function text(selector, value) { const node = get(selector); if (node.textContent !== value) node.textContent = value; }
function paint() {
  const time = Number(playback.currentTime) || 0;
  text('.title-text', track?.title || '等待播放');
  titleScroll?.update(get('.card').dataset.style);
  text('.artist', Array.isArray(track?.artist) ? track.artist.join(' / ') : track?.artist || 'Mono Player');
  paintLyrics(lines, time + offset, get('.card').dataset.style, track ? '纯音乐，或暂无同步歌词' : '让音乐陪在身边');
  text('.spine-artist', get('.artist').textContent);
  const source = track?.artworkDataUrl || track?.artwork || '';
  const image = get('img');
  if (image.getAttribute('src') !== source) {
    image.hidden = !source; if (source) image.src = source; else image.removeAttribute('src');
    get('.card').style.setProperty('--cover', source ? `url(${JSON.stringify(source)})` : 'none');
  }
  const playing = !!playback.isPlaying;
  if (previousPlaying !== playing) { get('.play').innerHTML = icon(playing ? 'pause' : 'play'); get('.play').setAttribute('aria-label', playing ? '暂停' : '播放'); previousPlaying = playing; }
  text('.elapsed', clock(time)); text('.duration', clock(track?.duration));
  seek?.update(time, track?.duration);
}
export default {
  mount(element, bridge) {
    this.destroy(); root = element; api = bridge; get = createPage(root, css + themes); controller = new AbortController();
    seek = createSeek(get('.progress'), time => api.player.seek(time), controller.signal);
    titleScroll = createTitleScroll(get('h1'), get('.title-text'));
    paintLyrics = createLyricPanel(get('.lyrics'));
    text('.card-date', new Date().toLocaleDateString('sv-SE').replaceAll('-', '.'));
    const options = { signal: controller.signal };
    root.addEventListener('click', event => { const button = event.target.closest('[data-action]'); if (!button) return;
      const actions = { close: () => api.ui.close(), playPrevious: () => api.player.previous(), playNext: () => api.player.next(),
        togglePlayback: () => playback.isPlaying ? api.player.pause() : api.player.play(),
        openDesktopCard: () => api.ui.openPage('renderer', { surface: 'desktop' }) };
      actions[button.dataset.action]?.(); }, options);
    const settingsButton = get('.settings-toggle');
    const settingsPanel = get('#card-settings');
    function setSettingsOpen(open) {
      settingsPanel.hidden = !open;
      settingsButton.setAttribute('aria-expanded', String(open));
    }
    settingsButton.addEventListener('click', () => {
      setSettingsOpen(settingsPanel.hidden);
      if (!settingsPanel.hidden) get('#card-style').focus();
    }, options);
    root.ownerDocument.addEventListener('pointerdown', event => {
      if (!settingsPanel.contains(event.target) && !settingsButton.contains(event.target)) setSettingsOpen(false);
    }, options);
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !settingsPanel.hidden) {
        setSettingsOpen(false);
        settingsButton.focus();
        event.stopPropagation();
      }
    }, options);
    get('#card-style').addEventListener('change', event => {
      config = { ...config, cardStyle: selection.choose(event.target.value) };
      applyStyle(config.cardStyle);
      api.config.set(config);
    }, options);
    get('.drag').addEventListener('pointerdown', event => { if (event.button === 0 && !event.target.closest('button') && get('.surface').classList.contains('desktop')) api.window.startDragging(); }, options);
    get('img').addEventListener('error', () => { get('img').hidden = true; }, options);
    applyStyle('minimal'); paint();
  },
  update(message) {
    if (!get) return;
    if (message.type === 'track') { if (key !== message.trackKey) { lines = []; playback = {}; } key = message.trackKey; track = message.activeTrack; }
    else if (message.type === 'lyrics' && message.trackKey === key) lines = message.lines || [];
    else if (message.type === 'playback') playback = message.playback || {};
    else if (message.type === 'lyrics-ui') offset = Number(message.lyricsUi?.lyricTimeOffset) || 0;
    else if (message.type === 'config') {
      config = { ...message.config, cardStyle: selection.receive(message.config?.cardStyle) };
      get('.surface').classList.toggle('desktop', config.desktop === true);
      applyStyle(config.cardStyle);
    }
    paint();
  },
  destroy() { titleScroll?.destroy(); titleScroll = null; seek = null; controller?.abort(); if (root) root.replaceChildren(); root = get = api = controller = null; paintLyrics = null; track = null; key = ''; lines = []; playback = {}; offset = 0; previousPlaying = undefined; config = {}; selection = createStyleSelection(); },
};
