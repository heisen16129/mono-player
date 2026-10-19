<script setup lang="ts">
import { useStemSeparation } from '../../composables/useStemSeparation';
import { useStemEnvironment } from '../../composables/useStemEnvironment';
import StemEnvironmentCard from './StemEnvironmentCard.vue';
import StemBatchProgress from './StemBatchProgress.vue';
const props = defineProps<{ pluginId: string }>();
const { source, folderSelected, batch, outputDir, status, error, loading, running, starting, canStart, stageLabel, chooseSource, chooseFolder, start, cancel, reveal } = useStemSeparation(props.pluginId);
const { environment, busy: preparing, ready, prepare, cancel: cancelPrepare } = useStemEnvironment(props.pluginId);
</script>
<template>
    <div class="separation-content">
      <p class="hint">选择音乐或文件夹，导出人声与伴奏两份 WAV。文件夹包含子目录，按顺序处理。</p>
      <StemEnvironmentCard :environment="environment" :busy="preparing" :ready="ready" :disabled="running" :repair="status?.stage === 'error'" @prepare="prepare" @cancel="cancelPrepare" />
      <div class="path-field">
        <span>{{ folderSelected ? '音乐文件夹' : '音乐文件' }}</span>
        <div class="result-actions"><button type="button" :disabled="running" @click="chooseSource">选择音乐</button><button type="button" :disabled="running" @click="chooseFolder">选择文件夹</button></div>
        <small :title="source">{{ source || '尚未选择' }}</small>
      </div>
      <div class="path-field"><span>输出位置</span><span class="hint">使用设置中的缓存目录</span><small :title="outputDir">{{ outputDir || '正在读取缓存位置…' }}</small></div>
      <p v-if="loading" class="hint">正在读取任务状态…</p>
      <StemBatchProgress v-if="batch" :batch="batch" @reveal="reveal" />
      <div v-else-if="status" class="task-status" aria-live="polite">
        <strong>{{ stageLabel }}</strong>
        <span v-if="status.device" class="hint">计算设备：{{ status.device.toUpperCase() }}</span>
        <progress v-if="running" max="100" :value="status.progress ?? undefined" aria-label="分离进度" />
        <p v-if="status.message" class="error">{{ status.message }}</p>
        <template v-if="status.stage === 'done'"><p class="output-path">{{ status.outputDir }}</p><div class="result-actions">
          <button v-if="status.vocalsPath" @click="reveal(status.vocalsPath)">查看人声文件</button>
          <button v-if="status.accompanimentPath" @click="reveal(status.accompanimentPath)">查看伴奏文件</button>
        </div></template>
      </div>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <p class="hint">离开此页面不影响正在运行的任务，重新打开可查看进度。</p>
      <div class="footer-actions"><button v-if="running" :disabled="batch?.stage === 'cancelling' || status?.stage === 'cancelling'" @click="cancel">取消任务</button><button class="primary" :disabled="!canStart || !ready" @click="start">{{ starting ? '正在启动…' : folderSelected ? '分离整个文件夹' : '开始分离' }}</button></div>
    </div>
</template>
<style scoped>
.separation-content { display: grid; gap: 18px; padding: 0 20px 20px; color: var(--smw-text-body); font-size: 13px; }
p { margin: 0; }
.hint { color: var(--smw-text-secondary); line-height: 1.6; }
.path-field { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; }
.path-field small { grid-column: 1 / -1; overflow-wrap: anywhere; color: var(--smw-text-secondary); }
.result-actions, .footer-actions { display: flex; gap: 8px; }
.footer-actions { justify-content: flex-end; }
button { padding: 8px 12px; border: 1px solid var(--smw-border); border-radius: 6px; background: var(--smw-bg-panel); color: inherit; font: inherit; cursor: pointer; }
button:disabled { opacity: .45; cursor: default; }
.primary { background: var(--smw-button-primary); color: white; }
.task-status { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--smw-border-soft); border-radius: 8px; }
.output-path, .error { overflow-wrap: anywhere; }
.error { color: var(--smw-error-text); white-space: pre-wrap; }
</style>
