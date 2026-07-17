<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { t } from '../i18n';
import { systemWorkerHealth, type WorkerDiagnostic } from '../services/music';
import { clearRustBackendCache, getRustBackendCacheStatus, getRustBackendDefaultCacheDir, getRustBackendSystemTempCacheDir, listRustBackendOutputDevices, pruneRustBackendCache } from '../services/playerBackend';
import { usePlayerStore } from '../stores/player';
import type { Locale, PlaybackQualityFallback } from '../types/music';

const player = usePlayerStore();
const tabKeys = ['settings', 'playback', 'lyrics', 'mcp', 'plugins', 'shortcuts', 'network', 'backup'] as const;
const activeTab = ref<(typeof tabKeys)[number]>('settings');
const historyOptions = ['5', '10', '15', '20', '25'];
const lyricFontSizeOptions = Array.from({ length: 21 }, (_, index) => String(index + 14));
const qualityFallbackOptions = [
  { value: 'lower', label: '自动降级' },
  { value: 'higher', label: '自动升级' },
  { value: 'none', label: '不重试' },
] as const satisfies readonly { value: PlaybackQualityFallback; label: string }[];
const playbackFailureOptions = [
  { value: 'pause', label: '暂停播放' },
  { value: 'next', label: '自动播放下一首' },
] as const;
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
      'mono_resolve_playback_url：解析在线音乐播放地址。',
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
const locale = computed(() => player.settings.locale);
const outputDevices = ref<{ id: string; name: string; isDefault: boolean }[]>([]);
const cacheCleanupMessage = ref('');
const mcpCopyMessage = ref('');
const mcpStatus = ref<WorkerDiagnostic | null>(null);
const mcpStatusError = ref('');
const isRefreshingMcpStatus = ref(false);
const cacheStatus = ref({ files: 0, bytes: 0 });
const cacheUsedLabel = computed(() => `${(cacheStatus.value.bytes / 1024 / 1024).toFixed(1)} MB`);
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

function setLocale(event: Event) {
  player.setLocale((event.target as HTMLSelectElement).value as Locale);
}

function setLyricFontSize(event: Event) {
  player.setLyricFontSize(Number((event.target as HTMLSelectElement).value));
}

function setLyricFontColor(event: Event) {
  player.setLyricFontColor((event.target as HTMLInputElement).value);
}

function setSleepTimerMinutes(event: Event) {
  player.setSleepTimerMinutes(Number((event.target as HTMLInputElement).value));
}

function setSearchHistoryLimit(event: Event) {
  player.setSearchHistoryLimit(Number((event.target as HTMLInputElement).value));
}

function setAudioCacheMaxMb(event: Event) {
  player.setAudioCacheMaxMb(Number((event.target as HTMLInputElement).value));
  void refreshCacheStatus();
}

async function chooseDownloadDir() {
  const selected = await open({
    directory: true,
    multiple: false,
    title: '选择下载目录',
  });

  if (typeof selected === 'string') {
    player.setDownloadDir(selected);
  }
}

async function chooseAudioCacheDir() {
  const selected = await open({
    directory: true,
    multiple: false,
    title: '选择音频临时缓存目录',
  });

  if (typeof selected === 'string') {
    player.setAudioCacheDir(selected);
  }
}

async function useSystemTempCacheDir() {
  const cacheDir = await getRustBackendSystemTempCacheDir();
  player.setAudioCacheDir(cacheDir);
}

async function useDefaultCacheDir() {
  const cacheDir = await getRustBackendDefaultCacheDir();
  player.setAudioCacheDir(cacheDir);
}

async function clearAudioCache() {
  const result = await clearRustBackendCache();
  await refreshCacheStatus();
  cacheCleanupMessage.value = `已清理 ${result.removedFiles} 个文件，释放 ${(result.removedBytes / 1024 / 1024).toFixed(1)} MB`;
}

async function pruneAudioCache() {
  const result = await pruneRustBackendCache(player.settings.audioCacheMaxMb * 1024 * 1024);
  cacheCleanupMessage.value = `已按上限清理 ${result.removedFiles} 个文件，当前约 ${(result.remainingBytes / 1024 / 1024).toFixed(1)} MB`;
}

