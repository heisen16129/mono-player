import { createMono } from '../../../../packages/plugin-sdk/dist/client.mjs';

export function connectHost(connection) {
  const endpoint = new URL(connection.endpoint);
  if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || endpoint.pathname !== '/plugin-api/v1' || !connection.sessionToken) {
    throw new Error('需要宿主提供的插件 v1 会话');
  }
  let receive;
  const requests = new Set();
  return createMono({
    subscribe(listener) {
      receive = listener;
      return () => { receive = undefined; for (const request of requests) request.abort(); requests.clear(); };
    },
    send(request) {
      const controller = new AbortController(); requests.add(controller);
      fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.sessionToken}` },
        body: JSON.stringify(request), signal: controller.signal,
      }).then(async response => {
        if (!response.ok) throw new Error('Plugin request failed');
        const result = await response.json();
        if (result.requestId !== request.requestId || typeof result.ok !== 'boolean') throw new Error('Invalid plugin response');
        receive?.(result);
      }).catch(() => receive?.({ requestId: request.requestId, ok: false, error: { code: 'INTERNAL', message: 'Host connection failed' } }))
        .finally(() => requests.delete(controller));
    },
  });
}
