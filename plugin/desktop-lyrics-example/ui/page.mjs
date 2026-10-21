// plugin-page.ts
import renderer from "./renderer.mjs";

// packages/plugin-sdk/src/protocol.ts
var API_VERSION = 1;

// packages/plugin-sdk/src/features.ts
function createFeatures(call) {
  return {
    speaker: { getConnection: () => call("speaker.getConnection") },
    playlists: {
      create: (name, trackIds = []) => call("playlists.create", { name, trackIds }),
      update: (playlistId, name) => call("playlists.update", { playlistId, name }),
      delete: (playlistId) => call("playlists.delete", { playlistId }),
      reorderTracks: (playlistId, trackIds, expectedRevision) => call("playlists.reorderTracks", { playlistId, trackIds, expectedRevision }),
      list: (params = {}) => call("playlists.list", params),
      get: (playlistId) => call("playlists.get", { playlistId }),
      listTracks: (playlistId, params = {}) => call("playlists.listTracks", { playlistId, ...params }),
      addTracks: (playlistId, trackIds) => call("playlists.addTracks", { playlistId, trackIds }),
      removeTracks: (playlistId, trackIds) => call("playlists.removeTracks", { playlistId, trackIds })
    },
    queue: {
      replace: (trackIds, expectedRevision) => call("queue.replace", { trackIds, expectedRevision }),
      append: (trackIds, expectedRevision) => call("queue.append", { trackIds, expectedRevision }),
      insert: (trackIds, beforeEntryId, expectedRevision) => call("queue.insert", { trackIds, beforeEntryId, expectedRevision }),
      remove: (entryIds, expectedRevision) => call("queue.remove", { entryIds, expectedRevision }),
      reorder: (entryIds, expectedRevision) => call("queue.reorder", { entryIds, expectedRevision }),
      clear: (expectedRevision) => call("queue.clear", { expectedRevision }),
      get: () => call("queue.get"),
      play: (entryId) => call("queue.play", { entryId })
    },
    favorites: {
      list: (params = {}) => call("favorites.list", params),
      contains: (trackId) => call("favorites.contains", { trackId }),
      set: (trackId, favorite) => call("favorites.set", { trackId, favorite })
    },
    lyrics: {
      get: (trackId) => call("lyrics.get", { trackId }),
      setOffset: (trackId, offset) => call("lyrics.setOffset", { trackId, offset }),
      openSearch: (trackId) => call("lyrics.openSearch", { trackId })
    },
    artwork: {
      get: (artworkRef) => call("artwork.get", { artworkRef }),
      refresh: (artworkRef) => call("artwork.refresh", { artworkRef })
    },
    sources: {
      list: () => call("sources.list"),
      search: (params) => call("sources.search", params),
      importTracks: (tracks) => call("sources.importTracks", { tracks })
    },
    media: { prepare: (trackId) => call("media.prepare", { trackId }) },
    history: { recordPlayed: (trackId) => call("history.recordPlayed", { trackId }) },
    storage: {
      get: (key) => call("storage.get", { key }),
      set: (key, value) => call("storage.set", { key, value }),
      delete: (key) => call("storage.delete", { key }),
      keys: () => call("storage.keys")
    },
    ui: {
      close: () => call("ui.close"),
      openSettings: () => call("ui.openSettings"),
      openPage: (pageId, options = {}) => call("ui.openPage", { pageId, ...options }),
      notify: (message) => call("ui.notify", { message })
    },
    window: { startDragging: () => call("window.startDragging") }
  };
}

