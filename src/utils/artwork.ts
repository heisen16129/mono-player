import { convertFileSrc } from '@tauri-apps/api/core';
import type { CoverImage } from '../types/music';

export function artworkDisplaySrc(url: string | null | undefined) {
  const value = url?.trim();
  if (!value) return '';
  if (!value.toLocaleLowerCase().startsWith('file:///')) return value;

  return convertFileSrc(value.replace(/^file:\/\/\//i, ''));
}

export function usableArtworkDisplaySrc(url: string | null | undefined, failedUrls?: Set<string>) {
  const displayUrl = artworkDisplaySrc(url);
  if (!displayUrl || failedUrls?.has(displayUrl)) return '';
  return displayUrl;
}

export function isTemporaryObjectUrl(url: string | null | undefined) {
  return Boolean(url?.startsWith('blob:'));
}

export function revokeTemporaryObjectUrl(url: string | null | undefined) {
  if (url && isTemporaryObjectUrl(url)) {
    URL.revokeObjectURL(url);
  }
}

export function coverImageObjectUrl(cover: CoverImage | null | undefined) {
  if (!cover?.data.length) return null;
  return URL.createObjectURL(new Blob([new Uint8Array(cover.data)], { type: cover.mime_type }));
}
