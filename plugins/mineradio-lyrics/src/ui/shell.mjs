import { artistText, artworkUrl, trackArtworkDisplayUrl } from '../bridge/context-adapter.mjs';
import { createFxPanel } from './fx-panel.mjs';
import { icon, iconButton } from './icons.mjs';

const CONTROL_GLASS_SVG = `
<svg id="control-glass-svg" class="control-glass-filter-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;pointer-events:none">
  <defs>
    <filter id="mineradio-control-glass-filter" color-interpolation-filters="sRGB" x="-12%" y="-28%" width="124%" height="156%">
      <feImage id="control-glass-map" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map"></feImage>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="180" xChannelSelector="R" yChannelSelector="B" result="dispRed"></feDisplacementMap>
      <feOffset in="dispRed" dx="-90" dy="0" result="dispRedShifted"></feOffset>
      <feMerge result="dispRedAligned"><feMergeNode in="SourceGraphic"></feMergeNode><feMergeNode in="dispRedShifted"></feMergeNode></feMerge>
      <feColorMatrix in="dispRedAligned" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"></feColorMatrix>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="170" xChannelSelector="R" yChannelSelector="B" result="dispGreen"></feDisplacementMap>
      <feOffset in="dispGreen" dx="-90" dy="0" result="dispGreenShifted"></feOffset>
      <feMerge result="dispGreenAligned"><feMergeNode in="SourceGraphic"></feMergeNode><feMergeNode in="dispGreenShifted"></feMergeNode></feMerge>
      <feColorMatrix in="dispGreenAligned" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"></feColorMatrix>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="160" xChannelSelector="R" yChannelSelector="B" result="dispBlue"></feDisplacementMap>
      <feOffset in="dispBlue" dx="-90" dy="0" result="dispBlueShifted"></feOffset>
      <feMerge result="dispBlueAligned"><feMergeNode in="SourceGraphic"></feMergeNode><feMergeNode in="dispBlueShifted"></feMergeNode></feMerge>
      <feColorMatrix in="dispBlueAligned" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"></feColorMatrix>
      <feBlend in="red" in2="green" mode="screen" result="rg"></feBlend>
      <feBlend in="rg" in2="blue" mode="screen" result="output"></feBlend>
      <feGaussianBlur in="output" stdDeviation="0.5"></feGaussianBlur>
    </filter>
  </defs>
</svg>`;

const formatTime = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

function post(api, action, payload, requestId) {
  api?.post?.(action, payload, requestId);
}

function setButton(slot, button, root) {
  root.querySelector(`[data-slot="${slot}"]`)?.replaceWith(button);
  return button;
}

