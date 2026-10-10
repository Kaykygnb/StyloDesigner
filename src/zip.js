/** ZIP Store writer para bundles pequenos gerados pelo editor. Não precisa de dependências ou servidor. */
const encoder = new TextEncoder();
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const u16 = (view, offset, value) => view.setUint16(offset, value, true);
const u32 = (view, offset, value) => view.setUint32(offset, value >>> 0, true);
const concat = (parts) => {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
};

const normalizeFiles = (files) => {
  if (!Array.isArray(files) || !files.length || files.length > 0xffff) throw new Error('O pacote ZIP precisa ter entre 1 e 65.535 arquivos.');
  const seen = new Set();
  return files.map(({ path, content }) => {
    if (typeof path !== 'string' || !/^[a-z0-9._/-]+$/i.test(path) || path.startsWith('/') || path.includes('\\') || path.split('/').some((part) => !part || part === '.' || part === '..')) {
      throw new Error(`Caminho inseguro no pacote ZIP: ${String(path)}.`);
    }
    if (seen.has(path.toLowerCase())) throw new Error(`Caminho duplicado no pacote ZIP: ${path}.`);
    seen.add(path.toLowerCase());
    const name = encoder.encode(path);
    const data = encoder.encode(String(content ?? ''));
    if (name.length > 0xffff || data.length > 0xffffffff) throw new Error(`Arquivo grande demais para ZIP clássico: ${path}.`);
    return { name, data, crc: crc32(data) };
  });
};

/** Gera um ZIP Store (sem compressão) para manter o escritor mínimo e funcionar offline. */
export function createZip(files) {
  const entries = normalizeFiles(files);
  const local = [];
  const central = [];
  let localOffset = 0;

  for (const entry of entries) {
    const header = new Uint8Array(30 + entry.name.length);
    const view = new DataView(header.buffer);
    u32(view, 0, 0x04034b50); u16(view, 4, 20); u16(view, 6, 0x0800); u16(view, 8, 0);
    u16(view, 10, 0); u16(view, 12, 33); u32(view, 14, entry.crc);
    u32(view, 18, entry.data.length); u32(view, 22, entry.data.length);
    u16(view, 26, entry.name.length); u16(view, 28, 0); header.set(entry.name, 30);
    local.push(header, entry.data);

    const record = new Uint8Array(46 + entry.name.length);
    const dir = new DataView(record.buffer);
    u32(dir, 0, 0x02014b50); u16(dir, 4, 20); u16(dir, 6, 20); u16(dir, 8, 0x0800); u16(dir, 10, 0);
    u16(dir, 12, 0); u16(dir, 14, 33); u32(dir, 16, entry.crc);
    u32(dir, 20, entry.data.length); u32(dir, 24, entry.data.length);
    u16(dir, 28, entry.name.length); u16(dir, 30, 0); u16(dir, 32, 0);
    u16(dir, 34, 0); u16(dir, 36, 0); u32(dir, 38, 0); u32(dir, 42, localOffset); record.set(entry.name, 46);
    central.push(record);
    localOffset += header.length + entry.data.length;
  }

  const centralDirectory = concat(central);
  if (localOffset > 0xffffffff || centralDirectory.length > 0xffffffff) throw new Error('O pacote excede o limite do formato ZIP clássico (4 GB).');
  const end = new Uint8Array(22);
  const eocd = new DataView(end.buffer);
  u32(eocd, 0, 0x06054b50); u16(eocd, 4, 0); u16(eocd, 6, 0);
  u16(eocd, 8, entries.length); u16(eocd, 10, entries.length);
  u32(eocd, 12, centralDirectory.length); u32(eocd, 16, localOffset); u16(eocd, 20, 0);
  return concat([...local, centralDirectory, end]);
}
