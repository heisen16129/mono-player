import { watch } from 'vue';
import type { PlayerSettings } from '../types/music';

interface PlayerDockLifecycleOptions {
  getSeekRequestId: () => number;
  getSeekTime: () => number;
  getSleepTimerMinutesSetting: () => number;
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
    options.getSleepTimerMinutesSetting,
    (minutes) => {
      options.syncSleepTimerSetting(minutes);
    },
  );
}
