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

const artworkColorCache = new Map<string, Promise<string[]>>();

function loadArtworkImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => reject(new Error('封面图片加载失败')), { once: true });
    image.src = source;
  });
}

function colorChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

async function calculateArtworkColors(url: string) {
  let source = url;
  try {
    source = await artworkUrlDataUrl(url) || url;
  } catch {
    // Local asset URLs and data URLs can still be sampled directly.
  }

  const image = await loadArtworkImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const buckets = new Map<number, { blue: number; count: number; green: number; red: number; score: number }>();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 160) continue;
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const lightness = (max + min) / 510;
    if (lightness < 0.035 || lightness > 0.97) continue;
    const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
    const edgePenalty = lightness > 0.88 || lightness < 0.1 ? 0.48 : 1;
    const weight = (0.72 + saturation * 0.72) * edgePenalty;
    const key = ((red >> 5) << 6) | ((green >> 5) << 3) | (blue >> 5);
    const bucket = buckets.get(key) ?? { blue: 0, count: 0, green: 0, red: 0, score: 0 };
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    bucket.count += 1;
    bucket.score += weight;
    buckets.set(key, bucket);
  }

  const colors: Array<{ blue: number; green: number; red: number }> = [];
  for (const bucket of [...buckets.values()].sort((left, right) => right.score - left.score)) {
    if (!bucket.count) continue;
    const color = {
      red: bucket.red / bucket.count,
      green: bucket.green / bucket.count,
      blue: bucket.blue / bucket.count,
    };
    const isDistinct = colors.every((existing) => (
      Math.hypot(existing.red - color.red, existing.green - color.green, existing.blue - color.blue) >= 54
    ));
    if (!isDistinct) continue;
    colors.push(color);
    if (colors.length >= 8) break;
  }
  return colors.map((color) => (
    `#${colorChannel(color.red)}${colorChannel(color.green)}${colorChannel(color.blue)}`
  ));
}

function artworkColors(url: string) {
  const source = url.trim();
  if (!source) return Promise.resolve([]);
  const cached = artworkColorCache.get(source);
  if (cached) return cached;
  const pending = calculateArtworkColors(source).catch(() => []);
  artworkColorCache.set(source, pending);
  return pending;
}

export function artworkDominantColor(url: string) {
  return artworkColors(url).then((colors) => colors[0] || '');
}

export function artworkColorPalette(url: string, limit = 4) {
  return artworkColors(url).then((colors) => colors.slice(0, Math.max(0, limit)));
}
