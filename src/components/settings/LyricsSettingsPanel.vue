<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n';
import { usePlayerStore } from '../../stores/player';
import LyricsFontColorSetting from './LyricsFontColorSetting.vue';
import LyricsFontSizeSetting from './LyricsFontSizeSetting.vue';
import LyricsBackgroundSetting from './LyricsBackgroundSetting.vue';
import LyricsRendererSetting from './LyricsRendererSetting.vue';
import { artworkDisplaySrc } from '../../utils/artwork';

const player = usePlayerStore();
const locale = computed(() => player.settings.locale);
const currentCoverUrl = computed(() => artworkDisplaySrc(
  player.currentTrack?.associatedArtwork || player.currentTrack?.artwork,
));
const lyricFontSizeOptions = Array.from({ length: 21 }, (_, index) => String(index + 14));

</script>

<template>
  <section class="settings-section">
    <h2>{{ t(locale, 'lyrics') }}</h2>
    <label class="option-row">
      <input
        type="checkbox"
        :checked="player.settings.autoHideLyricsDock"
        @change="player.setAutoHideLyricsDock(($event.target as HTMLInputElement).checked)"
      />
      {{ t(locale, 'autoHideLyricsDock') }}
    </label>
    <LyricsFontSizeSetting
      :label="t(locale, 'fontSize')"
      :options="lyricFontSizeOptions"
      :value="player.settings.lyricFontSize"
      @change="player.setLyricFontSize"
    />
    <LyricsFontColorSetting
      :color="player.settings.lyricFontColor"
      :label="t(locale, 'fontColor')"
      :use-theme-color="player.settings.useThemeLyricColor"
      :use-theme-color-label="t(locale, 'useThemeColor')"
      @set-color="player.setLyricFontColor"
      @set-use-theme-color="player.setUseThemeLyricColor"
    />
    <LyricsBackgroundSetting
      :cover-url="currentCoverUrl"
      :locale="locale"
      :preview="player.previewLyricsBackground"
      :update="player.setLyricsBackground"
      :value="player.settings.lyricsBackground"
    />
    <LyricsRendererSetting />
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

.option-row {
  display: inline-flex;
  gap: 9px;
  align-items: center;
  min-height: 20px;
  color: var(--smw-text-body);
  font-size: 14px;
  line-height: 1.2;
}

.option-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--smw-button-primary);
}

</style>
