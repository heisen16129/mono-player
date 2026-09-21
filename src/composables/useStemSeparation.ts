import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { cancelStemBatch, cancelStemSeparation, readStemBatchStatus, readStemOutputDirectory, readStemSeparationStatus, revealSeparatedTrack, startStemBatch } from '../services/stemSeparation';
import type { StemBatchStatus, StemSeparationStatus } from '../types/stemSeparation';
import { getErrorMessage } from '../utils/error';

export function useStemSeparation(pluginId: string) {
  const source = ref('');
  const folderSelected = ref(false);
  const batch = ref<StemBatchStatus | null>(null);
  const outputDir = ref('');
  const status = ref<StemSeparationStatus | null>(null);
  const error = ref('');
  const starting = ref(false);
  const loading = ref(true);
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const batchRunning = computed(() => Boolean(batch.value && ['scanning', 'running', 'cancelling'].includes(batch.value.stage)));
  const running = computed(() => starting.value || batchRunning.value || Boolean(status.value && !['done', 'error', 'cancelled'].includes(status.value.stage)));
  const canStart = computed(() => !loading.value && !running.value && Boolean(source.value && outputDir.value));
  const stageLabel = computed(() => ({ loading: '正在加载模型（首次使用需要下载）…', separating: '正在分离人声与伴奏…', exporting: '正在导出音频…', cancelling: '正在取消…', cancelled: '已取消，未完成的导出已清理', done: '分离完成', error: '分离失败' }[status.value?.stage ?? 'loading']));
  async function refresh() {
    try {
      const [nextStatus, nextBatch, directory] = await Promise.all([readStemSeparationStatus(), readStemBatchStatus(), readStemOutputDirectory()]);
      if (!disposed) { status.value = nextStatus; batch.value = nextBatch; outputDir.value = directory; }
    } catch (cause) { error.value = getErrorMessage(cause); }
    finally { loading.value = false; if (!disposed) timer = setTimeout(refresh, 1000); }
  }
  async function chooseSource() {
    try {
      const selected = await open({ multiple: false, filters: [{ name: '音乐文件', extensions: ['mp3', 'wav', 'flac', 'ogg', 'opus', 'm4a', 'mp4', 'aac', 'aiff'] }] });
      if (typeof selected === 'string') { source.value = selected; folderSelected.value = false; }
    } catch (cause) { error.value = getErrorMessage(cause); }
  }
  async function chooseFolder() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === 'string') { source.value = selected; folderSelected.value = true; }
    } catch (cause) { error.value = getErrorMessage(cause); }
  }
  async function start() {
    if (!canStart.value) return;
    starting.value = true; error.value = '';
    try { batch.value = await startStemBatch(pluginId, source.value); outputDir.value = batch.value.outputDir; }
    catch (cause) { error.value = getErrorMessage(cause); }
    finally { starting.value = false; }
  }
  async function cancel() {
    try { if (batchRunning.value) await cancelStemBatch(); else if (status.value) await cancelStemSeparation(status.value.id); }
    catch (cause) { error.value = getErrorMessage(cause); }
  }
  async function reveal(path: string) {
    try { await revealSeparatedTrack(path); }
    catch (cause) { error.value = getErrorMessage(cause); }
  }
  onMounted(refresh);
  onBeforeUnmount(() => { disposed = true; clearTimeout(timer); });
  return { source, folderSelected, batch, outputDir, status, error, loading, running, starting, canStart, stageLabel, chooseSource, chooseFolder, start, cancel, reveal };
}
