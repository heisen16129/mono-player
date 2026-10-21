// SPDX-License-Identifier: GPL-3.0-only
import { applyMessage, createState, playbackTime, lyricTime, artistName, artwork, formatTime } from './state.mjs';
import { createPage, createSettings, icon } from './components/page.mjs';
import { createLyricsView } from './components/lyrics.mjs';
import { createBackground } from './components/background.mjs';
import { createConfigEdits } from './utils/configEdits.mjs';
import { stylePreset } from './utils/stylePresets.mjs';
import { rendererConfig, fanSettingKeys } from './utils/rendererProfile.mjs';
import css from './styles.css';

export function createController(root, mono, fanOnly = false) {
  const state = createState(), events = new AbortController();
  state.config = rendererConfig(state.config, fanOnly);
  const elements = createPage(root, css), { app, get } = elements;
  if (fanOnly) get('.topbar').remove();
  const actions = {
    close: () => mono.ui.close(),
    togglePlayback: () => state.playback.isPlaying ? mono.player.pause() : mono.player.play(),
    playPrevious: () => mono.player.previous(),
    playNext: () => mono.player.next(),
    toggleFavorite: () => mono.favorites.set(state.track.id, !state.playback.isFavorite),
    toggleMute: () => mono.player.setMuted(!state.playback.isMuted),
    openSearch: () => mono.lyrics.openSearch(state.track.id),
  };
  const lyrics = createLyricsView(elements, state, mono, events.signal);
  const background = createBackground(elements);
  const configEdits = createConfigEdits();
  createSettings(get('.settings-content'), fanOnly);
  let frame = 0, alive = true, awakeUntil = 0, coverUrl = '', draggingSeek = false;
  let lastPlaying, lastFavorite, lastVolume, lastSecond = -1;
  const on = (node, type, callback, options = {}) => node.addEventListener(type, callback, { ...options, signal: events.signal });

  function schedule() { if (alive && !frame) frame = requestAnimationFrame(tick); }
  function awake() { awakeUntil = performance.now() + 2600; app.classList.add('awake'); schedule(); }
  function dismiss() { elements.panel.hidden = elements.queuePanel.hidden = true; }
  function togglePanel(panel, opener) {
    const open = panel.hidden; dismiss(); panel.hidden = !open;
    if (open) panel.querySelector('button').focus(); else opener.focus();
  }
  on(app, 'pointermove', awake);
  on(app, 'pointerdown', awake);
  on(app, 'wheel', schedule, { passive: true });
  on(app, 'touchstart', schedule, { passive: true });
  on(app, 'keydown', event => {
    awake();
    if (event.key === 'Escape') {
      if (!elements.panel.hidden || !elements.queuePanel.hidden) { dismiss(); get('[data-action=settings]').focus(); }
      else mono.ui.close();
    }
    if (event.code === 'Space' && !event.target.closest('button,input,select')) { event.preventDefault(); actions.togglePlayback(); }
  });
  on(app, 'click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'settings') togglePanel(elements.panel, button);
    else if (action === 'resetStyle') {
      const preset = stylePreset(state.config.lyricStyle);
      const patch = fanOnly ? Object.fromEntries(Object.entries(preset).filter(([key]) => fanSettingKeys.includes(key))) : preset;
      configEdits.commit(patch); state.config = { ...state.config, ...patch };
      renderConfig(); schedule(); mono.config.set(state.config);
    }
    else if (action === 'queue') { renderQueue(); togglePanel(elements.queuePanel, button); }
    else if (action === 'dismiss') { dismiss(); get('[data-action=settings]').focus(); }
    else if (action === 'earlier') mono.lyrics.setOffset(state.track.id, Number(state.ui.lyricTimeOffset || 0) + .5);
    else if (action === 'later') mono.lyrics.setOffset(state.track.id, Number(state.ui.lyricTimeOffset || 0) - .5);
    else actions[action]?.();
  });
  on(get('.queue-list'), 'click', event => {
    const item = event.target.closest('[data-queue]');
    if (item) mono.queue.play(state.queue[Number(item.dataset.queue)].entryId);
  });
  on(elements.seek, 'input', () => { draggingSeek = true; get('.elapsed').textContent = formatTime(Number(elements.seek.value)); });
  on(elements.seek, 'change', () => { mono.player.seek(Number(elements.seek.value)); draggingSeek = false; });
  on(elements.seek, 'blur', () => { draggingSeek = false; });
  on(elements.seek, 'pointercancel', () => { draggingSeek = false; });
  on(elements.volume, 'input', () => { mono.player.setVolume(Number(elements.volume.value) / 100); });
  on(elements.cover, 'error', () => { elements.cover.hidden = true; });
  function editSetting(event, commit) {
    const input = event.target, key = input.dataset.config;
    if (!key) return;
    const value = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
    const preset = key === 'lyricStyle' ? stylePreset(value) : {};
    const patch = { ...preset, [key]: value };
    if (commit) configEdits.commit(patch); else configEdits.preview(patch);
    state.config = { ...state.config, ...patch };
    renderConfig(); schedule();
    if (commit) mono.config.set(state.config);
  }
  on(get('.settings-content'), 'input', event => {
    if (event.target.type === 'range') editSetting(event, false);
  });
  on(get('.settings-content'), 'change', event => editSetting(event, true));
  for (const type of ['focusout', 'pointercancel']) on(get('.settings-content'), type, event => {
    if (configEdits.isEditing(event.target.dataset.config)) editSetting(event, true);
  });

  function renderConfig() {
    state.config = rendererConfig(state.config, fanOnly);
    app.classList.toggle('fan-mode', state.config.lyricStyle === 'fan');
    get('[data-action=resetStyle]').hidden = !['glow', 'fan'].includes(state.config.lyricStyle);
    app.classList.toggle('no-cover', !state.config.showCover);
    for (const input of app.querySelectorAll('[data-config]')) {
      if (input.type === 'checkbox') input.checked = Boolean(state.config[input.dataset.config]);
      else if (input.value !== String(state.config[input.dataset.config])) input.value = String(state.config[input.dataset.config]);
    }
    const verticalSetting = get('[data-vertical-setting]');
    if (verticalSetting) verticalSetting.hidden = state.config.lyricStyle !== 'vertical';
    lyrics.configure(); background.update(state);
  }
  function renderTrack() {
    get('h1').textContent = state.track?.title || '未在播放';
    get('h1').title = get('h1').textContent;
    get('.artist').textContent = artistName(state.track);
    get('.album').textContent = state.track?.album || '';
    const nextCover = artwork(state.track);
    if (nextCover !== coverUrl) {
      coverUrl = nextCover; elements.cover.hidden = !nextCover;
      if (nextCover) elements.cover.src = nextCover; else elements.cover.removeAttribute('src');
    }
    elements.seek.max = String(state.track?.duration || 0);
    elements.seek.disabled = !state.track?.duration;
    get('.duration').textContent = formatTime(state.track?.duration);
    background.update(state);
  }
  function renderQueue() {
    const list = get('.queue-list'); list.replaceChildren();
    if (!state.queue.length) { list.textContent = '播放队列为空'; return; }
    state.queue.forEach((track, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.queue = String(index);
      button.setAttribute('aria-current', String(track.id === state.track?.id && track.path === state.track?.path));
      button.textContent = track.title;
      const artist = document.createElement('small'); artist.textContent = artistName(track); button.append(artist); list.append(button);
    });
  }
  function transport(now) {
    const playback = state.playback;
    if (lastPlaying !== playback.isPlaying) {
      lastPlaying = playback.isPlaying;
      app.classList.toggle('playing', lastPlaying);
      const button = get('[data-action=togglePlayback]');
      button.innerHTML = icon(lastPlaying ? 'pause' : 'play');
      button.title = lastPlaying ? '暂停' : '播放'; button.setAttribute('aria-label', button.title);
    }
    if (lastFavorite !== playback.isFavorite) {
      lastFavorite = playback.isFavorite; get('[data-action=toggleFavorite]').setAttribute('aria-pressed', String(Boolean(lastFavorite)));
    }
    const volume = playback.isMuted ? 0 : playback.volume;
    if (lastVolume !== volume) { lastVolume = volume; elements.volume.value = String(volume); }
    if (!draggingSeek) {
      const time = playbackTime(state, now); elements.seek.value = String(time);
      if (Math.floor(time) !== lastSecond) { lastSecond = Math.floor(time); get('.elapsed').textContent = formatTime(time); }
    }
    const offset = Number(state.ui.lyricTimeOffset || 0);
    get('.offset').textContent = offset ? `歌词 ${offset > 0 ? '+' : ''}${offset.toFixed(1)} s` : '';
  }
  function update(message) {
    if (!alive) return;
    if (message.type === 'config') message = { ...message, config: configEdits.receive(message.config) };
    const type = applyMessage(state, message, performance.now());
    if (!type) return;
    if (type === 'track-change') { lyrics.render(); renderTrack(); renderQueue(); }
    else if (type === 'track') renderTrack();
    else if (type === 'lyrics') lyrics.render();
    else if (type === 'lyrics-status') lyrics.status();
    else if (type === 'config') renderConfig();
    else if (type === 'lyrics-ui') { lyrics.configure(); }
    else if (type === 'background') background.update(state);
    else if (type === 'queue') renderQueue();
    transport(performance.now());
    schedule();
  }
  function tick(now) {
    if (!alive) return;
    frame = 0;
    const moving = lyrics.tick(lyricTime(state, now), now); transport(now);
    if (now > awakeUntil) app.classList.remove('awake');
    if (state.playback.isPlaying || moving || now < awakeUntil) schedule();
  }
  lyrics.render(); renderTrack(); renderConfig(); transport(performance.now()); awake();
  schedule();
  return { update, destroy() {
    alive = false; cancelAnimationFrame(frame); events.abort(); lyrics.destroy(); background.destroy(); root.replaceChildren();
  } };
}
