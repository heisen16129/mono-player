import type { StyleValue } from 'vue';

export interface TrackCoverEqualizerProps {
  loading?: boolean;
  playing?: boolean;
  trackId: number;
  trackTitle: string;
}

export interface TrackCoverEqualizerBarOptions {
  loading?: boolean;
  playing?: boolean;
}

export type TrackCoverEqualizerBarStyle = StyleValue;
