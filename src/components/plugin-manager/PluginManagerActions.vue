<script setup lang="ts">
import { FolderInput } from '@lucide/vue';

const emit = defineEmits<{
  importLocal: [];
}>();
</script>

<template>
  <div class="plugin-actions">
    <button class="secondary-button" type="button" @click="emit('importLocal')">
      <FolderInput :size="16" />
      从本地文件安装
      更新订阅
    </button>
  </div>
</template>

<style scoped>
.plugin-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.spinning {
  animation: spin 760ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 860px) {
  .plugin-actions {
    justify-content: flex-start;
  }
}
</style>
