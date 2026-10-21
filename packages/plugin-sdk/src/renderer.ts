import { connectToHost } from './connect';
import type { createMono } from './client';

interface Renderer {
  mount(root: HTMLElement, mono: ReturnType<typeof createMono>): void | Promise<void>;
  update(message: Record<string, unknown>): void | Promise<void>;
  updateAudioFrame?(frame: unknown): void;
  destroy?(): void;
}

// Presentation updates are host-owned inputs, separate from plugin API requests.
// The host filters their fields and checks read permissions before publishing them.
export async function mountRenderer(renderer: Renderer, root: HTMLElement) {
  const abort = new AbortController();
  const pending = new Map<string, Record<string, unknown>>();
  const order = ['track', 'lyrics', 'queue', 'background', 'config', 'playback', 'lyrics-ui'];
  let ready = false;
  let disposed = false;
  let mounting = false;
  let started = false;
  let destroyed = false;
  let mono: ReturnType<typeof createMono> | undefined;
  let deliveries = Promise.resolve();
  let trackKey = '';
  function destroy() {
    if (!started || mounting || destroyed) return;
    destroyed = true;
    renderer.destroy?.();
  }
  function deliver(message: Record<string, unknown>) {
    deliveries = deliveries.then(async () => {
      if (disposed) return;
      if (message.type === 'track') trackKey = String(message.trackKey ?? '');
      if (message.type === 'lyrics' && String(message.trackKey ?? '') !== trackKey) return;
      await renderer.update(message);
    }).catch(error => { root.setAttribute('data-renderer-error', String(error)); });
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    abort.abort();
    pending.clear();
    mono?.dispose();
    destroy();
  }
  window.addEventListener('pagehide', dispose, { once: true, signal: abort.signal });
  window.addEventListener('message', event => {
    if (event.source !== window.parent || window.parent === window || event.data?.apiVersion !== 1
      || event.data.type !== 'mono:renderer-update') return;
    const message = event.data.message;
    if (!message || typeof message !== 'object') return;
    if (message.type === 'audio-frame') {
      if (ready) renderer.updateAudioFrame?.(message.frame);
    } else if (order.includes(message.type)) {
      if (ready) deliver(message);
      else pending.set(message.type, message);
    }
  }, { signal: abort.signal });
  try {
    mono = await connectToHost({ signal: abort.signal });
    if (disposed) { mono.dispose(); return dispose; }
    started = true;
    mounting = true;
    try { await renderer.mount(root, mono); }
    finally { mounting = false; if (disposed) destroy(); }
    if (disposed) return dispose;
    ready = true;
    for (const type of order) {
      const message = pending.get(type);
      if (message) deliver(message);
    }
    pending.clear();
    window.parent.postMessage({ type: 'mono:renderer-ready', apiVersion: 1 }, '*');
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}
