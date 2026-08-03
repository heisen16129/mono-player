<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import PlaybackSpeedButton from './PlaybackSpeedButton.vue';
import PlaybackSpeedPopover from './PlaybackSpeedPopover.vue';

defineProps<{
  label: string;
  rate: number;
}>();

const emit = defineEmits<{
  change: [value: number];
}>();

const speedControl = ref<HTMLElement | null>(null);
const isSpeedPopoverOpen = ref(false);

function openSpeedPopover() {
  isSpeedPopoverOpen.value = true;
}

function closeSpeedPopover() {
  isSpeedPopoverOpen.value = false;
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && speedControl.value?.contains(activeElement)) {
    activeElement.blur();
  }
}

function closeSpeedPopoverOnOutsidePointer(event: PointerEvent) {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (speedControl.value?.contains(target)) return;
  closeSpeedPopover();
}

function closeSpeedPopoverOnEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  closeSpeedPopover();
}

watch(isSpeedPopoverOpen, (open) => {
  if (open) {
    document.addEventListener('pointerdown', closeSpeedPopoverOnOutsidePointer);
    document.addEventListener('keydown', closeSpeedPopoverOnEscape);
    return;
  }

  document.removeEventListener('pointerdown', closeSpeedPopoverOnOutsidePointer);
  document.removeEventListener('keydown', closeSpeedPopoverOnEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeSpeedPopoverOnOutsidePointer);
  document.removeEventListener('keydown', closeSpeedPopoverOnEscape);
});
</script>

<template>
  <div
    ref="speedControl"
    class="speed-control"
    :class="{ 'is-open': isSpeedPopoverOpen }"
    @mouseenter="openSpeedPopover"
    @mouseleave="closeSpeedPopover"
    @focusin="openSpeedPopover"
    @click="openSpeedPopover"
    @keydown.esc.stop="closeSpeedPopover"
  >
    <PlaybackSpeedPopover v-if="isSpeedPopoverOpen" :label="label" :rate="rate" @change="emit('change', $event)" />
    <PlaybackSpeedButton :label="`播放速度 ${label}`" />
  </div>
</template>

<style scoped>
.speed-control {
  position: relative;
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  place-items: center;
}

.speed-control.is-open {
  z-index: 44;
}
</style>
