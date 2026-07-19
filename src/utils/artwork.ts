import { convertFileSrc } from '@tauri-apps/api/core';

export function artworkDisplaySrc(url: string | null | undefined) {
  const value = url?.trim();
  if (!value) return '';
  if (!value.toLocaleLowerCase().startsWith('file:///')) return value;

  return convertFileSrc(value.replace(/^file:\/\/\//i, ''));
}
