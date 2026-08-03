<script setup lang="ts">
import { onBeforeUnmount, toRef, watch } from 'vue';
import { useTrackMetadataAudioInfo } from '../composables/useTrackMetadataAudioInfo';
import { useTrackMetadataCoverPreview } from '../composables/useTrackMetadataCoverPreview';
import { useTrackMetadataDisplayLabels } from '../composables/useTrackMetadataDisplayLabels';
import { useTrackMetadataForm } from '../composables/useTrackMetadataForm';
import { t } from '../i18n';
import type { TrackMetadataDialogEmits, TrackMetadataDialogProps } from '../types/trackMetadataDialog';
import BaseDialog from './BaseDialog.vue';
import TrackMetadataDialogBody from './track-metadata/TrackMetadataDialogBody.vue';
import TrackMetadataDialogFooter from './track-metadata/TrackMetadataDialogFooter.vue';
import TrackMetadataDialogHeader from './track-metadata/TrackMetadataDialogHeader.vue';
import TrackMetadataEditor from './track-metadata/TrackMetadataEditor.vue';
import TrackMetadataError from './track-metadata/TrackMetadataError.vue';
import TrackMetadataSummary from './track-metadata/TrackMetadataSummary.vue';

const props = defineProps<TrackMetadataDialogProps>();

const emit = defineEmits<TrackMetadataDialogEmits>();

const { album, artist, canSave, genre, resetForm, title, toFormValue, trackNumber, year } = useTrackMetadataForm(props.track);
const { audioInfo, loadAudioInfo, stopAudioInfoLoading } = useTrackMetadataAudioInfo();
const { coverPreviewUrl, handleCoverError, loadCoverPreview, stopCoverPreviewLoading } = useTrackMetadataCoverPreview();

const { addedAtLabel, bitrateLabel, channelsLabel, fileName, filePathLabel, fileSizeLabel, sampleRateLabel } = useTrackMetadataDisplayLabels({
  audioInfo,
  locale: toRef(props, 'locale'),
  track: toRef(props, 'track'),
});

watch(
  () => props.track,
  (track) => {
    resetForm(track);
    void loadCoverPreview(track);
    void loadAudioInfo(track);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  stopCoverPreviewLoading();
  stopAudioInfoLoading();
});

function submit() {
  if (props.saving || !canSave.value) return;
  emit('save', toFormValue());
}
</script>

<template>
  <BaseDialog
    label="更改元数据"
    :close-label="t(locale, 'close')"
    :close-disabled="saving"
    close-on-overlay
    width="min(760px, calc(100vw - 32px))"
    max-height="min(620px, calc(100vh - var(--player-height) - 48px))"
    grid-template-rows="auto minmax(0, 1fr)"
    overflow="hidden"
    panel-class="metadata-dialog-panel"
    :z-index="360"
    @close="$emit('close')"
  >
    <template #header>
      <TrackMetadataDialogHeader :track-title="track.title" />
    </template>

    <form class="metadata-dialog-form" @submit.prevent="submit">
      <TrackMetadataDialogBody>
        <TrackMetadataSummary
          :added-at-label="addedAtLabel"
          :bitrate-label="bitrateLabel"
          :channels-label="channelsLabel"
          :cover-preview-url="coverPreviewUrl"
          :file-name="fileName"
          :file-path-label="filePathLabel"
          :file-size-label="fileSizeLabel"
          :sample-rate-label="sampleRateLabel"
          @cover-error="handleCoverError"
        />

        <TrackMetadataEditor
          :album="album"
          :artist="artist"
          :genre="genre"
          :title="title"
          :track-number="trackNumber"
          :year="year"
          @update-album="album = $event"
          @update-artist="artist = $event"
          @update-genre="genre = $event"
          @update-title="title = $event"
          @update-track-number="trackNumber = $event"
          @update-year="year = $event"
        />
      </TrackMetadataDialogBody>

      <TrackMetadataError v-if="error" :message="error" />

      <TrackMetadataDialogFooter :can-save="canSave" :saving="!!saving" @close="emit('close')" />
    </form>
  </BaseDialog>
</template>

<style scoped>
.metadata-dialog-form {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto auto;
  min-height: 0;
  overflow: hidden;
}

</style>
