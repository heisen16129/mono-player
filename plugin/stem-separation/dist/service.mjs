// plugin/stem-separation/backend/service.mjs
import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync as readFileSync2, mkdirSync as mkdirSync4, realpathSync as realpathSync2 } from "node:fs";
import { basename as basename2, join as join4 } from "node:path";

// packages/plugin-sdk/dist/client.mjs
var API_VERSION = 1;
function createFeatures(call) {
  return {
    service: { getConnection: () => call("service.getConnection") },
    files: {
      choose: (kind) => call("files.choose", { kind }),
      reveal: (path) => call("files.reveal", { path })
    },
    speaker: {
      getConnection: () => call("speaker.getConnection")
    },
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
    const timeout = options.timeoutMs ?? (method === "files.choose" ? 3e5 : 15e3);
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
      set: (config2) => call("config.set", { config: config2 })
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

// plugin/stem-separation/backend/environment.mjs
import { existsSync as existsSync2, mkdirSync as mkdirSync2 } from "node:fs";
import { join as join2 } from "node:path";
import { fileURLToPath } from "node:url";

// plugin/stem-separation/backend/process.mjs
import { spawn } from "node:child_process";
function run(program, args, { signal, env, onLine, input, timeout = 18e5 } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("\u5DF2\u53D6\u6D88"));
    const child = spawn(program, args, { windowsHide: true, env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "pipe"] });
    let tail = "", buffer = "", settled = false, eventError;
    const stop = () => {
      if (process.platform === "win32" && child.pid) {
        const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
        killer.on("error", () => child.kill());
      } else child.kill();
    };
    const timer = setTimeout(stop, timeout);
    signal?.addEventListener("abort", stop, { once: true });
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
      error ? reject(error) : resolve(tail);
    };
    child.stderr.on("data", (data2) => {
      tail = (tail + data2.toString()).slice(-16e3);
    });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (data2) => {
      buffer += data2;
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        try {
          onLine?.(line);
        } catch (error) {
          eventError = error;
          stop();
        }
      }
    });
    child.on("error", finish);
    child.on("close", (code) => finish(signal?.aborted ? new Error("\u5DF2\u53D6\u6D88") : eventError || (code === 0 ? null : new Error(tail || `\u8FDB\u7A0B\u9000\u51FA\uFF1A${code}`))));
    child.stdin.on("error", () => {
    });
    child.stdin.end(input);
  });
}

// plugin/stem-separation/backend/bootstrap.mjs
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
async function prepareUv(root, signal) {
  const arch = { x64: "x86_64", arm64: "aarch64" }[process.arch];
  const platform = { win32: "pc-windows-msvc", darwin: "apple-darwin", linux: "unknown-linux-musl" }[process.platform];
  if (!arch || !platform) throw new Error("\u5F53\u524D\u7CFB\u7EDF\u6682\u4E0D\u652F\u6301\u81EA\u52A8\u51C6\u5907\u73AF\u5883\uFF0C\u8BF7\u914D\u7F6E Python \u8DEF\u5F84");
  const asset = `uv-${arch}-${platform}`, extension = process.platform === "win32" ? "zip" : "tar.gz";
  const tools = join(root, "tools");
  mkdirSync(tools, { recursive: true });
  const executable = process.platform === "win32" ? join(tools, "uv.exe") : join(tools, asset, "uv");
  if (existsSync(executable)) return executable;
  const base = `https://github.com/astral-sh/uv/releases/download/0.10.7/${asset}.${extension}`;
  const response = async (url) => {
    const result = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(12e4)]) });
    if (!result.ok) throw new Error(`\u73AF\u5883\u7EC4\u4EF6\u4E0B\u8F7D\u5931\u8D25\uFF1A${result.status}`);
    return result;
  };
  const expected = (await (await response(`${base}.sha256`)).text()).trim().split(/\s+/)[0];
  if (!/^[0-9a-f]{64}$/i.test(expected)) throw new Error("\u7EC4\u4EF6\u6821\u9A8C\u4FE1\u606F\u65E0\u6548");
  const chunks = [];
  let size = 0;
  for await (const chunk of (await response(base)).body) {
    size += chunk.length;
    if (size > 64 * 1024 * 1024) throw new Error("\u7EC4\u4EF6\u8D85\u51FA\u5927\u5C0F\u9650\u5236");
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (createHash("sha256").update(bytes).digest("hex") !== expected.toLowerCase()) throw new Error("\u7EC4\u4EF6\u6587\u4EF6\u6821\u9A8C\u5931\u8D25");
  const archive = join(tools, `uv.${extension}`);
  writeFileSync(archive, bytes);
  await run("tar", ["-xf", archive, "-C", tools], { signal, timeout: 6e4 });
  if (!existsSync(executable)) throw new Error("\u73AF\u5883\u7EC4\u4EF6\u89E3\u538B\u5931\u8D25");
  return executable;
}