export function createShell(target, api, getEngine) {
  target.innerHTML = `<div class="mineradio-player mono-mineradio diy-mode">
    ${CONTROL_GLASS_SVG}
    <div id="custom-bg"><video id="custom-bg-video" muted loop playsinline preload="metadata"></video></div>
    <div id="album-bg"></div>
    <div id="canvas-container"></div>
    <div id="thumb-wrap" aria-hidden="true"><img id="thumb-cover" alt=""><div id="thumb-info"><div id="thumb-title"></div><div id="thumb-artist"></div></div></div>
    <div data-slot="close"></div>
    <div class="mono-top-actions"><div data-slot="reset"></div><div data-slot="settings"></div></div>
    <div id="beat-chip"><span class="mini-spin"></span><span id="beat-text"></span></div>
    <div id="ai-depth-chip"><span class="mini-spin"></span><span id="ai-depth-text">封面深度处理中…</span></div>
    <aside class="mono-queue hidden"><div class="mono-queue-head"><strong>当前队列</strong><span></span></div><div class="mono-queue-list"></div></aside>
    <div id="bottom-bar" class="visible">
      <div id="progress-bar"><div id="progress-fill"></div><div id="progress-thumb"></div></div>
      <div id="controls">
        <div class="control-cluster actions"><div class="control-track"><div id="control-cover" class="control-cover cover-empty"></div><div class="control-meta"><div id="control-title" class="control-title">未播放</div><div id="control-artist" class="control-artist"></div></div></div><div data-slot="favorite"></div></div>
        <div class="control-cluster transport"><div data-slot="mode"></div><div data-slot="previous"></div><div data-slot="play"></div><div data-slot="next"></div><div data-slot="queue"></div></div>
        <div class="control-cluster modes"><div data-slot="lyrics"></div><div class="volume-control"><div data-slot="volume"></div><div class="volume-popover"><input id="volume-slider" type="range" min="0" max="100" step="1"><span id="volume-value">0%</span></div></div><div data-slot="immersive"></div><div id="time-display">0:00 / 0:00</div></div>
      </div>
    </div>
    <button id="fx-fab" type="button" title="视觉控制台" aria-label="视觉控制台">${icon('settings', 20)}</button>
  </div>`;
  const root = target.firstElementChild;
  const canvasContainer = root.querySelector('#canvas-container');
  const albumBg = root.querySelector('#album-bg');
  const queuePanel = root.querySelector('.mono-queue');
  const queueList = root.querySelector('.mono-queue-list');
  const progress = root.querySelector('#progress-bar');
  const progressFill = root.querySelector('#progress-fill');
  const progressThumb = root.querySelector('#progress-thumb');
  let context = {};
  let fxOpen = false;
  let queueOpen = false;
  let volumeOpen = false;
  let seekPreview = null;
  let playbackRequestSequence = 0;
  let lastLoggedPlaybackState = null;
  let lastPlaybackPointerRequestAt = -Infinity;

  const closeButton = setButton('close', iconButton('close', '返回', 'mr-close-btn mono-close'), root);
  const resetButton = setButton('reset', iconButton('reset', '回正舞台'), root);
  const settingsButton = setButton('settings', iconButton('settings', '视觉控制台'), root);
  const favoriteButton = setButton('favorite', iconButton('heart', '收藏'), root);
  const modeButton = setButton('mode', iconButton('repeat', '切换播放模式'), root);
  modeButton.id = 'play-mode-btn';
  const previousButton = setButton('previous', iconButton('previous', '上一首'), root);
  previousButton.id = 'prev-btn';
  const playButton = setButton('play', iconButton('play', '播放'), root);
  playButton.id = 'play-btn';
  const nextButton = setButton('next', iconButton('next', '下一首'), root);
  nextButton.id = 'next-btn';
  const queueButton = setButton('queue', iconButton('queue', '当前队列'), root);
  queueButton.id = 'mini-queue-btn';
  const lyricsButton = document.createElement('button');
  lyricsButton.type = 'button';
  lyricsButton.className = 'ctrl-btn lyrics-toggle-btn';
  lyricsButton.title = '歌词';
  lyricsButton.innerHTML = '<span class="lyrics-word-icon">词</span>';
  setButton('lyrics', lyricsButton, root);
  const volumeButton = setButton('volume', iconButton('volume', '音量'), root);
  volumeButton.id = 'volume-btn';
  const immersiveButton = setButton('immersive', iconButton('fullscreen', '沉浸模式'), root);
  immersiveButton.id = 'immersive-btn';
  const volumeControl = root.querySelector('.volume-control');
  const volumeSlider = root.querySelector('#volume-slider');
  const fxFab = root.querySelector('#fx-fab');

  const fxPanel = createFxPanel(getEngine, () => setFxOpen(false));
  root.append(fxPanel.element);

  function setFxOpen(value) {
    fxOpen = Boolean(value);
    fxFab.classList.toggle('active', fxOpen);
    fxPanel.setVisible(fxOpen);
  }

  function setQueueOpen(value) {
    queueOpen = Boolean(value);
    queuePanel.classList.toggle('hidden', !queueOpen);
    queueButton.classList.toggle('active', queueOpen);
    if (queueOpen) renderQueue();
  }

  function setVolumeOpen(value) {
    volumeOpen = Boolean(value);
    volumeControl.classList.toggle('open', volumeOpen);
  }

  function requestPlaybackToggle(trigger) {
    const requestId = `mineradio-playback-${Date.now()}-${++playbackRequestSequence}`;
    const observedPlaying = Boolean(context.isPlaying);
    console.log('[Mineradio 歌词][播放控制] 发起切换请求', {
      请求编号: requestId,
      触发方式: trigger,
      插件看到的播放状态: observedPlaying,
      预期播放状态: !observedPlaying,
      曲目编号: context.activeTrack?.id ?? null,
      歌曲名: context.activeTrack?.title ?? context.title ?? '',
    });
    post(api, 'togglePlayback', { observedPlaying, expectedPlaying: !observedPlaying }, requestId);
  }

  closeButton.addEventListener('click', () => post(api, 'close'));
  resetButton.addEventListener('click', () => getEngine()?.recenterCamera());
  settingsButton.addEventListener('click', () => setFxOpen(!fxOpen));
  fxFab.addEventListener('click', () => setFxOpen(!fxOpen));
  favoriteButton.addEventListener('click', () => post(api, 'toggleFavorite'));
  modeButton.addEventListener('click', () => post(api, 'togglePlaybackMode'));
  previousButton.addEventListener('click', () => post(api, 'playPrevious'));
  playButton.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    console.log('[Mineradio 歌词][播放控制] 指针按下', {
      当前是否播放: Boolean(context.isPlaying),
      指针类型: event.pointerType,
      鼠标按键: event.button,
    });
    if (event.isPrimary === false || event.button !== 0) return;
    lastPlaybackPointerRequestAt = performance.now();
    requestPlaybackToggle('指针按下');
  });
  playButton.addEventListener('click', (event) => {
    event.stopPropagation();
    if (performance.now() - lastPlaybackPointerRequestAt < 1000) return;
    requestPlaybackToggle('键盘或辅助设备单击');
  });
  nextButton.addEventListener('click', () => post(api, 'playNext'));
  queueButton.addEventListener('click', () => setQueueOpen(!queueOpen));
  lyricsButton.addEventListener('click', () => getEngine()?.toggleLyrics());
  volumeButton.addEventListener('click', () => setVolumeOpen(!volumeOpen));
  immersiveButton.addEventListener('click', () => getEngine()?.setImmersive(true));
  volumeSlider.addEventListener('input', () => post(api, 'setVolume', { value: Number(volumeSlider.value) }));
  volumeControl.addEventListener('wheel', (event) => {
    event.preventDefault();
    const value = Math.min(100, Math.max(0, Number(volumeSlider.value) + (event.deltaY < 0 ? 2 : -2)));
    post(api, 'setVolume', { value });
  }, { passive: false });

  function progressRatio(clientX) {
    const rect = progress.getBoundingClientRect();
    return rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
  }
  progress.addEventListener('pointerdown', (event) => {
    if (!(Number(context.duration) > 0)) return;
    event.stopPropagation();
    progress.setPointerCapture(event.pointerId);
    progress.classList.add('is-dragging');
    seekPreview = progressRatio(event.clientX) * Number(context.duration);
    renderProgress();
  });
  progress.addEventListener('pointermove', (event) => {
    if (seekPreview == null) return;
    seekPreview = progressRatio(event.clientX) * Number(context.duration);
    getEngine()?.emitProgressDragParticles(event.clientX, event.clientY);
    renderProgress();
  });
  progress.addEventListener('pointerup', (event) => {
    if (seekPreview == null) return;
    const time = progressRatio(event.clientX) * Number(context.duration);
    seekPreview = null;
    progress.classList.remove('is-dragging');
    post(api, 'seekTime', { time });
  });
  progress.addEventListener('pointercancel', () => {
    if (seekPreview == null) return;
    seekPreview = null;
    progress.classList.remove('is-dragging');
    renderProgress();
  });

  function renderProgress() {
    const duration = Math.max(0, Number(context.duration) || 0);
    const rawTime = seekPreview ?? (Number(context.currentTime) || 0);
    const currentTime = Math.min(duration || Infinity, Math.max(0, rawTime));
    const ratio = duration > 0 ? currentTime / duration : 0;
    progressFill.style.width = `${ratio * 100}%`;
    progressThumb.style.left = `${ratio * 100}%`;
    root.querySelector('#time-display').textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  }

  function renderQueue() {
    const tracks = Array.isArray(context.queueTracks) ? context.queueTracks : [];
    queuePanel.querySelector('.mono-queue-head span').textContent = `${tracks.length} 首`;
    queueList.replaceChildren();
    if (!tracks.length) {
      const empty = document.createElement('div');
      empty.className = 'mono-empty';
      empty.textContent = '队列为空';
      queueList.append(empty);
      return;
    }
    tracks.forEach((track, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `mono-queue-item${String(track?.id) === String(context.activeTrack?.id) ? ' now' : ''}`;
      const cover = trackArtworkDisplayUrl(track);
      row.innerHTML = `<img class="mono-queue-cover" alt=""><span class="mono-queue-copy"><span class="mono-queue-title"></span><span class="mono-queue-sub"></span></span><span class="mono-queue-duration"></span>`;
      const image = row.querySelector('img');
      const showCoverPlaceholder = () => {
        const placeholder = document.createElement('span');
        placeholder.className = 'mono-queue-cover cover-empty';
        placeholder.innerHTML = icon('music', 16);
        image.replaceWith(placeholder);
      };
      if (cover) {
        image.addEventListener('error', showCoverPlaceholder, { once: true });
        image.src = cover;
      } else {
        showCoverPlaceholder();
      }
      row.querySelector('.mono-queue-title').textContent = String(track?.title || '未知歌曲');
      row.querySelector('.mono-queue-sub').textContent = [artistText(track), track?.album].filter(Boolean).join(' · ');
      const duration = Number(track?.duration) || 0;
      row.querySelector('.mono-queue-duration').textContent = duration ? formatTime(duration > 10000 ? duration / 1000 : duration) : '';
      row.addEventListener('click', () => {
        post(api, 'playQueueTrack', { index });
        setQueueOpen(false);
      });
      queueList.append(row);
    });
  }

  function render(nextContext) {
    context = nextContext || {};
    const nextPlaying = Boolean(context.isPlaying);
    if (lastLoggedPlaybackState !== nextPlaying) {
      console.log('[Mineradio 歌词][播放控制] 状态更新', {
        更新前是否播放: lastLoggedPlaybackState,
        当前是否播放: nextPlaying,
        曲目编号: context.activeTrack?.id ?? null,
        歌曲名: context.activeTrack?.title ?? context.title ?? '',
      });
      lastLoggedPlaybackState = nextPlaying;
    }
    const track = context.activeTrack;
    const title = String(track?.title || context.title || '未在播放');
    const artist = artistText(track, context.artist);
    const album = String(track?.album || context.album || '');
    const cover = artworkUrl(context);
    const coverElement = root.querySelector('#control-cover');
    root.querySelector('#control-title').textContent = title;
    root.querySelector('#control-title').title = title;
    root.querySelector('#control-artist').textContent = [artist, album].filter(Boolean).join(' · ');
    root.querySelector('#thumb-title').textContent = title;
    root.querySelector('#thumb-artist').textContent = artist;
    coverElement.classList.toggle('cover-empty', !cover);
    coverElement.style.backgroundImage = cover ? `url(${JSON.stringify(cover)})` : '';
    playButton.innerHTML = icon(context.isPlaying ? 'pause' : 'play', 23, context.isPlaying);
    playButton.title = context.isPlaying ? '暂停' : '播放';
    favoriteButton.classList.toggle('liked', Boolean(context.isFavorite));
    favoriteButton.innerHTML = icon('heart', 20, Boolean(context.isFavorite));
    const mode = String(context.playbackMode || 'fixed').toLowerCase();
    modeButton.innerHTML = icon(mode.includes('shuffle') ? 'shuffle' : 'repeat', 19);
    const volume = Math.min(100, Math.max(0, Number(context.volume) || 0));
    volumeSlider.value = String(context.isMuted ? 0 : volume);
    root.querySelector('#volume-value').textContent = `${Math.round(context.isMuted ? 0 : volume)}%`;
    volumeButton.innerHTML = icon(context.isMuted || volume === 0 ? 'muted' : 'volume', 18);
    renderProgress();
    if (queueOpen) renderQueue();
  }

  const onKeyDown = (event) => {
    if (event.key !== 'Escape') return;
    if (fxOpen) setFxOpen(false);
    else if (queueOpen) setQueueOpen(false);
    else if (volumeOpen) setVolumeOpen(false);
    else getEngine()?.setImmersive(false);
  };
  window.addEventListener('keydown', onKeyDown);

  return {
    root,
    canvasContainer,
    albumBg,
    render,
    renderFx: () => fxOpen && fxPanel.render(),
    setBeatChip(state) {
      const chip = root.querySelector('#beat-chip');
      chip.classList.toggle('show', Boolean(state?.visible));
      root.querySelector('#beat-text').textContent = String(state?.text || '');
    },
    setImmersive(on) { root.classList.toggle('immersive-mode', Boolean(on)); },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      target.replaceChildren();
    },
  };
}
