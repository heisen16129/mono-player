import {
  UPSTREAM_BODY_HTML,
  UPSTREAM_CSS,
  UPSTREAM_INLINE_HANDLER_NAMES,
  UPSTREAM_MODULE_COUNT,
  UPSTREAM_RUNTIME,
  UPSTREAM_WORKSHOP_SRCDOC,
} from './generated/upstream.mjs';
import upstreamAdapterSource from './upstream-adapter.js.part';
import pluginOverrides from './plugin-overrides.css';
import skullAssetUrl from '../upstream/public/assets/skull-decimation-points.bin';
import { mergeContext, toRuntimeContext } from './bridge/context-adapter.mjs';

let target = null;
let rendererApi = null;
let context = {};
let runtimeApi = null;
let styleElement = null;
let cleanupActions = null;
let previousFetch = null;
let previousHostAction = null;
let previousInlineHandlers = null;
let previousWorkshopSrcdoc = null;
let storagePersistTimer = 0;

const PRIVATE_STORAGE_KEY = 'mineradioOriginalStorage';
const excludedStorageKey = (key) => /(login|cookie|last-playback|listen-stats|local-beat|library|cache)/i.test(key);

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function installStorageFallback() {
  try {
    localStorage.setItem('mineradio-startup-fast-skip-v1', '1');
    localStorage.setItem('mineradio-visual-guide-seen-v2', '1');
    localStorage.removeItem('mineradio-last-playback-v1');
    return;
  } catch (error) {
    let restored = {};
    try { restored = JSON.parse(String(context.config?.[PRIVATE_STORAGE_KEY] || '{}')) || {}; } catch (parseError) {}
    const memory = new Map(Object.entries(restored).map(([key, value]) => [String(key), String(value)]));
    memory.set('mineradio-startup-fast-skip-v1', '1');
    memory.set('mineradio-visual-guide-seen-v2', '1');
    memory.delete('mineradio-last-playback-v1');
    const schedulePersist = () => {
      clearTimeout(storagePersistTimer);
      storagePersistTimer = setTimeout(() => {
        const entries = {};
        for (const [key, value] of memory) {
          if (key.startsWith('mineradio-') && !excludedStorageKey(key)) entries[key] = value;
        }
        const serialized = JSON.stringify(entries);
        if (serialized === context.config?.[PRIVATE_STORAGE_KEY]) return;
        dispatch('updateConfig', { config: { ...(context.config || {}), [PRIVATE_STORAGE_KEY]: serialized } });
      }, 240);
    };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        get length() { return memory.size; },
        clear() { memory.clear(); },
        getItem(key) { return memory.has(String(key)) ? memory.get(String(key)) : null; },
        key(index) { return [...memory.keys()][index] ?? null; },
        removeItem(key) { memory.delete(String(key)); schedulePersist(); },
        setItem(key, value) { memory.set(String(key), String(value)); schedulePersist(); },
      },
    });
  }
}

function installEnvironment() {
  installStorageFallback();
  previousWorkshopSrcdoc = window.__monoMineradioWorkshopSrcdoc;
  window.__monoMineradioWorkshopSrcdoc = UPSTREAM_WORKSHOP_SRCDOC;
  previousFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = String(typeof input === 'string' ? input : input?.url || '');
    if (/assets\/skull-decimation-points\.bin(?:\?|$)/i.test(url)) return previousFetch(skullAssetUrl, init);
    if (/^(?:https?:\/\/[^/]+)?\/api\//i.test(url)) return jsonResponse({});
    return previousFetch(input, init);
  };
  if (!window.electronAPI) {
    window.electronAPI = new Proxy({}, {
      get(_target, property) {
        if (String(property).startsWith('on')) return () => () => {};
        return async () => null;
      },
    });
  }
  window.open = () => null;
}

function dispatch(action, payload = {}) {
  if (!rendererApi) return;
  rendererApi.post(action, payload);
}

