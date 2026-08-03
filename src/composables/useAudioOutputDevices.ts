import { ref } from 'vue';
import { listRustBackendOutputDevices } from '../services/playerBackend';

interface UseAudioOutputDevicesOptions {
  setAudioOutputDeviceId: (deviceId: string) => void;
}

export function useAudioOutputDevices({ setAudioOutputDeviceId }: UseAudioOutputDevicesOptions) {
  const outputDevices = ref<{ id: string; name: string; isDefault: boolean }[]>([]);

  async function refreshOutputDevices() {
    outputDevices.value = await listRustBackendOutputDevices();
  }

  function setAudioOutputDevice(event: Event) {
    setAudioOutputDeviceId((event.target as HTMLSelectElement).value);
  }

  return {
    outputDevices,
    refreshOutputDevices,
    setAudioOutputDevice,
  };
}
