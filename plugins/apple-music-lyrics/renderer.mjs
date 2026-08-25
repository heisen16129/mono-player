const DEFAULT_CONFIG = {
  fontSize: 28,
  lineHeight: 1.2,
  lineGap: 0.5,
  alignPosition: 45,
  backgroundMode: 'dynamic',
  backgroundBlur: 32,
  showCover: true,
  enableBlur: true,
  enableScale: true,
  showWordProgress: true,
  smoothScroll: true,
};

const ICONS = {
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5a5.5 5.5 0 0 0 1.1-8.9Z"/>',
  settings: '<path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.2a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.8v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.2a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.2a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.8l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.2a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>',
  previous: '<path d="m19 20-9-8 9-8v16Z"/><path d="M5 19V5"/>',
  next: '<path d="m5 4 9 8-9 8V4Z"/><path d="M19 5v14"/>',
  play: '<path d="m7 4 13 8L7 20V4Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8 8 0 0 1 0 12"/>',
  muted: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6M16 9l6 6"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  repeat: '<path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  repeatOne: '<path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><path d="M11 10h1v5"/>',
  lyrics: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  comments: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/>',
  queue: '<path d="M3 6h14M3 12h14M3 18h9"/><path d="m18 15 4 3-4 3v-6Z"/>',
  locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  external: '<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
};

