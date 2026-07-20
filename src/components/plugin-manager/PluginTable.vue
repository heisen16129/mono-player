<script setup lang="ts">
import { Download, RefreshCw, Trash2 } from '@lucide/vue';
import EmptyState from '../EmptyState.vue';
import type { PluginCapability, PluginCatalogItem, PluginManifest } from '../../types/plugin';
import type { PluginRow } from './types';

defineProps<{
  allVisibleSelected: boolean;
  dragOverPluginId: string | null;
  draggingPluginId: string | null;
  formatCapabilities: (capabilities: PluginCapability[], installed?: boolean) => string;
  loading: boolean;
  plugins: PluginRow[];
  selectedPluginIds: Set<string>;
}>();

const emit = defineEmits<{
  install: [item: PluginCatalogItem];
  remove: [pluginId: string, pluginName: string];
  select: [pluginId: string, selected: boolean];
  startDrag: [event: PointerEvent, plugin: PluginRow];
  startRowDrag: [event: PointerEvent, plugin: PluginRow];
  toggle: [plugin: PluginManifest];
  toggleAll: [];
  update: [item: PluginCatalogItem];
}>();
</script>

<template>
  <div class="plugin-table-wrap">
    <table class="plugin-table">
      <thead>
        <tr>
          <th>
            <input type="checkbox" :checked="allVisibleSelected" :disabled="plugins.length === 0" aria-label="选择全部插件" @change="emit('toggleAll')" />
          </th>
          <th>#</th>
          <th>来源</th>
          <th>版本号</th>
          <th>类型</th>
          <th>作者</th>
          <th>能力</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="(plugin, index) in plugins" :key="plugin.id">
          <tr
            :data-plugin-id="plugin.id"
            :class="{
              'is-draggable': plugin.installed,
              'is-dragging': draggingPluginId === plugin.id,
              'is-drag-over': dragOverPluginId === plugin.id && draggingPluginId !== plugin.id,
            }"
            @pointerdown="emit('startRowDrag', $event, plugin)"
          >
            <td>
              <input type="checkbox" :checked="selectedPluginIds.has(plugin.id)" :aria-label="`选择 ${plugin.name}`" @change="emit('select', plugin.id, ($event.target as HTMLInputElement).checked)" />
            </td>
            <td>
              <button class="drag-handle" type="button" :class="{ active: draggingPluginId === plugin.id }" :title="plugin.installed ? '拖动排序' : ''" @pointerdown="emit('startDrag', $event, plugin)">
                {{ index + 1 }}
              </button>
            </td>
            <td><strong>{{ plugin.name }}</strong></td>
            <td>{{ plugin.version }}</td>
            <td><span class="runtime-badge">WASM</span></td>
            <td>{{ plugin.author || '未知作者' }}</td>
            <td>
              <span class="capabilities" :title="formatCapabilities(plugin.capabilities, plugin.installed)">
                {{ formatCapabilities(plugin.capabilities, plugin.installed) }}
              </span>
            </td>
            <td>
              <span :class="['state-badge', plugin.installed ? 'installed' : 'available']">
                {{ plugin.installed ? (plugin.enabled ? '已启用' : '已停用') : '可安装' }}
              </span>
            </td>
            <td>
              <div class="row-actions">
                <button v-if="plugin.catalogItem && !plugin.installed" class="link-action install" type="button" @click="emit('install', plugin.catalogItem)">
                  <Download :size="14" />
                  安装
                </button>
                <button v-if="plugin.catalogItem && plugin.installed && plugin.latestVersion !== plugin.version" class="link-action update" type="button" @click="emit('update', plugin.catalogItem)">
                  <RefreshCw :size="14" />
                  更新
                </button>
                <button v-if="plugin.manifest" :class="['plugin-toggle-action', plugin.enabled ? 'is-enabled' : 'is-disabled']" type="button" :title="plugin.enabled ? '点击停用插件' : '点击启用插件'" @click="emit('toggle', plugin.manifest)">
                  <span aria-hidden="true"></span>
                  {{ plugin.enabled ? '停用' : '启用' }}
                </button>
                <button v-if="plugin.installed" class="link-action danger" type="button" @click="emit('remove', plugin.id, plugin.name)">
                  <Trash2 :size="14" />
                  卸载
                </button>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>

    <EmptyState v-if="!loading && plugins.length === 0" class-name="empty-plugins" message="暂无插件，添加订阅或从本地文件安装。" />
  </div>
</template>

<style scoped>
.plugin-table-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  border: 1px solid var(--smw-border);
  border-radius: 10px;
  background: var(--smw-bg-input);
}

