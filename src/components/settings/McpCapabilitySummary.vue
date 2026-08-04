<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  locale: string;
}>();

const groups = computed(() => {
  const en = props.locale === 'en-US';
  return en
    ? [
        { title: 'Library tools', items: [
          { name: 'mono_library_summary', description: 'Read a compact library summary.' },
          { name: 'mono_list_tracks', description: 'Search or list local tracks.' },
          { name: 'mono_get_track', description: 'Read one track by ID.' },
          { name: 'mono_list_artists', description: 'List artists and track counts.' },
          { name: 'mono_list_albums', description: 'List albums and track counts.' },
          { name: 'mono_scan_folder', description: 'Scan a local music folder.' },
        ] },
        { title: 'Playlist tools', items: [
          { name: 'mono_list_playlists', description: 'List user playlists.' },
          { name: 'mono_get_playlist', description: 'Read playlist tracks by playlist ID.' },
        ] },
        { title: 'Playback state', items: [
          { name: 'mono_player_state', description: 'Read full player state.' },
          { name: 'mono_current_music_state', description: 'Read current song, progress, and duration.' },
          { name: 'mono_queue_snapshot', description: 'Read the current playback queue.' },
        ] },
        { title: 'Playback controls', items: [
          { name: 'mono_play_track', description: 'Play a local track by ID.' },
          { name: 'mono_pause', description: 'Pause playback.' },
          { name: 'mono_resume', description: 'Resume playback.' },
          { name: 'mono_stop', description: 'Stop playback.' },
          { name: 'mono_next', description: 'Switch to the next track.' },
          { name: 'mono_previous', description: 'Switch to the previous track.' },
          { name: 'mono_seek', description: 'Seek to a time in seconds.' },
          { name: 'mono_set_volume', description: 'Set volume from 0 to 1.' },
          { name: 'mono_set_sleep_timer', description: 'Set the sleep timer in minutes.' },
        ] },
        { title: 'Online music tools', items: [
          { name: 'mono_search_online_music', description: 'Search online music through plugins.' },
          { name: 'mono_play_online_music', description: 'Play an online track.' },
          { name: 'mono_get_lyrics', description: 'Fetch lyrics for local or online music.' },
          { name: 'mono_get_cover', description: 'Fetch cover artwork.' },
          { name: 'mono_download_track', description: 'Download an online track locally.' },
        ] },
        { title: 'Resources', items: [
          { name: 'mono://library/summary', description: 'Library summary resource.' },
          { name: 'mono://library/tracks', description: 'Local tracks resource.' },
          { name: 'mono://playlists', description: 'Playlists resource.' },
          { name: 'mono://player/state', description: 'Player state resource.' },
          { name: 'mono://player/queue', description: 'Playback queue resource.' },
        ] },
      ]
    : [
        { title: '\u66f2\u5e93\u5de5\u5177', items: [
          { name: 'mono_library_summary', description: '\u67e5\u770b\u66f2\u5e93\u6982\u8981\u4fe1\u606f\u3002' },
          { name: 'mono_list_tracks', description: '\u641c\u7d22\u6216\u5217\u51fa\u672c\u5730\u6b4c\u66f2\u3002' },
          { name: 'mono_get_track', description: '\u6309 ID \u67e5\u770b\u5355\u9996\u6b4c\u66f2\u8be6\u60c5\u3002' },
          { name: 'mono_list_artists', description: '\u5217\u51fa\u6b4c\u624b\u548c\u5bf9\u5e94\u6b4c\u66f2\u6570\u3002' },
          { name: 'mono_list_albums', description: '\u5217\u51fa\u4e13\u8f91\u548c\u5bf9\u5e94\u6b4c\u66f2\u6570\u3002' },
          { name: 'mono_scan_folder', description: '\u626b\u63cf\u6307\u5b9a\u7684\u672c\u5730\u97f3\u4e50\u6587\u4ef6\u5939\u3002' },
        ] },
        { title: '\u6b4c\u5355\u5de5\u5177', items: [
          { name: 'mono_list_playlists', description: '\u5217\u51fa\u7528\u6237\u6b4c\u5355\u3002' },
          { name: 'mono_get_playlist', description: '\u6309\u6b4c\u5355 ID \u67e5\u770b\u6b4c\u5355\u5185\u6b4c\u66f2\u3002' },
        ] },
        { title: '\u64ad\u653e\u72b6\u6001', items: [
          { name: 'mono_player_state', description: '\u67e5\u770b\u64ad\u653e\u5668\u5b8c\u6574\u72b6\u6001\u3002' },
          { name: 'mono_current_music_state', description: '\u67e5\u770b\u5f53\u524d\u6b4c\u66f2\u3001\u8fdb\u5ea6\u548c\u65f6\u957f\u3002' },
          { name: 'mono_queue_snapshot', description: '\u67e5\u770b\u5f53\u524d\u64ad\u653e\u961f\u5217\u3002' },
        ] },
        { title: '\u64ad\u653e\u63a7\u5236', items: [
          { name: 'mono_play_track', description: '\u6309 ID \u64ad\u653e\u672c\u5730\u6b4c\u66f2\u3002' },
          { name: 'mono_pause', description: '\u6682\u505c\u64ad\u653e\u3002' },
          { name: 'mono_resume', description: '\u7ee7\u7eed\u64ad\u653e\u3002' },
          { name: 'mono_stop', description: '\u505c\u6b62\u64ad\u653e\u3002' },
          { name: 'mono_next', description: '\u5207\u6362\u5230\u4e0b\u4e00\u9996\u3002' },
          { name: 'mono_previous', description: '\u5207\u6362\u5230\u4e0a\u4e00\u9996\u3002' },
          { name: 'mono_seek', description: '\u8df3\u8f6c\u5230\u6307\u5b9a\u79d2\u6570\u3002' },
          { name: 'mono_set_volume', description: '\u8bbe\u7f6e\u97f3\u91cf\uff0c\u8303\u56f4 0 \u5230 1\u3002' },
          { name: 'mono_set_sleep_timer', description: '\u8bbe\u7f6e\u5b9a\u65f6\u5173\u95ed\u5206\u949f\u6570\u3002' },
        ] },
        { title: '\u5728\u7ebf\u97f3\u4e50\u5de5\u5177', items: [
          { name: 'mono_search_online_music', description: '\u901a\u8fc7\u63d2\u4ef6\u641c\u7d22\u5728\u7ebf\u97f3\u4e50\u3002' },
          { name: 'mono_play_online_music', description: '\u64ad\u653e\u5728\u7ebf\u6b4c\u66f2\u3002' },
          { name: 'mono_get_lyrics', description: '\u83b7\u53d6\u672c\u5730\u6216\u5728\u7ebf\u6b4c\u8bcd\u3002' },
          { name: 'mono_get_cover', description: '\u83b7\u53d6\u5c01\u9762\u56fe\u3002' },
          { name: 'mono_download_track', description: '\u4e0b\u8f7d\u5728\u7ebf\u6b4c\u66f2\u5230\u672c\u5730\u3002' },
        ] },
        { title: '\u8d44\u6e90', items: [
          { name: 'mono://library/summary', description: '\u66f2\u5e93\u6982\u8981\u8d44\u6e90\u3002' },
          { name: 'mono://library/tracks', description: '\u672c\u5730\u6b4c\u66f2\u5217\u8868\u8d44\u6e90\u3002' },
          { name: 'mono://playlists', description: '\u6b4c\u5355\u5217\u8868\u8d44\u6e90\u3002' },
          { name: 'mono://player/state', description: '\u64ad\u653e\u5668\u72b6\u6001\u8d44\u6e90\u3002' },
          { name: 'mono://player/queue', description: '\u64ad\u653e\u961f\u5217\u8d44\u6e90\u3002' },
        ] },
      ];
});

