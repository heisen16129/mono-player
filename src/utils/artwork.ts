import { convertFileSrc } from '@tauri-apps/api/core';
import type { CoverImage, Track } from '../types/music';

export function trackArtworkSource(track: Pick<Track, 'artwork'> | null | undefined) {
  return track?.artwork ?? null;
}

export function artworkDisplaySrc(url: string | null | undefined) {
  const value = url?.trim();
  if (!value) return '';
  if (!value.toLocaleLowerCase().startsWith('file:///')) return value;

  return convertFileSrc(value.replace(/^file:\/\/\//i, ''));
}

export function filePathToArtworkUrl(path: string) {
  const normalizedPath = path.trim().replace(/\\/g, '/');
  if (!normalizedPath) return '';
  if (/^[a-z]+:\/\//i.test(normalizedPath)) return normalizedPath;
  return `file:///${normalizedPath}`;
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

export function artworkBlobDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(typeof reader.result === 'string' ? reader.result : ''));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('封面转换失败')));
    reader.readAsDataURL(blob);
  });
}

export async function artworkUrlDataUrl(url: string) {
  const source = url.trim();
  if (!source) return '';
  if (/^data:image\//i.test(source)) return source;
  const response = await fetch(source);
  if (!response.ok) throw new Error(`封面读取失败：${response.status}`);
  const blob = await response.blob();
  if (blob.type && !blob.type.toLowerCase().startsWith('image/')) {
    throw new Error(`封面格式无效：${blob.type}`);
  }
  return artworkBlobDataUrl(blob);
}
