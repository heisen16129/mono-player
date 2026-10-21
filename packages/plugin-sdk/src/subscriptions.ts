import type { Call } from './features';

export type Topic = 'player' | 'queue' | 'library' | 'favorites' | 'playlists' | 'config' | 'environment';
export interface PluginEvent { subscriptionId: string; sequence: number; topic: Topic | 'audio'; revision: string; data: unknown }
export interface AudioFrame { sequence: number; sampleRate: number; channels: number; samples: number[] }

// Bounded pull delivery works identically over MessagePort and managed-service HTTP.
// Never overlap polls; disposal cancels timers and releases native subscriptions.
export function createSubscriptions(call: Call) {
  const active = new Map<string, { timer?: ReturnType<typeof setTimeout>; audio: boolean }>();
  let disposed = false;
  async function unsubscribe(id: string) {
    const record = active.get(id);
    if (!record) return;
    clearTimeout(record.timer);
    active.delete(id);
    await call(record.audio ? 'audio.unsubscribeFrames' : 'events.unsubscribe', { subscriptionId: id });
  }
  async function subscribe(topics: Topic[], callback: (event: PluginEvent) => void, audio = false, onError?: (error: unknown) => void) {
    if (disposed) throw new Error('Plugin instance has been disposed');
    const { subscriptionId: id } = await call<{ subscriptionId: string }>(audio ? 'audio.subscribeFrames' : 'events.subscribe', audio ? {} : { topics });
    const record: { timer?: ReturnType<typeof setTimeout>; audio: boolean } = { audio };
    active.set(id, record);
    if (disposed) { await unsubscribe(id); return id; }
    async function poll() {
      try {
        const events = await call<PluginEvent[]>('events.poll', { subscriptionId: id });
        if (!active.has(id)) return;
        for (const event of events) { if (!active.has(id)) break; callback(event); }
        if (active.has(id)) record.timer = setTimeout(poll, audio ? 50 : 500);
      } catch (error) {
        if (active.has(id)) { void unsubscribe(id).catch(() => {}); onError?.(error); }
      }
    }
    void poll();
    return id;
  }
  return {
    events: { subscribe: (topics: Topic[], callback: (event: PluginEvent) => void, onError?: (error: unknown) => void) => subscribe(topics, callback, false, onError), unsubscribe },
    audio: {
      subscribeFrames: (callback: (frame: AudioFrame | null) => void, onError?: (error: unknown) => void) => subscribe([], event => callback(event.data as AudioFrame | null), true, onError),
      unsubscribeFrames: unsubscribe,
    },
    dispose() { disposed = true; for (const id of active.keys()) void unsubscribe(id).catch(() => {}); },
  };
}
