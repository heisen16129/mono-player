<script setup lang="ts">
defineProps<{
  artistNames: string[];
  enableLink?: boolean;
}>();

defineEmits<{
  openArtist: [artistName: string];
}>();
</script>

<template>
  <span
    v-if="enableLink"
    class="track-artist-cell track-artist-links"
  >
    <template v-for="(artistName, index) in artistNames" :key="`${artistName}-${index}`">
      <span v-if="index > 0" class="track-artist-separator">&</span>
      <button
        class="track-artist-link"
        type="button"
        @click.stop="$emit('openArtist', artistName)"
      >
        {{ artistName }}
      </button>
    </template>
  </span>
  <span v-else class="track-artist-cell">{{ artistNames.join(' & ') }}</span>
</template>

<style scoped>
.track-artist-cell {
  min-width: 0;
  overflow: hidden;
  color: var(--smw-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-artist-links {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
}

.track-artist-separator {
  flex: 0 0 auto;
  color: color-mix(in srgb, var(--smw-text-secondary) 72%, transparent);
}

.track-artist-link {
  min-width: 0;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
  font: inherit;
  overflow: hidden;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
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
