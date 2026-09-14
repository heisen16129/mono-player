<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { ChevronDown, Speaker } from '@lucide/vue';
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

const isEnglish = computed(() => props.locale === 'en-US');
const selectedDevice = computed(() => outputDevices.value.find((device) => device.id === props.audioOutputDeviceId));
const outputName = computed(() => !props.audioOutputDeviceId
  ? (isEnglish.value ? 'System default' : '系统默认')
  : selectedDevice.value?.name ?? (isEnglish.value ? 'Device unavailable' : '设备不可用'));

onMounted(() => {
  void refreshOutputDevices();
});
</script>

<template>
  <details class="output-settings" open>
    <summary>
      <span>{{ isEnglish ? 'Playback output' : '播放输出' }}</span>
      <small>{{ isEnglish ? 'Audio output device' : '音频输出设备' }}</small>
    </summary>
    <div class="output-panel">
      <div class="output-panel-header">
        <span>{{ isEnglish ? 'Playback device' : '播放输出设备' }}</span>
        <PlaybackAudioOutputRefreshButton :label="isEnglish ? 'Refresh' : '刷新'" @refresh="refreshOutputDevices" />
      </div>
      <PlaybackAudioOutputDeviceSelect
        :devices="outputDevices"
        :locale="locale"
        :value="audioOutputDeviceId"
        @change="setAudioOutputDevice"
      >
      <span class="output-device">
        <span class="device-icon"><Speaker :size="18" aria-hidden="true" /></span>
        <span class="device-description">
          <strong :title="outputName">{{ isEnglish ? 'Output: ' : '当前输出：' }}{{ outputName }}</strong>
          <small>{{ isEnglish ? 'Click to change output device' : '点击切换输出设备' }}</small>
        </span>
        <ChevronDown :size="14" aria-hidden="true" />
      </span>
      </PlaybackAudioOutputDeviceSelect>
    </div>
  </details>
</template>

<style scoped>
.output-settings {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--smw-border);
  border-radius: 12px;
  background: var(--smw-bg-panel);
}

summary {
  position: relative;
  padding-right: 20px;
  list-style: none;
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

summary::-webkit-details-marker { display: none; }
summary::after { content: '▸'; position: absolute; right: 0; top: 0; }
.output-settings[open] > summary::after { content: '▾'; }
summary small {
  display: block;
  margin-top: 3px;
  color: var(--smw-text-secondary);
  font-size: 11px;
  font-weight: 400;
}

.output-panel {
  display: grid;
  gap: 8px;
  margin-top: 14px;
  padding: 10px;
  border: 1px solid var(--smw-border);
  border-radius: 10px;
  background: var(--smw-bg-input);
}

.output-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--smw-text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.output-panel-header :deep(button) {
  min-height: 24px;
  padding: 2px 8px;
  font-size: 11px;
}

.output-device {
  position: relative;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 14px;
  gap: 9px;
  align-items: center;
  min-height: 60px;
  padding: 9px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-panel);
  cursor: pointer;
}

.device-icon {
  display: grid;
  place-items: center;
  height: 32px;
  border-radius: 7px;
  background: var(--smw-bg-selected);
}

.device-description { min-width: 0; }
.device-description strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.device-description small {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  color: var(--smw-text-secondary);
}

.output-device:hover { border-color: var(--smw-text-muted); }
</style>
