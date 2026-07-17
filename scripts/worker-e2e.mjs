import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const tauriDir = path.join(repoRoot, "src-tauri");
const exeName = process.platform === "win32" ? "mono-player.exe" : "mono-player";
const appExe = path.join(tauriDir, "target", "debug", exeName);

let requestIndex = 0;

class WorkerClient {
  constructor(flag, args = []) {
    this.name = flag.replace(/^--mono-/, "").replace(/-worker$/, "");
    this.pending = new Map();
    this.events = [];
    this.eventWaiters = [];
    this.stderr = "";
    this.stdoutBuffer = "";
    this.process = spawn(appExe, [flag, ...args], {
      cwd: tauriDir,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    this.process.stdout.setEncoding("utf8");
    this.process.stderr.setEncoding("utf8");
    this.process.stdout.on("data", (chunk) => this.handleStdout(chunk));
    this.process.stderr.on("data", (chunk) => {
      this.stderr += chunk;
    });
    this.process.on("exit", (code, signal) => {
      const error = new Error(
        `${this.name} worker exited before response: code=${code} signal=${signal} stderr=${this.stderr.trim()}`,
      );
      for (const { reject } of this.pending.values()) {
        reject(error);
      }
      this.pending.clear();
      for (const waiter of this.eventWaiters) {
        clearTimeout(waiter.timeout);
      }
      this.eventWaiters = [];
    });
  }

  handleStdout(chunk) {
    this.stdoutBuffer += chunk;
    for (;;) {
      const newline = this.stdoutBuffer.indexOf("\n");
      if (newline < 0) {
        break;
      }
      const line = this.stdoutBuffer.slice(0, newline).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (!line) {
        continue;
      }

      let message;
      try {
        message = JSON.parse(line);
      } catch (error) {
        throw new Error(`${this.name} worker emitted invalid JSON: ${line}: ${error.message}`);
      }

      if (message.type === "event") {
        this.events.push(message);
        this.eventWaiters = this.eventWaiters.filter((waiter) => {
          if (!waiter.match(message)) {
            return true;
          }
          clearTimeout(waiter.timeout);
          waiter.resolve(message);
          return false;
        });
        continue;
      }

      if (message.type === "response") {
        const pending = this.pending.get(message.id);
        if (pending) {
          this.pending.delete(message.id);
          pending.resolve(message);
        }
      }
    }
  }

  request(method, payload = {}) {
    const id = `${this.name}-${++requestIndex}`;
    const line = `${JSON.stringify({ id, method, payload })}\n`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${this.name} worker timed out waiting for ${method}`));
      }, 30000);
      this.pending.set(id, {
        resolve: (message) => {
          clearTimeout(timeout);
          resolve(message);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      this.process.stdin.write(line, "utf8");
    });
  }

  async expectOk(method, payload = {}) {
    const response = await this.request(method, payload);
    if (!response.ok) {
      throw new Error(`${this.name} ${method} failed: ${response.error}`);
    }
    return response.payload;
  }

  waitForEvent(match, timeoutMs = 30000) {
    const existing = this.events.find(match);
    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const waiter = {
        match,
        resolve,
        timeout: setTimeout(() => {
          this.eventWaiters = this.eventWaiters.filter((item) => item !== waiter);
          reject(new Error(`${this.name} worker timed out waiting for event`));
        }, timeoutMs),
      };
      this.eventWaiters.push(waiter);
    });
  }

  async shutdown() {
    if (this.process.exitCode !== null) {
      return;
    }
    try {
      await this.request("worker.shutdown");
    } catch {
      this.process.kill();
    }
  }
}

function ensureDebugExe() {
  if (existsSync(appExe)) {
    return;
  }
  const result = spawnSync("cargo", ["build"], {
    cwd: tauriDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error("cargo build failed");
  }
}

function createWavBuffer() {
  const sampleRate = 8000;
  const seconds = 1;
  const samples = sampleRate * seconds;
  const dataBytes = samples * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);

  for (let index = 0; index < samples; index += 1) {
    const value = Math.round(Math.sin((index / sampleRate) * 440 * Math.PI * 2) * 12000);
    buffer.writeInt16LE(value, 44 + index * 2);
  }

  return buffer;
}

async function startFixtureServer(wavBuffer) {
  const catalog = JSON.stringify({
    plugins: [
      {
        id: "fixture",
        name: "Fixture Plugin",
        enabled: true,
        capabilities: ["search", "play"],
      },
    ],
  });

  const server = createServer((request, response) => {
    if (request.url === "/tone.wav") {
      response.writeHead(200, {
        "content-type": "audio/wav",
        "content-length": wavBuffer.length,
      });
      response.end(wavBuffer);
      return;
    }
    if (request.url === "/catalog.json") {
      response.writeHead(200, {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(catalog),
      });
      response.end(catalog);
      return;
    }
    response.writeHead(404);
    response.end("not found");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  ensureDebugExe();

  const tempRoot = await mkdtemp(path.join(tmpdir(), "mono-worker-e2e-"));
  const cacheDir = path.join(tempRoot, "cache");
  const downloadDir = path.join(tempRoot, "downloads");
  const scanDir = path.join(tempRoot, "scan");
  await mkdir(cacheDir, { recursive: true });
  await mkdir(downloadDir, { recursive: true });
  await mkdir(scanDir, { recursive: true });

  const wavBuffer = createWavBuffer();
  const scanFile = path.join(scanDir, "fixture.wav");
  await writeFile(scanFile, wavBuffer);
  const server = await startFixtureServer(wavBuffer);

  const clients = [];
  try {
    const audio = new WorkerClient("--mono-audio-worker", [cacheDir]);
    clients.push(audio);
    const audioHealth = await audio.expectOk("worker.health");
    expect(audioHealth.worker === "audio", "audio health returned wrong worker name");
    await audio.expectOk("player.state");
    await audio.expectOk("player.outputDevices");
    if (process.env.MONO_E2E_AUDIO_PLAYBACK === "1") {
      await audio.expectOk("player.playUrl", {
        url: `${server.baseUrl}/tone.wav`,
        restart: true,
        fade: false,
        fadeDurationMs: null,
      });
      await audio.expectOk("player.stop", { fade: false });
    }

    const download = new WorkerClient("--mono-download-worker");
    clients.push(download);
    const downloadPayload = await download.expectOk("download.track", {
      taskId: "fixture-download",
      request: {
        taskId: "fixture-download",
        url: `${server.baseUrl}/tone.wav`,
        downloadDir,
        title: "Fixture Tone",
        artist: "Mono",
        album: "E2E",
        duration: 1,
        lyrics: "[00:00.00]fixture",
        artwork: null,
      },
    });
    expect(existsSync(downloadPayload.filePath), "download worker did not create audio file");
    expect(
      download.events.some((event) => event.name === "download.event" && event.payload.status === "downloaded"),
      "download worker did not emit downloaded event",
    );
    await download.expectOk("download.enqueue", {
      taskId: "fixture-enqueue",
      request: {
        taskId: "fixture-enqueue",
        url: `${server.baseUrl}/tone.wav`,
        downloadDir,
        title: "Queued Fixture Tone",
        artist: "Mono",
        album: "E2E",
        duration: 1,
        lyrics: "[00:00.00]queued fixture",
        artwork: null,
      },
    });
    const queuedDownloaded = await download.waitForEvent((event) => {
      return (
        event.name === "download.event" &&
        event.payload.taskId === "fixture-enqueue" &&
        event.payload.status === "downloaded"
      );
    });
    expect(existsSync(queuedDownloaded.payload.filePath), "queued download did not create audio file");

    const plugin = new WorkerClient("--mono-plugin-worker");
    clients.push(plugin);
    const catalog = await plugin.expectOk("plugin.fetchCatalog", {
      url: `${server.baseUrl}/catalog.json`,
    });
    expect(catalog.includes("Fixture Plugin"), "plugin catalog response did not include fixture");
    const httpResponse = await plugin.expectOk("plugin.httpRequest", {
      method: "GET",
      url: `${server.baseUrl}/catalog.json`,
      headers: null,
      data: null,
      pluginId: "fixture-plugin",
      permissions: ["network"],
    });
    expect(httpResponse.status === 200, "plugin HTTP request did not return 200");

    const scan = new WorkerClient("--mono-scan-worker");
    clients.push(scan);
    const scanPayload = await scan.expectOk("scan.musicDir", { path: scanDir });
    expect(scanPayload.tracks === 1, "scan worker did not report one track");
    expect(
      scan.events.some((event) => event.name === "scan.track" && event.payload.path.endsWith("fixture.wav")),
      "scan worker did not emit scan.track for fixture.wav",
    );

    const downloaded = await readFile(downloadPayload.filePath);
    expect(downloaded.length > 0, "downloaded fixture is empty");

    console.log("worker E2E passed");
    if (process.env.MONO_E2E_KEEP_TEMP === "1") {
      console.log(`fixture root: ${tempRoot}`);
    }
  } finally {
    await Promise.allSettled(clients.map((client) => client.shutdown()));
    await server.close();
    if (process.env.MONO_E2E_KEEP_TEMP !== "1") {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
