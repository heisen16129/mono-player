export function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return '--:--';

  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');

  return `${minutes.toString().padStart(2, '0')}:${rest}`;
}
