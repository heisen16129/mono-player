<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue';
import { useFolderCoverUrls } from '../composables/useFolderCoverUrls';
import type { Track } from '../types/music';
import { artworkDisplaySrc } from '../utils/artwork';
import FolderCoverContent from './FolderCoverContent.vue';

const props = defineProps<{
  coverUrl?: string | null;
  size?: 'default' | 'mini';
  tracks: Track[];
  tone?: 'desk' | 'night' | 'mist' | 'road';
}>();

const { handleCoverError, shouldUseGrid, visibleCovers } = useFolderCoverUrls(toRef(props, 'tracks'));
const customCoverFailed = ref(false);
const customCoverUrl = computed(() => customCoverFailed.value ? '' : artworkDisplaySrc(props.coverUrl));

watch(() => props.coverUrl, () => {
  customCoverFailed.value = false;
});
</script>

<template>
  <span
    class="folder-cover"
    :class="[
      tone || 'night',
      size === 'mini' ? 'folder-cover-mini' : '',
      {
        'is-grid': !customCoverUrl && shouldUseGrid,
        'has-cover-image': Boolean(customCoverUrl) || visibleCovers.some(Boolean),
      },
    ]"
    aria-hidden="true"
  >
    <img v-if="customCoverUrl" class="folder-cover-custom-image" :src="customCoverUrl" alt="" @error="customCoverFailed = true" />
    <FolderCoverContent v-else :should-use-grid="shouldUseGrid" :visible-covers="visibleCovers" @cover-error="handleCoverError" />
  </span>
</template>

<style scoped>
.folder-cover-mini {
  display: block;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: 6px;
  background:
    radial-gradient(circle at 35% 35%, var(--smw-cover-dot) 0 1px, transparent 2px),
    radial-gradient(circle at 62% 58%, var(--smw-cover-dot-soft) 0 1px, transparent 2px),
    linear-gradient(135deg, var(--smw-cover-base-deep), var(--smw-cover-base));
}

.folder-cover-mini.city {
  background:
    linear-gradient(90deg, transparent 46%, var(--smw-cover-line) 47% 49%, transparent 50%),
    linear-gradient(135deg, var(--smw-cover-base-deep), var(--smw-cover-base));
}

.folder-cover-mini.mist {
  background: linear-gradient(135deg, var(--smw-cover-base), var(--smw-cover-base-deep));
}

.folder-cover-mini.stage {
  background:
    radial-gradient(circle at 60% 25%, var(--smw-cover-dot) 0 2px, transparent 3px),
    var(--smw-cover-base-deep);
}

.folder-cover-mini.desk {
  background: linear-gradient(135deg, var(--smw-cover-base-deep), var(--smw-cover-base));
}

.folder-cover-mini.road {
  background: linear-gradient(135deg, var(--smw-cover-base), var(--smw-cover-base-deep));
}

.folder-cover {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: color-mix(in srgb, var(--smw-bg-selected, #edf1f6) 72%, #ffffff);
  color: color-mix(in srgb, var(--smw-text-secondary, #8b95a3) 72%, #b7bdc7);
}

.folder-cover.is-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 1px;
  background: var(--smw-cover-divider);
}

.folder-cover-custom-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

</style>
