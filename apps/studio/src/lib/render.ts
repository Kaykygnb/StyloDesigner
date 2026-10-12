// Desenha uma tela do projeto: o MESMO HTML/CSS que a exportação gera (@stylo/core), então o que se vê é o que sai no site.
import { exportHtml } from '@stylo/core/css.js';
import { inlineFontFaces } from '@stylo/core/site-export.ts';
import type { Doc, LayerNode } from './types';

/** Documento HTML completo de uma tela, pronto para um iframe. Cada elemento leva data-node-id para a seleção. */
export function boardHtml(board: LayerNode, doc: Doc): string {
  const selfHosted = new Set(((doc as any).fonts || []).map((f: { family: string }) => f.family));
  const html: string = exportHtml(board, doc.assets || {}, board.name, doc.styles as any, { ids: true, selfHosted } as any);
  const faces = inlineFontFaces(doc);
  // o painel mostra só a tela: sem rolagem, fundo transparente (o fundo é o da própria tela) e sem o espaço mínimo do body
  const extra = `<style>${faces}\nhtml{overflow:hidden}body{min-height:0!important;background:transparent!important}a{pointer-events:auto}</style>`;
  return html.replace('</head>', `${extra}</head>`);
}
