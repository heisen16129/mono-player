<script setup lang="ts">
import type { StemEnvironmentStatus } from '../../types/stemSeparation';
defineProps<{ environment: StemEnvironmentStatus; busy: boolean; ready: boolean; disabled?: boolean; repair?: boolean }>();
defineEmits<{ prepare: []; cancel: [] }>();
</script>
<template>
  <section class="environment-card">
    <strong>{{ ready ? '已准备好，可以开始分离' : environment.message }}</strong>
    <small>在本机处理，不上传音乐。模型尚未缓存时会在首次分离时自动下载。</small>
    <div v-if="!ready || repair" class="actions">
      <button v-if="!busy" type="button" :disabled="disabled" @click="$emit('prepare')">{{ repair ? '修复分离环境' : '一键准备' }}</button>
      <button v-else type="button" :disabled="environment.stage === 'cancelling'" @click="$emit('cancel')">取消准备</button>
    </div>
  </section>
</template>
<style scoped>
.environment-card { display: grid; gap: 10px; border: 1px solid var(--smw-border-soft); border-radius: 8px; padding: 14px; }
small { color: var(--smw-text-secondary); line-height: 1.6; }
button { padding: 8px 12px; border: 1px solid var(--smw-border); border-radius: 6px; background: var(--smw-bg-panel); color: inherit; cursor: pointer; }
</style>
