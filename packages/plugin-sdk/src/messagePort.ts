import type { Transport } from './client';
import type { ApiResponse } from './protocol';

// The host transfers a dedicated port only after binding it to an authorized instance.
export function messagePortTransport(port: MessagePort): Transport {
  return {
    send: request => port.postMessage(request),
    subscribe(listener) {
      const receive = (event: MessageEvent<ApiResponse>) => {
        const response = event.data;
        if (!response || typeof response.requestId !== 'string' || typeof response.ok !== 'boolean') return;
        if (!response.ok && (!response.error || typeof response.error.code !== 'string' || typeof response.error.message !== 'string')) return;
        listener(response);
      };
      port.addEventListener('message', receive);
      port.start();
      return () => { port.removeEventListener('message', receive); port.close(); };
    },
  };
}
