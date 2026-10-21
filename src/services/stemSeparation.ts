import { invokeApi } from './api';
import type { StemEnvironmentStatus, StemSeparationStatus } from '../types/stemSeparation';

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

export function readStemSeparationStatus() {
  return invokeApi<StemSeparationStatus | null>('stem_separation_status');
}

export function cancelStemSeparation(jobId: string) {
  return invokeApi<void>('stem_separation_cancel', { jobId });
}
