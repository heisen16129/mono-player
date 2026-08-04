<script setup lang="ts">
import { computed } from 'vue';
import { resolveLocale } from '../../i18n';
import { DEFAULT_SHORTCUT_BINDINGS } from '../../stores/player/constants';
import { usePlayerStore } from '../../stores/player';
import type { Locale, ShortcutAction, ShortcutBindings } from '../../types/music';
import { normalizeShortcutValue, SHORTCUT_ACTIONS } from '../../utils/shortcuts';
import ShortcutRecorderField from './ShortcutRecorderField.vue';

const player = usePlayerStore();
const locale = computed(() => player.settings.locale);

interface ShortcutRow {
  action: ShortcutAction;
  label: string;
}

const text = computed(() => shortcutText(locale.value));
const rows = computed<ShortcutRow[]>(() => SHORTCUT_ACTIONS.map((action) => ({
  action,
  label: text.value.actions[action],
})));
const appConflicts = computed(() => findConflicts(player.settings.appShortcuts));

function setEnableAppShortcuts(event: Event) {
  player.setEnableAppShortcuts((event.target as HTMLInputElement).checked);
}

function resetAppShortcut(action: ShortcutAction) {
  player.setAppShortcut(action, DEFAULT_SHORTCUT_BINDINGS[action]);
}

function findConflicts(bindings: ShortcutBindings) {
  const used = new Map<string, ShortcutAction[]>();
  for (const action of SHORTCUT_ACTIONS) {
    const shortcut = normalizeShortcutValue(bindings[action]);
    if (!shortcut) continue;
    used.set(shortcut, [...(used.get(shortcut) ?? []), action]);
  }

  return new Set(
    [...used.values()]
      .filter((actions) => actions.length > 1)
      .flat(),
  );
}

function shortcutText(currentLocale: Locale) {
  const isEnglish = resolveLocale(currentLocale) === 'en-US';
  return {
    appColumn: isEnglish ? 'In-app shortcut' : '\u8f6f\u4ef6\u5185\u5feb\u6377\u952e',
    conflict: isEnglish ? 'Duplicate shortcuts will use the first matched action.' : '\u91cd\u590d\u5feb\u6377\u952e\u4f1a\u4f18\u5148\u89e6\u53d1\u5148\u5339\u914d\u7684\u529f\u80fd\u3002',
    reset: isEnglish ? 'Reset shortcut' : '\u6062\u590d\u9ed8\u8ba4\u5feb\u6377\u952e',
    section: isEnglish ? 'Shortcuts' : '\u5feb\u6377\u952e',
    enableApp: isEnglish ? 'Enable in-app shortcuts' : '\u542f\u7528\u8f6f\u4ef6\u5185\u5feb\u6377\u952e',
    empty: isEnglish ? 'Empty' : '\u7a7a',
    record: isEnglish ? 'Click and press keys' : '\u70b9\u51fb\u540e\u6309\u4e0b\u7ec4\u5408\u952e',
    actions: {
      nextTrack: isEnglish ? 'Play next' : '\u64ad\u653e\u4e0b\u4e00\u9996',
      previousTrack: isEnglish ? 'Play previous' : '\u64ad\u653e\u4e0a\u4e00\u9996',
      toggleDesktopLyrics: isEnglish ? 'Open / close desktop lyrics' : '\u6253\u5f00 / \u5173\u95ed\u684c\u9762\u6b4c\u8bcd',
      toggleFavorite: isEnglish ? 'Like current song' : '\u559c\u6b22\u5f53\u524d\u6b4c\u66f2',
      togglePlayback: isEnglish ? 'Play / pause' : '\u64ad\u653e / \u6682\u505c',
      togglePlaybackMode: isEnglish ? 'Switch playback mode' : '\u5207\u6362\u64ad\u653e\u6a21\u5f0f',
      volumeDown: isEnglish ? 'Volume down' : '\u964d\u4f4e\u97f3\u91cf',
      volumeUp: isEnglish ? 'Volume up' : '\u589e\u52a0\u97f3\u91cf',
    } satisfies Record<ShortcutAction, string>,
  };
}
</script>

<template>
  <section class="settings-section">
    <h2>{{ text.section }}</h2>

    <div class="setting-group">
      <label class="option-row">
        <input type="checkbox" :checked="player.settings.enableAppShortcuts" @change="setEnableAppShortcuts" />
        {{ text.enableApp }}
      </label>
    </div>

    <div class="setting-group">
      <p>{{ text.appColumn }}</p>

      <div class="shortcut-list">
        <div v-for="row in rows" :key="row.action" class="shortcut-row">
          <span class="shortcut-action">{{ row.label }}</span>
          <ShortcutRecorderField
            :empty-label="text.empty"
            :has-conflict="appConflicts.has(row.action)"
            :label="text.record"
            :reset-label="text.reset"
            :value="player.settings.appShortcuts[row.action]"
            @change="player.setAppShortcut(row.action, $event)"
            @reset="resetAppShortcut(row.action)"
          />
        </div>
      </div>
    </div>

    <small v-if="appConflicts.size" class="shortcut-note is-warning">{{ text.conflict }}</small>
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

.setting-group {
  display: grid;
  gap: 8px;
}

.setting-group p {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
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

.shortcut-list {
  display: grid;
  gap: 10px;
  max-width: 560px;
}

.shortcut-row {
  display: grid;
  grid-template-columns: 178px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
}

.shortcut-action {
  min-width: 0;
  color: var(--smw-text-body);
  font-size: 13px;
  line-height: 1.35;
}

.shortcut-note {
  color: var(--smw-text-muted);
  font-size: 12px;
}

.shortcut-note.is-warning {
  color: #b75050;
}

@media (max-width: 820px) {
  .shortcut-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
}
</style>
