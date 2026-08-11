<script setup lang="ts">
import TrackMetadataCoverPreview from './TrackMetadataCoverPreview.vue';
import TrackMetadataFileInfo from './TrackMetadataFileInfo.vue';

defineProps<{
  addedAtLabel: string;
  bitrateLabel: string;
  bitDepthLabel: string;
  channelsLabel: string;
  codecLabel: string;
  containerFormatLabel: string;
  coverPreviewUrl: string;
  durationLabel: string;
  fileName: string;
  filePathLabel: string;
  fileSizeLabel: string;
  losslessLabel: string;
  modifiedAtLabel: string;
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
      :bit-depth-label="bitDepthLabel"
      :channels-label="channelsLabel"
      :codec-label="codecLabel"
      :container-format-label="containerFormatLabel"
      :duration-label="durationLabel"
      :file-name="fileName"
      :file-path-label="filePathLabel"
      :file-size-label="fileSizeLabel"
      :lossless-label="losslessLabel"
      :modified-at-label="modifiedAtLabel"
      :sample-rate-label="sampleRateLabel"
      variant="details"
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
