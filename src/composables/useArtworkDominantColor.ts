import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { artworkDominantColor } from '../utils/artwork';

export function useArtworkDominantColor(
  source: MaybeRefOrGetter<string | null | undefined>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  const dominantColor = ref('');
  let requestId = 0;

  watch(
    () => [toValue(source)?.trim() ?? '', toValue(enabled)] as const,
    ([url, isEnabled]) => {
      const currentRequestId = ++requestId;
      dominantColor.value = '';
      if (!isEnabled || !url) return;
      void artworkDominantColor(url).then((color) => {
        if (currentRequestId === requestId) dominantColor.value = color;
      });
    },
    { immediate: true },
  );

  return dominantColor;
}
