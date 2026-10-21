import type { createMono } from '../../../../../packages/plugin-sdk/src/client';
export let mono: ReturnType<typeof createMono>;
let connection: { url: string; token: string };
export async function initializeHost(client: ReturnType<typeof createMono>) {
  mono = client;
  connection = await client.speaker.getConnection();
  const url = new URL(connection.url);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') throw new Error('无效的音箱服务地址');
}
export const serviceOrigin = () => new URL(connection.url).origin;
export const serviceToken = () => connection.token;
