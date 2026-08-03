import type { TrackMetadataFormValue } from '../composables/useTrackMetadataForm';
import type { Locale, Track } from './music';

export interface TrackMetadataDialogProps {
  track: Track;
  saving?: boolean;
  error?: string | null;
  locale: Locale;
}

export interface TrackMetadataDialogEmits {
  close: [];
  save: [value: TrackMetadataFormValue];
}
