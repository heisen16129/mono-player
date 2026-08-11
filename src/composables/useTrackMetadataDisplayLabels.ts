import { computed, type Ref } from 'vue';
import type { TrackAudioInfo } from '../services/music';
import type { Locale, Track } from '../types/music';
import { formatChannels, formatDuration, formatFileSize, formatMetadataDate, formatSampleRate } from '../utils/format';
import { folderTitle } from '../utils/path';

const UNKNOWN_LABEL = '未知';

interface TrackMetadataDisplayLabelOptions {
  audioInfo: Ref<TrackAudioInfo | null>;
  locale: Ref<Locale>;
  track: Ref<Track>;
}

export function useTrackMetadataDisplayLabels({ audioInfo, locale, track }: TrackMetadataDisplayLabelOptions) {
  const fileName = computed(() => folderTitle(track.value.path));
  const durationLabel = computed(() => formatDuration(audioInfo.value?.durationSeconds ?? track.value.duration));
  const containerFormatLabel = computed(() => audioInfo.value?.containerFormat || UNKNOWN_LABEL);
  const codecLabel = computed(() => audioInfo.value?.codec || UNKNOWN_LABEL);
  const bitrateLabel = computed(() => audioInfo.value?.bitrateKbps ? `${audioInfo.value.bitrateKbps} kbps` : UNKNOWN_LABEL);
  const sampleRateLabel = computed(() => formatSampleRate(audioInfo.value?.sampleRateHz));
  const bitDepthLabel = computed(() => audioInfo.value?.bitDepth ? `${audioInfo.value.bitDepth} bit` : UNKNOWN_LABEL);
  const losslessLabel = computed(() => {
    if (audioInfo.value?.lossless === true) return '是';
    if (audioInfo.value?.lossless === false) return '否';
    return UNKNOWN_LABEL;
  });
  const channelsLabel = computed(() => formatChannels(audioInfo.value?.channels));
  const fileSizeLabel = computed(() => formatFileSize(audioInfo.value?.fileSizeBytes));
  const addedAtLabel = computed(() => formatMetadataDate(track.value.addedAt, locale.value));
  const filePathLabel = computed(() => track.value.path || UNKNOWN_LABEL);

  return {
    addedAtLabel,
    bitrateLabel,
    bitDepthLabel,
    channelsLabel,
    codecLabel,
    containerFormatLabel,
    durationLabel,
    fileName,
    filePathLabel,
    fileSizeLabel,
    losslessLabel,
    sampleRateLabel,
  };
}
