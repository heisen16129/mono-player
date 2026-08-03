<script setup lang="ts">
defineProps<{
  endpoint: string;
  healthEndpoint: string;
}>();
</script>

<template>
  <div class="mcp-endpoint-list">
    <span>连接地址：<code>{{ endpoint }}</code></span>
    <span>健康检查：<code>{{ healthEndpoint }}</code></span>
  </div>
</template>

<style scoped>
.mcp-endpoint-list {
  display: grid;
  gap: 6px;
  color: var(--smw-text-body);
  font-size: 13px;
}

.mcp-endpoint-list code {
  padding: 2px 6px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-input);
  font-size: 12px;
}
</style>
