import { listen } from '@tauri-apps/api/event';
import { invokeApi } from './api';
import { isTauriRuntime } from './music';

export type SleepTimerAction = 'stop' | 'exit' | 'finishTrack';

export interface SleepTimerSnapshot {
  action: SleepTimerAction;
  endsAtMs: number | null;
  isActive: boolean;
  isPaused: boolean;
  remainingSeconds: number;
  totalSeconds: number;
}

const defaultSleepTimerSnapshot: SleepTimerSnapshot = {
  action: 'stop',
  endsAtMs: null,
  isActive: false,
  isPaused: false,
  remainingSeconds: 0,
  totalSeconds: 0,
};

export function getSleepTimerStatus(): Promise<SleepTimerSnapshot> {
  if (!isTauriRuntime()) return Promise.resolve(defaultSleepTimerSnapshot);
  return invokeApi<SleepTimerSnapshot>('sleep_timer_status');
}

export function startSleepTimerBackend(minutes: number, action: SleepTimerAction): Promise<SleepTimerSnapshot> {
  if (!isTauriRuntime()) return Promise.resolve(defaultSleepTimerSnapshot);
  return invokeApi<SleepTimerSnapshot>('sleep_timer_start', { minutes, action });
}

export function clearSleepTimerBackend(): Promise<SleepTimerSnapshot> {
  if (!isTauriRuntime()) return Promise.resolve(defaultSleepTimerSnapshot);
  return invokeApi<SleepTimerSnapshot>('sleep_timer_clear');
}

export function pauseSleepTimerBackend(): Promise<SleepTimerSnapshot> {
  if (!isTauriRuntime()) return Promise.resolve(defaultSleepTimerSnapshot);
  return invokeApi<SleepTimerSnapshot>('sleep_timer_pause');
}

export function resumeSleepTimerBackend(): Promise<SleepTimerSnapshot> {
  if (!isTauriRuntime()) return Promise.resolve(defaultSleepTimerSnapshot);
  return invokeApi<SleepTimerSnapshot>('sleep_timer_resume');
}

export function listenSleepTimerStatus(callback: (snapshot: SleepTimerSnapshot) => void): Promise<() => void> {
  if (!isTauriRuntime()) return Promise.resolve(() => {});
  return listen<SleepTimerSnapshot>('sleep-timer://status', (event) => callback(event.payload));
}
