<script setup lang="ts">
import { computed } from 'vue';
import { usePlayerStore } from '../../stores/player';
import { useLyricsColors } from '../../composables/useLyricsColors';

const player = usePlayerStore();
const { base, highlight, glow } = useLyricsColors();
const en = computed(() => player.settings.locale === 'en-US');
const presets = ['#ffffff', '#a9b8c8', '#9db8cf', '#7ec8d8', '#65cfb1', '#7fa893', '#d8d5c5', '#c2af7e', '#daa65f', '#c18ba6', '#d46588', '#9d84ce', '#8b66ff', '#627bdb', '#3c9ed8', '#28bfc1', '#245c4c', '#6e2038', '#101418'];
const rows = computed(() => [
  { key: 'base', title: en.value ? 'Lyrics color' : '歌词颜色', color: base.value, linked: player.settings.useThemeLyricColor, label: en.value ? 'Cover' : '封面取色' },
  { key: 'lyricHighlightColor', title: en.value ? 'Highlight' : '高亮颜色', color: highlight.value, linked: !player.settings.lyricHighlightColor, label: en.value ? 'Follow lyrics' : '跟随歌词' },
  { key: 'lyricGlowColor', title: en.value ? 'Glow' : '溢光颜色', color: glow.value, linked: !player.settings.lyricGlowColor, label: en.value ? 'Follow highlight' : '跟随高亮' },
] as const);
function custom(key: string, color: string) {
  if (key === 'base') {
    player.setLyricFontColor(color);
  } else player.setLyricEffectColor(key as 'lyricHighlightColor' | 'lyricGlowColor', color);
}
function link(key: string) {
  if (key === 'base') player.setUseThemeLyricColor(true);
  else player.setLyricEffectColor(key as 'lyricHighlightColor' | 'lyricGlowColor', '');
}
</script>

<template>
  <details class="color-effects" open>
    <summary>{{ en ? 'Color and glow' : '颜色与光效' }}<small>{{ en ? 'Lyrics, highlight and glow' : '文字、高亮与溢光' }}</small></summary>
    <div class="color-body">
      <div class="palette">
        <button type="button" class="swatch auto" :class="{ active: player.settings.useThemeLyricColor }" :aria-pressed="player.settings.useThemeLyricColor" @click="link('base')">AUTO</button>
        <button v-for="color in presets" :key="color" type="button" class="swatch" :style="{ background: color }" :aria-label="color" :title="color" :aria-pressed="!player.settings.useThemeLyricColor && base === color" :class="{ active: !player.settings.useThemeLyricColor && base === color }" @click="custom('base', color)" />
      </div>
      <div v-for="row in rows" :key="row.key" class="color-row">
        <input type="color" :aria-label="row.title" :value="row.color" @change="custom(row.key, ($event.target as HTMLInputElement).value)" />
        <span><strong>{{ row.title }}</strong><small>{{ row.linked ? row.label : row.color.toUpperCase() }}</small></span>
        <button type="button" class="source-action" :class="{ active: row.linked }" :aria-pressed="row.linked" @click="link(row.key)">{{ row.key === 'base' ? (en ? 'Cover' : '封面') : (en ? 'Follow' : '跟随') }}</button>
      </div>
    </div>
  </details>
</template>

<style scoped>
.color-effects { border: 1px solid var(--smw-border); }
.color-body { display: grid; gap: 8px; }
.palette { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; padding: 8px; border: 1px solid var(--smw-border); border-radius: 8px; }
.swatch { height: 30px; border: 1px solid var(--smw-border); border-radius: 7px; cursor: pointer; }
.auto { color: var(--smw-text-primary); background: var(--smw-bg-input); font: inherit; font-size: 11px; font-weight: 650; }
.swatch.active { border-color: var(--smw-border-strong); }
.auto.active { background: var(--smw-bg-selected); }
.color-row { display: flex; align-items: center; gap: 10px; padding: 8px; border: 1px solid var(--smw-border); border-radius: 8px; background: var(--smw-bg-input); }
.color-row > span { flex: 1; display: grid; gap: 2px; }
strong { font-size: 12px; } small { font-size: 11px; color: var(--smw-text-secondary); }
input[type='color'] { width: 40px; height: 32px; padding: 0; border: 0; background: transparent; cursor: pointer; }
input::-webkit-color-swatch-wrapper { padding: 0; } input::-webkit-color-swatch { border: 1px solid var(--smw-border); border-radius: 6px; }
.source-action { display: inline-grid; place-items: center; min-height: 28px; padding: 0 10px; border: 1px solid var(--smw-border); border-radius: 7px; color: var(--smw-text-body); background: var(--smw-bg-input); font: inherit; font-size: 11px; font-weight: 650; cursor: pointer; }
.source-action:hover { border-color: var(--smw-border-strong); background: var(--smw-bg-hover); }
button:focus-visible { outline: 2px solid var(--smw-button-primary); outline-offset: 2px; }
</style>