const svg = (name, size = 20, filled = false) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const CSS = `
:root,:host { color-scheme:dark; --accent:#fa2d48; --fg:#fff; --muted:rgba(255,255,255,.58); --line:rgba(255,255,255,.13); }
* { box-sizing:border-box; }
button,input,select { font:inherit; }
button { color:inherit; }
.app { position:relative; width:100%; height:100%; min-height:520px; overflow:clip; color:var(--fg); background:#09090a; font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif; }
.backdrop,.backdrop::before,.backdrop::after { position:absolute; inset:-10%; content:""; pointer-events:none; }
.backdrop { background-position:center; background-size:cover; transform:scale(1.12); filter:blur(var(--bg-blur,32px)) saturate(1.12); opacity:.52; transition:filter .3s ease,opacity .3s ease; }
.backdrop::before { background:linear-gradient(105deg,rgba(5,5,7,.58),rgba(8,8,10,.36) 45%,rgba(3,3,5,.68)); }
.backdrop::after { background:linear-gradient(to bottom,rgba(0,0,0,.08),rgba(0,0,0,.42) 76%,rgba(0,0,0,.64)); }
.app[data-background="static"] .backdrop { filter:blur(var(--bg-blur,32px)) saturate(.72); opacity:.34; transform:scale(1.08); }
.app[data-background="amll"] .backdrop { filter:blur(calc(var(--bg-blur,32px) + 12px)) saturate(1.45); opacity:.65; animation:drift 16s ease-in-out infinite alternate; }
.grain { position:absolute; inset:0; opacity:.055; pointer-events:none; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E"); }
@keyframes drift { from { transform:scale(1.13) translate3d(-1.5%,-1%,0); } to { transform:scale(1.2) translate3d(1.5%,1%,0); } }
.chrome { position:absolute; inset:0; display:flex; flex-direction:column; padding:54px 24px 22px; z-index:1; }
.topbar { position:relative; height:42px; display:flex; align-items:center; flex:0 0 auto; }
.topbar-title { position:absolute; left:50%; transform:translateX(-50%); font-size:13px; font-weight:650; color:rgba(255,255,255,.72); }
.topbar .icon-btn { width:40px; height:40px; }
.icon-btn { width:36px; height:36px; border:0; border-radius:50%; display:grid; place-items:center; background:rgba(255,255,255,.09); cursor:pointer; transition:background .16s ease,transform .16s ease,color .16s ease; }
.icon-btn:hover { background:rgba(255,255,255,.16); }
.icon-btn:active { transform:scale(.92); }
.icon-btn:focus-visible,.transport button:focus-visible,.segment button:focus-visible,.queue-row:focus-visible { outline:2px solid rgba(255,255,255,.9); outline-offset:2px; }
.main { min-height:0; flex:1; display:grid; grid-template-columns:360px minmax(0,1fr); gap:clamp(72px,12.86vw,247px); align-items:center; max-width:1506px; width:100%; margin:0 auto; }
.player { min-width:0; display:flex; flex-direction:column; align-items:center; transform:translateY(22px); }
.cover-wrap { width:min(100%,320px); aspect-ratio:1; margin-bottom:58px; }
.cover { width:100%; height:100%; object-fit:cover; border-radius:10px; box-shadow:0 28px 80px rgba(0,0,0,.45),0 3px 14px rgba(0,0,0,.35); transform:scale(.88); transition:transform .65s cubic-bezier(.22,.8,.2,1),opacity .25s ease; }
.app.is-playing .cover { transform:scale(1); }
.cover-placeholder { width:100%; height:100%; border-radius:10px; display:grid; place-items:center; color:rgba(255,255,255,.25); background:linear-gradient(145deg,#38383b,#171719); }
.meta { width:min(100%,360px); display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:14px; }
.marquee { overflow:hidden; white-space:nowrap; }
.marquee-track { display:inline-flex; min-width:100%; gap:48px; }
.marquee.is-overflowing .marquee-track { animation:marquee 12s linear infinite; }
.marquee:not(.is-overflowing) .marquee-track { gap:0; }
.marquee:not(.is-overflowing) .title-b { display:none; }
.marquee-copy { font-size:20px; line-height:1.25; font-weight:720; }
@keyframes marquee { to { transform:translateX(calc(-50% - 24px)); } }
.subtitle { margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--muted); font-size:13px; }
.meta-actions { display:flex; gap:6px; }
.meta-actions .icon-btn { background:transparent; width:32px; height:32px; }
.meta-actions .favorite { color:#fff; }
.meta-actions .favorite.active { color:var(--accent); }
.seek { width:min(100%,360px); margin-top:33px; }
.range { --value:0%; appearance:none; width:100%; height:4px; border-radius:99px; outline:none; background:linear-gradient(to right,#fff var(--value),rgba(255,255,255,.23) var(--value)); cursor:pointer; }
.range::-webkit-slider-thumb { appearance:none; width:12px; height:12px; border-radius:50%; background:#fff; opacity:0; transition:opacity .15s ease,transform .15s ease; }
.range:hover::-webkit-slider-thumb,.range:focus-visible::-webkit-slider-thumb { opacity:1; }
.range::-moz-range-thumb { width:12px; height:12px; border:0; border-radius:50%; background:#fff; }
.times { display:flex; justify-content:space-between; margin-top:7px; color:rgba(255,255,255,.43); font-size:11px; font-variant-numeric:tabular-nums; }
.transport { width:min(100%,300px); height:66px; display:flex; justify-content:space-between; align-items:center; }
.transport button { width:48px; height:48px; display:grid; place-items:center; border:0; background:transparent; cursor:pointer; transition:transform .16s ease,opacity .16s ease; }
.transport button:hover { opacity:.72; }
.transport button:active { transform:scale(.86); }
.transport .play { width:64px; height:64px; }
.lower-controls { width:min(100%,302px); display:grid; grid-template-columns:36px 1fr 46px; gap:10px; align-items:center; }
.lower-controls .icon-btn { background:transparent; width:34px; height:34px; }
.volume-value { color:rgba(255,255,255,.54); font-size:11px; font-variant-numeric:tabular-nums; text-align:right; }
.volume { height:3px; }
.content { min-width:0; align-self:stretch; display:flex; flex-direction:column; overflow:hidden; padding:7vh 0 3vh; transform:translateY(-46px); }
.segment { width:302px; display:grid; grid-template-columns:42px repeat(3,minmax(0,1fr)); gap:2px; padding:3px; margin-top:12px; border-radius:8px; background:rgba(255,255,255,.09); backdrop-filter:blur(18px); }
.segment button { height:30px; min-width:0; padding:0 8px; border:0; border-radius:6px; display:flex; align-items:center; justify-content:center; gap:6px; background:transparent; color:rgba(255,255,255,.58); font-size:12px; font-weight:650; cursor:pointer; }
.segment .mode-button { padding:0; }
.segment .mode-button.active { color:var(--accent); }
.segment button.active { color:#fff; background:rgba(255,255,255,.15); box-shadow:0 1px 5px rgba(0,0,0,.18); }
.view { min-height:0; flex:1; position:relative; }
.lyrics,.comments,.queue { position:absolute; inset:0; overflow:auto; scrollbar-width:none; overscroll-behavior:contain; -webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 11%,#000 83%,transparent 100%); mask-image:linear-gradient(to bottom,transparent 0,#000 11%,#000 83%,transparent 100%); }
.lyrics::-webkit-scrollbar,.comments::-webkit-scrollbar,.queue::-webkit-scrollbar { display:none; }
.lyrics { padding:var(--align-pad-start,45vh) 5% var(--align-pad-end,55vh) 0; }
.lyric-line { width:100%; margin:0 0 calc(var(--line-gap,.5) * 1em); padding:0; border:0; background:transparent; color:rgba(255,255,255,.29); text-align:left; font-size:var(--lyric-size,40px); font-weight:750; line-height:var(--line-height,1.2); letter-spacing:0; cursor:pointer; transform-origin:left center; transition:color .28s ease,filter .35s ease,transform .35s cubic-bezier(.22,.75,.2,1),opacity .28s ease; }
.lyric-line:hover { color:rgba(255,255,255,.52); }
.lyric-line.active { color:#fff; filter:none!important; transform:scale(1)!important; opacity:1!important; }
.lyric-line.past { color:rgba(255,255,255,.45); }
.lyric-line .word { color:rgba(255,255,255,.32); background:linear-gradient(90deg,#fff var(--word-progress,0%),rgba(255,255,255,.32) var(--word-progress,0%)); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
.empty { height:100%; display:grid; place-items:center; color:rgba(255,255,255,.54); font-size:14px; }
.queue { inset:5% 2% 5% 0; padding:0 12px 18px; border:1px solid rgba(255,255,255,.13); border-radius:8px; background:rgba(22,22,24,.14); scrollbar-width:thin; scrollbar-color:rgba(255,255,255,.52) transparent; -webkit-mask-image:none; mask-image:none; }
.queue::-webkit-scrollbar { display:block; width:5px; }
.queue::-webkit-scrollbar-track { background:transparent; }
.queue::-webkit-scrollbar-thumb { border-radius:99px; background:rgba(255,255,255,.5); }
.queue-head { position:sticky; top:0; z-index:2; min-height:76px; display:flex; align-items:center; justify-content:space-between; gap:14px; padding:14px 5px 12px; background:linear-gradient(to bottom,rgba(21,21,23,.96) 0%,rgba(21,21,23,.82) 68%,transparent 100%); backdrop-filter:blur(14px); }
.queue-heading { min-width:0; display:grid; grid-template-columns:20px minmax(0,1fr); align-items:center; gap:9px; }
.queue-heading-icon { grid-row:1 / span 2; color:rgba(255,255,255,.72); }
.queue-head strong { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:16px; line-height:1.2; }
.queue-count { margin-left:3px; color:rgba(255,255,255,.42); font-size:12px; font-weight:600; }
.queue-source { margin-top:4px; color:rgba(255,255,255,.43); font-size:11px; }
.queue-head .icon-btn { flex:0 0 auto; width:32px; height:32px; background:transparent; color:rgba(255,255,255,.58); }
.queue-list { display:flex; flex-direction:column; gap:2px; }
.queue-row { width:100%; min-height:58px; display:grid; grid-template-columns:24px 42px minmax(0,1fr) auto; align-items:center; gap:10px; padding:6px 9px; border:1px solid transparent; border-radius:8px; background:transparent; text-align:left; cursor:pointer; transition:background .16s ease,border-color .16s ease; }
.queue-row:hover { background:rgba(255,255,255,.065); }
.queue-row.current { border-color:rgba(255,255,255,.035); background:rgba(255,255,255,.105); }
.queue-index { display:grid; width:24px; place-items:center; color:rgba(255,255,255,.36); font-size:12px; font-variant-numeric:tabular-nums; }
.queue-row.current .queue-index { color:rgba(255,255,255,.78); }
.queue-artwork { width:40px; height:40px; overflow:hidden; display:grid; place-items:center; border-radius:6px; color:rgba(255,255,255,.38); background:rgba(255,255,255,.08); }
.queue-artwork img { width:100%; height:100%; display:block; object-fit:cover; }
.queue-copy { min-width:0; }
.queue-title,.queue-sub { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.queue-title { color:rgba(255,255,255,.88); font-size:14px; line-height:1.2; font-weight:650; }
.queue-sub { margin-top:4px; color:rgba(255,255,255,.43); font-size:11px; }
.queue-time { padding-left:8px; color:rgba(255,255,255,.38); font-size:11px; font-variant-numeric:tabular-nums; }
.queue-row.current .queue-title { color:#fff; }
.queue .empty { min-height:220px; height:auto; }
.settings-panel { position:absolute; z-index:4; top:60px; right:24px; width:min(360px,calc(100% - 32px)); max-height:calc(100% - 84px); overflow:auto; padding:16px; border:1px solid rgba(255,255,255,.13); border-radius:8px; background:rgba(30,30,32,.82); box-shadow:0 24px 70px rgba(0,0,0,.42); backdrop-filter:blur(34px) saturate(1.25); }
.settings-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.settings-head strong { font-size:14px; }
.setting { padding:10px 0; border-top:1px solid rgba(255,255,255,.09); }
.setting:first-of-type { border-top:0; }
.setting-label { display:flex; justify-content:space-between; gap:12px; margin-bottom:8px; color:rgba(255,255,255,.83); font-size:12px; }
.setting output { color:var(--muted); font-variant-numeric:tabular-nums; }
.setting .range { height:3px; }
.choice { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; padding:3px; border-radius:7px; background:rgba(255,255,255,.08); }
.choice button { height:28px; border:0; border-radius:5px; background:transparent; color:var(--muted); font-size:11px; cursor:pointer; }
.choice button.active { color:#fff; background:rgba(255,255,255,.14); }
.toggle-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.toggle-row span { font-size:12px; }
.switch { position:relative; width:36px; height:21px; border:0; border-radius:99px; background:rgba(255,255,255,.18); cursor:pointer; transition:background .18s ease; }
.switch::after { content:""; position:absolute; top:3px; left:3px; width:15px; height:15px; border-radius:50%; background:#fff; transition:transform .2s cubic-bezier(.22,.75,.2,1); }
.switch.on { background:var(--accent); }
.switch.on::after { transform:translateX(15px); }
.settings-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px; }
.text-btn { height:34px; border:0; border-radius:6px; color:#fff; background:rgba(255,255,255,.1); font-size:12px; cursor:pointer; }
.text-btn:hover { background:rgba(255,255,255,.16); }
.hidden { display:none!important; }
@media (max-width:760px) {
  .app { min-height:600px; overflow-x:hidden; overflow-y:auto; }
  .chrome { position:relative; min-height:100%; padding:12px 14px 18px; }
  .main { grid-template-columns:1fr; gap:18px; align-items:start; }
  .player { padding-top:2px; transform:none; }
  .cover-wrap { width:min(48vw,210px); margin-bottom:14px; }
  .meta,.seek,.lower-controls { width:min(100%,480px); }
  .seek { margin-top:18px; }
  .transport { height:56px; }
  .transport .play { width:56px; height:56px; }
  .content { height:55vh; min-height:340px; padding:0; transform:none; }
  .segment { margin-top:12px; }
  .lyrics { padding-left:4%; padding-right:4%; }
  .lyric-line { font-size:min(var(--lyric-size,40px),30px); }
  .queue { inset:0 2% 0; }
  .settings-panel { position:fixed; top:auto; right:10px; bottom:10px; left:10px; width:auto; max-height:78vh; }
}
@media (max-height:820px) and (min-width:761px) {
  .player { transform:none; }
  .cover-wrap { width:min(43vh,310px); margin-bottom:34px; }
  .seek { margin-top:22px; }
  .transport { height:58px; }
  .segment { margin-top:8px; }
}
@media (max-height:680px) and (min-width:761px) {
  .chrome { padding-top:10px; padding-bottom:12px; }
  .topbar { height:34px; }
  .main { align-items:start; }
  .player { transform:none; }
  .cover-wrap { width:min(46vh,300px); margin-bottom:14px; }
  .seek { margin-top:10px; }
  .content { padding-top:2vh; padding-bottom:1vh; transform:none; }
  .transport { height:54px; }
}
@media (prefers-reduced-motion:reduce) { *,*::before,*::after { animation:none!important; scroll-behavior:auto!important; transition-duration:.01ms!important; } }
@media (prefers-reduced-transparency:reduce) { .backdrop { opacity:.18; } .segment,.settings-panel { backdrop-filter:none; background:#252527; } }
@media (prefers-contrast:more) { :host { --muted:rgba(255,255,255,.78); --line:rgba(255,255,255,.3); } .lyric-line { color:rgba(255,255,255,.55); } }
`;

