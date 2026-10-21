/*! Fan Lyrics for Mono — GPL-3.0-only. See LICENSE and NOTICE.md. */

// ../../betterlyrics/ui/src/state.mjs
var defaults = {
  verticalOffset: 0,
  fontSize: 40,
  lineGap: 0.55,
  alignment: "left",
  backgroundMode: "fluid",
  blur: true,
  glow: true,
  float: true,
  scale: true,
  showCover: true,
  lyricStyle: "standard",
  fanAngle: 30,
  tiltAngle: 25,
  glowAmount: 8,
  floatAmount: 8,
  glowScope: "long"
};
var clamp = (value, min, max) => Math.min(max, Math.max(min, value));
function configWithDefaults(config = {}) {
  const result = { ...defaults, ...config };
  result.fontSize = clamp(Number(result.fontSize) || 40, 20, 72);
  result.lineGap = clamp(Number(result.lineGap) || 0, 0, 1.5);
  for (const [key, min, max] of [["verticalOffset", 0, 60], ["fanAngle", -45, 45], ["tiltAngle", -45, 45], ["glowAmount", 0, 24], ["floatAmount", 0, 16]]) {
    result[key] = clamp(Number.isFinite(Number(result[key])) ? Number(result[key]) : defaults[key], min, max);
  }
  if (!["standard", "glow", "fan", "vertical", "perspective"].includes(result.lyricStyle)) result.lyricStyle = "standard";
  return result;
}
function createState() {
  return {
    trackKey: "",
    track: null,
    lines: [],
    lyricsSignature: null,
    queue: [],
    config: { ...defaults },
    background: {},
    playback: { currentTime: 0, isPlaying: false, volume: 100, playbackRate: 1 },
    ui: { lyricTimeOffset: 0, isLoading: false, emptyMessage: "\u6682\u65E0\u6B4C\u8BCD", loadingText: "\u6B63\u5728\u52A0\u8F7D\u6B4C\u8BCD\u2026" },
    clockAt: 0,
    clockCorrection: 0
  };
}
function applyMessage(state, message, now) {
  switch (message.type) {
    case "track": {
      const changed = message.trackKey !== state.trackKey;
      const incoming = message.activeTrack;
      const keepArtwork = !changed && incoming && state.track && incoming.coverVersion === state.track.coverVersion && incoming.artwork === state.track.artwork && incoming.associatedArtwork === state.track.associatedArtwork;
      state.track = incoming ? {
        ...incoming,
        artworkDataUrl: incoming.artworkDataUrl || (keepArtwork ? state.track.artworkDataUrl : void 0)
      } : null;
      state.trackKey = message.trackKey;
      if (changed || !incoming) {
        state.lines = [];
        state.lyricsSignature = null;
        state.playback = { ...state.playback, currentTime: 0, isPlaying: false };
        state.ui = { ...state.ui, activeLyricIndex: -1, isLoading: Boolean(incoming) };
        state.clockAt = now;
        state.clockCorrection = 0;
      }
      return changed || !incoming ? "track-change" : "track";
    }
    case "lyrics": {
      if (message.trackKey !== state.trackKey) return false;
      const lines = message.lines || [];
      const signature = JSON.stringify(lines);
      state.ui.isLoading = false;
      if (signature === state.lyricsSignature) return "lyrics-status";
      state.lines = lines;
      state.lyricsSignature = signature;
      break;
    }
    case "playback": {
      const predicted = playbackTime(state, now);
      const next = { ...state.playback, currentTime: predicted, ...message.playback };
      const difference = predicted - next.currentTime;
      state.clockCorrection = state.playback.isPlaying && next.isPlaying && Math.abs(difference) <= 0.2 * Math.min(state.playback.playbackRate || 1, next.playbackRate || 1) ? difference : 0;
      state.playback = next;
      state.clockAt = now;
      break;
    }
    case "lyrics-ui":
      state.ui = { ...state.ui, ...message.lyricsUi };
      break;
    case "config":
      state.config = configWithDefaults(message.config);
      break;
    case "background":
      state.background = message.background || {};
      break;
    case "queue":
      state.queue = message.queueTracks || [];
      break;
    default:
      return false;
  }
  return message.type;
}
function playbackTime(state, now) {
  const { currentTime, isPlaying, playbackRate } = state.playback;
  const elapsed = isPlaying ? clamp((now - state.clockAt) / 1e3, 0, 1.5) * (playbackRate || 1) : 0;
  const correction = isPlaying ? state.clockCorrection * Math.max(0, 1 - (now - state.clockAt) / 500) : 0;
  return clamp((currentTime || 0) + elapsed + correction, 0, state.track?.duration || Infinity);
}
var lyricTime = (state, now) => playbackTime(state, now) + (state.ui.lyricTimeOffset || 0);
function activeLine(lines, time) {
  let index = -1;
  for (let i = 0; i < lines.length; i++) {
    if (Number.isFinite(lines[i].time) && lines[i].time <= time) index = i;
  }
  return index;
}
function wordProgress(words, index, time, lineEnd) {
  const word = words[index];
  const duration = Number.isFinite(word.duration) && word.duration >= 0 ? word.duration : Math.max(0, (words[index + 1]?.time ?? lineEnd ?? word.time + 1) - word.time);
  return { duration, progress: duration > 0 ? clamp((time - word.time) / duration, 0, 1) : Number(time >= word.time) };
}
var artistName = (track) => Array.isArray(track?.artist) ? track.artist.join(" / ") : track?.artist || "";
var artwork = (track) => track?.artworkDataUrl || track?.associatedArtwork || track?.artwork || "";
function formatTime(time) {
  const seconds = Math.max(0, Math.floor(time || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// ../../betterlyrics/ui/src/utils/rendererProfile.mjs
var fanSettingKeys = ["fontSize", "fanAngle", "lineGap", "blur", "scale", "showCover"];
function rendererConfig(config, fanOnly = false) {
  const result = configWithDefaults(config);
  if (fanOnly) Object.assign(result, { lyricStyle: "fan", alignment: "left", backgroundMode: "fluid", glow: false, float: false });
  else if (result.lyricStyle === "fan") result.lyricStyle = "standard";
  return result;
}

// ../../betterlyrics/ui/src/components/page.mjs
var paths = {
  play: '<path d="m9 5 11 7-11 7Z"/>',
  pause: '<path d="M9 5v14M16 5v14"/>',
  previous: '<path d="M5 5v14m14-14L8 12l11 7Z"/>',
  next: '<path d="M19 5v14M5 5l11 7-11 7Z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  queue: '<path d="M4 5h16M4 12h16M4 19h10"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  volume: '<path d="m11 5-6 4H2v6h3l6 4Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  note: '<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>'
};
var icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.note}</svg>`;
var button = (name, label, action = name) => `<button type="button" class="icon-button" data-action="${action}" title="${label}" aria-label="${label}">${icon(name)}</button>`;
function createPage(root, css) {
  root.innerHTML = `<style>${css}</style><main class="betterlyrics" tabindex="-1">
    <div class="background" aria-hidden="true"><div class="wash"></div><div class="wash wash-two"></div><video muted loop playsinline></video><div class="shade"></div></div>
    <header class="topbar"><span>BetterLyrics</span></header>
    <div class="stage"><section class="record" aria-label="\u6B63\u5728\u64AD\u653E"><div class="artwork"><div class="cover-placeholder">${icon("note")}</div><img class="cover" alt="\u4E13\u8F91\u5C01\u9762" hidden></div><div class="metadata"><h1>\u672A\u5728\u64AD\u653E</h1><p class="artist"></p><p class="album"></p></div></section>
    <section class="lyrics-area" aria-label="\u6B4C\u8BCD"><div class="lyrics-scroll" tabindex="0" aria-label="\u6B4C\u8BCD\uFF0C\u70B9\u51FB\u5DF2\u540C\u6B65\u7684\u884C\u8DF3\u8F6C"></div><div class="empty" role="status"></div><button class="return-live" hidden>\u56DE\u5230\u5F53\u524D\u6B4C\u8BCD</button></section></div>
    <footer class="controls"><div class="timeline"><time class="elapsed">0:00</time><input class="seek" type="range" min="0" max="0" step="0.1" value="0" aria-label="\u64AD\u653E\u8FDB\u5EA6"><time class="duration">0:00</time></div><div class="control-row"><div class="control-left">${button("heart", "\u6536\u85CF", "toggleFavorite")}${button("search", "\u641C\u7D22\u6B4C\u8BCD", "openSearch")}<span class="offset"></span></div><div class="transport">${button("previous", "\u4E0A\u4E00\u66F2", "playPrevious")}${button("play", "\u64AD\u653E", "togglePlayback")}${button("next", "\u4E0B\u4E00\u66F2", "playNext")}</div><div class="control-right">${button("volume", "\u9759\u97F3", "toggleMute")}<input class="volume" type="range" min="0" max="100" value="100" aria-label="\u97F3\u91CF">${button("queue", "\u64AD\u653E\u961F\u5217")}${button("settings", "\u663E\u793A\u8BBE\u7F6E")}</div></div></footer>
    <aside class="panel" hidden aria-label="\u663E\u793A\u8BBE\u7F6E"><div class="panel-heading"><h2>\u663E\u793A\u8BBE\u7F6E</h2><button data-action="dismiss" aria-label="\u5173\u95ED\u9762\u677F">\xD7</button></div><div class="settings-content"></div></aside>
    <aside class="queue-panel panel" hidden aria-label="\u64AD\u653E\u961F\u5217"><div class="panel-heading"><h2>\u64AD\u653E\u961F\u5217</h2><button data-action="dismiss" aria-label="\u5173\u95ED\u9762\u677F">\xD7</button></div><div class="queue-list"></div></aside>
  </main>`;
  const app = root.querySelector(".betterlyrics");
  const get = (selector) => app.querySelector(selector);
  return {
    app,
    get,
    scroll: get(".lyrics-scroll"),
    empty: get(".empty"),
    cover: get(".cover"),
    seek: get(".seek"),
    volume: get(".volume"),
    panel: get(".panel"),
    queuePanel: get(".queue-panel")
  };
}
function createSettings(container, fanOnly = false) {
  container.innerHTML = `<p class="word-timing-note" hidden></p><button class="style-reset" data-action="resetStyle" hidden>\u6062\u590D\u6B64\u6837\u5F0F\u9ED8\u8BA4\u6548\u679C</button><label>\u5B57\u53F7 <input data-config="fontSize" type="range" min="20" max="72" step="1"></label>
    <label>\u6B4C\u8BCD\u6837\u5F0F <select data-config="lyricStyle"><option value="standard">\u6807\u51C6</option><option value="glow">\u8F89\u5149\u4E0A\u6D6E</option><option value="fan">\u6247\u5F62\u6B4C\u8BCD</option><option value="vertical">\u7AD6\u6392\u6B4C\u8BCD</option><option value="perspective">3D \u900F\u89C6</option></select></label>
    <label>\u6247\u5F62\u89D2\u5EA6 <input data-config="fanAngle" type="range" min="-45" max="45" step="1"></label>
    <label>\u900F\u89C6\u89D2\u5EA6 <input data-config="tiltAngle" type="range" min="-45" max="45" step="1"></label>
    <label>\u8F89\u5149\u5F3A\u5EA6 <input data-config="glowAmount" type="range" min="0" max="24" step="1"></label>
    <label>\u4E0A\u6D6E\u5E45\u5EA6 <input data-config="floatAmount" type="range" min="0" max="16" step="1"></label>
    <label>\u8F89\u5149\u8303\u56F4 <select data-config="glowScope"><option value="long">\u4EC5\u957F\u97F3</option><option value="all">\u884C\u9996\u5230\u5F53\u524D\u5B57</option></select></label>
    <label data-vertical-setting hidden>\u4E0A\u4E0B\u4F4D\u7F6E <input data-config="verticalOffset" type="range" min="0" max="60" step="1"></label>
    <label>\u884C\u95F4\u8DDD <input data-config="lineGap" type="range" min="0" max="1.5" step="0.05"></label>
    <label>\u5BF9\u9F50 <select data-config="alignment"><option value="left">\u5DE6\u5BF9\u9F50</option><option value="center">\u5C45\u4E2D</option></select></label>
    <label>\u80CC\u666F <select data-config="backgroundMode"><option value="fluid">\u5C01\u9762\u6D41\u52A8</option><option value="blur">\u5C01\u9762\u6A21\u7CCA</option><option value="host">\u8DDF\u968F\u64AD\u653E\u5668</option></select></label>
    ${[["blur", "\u8FDC\u5904\u6B4C\u8BCD\u6A21\u7CCA"], ["glow", "\u9010\u5B57\u8F89\u5149"], ["float", "\u9010\u5B57\u6D6E\u52A8"], ["scale", "\u6B4C\u8BCD\u7F29\u653E"], ["showCover", "\u663E\u793A\u5C01\u9762"]].map(([key, label]) => `<label>${label}<input type="checkbox" data-config="${key}"></label>`).join("")}
    <div class="timing"><span>\u6B4C\u8BCD\u540C\u6B65</span><button data-action="earlier" title="\u6B4C\u8BCD\u63D0\u524D 0.5 \u79D2">\u22120.5 s</button><button data-action="later" title="\u6B4C\u8BCD\u5EF6\u540E 0.5 \u79D2">+0.5 s</button></div>`;
  for (const input of container.querySelectorAll("[data-config]")) {
    if (fanOnly ? !fanSettingKeys.includes(input.dataset.config) : input.dataset.config === "fanAngle") input.closest("label").remove();
  }
  if (fanOnly) {
    container.querySelector('[data-config="scale"]').closest("label").firstChild.textContent = "\u8FDC\u5904\u6B4C\u8BCD\u7F29\u653E";
    container.querySelector('[data-action="resetStyle"]').textContent = "\u6062\u590D\u6247\u5F62\u9ED8\u8BA4\u8BBE\u7F6E";
  }
  if (!fanOnly) container.querySelector('option[value="fan"]').remove();
}

// ../../betterlyrics/ui/src/utils/lyricEffects.mjs
function lineDistance(offset, viewportSize, focus = 0.45) {
  return clamp(offset / Math.max(1, viewportSize * (offset < 0 ? focus : 1 - focus)), -1, 1);
}
function lineTransform(distance, config, reducedMotion = false) {
  if (reducedMotion) return "none";
  const scale = config.scale ? 1 - Math.min(1, Math.abs(distance)) * 0.25 : 1;
  if (config.lyricStyle === "perspective") {
    return `perspective(800px) rotateY(${config.tiltAngle}deg) rotateX(${clamp(distance * 6, -24, 24)}deg) translateZ(${-Math.abs(distance) * 28}px) scale(${scale})`;
  }
  return `scale(${scale})`;
}
function fanClearance(height, angle) {
  return height * (1 / Math.cos(Math.abs(angle) * Math.PI / 180) - 1);
}
function fanPosition(offset, viewportHeight, maxAngle) {
  if (!maxAngle) return { x: 0, angle: 0, radius: Infinity };
  const radius = Math.max(1, viewportHeight * 0.55) / Math.sin(Math.abs(maxAngle) * Math.PI / 180);
  const theta = Math.asin(clamp(offset / radius, -1, 1));
  const direction = Math.sign(maxAngle);
  return { x: direction * radius * (Math.cos(theta) - 1), angle: direction * theta * 180 / Math.PI, radius };
}
function fanTransform(offset, viewportHeight, config, reducedMotion = false) {
  if (reducedMotion) return "none";
  const { x, angle } = fanPosition(offset, viewportHeight, config.fanAngle);
  const scale = config.scale ? 1 - Math.min(1, Math.abs(offset) / Math.max(1, viewportHeight * 0.55)) * 0.25 : 1;
  return `translateX(${x}px) rotate(${angle}deg) scale(${scale})`;
}
var sineOut = (value) => Math.sin(clamp(value, 0, 1) * Math.PI / 2);
function wordEffect(elapsed, duration, config, reducedMotion = false, timing = {}) {
  const { lineElapsed = elapsed, lineDuration = duration + 0.35, charElapsed = elapsed } = timing;
  const available = Math.max(0, lineDuration - (lineElapsed - elapsed));
  let rise = Math.min(duration, available), fall = Math.min(0.35, Math.max(0, available - rise));
  if (!fall) {
    fall = rise / 3;
    rise *= 2 / 3;
  }
  const envelope = elapsed < 0 || rise <= 0 ? 0 : elapsed < rise ? sineOut(elapsed / rise) : fall > 0 ? 1 - sineOut((elapsed - rise) / fall) : 0;
  const fade = Math.min(0.175, lineDuration / 2);
  const lineGlow = fade > 0 ? sineOut(lineElapsed / fade) * (1 - sineOut((lineElapsed - lineDuration + fade) / fade)) : 0;
  const sunk = sineOut(Math.max(0, lineElapsed - Math.max(0, charElapsed)) / 0.65);
  return {
    lift: reducedMotion || !config.float ? 0 : config.floatAmount * sunk * (1 - sineOut(Math.max(0, charElapsed) / 0.45)),
    scale: reducedMotion || config.lyricStyle === "fan" || !config.scale || duration < 0.7 ? 1 : 1 + 0.15 * envelope,
    glow: !config.glow ? 0 : config.glowAmount * (config.glowScope === "all" ? lineGlow : duration >= 0.7 ? envelope : 0)
  };
}

// ../../betterlyrics/ui/src/utils/stylePresets.mjs
function stylePreset(style) {
  if (style !== "glow" && style !== "fan") return {};
  return {
    blur: true,
    scale: true,
    glow: true,
    float: true,
    lineGap: 0.55,
    alignment: style === "glow" ? "center" : "left",
    fanAngle: 30,
    glowScope: "long",
    glowAmount: 8,
    floatAmount: 8
  };
}
function hasWordTiming(lines) {
  return lines.some((line) => line.words?.some((word) => word.text?.trim() && Number.isFinite(word.time)));
}

// ../../betterlyrics/ui/src/components/lyrics.mjs
function createLyricsView(elements, state, mono, signal) {
  const { scroll, empty, get } = elements;
  const returnButton = get(".return-live");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let rows = [], active = -2, browseUntil = 0, movement = null, visualKey = "";
  function browse() {
    if (!state.lines.some((line) => Number.isFinite(line.time))) return;
    browseUntil = performance.now() + (state.config.lyricStyle === "fan" ? 2e3 : 4e3);
    movement = null;
    scroll.classList.add("browsing");
    returnButton.hidden = state.config.lyricStyle === "fan";
  }
  function restore() {
    browseUntil = 0;
    scroll.classList.remove("browsing");
    returnButton.hidden = true;
    center();
  }
  scroll.addEventListener("wheel", (event) => {
    browse();
    if (state.config.lyricStyle === "vertical") {
      event.preventDefault();
      scroll.scrollLeft += (event.deltaX || event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroll.clientWidth : 1);
    }
  }, { passive: false, signal });
  scroll.addEventListener("touchstart", browse, { passive: true, signal });
  scroll.addEventListener("touchmove", browse, { passive: true, signal });
  scroll.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) browse();
  }, { signal });
  scroll.addEventListener("click", (event) => {
    const row = event.target.closest("[data-line]");
    if (!row || row.disabled) return;
    mono.player.seek(Math.max(0, state.lines[Number(row.dataset.line)].time - (state.ui.lyricTimeOffset || 0)));
    restore();
  }, { signal });
  returnButton.addEventListener("click", restore, { signal });
  function center(immediate = false) {
    if (browseUntil || !rows.length || !state.lines.some((line) => Number.isFinite(line.time))) return;
    const row = rows[Math.max(0, active)]?.node;
    if (!row) return;
    const vertical = state.config.lyricStyle === "vertical";
    const axis = vertical ? "scrollLeft" : "scrollTop";
    const target = Math.max(0, vertical ? row.offsetLeft - scroll.clientWidth * 0.5 + row.offsetWidth / 2 : row.offsetTop - scroll.clientHeight * 0.45 + row.offsetHeight / 2);
    if (immediate || reducedMotion.matches) {
      scroll[axis] = target;
      movement = null;
    } else movement = { from: scroll[axis], to: target, axis, at: performance.now() };
  }
  function paintBounds() {
    for (const { node } of rows) node.style.setProperty("--fan-clearance", `${fanClearance(node.offsetHeight, state.config.fanAngle)}px`);
    const width = get(".lyrics-area").clientWidth;
    const maxHeight = rows.reduce((height, row) => Math.max(height, row.node.offsetHeight), 0);
    const arcInset = get(".lyrics-area").clientHeight * 0.55 * Math.tan(Math.abs(state.config.fanAngle) * Math.PI / 360);
    scroll.style.setProperty("--fan-gutter", `${Math.max(width * 0.25, arcInset) + maxHeight * 0.5 + 12}px`);
    const area = get(".lyrics-area"), artwork2 = get(".artwork");
    const radius = fanPosition(0, area.clientHeight, Math.max(10, Math.abs(state.config.fanAngle))).radius;
    const focusY = area.getBoundingClientRect().top - artwork2.getBoundingClientRect().top + area.clientHeight * 0.45;
    artwork2.style.setProperty("--cover-radius", `${radius}px`);
    artwork2.style.setProperty("--cover-center-x", `${artwork2.clientWidth - 24 - radius}px`);
    artwork2.style.setProperty("--cover-center-y", `${focusY}px`);
  }
  function layout() {
    const area = get(".lyrics-area");
    scroll.style.setProperty("--pad", `${area.clientHeight * 0.5}px`);
    scroll.style.setProperty("--pad-x", `${area.clientWidth * 0.5}px`);
    paintBounds();
    center(true);
    active = -2;
  }
  const observer = new ResizeObserver(layout);
  observer.observe(get(".lyrics-area"));
  function render() {
    movement = null;
    browseUntil = 0;
    active = -2;
    scroll.classList.remove("browsing");
    returnButton.hidden = true;
    const fragment = document.createDocumentFragment();
    rows = state.lines.map((line, index) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "lyric-line";
      node.dataset.line = String(index);
      node.classList.toggle("line-timed", !line.words?.length);
      node.setAttribute("aria-label", line.text || "\u95F4\u594F");
      node.disabled = !Number.isFinite(line.time);
      const words = [];
      if (line.words?.length) {
        for (const word of line.words) {
          const span = document.createElement("span");
          span.className = "word";
          span.setAttribute("aria-hidden", "true");
          for (const text of Array.from(word.text)) {
            const char = document.createElement("span");
            char.className = "lyric-char";
            char.textContent = text;
            char.dataset.text = text;
            span.append(char);
          }
          node.append(span);
          words.push(span);
        }
      } else {
        const [primary, ...secondary] = String(line.text || "\u266A").split("\n");
        node.append(document.createTextNode(primary));
        if (secondary.length) {
          const translation = document.createElement("span");
          translation.className = "translation";
          translation.textContent = secondary.join("\n");
          node.append(translation);
        }
      }
      fragment.append(node);
      const divider = document.createElement("span");
      divider.className = "vertical-divider";
      divider.setAttribute("aria-hidden", "true");
      fragment.append(divider);
      return { node, words, divider };
    });
    scroll.replaceChildren(fragment);
    scroll.scrollTop = 0;
    scroll.classList.toggle("unsynced", state.lines.length > 0 && state.lines.every((line) => !Number.isFinite(line.time)));
    layout();
    configure();
  }
  function configure() {
    if (scroll.dataset.style !== state.config.lyricStyle) {
      movement = null;
      browseUntil = 0;
      scroll.classList.remove("browsing");
      returnButton.hidden = true;
      scroll.dataset.style = state.config.lyricStyle;
      scroll.scrollTop = scroll.scrollLeft = 0;
    }
    scroll.style.setProperty("--vertical-offset", `${state.config.verticalOffset}%`);
    empty.style.setProperty("--size", state.config.fontSize + "px");
    empty.style.textAlign = state.config.alignment === "center" ? "center" : "left";
    scroll.style.setProperty("--size", `${state.config.fontSize}px`);
    scroll.style.setProperty("--gap", String(state.config.lineGap));
    scroll.style.setProperty("--align", state.config.alignment === "center" ? "center" : "left");
    scroll.style.setProperty("--lyric-color", state.ui.lyricColor || "#fff");
    scroll.style.setProperty("--highlight-color", state.ui.lyricHighlightColor || state.ui.lyricColor || "#fff");
    scroll.style.setProperty("--glow-color", state.ui.lyricGlowColor || "#fff");
    scroll.style.setProperty("--fan-origin", state.config.fanAngle < 0 ? "right" : "left");
    const nextKey = JSON.stringify([state.config.fontSize, state.config.lineGap, state.config.alignment, state.config.blur, state.config.scale, state.config.lyricStyle, state.config.fanAngle, state.config.tiltAngle, reducedMotion.matches]);
    if (nextKey !== visualKey) {
      active = -2;
      visualKey = nextKey;
      paintBounds();
    }
    status();
  }
  function status() {
    const note = get(".word-timing-note");
    note.hidden = !state.lines.length || hasWordTiming(state.lines) || !(state.config.glow || state.config.float);
    note.textContent = "\u5F53\u524D\u6B4C\u8BCD\u6CA1\u6709\u9010\u5B57\u65F6\u95F4\uFF0C\u6682\u65F6\u53EA\u80FD\u9010\u884C\u9AD8\u4EAE\u3002\u9010\u5B57\u8F89\u5149\u548C\u4E0A\u6D6E\u9700\u8981\u5207\u6362\u5230\u9010\u5B57\u6B4C\u8BCD\uFF0C\u53EF\u901A\u8FC7\u5E95\u90E8\u641C\u7D22\u67E5\u627E\u3002";
    empty.hidden = Boolean(rows.length);
    empty.textContent = state.ui.isLoading ? state.ui.loadingText || "\u6B63\u5728\u52A0\u8F7D\u6B4C\u8BCD\u2026" : state.ui.emptyMessage || "\u6682\u65E0\u6B4C\u8BCD";
  }
  function tick(time, now) {
    if (browseUntil && now >= browseUntil) restore();
    const next = activeLine(state.lines, time);
    if (next !== active) {
      active = next;
      const currentTime = state.lines[active]?.time;
      rows.forEach(({ node }, index) => {
        const selected = active >= 0 && state.lines[index].time === currentTime;
        const anchor = rows[Math.max(active, 0)]?.node;
        const vertical = state.config.lyricStyle === "vertical";
        const distance = selected || !anchor ? 0 : lineDistance(
          vertical ? node.offsetLeft - anchor.offsetLeft : node.offsetTop - anchor.offsetTop,
          vertical ? scroll.clientWidth : scroll.clientHeight,
          vertical ? 0.5 : 0.45
        );
        node.classList.toggle("active", selected);
        node.setAttribute("aria-current", String(selected));
        node.style.setProperty("--blur", `${state.config.blur ? Math.abs(distance) * 5 : 0}px`);
        node.style.setProperty("--scale", String(state.config.scale ? Math.max(0.88, 1 - distance * 0.025) : 1));
        const offset = anchor ? node.offsetTop + node.offsetHeight / 2 - anchor.offsetTop - anchor.offsetHeight / 2 : 0;
        node.style.setProperty("--line-transform", state.config.lyricStyle === "fan" ? fanTransform(offset, scroll.clientHeight, state.config, reducedMotion.matches) : lineTransform(distance, state.config, reducedMotion.matches));
      });
      center();
    }
    for (let index = active; index >= 0 && state.lines[index]?.time === state.lines[active]?.time; index--) {
      const line = state.lines[index];
      const nextTime = state.lines.slice(active + 1).find((item) => Number.isFinite(item.time) && item.time > line.time)?.time;
      rows[index].words.forEach((span, wordIndex) => {
        const { duration, progress } = wordProgress(line.words, wordIndex, time, nextTime ?? state.track?.duration);
        const elapsed = time - line.words[wordIndex].time;
        const lineEnd = nextTime ?? state.track?.duration ?? line.words[wordIndex].time + duration;
        Array.from(span.children).forEach((char, charIndex, chars) => {
          const effect = wordEffect(elapsed, duration, state.config, reducedMotion.matches, {
            lineElapsed: time - line.time,
            lineDuration: lineEnd - line.time,
            charElapsed: elapsed - charIndex * duration / chars.length
          });
          char.style.setProperty("--progress", `${clamp(progress * chars.length - charIndex, 0, 1) * 100}%`);
          char.style.setProperty("--played-opacity", progress * chars.length > charIndex ? "1" : "0");
          char.style.setProperty("--lift", `${effect.lift}px`);
          char.style.setProperty("--word-scale", String(effect.scale));
          char.style.setProperty("--word-glow", `${effect.glow}px`);
          char.style.setProperty("--glow-opacity", effect.glow > 0 ? "1" : "0");
        });
      });
    }
    if (movement) {
      const progress = clamp((now - movement.at) / 500, 0, 1);
      scroll[movement.axis] = movement.from + (movement.to - movement.from) * (1 - (1 - progress) ** 2);
      if (progress === 1) movement = null;
    }
    if (state.config.lyricStyle === "vertical") {
      const halfGap = state.config.fontSize * state.config.lineGap / 2;
      for (const { node, divider } of rows) {
        divider.style.left = node.offsetLeft + node.offsetWidth + halfGap + "px";
        const scale = reducedMotion.matches || browseUntil ? 1 : new DOMMatrixReadOnly(getComputedStyle(node).transform).a;
        divider.style.height = (node.offsetHeight + 18) * scale + "px";
      }
    }
    if (state.config.lyricStyle === "fan") {
      const focus = scroll.scrollTop + scroll.clientHeight * 0.45;
      for (const { node } of rows) {
        const offset = node.offsetTop + node.offsetHeight / 2 - focus;
        node.style.setProperty("--line-transform", fanTransform(offset, scroll.clientHeight, state.config, reducedMotion.matches));
      }
    }
    return Boolean(movement || browseUntil);
  }
  return { render, configure, status, tick, destroy() {
    observer.disconnect();
    movement = null;
    rows = [];
  } };
}

// ../../betterlyrics/ui/src/components/background.mjs
function createBackground(elements) {
  const { app, get } = elements;
  const background = get(".background"), video = get("video");
  const washes = [...app.querySelectorAll(".wash")];
  let videoUrl = "";
  function update(state) {
    const host = state.config.backgroundMode === "host";
    const data = state.background;
    const source = host ? data.source : "cover";
    const native = source === "wallpaper" && data.wallpaperProjectType === "scene";
    const media = source === "media" || source === "wallpaper";
    const url = media ? data.mediaUrl || "" : source === "cover" ? artwork(state.track) : "";
    const isVideo = media && data.mediaKind === "video" && Boolean(url);
    app.dataset.background = host ? "host" : state.config.backgroundMode;
    app.style.background = native ? "transparent" : "";
    background.style.background = native ? "transparent" : source === "color" ? data.color || "#172b37" : "";
    background.style.opacity = String(host ? clamp(Number(data.windowOpacity ?? 1), 0, 1) : 1);
    get(".shade").hidden = native || source === "color";
    const opacity = host ? clamp(Number(data.opacity ?? 0.85), 0, 1) : 0.85;
    for (const wash of washes) {
      wash.style.backgroundImage = url && !isVideo && !native ? `url(${JSON.stringify(url)})` : "";
      wash.style.display = isVideo || native || source === "color" ? "none" : "";
      wash.style.filter = host ? `blur(${clamp(Number(data.blur || 0), 0, 100)}px)` : "";
      wash.style.opacity = host ? String(opacity) : "";
      wash.style.backgroundPosition = host ? `${data.positionX ?? 50}% ${data.positionY ?? 50}%` : "";
      wash.style.transform = host ? `scale(${clamp(Number(data.scale || 1), 0.5, 2) * 1.1})` : "";
    }
    if (host) washes[1].style.display = "none";
    video.style.display = isVideo ? "block" : "none";
    video.style.opacity = String(opacity);
    video.style.filter = `blur(${clamp(Number(data.blur || 0), 0, 100)}px)`;
    video.style.objectPosition = `${data.positionX ?? 50}% ${data.positionY ?? 50}%`;
    if (isVideo && videoUrl !== url) {
      videoUrl = url;
      video.src = url;
      void video.play().catch(() => {
      });
    } else if (!isVideo && videoUrl) {
      video.pause();
      video.removeAttribute("src");
      video.load();
      videoUrl = "";
    }
  }
  return { update, destroy() {
    video.pause();
    video.removeAttribute("src");
    video.load();
  } };
}

// ../../betterlyrics/ui/src/utils/configEdits.mjs
function createConfigEdits() {
  const pending = /* @__PURE__ */ new Map(), editing = /* @__PURE__ */ new Set();
  return {
    preview(patch) {
      for (const [key, value] of Object.entries(patch)) {
        pending.set(key, value);
        editing.add(key);
      }
    },
    commit(patch) {
      for (const [key, value] of Object.entries(patch)) {
        pending.set(key, value);
        editing.delete(key);
      }
    },
    receive(config) {
      const result = configWithDefaults(config);
      for (const [key, value] of pending) {
        if (!editing.has(key) && result[key] === value) pending.delete(key);
        else result[key] = value;
      }
      return result;
    },
    isEditing(key) {
      return editing.has(key);
    }
  };
}

// ../../betterlyrics/ui/src/styles.css
var styles_default = `/* SPDX-License-Identifier: GPL-3.0-only */\r
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent!important}\r
.betterlyrics,.betterlyrics *{box-sizing:border-box}\r
.betterlyrics{--fg:#fff;--lyric-color:#fff;--glow-color:#fff;position:relative;isolation:isolate;width:100%;height:100%;overflow:hidden;color:var(--fg);font-family:"Segoe UI Variable Display","Segoe UI","Microsoft YaHei",sans-serif;color-scheme:dark;background:#172b37;outline:none}\r
.betterlyrics button,.betterlyrics input,.betterlyrics select{font:inherit;color:inherit}\r
.betterlyrics button{cursor:pointer;border:0;background:transparent;touch-action:manipulation}\r
.betterlyrics button:focus-visible,.betterlyrics input:focus-visible,.betterlyrics select:focus-visible,.lyrics-scroll:focus-visible{outline:2px solid #d7edff;outline-offset:4px}\r
.betterlyrics [hidden]{display:none!important}\r
.background{position:absolute;inset:0;z-index:-1;overflow:hidden;background:linear-gradient(155deg,#192d3a,#426c81)}\r
.wash{position:absolute;inset:-25%;background-position:center;background-size:cover;filter:blur(85px) saturate(1.35);opacity:.85;transform:scale(1.25)}\r
.wash-two{opacity:0;background-position:80% 75%}\r
.betterlyrics[data-background=fluid] .wash{animation:flow 26s ease-in-out infinite alternate}\r
.betterlyrics[data-background=fluid] .wash-two{opacity:.5;mix-blend-mode:screen;animation:flow 31s ease-in-out -13s infinite alternate-reverse}\r
.betterlyrics:not(.playing) .wash{animation-play-state:paused}\r
.background video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none}\r
.shade{position:absolute;inset:0;background:linear-gradient(180deg,#09151f66,#08152111 75%,#09151f66)}\r
@keyframes flow{from{transform:scale(1.25) rotate(-12deg) translate(-4%,3%)}to{transform:scale(1.45) rotate(16deg) translate(5%,-5%)}}\r
.topbar{position:absolute;inset:16px 24px auto;display:flex;align-items:center;justify-content:flex-end;padding-right:88px;height:40px;z-index:3;opacity:0;transition:opacity .25s;pointer-events:none}\r
.topbar>span{position:absolute;left:50%;transform:translateX(-50%);font-size:12px;letter-spacing:.08em;color:#ffffff85}\r
.icon-button{width:38px;height:38px;border-radius:9px;display:inline-grid;place-items:center;flex-shrink:0}\r
.icon-button svg{width:21px;height:21px}\r
.icon-button:hover{background:#ffffff15}\r
.stage{height:100%;display:grid;grid-template-columns:42% minmax(0,1fr);column-gap:8%;padding:40px 6.5% 60px 8.5%;align-items:center}\r
.record{width:min(100%,360px);justify-self:center;min-width:0;transform:translateY(6px)}\r
.artwork{position:relative;aspect-ratio:1;width:100%;border-radius:6%;overflow:hidden;box-shadow:0 12px 32px #0003;background:#ffffff0a}\r
.cover{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}\r
.betterlyrics.fan-mode .artwork{border-radius:50%}\r
@media(min-width:701px){\r
  .betterlyrics.fan-mode:not(.no-cover) .record{position:absolute;inset:0 auto 0 0;width:50%;transform:none;isolation:isolate}\r
  .betterlyrics.fan-mode:not(.no-cover) .artwork{position:absolute;inset:0;width:100%;height:100%;aspect-ratio:auto;border-radius:0;box-shadow:none;clip-path:circle(var(--cover-radius,90vh) at var(--cover-center-x,-30vw) var(--cover-center-y,45%))}\r
  .betterlyrics.fan-mode:not(.no-cover) .artwork::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#0002,transparent 35%,#0009);pointer-events:none}\r
  .betterlyrics.fan-mode:not(.no-cover) .metadata{position:absolute;left:10%;right:10%;bottom:120px;margin:0;text-shadow:0 2px 12px #0008}\r
  .betterlyrics.fan-mode:not(.no-cover) .artist{opacity:.8}\r
  .betterlyrics.fan-mode:not(.no-cover) .lyrics-area{grid-column:2;z-index:1}\r
}\r
.cover-placeholder{display:grid;place-items:center;height:100%;background:linear-gradient(145deg,#ffffff0a,#ffffff02);color:#ffffff66}\r
.cover-placeholder svg{width:28%;height:28%}\r
.metadata{margin-top:19px;min-width:0}\r
.metadata h1{font-size:clamp(22px,2.7vw,34px);line-height:1.23;margin:0;font-weight:700;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;letter-spacing:-.02em}\r
.metadata p{margin:5px 0 0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;line-height:1.35}\r
.artist{font-size:clamp(16px,2vw,25px);font-weight:650;opacity:.55}\r
.album{font-size:12px;opacity:0;transition:opacity .25s}\r
.record:hover .album{opacity:.45}\r
.lyrics-area{height:100%;min-height:0;position:relative;min-width:0}\r
.lyrics-scroll{position:absolute;inset:0;overflow:auto;scrollbar-width:none;overscroll-behavior:contain;mask-image:linear-gradient(transparent,#000 17%,#000 80%,transparent);padding:var(--pad,40vh) 16px var(--pad,40vh) 10px;outline:none}\r
.lyrics-scroll::-webkit-scrollbar{display:none}\r
.lyrics-scroll.unsynced{padding-top:40px;padding-bottom:40px}\r
.lyric-line{display:block;width:100%;position:relative;padding:12px 0;margin:0 0 calc(var(--size,40px)*var(--gap,.55));text-align:var(--align,left);font-size:var(--size,40px)!important;font-weight:700!important;line-height:1.4;letter-spacing:-.025em;color:var(--lyric-color)!important;white-space:pre-wrap;overflow-wrap:anywhere;transform-origin:var(--align,left) center;opacity:.3;filter:blur(var(--blur,0px));transform:scale(var(--scale,1));transition:opacity .5s,filter .5s,transform .5s cubic-bezier(.25,.46,.45,.94)}\r
.lyric-line.active{opacity:1;filter:none;transform:scale(1)}\r
.lyric-line:hover,.lyrics-scroll.browsing .lyric-line,.lyrics-scroll.unsynced .lyric-line{opacity:.85;filter:none}\r
.lyric-line:disabled{cursor:default}\r
.word{display:inline-block;position:relative;white-space:pre-wrap;vertical-align:baseline;color:color-mix(in srgb,var(--lyric-color) 30%,transparent)}\r
.lyric-char{display:inline-block;position:relative}\r
.lyric-char::after,.lyric-char::before{content:attr(data-text);position:absolute;inset:0;color:transparent;background:linear-gradient(var(--fill-direction,to right),var(--highlight-color,#fff) var(--progress,0%),transparent calc(var(--progress,0%) + 12%));background-clip:text;pointer-events:none}\r
.lyric-char::after{opacity:var(--played-opacity,0)}\r
.lyric-char::before{background-image:linear-gradient(var(--fill-direction,to right),var(--glow-color,#fff) var(--progress,0%),transparent calc(var(--progress,0%) + 12%));filter:blur(var(--word-glow,0px));opacity:calc(var(--glow-opacity,0) * var(--played-opacity,0))}\r
.lyric-line:not(.active) .word{color:inherit}\r
.lyric-line:not(.active) .lyric-char::after,.lyric-line:not(.active) .lyric-char::before{display:none}\r
.lyric-line.active .lyric-char{transform:translateY(var(--lift,0px)) scale(var(--word-scale,1))}\r
.translation{display:block;font-size:.55em;line-height:1.5;margin-top:6px;opacity:.65;letter-spacing:0}\r
.empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:flex-start;color:#ffffff85;font-size:22px;line-height:1.7;white-space:pre-line}\r
.return-live{position:absolute;right:14px;bottom:55px;padding:9px 15px;border-radius:20px;background:#182934dd!important;font-size:12px;z-index:2}\r
.controls{position:absolute;bottom:14px;left:6%;right:6%;opacity:0;transform:translateY(5px);transition:opacity .25s,transform .25s;z-index:3}\r
.betterlyrics.awake .controls,.betterlyrics.awake .topbar,.betterlyrics:focus-within .controls,.betterlyrics:focus-within .topbar{opacity:1;transform:none}\r
.controls:hover,.topbar:hover{opacity:1}\r
.timeline{display:flex;gap:12px;align-items:center}\r
.timeline time{font-size:10px;font-variant-numeric:tabular-nums;color:#ffffff8a;min-width:34px}\r
.timeline time:last-child{text-align:right}\r
.betterlyrics input[type=range]{accent-color:#fff;height:3px;cursor:pointer;min-width:0}\r
.seek{flex:1;width:100%}\r
.control-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;margin-top:8px}\r
.control-left,.control-right,.transport{display:flex;align-items:center;gap:8px;min-width:0}\r
.control-right{justify-content:flex-end}\r
.volume{width:82px}\r
.transport{gap:16px}\r
.transport [data-action=togglePlayback]{width:46px;height:40px}\r
.transport [data-action=togglePlayback] svg{width:27px;height:27px}\r
[data-action=toggleFavorite][aria-pressed=true]{color:#ffd6df}\r
[data-action=toggleFavorite][aria-pressed=true] svg{fill:currentColor}\r
.offset{font-size:10px;opacity:.55}\r
.panel{position:absolute;z-index:5;bottom:90px;right:6%;width:min(340px,calc(100% - 32px));max-height:calc(100% - 150px);overflow:auto;padding:20px;border:1px solid #ffffff20;border-radius:14px;background:#17222af2;backdrop-filter:blur(30px);box-shadow:0 12px 60px #0005}\r
.panel-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}\r
.panel h2{font-size:16px;margin:0;font-weight:600}\r
.panel-heading button{font-size:24px;width:30px;height:30px}\r
.settings-content label{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:43px;font-size:13px}\r
.settings-content input[type=range]{width:130px}\r
.word-timing-note{font-size:12px;line-height:1.6;color:#c8dce5;margin:0 0 12px}\r
.style-reset{width:100%;padding:9px 12px;margin-bottom:10px;border:1px solid #ffffff25!important;border-radius:6px;font-size:12px!important;background:#ffffff0d!important}\r
.settings-content select{max-width:150px;background:#ffffff12;border:1px solid #ffffff25;border-radius:5px;padding:5px}\r
.settings-content option{background:#17222a}\r
.settings-content input[type=checkbox]{accent-color:#aacddd;width:16px;height:16px}\r
.timing{display:flex;align-items:center;justify-content:space-between;font-size:12px;border-top:1px solid #ffffff15;margin-top:12px;padding-top:14px}\r
.timing button{padding:8px;background:#ffffff0d!important;border-radius:6px}\r
.queue-list button{width:100%;padding:12px 8px;text-align:left;border-radius:7px;font-size:13px}\r
.queue-list button:hover,.queue-list button[aria-current=true]{background:#ffffff12}\r
.queue-list small{display:block;opacity:.5;margin-top:4px}\r
.betterlyrics.no-cover .stage{grid-template-columns:1fr;padding-inline:15%}\r
.betterlyrics.no-cover .record{display:none}\r
@media(max-width:700px){.stage{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr);gap:12px;padding:72px 7% 76px}.record{display:flex;width:100%;gap:18px;align-items:center;transform:none}.artwork{width:72px;flex-shrink:0;border-radius:8px}.metadata{margin:0}.metadata h1{font-size:19px}.artist{font-size:14px}.album{display:none}.lyric-line{font-size:calc(var(--size,40px)*.76)!important}.topbar{inset:16px 18px auto}.topbar>span{font-size:10px}.controls{left:5%;right:5%;bottom:12px}.volume{width:clamp(24px,8vw,40px)}.control-row{grid-template-columns:auto minmax(0,1fr) auto}.transport{justify-content:center}.control-left,.control-right,.transport{gap:2px}.transport .icon-button{width:34px}.control-right .icon-button{width:30px}.control-right [data-action=toggleMute]{display:none}.offset{display:none}.betterlyrics.no-cover .stage{grid-template-rows:minmax(0,1fr);padding-inline:8%}.panel{right:16px}.return-live{bottom:8px}}\r
@media(max-height:500px) and (min-width:701px){.stage{padding-top:50px;padding-bottom:80px}.record{width:min(100%,200px)}.metadata{margin-top:10px}.metadata h1{font-size:20px}.artist{font-size:15px}.lyric-line{font-size:calc(var(--size,40px)*.8)!important}}\r
@media(prefers-reduced-motion:reduce){.betterlyrics *{animation:none!important;transition:none!important}.word.singing{transform:none}}\r
@media(hover:none){.controls,.topbar{opacity:1;transform:none}}\r
/* Mono owns the collapse button and the 96px window controls at right:8px. */\r
@media(max-width:700px){.topbar{padding-right:94px}.topbar>span{display:none}}\r
.lyrics-scroll[data-style] .lyric-line{transform:var(--line-transform,none)}\r
.lyrics-scroll[data-style=fan]{left:calc(-1 * var(--fan-gutter,140px));right:calc(-1 * var(--fan-gutter,140px));padding-left:calc(var(--fan-gutter,140px) + 10px);padding-right:calc(var(--fan-gutter,140px) + 16px);overflow-x:hidden}\r
.lyrics-scroll[data-style=fan] .lyric-line{padding-block:4px;transform-origin:var(--fan-origin,left) center;margin-bottom:max(calc(var(--size,40px)*var(--gap,.55)),var(--fan-clearance,0px))}\r
.lyrics-scroll[data-style=perspective] .lyric-line{transform-origin:center center}\r
.lyrics-scroll[data-style].browsing .lyric-line,.lyrics-scroll[data-style].unsynced .lyric-line{transform:none}\r
.lyrics-scroll{overflow-anchor:none;scroll-behavior:auto}\r
.lyrics-scroll[data-style=vertical]{top:var(--vertical-offset,0%);display:flex;gap:calc(var(--size,40px)*var(--gap,.55));padding:28px var(--pad-x,25vw);overflow-y:hidden;mask-image:linear-gradient(to right,transparent,#000 15%,#000 85%,transparent)}\r
.lyrics-scroll[data-style=vertical] .lyric-line{writing-mode:vertical-rl;text-orientation:mixed;flex:0 0 auto;width:auto;max-width:none;height:100%;margin:0;padding:0 12px;text-align:start;overflow-wrap:anywhere;letter-spacing:.04em;transform-origin:center top}\r
.lyrics-scroll[data-style=vertical] .lyric-char{--fill-direction:to bottom}\r
.lyrics-scroll[data-style=vertical] .lyric-line.active .lyric-char{transform:translateX(calc(-1 * var(--lift,0px))) scale(var(--word-scale,1))}\r
.lyrics-scroll[data-style=vertical].unsynced{padding-inline:24px}\r
@media(prefers-reduced-motion:reduce){.lyrics-scroll[data-style] .lyric-line{transform:none!important}}\r
\r
.lyrics-scroll[data-style=fan] .lyric-line,.lyrics-scroll[data-style=fan].browsing .lyric-line{transform:var(--line-transform);transition:opacity .5s,filter .5s}\r
\r
.lyric-line.line-timed.active{color:var(--highlight-color,var(--lyric-color,#fff))!important}\r
\r
.betterlyrics.no-cover .stage:has(.lyrics-scroll[data-style=vertical]){padding-inline:3%}\r
.betterlyrics.no-cover .lyrics-scroll[data-style=vertical]{mask-image:linear-gradient(to right,transparent,#000 4%,#000 96%,transparent)}\r
\r
.lyrics-scroll[data-style=vertical] .lyric-line::before{content:'';position:absolute;top:-18px;left:50%;width:6px;height:6px;border-radius:50%;background:var(--lyric-color,#fff);transform:translateX(-50%);pointer-events:none}\r
.lyrics-scroll[data-style=vertical] .lyric-line.active::before{background:var(--highlight-color,var(--lyric-color,#fff))}\r
\r
\r
\r
\r
\r
\r
.vertical-divider{display:none;pointer-events:none}.lyrics-scroll[data-style=vertical] .vertical-divider{display:block;position:absolute;top:10px;width:1px;background:color-mix(in srgb,var(--lyric-color,#fff) 10%,transparent)}\r
\r
.betterlyrics.fan-mode .empty{inset:45% 16px auto 10px;display:block;transform:translateY(-50%);font-size:var(--size,40px);font-weight:700;line-height:1.4;letter-spacing:-.025em;overflow-wrap:anywhere}\r
@media(max-width:700px){.betterlyrics.fan-mode .empty{font-size:calc(var(--size,40px)*.76)}}\r
@media(max-height:500px) and (min-width:701px){.betterlyrics.fan-mode .empty{font-size:calc(var(--size,40px)*.8)}}\r
`;

// ../../betterlyrics/ui/src/controller.mjs
function createController(root, mono, fanOnly = false) {
  const state = createState(), events = new AbortController();
  state.config = rendererConfig(state.config, fanOnly);
  const elements = createPage(root, styles_default), { app, get } = elements;
  if (fanOnly) get(".topbar").remove();
  const actions = {
    close: () => mono.ui.close(),
    togglePlayback: () => state.playback.isPlaying ? mono.player.pause() : mono.player.play(),
    playPrevious: () => mono.player.previous(),
    playNext: () => mono.player.next(),
    toggleFavorite: () => mono.favorites.set(state.track.id, !state.playback.isFavorite),
    toggleMute: () => mono.player.setMuted(!state.playback.isMuted),
    openSearch: () => mono.lyrics.openSearch(state.track.id)
  };
  const lyrics = createLyricsView(elements, state, mono, events.signal);
  const background = createBackground(elements);
  const configEdits = createConfigEdits();
  createSettings(get(".settings-content"), fanOnly);
  let frame = 0, alive = true, awakeUntil = 0, coverUrl = "", draggingSeek = false;
  let lastPlaying, lastFavorite, lastVolume, lastSecond = -1;
  const on = (node, type, callback, options = {}) => node.addEventListener(type, callback, { ...options, signal: events.signal });
  function schedule() {
    if (alive && !frame) frame = requestAnimationFrame(tick);
  }
  function awake() {
    awakeUntil = performance.now() + 2600;
    app.classList.add("awake");
    schedule();
  }
  function dismiss() {
    elements.panel.hidden = elements.queuePanel.hidden = true;
  }
  function togglePanel(panel, opener) {
    const open = panel.hidden;
    dismiss();
    panel.hidden = !open;
    if (open) panel.querySelector("button").focus();
    else opener.focus();
  }
  on(app, "pointermove", awake);
  on(app, "pointerdown", awake);
  on(app, "wheel", schedule, { passive: true });
  on(app, "touchstart", schedule, { passive: true });
  on(app, "keydown", (event) => {
    awake();
    if (event.key === "Escape") {
      if (!elements.panel.hidden || !elements.queuePanel.hidden) {
        dismiss();
        get("[data-action=settings]").focus();
      } else mono.ui.close();
    }
    if (event.code === "Space" && !event.target.closest("button,input,select")) {
      event.preventDefault();
      actions.togglePlayback();
    }
  });
  on(app, "click", (event) => {
    const button2 = event.target.closest("[data-action]");
    if (!button2) return;
    const action = button2.dataset.action;
    if (action === "settings") togglePanel(elements.panel, button2);
    else if (action === "resetStyle") {
      const preset = stylePreset(state.config.lyricStyle);
      const patch = fanOnly ? Object.fromEntries(Object.entries(preset).filter(([key]) => fanSettingKeys.includes(key))) : preset;
      configEdits.commit(patch);
      state.config = { ...state.config, ...patch };
      renderConfig();
      schedule();
      mono.config.set(state.config);
    } else if (action === "queue") {
      renderQueue();
      togglePanel(elements.queuePanel, button2);
    } else if (action === "dismiss") {
      dismiss();
      get("[data-action=settings]").focus();
    } else if (action === "earlier") mono.lyrics.setOffset(state.track.id, Number(state.ui.lyricTimeOffset || 0) + 0.5);
    else if (action === "later") mono.lyrics.setOffset(state.track.id, Number(state.ui.lyricTimeOffset || 0) - 0.5);
    else actions[action]?.();
  });
  on(get(".queue-list"), "click", (event) => {
    const item = event.target.closest("[data-queue]");
    if (item) mono.queue.play(state.queue[Number(item.dataset.queue)].entryId);
  });
  on(elements.seek, "input", () => {
    draggingSeek = true;
    get(".elapsed").textContent = formatTime(Number(elements.seek.value));
  });
  on(elements.seek, "change", () => {
    mono.player.seek(Number(elements.seek.value));
    draggingSeek = false;
  });
  on(elements.seek, "blur", () => {
    draggingSeek = false;
  });
  on(elements.seek, "pointercancel", () => {
    draggingSeek = false;
  });
  on(elements.volume, "input", () => {
    mono.player.setVolume(Number(elements.volume.value) / 100);
  });
  on(elements.cover, "error", () => {
    elements.cover.hidden = true;
  });
  function editSetting(event, commit) {
    const input = event.target, key = input.dataset.config;
    if (!key) return;
    const value = input.type === "checkbox" ? input.checked : input.type === "range" ? Number(input.value) : input.value;
    const preset = key === "lyricStyle" ? stylePreset(value) : {};
    const patch = { ...preset, [key]: value };
    if (commit) configEdits.commit(patch);
    else configEdits.preview(patch);
    state.config = { ...state.config, ...patch };
    renderConfig();
    schedule();
    if (commit) mono.config.set(state.config);
  }
  on(get(".settings-content"), "input", (event) => {
    if (event.target.type === "range") editSetting(event, false);
  });
  on(get(".settings-content"), "change", (event) => editSetting(event, true));
  for (const type of ["focusout", "pointercancel"]) on(get(".settings-content"), type, (event) => {
    if (configEdits.isEditing(event.target.dataset.config)) editSetting(event, true);
  });
  function renderConfig() {
    state.config = rendererConfig(state.config, fanOnly);
    app.classList.toggle("fan-mode", state.config.lyricStyle === "fan");
    get("[data-action=resetStyle]").hidden = !["glow", "fan"].includes(state.config.lyricStyle);
    app.classList.toggle("no-cover", !state.config.showCover);
    for (const input of app.querySelectorAll("[data-config]")) {
      if (input.type === "checkbox") input.checked = Boolean(state.config[input.dataset.config]);
      else if (input.value !== String(state.config[input.dataset.config])) input.value = String(state.config[input.dataset.config]);
    }
    const verticalSetting = get("[data-vertical-setting]");
    if (verticalSetting) verticalSetting.hidden = state.config.lyricStyle !== "vertical";
    lyrics.configure();
    background.update(state);
  }
  function renderTrack() {
    get("h1").textContent = state.track?.title || "\u672A\u5728\u64AD\u653E";
    get("h1").title = get("h1").textContent;
    get(".artist").textContent = artistName(state.track);
    get(".album").textContent = state.track?.album || "";
    const nextCover = artwork(state.track);
    if (nextCover !== coverUrl) {
      coverUrl = nextCover;
      elements.cover.hidden = !nextCover;
      if (nextCover) elements.cover.src = nextCover;
      else elements.cover.removeAttribute("src");
    }
    elements.seek.max = String(state.track?.duration || 0);
    elements.seek.disabled = !state.track?.duration;
    get(".duration").textContent = formatTime(state.track?.duration);
    background.update(state);
  }
  function renderQueue() {
    const list = get(".queue-list");
    list.replaceChildren();
    if (!state.queue.length) {
      list.textContent = "\u64AD\u653E\u961F\u5217\u4E3A\u7A7A";
      return;
    }
    state.queue.forEach((track, index) => {
      const button2 = document.createElement("button");
      button2.type = "button";
      button2.dataset.queue = String(index);
      button2.setAttribute("aria-current", String(track.id === state.track?.id && track.path === state.track?.path));
      button2.textContent = track.title;
      const artist = document.createElement("small");
      artist.textContent = artistName(track);
      button2.append(artist);
      list.append(button2);
    });
  }
  function transport(now) {
    const playback = state.playback;
    if (lastPlaying !== playback.isPlaying) {
      lastPlaying = playback.isPlaying;
      app.classList.toggle("playing", lastPlaying);
      const button2 = get("[data-action=togglePlayback]");
      button2.innerHTML = icon(lastPlaying ? "pause" : "play");
      button2.title = lastPlaying ? "\u6682\u505C" : "\u64AD\u653E";
      button2.setAttribute("aria-label", button2.title);
    }
    if (lastFavorite !== playback.isFavorite) {
      lastFavorite = playback.isFavorite;
      get("[data-action=toggleFavorite]").setAttribute("aria-pressed", String(Boolean(lastFavorite)));
    }
    const volume = playback.isMuted ? 0 : playback.volume;
    if (lastVolume !== volume) {
      lastVolume = volume;
      elements.volume.value = String(volume);
    }
    if (!draggingSeek) {
      const time = playbackTime(state, now);
      elements.seek.value = String(time);
      if (Math.floor(time) !== lastSecond) {
        lastSecond = Math.floor(time);
        get(".elapsed").textContent = formatTime(time);
      }
    }
    const offset = Number(state.ui.lyricTimeOffset || 0);
    get(".offset").textContent = offset ? `\u6B4C\u8BCD ${offset > 0 ? "+" : ""}${offset.toFixed(1)} s` : "";
  }
  function update(message) {
    if (!alive) return;
    if (message.type === "config") message = { ...message, config: configEdits.receive(message.config) };
    const type = applyMessage(state, message, performance.now());
    if (!type) return;
    if (type === "track-change") {
      lyrics.render();
      renderTrack();
      renderQueue();
    } else if (type === "track") renderTrack();
    else if (type === "lyrics") lyrics.render();
    else if (type === "lyrics-status") lyrics.status();
    else if (type === "config") renderConfig();
    else if (type === "lyrics-ui") {
      lyrics.configure();
    } else if (type === "background") background.update(state);
    else if (type === "queue") renderQueue();
    transport(performance.now());
    schedule();
  }
  function tick(now) {
    if (!alive) return;
    frame = 0;
    const moving = lyrics.tick(lyricTime(state, now), now);
    transport(now);
    if (now > awakeUntil) app.classList.remove("awake");
    if (state.playback.isPlaying || moving || now < awakeUntil) schedule();
  }
  lyrics.render();
  renderTrack();
  renderConfig();
  transport(performance.now());
  awake();
  schedule();
  return { update, destroy() {
    alive = false;
    cancelAnimationFrame(frame);
    events.abort();
    lyrics.destroy();
    background.destroy();
    root.replaceChildren();
  } };
}

// src/renderer.mjs
var controller;
var renderer_default = {
  mount(root, api) {
    controller?.destroy();
    controller = createController(root, api, true);
  },
  update(message) {
    controller?.update(message);
  },
  destroy() {
    controller?.destroy();
    controller = void 0;
  }
};
export {
  renderer_default as default
};
