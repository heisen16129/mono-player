<script setup lang="ts">
import { onMounted } from 'vue';
import { useAudioOutputDevices } from '../../composables/useAudioOutputDevices';
import PlaybackAudioOutputDeviceSelect from './PlaybackAudioOutputDeviceSelect.vue';
import PlaybackAudioOutputRefreshButton from './PlaybackAudioOutputRefreshButton.vue';

const props = defineProps<{
  audioOutputDeviceId: string;
  locale: string;
  setAudioOutputDeviceId: (deviceId: string) => void;
}>();

const {
  outputDevices,
  refreshOutputDevices,
  setAudioOutputDevice,
} = useAudioOutputDevices({
  setAudioOutputDeviceId: props.setAudioOutputDeviceId,
});

onMounted(() => {
  void refreshOutputDevices();
});
</script>

<template>
  <label class="field-row wide-field">
    <span>{{ locale === 'en-US' ? 'Output device' : '输出设备' }}</span>
    <span class="path-field">
      <PlaybackAudioOutputDeviceSelect
        :devices="outputDevices"
        :locale="locale"
        :value="audioOutputDeviceId"
        @change="setAudioOutputDevice"
      />
      <PlaybackAudioOutputRefreshButton
        :label="locale === 'en-US' ? 'Refresh' : '刷新'"
        @refresh="refreshOutputDevices"
      />
    </span>
  </label>
</template>

<style scoped>
.field-row {
  display: grid;
  gap: 8px;
  max-width: 280px;
}

.wide-field {
  max-width: 560px;
}

.field-row span {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
}

.path-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  gap: 8px;
  align-items: center;
}

</style>