let root;
let api;
let context = {};
let elements = {};
let playbackRequestSequence = 0;
let lastLoggedPlaybackState = null;
let lastPlaybackPointerRequestAt = -Infinity;
let activeView = 'lyrics';
let settingsOpen = false;
let linesKey = null;
let queueKey = null;
let coverKey = null;
let lastActiveIndex = -2;
let browsing = false;
let browseTimer;
let seeking = false;
let lyricResizeObserver;
let lyricLayoutTimers = [];
const lyricMotion = {
  frame: 0,
  position: 0,
  target: 0,
  velocity: 0,
  lastTime: 0,
  programmaticUntil: 0,
};

const config = () => ({ ...DEFAULT_CONFIG, ...(context.config || {}) });
const num = (key) => Number(config()[key]);
const bool = (key) => config()[key] !== false;
const post = (action, payload = {}, requestId) => api?.post?.(action, payload, requestId);
const escapeHtml = (value = '') => String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
const formatTime = (seconds) => {
  const value = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
};

function requestPlaybackToggle(trigger) {
  const requestId = `apple-music-playback-${Date.now()}-${++playbackRequestSequence}`;
  const observedPlaying = Boolean(context.isPlaying);
  console.log('[Apple Music 歌词][播放控制] 发起切换请求', {
    请求编号: requestId,
    触发方式: trigger,
    插件看到的播放状态: observedPlaying,
    预期播放状态: !observedPlaying,
    曲目编号: context.activeTrack?.id ?? null,
    歌曲名: context.activeTrack?.title ?? context.title ?? '',
  });
  post('togglePlayback', { observedPlaying, expectedPlaying: !observedPlaying }, requestId);
}

