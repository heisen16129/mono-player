export function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return '--:--';

  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');

  return `${minutes.toString().padStart(2, '0')}:${rest}`;
}

export function formatMetadataDate(value: string | null | undefined, locale: string) {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(locale === 'en-US' ? 'en-US' : 'zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(/\//g, '-');
}

export function formatSampleRate(value: number | null | undefined) {
  if (!value) return '未知';
  return `${(value / 1000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })} kHz`;
}

export function formatChannels(value: number | null | undefined) {
  if (!value) return '未知';
  if (value === 1) return '1 单声道';
  if (value === 2) return '2 立体声';
  return `${value} 声道`;
}

export function formatFileSize(value: number | null | undefined) {
  if (!value) return '未知';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toLocaleString('zh-CN', { maximumFractionDigits: unitIndex === 0 ? 0 : 2 })} ${units[unitIndex]}`;
}
