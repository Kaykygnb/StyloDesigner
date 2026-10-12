// Miniatura do projeto para a tela inicial: o servidor desenha a primeira tela (a mesma imagem que o agente vê com get_image)
// e o painel a guarda como um SVG que envolve o PNG (é o formato que o servidor já aceita para miniaturas).
import { putThumb, tool } from './api';
import { boardsOf, pageOf } from './doc';
import type { Doc } from './types';

/** Largura e altura de um PNG lendo o cabeçalho (sem decodificar a imagem). */
function pngSize(base64: string): { w: number; h: number } | null {
  try {
    const head = atob(base64.slice(0, 40));
    if (head.charCodeAt(1) !== 0x50) return null;
    const u32 = (o: number) => (head.charCodeAt(o) << 24) | (head.charCodeAt(o + 1) << 16) | (head.charCodeAt(o + 2) << 8) | head.charCodeAt(o + 3);
    return { w: u32(16) >>> 0, h: u32(20) >>> 0 };
  } catch { return null; }
}

/** Desenha a primeira tela do projeto e guarda como miniatura. Falha em silêncio (a miniatura é só um enfeite). */
export async function saveThumbnail(file: string, doc: Doc, pageId: string | null): Promise<void> {
  try {
    const page = pageOf(doc, pageId);
    const first = boardsOf(page)[0];
    if (!first) return;
    const out = await tool<{ _image?: { data: string } }>('get_image', { id: first.id, scale: 0.3 }, page.id);
    const data = out._image?.data;
    const size = data && pngSize(data);
    if (!data || !size) return;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.w} ${size.h}" preserveAspectRatio="xMidYMin slice"><image href="data:image/png;base64,${data}" width="${size.w}" height="${size.h}"/></svg>`;
    await putThumb(file, svg);
  } catch { /* sem miniatura: a tela inicial mostra um ícone no lugar */ }
}
