<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n';
import { usePlayerStore } from '../../stores/player';
import LyricsColorEffectsSetting from './LyricsColorEffectsSetting.vue';
import LyricsRendererSetting from './LyricsRendererSetting.vue';

const player = usePlayerStore();
const locale = computed(() => player.settings.locale);

</script>

<template>
  <section class="settings-section">
    <h2>{{ t(locale, 'lyrics') }}</h2>
    <LyricsRendererSetting />
    <LyricsColorEffectsSetting />
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