function button(label, iconName, className = 'icon-btn') {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.setAttribute('aria-label', label);
  node.title = label;
  node.innerHTML = svg(iconName);
  return node;
}

function createLayout() {
  root.innerHTML = `<style>${CSS}</style><div class="app">
    <div class="backdrop"></div><div class="grain"></div>
    <div class="chrome">
      <header class="topbar"><div data-slot="close"></div><div class="topbar-title">正在播放</div></header>
      <main class="main">
        <section class="player">
          <div class="cover-wrap"><img class="cover" alt="专辑封面"><div class="cover-placeholder">${svg('lyrics', 38)}</div></div>
          <div class="meta"><div><div class="marquee"><div class="marquee-track"><span class="marquee-copy title-a"></span><span class="marquee-copy title-b"></span></div></div><div class="subtitle"></div></div><div class="meta-actions"><div data-slot="favorite"></div><div data-slot="settings"></div></div></div>
          <div class="seek"><input class="range seek-range" type="range" min="0" step="0.01"><div class="times"><span class="elapsed">0:00</span><span class="remaining">0:00</span></div></div>
          <div class="transport"><div data-slot="previous"></div><div data-slot="play"></div><div data-slot="next"></div></div>
          <div class="lower-controls"><div data-slot="mute"></div><input class="range volume" type="range" min="0" max="100" step="1"><span class="volume-value">0%</span></div>
          <div class="segment" role="tablist"><div data-slot="mode"></div><button type="button" data-view="lyrics" class="active">${svg('lyrics', 14)}歌词</button><button type="button" data-view="comments">${svg('comments', 14)}评论</button><button type="button" data-view="queue">${svg('queue', 14)}队列</button></div>
        </section>
        <section class="content">
          <div class="view"><div class="lyrics"></div><div class="comments hidden"><div class="empty">当前歌曲暂无评论</div></div><div class="queue hidden"></div></div>
        </section>
      </main>
    </div><div class="settings-panel hidden"></div>
  </div>`;

  const app = root.querySelector('.app');
  elements = {
    app,
    backdrop: app.querySelector('.backdrop'), cover: app.querySelector('.cover'), coverPlaceholder: app.querySelector('.cover-placeholder'), coverWrap: app.querySelector('.cover-wrap'),
    marquee: app.querySelector('.marquee'), titleA: app.querySelector('.title-a'), titleB: app.querySelector('.title-b'), subtitle: app.querySelector('.subtitle'),
    seek: app.querySelector('.seek-range'), elapsed: app.querySelector('.elapsed'), remaining: app.querySelector('.remaining'), volume: app.querySelector('.volume'), volumeValue: app.querySelector('.volume-value'),
    lyrics: app.querySelector('.lyrics'), comments: app.querySelector('.comments'), queue: app.querySelector('.queue'), settingsPanel: app.querySelector('.settings-panel'),
    viewButtons: [...app.querySelectorAll('[data-view]')],
  };

  const close = button('关闭全屏歌词', 'chevronDown'); close.addEventListener('click', () => post('close'));
  const settings = button('歌词设置', 'settings'); settings.addEventListener('click', () => { settingsOpen = !settingsOpen; renderSettings(); });
  const favorite = button('收藏', 'heart', 'icon-btn favorite'); favorite.addEventListener('click', () => post('toggleFavorite'));
  const previous = button('上一首', 'previous', ''); previous.addEventListener('click', () => post('playPrevious'));
  const play = button('播放', 'play', 'play');
  play.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    console.log('[Apple Music 歌词][播放控制] 指针按下', {
      当前是否播放: Boolean(context.isPlaying),
      指针类型: event.pointerType,
      鼠标按键: event.button,
    });
    if (event.isPrimary === false || event.button !== 0) return;
    lastPlaybackPointerRequestAt = performance.now();
    requestPlaybackToggle('指针按下');
  });
  play.addEventListener('click', (event) => {
    event.stopPropagation();
    if (performance.now() - lastPlaybackPointerRequestAt < 1000) return;
    requestPlaybackToggle('键盘或辅助设备单击');
  });
  const next = button('下一首', 'next', ''); next.addEventListener('click', () => post('playNext'));
  const mute = button('静音', 'volume'); mute.addEventListener('click', () => post('toggleMute'));
  const mode = button('播放模式', 'repeat', 'mode-button'); mode.addEventListener('click', () => post('togglePlaybackMode'));
  for (const [slot, node] of Object.entries({ close, settings, favorite, previous, play, next, mute, mode })) app.querySelector(`[data-slot="${slot}"]`).replaceWith(node);
  Object.assign(elements, { close, settings, favorite, previous, play, next, mute, mode });

  elements.cover.addEventListener('error', () => {
    elements.cover.removeAttribute('src');
    elements.cover.classList.add('hidden');
    elements.coverPlaceholder.classList.remove('hidden');
    elements.backdrop.style.backgroundImage = '';
    post('coverError');
  });

  elements.seek.addEventListener('pointerdown', () => { seeking = true; });
  elements.seek.addEventListener('input', () => { elements.seek.style.setProperty('--value', `${(Number(elements.seek.value) / Math.max(Number(elements.seek.max), 1)) * 100}%`); elements.elapsed.textContent = formatTime(elements.seek.value); });
  elements.seek.addEventListener('change', () => { post('seekTime', { time: Number(elements.seek.value) }); seeking = false; });
  elements.seek.addEventListener('pointerup', () => { seeking = false; });
  elements.volume.addEventListener('input', () => { const value = Number(elements.volume.value); elements.volume.style.setProperty('--value', `${value}%`); post('setVolume', { value }); });
  elements.volume.addEventListener('wheel', (event) => { event.preventDefault(); const value = Math.min(100, Math.max(0, Number(elements.volume.value) + (event.deltaY < 0 ? 4 : -4))); elements.volume.value = String(value); elements.volume.dispatchEvent(new Event('input')); }, { passive: false });
  for (const tab of elements.viewButtons) tab.addEventListener('click', () => setView(tab.dataset.view));
  elements.lyrics.addEventListener('scroll', () => {
    if (performance.now() >= lyricMotion.programmaticUntil) suspendAutoScroll();
  }, { passive: true });
  elements.lyrics.addEventListener('wheel', suspendAutoScroll, { passive: true });
  elements.lyrics.addEventListener('pointerdown', suspendAutoScroll, { passive: true });
  lyricResizeObserver = new ResizeObserver(() => scheduleLyricLayoutRecalculation(true));
  lyricResizeObserver.observe(elements.lyrics);
}

