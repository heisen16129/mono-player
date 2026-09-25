import { nextTick, onBeforeUnmount, ref, watch, type ComponentPublicInstance, type Ref } from 'vue';
import type { Track } from '../types/music';

interface QueuePopoverOptions {
  activeTrack: Ref<Track | null>;
  onPlayTrack: (track: Track) => void;
}

export function useQueuePopover({ activeTrack, onPlayTrack }: QueuePopoverOptions) {
  const isQueueOpen = ref(false);
  const queueControls = new Set<HTMLElement>();
  const queueTrackRefs = new Map<number, Set<HTMLElement>>();

  function toggleQueuePanel() {
    isQueueOpen.value = !isQueueOpen.value;
  }

  function setQueueControl(element: Element | ComponentPublicInstance | null) {
    if (element instanceof HTMLElement) {
      queueControls.add(element);
      return;
    }

    queueMicrotask(pruneDisconnectedQueueElements);
  }

  function pruneDisconnectedQueueElements() {
    for (const control of queueControls) {
      if (!control.isConnected) queueControls.delete(control);
    }

    for (const [trackId, elements] of queueTrackRefs) {
      for (const element of elements) {
        if (!element.isConnected) elements.delete(element);
      }
      if (elements.size === 0) queueTrackRefs.delete(trackId);
    }
  }

  function closeQueuePanelOnOutsidePointer(event: PointerEvent) {
    const target = event.target;
    if (!(target instanceof Node)) return;
    pruneDisconnectedQueueElements();
    if ([...queueControls].some((control) => control.contains(target))) return;
    isQueueOpen.value = false;
  }

  function playQueueTrack(track: Track) {
    if (!track.path) return;
    onPlayTrack(track);
  }

  function setQueueTrackRef(trackId: number, element: Element | ComponentPublicInstance | null) {
    if (element instanceof HTMLElement) {
      const elements = queueTrackRefs.get(trackId) ?? new Set<HTMLElement>();
      elements.add(element);
      queueTrackRefs.set(trackId, elements);
      return;
    }

    queueMicrotask(pruneDisconnectedQueueElements);
  }

  function setQueueControlElement(element: unknown) {
    setQueueControl(element instanceof HTMLElement ? element : null);
  }

  function setQueueTrackElement(trackId: number, element: unknown) {
    setQueueTrackRef(trackId, element instanceof HTMLElement ? element : null);
  }

  async function locateQueueTrack() {
    if (!activeTrack.value) return;

    await nextTick();
    pruneDisconnectedQueueElements();
    const trackRows = [...(queueTrackRefs.get(activeTrack.value.id) ?? [])];
    const trackRow = trackRows.find((element) => element.getClientRects().length > 0);
    if (trackRow) scrollToQueueTrack(trackRow);
  }

  function scrollToQueueTrack(trackRow: HTMLElement) {
    const queueList = trackRow.closest<HTMLElement>('.queue-list');
    if (!queueList) return;

    const trackRect = trackRow.getBoundingClientRect();
    const queueRect = queueList.getBoundingClientRect();
    const trackTop = trackRect.top - queueRect.top + queueList.scrollTop;
    const targetTop = trackTop - (queueList.clientHeight - trackRect.height) / 2;
    const maxScrollTop = Math.max(0, queueList.scrollHeight - queueList.clientHeight);

    queueList.scrollTo({
      top: Math.min(Math.max(0, targetTop), maxScrollTop),
      behavior: 'smooth',
    });
  }

  watch(isQueueOpen, async (open) => {
    if (open) {
      await nextTick();
      document.addEventListener('pointerdown', closeQueuePanelOnOutsidePointer);
      return;
    }

    document.removeEventListener('pointerdown', closeQueuePanelOnOutsidePointer);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', closeQueuePanelOnOutsidePointer);
  });

  return {
    isQueueOpen,
    locateQueueTrack,
    playQueueTrack,
    setQueueControlElement,
    setQueueTrackElement,
    toggleQueuePanel,
  };
}
