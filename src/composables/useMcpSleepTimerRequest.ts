import { ref } from 'vue';
import type { usePlayerStore } from '../stores/player';
import type { SleepTimerAction } from './useSleepTimer';

interface McpSleepTimerEvent {
  minutes?: number;
  action?: string | null;
}

interface McpSleepTimerRequest {
  minutes: number;
  action: SleepTimerAction | null;
}

interface UseMcpSleepTimerRequestOptions {
  player: ReturnType<typeof usePlayerStore>;
  showToast: (message: string, variant?: 'success' | 'error') => void;
}

export function useMcpSleepTimerRequest({ player, showToast }: UseMcpSleepTimerRequestOptions) {
  const sleepTimerRequestId = ref(0);
  const sleepTimerRequest = ref<McpSleepTimerRequest | null>(null);

  function isSleepTimerAction(action: string | null | undefined): action is SleepTimerAction {
    return action === 'stop' || action === 'exit' || action === 'finishTrack';
  }

  function handleMcpSleepTimerEvent(event: McpSleepTimerEvent) {
    const minutes = Math.min(999, Math.max(1, Math.round(Number(event.minutes) || 0)));
    const action = event.action;
    if (isSleepTimerAction(action)) {
      player.setSleepTimerAction(action);
    }
    sleepTimerRequest.value = {
      minutes,
      action: isSleepTimerAction(action) ? action : null,
    };
    sleepTimerRequestId.value += 1;
    showToast(`\u5df2\u8bbe\u7f6e ${minutes} \u5206\u949f\u540e\u5b9a\u65f6\u5173\u95ed`, 'success');
  }

  return {
    handleMcpSleepTimerEvent,
    sleepTimerRequest,
    sleepTimerRequestId,
  };
}
