import { computed, ref } from 'vue';
import { resolveLocale } from '../i18n';
import type { usePlayerStore } from '../stores/player';

export type SleepTimerAction = 'stop' | 'exit' | 'finishTrack';

type PlayerStore = ReturnType<typeof usePlayerStore>;

interface SleepTimerRequest {
  minutes: number;
  action: SleepTimerAction | null;
}

interface SleepTimerOptions {
  player: PlayerStore;
  onStop: () => void;
  onExit: () => void;
}

export function useSleepTimer({ player, onExit, onStop }: SleepTimerOptions) {
  const sleepTimerMinutes = ref(player.settings.sleepTimerMinutes);
  const sleepTimerHours = ref(0);
  const sleepTimerEndsAt = ref<number | null>(null);
  const sleepTimerRemainingSeconds = ref(0);
  const sleepTimerPausedRemainingSeconds = ref<number | null>(null);
  const isSleepTimerDialogOpen = ref(false);
  const isSleepTimerStatusOpen = ref(false);
  const sleepTimerTotalSeconds = ref(Math.max(60, player.settings.sleepTimerMinutes * 60));
  const sleepTimerStopAfterTrackPending = ref(false);
  const sleepTimerPresetMinutes = [10, 20, 30, 45, 60];
  let sleepTimerTimeout = 0;
  let sleepTimerTick = 0;

  const isSleepTimerActive = computed(() => sleepTimerEndsAt.value !== null);
  const isSleepTimerPaused = computed(() => sleepTimerPausedRemainingSeconds.value !== null);
  const sleepTimerRemainingLabel = computed(() => {
    const minutes = Math.floor(sleepTimerRemainingSeconds.value / 60);
    const seconds = sleepTimerRemainingSeconds.value % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  });
  const sleepTimerExecuteAtLabel = computed(() => {
    if (sleepTimerEndsAt.value === null) return '';
    return new Intl.DateTimeFormat(resolveLocale(player.settings.locale), {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(sleepTimerEndsAt.value));
  });
  const sleepTimerProgressPercent = computed(() => {
    if (sleepTimerTotalSeconds.value <= 0) return 0;
    return Math.max(0, Math.min(100, (sleepTimerRemainingSeconds.value / sleepTimerTotalSeconds.value) * 100));
  });

  function openSleepTimerDialog() {
    if (!isSleepTimerActive.value && !isSleepTimerPaused.value) {
      const totalMinutes = Math.max(1, Math.round(Number(sleepTimerMinutes.value) || player.settings.sleepTimerMinutes));
      sleepTimerHours.value = Math.floor(totalMinutes / 60);
      sleepTimerMinutes.value = totalMinutes % 60;
    }
    isSleepTimerDialogOpen.value = true;
  }

  function closeSleepTimerDialog() {
    isSleepTimerDialogOpen.value = false;
  }

  function closeSleepTimerStatus() {
    isSleepTimerStatusOpen.value = false;
  }

  function handleSleepTimerButtonClick() {
    if (isSleepTimerActive.value || isSleepTimerPaused.value) {
      isSleepTimerStatusOpen.value = !isSleepTimerStatusOpen.value;
      return;
    }
    openSleepTimerDialog();
  }

  function setSleepTimerPreset(minutes: number) {
    sleepTimerHours.value = Math.floor(minutes / 60);
    sleepTimerMinutes.value = minutes % 60;
  }

  function clearSleepTimer() {
    if (sleepTimerTimeout) {
      window.clearTimeout(sleepTimerTimeout);
      sleepTimerTimeout = 0;
    }
    if (sleepTimerTick) {
      window.clearInterval(sleepTimerTick);
      sleepTimerTick = 0;
    }
    sleepTimerEndsAt.value = null;
    sleepTimerRemainingSeconds.value = 0;
    sleepTimerPausedRemainingSeconds.value = null;
    isSleepTimerStatusOpen.value = false;
    sleepTimerStopAfterTrackPending.value = false;
  }

  function updateSleepTimerRemaining() {
    if (sleepTimerEndsAt.value === null) return;
    sleepTimerRemainingSeconds.value = Math.max(0, Math.ceil((sleepTimerEndsAt.value - Date.now()) / 1000));
  }

  function runSleepTimerAction() {
    const action = player.settings.sleepTimerAction;
    if (action === 'finishTrack') {
      if (sleepTimerTimeout) {
        window.clearTimeout(sleepTimerTimeout);
        sleepTimerTimeout = 0;
      }
      if (sleepTimerTick) {
        window.clearInterval(sleepTimerTick);
        sleepTimerTick = 0;
      }
      sleepTimerEndsAt.value = null;
      sleepTimerRemainingSeconds.value = 0;
      sleepTimerPausedRemainingSeconds.value = null;
      sleepTimerStopAfterTrackPending.value = true;
      return;
    }

    clearSleepTimer();
    onStop();
    if (action === 'exit') {
      onExit();
    }
  }

  function startSleepTimer() {
    const hours = Math.min(99, Math.max(0, Math.round(Number(sleepTimerHours.value) || 0)));
    const minutePart = Math.min(59, Math.max(0, Math.round(Number(sleepTimerMinutes.value) || 0)));
    const minutes = Math.min(999, Math.max(1, hours * 60 + minutePart));
    sleepTimerHours.value = Math.floor(minutes / 60);
    sleepTimerMinutes.value = minutes % 60;
    player.setSleepTimerMinutes(minutes);
    clearSleepTimer();

    sleepTimerTotalSeconds.value = minutes * 60;
    sleepTimerEndsAt.value = Date.now() + minutes * 60_000;
    updateSleepTimerRemaining();
    sleepTimerTick = window.setInterval(updateSleepTimerRemaining, 1000);
    sleepTimerTimeout = window.setTimeout(runSleepTimerAction, minutes * 60_000);
    closeSleepTimerDialog();
    isSleepTimerStatusOpen.value = false;
  }

  function pauseSleepTimer() {
    if (sleepTimerEndsAt.value === null) return;
    sleepTimerPausedRemainingSeconds.value = sleepTimerRemainingSeconds.value;
    if (sleepTimerTimeout) {
      window.clearTimeout(sleepTimerTimeout);
      sleepTimerTimeout = 0;
    }
    if (sleepTimerTick) {
      window.clearInterval(sleepTimerTick);
      sleepTimerTick = 0;
    }
    sleepTimerEndsAt.value = null;
  }

  function resumeSleepTimer() {
    const remainingSeconds = sleepTimerPausedRemainingSeconds.value;
    if (!remainingSeconds) return;
    sleepTimerPausedRemainingSeconds.value = null;
    sleepTimerEndsAt.value = Date.now() + remainingSeconds * 1000;
    updateSleepTimerRemaining();
    sleepTimerTick = window.setInterval(updateSleepTimerRemaining, 1000);
    sleepTimerTimeout = window.setTimeout(runSleepTimerAction, remainingSeconds * 1000);
  }

  function handleSleepTimerRequest(request: SleepTimerRequest | null) {
    if (!request) return;
    const minutes = Math.min(999, Math.max(1, Math.round(Number(request.minutes) || 0)));
    if (request.action) {
      player.setSleepTimerAction(request.action);
    }
    sleepTimerHours.value = Math.floor(minutes / 60);
    sleepTimerMinutes.value = minutes % 60;
    startSleepTimer();
  }

  function syncSleepTimerSetting(minutes: number) {
    if (!isSleepTimerActive.value) {
      sleepTimerMinutes.value = minutes;
    }
  }

  return {
    clearSleepTimer,
    closeSleepTimerDialog,
    closeSleepTimerStatus,
    handleSleepTimerButtonClick,
    handleSleepTimerRequest,
    isSleepTimerActive,
    isSleepTimerDialogOpen,
    isSleepTimerPaused,
    isSleepTimerStatusOpen,
    openSleepTimerDialog,
    pauseSleepTimer,
    resumeSleepTimer,
    setSleepTimerPreset,
    sleepTimerExecuteAtLabel,
    sleepTimerHours,
    sleepTimerMinutes,
    sleepTimerPresetMinutes,
    sleepTimerProgressPercent,
    sleepTimerRemainingLabel,
    sleepTimerStopAfterTrackPending,
    startSleepTimer,
    syncSleepTimerSetting,
  };
}
