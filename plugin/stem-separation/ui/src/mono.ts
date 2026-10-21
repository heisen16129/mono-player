import type { createMono } from '../../../../packages/plugin-sdk/src/client';
export let mono: ReturnType<typeof createMono>;
export function setMono(client: ReturnType<typeof createMono>) { mono = client; }
