export interface StemEnvironmentStatus {
  stage: 'idle' | 'checking' | 'missing' | 'installing' | 'cancelling' | 'cancelled' | 'ready' | 'error';
  message: string;
  pythonPath: string | null;
}

export interface StemSeparationStatus {
  id: string;
  pluginId: string;
  stage: 'loading' | 'separating' | 'exporting' | 'cancelling' | 'cancelled' | 'done' | 'error';
  progress: number | null;
  device: string | null;
  message: string | null;
  outputDir: string;
  vocalsPath: string | null;
  accompanimentPath: string | null;
}

export interface StemBatchStatus {
  elapsedMs: number;
  id: string;
  stage: 'scanning' | 'running' | 'cancelling' | 'cancelled' | 'done' | 'error';
  source: string;
  outputDir: string;
  message: string | null;
  items: Array<{ id: string; source: string; stage: string; message: string | null; vocalsPath: string | null; accompanimentPath: string | null }>;
  current: StemSeparationStatus | null;
}
