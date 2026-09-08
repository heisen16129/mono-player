<script setup lang="ts">
import { computed } from 'vue';
import type { LyricsRendererBackgroundContext } from '../../types/lyricsRenderer';

const props = defineProps<{
  background: LyricsRendererBackgroundContext;
  coverUrl: string | null;
  windowOpacity?: number;
}>();

const mediaUrl = computed(() => {
  if (props.background.source === 'cover') return props.coverUrl;
  if (props.background.source === 'media' || props.background.source === 'wallpaper') return props.background.mediaUrl;
  return null;
});
const isVideo = computed(() => (
  (props.background.source === 'media' || props.background.source === 'wallpaper')
  && props.background.mediaKind === 'video'
  && Boolean(mediaUrl.value)
));
const mediaStyle = computed(() => ({
  opacity: props.background.opacity,
  objectPosition: `${props.background.positionX}% ${props.background.positionY}%`,
  filter: `blur(${props.background.blur}px)`,
  transform: `scale(${props.background.scale * (1 + props.background.blur / 500)})`,
}));
const isNativeScene = computed(() => (
  props.background.source === 'wallpaper'
  && props.background.wallpaperProjectType === 'scene'
));
const layerBackgroundColor = computed(() => {
  if (isNativeScene.value) return 'transparent';
  if (props.background.source === 'color') return props.background.color;
  return 'var(--smw-lyrics-bg, var(--smw-bg-canvas))';
});
</script>

<template>
  <div
    class="lyrics-background-layer"
    :style="{
      backgroundColor: layerBackgroundColor,
      opacity: props.windowOpacity ?? 1,
    }"
    aria-hidden="true"
  >
    <video
      v-if="isVideo"
      class="lyrics-background-media"
      :src="mediaUrl ?? undefined"
      :style="mediaStyle"
      autoplay
      loop
      muted
      playsinline
    />
    <img
      v-else-if="mediaUrl"
      class="lyrics-background-media"
      :src="mediaUrl"
      :style="mediaStyle"
      alt=""
      draggable="false"
    />
    <div v-if="!isNativeScene" class="lyrics-background-shade" />
  </div>
</template>

<style scoped>
.lyrics-background-layer,
.lyrics-background-media,
.lyrics-background-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.lyrics-background-layer {
  z-index: 0;
  overflow: hidden;
}

.lyrics-background-media {
  object-fit: cover;
  transform-origin: center;
}

.lyrics-background-shade {
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.38));
}
</style>
