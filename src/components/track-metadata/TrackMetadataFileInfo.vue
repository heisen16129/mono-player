<script setup lang="ts">
import TrackMetadataInfoRow from './TrackMetadataInfoRow.vue';

withDefaults(defineProps<{
  addedAtLabel: string;
  bitrateLabel: string;
  bitDepthLabel: string;
  channelsLabel: string;
  codecLabel: string;
  containerFormatLabel: string;
  durationLabel: string;
  fileName: string;
  filePathLabel: string;
  fileSizeLabel: string;
  losslessLabel: string;
  sampleRateLabel: string;
  variant?: 'details' | 'properties';
}>(), {
  variant: 'properties',
});
</script>

<template>
  <section class="metadata-file-info">
    <h3>{{ variant === 'details' ? '文件信息' : '文件属性' }}</h3>
    <dl :class="{ 'property-grid': variant === 'properties' }">
      <template v-if="variant === 'details'">
      <TrackMetadataInfoRow label="文件名" :value="fileName" :title="fileName" />
      <TrackMetadataInfoRow label="文件位置" :value="filePathLabel" :title="filePathLabel" />
      <TrackMetadataInfoRow label="添加日期" :value="addedAtLabel" />
      </template>
      <template v-else>
        <TrackMetadataInfoRow label="文件大小" :value="fileSizeLabel" />
        <TrackMetadataInfoRow label="时长" :value="durationLabel" />
        <TrackMetadataInfoRow label="容器格式" :value="containerFormatLabel" />
        <TrackMetadataInfoRow v-if="codecLabel !== containerFormatLabel" label="编码" :value="codecLabel" />
        <TrackMetadataInfoRow label="码率" :value="bitrateLabel" />
        <TrackMetadataInfoRow label="采样率" :value="sampleRateLabel" />
        <TrackMetadataInfoRow label="位深" :value="bitDepthLabel" />
        <TrackMetadataInfoRow label="无损" :value="losslessLabel" />
        <TrackMetadataInfoRow label="声道数" :value="channelsLabel" />
      </template>
    </dl>
  </section>
</template>

<style scoped>
.metadata-file-info {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  background: var(--smw-bg-workspace);
}

.metadata-file-info h3 {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 650;
}

.metadata-file-info dl {
  display: grid;
  gap: 8px;
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.metadata-file-info dl.property-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
}

.metadata-file-info dl.property-grid :deep(.metadata-info-row) {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2px;
  min-width: 0;
  padding: 6px 9px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--smw-bg-input) 82%, transparent);
}

@media (max-width: 920px) {
  .metadata-file-info dl.property-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .metadata-file-info dl.property-grid {
    grid-template-columns: 1fr;
  }
}

</style>
