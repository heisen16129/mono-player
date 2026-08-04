import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { resolveLocale } from '../i18n';
import {
  clearSleepTimerBackend,
  getSleepTimerStatus,
  listenSleepTimerStatus,
  pauseSleepTimerBackend,
  resumeSleepTimerBackend,
  startSleepTimerBackend,
  type SleepTimerSnapshot,
} from '../services/sleepTimer';
import type { usePlayerStore } from '../stores/player';

export type { SleepTimerAction } from '../services/sleepTimer';

type PlayerStore = ReturnType<typeof usePlayerStore>;

interface SleepTimerOptions {
  player: PlayerStore;
}

export function useSleepTimer({ player }: SleepTimerOptions) {
  const sleepTimerMinutes = ref(player.settings.sleepTimerMinutes);
  const sleepTimerHours = ref(0);
  const sleepTimerEndsAt = ref<number | null>(null);
  const sleepTimerRemainingSeconds = ref(0);
  const sleepTimerPausedRemainingSeconds = ref<number | null>(null);
  const isSleepTimerDialogOpen = ref(false);
  const isSleepTimerStatusOpen = ref(false);
  const sleepTimerTotalSeconds = ref(Math.max(60, player.settings.sleepTimerMinutes * 60));
  const sleepTimerPresetMinutes = [10, 20, 30, 45, 60];
  let unlistenSleepTimerStatus: (() => void) | null = null;

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

  function applySleepTimerSnapshot(snapshot: SleepTimerSnapshot) {
    sleepTimerEndsAt.value = snapshot.endsAtMs;
    sleepTimerPausedRemainingSeconds.value = snapshot.isPaused ? snapshot.remainingSeconds : null;
    sleepTimerRemainingSeconds.value = snapshot.remainingSeconds;
    sleepTimerTotalSeconds.value = Math.max(60, snapshot.totalSeconds || player.settings.sleepTimerMinutes * 60);
  }

  async function clearSleepTimer() {
    const snapshot = await clearSleepTimerBackend();
    applySleepTimerSnapshot(snapshot);
    isSleepTimerStatusOpen.value = false;
  }

  async function startSleepTimer() {
    const hours = Math.min(99, Math.max(0, Math.round(Number(sleepTimerHours.value) || 0)));
    const minutePart = Math.min(59, Math.max(0, Math.round(Number(sleepTimerMinutes.value) || 0)));
    const minutes = Math.min(999, Math.max(1, hours * 60 + minutePart));
    sleepTimerHours.value = Math.floor(minutes / 60);
    sleepTimerMinutes.value = minutes % 60;
    player.setSleepTimerMinutes(minutes);
    const snapshot = await startSleepTimerBackend(minutes, player.settings.sleepTimerAction);
    applySleepTimerSnapshot(snapshot);
    closeSleepTimerDialog();
    isSleepTimerStatusOpen.value = false;
  }

  async function pauseSleepTimer() {
    const snapshot = await pauseSleepTimerBackend();
    applySleepTimerSnapshot(snapshot);
  }

  async function resumeSleepTimer() {
    const snapshot = await resumeSleepTimerBackend();
    applySleepTimerSnapshot(snapshot);
  }

  function syncSleepTimerSetting(minutes: number) {
    if (!isSleepTimerActive.value) {
      sleepTimerMinutes.value = minutes;
    }
  }

  onMounted(async () => {
    applySleepTimerSnapshot(await getSleepTimerStatus());
    unlistenSleepTimerStatus = await listenSleepTimerStatus(applySleepTimerSnapshot);
  });

  onBeforeUnmount(() => {
    unlistenSleepTimerStatus?.();
    unlistenSleepTimerStatus = null;
  });

  return {
    clearSleepTimer,
    closeSleepTimerDialog,
    closeSleepTimerStatus,
    handleSleepTimerButtonClick,
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
    startSleepTimer,
    syncSleepTimerSetting,
  };
}
