<script setup lang="ts">
defineProps<{
  configJson: string;
  copyMessage: string;
}>();

const emit = defineEmits<{
  copy: [];
}>();
</script>

<template>
  <div class="mcp-code-group">
    <div class="mcp-code-heading">
      <p>MCP 配置 JSON</p>
      <span>
        <button class="secondary-button compact" type="button" @click="emit('copy')">复制</button>
        <small v-if="copyMessage">{{ copyMessage }}</small>
      </span>
    </div>
    <pre class="mcp-config-code"><code>{{ configJson }}</code></pre>
  </div>
</template>

<style scoped>
.mcp-code-group {
  display: grid;
  gap: 8px;
}

.mcp-code-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.mcp-code-heading p {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
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
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font-size: 12px;
  line-height: 1.55;
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