function suspendAutoScroll() {
  stopLyricSpring();
  browsing = true;
  clearTimeout(browseTimer);
  browseTimer = setTimeout(() => { browsing = false; scrollToActive(true); }, 900);
}

function setView(view) {
  if (view !== 'lyrics') stopLyricSpring();
  activeView = view;
  elements.lyrics.classList.toggle('hidden', view !== 'lyrics');
  elements.comments.classList.toggle('hidden', view !== 'comments');
  elements.queue.classList.toggle('hidden', view !== 'queue');
  for (const tab of elements.viewButtons) tab.classList.toggle('active', tab.dataset.view === view);
  if (view === 'lyrics') requestAnimationFrame(() => scrollToActive(true));
  if (view === 'queue') requestAnimationFrame(() => locateCurrentQueueRow('auto'));
}

function updateConfig(patch, refreshSettings = false) {
  context.config = { ...(context.config || {}), ...patch };
  post('updateConfig', { config: context.config });
  applyConfig();
  if (Object.prototype.hasOwnProperty.call(patch, 'showWordProgress')) {
    linesKey = null;
    renderLines();
  }
  updateLyricState();
  if (Object.prototype.hasOwnProperty.call(patch, 'smoothScroll')) {
    scrollToActive(true, patch.smoothScroll === false);
  }
  if (['fontSize', 'lineHeight', 'lineGap', 'alignPosition'].some((key) => Object.prototype.hasOwnProperty.call(patch, key))) {
    scheduleLyricLayoutRecalculation(true);
  }
  if (refreshSettings) renderSettings();
}

function applyConfig() {
  const current = config();
  elements.app.dataset.background = current.backgroundMode;
  elements.app.style.setProperty('--bg-blur', `${Number(current.backgroundBlur)}px`);
  elements.app.style.setProperty('--lyric-size', `${Number(current.fontSize)}px`);
  elements.app.style.setProperty('--line-height', Number(current.lineHeight));
  elements.app.style.setProperty('--line-gap', Number(current.lineGap));
  elements.coverWrap.classList.toggle('hidden', current.showCover === false);
}

function settingRange(key, label, min, max, step, suffix = '') {
  const value = num(key);
  const row = document.createElement('div');
  row.className = 'setting';
  row.innerHTML = `<label class="setting-label"><span>${label}</span><output>${value}${suffix}</output></label><input class="range" type="range" min="${min}" max="${max}" step="${step}" value="${value}">`;
  const input = row.querySelector('input');
  input.style.setProperty('--value', `${((value - min) / (max - min)) * 100}%`);
  input.addEventListener('input', () => { const next = Number(input.value); row.querySelector('output').textContent = `${next}${suffix}`; input.style.setProperty('--value', `${((next - min) / (max - min)) * 100}%`); updateConfig({ [key]: next }); });
  return row;
}

function settingToggle(key, label) {
  const row = document.createElement('div');
  row.className = 'setting toggle-row';
  row.innerHTML = `<span>${label}</span><button type="button" class="switch ${bool(key) ? 'on' : ''}" role="switch" aria-checked="${bool(key)}" aria-label="${label}"></button>`;
  row.querySelector('button').addEventListener('click', () => updateConfig({ [key]: !bool(key) }, true));
  return row;
}

