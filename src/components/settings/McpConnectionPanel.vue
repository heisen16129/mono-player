<script setup lang="ts">
import { ref } from 'vue';
import McpConfigCodeBlock from './McpConfigCodeBlock.vue';
import McpEndpointList from './McpEndpointList.vue';

const mcpEndpoint = 'http://127.0.0.1:17331/mcp';
const mcpHealthEndpoint = 'http://127.0.0.1:17331/health';
const mcpConfigJson = JSON.stringify(
  {
    mcpServers: {
      'mono-player-http': {
        type: 'http',
        url: mcpEndpoint,
      },
    },
  },
  null,
  2,
);
const mcpCopyMessage = ref('');

async function copyMcpConfig() {
  await navigator.clipboard.writeText(mcpConfigJson);
  mcpCopyMessage.value = '已复制 MCP JSON';
  window.setTimeout(() => {
    mcpCopyMessage.value = '';
  }, 1800);
}
</script>

<template>
  <div class="mcp-connection-panel">
    <McpEndpointList :endpoint="mcpEndpoint" :health-endpoint="mcpHealthEndpoint" />
    <small class="mcp-note">
      启动 Mono Player 后，HTTP MCP 服务会自动在本机启动。外部 MCP 客户端使用下面的 JSON 连接即可。
    </small>

    <McpConfigCodeBlock
      :config-json="mcpConfigJson"
      :copy-message="mcpCopyMessage"
      @copy="copyMcpConfig"
    />
  </div>
</template>

<style scoped>
.mcp-connection-panel {
  display: grid;
  gap: 8px;
}

.mcp-note {
  color: var(--smw-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

</style>
