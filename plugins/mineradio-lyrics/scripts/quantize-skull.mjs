import { readFileSync, writeFileSync } from 'node:fs';

const [, , sourcePath, outputPath] = process.argv;
if (!sourcePath || !outputPath) throw new Error('Usage: node quantize-skull.mjs <source.bin> <output.q16>');

const source = readFileSync(sourcePath);
if (source.byteLength % 20 !== 0) throw new Error('Skull point asset must contain five Float32 values per point.');
const values = new Float32Array(source.buffer, source.byteOffset, source.byteLength / 4);
const channels = 5;
const mins = new Float32Array(channels).fill(Infinity);
const maxes = new Float32Array(channels).fill(-Infinity);
for (let index = 0; index < values.length; index += 1) {
  const channel = index % channels;
  mins[channel] = Math.min(mins[channel], values[index]);
  maxes[channel] = Math.max(maxes[channel], values[index]);
}
const headerSize = 48;
const output = Buffer.allocUnsafe(headerSize + values.length * 2);
output.write('MRQ1', 0, 'ascii');
output.writeUInt32LE(values.length, 4);
for (let channel = 0; channel < channels; channel += 1) {
  output.writeFloatLE(mins[channel], 8 + channel * 4);
  output.writeFloatLE(maxes[channel] - mins[channel], 28 + channel * 4);
}
for (let index = 0; index < values.length; index += 1) {
  const channel = index % channels;
  const range = maxes[channel] - mins[channel];
  const normalized = range > 0 ? (values[index] - mins[channel]) / range : 0;
  output.writeUInt16LE(Math.max(0, Math.min(65535, Math.round(normalized * 65535))), headerSize + index * 2);
}
writeFileSync(outputPath, output);
