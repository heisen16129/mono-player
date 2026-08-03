<script setup lang="ts">
import { RotateCcw } from '@lucide/vue';
import EmptyState from '../EmptyState.vue';

defineProps<{
  message: string;
}>();

const emit = defineEmits<{
  retry: [];
}>();
</script>

<template>
  <EmptyState :message="message">
    <template #action>
      <button class="secondary-button" type="button" @click="emit('retry')">
        <RotateCcw :size="15" />
        重新搜索
      </button>
    </template>
  </EmptyState>
</template>
