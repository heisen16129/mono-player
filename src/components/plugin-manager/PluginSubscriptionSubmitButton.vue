<script setup lang="ts">
import { Settings2 } from '@lucide/vue';

defineProps<{
  adding: boolean;
  disabled: boolean;
}>();

const emit = defineEmits<{
  add: [];
}>();
</script>

<template>
  <button class="primary-button subscription-submit" type="button" :disabled="disabled" @click="emit('add')">
    <Settings2 :size="16" />
    <span>{{ adding ? '添加中...' : '添加订阅' }}</span>
  </button>
</template>

<style scoped>
.subscription-submit {
  height: 36px;
  font-size: 0;
}

.subscription-submit span {
  font-size: 13px;
}
</style>
