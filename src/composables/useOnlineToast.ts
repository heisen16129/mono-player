import { ref } from 'vue';

export type OnlineToastVariant = 'success' | 'error';

export function useOnlineToast() {
  const onlineToastMessage = ref<string | null>(null);
  const onlineToastVariant = ref<OnlineToastVariant>('error');
  let onlineToastTimer: number | null = null;

  function clearOnlineToastTimer() {
    if (onlineToastTimer === null) return;
    window.clearTimeout(onlineToastTimer);
    onlineToastTimer = null;
  }

  function showOnlineToast(message: string, variant: OnlineToastVariant = 'error') {
    onlineToastMessage.value = message;
    onlineToastVariant.value = variant;
    clearOnlineToastTimer();
    onlineToastTimer = window.setTimeout(() => {
      onlineToastMessage.value = null;
      onlineToastTimer = null;
    }, 3600);
  }

  function closeOnlineToast() {
    clearOnlineToastTimer();
    onlineToastMessage.value = null;
  }

  return {
    clearOnlineToastTimer,
    closeOnlineToast,
    onlineToastMessage,
    onlineToastVariant,
    showOnlineToast,
  };
}
