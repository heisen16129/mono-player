import { invoke } from '@tauri-apps/api/core';
import type { ApiRequest, ApiResponse } from '../../packages/plugin-sdk/src/protocol';

function isRequest(value: unknown): value is ApiRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Partial<ApiRequest>;
  return request.apiVersion === 1 && typeof request.requestId === 'string'
    && request.requestId.length > 0 && request.requestId.length <= 128
    && typeof request.method === 'string' && Object.hasOwn(request, 'params');
}

// Call after a verified package page loads into an opaque-origin iframe.
// The host keeps the session ID; the plugin receives only its dedicated MessagePort.
export async function connectPluginPage(frame: HTMLIFrameElement, pluginId: string, pageId: string, revision: string,
  onConnected?: (present: (track: unknown) => Promise<any>) => void): Promise<() => void> {
  if (!frame.hasAttribute('sandbox') || frame.sandbox.contains('allow-same-origin') || !frame.sandbox.contains('allow-scripts')) {
    throw new Error('插件页面必须使用隔离沙箱');
  }
  const target = frame.contentWindow;
  if (!target) throw new Error('插件页面尚未加载');
  let closed = false;
  let sessionId: string | undefined;
  const channel = new MessageChannel();
  function dispose() {
    if (closed) return;
    closed = true;
    frame.removeEventListener('load', dispose);
    channel.port1.close();
    channel.port2.close();
    if (sessionId) void invoke('plugin_api_close', { sessionId }).catch(() => {});
  }
  // Navigation revokes this connection, including while session creation is pending.
  frame.addEventListener('load', dispose);
  try {
    sessionId = await invoke<string>('plugin_api_open', { pluginId, pageId, revision });
    if (closed) {
      await invoke('plugin_api_close', { sessionId });
      return dispose;
    }
    channel.port1.onmessage = async event => {
      if (closed || !isRequest(event.data)) return;
      const request = event.data;
      let response: ApiResponse;
      try { response = await invoke<ApiResponse>('plugin_api_request', { sessionId, request }); }
      catch { response = { requestId: request.requestId, ok: false, error: { code: 'INTERNAL', message: 'Plugin transport failed' } }; }
      if (!closed) channel.port1.postMessage(response);
    };
    channel.port1.start();
    target.postMessage({ type: 'mono:connect', apiVersion: 1 }, '*', [channel.port2]);
    onConnected?.(track => invoke('plugin_api_presentation', { sessionId, track }));
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}