// plugin/stem-separation/backend/environment.mjs
var backend = fileURLToPath(new URL("../backend/", import.meta.url));
var Environment = class {
  constructor(root, config2) {
    this.root = root;
    this.config = config2;
    this.status = { stage: "idle", message: "\u8BF7\u68C0\u67E5\u8FD0\u884C\u73AF\u5883", pythonPath: null };
  }
  busy() {
    return ["checking", "installing", "cancelling"].includes(this.status.stage);
  }
  begin(install = false) {
    if (this.busy()) return this.status;
    this.abort = new AbortController();
    this.status = { stage: install ? "installing" : "checking", message: "\u6B63\u5728\u68C0\u67E5\u5206\u79BB\u73AF\u5883\u2026", pythonPath: null };
    this.pending = this.prepare(install).catch((error) => {
      this.status = { stage: this.abort.signal.aborted ? "cancelled" : "error", message: error.message, pythonPath: null };
    });
    return this.status;
  }
  cancel() {
    if (this.busy()) {
      this.status.stage = "cancelling";
      this.abort.abort();
    }
  }
  async prepare(install) {
    const config2 = await this.config();
    const python = join2(this.root, "venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
    const candidates = [
      config2.pythonPath,
      python,
      process.env.LOCALAPPDATA && join2(process.env.LOCALAPPDATA, "MonoDemucs/Scripts/python.exe")
    ].filter((p) => p && existsSync2(p));
    const options = { signal: this.abort.signal, env: { TORCH_HOME: join2(this.root, "models") } };
    for (const path of [...new Set(candidates)]) {
      try {
        await run(path, ["-I", "-u", join2(backend, "check_environment.py")], { ...options, timeout: 9e4 });
        this.status = { stage: "ready", message: "\u5206\u79BB\u73AF\u5883\u5DF2\u5C31\u7EEA", pythonPath: path };
        return;
      } catch (error) {
        if (this.abort.signal.aborted) throw error;
      }
    }
    if (!install) {
      this.status = { stage: "missing", message: "\u9996\u6B21\u4F7F\u7528\u9700\u8981\u51C6\u5907\u5206\u79BB\u7EC4\u4EF6", pythonPath: null };
      return;
    }
    mkdirSync2(this.root, { recursive: true });
    this.status.message = "\u6B63\u5728\u51C6\u5907\u72EC\u7ACB Python \u73AF\u5883\u2026";
    const uv = await prepareUv(this.root, this.abort.signal);
    options.env.UV_PYTHON_INSTALL_DIR = join2(this.root, "python");
    options.env.UV_CACHE_DIR = join2(this.root, "cache");
    await run(uv, ["venv", "--managed-python", "--python", "3.12", join2(this.root, "venv")], options);
    this.status.message = "\u6B63\u5728\u5B89\u88C5\u5206\u79BB\u5F15\u64CE\u2026";
    await run(uv, [
      "pip",
      "install",
      "--python",
      python,
      "torch==2.5.1",
      "torchaudio==2.5.1",
      ...process.platform === "darwin" ? [] : ["--index-url", "https://download.pytorch.org/whl/cpu"]
    ], options);
    await run(uv, ["pip", "install", "--python", python, "-r", join2(backend, "requirements.txt")], options);
    this.status.message = "\u6B63\u5728\u51C6\u5907\u5206\u79BB\u6A21\u578B\u2026";
    await run(python, ["-I", "-u", join2(backend, "check_environment.py"), join2(this.root, "models")], options);
    this.status = { stage: "ready", message: "\u5206\u79BB\u73AF\u5883\u5DF2\u5C31\u7EEA", pythonPath: python };
  }
};

// plugin/stem-separation/backend/jobs.mjs
import { createHash as createHash2, randomUUID } from "node:crypto";
import { existsSync as existsSync3, mkdirSync as mkdirSync3, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync as writeFileSync2 } from "node:fs";
import { basename, extname, join as join3, relative, isAbsolute } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var worker = fileURLToPath2(new URL("../backend/worker.py", import.meta.url));
var extensions = /* @__PURE__ */ new Set([".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".wma", ".mp4"]);
function inside(root, path) {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith("../") && !rel.startsWith("..\\");
}
function collect(source, output) {
  const files = [];
  function visit(path) {
    const entry = statSync(path);
    if (entry.isFile()) {
      if (extensions.has(extname(path).toLowerCase())) files.push(path);
      return;
    }
    for (const item of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const next = join3(path, item.name);
      if (item.isSymbolicLink() || inside(output, next)) continue;
      if (item.isDirectory() || item.isFile()) visit(next);
    }
  }
  visit(realpathSync(source));
  return files;
}
function cacheKey(source) {
  const path = realpathSync(source), stat = statSync(path, { bigint: true });
  return createHash2("sha256").update(`htdemucs_6s:${path}:${stat.size}:${stat.mtimeNs}`).digest("hex");
}
var Jobs = class {
  constructor(root, environment2, config2, runner = run) {
    this.output = join3(root, "output");
    this.environment = environment2;
    this.config = config2;
    this.runner = runner;
    mkdirSync3(this.output, { recursive: true });
    this.batch = null;
    this.task = null;
  }
  busy() {
    return this.batch && ["scanning", "running", "cancelling"].includes(this.batch.stage);
  }
  cached(source) {
    const output = join3(this.output, cacheKey(source));
    try {
      const name = readFileSync(join3(output, "ready.txt"), "utf8").trim();
      const directory = realpathSync(join3(output, name));
      if (!inside(output, directory)) return null;
      const vocalsPath = join3(directory, "vocals.wav"), accompanimentPath = join3(directory, "accompaniment.wav");
      return existsSync3(vocalsPath) && existsSync3(accompanimentPath) ? { vocalsPath, accompanimentPath } : null;
    } catch {
      return null;
    }
  }
  start(source) {
    if (this.busy() || this.environment.busy()) throw new Error("\u5DF2\u6709\u4EFB\u52A1\u6B63\u5728\u8FD0\u884C\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
    if (this.environment.status.stage !== "ready") throw new Error("\u8BF7\u5148\u51C6\u5907\u5206\u79BB\u73AF\u5883");
    const files = collect(source, this.output);
    if (!files.length) throw new Error("\u6CA1\u6709\u652F\u6301\u7684\u97F3\u9891\u6587\u4EF6");
    this.abort = new AbortController();
    this.started = Date.now();
    this.task = null;
    this.task = {
      id: randomUUID(),
      pluginId: "mono-wasm-stem-separation",
      stage: "loading",
      progress: null,
      device: null,
      message: null,
      outputDir: this.output,
      vocalsPath: null,
      accompanimentPath: null
    };
    this.batch = {
      id: randomUUID(),
      stage: "running",
      elapsedMs: 0,
      source: basename(source),
      outputDir: this.output,
      message: null,
      current: null,
      items: files.map((path, i) => ({ id: `item:${i}`, source: basename(path), stage: "pending", message: null, vocalsPath: null, accompanimentPath: null }))
    };
    this.pending = this.execute(files);
    return this.batch;
  }
  cancel() {
    if (this.busy()) {
      this.batch.stage = "cancelling";
      this.abort.abort();
    }
  }
  snapshot() {
    if (this.busy()) this.batch.elapsedMs = Date.now() - this.started;
    return this.batch;
  }
  async execute(files) {
    try {
      const config2 = await this.config();
      const device = config2.device || "auto";
      if (!["auto", "cpu", "cuda", "mps"].includes(device)) throw new Error("\u4E0D\u652F\u6301\u7684\u8BA1\u7B97\u8BBE\u5907");
      for (const [i, source] of files.entries()) {
        if (this.abort.signal.aborted) break;
        const item = this.batch.items[i], cached = this.cached(source);
        if (cached) {
          Object.assign(item, cached, { stage: "done" });
          if (i === 0) Object.assign(this.task, cached, { stage: "done", progress: 100 });
          continue;
        }
        const parent = join3(this.output, cacheKey(source)), output = join3(parent, randomUUID());
        mkdirSync3(output, { recursive: true });
        const task = this.task = {
          id: i === 0 ? this.task.id : randomUUID(),
          pluginId: "mono-wasm-stem-separation",
          stage: "loading",
          progress: null,
          device: null,
          message: null,
          outputDir: output,
          vocalsPath: null,
          accompanimentPath: null
        };
        this.batch.current = task;
        item.stage = "running";
        try {
          const request = { source, outputDir: output, cacheDir: join3(this.environment.root, "models"), model: "htdemucs_6s", device };
          await this.runner(this.environment.status.pythonPath, ["-I", "-u", worker, JSON.stringify(request)], {
            signal: this.abort.signal,
            timeout: 864e5,
            onLine: (line) => {
              const event = JSON.parse(line);
              Object.assign(task, event, event.stage === "done" ? { stage: "exporting" } : {});
              if (event.stage === "error") throw new Error(event.message);
            }
          });
          if (this.abort.signal.aborted) throw new Error("\u5DF2\u53D6\u6D88");
          const vocalsPath = join3(output, "vocals.wav"), accompanimentPath = join3(output, "accompaniment.wav");
          if (!existsSync3(vocalsPath) || !existsSync3(accompanimentPath)) throw new Error("\u5206\u79BB\u8F93\u51FA\u4E0D\u5B8C\u6574");
          writeFileSync2(join3(parent, "ready.txt"), basename(output));
          Object.assign(task, { stage: "done", progress: 100, vocalsPath, accompanimentPath });
          Object.assign(item, { stage: "done", vocalsPath, accompanimentPath });
        } catch (error) {
          rmSync(output, { recursive: true, force: true });
          Object.assign(task, { stage: this.abort.signal.aborted ? "cancelled" : "error", message: error.message });
          Object.assign(item, { stage: task.stage, message: error.message });
        }
      }
      this.batch.stage = this.abort.signal.aborted ? "cancelled" : this.batch.items.some((item) => item.stage === "error") ? "error" : "done";
    } catch (error) {
      this.batch.stage = this.abort.signal.aborted ? "cancelled" : "error";
      this.batch.message = error.message;
    } finally {
      if (this.task && !["done", "error", "cancelled"].includes(this.task.stage)) Object.assign(this.task, { stage: this.batch.stage, message: this.batch.message });
      this.batch.elapsedMs = Date.now() - this.started;
    }
  }
};

// plugin/stem-separation/backend/service.mjs
var [connectionFile, data] = process.argv.slice(2);
mkdirSync4(data, { recursive: true });
var connection = JSON.parse(readFileSync2(connectionFile, "utf8"));
var endpoint = new URL(connection.endpoint);
if (endpoint.protocol !== "http:" || endpoint.hostname !== "127.0.0.1") throw new Error("\u65E0\u6548\u5BBF\u4E3B\u8FDE\u63A5");
var receive;
var mono = createMono({
  subscribe(listener) {
    receive = listener;
    return () => {
      receive = void 0;
    };
  },
  send(request) {
    fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${connection.sessionToken}`, "Content-Type": "application/json" }, body: JSON.stringify(request) }).then((r) => r.json()).then((response) => receive?.(response)).catch((error) => receive?.({ requestId: request.requestId, ok: false, error: { code: "INTERNAL", message: error.message } }));
  }
});
var config = () => mono.config.get();
var environment = new Environment(join4(data, "environment"), config);
var jobs = new Jobs(data, environment, config);
var token = randomBytes(32).toString("hex");
var authorized = (value) => {
  const a = Buffer.from(value || ""), b = Buffer.from(`Bearer ${token}`);
  return a.length === b.length && timingSafeEqual(a, b);
};
var methods = {
  getEnvironment: () => environment.status,
  checkEnvironment: () => {
    if (jobs.busy()) throw new Error("\u5206\u79BB\u4EFB\u52A1\u6B63\u5728\u8FD0\u884C");
    return environment.begin();
  },
  prepareEnvironment: () => {
    if (jobs.busy()) throw new Error("\u5206\u79BB\u4EFB\u52A1\u6B63\u5728\u8FD0\u884C");
    return environment.begin(true);
  },
  cancelEnvironment: () => environment.cancel(),
  getBatch: () => jobs.snapshot(),
  getTask: () => jobs.task,
  startBatch: ({ source }) => jobs.start(source),
  cancelBatch: ({ taskId } = {}) => {
    if (taskId && taskId !== jobs.task?.id) throw new Error("\u5206\u79BB\u4EFB\u52A1\u5DF2\u6539\u53D8");
    return jobs.cancel();
  },
  getOutputDirectory: () => jobs.output,
  prepareKaraoke: ({ source, checkOnly = false }) => {
    const cached = jobs.cached(source);
    if (cached || checkOnly) return { accompaniment: cached?.accompanimentPath ?? null, job: null };
    jobs.start(source);
    return { accompaniment: null, job: jobs.task ?? { id: jobs.batch.id, stage: "loading", pluginId: "mono-wasm-stem-separation" } };
  },
  validateOutput: ({ path }) => {
    const full = realpathSync2(path), root = realpathSync2(jobs.output);
    if (!inside(root, full)) throw new Error("\u65E0\u6548\u8F93\u51FA\u6587\u4EF6");
    return { path: full, name: basename2(full) };
  }
};
var server = http.createServer(async (req, res) => {
  const json = (status, value) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(value));
  };
  if (req.headers.host !== `127.0.0.1:${server.address().port}`) return json(403, { error: "Invalid host" });
  if (req.headers.origin === "null") {
    res.setHeader("Access-Control-Allow-Origin", "null");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    if (req.headers["access-control-request-private-network"] === "true") res.setHeader("Access-Control-Allow-Private-Network", "true");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
  }
  if (!authorized(req.headers.authorization)) return json(403, { error: "Unauthorized" });
  if (req.method !== "POST" || req.url !== "/rpc") return json(404, { error: "Not found" });
  try {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 65536) throw new Error("Request too large");
    }
    const { method, params = {} } = JSON.parse(body);
    if (!Object.hasOwn(methods, method)) return json(400, { error: "Unknown plugin method" });
    json(200, { data: await methods[method](params) ?? null });
  } catch (error) {
    json(400, { error: error.message });
  }
});
server.listen(0, "127.0.0.1", () => console.log(JSON.stringify({ url: `http://127.0.0.1:${server.address().port}/#${token}` })));
async function shutdown() {
  jobs.cancel();
  environment.cancel();
  await Promise.allSettled([jobs.pending, environment.pending]);
  mono.dispose();
  server.closeAllConnections();
  server.close();
}
process.stdin.resume();
process.stdin.on("end", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