async function refreshOutputDevices() {
  outputDevices.value = await listRustBackendOutputDevices();
}

async function refreshCacheStatus() {
  cacheStatus.value = await getRustBackendCacheStatus();
}

function setAudioOutputDevice(event: Event) {
  player.setAudioOutputDeviceId((event.target as HTMLSelectElement).value);
}

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

function setEnablePlugins(event: Event) {
  player.setEnablePlugins((event.target as HTMLInputElement).checked);
}

async function refreshMcpStatus() {
  isRefreshingMcpStatus.value = true;
  mcpStatusError.value = '';
  try {
    const snapshot = await systemWorkerHealth();
    mcpStatus.value = snapshot.workers.find((worker) => worker.worker === 'mcp-api') ?? null;
  } catch (error) {
    mcpStatus.value = null;
    mcpStatusError.value = error instanceof Error ? error.message : String(error);
  } finally {
    isRefreshingMcpStatus.value = false;
  }
}

onMounted(() => {
  void refreshOutputDevices();
  void refreshCacheStatus();
  void refreshMcpStatus();
});
</script>

<template>
  <section class="settings-view">
    <header class="settings-header">
      <h1>{{ t(locale, 'preferences') }}</h1>
      <nav class="settings-tabs" :aria-label="t(locale, 'settings')">
        <button
          v-for="tab in tabKeys"
          :key="tab"
          type="button"
          :class="{ active: activeTab === tab }"
          @click="activeTab = tab"
        >
          {{ t(locale, tab) }}
        </button>
      </nav>
    </header>

    <div class="settings-content">
      <section v-if="activeTab === 'settings'" class="settings-section">
        <h2>{{ t(locale, 'settings') }}</h2>

        <div class="setting-group">
          <p>{{ t(locale, 'closeAction') }}</p>
          <div class="option-list">
            <label class="option-row">
              <input
                type="radio"
                name="close-action"
                :checked="player.settings.closeAction === 'exit'"
                @change="player.setCloseAction('exit')"
              />
              {{ t(locale, 'exitApp') }}
            </label>
            <label class="option-row">
              <input
                type="radio"
                name="close-action"
                :checked="player.settings.closeAction === 'tray'"
                @change="player.setCloseAction('tray')"
              />
              {{ t(locale, 'minimizeToTray') }}
            </label>
          </div>
        </div>

        <div class="setting-group">
          <p>{{ t(locale, 'maxHistory') }}</p>
          <div class="inline-options history-options">
            <label v-for="option in historyOptions" :key="option" class="option-row">
              <input
                type="radio"
                name="search-history-limit"
                :value="option"
                :checked="player.settings.searchHistoryLimit === Number(option)"
                @change="setSearchHistoryLimit"
              />{{ option }}
            </label>
          </div>
        </div>

        <div class="setting-group">
          <p>{{ t(locale, 'songListHiddenColumns') }}</p>
          <div class="option-list">
            <label class="option-row">
              <input
                type="checkbox"
                :checked="player.settings.showTrackNumbers"
                @change="player.setShowTrackNumbers(($event.target as HTMLInputElement).checked)"
              />
              显示序号
            </label>
            <label class="option-row">
              <input
                type="checkbox"
                :checked="player.settings.showTrackCovers"
                @change="player.setShowTrackCovers(($event.target as HTMLInputElement).checked)"
              />
              显示歌曲封面
            </label>
          </div>
        </div>

        <div class="setting-group">
          <p>歌曲列表右键设置</p>
          <div class="option-list">
            <label class="option-row">
              <input
                type="checkbox"
                :checked="player.settings.enableTrackMetadataEdit"
                @change="player.setEnableTrackMetadataEdit(($event.target as HTMLInputElement).checked)"
              />
              更改元数据
            </label>
            <label class="option-row">
              <input
                type="checkbox"
                :checked="player.settings.enableTrackCoverEdit"
                @change="player.setEnableTrackCoverEdit(($event.target as HTMLInputElement).checked)"
              />
              更换封面
            </label>
            <label class="option-row">
              <input
                type="checkbox"
                :checked="player.settings.enableTrackDurationRefresh"
                @change="player.setEnableTrackDurationRefresh(($event.target as HTMLInputElement).checked)"
              />
              重新读取歌曲时长
            </label>
          </div>
        </div>

        <label class="field-row">
          <span>{{ t(locale, 'language') }}</span>
          <select :value="player.settings.locale" @change="setLocale">
            <option value="system">{{ t(locale, 'autoLanguage') }}</option>
            <option value="zh-CN">zh-CN</option>
            <option value="en-US">en-US</option>
          </select>
        </label>

        <label class="field-row wide-field">
          <span>下载位置</span>
          <span class="path-field">
            <input
              type="text"
              :value="player.settings.downloadDir"
              placeholder="请选择音乐下载目录"
              @change="player.setDownloadDir(($event.target as HTMLInputElement).value)"
            />
            <button class="secondary-button compact" type="button" @click="chooseDownloadDir">
              选择
            </button>
          </span>
        </label>
      </section>

      <section v-else-if="activeTab === 'playback'" class="settings-section">
        <h2>{{ t(locale, 'playback') }}</h2>

        <div class="setting-group">
          <p>{{ locale === 'en-US' ? 'Transitions' : '播放过渡' }}</p>
          <div class="option-list">
            <label class="option-row">
              <input
                type="checkbox"
                :checked="player.settings.seamlessPlayback"
                @change="player.setSeamlessPlayback(($event.target as HTMLInputElement).checked)"
              />
              {{ locale === 'en-US' ? 'Seamless playback' : '无缝播放' }}
            </label>
            <label class="option-row">
              <input
                type="checkbox"
                :checked="player.settings.fadePlayback"
                @change="player.setFadePlayback(($event.target as HTMLInputElement).checked)"
              />
              {{ locale === 'en-US' ? 'Fade in/out' : '淡入淡出' }}
            </label>
            <label class="option-row">
              <input
                type="checkbox"
                :checked="player.settings.crossfadePlayback"
                @change="player.setCrossfadePlayback(($event.target as HTMLInputElement).checked)"
              />
              {{ locale === 'en-US' ? 'Crossfade between tracks' : '交叉淡化' }}
            </label>
          </div>
        </div>

        <label class="field-row wide-field">
          <span>{{ locale === 'en-US' ? 'Temp cache' : '临时缓存目录' }}</span>
          <span class="path-field">
            <input
              type="text"
              :value="player.settings.audioCacheDir"
              :placeholder="locale === 'en-US' ? 'App cache directory' : '应用缓存目录'"
              @change="player.setAudioCacheDir(($event.target as HTMLInputElement).value)"
            />
            <button class="secondary-button compact" type="button" @click="useSystemTempCacheDir">
              {{ locale === 'en-US' ? 'System temp' : '系统临时目录' }}
            </button>
            <button class="secondary-button compact" type="button" @click="useDefaultCacheDir">
              {{ locale === 'en-US' ? 'Default' : '默认目录' }}
            </button>
            <button class="secondary-button compact" type="button" @click="chooseAudioCacheDir">
              {{ locale === 'en-US' ? 'Choose' : '选择' }}
            </button>
          </span>
        </label>

        <div class="setting-group">
          <p>{{ locale === 'en-US' ? 'Cache management' : '缓存管理' }}</p>
          <div class="cache-management-row">
            <label class="cache-size-field">
              <span>{{ locale === 'en-US' ? 'Max MB' : '最大 MB' }}</span>
              <input
                type="number"
                min="64"
                max="51200"
                step="64"
                :value="player.settings.audioCacheMaxMb"
                @change="setAudioCacheMaxMb"
              />
            </label>
            <span class="cache-actions">
            <button v-if="false" class="secondary-button compact" type="button" @click="pruneAudioCache">
              {{ locale === 'en-US' ? 'Apply limit' : '应用上限' }}
            </button>
            <button class="secondary-button compact" type="button" @click="clearAudioCache">
              {{ locale === 'en-US' ? 'Clear cache' : '清理缓存' }}
            </button>
            </span>
          </div>
          <small class="cache-cleanup-message">
            {{ locale === 'en-US' ? 'Used' : '已用' }} {{ cacheUsedLabel }} / {{ player.settings.audioCacheMaxMb }} MB
            <template v-if="cacheCleanupMessage"> 路 {{ cacheCleanupMessage }}</template>
          </small>
        </div>

        <label class="field-row wide-field">
          <span>{{ locale === 'en-US' ? 'Output device' : '输出设备' }}</span>
          <span class="path-field">
            <select :value="player.settings.audioOutputDeviceId" @change="setAudioOutputDevice">
              <option value="">{{ locale === 'en-US' ? 'System default' : '系统默认' }}</option>
              <option v-for="device in outputDevices" :key="device.id" :value="device.id">
                {{ device.name }}{{ device.isDefault ? (locale === 'en-US' ? ' (default)' : '（默认）') : '' }}
              </option>
            </select>
            <button class="secondary-button compact" type="button" @click="refreshOutputDevices">
              {{ locale === 'en-US' ? 'Refresh' : '刷新' }}
            </button>
          </span>
        </label>

        <label class="field-row">
          <span>定时关闭默认时间</span>
          <span class="number-field">
            <input
              type="number"
              min="1"
              max="999"
              step="1"
              :value="player.settings.sleepTimerMinutes"
              aria-label="定时关闭默认分钟数"
              @change="setSleepTimerMinutes"
            />
            <small>分钟</small>
          </span>
        </label>

        <div class="setting-group">
          <p>定时关闭后</p>
          <div class="inline-options">
            <label class="option-row">
              <input
                type="radio"
                name="sleep-timer-action"
                :checked="player.settings.sleepTimerAction === 'stop'"
                @change="player.setSleepTimerAction('stop')"
              />
              停止播放
            </label>
            <label class="option-row">
              <input
                type="radio"
                name="sleep-timer-action"
                :checked="player.settings.sleepTimerAction === 'exit'"
                @change="player.setSleepTimerAction('exit')"
              />
              退出程序
            </label>
          </div>
        </div>

        <div class="setting-group">
          <p>{{ t(locale, 'qualityFallback') }}</p>
          <div class="inline-options">
            <label v-for="option in qualityFallbackOptions" :key="option.value" class="option-row">
              <input
                type="radio"
                name="quality-fallback"
                :checked="player.settings.qualityFallback === option.value"
                @change="player.setQualityFallback(option.value)"
              />
              {{ option.label }}
            </label>
          </div>
        </div>

        <div class="setting-group">
          <p>播放失败后</p>
          <div class="inline-options">
            <label v-for="option in playbackFailureOptions" :key="option.value" class="option-row">
              <input
                type="radio"
                name="playback-failure-action"
                :checked="player.settings.onlinePlaybackFailureAction === option.value"
                @change="player.setOnlinePlaybackFailureAction(option.value)"
              />
              {{ option.label }}
            </label>
          </div>
        </div>
      </section>

      <section v-else-if="activeTab === 'lyrics'" class="settings-section">
        <h2>{{ t(locale, 'lyrics') }}</h2>
        <label class="option-row">
          <input
            type="checkbox"
            :checked="player.settings.autoHideLyricsDock"
            @change="player.setAutoHideLyricsDock(($event.target as HTMLInputElement).checked)"
          />
          {{ t(locale, 'autoHideLyricsDock') }}
        </label>
        <label class="field-row">
          <span>{{ t(locale, 'fontSize') }}</span>
          <select :value="player.settings.lyricFontSize" @change="setLyricFontSize">
            <option v-for="option in lyricFontSizeOptions" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </label>
        <label class="field-row">
          <span>{{ t(locale, 'fontColor') }}</span>
          <label class="option-row">
            <input
              type="checkbox"
              :checked="player.settings.useThemeLyricColor"
              @change="player.setUseThemeLyricColor(($event.target as HTMLInputElement).checked)"
            />
            {{ t(locale, 'useThemeColor') }}
          </label>
          <span class="color-field">
            <input
              v-if="!player.settings.useThemeLyricColor"
              type="color"
              :value="player.settings.lyricFontColor"
              :aria-label="t(locale, 'fontColor')"
              @input="setLyricFontColor"
            />
            <small v-if="!player.settings.useThemeLyricColor">{{ player.settings.lyricFontColor }}</small>
          </span>
        </label>
      </section>

      <section v-else-if="activeTab === 'mcp'" class="settings-section mcp-settings-section">
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

      <section v-else-if="activeTab === 'plugins'" class="settings-section">
        <h2>{{ t(locale, 'plugins') }}</h2>

        <div class="setting-group">
          <p>插件</p>
          <label class="option-row">
            <input
              type="checkbox"
              :checked="player.settings.enablePlugins"
              @change="setEnablePlugins"
            />
            启用插件
          </label>
          <small>启用后才显示发现音乐、下载管理和插件管理菜单。</small>
        </div>
      </section>

      <section v-else class="settings-section">
        <h2>{{ t(locale, activeTab) }}</h2>
      </section>
    </div>
  </section>
