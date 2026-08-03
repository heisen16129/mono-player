<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import VolumeMuteButton from './VolumeMuteButton.vue';
import VolumePopover from './VolumePopover.vue';

defineProps<{
  isMuted: boolean;
  muteLabel: string;
  restoreLabel: string;
  volume: number;
  volumeLabel: string;
}>();

const emit = defineEmits<{
  change: [value: number];
  toggleMute: [];
}>();

const volumeControl = ref<HTMLElement | null>(null);
const isVolumePopoverOpen = ref(false);

function openVolumePopover() {
  isVolumePopoverOpen.value = true;
}

function handleVolumeToggle() {
  openVolumePopover();
}

function closeVolumePopover() {
  isVolumePopoverOpen.value = false;
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && volumeControl.value?.contains(activeElement)) {
    activeElement.blur();
  }
}

function closeVolumePopoverOnOutsidePointer(event: PointerEvent) {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (volumeControl.value?.contains(target)) return;
  closeVolumePopover();
}

function closeVolumePopoverOnEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  closeVolumePopover();
}

watch(isVolumePopoverOpen, (open) => {
  if (open) {
    document.addEventListener('pointerdown', closeVolumePopoverOnOutsidePointer);
    document.addEventListener('keydown', closeVolumePopoverOnEscape);
    return;
  }

  document.removeEventListener('pointerdown', closeVolumePopoverOnOutsidePointer);
  document.removeEventListener('keydown', closeVolumePopoverOnEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeVolumePopoverOnOutsidePointer);
  document.removeEventListener('keydown', closeVolumePopoverOnEscape);
});
</script>

<template>
  <div
    ref="volumeControl"
    class="volume-control"
    :class="{ 'is-open': isVolumePopoverOpen }"
    @mouseenter="openVolumePopover"
    @mouseleave="closeVolumePopover"
    @focusin="openVolumePopover"
    @click="openVolumePopover"
    @keydown.esc.stop="closeVolumePopover"
  >
    <VolumePopover v-if="isVolumePopoverOpen" :is-muted="isMuted" :volume="volume" :volume-label="volumeLabel" @change="emit('change', $event)" />
    <VolumeMuteButton :label="volumeLabel" @toggle="handleVolumeToggle" />
  </div>
</template>

<style scoped>
.volume-control {
  position: relative;
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  place-items: center;
}

.volume-control.is-open {
  z-index: 44;
}
</style>
