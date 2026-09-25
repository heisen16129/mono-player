<script setup lang="ts">
import { ListMusic } from '@lucide/vue';
import { t } from '../../i18n';
import type { Locale } from '../../types/music';

defineProps<{
  isOpen: boolean;
  locale: Locale;
}>();

const emit = defineEmits<{
  setControl: [element: unknown];
  toggle: [];
}>();
</script>

<template>
  <div :ref="(element) => emit('setControl', element)" class="queue-control">
    <button
      class="icon-button queue-button"
      :class="{ 'is-active': isOpen }"
      type="button"
      :aria-label="t(locale, 'playbackQueue')"
      :title="t(locale, 'playbackQueue')"
      @click="emit('toggle')"
    >
      <ListMusic :size="18" />
    </button>


  </div>
</template>

<style scoped>
.queue-control {
  position: relative;
  display: grid;
  place-items: center;
}

.queue-button {
  color: var(--smw-text-body);
}

</style>
