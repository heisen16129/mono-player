<script setup lang="ts">
import { computed } from 'vue';
import { usePlayerStore } from '../../stores/player';
import PlaybackTransitionsSettings from './PlaybackTransitionsSettings.vue';
import PlaybackFallbackSettings from './PlaybackFallbackSettings.vue';

const player = usePlayerStore();
const locale = computed(() => player.settings.locale);
</script>

<template>
  <details class="playback-behavior" open>
    <summary>{{ locale === 'en-US' ? 'Playback behavior' : '播放行为' }}</summary>
    <div class="playback-behavior-body">
      <PlaybackTransitionsSettings
        :crossfade-playback="player.settings.crossfadePlayback"
        :fade-playback="player.settings.fadePlayback"
        :locale="locale"
        :seamless-playback="player.settings.seamlessPlayback"
        @set-crossfade-playback="player.setCrossfadePlayback"
        @set-fade-playback="player.setFadePlayback"
        @set-seamless-playback="player.setSeamlessPlayback"
      />

      <PlaybackFallbackSettings
        :locale="locale"
        :online-playback-failure-action="player.settings.onlinePlaybackFailureAction"
        :quality-fallback="player.settings.qualityFallback"
        @set-online-playback-failure-action="player.setOnlinePlaybackFailureAction"
        @set-quality-fallback="player.setQualityFallback"
      />
    </div>
  </details>
</template>

<style scoped>
.playback-behavior {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--smw-border);
  border-radius: 12px;
  background: var(--smw-bg-panel);
}

summary {
  position: relative;
  padding-right: 20px;
  list-style: none;
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

summary::-webkit-details-marker { display: none; }
summary::after { content: '▸'; position: absolute; right: 0; top: 0; }
.playback-behavior[open] > summary::after { content: '▾'; }

.playback-behavior-body {
  display: grid;
  gap: 16px;
  margin-top: 14px;
}

.playback-behavior-body :deep(.setting-group > p) {
  font-size: 12px;
  font-weight: 650;
}
</style>
