<script setup lang="ts">
import { computed } from 'vue';
import { usePlayerStore } from '../../stores/player';
import GeneralBehaviorSettings from './GeneralBehaviorSettings.vue';
import GeneralLanguageSetting from './GeneralLanguageSetting.vue';

const player = usePlayerStore();
const locale = computed(() => player.settings.locale);

</script>

<template>
  <section class="settings-section">
    <h2>{{ locale === 'en-US' ? 'General' : '常用' }}</h2>

    <GeneralBehaviorSettings
      :close-action="player.settings.closeAction"
      :locale="locale"
      :search-history-limit="player.settings.searchHistoryLimit"
      @set-close-action="player.setCloseAction"
      @set-search-history-limit="player.setSearchHistoryLimit"
    />

    <GeneralLanguageSetting :locale="locale" @set-locale="player.setLocale" />

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