function renderSettings() {
  const panel = elements.settingsPanel;
  panel.classList.toggle('hidden', !settingsOpen);
  if (!settingsOpen) return;
  panel.innerHTML = `<div class="settings-head"><strong>歌词显示</strong><button class="icon-btn" type="button" aria-label="关闭设置">${svg('close', 18)}</button></div>`;
  panel.querySelector('button').addEventListener('click', () => { settingsOpen = false; renderSettings(); });
  panel.append(settingRange('fontSize', '字号', 24, 72, 1, ' px'));
  panel.append(settingRange('lineHeight', '行高', 1, 1.8, .05));
  panel.append(settingRange('lineGap', '行距', .2, 1.2, .05));
  panel.append(settingRange('alignPosition', '焦点位置', 25, 65, 1, '%'));
  panel.append(settingRange('backgroundBlur', '背景模糊', 0, 60, 2, ' px'));
  const background = document.createElement('div');
  background.className = 'setting';
  background.innerHTML = `<div class="setting-label"><span>背景效果</span></div><div class="choice"><button type="button" data-mode="dynamic">动态</button><button type="button" data-mode="static">静态</button><button type="button" data-mode="amll">流体</button></div>`;
  for (const choice of background.querySelectorAll('button')) { choice.classList.toggle('active', choice.dataset.mode === config().backgroundMode); choice.addEventListener('click', () => updateConfig({ backgroundMode: choice.dataset.mode }, true)); }
  panel.append(background);
  panel.append(settingToggle('showCover', '显示封面'));
  panel.append(settingToggle('enableBlur', '远处歌词模糊'));
  panel.append(settingToggle('enableScale', '歌词层次缩放'));
  panel.append(settingToggle('showWordProgress', '逐字进度'));
  panel.append(settingToggle('smoothScroll', 'AMLL 弹簧跟随'));
  const rate = document.createElement('div');
  rate.className = 'setting';
  rate.innerHTML = `<div class="setting-label"><span>播放速度</span><output>${Number(context.playbackRate || 1).toFixed(2)}×</output></div><input class="range" type="range" min="0.5" max="2" step="0.05" value="${Number(context.playbackRate || 1)}">`;
  const rateInput = rate.querySelector('input'); rateInput.style.setProperty('--value', `${((Number(rateInput.value) - .5) / 1.5) * 100}%`);
  rateInput.addEventListener('input', () => { const value = Number(rateInput.value); rate.querySelector('output').textContent = `${value.toFixed(2)}×`; rateInput.style.setProperty('--value', `${((value - .5) / 1.5) * 100}%`); post('setPlaybackRate', { value }); });
  panel.append(rate);
  const actions = document.createElement('div'); actions.className = 'settings-actions'; actions.innerHTML = '<button type="button" class="text-btn reset">恢复默认</button><button type="button" class="text-btn more">插件设置</button>';
  actions.querySelector('.reset').addEventListener('click', () => updateConfig({ ...DEFAULT_CONFIG }, true));
  actions.querySelector('.more').addEventListener('click', () => post('openSettings'));
  panel.append(actions);
}

function renderLines() {
  const lines = Array.isArray(context.lines) ? context.lines : [];
  const nextKey = `${context.isLoading ? 'loading' : 'ready'}|${context.loadingText || ''}|${context.emptyMessage || ''}|${lines.map((line) => `${line.time}:${line.text}:${(line.words || []).length}`).join('\u0001')}`;
  if (nextKey === linesKey) return;
  linesKey = nextKey;
  elements.lyrics.replaceChildren();
  if (!lines.length) {
    const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = context.isLoading ? (context.loadingText || '正在载入歌词…') : (context.emptyMessage || '暂无歌词'); elements.lyrics.append(empty); return;
  }
  lines.forEach((line, index) => {
    const node = document.createElement('button'); node.type = 'button'; node.className = 'lyric-line'; node.dataset.index = String(index); node.dataset.time = String(Number(line.time) || 0); node.setAttribute('aria-label', `${formatTime(line.time)} ${line.text || ''}`);
    if (bool('showWordProgress') && Array.isArray(line.words) && line.words.length) {
      for (const word of line.words) { const span = document.createElement('span'); span.className = 'word'; span.dataset.time = String(Number(word.time) || 0); span.dataset.duration = String(Number(word.duration) || 0); span.textContent = word.text || ''; node.append(span); }
    } else node.textContent = line.text || '';
    node.addEventListener('click', () => {
      clearTimeout(browseTimer);
      browsing = false;
      post('seekTime', { time: Number(line.time) || 0 });
      requestAnimationFrame(() => scrollToActive(true));
    });
    elements.lyrics.append(node);
  });
  lastActiveIndex = -2;
  scheduleLyricLayoutRecalculation(true);
}

function updateLyricState() {
  const nodes = [...elements.lyrics.querySelectorAll('.lyric-line')];
  const active = Number(context.activeLyricIndex ?? -1);
  nodes.forEach((node, index) => {
    const distance = Math.abs(index - active);
    node.classList.toggle('active', index === active);
    node.classList.toggle('past', index < active);
    node.style.filter = bool('enableBlur') && distance > 1 ? `blur(${Math.min(5, (distance - 1) * .75)}px)` : '';
    node.style.transform = bool('enableScale') && distance > 0 ? `scale(${Math.max(.88, 1 - distance * .018)})` : '';
    node.style.opacity = String(Math.max(.35, 1 - distance * .07));
  });
  if (active !== lastActiveIndex) {
    const firstLayout = lastActiveIndex === -2;
    lastActiveIndex = active;
    scrollToActive(false, firstLayout);
  }
  if (bool('showWordProgress')) updateWordProgress(nodes[active]);
}

function updateWordProgress(activeLine) {
  if (!activeLine) return;
  const currentTime = Number(context.currentTime) || 0;
  for (const word of activeLine.querySelectorAll('.word')) {
    const start = Number(word.dataset.time) || 0;
    const duration = Math.max(Number(word.dataset.duration) || 0, .001);
    const progress = Math.min(1, Math.max(0, (currentTime - start) / duration));
    word.style.setProperty('--word-progress', `${progress * 100}%`);
  }
}

function getActiveLyricScrollTarget() {
  updateLyricPadding();
  const target = elements.lyrics.querySelector('.lyric-line.active');
  if (!target) return null;
  const top = target.offsetTop - elements.lyrics.clientHeight * (num('alignPosition') / 100) + target.offsetHeight / 2;
  return Math.max(0, Math.min(top, elements.lyrics.scrollHeight - elements.lyrics.clientHeight));
}

