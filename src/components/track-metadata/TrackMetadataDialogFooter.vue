<script setup lang="ts">
defineProps<{
  canSave: boolean;
  saving: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <footer class="metadata-dialog-actions">
    <button class="secondary-button" type="button" :disabled="saving" @click="emit('close')">
      取消
    </button>
    <button class="confirm-button" type="submit" :disabled="saving || !canSave">
      {{ saving ? '保存中...' : '保存' }}
    </button>
  </footer>
</template>

<style scoped>
.metadata-dialog-actions {
  --button-min-height: 32px;
  --button-padding-x: 16px;
  --button-min-width: 70px;

  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px 16px;
}
</style>
