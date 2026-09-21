import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { listInstalledPlugins } from '../services/plugins';
import { listenRustBackendState } from '../services/playerBackend';
import { prepareKaraoke, resolveKaraokePlaybackSource, switchKaraoke } from '../services/karaoke';
import type { Track } from '../types/music';
import { cancelStemSeparation, checkStemEnvironment, prepareStemEnvironment, readStemEnvironment, readStemSeparationStatus } from '../services/stemSeparation';
import { PLUGINS_CHANGED_EVENT } from './useMusicSourcePluginAvailability';
import { getErrorMessage } from '../utils/error';

export function useKaraokePlayback(source: Ref<string | undefined>, track?: Ref<Track | null>) {
  const identity = computed(() => track?.value?.sourceProviderId && track.value.sourceId
    ? JSON.stringify([track.value.sourceProviderId, track.value.sourceId]) : source.value);
  const pluginId = ref('');
  const mode = ref('original');
  const preparing = ref(false);
  const switching = ref(false);
  const waitingForPlayback = ref(false);
  let playbackSource: string | null = null;
  const message = ref('');
  let epoch = 0;
  let jobId: string | null = null;
  let disposed = false;
  let unlisten: (() => void) | undefined;
  const label = computed(() => waitingForPlayback.value ? 'K歌已选' : preparing.value ? '准备伴奏…' : mode.value === 'karaoke' ? 'K歌' : '原声');
  const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 1000));

  async function loadPlugin() {
    try { pluginId.value = (await listInstalledPlugins()).find((p) => p.enabled && p.kind === 'tool' && p.capabilities.includes('stem-separation'))?.id ?? ''; }
    catch { pluginId.value = ''; }
  }

  function cancelPending() {
    epoch++;
    preparing.value = false;
    waitingForPlayback.value = false;
    if (jobId) void cancelStemSeparation(jobId).catch(() => {});
    jobId = null;
  }

  async function select(value: string) {
    if (switching.value || !source.value) return;
    let current = playbackSource ?? source.value;
    if (value === 'original') {
      cancelPending();
      message.value = '';
      if (mode.value !== 'karaoke') return;
      switching.value = true;
      try {
        const resolved = await resolveKaraokePlaybackSource(source.value, track?.value?.sourceProviderId, track?.value?.sourceId);
        if (!resolved) { mode.value = 'original'; return; }
        await switchKaraoke(pluginId.value, resolved, null); mode.value = 'original';
      }
      catch (error) { message.value = getErrorMessage(error); }
      finally { switching.value = false; }
      return;
    }
    if (preparing.value || mode.value === 'karaoke' || !pluginId.value) return;
    const token = ++epoch;
    const selectedIdentity = identity.value;
    let ownsSwitch = false;
    const active = () => !disposed && token === epoch && identity.value === selectedIdentity;
    preparing.value = true;
    message.value = '正在检查分离环境…';
    try {
      let resolved = await resolveKaraokePlaybackSource(source.value, track?.value?.sourceProviderId, track?.value?.sourceId);
      if (!active()) return;
      while (active() && !resolved) {
        waitingForPlayback.value = true;
        message.value = '已选择 K歌，歌曲加载后自动准备伴奏，不会主动开始播放。';
        await delay();
        if (!active()) return;
        resolved = await resolveKaraokePlaybackSource(source.value!, track?.value?.sourceProviderId, track?.value?.sourceId);
      }
      if (!active() || !resolved) return;
      waitingForPlayback.value = false;
      current = resolved;
      playbackSource = resolved;
      message.value = '正在查找已有伴奏…';
      let result = await prepareKaraoke(pluginId.value, current, true);
      if (!active()) return;
      if (!result.accompaniment) {
        message.value = '正在检查分离环境…';
        let environment = await checkStemEnvironment(pluginId.value);
        while (active() && ['checking', 'installing', 'cancelling'].includes(environment.stage)) {
          message.value = environment.message;
          await delay();
          environment = await readStemEnvironment();
        }
        if (!active()) return;
        if (environment.stage !== 'ready') {
          environment = await prepareStemEnvironment(pluginId.value);
          while (active() && ['checking', 'installing', 'cancelling'].includes(environment.stage)) {
            message.value = environment.message;
            await delay();
            environment = await readStemEnvironment();
          }
        }
        if (!active()) return;
        if (environment.stage !== 'ready') throw new Error(environment.message);
        message.value = '正在生成伴奏，首次处理可能需要几分钟…';
        result = await prepareKaraoke(pluginId.value, current);
      }
      if (!active()) {
        if (result.job) void cancelStemSeparation(result.job.id).catch(() => {});
        return;
      }
      let accompaniment = result.accompaniment;
      jobId = result.job?.id ?? null;
      while (active() && !accompaniment && jobId) {
        await delay();
        if (!active()) return;
        const job = await readStemSeparationStatus();
        if (!active()) return;
        if (!job || job.id !== jobId) throw new Error('分离任务已改变，请重试。');
        if (job.stage === 'error' || job.stage === 'cancelled') throw new Error(job.message || '分离已取消');
        if (job.stage === 'done') { accompaniment = job.accompanimentPath; jobId = null; }
        else message.value = job.progress == null ? '正在生成伴奏…' : `正在生成伴奏… ${job.progress}%`;
      }
      if (!active() || !accompaniment) return;
      switching.value = true;
      ownsSwitch = true;
      await switchKaraoke(pluginId.value, current, accompaniment);
      if (active()) { mode.value = 'karaoke'; message.value = ''; }
    } catch (error) {
      if (active()) message.value = getErrorMessage(error);
    } finally {
      if (active()) { preparing.value = false; waitingForPlayback.value = false; jobId = null; }
      if (ownsSwitch) switching.value = false;
    }
  }

  watch(identity, () => { cancelPending(); playbackSource = null; mode.value = 'original'; message.value = ''; });
  onMounted(async () => {
    void loadPlugin();
    window.addEventListener(PLUGINS_CHANGED_EVENT, loadPlugin);
    try {
      const stop = await listenRustBackendState((state) => {
        if (state.currentPath === (playbackSource ?? source.value)) mode.value = state.isKaraoke ? 'karaoke' : 'original';
      });
      if (disposed) stop(); else unlisten = stop;
    } catch { /* A browser preview has no audio worker. */ }
  });
  onBeforeUnmount(() => { disposed = true; cancelPending(); unlisten?.(); window.removeEventListener(PLUGINS_CHANGED_EVENT, loadPlugin); });
  return { label, message, mode, pluginId, preparing, switching, select };
}
