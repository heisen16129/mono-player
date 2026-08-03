<script setup lang="ts">
import type { Locale, PlayerSettings } from '../../types/music';
import GeneralCloseActionSetting from './GeneralCloseActionSetting.vue';
import GeneralSearchHistoryLimitSetting from './GeneralSearchHistoryLimitSetting.vue';

defineProps<{
  closeAction: PlayerSettings['closeAction'];
  locale: Locale;
  searchHistoryLimit: number;
}>();

const emit = defineEmits<{
  setCloseAction: [action: PlayerSettings['closeAction']];
  setSearchHistoryLimit: [limit: number];
}>();

const historyOptions = ['5', '10', '15', '20', '25'];
</script>

<template>
  <GeneralCloseActionSetting
    :close-action="closeAction"
    :locale="locale"
    @set-close-action="emit('setCloseAction', $event)"
  />

  <GeneralSearchHistoryLimitSetting
    :locale="locale"
    :options="historyOptions"
    :search-history-limit="searchHistoryLimit"
    @set-search-history-limit="emit('setSearchHistoryLimit', $event)"
  />
</template>
