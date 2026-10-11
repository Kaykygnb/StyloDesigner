/**
 * asset-kinds.ts — QUE TIPO DE ARQUIVO É (imagem, vídeo, áudio, 3D, Lottie, fonte), PELOS BYTES
 * Não confia no tipo que o remetente declara: olha o conteúdo. Puro, sem DOM.
 */

import { imageInfo } from './image-size.ts';

export type AssetKindName = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'MODEL3D' | 'LOTTIE' | 'FONT' | 'OTHER';

export interface Sniffed { kind: AssetKindName; mime: string; width?: number; height?: number }

/** Tamanho máximo de um arquivo por tipo (bytes). */
export const MAX_BYTES: Record<AssetKindName, number> = {
  IMAGE: 16 * 1024 * 1024,
  FONT: 4 * 1024 * 1024,
  LOTTIE: 10 * 1024 * 1024,
  AUDIO: 50 * 1024 * 1024,
  MODEL3D: 100 * 1024 * 1024,
  VIDEO: 200 * 1024 * 1024,
  OTHER: 20 * 1024 * 1024,
};

const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));

/** Nome do tipo em minúsculas, como as ferramentas MCP usam ("image", "model3d"...). */
export const kindToTool = (k: AssetKindName) => k.toLowerCase();
export const kindFromTool = (s: string): AssetKindName | null => {
  const k = s.toUpperCase();
  return (['IMAGE', 'VIDEO', 'AUDIO', 'MODEL3D', 'LOTTIE', 'FONT', 'OTHER'] as const).find((x) => x === k) ?? null;
};

/** Descobre o tipo e o MIME verdadeiros do arquivo. `hint` = tipo declarado (usado só para desempatar). */
export function sniffAsset(bytes: Uint8Array, hint = ''): Sniffed {
  const img = imageInfo(bytes);
  if (img) return { kind: 'IMAGE', mime: img.mime, width: img.width, height: img.height };
  if (bytes.length >= 4) {
    const head4 = ascii(bytes, 0, 4);
    if (head4 === 'wOF2') return { kind: 'FONT', mime: 'font/woff2' };
    if (head4 === 'wOFF') return { kind: 'FONT', mime: 'font/woff' };
    if (head4 === 'OTTO') return { kind: 'FONT', mime: 'font/otf' };
    if (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) return { kind: 'FONT', mime: 'font/ttf' };
    if (head4 === 'glTF') return { kind: 'MODEL3D', mime: 'model/gltf-binary' };
    if (head4 === 'OggS') return { kind: 'AUDIO', mime: hint.startsWith('video/') ? 'video/ogg' : 'audio/ogg' };
    if (head4 === 'fLaC') return { kind: 'AUDIO', mime: 'audio/flac' };
    if (head4 === 'RIFF' && bytes.length >= 12) {
      const form = ascii(bytes, 8, 4);
      if (form === 'WAVE') return { kind: 'AUDIO', mime: 'audio/wav' };
      if (form === 'AVI ') return { kind: 'VIDEO', mime: 'video/x-msvideo' };
    }
    if (head4 === 'ID3' + String.fromCharCode(bytes[3]) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return { kind: 'AUDIO', mime: 'audio/mpeg' };
  }
  // MP4/MOV/M4A: caixa "ftyp" nos bytes 4..8
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    if (brand.startsWith('M4A') || brand === 'M4B ') return { kind: 'AUDIO', mime: 'audio/mp4' };
    return { kind: 'VIDEO', mime: brand.startsWith('qt') ? 'video/quicktime' : 'video/mp4' };
  }
  // WebM/Matroska
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return { kind: 'VIDEO', mime: hint === 'audio/webm' ? 'audio/webm' : 'video/webm' };
  // JSON: Lottie (chaves v, fr, layers) ou glTF em texto
  const first = bytes.subarray(0, 1)[0];
  if (first === 0x7b || first === 0x20 || first === 0x0a || first === 0xef) {
    try {
      const text = new TextDecoder().decode(bytes.length > 4_000_000 ? bytes.subarray(0, 4_000_000) : bytes).replace(/^﻿/, '');
      if (bytes.length <= 4_000_000) {
        const json = JSON.parse(text);
        if (json && typeof json === 'object' && 'layers' in json && 'fr' in json && 'v' in json) return { kind: 'LOTTIE', mime: 'application/json', width: Number(json.w) || undefined, height: Number(json.h) || undefined };
        if (json?.asset?.version && (json.scenes || json.nodes || json.meshes)) return { kind: 'MODEL3D', mime: 'model/gltf+json' };
      }
    } catch { /* não é JSON */ }
  }
  return { kind: 'OTHER', mime: hint || 'application/octet-stream' };
}

/** Extensão de arquivo para um MIME (para nomear o arquivo exportado). */
export function extensionFor(mime: string): string {
  const table: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg',
    'audio/mp4': 'm4a', 'audio/flac': 'flac', 'model/gltf-binary': 'glb', 'model/gltf+json': 'gltf', 'application/json': 'json',
    'font/woff2': 'woff2', 'font/woff': 'woff', 'font/ttf': 'ttf', 'font/otf': 'otf',
  };
  return table[mime] ?? 'bin';
}