// packages/plugin-sdk/src/subscriptions.ts
function createSubscriptions(call) {
  const active = /* @__PURE__ */ new Map();
  let disposed = false;
  async function unsubscribe(id) {
    const record = active.get(id);
    if (!record) return;
    clearTimeout(record.timer);
    active.delete(id);
    await call(record.audio ? "audio.unsubscribeFrames" : "events.unsubscribe", { subscriptionId: id });
  }
  async function subscribe(topics, callback, audio = false, onError) {
    if (disposed) throw new Error("Plugin instance has been disposed");
    const { subscriptionId: id } = await call(audio ? "audio.subscribeFrames" : "events.subscribe", audio ? {} : { topics });
    const record = { audio };
    active.set(id, record);
    if (disposed) {
      await unsubscribe(id);
      return id;
    }
    async function poll() {
      try {
        const events = await call("events.poll", { subscriptionId: id });
        if (!active.has(id)) return;
        for (const event of events) {
          if (!active.has(id)) break;
          callback(event);
        }
        if (active.has(id)) record.timer = setTimeout(poll, audio ? 50 : 500);
      } catch (error) {
        if (active.has(id)) {
          void unsubscribe(id).catch(() => {
          });
          onError?.(error);
        }
      }
    }
    void poll();
    return id;
  }
  return {
    events: { subscribe: (topics, callback, onError) => subscribe(topics, callback, false, onError), unsubscribe },
    audio: {
      subscribeFrames: (callback, onError) => subscribe([], (event) => callback(event.data), true, onError),
      unsubscribeFrames: unsubscribe
    },
    dispose() {
      disposed = true;
      for (const id of active.keys()) void unsubscribe(id).catch(() => {
      });
    }
  };
}

// packages/plugin-sdk/src/separation.ts
function createSeparation(call) {
  return {
    chooseInput: (kind) => call("separation.chooseInput", { kind }),
    getEnvironment: () => call("separation.getEnvironment"),
    checkEnvironment: () => call("separation.checkEnvironment"),
    prepareEnvironment: () => call("separation.prepareEnvironment"),
    cancelEnvironment: () => call("separation.cancelEnvironment"),
    getTask: () => call("separation.getTask"),
    getBatch: () => call("separation.getBatch"),
    startBatch: (source) => call("separation.startBatch", { source }),
    cancelBatch: () => call("separation.cancelBatch"),
    getOutputDirectory: () => call("separation.getOutputDirectory"),
    revealOutput: (reference) => call("separation.revealOutput", { reference })
  };
}

// packages/plugin-sdk/src/client.ts
var PluginApiError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "PluginApiError";
  }
};
function createMono(transport, options = {}) {
  let sequence = 0;
  let disposed = false;
  const pending = /* @__PURE__ */ new Map();
  const stop = transport.subscribe((response) => {
    const request = pending.get(response.requestId);
    if (!request) return;
    pending.delete(response.requestId);
    clearTimeout(request.timer);
    if (response.ok) request.resolve(response.data);
    else request.reject(new PluginApiError(response.error.code, response.error.message));
  });
  function call(method, params = {}) {
    const timeout = options.timeoutMs ?? (method === "separation.chooseInput" ? 3e5 : 15e3);
    if (disposed) return Promise.reject(new PluginApiError("CANCELLED", "Plugin instance has been disposed"));
    const requestId = String(++sequence);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new PluginApiError("TIMEOUT", `Request timed out: ${method}`));
      }, timeout);
      pending.set(requestId, { resolve: (value) => resolve(value), reject, timer });
      try {
        transport.send({ apiVersion: API_VERSION, requestId, method, params });
      } catch (error) {
        clearTimeout(timer);
        pending.delete(requestId);
        reject(error);
      }
    });
  }
  const subscriptions = createSubscriptions(call);
  return {
    events: subscriptions.events,
    audio: subscriptions.audio,
    ...createFeatures(call),
    separation: createSeparation(call),
    tasks: { list: () => call("tasks.list"), get: (taskId) => call("tasks.get", { taskId }), cancel: (taskId) => call("tasks.cancel", { taskId }) },
    host: { getInfo: () => call("host.getInfo") },
    library: {
      listArtists: (params = {}) => call("library.listArtists", params),
      listAlbums: (params = {}) => call("library.listAlbums", params),
      listTracks: (params = {}) => call("library.listTracks", params),
      getTrack: (trackId) => call("library.getTrack", { trackId }),
      removeTrack: (trackId) => call("library.removeTrack", { trackId })
    },
    config: {
      get: () => call("config.get"),
      set: (config) => call("config.set", { config })
    },
    player: {
      getState: () => call("player.getState"),
      playTrack: (trackId) => call("player.playTrack", { trackId }),
      play: () => call("player.play"),
      pause: () => call("player.pause"),
      stop: () => call("player.stop"),
      next: () => call("player.next"),
      previous: () => call("player.previous"),
      seek: (position) => call("player.seek", { position }),
      setVolume: (volume) => call("player.setVolume", { volume }),
      setMuted: (muted) => call("player.setMuted", { muted }),
      setRate: (rate) => call("player.setRate", { rate }),
      setMode: (mode) => call("player.setMode", { mode })
    },
    dispose() {
      if (disposed) return;
      subscriptions.dispose();
      disposed = true;
      stop();
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(new PluginApiError("CANCELLED", "Plugin instance has been disposed"));
      }
      pending.clear();
    }
  };
}

