// MEDIDA DE VOLTA no servidor. No editor, quem sabe a altura de uma camada "hug" (do tamanho do conteúdo) ou "fill" é o
// navegador; aqui o renderizador (Chromium) mede e este módulo grava o resultado em node.w/h, com a MESMA regra do
// editor (apps/web/src/canvas.js → measureBack). É dado derivado: não cria passo no histórico.

export type Sizes = Map<string, { w: number; h: number }>;

const round = (n: number) => Math.round(n * 100) / 100;

/** As "pranchetas" da página: camadas da raiz; dentro de uma seção, os filhos dela. */
export const rootsOf = (children: any[]): any[] => children.flatMap((n) => (n.type === 'section' ? n.children || [] : [n]));

/** Grava as medidas nas camadas que não têm tamanho fixo, estão em auto layout ou têm limites. Devolve quantas mudaram. */
export function applyMeasured(list: any[], parent: any | null, sizes: Sizes): number {
  const flow = (parent?.layout?.mode ?? 'none') !== 'none';
  let changed = 0;
  for (const n of list) {
    const m = sizes.get(n.id);
    if (m && n.visible !== false) {
      const limited = n.minW > 0 || n.maxW > 0 || n.minH > 0 || n.maxH > 0 || n.aspect > 0;
      if ((n.sizeX !== 'fixed' || flow || limited) && Math.abs(m.w - n.w) > 0.01) { n.w = round(m.w); changed++; }
      if ((n.sizeY !== 'fixed' || flow || limited) && Math.abs(m.h - n.h) > 0.01) { n.h = round(m.h); changed++; }
    }
    if (n.children) changed += applyMeasured(n.children, n, sizes);
  }
  return changed;
}