</template>

<style scoped>
.settings-view {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px 34px 40px;
  background: var(--smw-bg-workspace);
  scrollbar-width: none;
}

.settings-view::-webkit-scrollbar {
  display: none;
}


.settings-header {
  border-bottom: 1px solid var(--smw-border);
}

.settings-header h1 {
  margin: 0 0 18px;
  font-size: 30px;
  font-weight: 760;
  line-height: 1.1;
}

.settings-tabs {
  display: flex;
  gap: 30px;
  overflow-x: auto;
}

.settings-tabs button {
  position: relative;
  height: 34px;
  padding: 0;
  border: 0;
  color: var(--smw-text-body);
  background: transparent;
  font-size: 15px;
  white-space: nowrap;
  cursor: pointer;
}

.settings-tabs button.active {
  color: var(--smw-button-primary);
  font-weight: 680;
}

.settings-tabs button.active::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  border-radius: 999px;
  background: var(--smw-button-primary);
  content: "";
}

.settings-content {
  display: grid;
  max-width: 980px;
  padding-top: 18px;
}

.settings-section {
  display: grid;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--smw-border);
}

.settings-section + .settings-section {
  padding-top: 16px;
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

.setting-group p,
.field-row span {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
}

.inline-options,
.option-list {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 44px;
}

.history-options {
  gap: 14px 52px;
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

.option-row input[type="checkbox"],
.option-row input[type="radio"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--smw-button-primary);
}

.field-row {
  display: grid;
  gap: 8px;
  max-width: 280px;
}

.wide-field {
  max-width: 560px;
}

.field-row select,
.path-field select {
  height: 36px;
  min-width: 0;
  padding: 0 38px 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background:
    linear-gradient(45deg, transparent 50%, var(--smw-text-secondary) 50%) calc(100% - 17px) 15px / 6px 6px no-repeat,
    linear-gradient(135deg, var(--smw-text-secondary) 50%, transparent 50%) calc(100% - 12px) 15px / 6px 6px no-repeat,
    var(--smw-bg-input);
  cursor: pointer;
  outline: none;
  appearance: none;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease,
    background-color 150ms ease;
}

.field-row select:hover,
.path-field select:hover {
  border-color: var(--smw-text-muted);
}

.field-row select:focus,
.path-field select:focus {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.number-field {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}

.number-field input,
.path-field input,
.cache-size-field input {
  height: 36px;
  min-width: 0;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font: inherit;
  outline: none;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
}

.number-field input:hover,
.path-field input:hover,
.cache-size-field input:hover {
  border-color: var(--smw-text-muted);
}

.number-field input:focus,
.path-field input:focus,
.cache-size-field input:focus {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.path-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  gap: 8px;
  align-items: center;
}

.cache-management-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  align-items: end;
}

.cache-size-field {
  display: grid;
  grid-template-columns: auto 132px;
  gap: 8px;
  align-items: center;
  color: var(--smw-text-body);
  font-size: 13px;
}

.cache-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.cache-cleanup-message {
  color: var(--smw-text-secondary);
  font-size: 12px;
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

.secondary-button.compact {
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font: inherit;
  cursor: pointer;
  transition:
    border-color 150ms ease,
    background-color 150ms ease,
    box-shadow 150ms ease;
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

.number-field small {
  color: var(--smw-text-secondary);
  font-size: 13px;
}

.color-field {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 28px;
}

.color-field input {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid var(--smw-border);
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
}

.color-field input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-field input::-webkit-color-swatch {
  border: 0;
  border-radius: 2px;
}

.color-field small {
  color: var(--smw-text-body);
  font-size: 13px;
}
</style>
