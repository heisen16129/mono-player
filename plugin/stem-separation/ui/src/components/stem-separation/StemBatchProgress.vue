<script setup lang="ts">
import { computed } from 'vue';
import type { StemBatchStatus } from '../../types/stemSeparation';
const props = defineProps<{ batch: StemBatchStatus }>();
defineEmits<{ reveal: [path: string] }>();
const elapsed = computed(() => {
  const seconds = Math.floor((props.batch.elapsedMs ?? 0) / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
});
const completed = computed(() => props.batch.items.filter(i => ['done', 'reused', 'error', 'cancelled'].includes(i.stage)).length);
const failed = computed(() => props.batch.items.filter(i => i.stage === 'error').length);
const label = computed(() => ({ scanning: '正在扫描音乐文件…', running: '正在批量分离…', cancelling: '正在取消…', cancelled: '已取消，已完成的结果保留', done: '处理结束', error: '任务未完成' }[props.batch.stage]));
const itemLabels: Record<string, string> = { pending: '等待', running: '处理中', done: '完成', reused: '已复用', error: '失败', cancelled: '已取消' };
</script>
<template>
  <section class="batch-progress" aria-live="polite">
    <strong>{{ label }}</strong>
    <span>总执行时间：{{ elapsed }}</span>
    <span>已处理 {{ completed }} / {{ batch.items.length }} 首<span v-if="failed">，失败 {{ failed }} 首</span></span>
    <progress v-if="batch.stage === 'scanning'" aria-label="扫描音乐" />
    <progress v-else :max="batch.items.length || 1" :value="completed" aria-label="批量分离进度" />
    <span v-if="batch.current">当前歌曲：{{ batch.current.stage === 'loading' ? '正在加载模型' : batch.current.stage === 'exporting' ? '正在导出' : '正在分离' }}<template v-if="batch.current.progress !== null"> {{ batch.current.progress }}%</template></span>
    <p v-if="batch.message" class="error">{{ batch.message }}</p>
    <ul><li v-for="item in batch.items" :key="item.id">
      <div class="item-heading"><span :title="item.source">{{ item.source.split(/[\\/]/).pop() }}</span><small>{{ itemLabels[item.stage] }}</small></div>
      <p v-if="item.message" class="error">{{ item.message }}</p>
      <div v-if="item.vocalsPath || item.accompanimentPath" class="result-actions">
        <button v-if="item.vocalsPath" @click="$emit('reveal', item.vocalsPath)">查看人声</button>
        <button v-if="item.accompanimentPath" @click="$emit('reveal', item.accompanimentPath)">查看伴奏</button>
      </div>
    </li></ul>
    <small class="output-path">{{ batch.outputDir }}</small>
  </section>
</template>
<style scoped>
.batch-progress { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--smw-border-soft); border-radius: 8px; }
progress { width: 100%; height: 8px; accent-color: var(--smw-button-primary); }
ul { list-style: none; margin: 0; padding: 0; max-height: 220px; overflow: auto; }
li { padding: 9px 0; border-bottom: 1px solid var(--smw-border-soft); }
.item-heading, .result-actions { display: flex; justify-content: space-between; gap: 10px; }
.item-heading span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
small { color: var(--smw-text-secondary); flex-shrink: 0; }
.result-actions { justify-content: flex-start; margin-top: 6px; }
button { border: 0; background: none; color: var(--smw-text-body); font: inherit; cursor: pointer; padding: 3px 0; text-decoration: underline; text-underline-offset: 3px; }
.output-path, p { overflow-wrap: anywhere; }
.error { color: var(--smw-error-text); white-space: pre-wrap; margin: 6px 0; }
</style>
