<script setup lang="ts">
import { usePlayerStore } from '../../stores/player';
import McpAutoStartSetting from './McpAutoStartSetting.vue';
import McpConnectionPanel from './McpConnectionPanel.vue';
import McpFeatureGrid from './McpFeatureGrid.vue';
import McpStatusPanel from './McpStatusPanel.vue';

const player = usePlayerStore();
const mcpFeatureGroups = [
  {
    title: '曲库',
    items: [
      'mono_library_summary：查看曲库概况。',
      'mono_list_tracks：搜索或列出曲库歌曲。',
      'mono_get_track：查看单曲详情。',
      'mono_list_artists：列出歌手并统计歌曲数。',
      'mono_list_albums：列出专辑并统计歌曲数。',
      'mono_list_playlists：列出歌单。',
      'mono_get_playlist：查看歌单歌曲。',
      'mono_scan_folder：扫描指定本地音乐目录。',
    ],
  },
  {
    title: '播放状态',
    items: [
      'mono_player_state：查看播放器状态。',
      'mono_current_music_state：查看当前音乐摘要，如歌名、歌手、进度、总时长。',
      'mono_queue_snapshot：查看当前播放队列。',
    ],
  },
  {
    title: '播放控制',
    items: [
      'mono_play_track：按 track id 播放本地歌曲。',
      'mono_pause / mono_resume / mono_stop：暂停、继续、停止播放。',
      'mono_next / mono_previous：切换上一首或下一首。',
      'mono_seek：跳转到指定秒数。',
      'mono_set_volume：设置音量，范围 0 到 1。',
      'mono_set_sleep_timer：设置定时关闭。',
    ],
  },
  {
    title: '在线音乐',
    items: [
      'mono_search_online_music：通过插件搜索在线音乐。',
      'mono_play_online_music：播放在线音乐并同步到底部播放栏。',
      'mono_get_lyrics：获取本地或在线歌词。',
      'mono_get_cover：获取封面图。',
      'mono_download_track：下载在线歌曲到本地。',
    ],
  },
  {
    title: '资源',
    items: [
      'mono://library/summary：曲库概况。',
      'mono://library/tracks：曲库歌曲列表。',
      'mono://playlists：歌单列表。',
      'mono://player/state：播放器状态。',
      'mono://player/queue：播放队列。',
    ],
  },
] as const;
</script>

<template>
  <section class="settings-section mcp-settings-section">
    <h2>MCP</h2>

    <McpAutoStartSetting
      :enabled="player.settings.mcpAutoStart"
      @set-enabled="player.setMcpAutoStart"
    />

    <div class="setting-group">
      <p>MCP 服务</p>
      <McpStatusPanel />
      <McpConnectionPanel />
    </div>

    <div class="setting-group">
      <p>MCP 功能</p>
      <McpFeatureGrid :groups="mcpFeatureGroups" />
    </div>
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

.mcp-settings-section {
  max-width: 860px;
}

</style>
