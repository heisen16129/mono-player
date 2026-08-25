<script setup lang="ts">
import { onErrorCaptured, ref, watch } from 'vue';
import type { LyricsRendererContext, LyricsRendererPlugin } from '../../types/lyricsRenderer';
import type { PlayerDockController } from '../../types/playerDockController';

const props = defineProps<{
  context: LyricsRendererContext;
  plugin: LyricsRendererPlugin;
  playerDockController?: PlayerDockController | null;
}>();

const emit = defineEmits<{
  error: [error: unknown, pluginId: string];
}>();

const hasError = ref(false);
const rendererRef = ref<{ lyricsAnchorOffset?: () => number | null } | null>(null);

watch(
  () => props.plugin.id,
  () => {
    hasError.value = false;
  },
);

onErrorCaptured((error) => {
  hasError.value = true;
  emit('error', error, props.plugin.id);
  return false;
});

function lyricsAnchorOffset() {
  return rendererRef.value?.lyricsAnchorOffset?.() ?? null;
}

defineExpose({ lyricsAnchorOffset });
</script>

<template>
  <div class="lyrics-renderer-host">
    <component
      :is="plugin.component"
      v-if="!hasError"
      class="lyrics-renderer-layer"
      ref="rendererRef"
      :context="context"
      :player-dock-controller="props.playerDockController"
    />
  </div>
</template>

<style scoped>
.lyrics-renderer-host {
  display: contents;
}

.lyrics-renderer-layer {
  position: relative;
  z-index: 1;
}
</style>
