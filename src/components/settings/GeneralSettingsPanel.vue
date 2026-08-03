<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n';
import { usePlayerStore } from '../../stores/player';
import GeneralBehaviorSettings from './GeneralBehaviorSettings.vue';
import GeneralDownloadDirectorySetting from './GeneralDownloadDirectorySetting.vue';
import GeneralLanguageSetting from './GeneralLanguageSetting.vue';
import GeneralTrackListSettings from './GeneralTrackListSettings.vue';

const player = usePlayerStore();
const locale = computed(() => player.settings.locale);

</script>

<template>
  <section class="settings-section">
    <h2>{{ t(locale, 'settings') }}</h2>

    <GeneralBehaviorSettings
      :close-action="player.settings.closeAction"
      :locale="locale"
      :search-history-limit="player.settings.searchHistoryLimit"
      @set-close-action="player.setCloseAction"
      @set-search-history-limit="player.setSearchHistoryLimit"
    />

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

    <GeneralLanguageSetting :locale="locale" @set-locale="player.setLocale" />

    <GeneralDownloadDirectorySetting
      :download-dir="player.settings.downloadDir"
      :locale="locale"
      :set-download-dir="player.setDownloadDir"
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
