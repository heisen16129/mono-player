import { computed, type Ref } from 'vue';
import type { TrackAudioInfo } from '../services/music';
import type { Locale, Track } from '../types/music';
import { formatChannels, formatFileSize, formatMetadataDate, formatSampleRate } from '../utils/format';
import { folderTitle } from '../utils/path';

interface TrackMetadataDisplayLabelOptions {
  audioInfo: Ref<TrackAudioInfo | null>;
  locale: Ref<Locale>;
  track: Ref<Track>;
}

export function useTrackMetadataDisplayLabels({ audioInfo, locale, track }: TrackMetadataDisplayLabelOptions) {
  const fileName = computed(() => folderTitle(track.value.path));
  const bitrateLabel = computed(() => audioInfo.value?.bitrateKbps ? `${audioInfo.value.bitrateKbps} kbps` : '未知');
  const sampleRateLabel = computed(() => formatSampleRate(audioInfo.value?.sampleRateHz));
  const channelsLabel = computed(() => formatChannels(audioInfo.value?.channels));
  const fileSizeLabel = computed(() => formatFileSize(audioInfo.value?.fileSizeBytes));
  const addedAtLabel = computed(() => formatMetadataDate(track.value.addedAt, locale.value));
  const filePathLabel = computed(() => track.value.path || '未知');

  return {
    addedAtLabel,
    bitrateLabel,
    channelsLabel,
    fileName,
    filePathLabel,
    fileSizeLabel,
    sampleRateLabel,
  };
}
