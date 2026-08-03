<script setup lang="ts">
import { UserRound } from '@lucide/vue';
import { ref } from 'vue';

defineProps<{
  name: string;
  selected: boolean;
  songCountLabel: string;
}>();

const emit = defineEmits<{
  select: [];
}>();

const rowElement = ref<HTMLButtonElement | null>(null);

defineExpose({
  rowElement,
});
</script>

<template>
  <button
    ref="rowElement"
    class="artist-row"
    :class="{ selected }"
    type="button"
    @click="emit('select')"
  >
    <span class="artist-avatar"><UserRound :size="18" /></span>
    <span>
      <strong>{{ name }}</strong>
      <small>{{ songCountLabel }}</small>
    </span>
  </button>
</template>

<style scoped>
.artist-row {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-height: 54px;
  margin-right: -12px;
  padding: 6px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.artist-row:hover,
.artist-row.selected {
  background: var(--smw-bg-selected);
}

.artist-avatar {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid var(--smw-border);
  border-radius: 50%;
  color: var(--smw-text-primary);
  background: var(--smw-bg-input);
}

.artist-row strong,
.artist-row small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist-row strong {
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 620;
}

.artist-row small {
  color: var(--smw-text-secondary);
  font-size: 12px;
}
</style>
