<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n';
import { usePlayerStore } from '../../stores/player';
import PlaybackAudioCacheSettings from './PlaybackAudioCacheSettings.vue';
import PlaybackAudioOutputSettings from './PlaybackAudioOutputSettings.vue';
import PlaybackBehaviorSettings from './PlaybackBehaviorSettings.vue';
import PlaybackSleepTimerSettings from './PlaybackSleepTimerSettings.vue';

const player = usePlayerStore();
const locale = computed(() => player.settings.locale);
</script>

<template>
  <section class="settings-section">
    <h2>{{ t(locale, 'playback') }}</h2>

    <PlaybackBehaviorSettings />

    <PlaybackAudioCacheSettings
      :download-dir="player.settings.downloadDir"
      :set-download-dir="player.setDownloadDir"
      :audio-cache-dir="player.settings.audioCacheDir"
      :audio-cache-max-mb="player.settings.audioCacheMaxMb"
      :locale="locale"
      :set-audio-cache-dir="player.setAudioCacheDir"
      :set-audio-cache-max-mb="player.setAudioCacheMaxMb"
    />

    <PlaybackAudioOutputSettings
      :audio-output-device-id="player.settings.audioOutputDeviceId"
      :locale="locale"
      :set-audio-output-device-id="player.setAudioOutputDeviceId"
    />

    <PlaybackSleepTimerSettings
      :sleep-timer-action="player.settings.sleepTimerAction"
      :sleep-timer-minutes="player.settings.sleepTimerMinutes"
      @set-sleep-timer-action="player.setSleepTimerAction"
      @set-sleep-timer-minutes="player.setSleepTimerMinutes"
    />


  </section>
</template>

<style scoped>
.settings-section {
  display: grid;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--smw-border);
}

.settings-section h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 720;
}

</style>
