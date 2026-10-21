<script setup lang="ts">
import DesktopStylePreview from './DesktopStylePreview.vue';
import * as cardManifest from '../../../plugin/playback-card/plugin.json';
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { usePlayerStore } from '../../stores/player';
import { desktopLyricsPlugins, openDesktopLyricsStyle, closeDesktopLyrics, selectDesktopLyricsStyle, isDesktopLyricsVisible } from '../../services/desktopLyricsOptions';
import { getPluginConfig } from '../../services/plugins';
import { isTauriRuntime } from '../../services/music';
import { PLUGINS_CHANGED_EVENT } from '../../composables/useMusicSourcePluginAvailability';
import type { PluginManifest } from '../../types/plugin';
import { defaultDesktopAppearance, loadDesktopAppearance, saveDesktopAppearance } from '../../services/desktopLyricsAppearance';
const appearance = ref({ ...defaultDesktopAppearance });
const desktopVisible = ref(false);
const stylesExpanded = ref(false);
const lockBusy = ref(false);
let visibilityTimer: ReturnType<typeof setInterval> | undefined;
async function refreshVisibility() {
  if (!busy.value) desktopVisible.value = await isDesktopLyricsVisible();
}
async function toggleLock() {
  if (lockBusy.value) return;
  lockBusy.value = true;
  try {
    const next = { ...appearance.value, locked: !appearance.value.locked };
    await saveDesktopAppearance(next);
    appearance.value = next;
  } catch (cause) { error.value = String(cause); }
  finally { lockBusy.value = false; }
}
async function updateAppearance() {
  try { await saveDesktopAppearance({ ...appearance.value }); }
  catch (cause) { error.value = String(cause); }
}
const player = usePlayerStore();
const english = computed(() => player.settings.locale === 'en-US');
const plugins = ref<PluginManifest[]>([]), selected = ref('floating'), busy = ref(false), error = ref('');
const options = computed(() => [
  { id:'floating', name:english.value ? 'Floating lyrics (built-in)' : '悬浮歌词（内置）' },
  ...(cardManifest.configSchema.fields.find(field => field.key === 'cardStyle')?.options || []).map(style => ({ id:'card:' + style.value, name:style.label })),
  ...plugins.value.map(p => ({ id:p.id, name:p.name })),
]);
const visibleOptions = computed(() => stylesExpanded.value ? options.value : options.value.slice(0, 3));
async function refresh() {
  try { plugins.value = await desktopLyricsPlugins(); }
  catch (cause) { error.value = String(cause); }
}
async function choose(id: string) {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try {
    await selectDesktopLyricsStyle(id);
    selected.value = id;
  }
  catch (cause) { error.value = String(cause); }
  finally { busy.value = false; }
}
async function run() {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try {
    if (await isDesktopLyricsVisible()) await closeDesktopLyrics();
    else await openDesktopLyricsStyle(selected.value.startsWith('card:') ? 'playback-card' : selected.value);
    desktopVisible.value = await isDesktopLyricsVisible();
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause); }
  finally { busy.value = false; }
}
onMounted(async () => {
  window.addEventListener(PLUGINS_CHANGED_EVENT, refresh);
  if (!isTauriRuntime()) return;
  await refreshVisibility();
  visibilityTimer = setInterval(() => { void refreshVisibility().catch(() => {}); }, 1000);
  await refresh();
  try {
    const saved = await getPluginConfig('desktop-lyrics.host');
    appearance.value = await loadDesktopAppearance();
    if (saved.rendererId === 'playback-card') {
      const config = await getPluginConfig('playback-card');
      const id = 'card:' + (config.cardStyle || 'minimal');
      selected.value = options.value.some(o => o.id === id) ? id : 'card:minimal';
    } else if (options.value.some(o => o.id === saved.rendererId)) selected.value = String(saved.rendererId);
  } catch (cause) { error.value = String(cause); }
});
onBeforeUnmount(() => { clearInterval(visibilityTimer); window.removeEventListener(PLUGINS_CHANGED_EVENT, refresh); });
</script>
<template>
  <details class="desktop-setting" open>
    <summary>{{ english ? 'Desktop lyrics' : '桌面歌词' }}</summary>
    <div class="desktop-options">
      <div class="actions">
        <button class="toggle-button" :aria-pressed="desktopVisible" :disabled="busy || !isTauriRuntime()" @click="run"><span>{{ english ? 'Desktop lyrics' : '桌面歌词' }}</span><i aria-hidden="true" /></button>
        <button class="toggle-button" :aria-pressed="appearance.locked" :disabled="lockBusy || !isTauriRuntime()" @click="toggleLock"><span>{{ english ? 'Lock desktop lyrics' : '桌面歌词锁定' }}</span><i aria-hidden="true" /></button>
      </div>
      <p v-if="appearance.locked">{{ english ? 'Mouse clicks pass through. Unlock here to move or control lyrics.' : '已锁定，鼠标可穿透；在这里关闭锁定即可拖动和操作。' }}</p>
      <label class="appearance-control"><span>{{ english ? 'Size' : '桌面歌词大小' }}</span><input v-model.number="appearance.scale" type="range" min="0.75" max="1.5" step="0.05" @input="updateAppearance" /><output>{{ Math.round(appearance.scale * 100) }}%</output></label>
      <label class="appearance-control"><span>{{ english ? 'Opacity' : '桌面歌词透明度' }}</span><input v-model.number="appearance.opacity" type="range" min="0.2" max="1" step="0.05" @input="updateAppearance" /><output>{{ Math.round(appearance.opacity * 100) }}%</output></label>
      <p>{{ english ? 'Desktop card style' : '桌面卡片样式' }}</p>

      <p v-if="error" role="alert">{{ error }}</p>
      <div class="style-grid" role="group" :aria-label="english ? 'Desktop style' : '桌面歌词样式'">
        <button v-for="option in visibleOptions" :key="option.id" class="style-tile" :class="{selected:selected === option.id}" :aria-pressed="selected === option.id" :disabled="busy" @click="choose(option.id)">
          <DesktopStylePreview :style-id="option.id.startsWith('card:') ? option.id.slice(5) : option.id === 'floating' ? 'floating' : 'plugin'" />
          <span>{{ option.name }}</span><span v-if="selected === option.id" class="selected-mark" aria-hidden="true">✓</span>
        </button>
      </div>
      <button v-if="options.length > 3" type="button" :aria-expanded="stylesExpanded" @click="stylesExpanded = !stylesExpanded">{{ stylesExpanded ? (english ? 'Show less' : '收起') : (english ? 'Show more' : '展开更多') }}</button>
    </div>
  </details>
