// Some Xiaomi firmware replaces query separators with spaces in media URLs.
export function normalizeMediaQuery(url) {
  if (!/^\/api\/v1\/songs\/\d+\/play$/.test(url.pathname) && url.pathname !== '/api/v1/proxy/transcode') return;
  const packed = url.searchParams.get('access_token');
  if (!packed || !/\s/.test(packed)) return;
  const parts = packed.split(/\s+/);
  if (!/^[a-f0-9]{64}$/.test(parts[0])) return;
  const allowed = new Set(['seek', 'speed', 'format', 'radio_transcode', 'normalize', 'id']);
  const entries = parts.slice(1).map(part => part.split('='));
  if (entries.some(([key, value, extra]) => !allowed.has(key) || !value || extra !== undefined || url.searchParams.has(key))) return;
  url.searchParams.set('access_token', parts[0]);
  for (const [key, value] of entries) url.searchParams.set(key, value);
}
