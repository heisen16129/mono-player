<script setup lang="ts">
import { computed } from 'vue';
import { usePlayerStore } from '../../stores/player';
import { artworkDisplaySrc } from '../../utils/artwork';
import GeneralTrackListSettings from './GeneralTrackListSettings.vue';
import LyricsBackgroundSetting from './LyricsBackgroundSetting.vue';

const player = usePlayerStore();
const locale = computed(() => player.settings.locale);
const currentCoverUrl = computed(() => artworkDisplaySrc(
  player.currentTrack?.associatedArtwork || player.currentTrack?.artwork,
));
</script>

<template>
  <section class="settings-section">
    <h2>{{ locale === 'en-US' ? 'Interface' : '界面' }}</h2>
    <GeneralTrackListSettings
      :enable-track-cover-edit="player.settings.enableTrackCoverEdit"
      :enable-track-duration-refresh="player.settings.enableTrackDurationRefresh"
      :enable-track-metadata-edit="player.settings.enableTrackMetadataEdit"
      :locale="locale"
      :show-track-covers="player.settings.showTrackCovers"
      :show-track-numbers="player.settings.showTrackNumbers"
      @set-enable-track-cover-edit="player.setEnableTrackCoverEdit"
      @set-enable-track-duration-refresh="player.setEnableTrackDurationRefresh"
      @set-enable-track-metadata-edit="player.setEnableTrackMetadataEdit"
      @set-show-track-covers="player.setShowTrackCovers"
      @set-show-track-numbers="player.setShowTrackNumbers"
    />

    <LyricsBackgroundSetting
      :cover-url="currentCoverUrl"
      :locale="locale"
      :preview="player.previewLyricsBackground"
      :update="player.setLyricsBackground"
      :value="player.settings.lyricsBackground"
    />
  </section>
</template>

<style scoped>
.settings-section {
  display: grid;
  gap: 12px;
}
</style>
