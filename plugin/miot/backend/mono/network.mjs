export function mediaAddresses(interfaces, port) {
  return Object.values(interfaces).flat().filter(a => a && a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.'))
    .sort((a, b) => Number(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(b.address)) - Number(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)))
    .map(a => `http://${a.address}:${port}`);
}
export function resolveMediaHost(config, addresses) {
  if (config.server_host_mode === 'manual') return config.server_host || '';
  return addresses.includes(config.server_host) ? config.server_host : addresses[0] || '';
}