const title = computed(() => (props.locale === 'en-US' ? 'Available capabilities' : '\u53ef\u7528\u80fd\u529b'));
const summary = computed(() => (props.locale === 'en-US' ? '25 tools, 5 resources' : '25 \u4e2a\u5de5\u5177\uff0c5 \u4e2a\u8d44\u6e90'));
</script>

<template>
  <div class="setting-group">
    <p>{{ title }}<small>{{ summary }}</small></p>
    <div class="mcp-capability-list">
      <section v-for="group in groups" :key="group.title" class="mcp-capability-group">
        <h3>{{ group.title }}</h3>
        <ul>
          <li v-for="item in group.items" :key="item.name">
            <code>{{ item.name }}</code>
            <span>{{ item.description }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.setting-group {
  display: grid;
  gap: 8px;
}

.setting-group p {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
}

.setting-group p small {
  color: var(--smw-text-secondary);
  font-size: 12px;
  font-weight: 400;
}

.mcp-capability-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 10px;
  max-width: 860px;
}

.mcp-capability-group {
  display: grid;
  gap: 7px;
  padding: 11px 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: var(--smw-bg-panel);
}

.mcp-capability-group h3 {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 700;
}

.mcp-capability-group ul {
  display: grid;
  gap: 5px;
  margin: 0;
  padding: 0;
  color: var(--smw-text-body);
  font-size: 12px;
  line-height: 1.5;
  list-style: none;
}

.mcp-capability-group li {
  display: grid;
  gap: 2px;
}

.mcp-capability-group code {
  overflow: hidden;
  color: var(--smw-text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mcp-capability-group li span {
  color: var(--smw-text-secondary);
  font-size: 12px;
  line-height: 1.45;
}
</style>
