import { onBeforeUnmount, watch } from 'vue';
import type { PlayerSettings } from '../types/music';
import type { SleepTimerAction } from './useSleepTimer';

interface PlayerDockLifecycleOptions {
  clearSleepTimer: () => void;
  getSeekRequestId: () => number;
  getSeekTime: () => number;
  getSleepTimerMinutesSetting: () => number;
  getSleepTimerRequest: () => { minutes: number; action: SleepTimerAction | null } | null;
  getSleepTimerRequestId: () => number;
  handleSleepTimerRequest: (request: { minutes: number; action: SleepTimerAction | null } | null) => void;
  seekPlaybackTo: (time: number) => void;
  syncSleepTimerSetting: (minutes: PlayerSettings['sleepTimerMinutes']) => void;
}

export function usePlayerDockLifecycle(options: PlayerDockLifecycleOptions) {
  watch(
    options.getSeekRequestId,
    () => options.seekPlaybackTo(options.getSeekTime()),
    { flush: 'post' },
  );

  watch(
    options.getSleepTimerRequestId,
    () => {
      options.handleSleepTimerRequest(options.getSleepTimerRequest());
    },
  );

  watch(
    options.getSleepTimerMinutesSetting,
    (minutes) => {
      options.syncSleepTimerSetting(minutes);
    },
  );

  onBeforeUnmount(() => {
    options.clearSleepTimer();
  });
}
