<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { systemWorkerHealth, type WorkerDiagnostic } from '../../services/music';
import { usePlayerStore } from '../../stores/player';
import { getErrorMessage } from '../../utils/error';

const player = usePlayerStore();
const mcpEndpoint = 'http://127.0.0.1:17331/mcp';
const mcpHealthEndpoint = 'http://127.0.0.1:17331/health';
const mcpConfigJson = JSON.stringify(
  {
    mcpServers: {
      'mono-player-http': {
        type: 'http',
        url: mcpEndpoint,
      },
    },
  },
  null,
  2,
);
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
const mcpCopyMessage = ref('');
const mcpStatus = ref<WorkerDiagnostic | null>(null);
const mcpStatusError = ref('');
const isRefreshingMcpStatus = ref(false);
const mcpStatusLabel = computed(() => {
  if (mcpStatus.value?.running) return '运行中';
  if (mcpStatus.value || mcpStatusError.value) return '未运行';
  return '未知';
});
const mcpStatusTone = computed(() => (mcpStatus.value?.running ? 'running' : 'stopped'));
const mcpRestartPolicyLabel = computed(() => {
  switch (mcpStatus.value?.restartPolicy) {
    case 'restartOnceAndRetry':
      return '失败后重启并重试一次';
    case 'restartBeforeSendOnly':
      return '发送前可重启，不重放任务';
    case 'perTask':
      return '按任务启动';
    case 'noRestart':
      return '不自动重启';
    default:
      return '—';
  }
});
const mcpStartedAtLabel = computed(() => {
  const startedAtMs = mcpStatus.value?.startedAtMs;
  if (!startedAtMs) return '—';
  return new Date(Number(startedAtMs)).toLocaleString();
});

async function copyMcpConfig() {
  await navigator.clipboard.writeText(mcpConfigJson);
  mcpCopyMessage.value = '已复制 MCP JSON';
  window.setTimeout(() => {
    mcpCopyMessage.value = '';
  }, 1800);
}

function setMcpAutoStart(event: Event) {
  player.setMcpAutoStart((event.target as HTMLInputElement).checked);
}

async function refreshMcpStatus() {
  isRefreshingMcpStatus.value = true;
  mcpStatusError.value = '';
  try {
    const snapshot = await systemWorkerHealth();
    mcpStatus.value = snapshot.workers.find((worker) => worker.worker === 'mcp-api') ?? null;
  } catch (error) {
    mcpStatus.value = null;
    mcpStatusError.value = getErrorMessage(error);
  } finally {
    isRefreshingMcpStatus.value = false;
  }
}

onMounted(() => {
  void refreshMcpStatus();
});
</script>

<template>
  <section class="settings-section mcp-settings-section">
    <h2>MCP</h2>

    <div class="setting-group">
      <p>MCP 启动</p>
      <label class="option-row">
        <input
          type="checkbox"
          :checked="player.settings.mcpAutoStart"
          @change="setMcpAutoStart"
        />
        启动应用时自动启动 HTTP MCP 服务
      </label>
      <small class="mcp-note">修改后需要重启 Mono Player 才会生效。</small>
    </div>

    <div class="setting-group">
      <p>MCP 服务</p>
      <div class="mcp-status-panel">
        <div class="mcp-status-head">
          <span class="mcp-status-pill" :class="mcpStatusTone">{{ mcpStatusLabel }}</span>
          <button class="secondary-button compact" type="button" :disabled="isRefreshingMcpStatus" @click="refreshMcpStatus">
            {{ isRefreshingMcpStatus ? '刷新中' : '刷新状态' }}
          </button>
        </div>
        <div class="mcp-status-grid">
          <span>进程</span>
          <strong>{{ mcpStatus?.worker ?? 'mcp-api' }}</strong>
          <span>PID</span>
          <strong>{{ mcpStatus?.pid ?? '—' }}</strong>
          <span>启动时间</span>
          <strong>{{ mcpStartedAtLabel }}</strong>
          <span>重启策略</span>
          <strong>{{ mcpRestartPolicyLabel }}</strong>
          <span>最近错误</span>
          <strong>{{ (mcpStatus?.error ?? mcpStatusError) || '—' }}</strong>
        </div>
      </div>
      <div class="mcp-endpoint-list">
        <span>连接地址：<code>{{ mcpEndpoint }}</code></span>
        <span>健康检查：<code>{{ mcpHealthEndpoint }}</code></span>
      </div>
      <small class="mcp-note">
        启动 Mono Player 后，HTTP MCP 服务会自动在本机启动。外部 MCP 客户端使用下面的 JSON 连接即可。
      </small>
    </div>

    <div class="setting-group">
      <div class="mcp-code-heading">
        <p>MCP 杩炴帴 JSON</p>
        <span>
          <button class="secondary-button compact" type="button" @click="copyMcpConfig">澶嶅埗</button>
          <small v-if="mcpCopyMessage">{{ mcpCopyMessage }}</small>
        </span>
      </div>
      <pre class="mcp-config-code"><code>{{ mcpConfigJson }}</code></pre>
    </div>

    <div class="setting-group">
      <p>MCP 鍔熻兘</p>
      <div class="mcp-feature-grid">
        <article v-for="group in mcpFeatureGroups" :key="group.title" class="mcp-feature-group">
          <h3>{{ group.title }}</h3>
          <ul>
            <li v-for="item in group.items" :key="item">{{ item }}</li>
          </ul>
        </article>
      </div>
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

.mcp-settings-section {
  max-width: 860px;
}

.mcp-status-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: var(--smw-bg-panel);
}

.mcp-status-head {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.mcp-status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-input);
  font-size: 12px;
  font-weight: 680;
}

.mcp-status-pill.running {
  color: #087f5b;
  background: rgba(8, 127, 91, 0.12);
}

.mcp-status-pill.stopped {
  color: #b42318;
  background: rgba(180, 35, 24, 0.1);
}

.mcp-status-grid {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 7px 12px;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.mcp-status-grid strong {
  min-width: 0;
  overflow: hidden;
  color: var(--smw-text-body);
  font-weight: 520;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mcp-endpoint-list {
  display: grid;
  gap: 6px;
  color: var(--smw-text-body);
  font-size: 13px;
}

.mcp-endpoint-list code,
.mcp-config-code {
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: var(--smw-bg-input);
}

.mcp-endpoint-list code {
  padding: 2px 6px;
  color: var(--smw-text-primary);
  font-size: 12px;
}

.mcp-note {
  color: var(--smw-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.mcp-code-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.mcp-code-heading > span {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.mcp-code-heading small {
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.mcp-config-code {
  overflow-x: auto;
  margin: 0;
  padding: 14px;
  color: var(--smw-text-body);
  font-size: 12px;
  line-height: 1.55;
}

.mcp-feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 12px;
}

.mcp-feature-group {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: var(--smw-bg-panel);
}

.mcp-feature-group h3 {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 14px;
  font-weight: 700;
}

.mcp-feature-group ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
  color: var(--smw-text-body);
  font-size: 12px;
  line-height: 1.5;
}

.secondary-button.compact:hover {
  border-color: color-mix(in srgb, var(--smw-button-primary) 34%, var(--smw-border));
  color: var(--smw-button-primary);
  background: color-mix(in srgb, var(--smw-button-primary) 8%, var(--smw-bg-input));
}

.secondary-button.compact:focus-visible {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
  outline: none;
}
</style>