// packages/plugin-sdk/src/messagePort.ts
function messagePortTransport(port) {
  return {
    send: (request) => port.postMessage(request),
    subscribe(listener) {
      const receive = (event) => {
        const response = event.data;
        if (!response || typeof response.requestId !== "string" || typeof response.ok !== "boolean") return;
        if (!response.ok && (!response.error || typeof response.error.code !== "string" || typeof response.error.message !== "string")) return;
        listener(response);
      };
      port.addEventListener("message", receive);
      port.start();
      return () => {
        port.removeEventListener("message", receive);
        port.close();
      };
    }
  };
}

// packages/plugin-sdk/src/connect.ts
function connectToHost(options = {}) {
  return new Promise((resolve, reject) => {
    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener("message", receive);
      options.signal?.removeEventListener("abort", abort);
    }
    function receive(event) {
      if (event.source !== window.parent || window.parent === window || event.data?.type !== "mono:connect" || event.data.apiVersion !== 1 || event.ports.length !== 1) return;
      cleanup();
      resolve(createMono(messagePortTransport(event.ports[0])));
    }
    function abort() {
      cleanup();
      reject(new Error("Plugin connection cancelled"));
    }
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Plugin host connection timed out"));
    }, options.timeoutMs ?? 15e3);
    window.addEventListener("message", receive);
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
  });
}

// packages/plugin-sdk/src/renderer.ts
async function mountRenderer(renderer2, root) {
  const abort = new AbortController();
  const pending = /* @__PURE__ */ new Map();
  const order = ["track", "lyrics", "queue", "background", "config", "playback", "lyrics-ui"];
  let ready = false;
  let disposed = false;
  let mounting = false;
  let started = false;
  let destroyed = false;
  let mono;
  let deliveries = Promise.resolve();
  let trackKey = "";
  function destroy() {
    if (!started || mounting || destroyed) return;
    destroyed = true;
    renderer2.destroy?.();
  }
  function deliver(message) {
    deliveries = deliveries.then(async () => {
      if (disposed) return;
      if (message.type === "track") trackKey = String(message.trackKey ?? "");
      if (message.type === "lyrics" && String(message.trackKey ?? "") !== trackKey) return;
      await renderer2.update(message);
    }).catch((error) => {
      root.setAttribute("data-renderer-error", String(error));
    });
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    abort.abort();
    pending.clear();
    mono?.dispose();
    destroy();
  }
  window.addEventListener("pagehide", dispose, { once: true, signal: abort.signal });
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || window.parent === window || event.data?.apiVersion !== 1 || event.data.type !== "mono:renderer-update") return;
    const message = event.data.message;
    if (!message || typeof message !== "object") return;
    if (message.type === "audio-frame") {
      if (ready) renderer2.updateAudioFrame?.(message.frame);
    } else if (order.includes(message.type)) {
      if (ready) deliver(message);
      else pending.set(message.type, message);
    }
  }, { signal: abort.signal });
  try {
    mono = await connectToHost({ signal: abort.signal });
    if (disposed) {
      mono.dispose();
      return dispose;
    }
    started = true;
    mounting = true;
    try {
      await renderer2.mount(root, mono);
    } finally {
      mounting = false;
      if (disposed) destroy();
    }
    if (disposed) return dispose;
    ready = true;
    for (const type of order) {
      const message = pending.get(type);
      if (message) deliver(message);
    }
    pending.clear();
    window.parent.postMessage({ type: "mono:renderer-ready", apiVersion: 1 }, "*");
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}

// plugin-page.ts
mountRenderer(renderer, document.body).catch((error) => {
  document.body.textContent = String(error);
});