function updateLyricPadding() {
  if (!elements.lyrics) return;
  const height = elements.lyrics.clientHeight;
  const ratio = num('alignPosition') / 100;
  elements.lyrics.style.setProperty('--align-pad-start', `${height * ratio}px`);
  elements.lyrics.style.setProperty('--align-pad-end', `${height * (1 - ratio)}px`);
}

function setLyricScrollPosition(position) {
  const next = Math.max(0, Math.min(position, elements.lyrics.scrollHeight - elements.lyrics.clientHeight));
  lyricMotion.position = next;
  lyricMotion.programmaticUntil = performance.now() + 80;
  elements.lyrics.scrollTop = next;
}

function stopLyricSpring() {
  if (lyricMotion.frame) cancelAnimationFrame(lyricMotion.frame);
  lyricMotion.frame = 0;
  lyricMotion.lastTime = 0;
  lyricMotion.position = elements.lyrics?.scrollTop || 0;
  lyricMotion.target = lyricMotion.position;
  lyricMotion.velocity = 0;
}

function stepLyricSpring(time) {
  if (!elements.lyrics || browsing) return stopLyricSpring();
  if (!lyricMotion.lastTime) lyricMotion.lastTime = time;
  const delta = Math.min((time - lyricMotion.lastTime) / 1000, 1 / 30);
  lyricMotion.lastTime = time;

  // Critically damped spring: quick response without the fixed timing of CSS smooth scrolling.
  const angularFrequency = (2 * Math.PI) / 0.46;
  const displacement = lyricMotion.position - lyricMotion.target;
  const acceleration = -(angularFrequency * angularFrequency * displacement) - (2 * angularFrequency * lyricMotion.velocity);
  lyricMotion.velocity += acceleration * delta;
  setLyricScrollPosition(lyricMotion.position + lyricMotion.velocity * delta);

  if (Math.abs(lyricMotion.target - lyricMotion.position) < 0.35 && Math.abs(lyricMotion.velocity) < 2) {
    setLyricScrollPosition(lyricMotion.target);
    lyricMotion.velocity = 0;
    lyricMotion.frame = 0;
    lyricMotion.lastTime = 0;
    return;
  }
  lyricMotion.frame = requestAnimationFrame(stepLyricSpring);
}

function scrollToActive(force = false, immediate = false) {
  if (browsing && !force) return;
  const target = getActiveLyricScrollTarget();
  if (target == null) return;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (immediate || !bool('smoothScroll') || reduceMotion) {
    stopLyricSpring();
    lyricMotion.target = target;
    setLyricScrollPosition(target);
    return;
  }

  lyricMotion.position = elements.lyrics.scrollTop;
  lyricMotion.target = target;
  if (!lyricMotion.frame) {
    lyricMotion.lastTime = 0;
    lyricMotion.frame = requestAnimationFrame(stepLyricSpring);
  }
}

function scheduleLyricLayoutRecalculation(immediate = false) {
  for (const timer of lyricLayoutTimers) clearTimeout(timer);
  lyricLayoutTimers = [0, 80, 180].map((delay) => setTimeout(() => {
    if (!elements.lyrics || activeView !== 'lyrics' || browsing) return;
    scrollToActive(true, immediate);
  }, delay));
}

function trackArtist(track) {
  if (Array.isArray(track?.artist)) return track.artist.join(' / ');
  return String(track?.artist || '');
}

function trackArtwork(track) {
  return track?.associatedArtwork || track?.artwork || '';
}

function trackArtworkDisplayUrl(track) {
  const artwork = String(trackArtwork(track) || '').trim();
  if (!artwork.toLowerCase().startsWith('file:///')) return artwork;
  return `http://asset.localhost/${encodeURIComponent(artwork.replace(/^file:\/\/\//i, ''))}`;
}

function renderQueue() {
  const queue = Array.isArray(context.queueTracks) ? context.queueTracks : [];
  const activeTrackId = context.activeTrack?.id ?? null;
  const nextKey = `${activeTrackId || ''}|${context.isPlaying ? 'playing' : 'paused'}|${queue.map((item) => `${item.id}:${item.title}:${trackArtist(item)}:${item.album}:${item.duration}:${trackArtworkDisplayUrl(item)}`).join('\u0001')}`;
  if (nextKey === queueKey) return;
  queueKey = nextKey;
  elements.queue.replaceChildren();
  const head = document.createElement('div'); head.className = 'queue-head'; head.innerHTML = `<div class="queue-heading"><span class="queue-heading-icon">${svg('queue', 18)}</span><strong>播放队列 <span class="queue-count">(${queue.length})</span></strong><span class="queue-source">按当前播放顺序排列</span></div><button type="button" class="icon-btn" aria-label="定位当前歌曲" title="定位当前歌曲">${svg('locate', 17)}</button>`;
  head.querySelector('button').addEventListener('click', () => locateCurrentQueueRow('smooth')); elements.queue.append(head);
  if (!queue.length) { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '播放队列为空'; elements.queue.append(empty); return; }
  const list = document.createElement('div'); list.className = 'queue-list'; elements.queue.append(list);
  queue.forEach((item, index) => {
    const isCurrent = String(item.id) === String(activeTrackId);
    const artist = trackArtist(item);
    const artworkUrl = trackArtworkDisplayUrl(item);
    const artwork = artworkUrl ? `<img src="${escapeHtml(artworkUrl)}" alt="">` : svg('lyrics', 16);
    const row = document.createElement('button'); row.type = 'button'; row.className = `queue-row${isCurrent ? ' current' : ''}`; row.setAttribute('aria-label', `${index + 1}. ${item.title || '未知歌曲'} ${artist} ${formatTime(item.duration)}`); row.innerHTML = `<span class="queue-index">${isCurrent ? svg(context.isPlaying ? 'pause' : 'play', 13, true) : index + 1}</span><span class="queue-artwork">${artwork}</span><span class="queue-copy"><span class="queue-title">${escapeHtml(item.title || '未知歌曲')}</span><span class="queue-sub">${escapeHtml([artist, item.album].filter(Boolean).join(' · '))}</span></span><span class="queue-time">${formatTime(item.duration)}</span>`;
    row.querySelector('.queue-artwork img')?.addEventListener('error', (event) => {
      const artworkNode = event.currentTarget.parentElement;
      event.currentTarget.remove();
      if (artworkNode) artworkNode.innerHTML = svg('lyrics', 16);
    }, { once: true });
    row.addEventListener('click', () => post('playQueueTrack', { index })); list.append(row);
  });
  if (activeView === 'queue') requestAnimationFrame(() => locateCurrentQueueRow('auto'));
}

