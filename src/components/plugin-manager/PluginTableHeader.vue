<script setup lang="ts">
import PluginTableSelectAllCheckbox from './PluginTableSelectAllCheckbox.vue';

defineProps<{
  allVisibleSelected: boolean;
  disabled: boolean;
}>();

const emit = defineEmits<{
  toggleAll: [];
}>();
</script>

<template>
  <thead>
    <tr>
      <th>
        <PluginTableSelectAllCheckbox :checked="allVisibleSelected" :disabled="disabled" @toggle="emit('toggleAll')" />
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
</template>

<style scoped>
th {
  height: 40px;
  padding: 0 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--smw-border) 70%, transparent);
  text-align: left;
  vertical-align: middle;
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  color: var(--smw-text-primary);
  background: color-mix(in srgb, var(--smw-bg-input) 92%, var(--smw-bg-selected));
  font-weight: 680;
}

th:first-child {
  text-align: center;
}

th:nth-child(2) {
  text-align: center;
}
</style>
