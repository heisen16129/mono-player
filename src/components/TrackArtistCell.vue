<script setup lang="ts">
defineProps<{
  artistName: string;
  enableLink?: boolean;
}>();

defineEmits<{
  openArtist: [];
}>();
</script>

<template>
  <span
    v-if="enableLink"
    class="track-artist-cell track-artist-link"
    role="button"
    tabindex="0"
    @click.stop="$emit('openArtist')"
    @keydown.enter.stop.prevent="$emit('openArtist')"
    @keydown.space.stop.prevent="$emit('openArtist')"
  >
    {{ artistName }}
  </span>
  <span v-else class="track-artist-cell">{{ artistName }}</span>
</template>

<style scoped>
.track-artist-cell {
  min-width: 0;
  overflow: hidden;
  color: var(--smw-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-artist-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: fit-content;
  max-width: 100%;
  cursor: pointer;
  text-decoration: none;
}

.track-artist-link:hover {
  color: var(--smw-button-primary);
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-thickness: 1px;
  text-decoration-color: color-mix(in srgb, var(--smw-button-primary) 64%, transparent);
  text-underline-offset: 4px;
}

.track-artist-link:focus-visible {
  border-radius: 4px;
  outline: 2px solid color-mix(in srgb, var(--smw-button-primary) 42%, transparent);
  outline-offset: 3px;
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-thickness: 1px;
  text-decoration-color: color-mix(in srgb, var(--smw-button-primary) 64%, transparent);
  text-underline-offset: 4px;
}
</style>
