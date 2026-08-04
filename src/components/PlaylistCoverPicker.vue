<script setup lang="ts">
import { computed } from 'vue';
import { ImagePlus, X } from '@lucide/vue';
import { artworkDisplaySrc } from '../utils/artwork';

const props = defineProps<{
  chooseLabel: string;
  clearLabel: string;
  cover: string | null;
}>();

const emit = defineEmits<{
  choose: [];
  clear: [];
}>();

const coverUrl = computed(() => artworkDisplaySrc(props.cover));
</script>

<template>
  <div class="playlist-cover-picker">
    <button class="playlist-cover-button" type="button" :title="chooseLabel" @click="emit('choose')">
      <img v-if="coverUrl" class="playlist-cover-preview" :src="coverUrl" alt="" />
      <span v-else class="playlist-cover-placeholder">
        <ImagePlus :size="26" :stroke-width="1.9" />
      </span>
    </button>
    <button v-if="coverUrl" class="playlist-cover-clear" type="button" :title="clearLabel" @click="emit('clear')">
      <X :size="14" :stroke-width="2.2" />
    </button>
  </div>
</template>

<style scoped>
.playlist-cover-picker {
  position: relative;
  justify-self: center;
  width: 96px;
  height: 96px;
}

.playlist-cover-button {
  display: grid;
  width: 96px;
  height: 96px;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-icon-muted);
  background: var(--smw-bg-muted);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    box-shadow 180ms ease,
    transform 140ms ease;
}

.playlist-cover-button:hover,
.playlist-cover-button:focus-visible {
  border-color: var(--smw-border-strong);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 10%, transparent);
  outline: none;
}

.playlist-cover-button:active {
  transform: scale(0.98);
}

.playlist-cover-preview {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-cover-placeholder {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 999px;
  color: var(--smw-button-primary-text);
  background: var(--smw-button-primary);
}

.playlist-cover-clear {
  position: absolute;
  top: -8px;
  right: -8px;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1px solid var(--smw-border-soft);
  border-radius: 999px;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-surface);
  box-shadow: var(--smw-shadow-soft);
  cursor: pointer;
  transition:
    color 160ms ease,
    transform 140ms ease;
}

.playlist-cover-clear:hover,
.playlist-cover-clear:focus-visible {
  color: var(--smw-text-primary);
  outline: none;
}

.playlist-cover-clear:active {
  transform: scale(0.94);
}
</style>
