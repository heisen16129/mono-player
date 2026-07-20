import { nextTick, onBeforeUnmount, ref, watch, type ComponentPublicInstance, type Ref } from 'vue';
import type { Track } from '../types/music';

interface QueuePopoverOptions {
  activeTrack: Ref<Track | null>;
  onPlayTrack: (track: Track) => void;
}

export function useQueuePopover({ activeTrack, onPlayTrack }: QueuePopoverOptions) {
  const isQueueOpen = ref(false);
  const queueControl = ref<HTMLElement | null>(null);
  const queueTrackRefs = ref(new Map<number, HTMLElement>());

  function toggleQueuePanel() {
    isQueueOpen.value = !isQueueOpen.value;
  }

  function setQueueControl(element: Element | ComponentPublicInstance | null) {
    queueControl.value = element instanceof HTMLElement ? element : null;
  }

  function closeQueuePanelOnOutsidePointer(event: PointerEvent) {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (queueControl.value?.contains(target)) return;
    isQueueOpen.value = false;
  }

  function playQueueTrack(track: Track) {
    if (!track.path) return;
    onPlayTrack(track);
  }

  function setQueueTrackRef(trackId: number, element: Element | ComponentPublicInstance | null) {
    if (element instanceof HTMLElement) {
      queueTrackRefs.value.set(trackId, element);
      return;
    }

    queueTrackRefs.value.delete(trackId);
  }

  async function locateQueueTrack() {
    if (!activeTrack.value) return;

    await nextTick();
    queueTrackRefs.value.get(activeTrack.value.id)?.scrollIntoView({
      block: 'center',
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
    setQueueControl,
    setQueueTrackRef,
    toggleQueuePanel,
  };
}