function locateCurrentQueueRow(behavior = 'smooth') {
  const row = elements.queue?.querySelector('.queue-row.current');
  if (!row) return;
  const top = row.offsetTop - elements.queue.clientHeight / 2 + row.offsetHeight / 2;
  elements.queue.scrollTo({ top: Math.max(0, top), behavior });
}

function updateTransport() {
  const nextPlaying = Boolean(context.isPlaying);
  if (lastLoggedPlaybackState !== nextPlaying) {
    console.log('[Apple Music 歌词][播放控制] 状态更新', {
      更新前是否播放: lastLoggedPlaybackState,
      当前是否播放: nextPlaying,
      曲目编号: context.activeTrack?.id ?? null,
      歌曲名: context.activeTrack?.title ?? context.title ?? '',
    });
    lastLoggedPlaybackState = nextPlaying;
  }
  const duration = Math.max(0, Number(context.duration) || 0);
  const currentTime = Math.min(duration || Infinity, Math.max(0, Number(context.currentTime) || 0));
  if (!seeking) { elements.seek.max = String(duration || 1); elements.seek.value = String(currentTime); elements.seek.style.setProperty('--value', `${duration ? (currentTime / duration) * 100 : 0}%`); elements.elapsed.textContent = formatTime(currentTime); }
  elements.remaining.textContent = formatTime(duration);
  elements.play.innerHTML = svg(context.isPlaying ? 'pause' : 'play', 32, true); elements.play.setAttribute('aria-label', context.isPlaying ? '暂停' : '播放'); elements.play.title = context.isPlaying ? '暂停' : '播放';
  elements.app.classList.toggle('is-playing', Boolean(context.isPlaying));
  elements.favorite.classList.toggle('active', Boolean(context.isFavorite)); elements.favorite.innerHTML = svg('heart', 20, Boolean(context.isFavorite));
  const volume = Math.max(0, Math.min(100, Number(context.volume) || 0)); elements.volume.value = String(volume); elements.volume.style.setProperty('--value', `${volume}%`); elements.volumeValue.textContent = `${Math.round(volume)}%`; const muted = Boolean(context.isMuted) || volume === 0; elements.mute.innerHTML = svg(muted ? 'muted' : 'volume'); elements.mute.setAttribute('aria-label', muted ? '取消静音' : '静音');
  const mode = context.playbackMode || 'repeat'; const iconName = mode === 'shuffle' ? 'shuffle' : mode === 'fixed' ? 'repeatOne' : 'repeat'; elements.mode.innerHTML = svg(iconName); elements.mode.classList.toggle('active', mode !== 'repeat'); elements.mode.title = context.playbackModeLabel || '播放模式'; elements.mode.setAttribute('aria-label', elements.mode.title);
}

function renderMeta() {
  const activeTrack = context.activeTrack || null;
  const title = activeTrack?.title || context.title || '未在播放';
  elements.titleA.textContent = title; elements.titleB.textContent = title;
  const artist = trackArtist(activeTrack) || context.artist || '未知艺术家'; const album = activeTrack?.album || context.album || ''; elements.subtitle.textContent = [artist, album].filter(Boolean).join(' · '); elements.subtitle.title = elements.subtitle.textContent;
  const cover = context.coverUrl || trackArtworkDisplayUrl(activeTrack) || '';
  const nextCoverKey = `${activeTrack?.id ?? ''}:${cover}`;
  if (nextCoverKey !== coverKey) {
    coverKey = nextCoverKey;
    console.info('[Apple Music Lyrics] cover URL', {
      trackId: activeTrack?.id ?? null,
      title: activeTrack?.title || '',
      coverUrl: cover || null,
    });
    if (cover) {
      elements.cover.src = cover;
      elements.cover.classList.remove('hidden');
      elements.coverPlaceholder.classList.add('hidden');
      elements.backdrop.style.backgroundImage = `url(${JSON.stringify(cover)})`;
    } else {
      elements.cover.removeAttribute('src');
      elements.cover.classList.add('hidden');
      elements.coverPlaceholder.classList.remove('hidden');
      elements.backdrop.style.backgroundImage = '';
    }
  }
  requestAnimationFrame(() => elements.marquee.classList.toggle('is-overflowing', elements.titleA.scrollWidth > elements.marquee.clientWidth));
}

function render(nextContext = {}) {
  context = { ...context, ...nextContext, config: { ...(context.config || {}), ...(nextContext.config || {}) } };
  applyConfig(); renderMeta(); renderLines(); updateLyricState(); renderQueue(); updateTransport();
}

export default {
  mount(target, initialContext, rendererApi) { root = target; api = rendererApi; context = initialContext || {}; createLayout(); render(context); },
  update(nextContext) { render(nextContext); },
  destroy() {
    clearTimeout(browseTimer);
    for (const timer of lyricLayoutTimers) clearTimeout(timer);
    lyricLayoutTimers = [];
    lyricResizeObserver?.disconnect();
    lyricResizeObserver = undefined;
    stopLyricSpring();
    root?.replaceChildren();
    root = null;
    api = null;
    context = {};
    elements = {};
    linesKey = null;
    queueKey = null;
    coverKey = null;
    lastActiveIndex = -2;
  },
};
