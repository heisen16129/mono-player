import { createHash, createCipheriv, randomBytes } from 'node:crypto';

// The upstream MIoT implementation expects QuickJS's binary crypto helpers.
export function installCompat() {
  const bytes = value => value?._hex ? Buffer.from(value._hex, 'hex') : Buffer.from(value);
  const hash = (name, value) => createHash(name).update(value).digest('hex');
  const rc4 = (key, input) => {
    key = bytes(key); input = bytes(input);
    const s = Array.from({ length: 256 }, (_, i) => i);
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + s[i] + key[i % key.length]) & 255;
      [s[i], s[j]] = [s[j], s[i]];
    }
    const output = Buffer.alloc(input.length);
    let i = 0; j = 0;
    for (let n = 0; n < input.length; n++) {
      i = (i + 1) & 255; j = (j + s[i]) & 255;
      [s[i], s[j]] = [s[j], s[i]];
      output[n] = input[n] ^ s[(s[i] + s[j]) & 255];
    }
    return output;
  };
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {
    randomBytes, md5: value => hash('md5', value), sha1: value => hash('sha1', value),
    sha256Bytes: value => createHash('sha256').update(bytes(value)).digest(), rc4,
    aesEncrypt(value, mode, key, iv) {
      key = bytes(key);
      const cipher = createCipheriv(`aes-${key.length * 8}-${mode}`, key, bytes(iv));
      return Buffer.concat([cipher.update(bytes(value)), cipher.final()]);
    },
  } });
  globalThis.__go_buffer_from = (value, encoding) => Buffer.from(value, encoding).toString('hex');
  globalThis.__go_buffer_to_string = (value, encoding) => Buffer.from(value, 'hex').toString(encoding);
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const headers = new Headers(options.headers);
    const timeout = Math.min(120000, Number(headers.get('X-Fetch-Timeout-Ms')) || 30000);
    const manual = headers.has('X-Fetch-No-Redirect');
    headers.delete('X-Fetch-Timeout-Ms'); headers.delete('X-Fetch-No-Redirect');
    return nativeFetch(url, { ...options, headers, redirect: manual ? 'manual' : options.redirect,
      signal: options.signal || AbortSignal.timeout(timeout) });
  };
}