</template>
<style scoped>
.desktop-setting{min-width:0;border:1px solid var(--smw-border);border-radius:8px}
.desktop-options{display:grid;gap:12px}
.appearance-control{display:grid;grid-template-columns:104px minmax(0,1fr) 42px;align-items:center;gap:10px;min-height:36px;font-size:13px;color:var(--smw-text-body)}
.appearance-control input[type=range]{width:100%;min-width:0;margin:0;accent-color:var(--smw-button-primary)}
.appearance-control output{text-align:right;font-variant-numeric:tabular-nums}
.actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.toggle-button{display:flex;align-items:center;justify-content:center;gap:8px;min-height:38px;text-align:center;color:var(--smw-text-secondary);font-size:12px;line-height:1.4;transition:background 150ms ease,border-color 150ms ease,box-shadow 150ms ease}
.toggle-button i{display:none}
button,select{padding:8px 10px;max-width:100%;border:1px solid var(--smw-border);border-radius:8px;background:var(--smw-bg-input);color:var(--smw-text-body);font:inherit;font-size:13px;cursor:pointer}
button:hover:not(:disabled){background:var(--smw-bg-hover)}
button:disabled{opacity:.5;cursor:default}
button:focus-visible,select:focus-visible{outline:2px solid var(--smw-button-primary);outline-offset:2px}
p{margin:0;font-size:12px;line-height:1.6;color:var(--smw-text-secondary)}
.style-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-height:370px;overflow-y:auto;padding:3px}
.style-tile{position:relative;display:grid;gap:7px;padding:5px 5px 8px;min-width:0;text-align:center}
.style-tile:disabled{opacity:1}
.style-tile>span{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.style-tile.selected{border-color:var(--smw-button-primary);box-shadow:0 0 0 1px var(--smw-button-primary)}
.style-tile .selected-mark{position:absolute;top:8px;right:8px;border-radius:50%;background:var(--smw-button-primary);color:white;width:18px;height:18px;line-height:18px}
</style>

