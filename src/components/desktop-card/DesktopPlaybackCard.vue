<script setup lang="ts">
import { ref } from 'vue';
import { useDesktopPlaybackCardBridge } from '../../composables/useDesktopPlaybackCardBridge';
import { useDesktopLyricsAppearance } from '../../composables/useDesktopLyricsAppearance';
const { appearanceStyle } = useDesktopLyricsAppearance(316, 483);
const frame = ref<HTMLIFrameElement | null>(null);
const { documentSource, error, initialize, close } = useDesktopPlaybackCardBridge(frame);
</script>

<template>
  <iframe v-if="documentSource" ref="frame" :style="appearanceStyle" title="Mono 桌面播放卡片" sandbox="allow-scripts" :srcdoc="documentSource" @load="initialize" />
  <div v-if="error" class="card-error">{{ error }}<button @click="close">关闭</button></div>
</template>

<style scoped>
iframe { display: block; width: 100vw; height: 100vh; border: 0; background: transparent; }
.card-error { position: fixed; inset: 8px; padding: 20px; color: white; background: #242426; border-radius: 18px; overflow: auto; }
.card-error button { display: block; margin-top: 12px; }
</style>
