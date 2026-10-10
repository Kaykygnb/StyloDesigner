/**
 * Inventário leve das imagens que já pertencem ao projeto.
 * O arquivo de imagem continua em `doc.assets`; este módulo só deriva informação útil para a UI e o MCP.
 */
import { walk } from './model.js';

export function imageAssetCatalog(doc) {
  const refs = new Map();
  for (const page of doc.pages || []) {
    walk(page.children || [], (node) => {
      const id = node.fill?.type === 'image' ? node.fill.assetId : null;
      if (!id || !doc.assets?.[id]) return;
      const list = refs.get(id) || [];
      list.push({ layer: node.name || 'Imagem', page: page.name || 'Página', w: node.fill.natW || null, h: node.fill.natH || null });
      refs.set(id, list);
    });
  }

  return Object.entries(doc.assets || {})
    .filter(([, src]) => typeof src === 'string' && src.startsWith('data:image/'))
    .map(([id, src], i) => {
      const usedBy = refs.get(id) || [];
      const format = /^data:image\/([\w.+-]+)/i.exec(src)?.[1]?.toLowerCase() || 'image';
      const bytes = src.startsWith('data:image/svg+xml') ? src.length : Math.max(0, (src.length - (src.indexOf(',') + 1)) * 0.75);
      return {
        id,
        name: usedBy[0]?.layer || `Imagem ${i + 1}`,
        format,
        kb: Math.max(1, Math.round(bytes / 1024)),
        width: usedBy.find((x) => x.w)?.w || null,
        height: usedBy.find((x) => x.h)?.h || null,
        usageCount: usedBy.length,
        usedBy: usedBy.slice(0, 8),
      };
    });
}