function bindHostActions() {
  const abort = new AbortController();
  const options = { capture: true, signal: abort.signal };
  const clickActions = new Map([
    ['play-btn', 'togglePlayback'],
    ['prev-btn', 'playPrevious'],
    ['next-btn', 'playNext'],
    ['heart-btn', 'toggleFavorite'],
    ['play-mode-btn', 'togglePlaybackMode'],
  ]);
  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('button');
    const action = button ? clickActions.get(button.id) : null;
    if (action) {
      event.preventDefault();
      event.stopImmediatePropagation();
      dispatch(action, { observedPlaying: Boolean(context.isPlaying) });
      return;
    }
    const queueItem = event.target?.closest?.('[data-queue-index]');
    if (queueItem && queueItem.closest('#queue-list, #mini-queue-list')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      dispatch('playQueueTrack', { index: Number(queueItem.dataset.queueIndex) });
      return;
    }
    const settingsTab = event.target?.closest?.('#fx-panel-tabs [data-fx-tab]');
    if (settingsTab) {
      event.preventDefault();
      event.stopImmediatePropagation();
      runtimeApi?.selectSettingsTab(settingsTab.dataset.fxTab);
      return;
    }
    const inlineTarget = event.target?.closest?.('[onclick]');
    if (inlineTarget && typeof inlineTarget.onclick !== 'function') {
      event.preventDefault();
      event.stopImmediatePropagation();
      runtimeApi?.invokeInlineHandler(inlineTarget.getAttribute('onclick'), event, inlineTarget);
    }
  }, options);
  for (const eventType of ['error', 'input', 'keydown', 'mouseleave', 'mousemove']) {
    document.addEventListener(eventType, (event) => {
      const attribute = `on${eventType}`;
      const inlineTarget = event.target?.closest?.(`[${attribute}]`);
      if (!inlineTarget || typeof inlineTarget[attribute] === 'function') return;
      runtimeApi?.invokeInlineHandler(inlineTarget.getAttribute(attribute), event, inlineTarget);
    }, options);
  }
  document.getElementById('progress-bar')?.addEventListener('pointerup', (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)));
    dispatch('seekTime', { time: ratio * (Number(context.duration) || 0) });
  }, { signal: abort.signal });
  document.getElementById('volume-slider')?.addEventListener('input', (event) => {
    dispatch('setVolume', { value: Number(event.currentTarget.value) });
  }, { signal: abort.signal });
  return () => abort.abort();
}

function runOriginalRuntime() {
  previousHostAction = window.__monoMineradioHostAction;
  window.__monoMineradioHostAction = dispatch;
  previousInlineHandlers = new Map(UPSTREAM_INLINE_HANDLER_NAMES.map((name) => [
    name,
    Object.prototype.hasOwnProperty.call(window, name) ? window[name] : undefined,
  ]));
  const exportInlineHandlers = UPSTREAM_INLINE_HANDLER_NAMES.map((name) => (
    `if(typeof ${name}==='function')window[${JSON.stringify(name)}]=${name};`
  )).join('');
  const runtimeFactory = new Function(
    `${UPSTREAM_RUNTIME}\n${exportInlineHandlers}\n${upstreamAdapterSource}\n//# sourceURL=mineradio-2.1.0-original-runtime.js`,
  );
  runtimeFactory.call(window);
  runtimeApi = window.__monoMineradioOriginal;
  if (!runtimeApi) throw new Error('Mineradio original adapter did not initialize.');
}

function applyContext(nextContext) {
  context = mergeContext(context, nextContext);
  runtimeApi?.setContext(toRuntimeContext(context));
  if (target && runtimeApi?.debug) {
    target.dataset.mineradioOriginalDebug = JSON.stringify(runtimeApi.debug());
  }
}

async function mount(nextTarget, initialContext, api) {
  target = nextTarget;
  rendererApi = api;
  context = initialContext || {};
  target.dataset.mineradioOriginalRoot = 'true';
  target.innerHTML = UPSTREAM_BODY_HTML;
  styleElement = document.createElement('style');
  styleElement.dataset.mineradioOriginalStyles = 'true';
  styleElement.textContent = `${UPSTREAM_CSS}\n${pluginOverrides}`;
  document.head.append(styleElement);
  installEnvironment();
  cleanupActions = bindHostActions();
  runOriginalRuntime();
  applyContext(context);
  target.dataset.mineradioOriginalModules = String(UPSTREAM_MODULE_COUNT);
}

function destroy() {
  clearTimeout(storagePersistTimer);
  cleanupActions?.();
  if (previousFetch) window.fetch = previousFetch;
  if (previousHostAction === undefined) delete window.__monoMineradioHostAction;
  else window.__monoMineradioHostAction = previousHostAction;
  if (previousWorkshopSrcdoc === undefined) delete window.__monoMineradioWorkshopSrcdoc;
  else window.__monoMineradioWorkshopSrcdoc = previousWorkshopSrcdoc;
  for (const [name, previous] of previousInlineHandlers || []) {
    if (previous === undefined) delete window[name];
    else window[name] = previous;
  }
  delete window.__monoMineradioOriginal;
  styleElement?.remove();
  if (target) {
    target.innerHTML = '';
    delete target.dataset.mineradioOriginalRoot;
    delete target.dataset.mineradioOriginalDebug;
  }
  target = null;
  rendererApi = null;
  context = {};
  runtimeApi = null;
  styleElement = null;
  cleanupActions = null;
  previousFetch = null;
  previousHostAction = null;
  previousInlineHandlers = null;
  previousWorkshopSrcdoc = null;
  storagePersistTimer = 0;
}

export default {
  mount,
  update(nextContext) { applyContext(nextContext || {}); },
  updateAudioSpectrum(levels) { runtimeApi?.setSpectrum(Array.isArray(levels) ? levels : []); },
  destroy,
};
