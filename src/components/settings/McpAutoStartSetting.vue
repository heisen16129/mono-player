<script setup lang="ts">
defineProps<{
  enabled: boolean;
}>();

const emit = defineEmits<{
  setEnabled: [value: boolean];
}>();

function setEnabled(event: Event) {
  emit('setEnabled', (event.target as HTMLInputElement).checked);
}
</script>

<template>
  <div class="setting-group">
    <p>MCP 启动</p>
    <label class="option-row">
      <input
        type="checkbox"
        :checked="enabled"
        @change="setEnabled"
      />
      启动应用时自动启动 HTTP MCP 服务
    </label>
    <small class="mcp-note">修改后需要重启 Mono Player 才会生效。</small>
  </div>
</template>

<style scoped>
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

.mcp-note {
  color: var(--smw-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}
</style>
