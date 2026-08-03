<script setup lang="ts">
import TrackMetadataCoverPreview from './TrackMetadataCoverPreview.vue';
import TrackMetadataFileInfo from './TrackMetadataFileInfo.vue';

defineProps<{
  addedAtLabel: string;
  bitrateLabel: string;
  channelsLabel: string;
  coverPreviewUrl: string;
  fileName: string;
  filePathLabel: string;
  fileSizeLabel: string;
  sampleRateLabel: string;
}>();

const emit = defineEmits<{
  coverError: [];
}>();
</script>

<template>
  <aside class="metadata-summary">
    <TrackMetadataCoverPreview :cover-preview-url="coverPreviewUrl" @cover-error="emit('coverError')" />

    <TrackMetadataFileInfo
      :added-at-label="addedAtLabel"
      :bitrate-label="bitrateLabel"
      :channels-label="channelsLabel"
      :file-name="fileName"
      :file-path-label="filePathLabel"
      :file-size-label="fileSizeLabel"
      :sample-rate-label="sampleRateLabel"
    />
  </aside>
</template>

<style scoped>
.metadata-summary {
  display: grid;
  align-content: start;
  gap: 14px;
  min-width: 0;
}

</style>
