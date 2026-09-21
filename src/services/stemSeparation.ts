import { invokeApi } from './api';
import type { StemBatchStatus, StemEnvironmentStatus, StemSeparationStatus } from '../types/stemSeparation';

export function startStemBatch(pluginId: string, source: string) {
  return invokeApi<StemBatchStatus>('stem_batch_start', { pluginId, source });
}
export function readStemBatchStatus() { return invokeApi<StemBatchStatus | null>('stem_batch_status'); }
export function cancelStemBatch() { return invokeApi<void>('stem_batch_cancel'); }
export function readStemOutputDirectory() { return invokeApi<string>('stem_output_directory'); }

export function checkStemEnvironment(pluginId: string) {
  return invokeApi<StemEnvironmentStatus>('stem_environment_check', { pluginId });
}

export function prepareStemEnvironment(pluginId: string) {
  return invokeApi<StemEnvironmentStatus>('stem_environment_prepare', { pluginId });
}

export function readStemEnvironment() {
  return invokeApi<StemEnvironmentStatus>('stem_environment_status');
}

export function cancelStemEnvironment() {
  return invokeApi<void>('stem_environment_cancel');
}

export function startStemSeparation(pluginId: string, source: string, outputDir: string) {
  return invokeApi<StemSeparationStatus>('stem_separation_start', { pluginId, source, outputDir });
}

export function readStemSeparationStatus() {
  return invokeApi<StemSeparationStatus | null>('stem_separation_status');
}

export function cancelStemSeparation(jobId: string) {
  return invokeApi<void>('stem_separation_cancel', { jobId });
}

export function revealSeparatedTrack(path: string) {
  return invokeApi<void>('open_track_in_folder', { path });
}
