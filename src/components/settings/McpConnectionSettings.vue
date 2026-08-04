<script setup lang="ts">
import { computed, ref } from 'vue';
import type { McpServiceSnapshot } from '../../services/mcp';

const props = defineProps<{
  locale: string;
  service: McpServiceSnapshot | null;
}>();

const copyMessage = ref('');

const text = computed(() => {
  const en = props.locale === 'en-US';
  return {
    title: en ? 'Connection' : '\u8fde\u63a5',
    endpoint: en ? 'MCP endpoint' : 'MCP \u5730\u5740',
    health: en ? 'Health check' : '\u5065\u5eb7\u68c0\u67e5',
    config: en ? 'Client config JSON' : '\u5ba2\u6237\u7aef\u914d\u7f6e JSON',
    copy: en ? 'Copy' : '\u590d\u5236',
    copied: en ? 'Copied' : '\u5df2\u590d\u5236',
    note: en
      ? 'Use this from MCP clients that support streamable HTTP.'
      : '\u652f\u6301 streamable HTTP \u7684 MCP \u5ba2\u6237\u7aef\u53ef\u4ee5\u76f4\u63a5\u4f7f\u7528\u8fd9\u4e2a\u5730\u5740\u3002',
  };
});
const endpoint = computed(() => props.service?.endpoint ?? 'http://127.0.0.1:17331/mcp');
const healthEndpoint = computed(() => props.service?.healthEndpoint ?? 'http://127.0.0.1:17331/health');
const configJson = computed(() => JSON.stringify(
  {
    mcpServers: {
      'mono-player-http': {
        type: 'http',
        url: endpoint.value,
      },
    },
  },
  null,
  2,
));

async function copyConfig() {
  await navigator.clipboard.writeText(configJson.value);
  copyMessage.value = text.value.copied;
  window.setTimeout(() => {
    copyMessage.value = '';
  }, 1600);
}
</script>

<template>
  <div class="setting-group">
    <p>{{ text.title }}</p>

    <div class="mcp-endpoints">
      <span>{{ text.endpoint }}<code>{{ endpoint }}</code></span>
      <span>{{ text.health }}<code>{{ healthEndpoint }}</code></span>
    </div>

    <small class="mcp-note">{{ text.note }}</small>

    <div class="mcp-config-heading">
      <span>{{ text.config }}</span>
      <span class="mcp-config-actions">
        <button class="secondary-button compact" type="button" @click="copyConfig">{{ text.copy }}</button>
        <small v-if="copyMessage">{{ copyMessage }}</small>
      </span>
    </div>
    <pre class="mcp-config-code"><code>{{ configJson }}</code></pre>
  </div>
</template>

<style scoped>
.setting-group {
  display: grid;
  gap: 8px;
}

.setting-group p,
.mcp-config-heading > span:first-child {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
}

.mcp-endpoints {
  display: grid;
  gap: 6px;
  color: var(--smw-text-body);
  font-size: 13px;
}

.mcp-endpoints span {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.mcp-endpoints code {
  padding: 2px 6px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-input);
  font-size: 12px;
}

.mcp-note,
.mcp-config-actions small {
  color: var(--smw-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.mcp-config-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  max-width: 860px;
  padding-top: 4px;
}

.mcp-config-actions {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.mcp-config-code {
  max-width: 860px;
  max-height: 230px;
  overflow: auto;
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