.plugin-table {
  width: 100%;
  min-width: 0;
  border-collapse: collapse;
  table-layout: fixed;
  color: var(--smw-text-body);
  font-size: 13px;
}

.plugin-table th,
.plugin-table td {
  height: 40px;
  padding: 0 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--smw-border) 70%, transparent);
  text-align: left;
  vertical-align: middle;
}

.plugin-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  color: var(--smw-text-primary);
  background: color-mix(in srgb, var(--smw-bg-input) 92%, var(--smw-bg-selected));
  font-weight: 680;
}

.plugin-table tr:nth-child(even) td {
  background: color-mix(in srgb, var(--smw-bg-selected) 34%, transparent);
}

.plugin-table tbody tr:hover td {
  background: color-mix(in srgb, var(--smw-bg-selected) 62%, transparent);
}

.plugin-table tbody tr.is-draggable {
  cursor: grab;
}

.plugin-table tbody tr.is-dragging {
  opacity: 0.42;
}

.plugin-table tbody tr.is-drag-over td {
  background: color-mix(in srgb, var(--smw-button-primary) 12%, var(--smw-bg-selected));
  box-shadow: inset 0 1px 0 var(--smw-button-primary);
}

.plugin-table tbody tr.is-draggable:active {
  cursor: grabbing;
}

.plugin-table td:first-child,
.plugin-table th:first-child {
  width: 34px;
  text-align: center;
}

.plugin-table td:nth-child(2),
.plugin-table th:nth-child(2) {
  width: 42px;
  text-align: center;
}

.plugin-table td:nth-child(3),
.plugin-table th:nth-child(3) {
  width: 18%;
}

.plugin-table td:nth-child(4),
.plugin-table th:nth-child(4) {
  width: 8%;
}

.plugin-table td:nth-child(5),
.plugin-table th:nth-child(5) {
  width: 8%;
}

.plugin-table td:nth-child(6),
.plugin-table th:nth-child(6) {
  width: 13%;
}

.plugin-table td:nth-child(7),
.plugin-table th:nth-child(7) {
  width: 28%;
}

.plugin-table td:nth-child(8),
.plugin-table th:nth-child(8) {
  width: 9%;
}

.plugin-table td:nth-child(9),
.plugin-table th:nth-child(9) {
  width: 14%;
}

.plugin-table td:nth-child(3),
.plugin-table td:nth-child(4),
.plugin-table td:nth-child(5),
.plugin-table td:nth-child(6),
.plugin-table td:nth-child(7),
.plugin-table td:nth-child(8),
.plugin-table td:nth-child(9) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-table input[type="checkbox"] {
  width: 15px;
  height: 15px;
  accent-color: var(--smw-button-primary);
}

.drag-handle {
  display: inline-grid;
  width: 28px;
  height: 26px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  color: var(--smw-text-secondary);
  background: transparent;
  font: inherit;
  user-select: none;
  touch-action: none;
}

.is-draggable .drag-handle {
  cursor: grab;
}

.is-draggable .drag-handle:hover,
.is-draggable .drag-handle.active {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
}

.is-draggable .drag-handle:active {
  cursor: grabbing;
}

.plugin-table strong {
  color: var(--smw-text-primary);
  font-weight: 560;
}

.runtime-badge,
.state-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 12px;
}

.runtime-badge {
  color: var(--smw-text-body);
  background: color-mix(in srgb, var(--smw-bg-selected) 55%, transparent);
}

.state-badge.installed {
  color: var(--smw-status-green);
}

.state-badge.available {
  color: var(--smw-text-secondary);
}

.capabilities {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

.link-action {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  min-width: 0;
  padding: 0;
  border: 0;
  color: var(--smw-text-body);
  background: transparent;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.link-action:hover,
.plugin-toggle-action:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.plugin-toggle-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 24px;
  padding: 0;
  border: 0;
  font: inherit;
  font-size: 13px;
  font-weight: 560;
  cursor: pointer;
}

.plugin-toggle-action span {
  width: 7px;
  height: 7px;
  border-radius: 999px;
}

.plugin-toggle-action.is-enabled {
  color: var(--smw-text-body);
  background: transparent;
}

.plugin-toggle-action.is-enabled span {
  background: var(--smw-status-green);
}

.plugin-toggle-action.is-disabled {
  color: var(--smw-text-secondary);
  background: transparent;
}

.plugin-toggle-action.is-disabled span {
  background: var(--smw-text-secondary);
}

.link-action.install,
.link-action.update {
  color: var(--smw-status-green);
}

.link-action.danger {
  color: var(--smw-error-text);
}

.empty-plugins {
  padding: 34px 16px;
  font-size: 13px;
}
</style>
