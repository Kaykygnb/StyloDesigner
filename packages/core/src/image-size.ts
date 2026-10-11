/**
 * image-size.ts — DIMENSÕES DE UMA IMAGEM SEM DOM (PNG, JPEG, GIF, WebP e SVG)
 * Lê só o cabeçalho dos bytes. Assim o servidor sabe a largura e a altura de uma imagem enviada por um agente sem
 * precisar de navegador (`new Image()`).
 */

export interface ImageInfo { mime: string; width: number; height: number }

const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));

function svgSize(text: string): { width: number; height: number } | null {
  const root = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (!root) return null;
  const num = (name: string) => {
    const m = new RegExp(`\\b${name}\\s*=\\s*["']\\s*([0-9.]+)\\s*(px)?\\s*["']`, 'i').exec(root);
    return m ? parseFloat(m[1]) : null;
  };
  let width = num('width'), height = num('height');
  if (!(width && height)) {
    const vb = /\bviewBox\s*=\s*["']\s*[-0-9.]+[\s,]+[-0-9.]+[\s,]+([0-9.]+)[\s,]+([0-9.]+)\s*["']/i.exec(root);
    if (vb) { width = width || parseFloat(vb[1]); height = height || parseFloat(vb[2]); }
  }
  return width && height ? { width: Math.round(width), height: Math.round(height) } : null;
}

/** Tipo e dimensões a partir dos bytes; null se não for uma imagem reconhecida. */
export function imageInfo(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 10) return null;
  // PNG: assinatura + IHDR (largura e altura em 16..24)
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG' && bytes.length >= 24) return { mime: 'image/png', width: u32be(bytes, 16), height: u32be(bytes, 20) };
  // GIF
  if (ascii(bytes, 0, 3) === 'GIF') return { mime: 'image/gif', width: u16le(bytes, 6), height: u16le(bytes, 8) };
  // JPEG: procura o marcador SOFn
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let o = 2;
    while (o + 9 < bytes.length) {
      if (bytes[o] !== 0xff) { o++; continue; }
      const marker = bytes[o + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { o += 2; continue; }
      const len = u16be(bytes, o + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { mime: 'image/jpeg', height: u16be(bytes, o + 5), width: u16be(bytes, o + 7) };
      }
      o += 2 + len;
    }
    return null;
  }
  // WebP: RIFF....WEBP + VP8 / VP8L / VP8X
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP' && bytes.length >= 30) {
    const kind = ascii(bytes, 12, 4);
    if (kind === 'VP8X') return { mime: 'image/webp', width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) };
    if (kind === 'VP8L') {
      const b0 = bytes[21], b1 = bytes[22], b2 = bytes[23], b3 = bytes[24];
      return { mime: 'image/webp', width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
    }
    if (kind === 'VP8 ') return { mime: 'image/webp', width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff };
    return null;
  }
  // SVG (texto)
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 4096))).trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg\b/i.test(head)) {
    const size = svgSize(new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 65536))));
    return size ? { mime: 'image/svg+xml', ...size } : { mime: 'image/svg+xml', width: 300, height: 150 };
  }
  return null;
}

/** Imagem de um data URL ("data:image/png;base64,...") → bytes, tipo e dimensões. O tipo declarado é ignorado: vale o conteúdo. */
export function parseImageDataUrl(dataUrl: string): { bytes: Uint8Array; info: ImageInfo } | null {
  const m = /^data:([^;,]+)((?:;[^;,]+)*?),(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const isBase64 = /;base64/i.test(m[2]);
  let bytes: Uint8Array;
  try {
    bytes = isBase64 ? fromBase64(m[3]) : new TextEncoder().encode(decodeURIComponent(m[3]));
  } catch { return null; }
  const info = imageInfo(bytes);
  return info ? { bytes, info } : null;
}

/** base64 → bytes (usa Buffer quando existe: bem mais rápido no Node; no navegador, atob). */
export function fromBase64(b64: string): Uint8Array {
  const B = (globalThis as any).Buffer;
  if (B) return Uint8Array.from(B.from(b64, 'base64'));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** bytes → base64. */
export function toBase64(bytes: Uint8Array): string {
  const B = (globalThis as any).Buffer;
  if (B) return B.from(bytes).toString('base64');
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Bytes → data URL base64. */
export const toDataUrl = (bytes: Uint8Array, mime: string) => `data:${mime};base64,${toBase64(bytes)}`;
