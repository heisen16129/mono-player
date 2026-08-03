<script setup lang="ts">
import TrackMetadataInfoRow from './TrackMetadataInfoRow.vue';

defineProps<{
  addedAtLabel: string;
  bitrateLabel: string;
  channelsLabel: string;
  fileName: string;
  filePathLabel: string;
  fileSizeLabel: string;
  sampleRateLabel: string;
}>();
</script>

<template>
  <dl class="metadata-file-info">
    <TrackMetadataInfoRow label="码率" :value="bitrateLabel" />
    <TrackMetadataInfoRow label="采样率" :value="sampleRateLabel" />
    <TrackMetadataInfoRow label="声道数" :value="channelsLabel" />
    <TrackMetadataInfoRow label="文件大小" :value="fileSizeLabel" />
    <TrackMetadataInfoRow label="文件名" :value="fileName" :title="fileName" />
    <TrackMetadataInfoRow label="文件位置" :value="filePathLabel" :title="filePathLabel" />
    <TrackMetadataInfoRow label="添加日期" :value="addedAtLabel" />
  </dl>
</template>

<style scoped>
.metadata-file-info {
  display: grid;
  gap: 8px;
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

</style>
