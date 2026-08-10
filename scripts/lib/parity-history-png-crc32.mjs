// Node 18/20-compatible PNG CRC-32 implementation.
// Responsibility: calculate the unsigned IEEE CRC-32 used by PNG chunks.
const TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

export function pngCrc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
