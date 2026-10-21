import { createMono } from './client';
import { messagePortTransport } from './messagePort';

// Install this listener before the iframe load event (for example in its module entry).
export function connectToHost(options: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<ReturnType<typeof createMono>> {
  return new Promise((resolve, reject) => {
    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener('message', receive);
      options.signal?.removeEventListener('abort', abort);
    }
    function receive(event: MessageEvent) {
      if (event.source !== window.parent || window.parent === window || event.data?.type !== 'mono:connect'
        || event.data.apiVersion !== 1 || event.ports.length !== 1) return;
      cleanup();
      resolve(createMono(messagePortTransport(event.ports[0])));
    }
    function abort() { cleanup(); reject(new Error('Plugin connection cancelled')); }
    const timer = setTimeout(() => { cleanup(); reject(new Error('Plugin host connection timed out')); }, options.timeoutMs ?? 15_000);
    window.addEventListener('message', receive);
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
  });
}
