import type { StyleValue } from 'vue';

export interface TrackCoverEqualizerProps {
  loading?: boolean;
  playing?: boolean;
  spectrumLevels?: number[];
  trackId: number;
  trackTitle: string;
}

export interface TrackCoverEqualizerBarOptions {
  loading?: boolean;
  playing?: boolean;
  spectrumLevels?: number[];
}

export type TrackCoverEqualizerBarStyle = StyleValue;
