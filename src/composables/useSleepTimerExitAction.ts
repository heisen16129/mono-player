import { exitApp } from '../services/music';

interface UseSleepTimerExitActionOptions {
  savePlaybackSessionNow: () => void;
}

export function useSleepTimerExitAction({ savePlaybackSessionNow }: UseSleepTimerExitActionOptions) {
  async function handleSleepTimerExit() {
    savePlaybackSessionNow();
    await exitApp();
  }

  return {
    handleSleepTimerExit,
  };
}
