import { textStyleFrom } from './components.js';

/** Regras extras puras: uso sugerido apenas quando checks inclui styles/touch. */
export interface ExpandedIssue {
  severity: 'erro' | 'aviso';
  type: 'estilo-inexistente' | 'estilo-sem-vinculo' | 'alvo-pequeno';
  layerId: string; layerName: string; where?: string; message: string; fix: string;
}
type Node = Record<string, any>;
export interface MeasuredRow {
  id: string; tag?: string; rendered: boolean; visible: boolean;
  box: { x: number; y: number; w: number; h: number } | null;
}
const colorKey = (value: unknown) => String(value ?? '').trim().toUpperCase();

/** Valida referências explícitas em todas as variantes; sugere vínculos só na base visível. */
export function auditStyles(roots: Node[], doc: Node): ExpandedIssue[] {
  const styles = doc.styles || {};
  const out: ExpandedIssue[] = [];
  const tables: Record<string, Node[]> = { styleId: styles.colors || [], gradientId: styles.gradients || [], textStyleId: styles.texts || [], effectStyleId: styles.effects || [] };
  function variant(node: Node, props: Node, where: string) {
    const refs: Array<[string, unknown]> = [['styleId', props.fill?.styleId], ['gradientId', props.fill?.gradientId], ['textStyleId', props.textStyleId], ['effectStyleId', props.effectStyleId]];
    for (const [kind, id] of refs) if (id && !tables[kind].some(style => style.id === id)) {
      out.push({ severity: 'aviso', type: 'estilo-inexistente', layerId: node.id, layerName: node.name, where,
        message: `“${node.name}” referencia um estilo inexistente (${kind}: ${id}) em ${where}.`,
        fix: 'Consulte os estilos em list_design_resources e corrija o vínculo nesta variante, ou remova o vínculo mantendo valores explícitos.' });
    }
  }
  function walk(node: Node, visible: boolean) {
    const shown = visible && node.visible !== false;
    variant(node, node, 'base');
    for (const [id, props] of Object.entries(node.bps || {})) variant(node, props as Node, `breakpoint ${id}`);
    for (const [state, props] of Object.entries(node.states || {})) variant(node, props as Node, `estado ${state}`);
    if (shown && node.fill?.type === 'solid' && !node.fill.styleId) {
      const match = tables.styleId.find(style => colorKey(style.color) === colorKey(node.fill.color) && (style.opacity ?? 1) === (node.fill.opacity ?? 1));
      if (match) out.push({ severity: 'aviso', type: 'estilo-sem-vinculo', layerId: node.id, layerName: node.name, where: 'base',
        message: `“${node.name}” usa a cor de “${match.name}” sem vínculo; mudanças na paleta não acompanharão esta camada.`,
        fix: `Se a cor deve seguir a paleta, use update_layer com fill:{styleId:"${match.id}"}. Se é uma exceção intencional, mantenha como está.` });
    }
    if (shown && node.type === 'text' && !node.textStyleId) {
      const match = tables.textStyleId.find(style => {
        const keys = Object.keys(textStyleFrom(style)).filter(key => style[key] !== undefined);
        return keys.length > 0 && keys.every(key => node[key] === style[key]);
      });
      if (match) out.push({ severity: 'aviso', type: 'estilo-sem-vinculo', layerId: node.id, layerName: node.name, where: 'base',
        message: `“${node.name}” corresponde ao estilo de texto “${match.name}” sem vínculo.`,
        fix: `Se deve acompanhar o estilo, use apply_text_style com ids:["${node.id}"] e style_id:"${match.id}". Uma exceção intencional pode permanecer.` });
    }
    for (const child of node.children || []) walk(child, shown);
  }
  for (const root of roots) walk(root, true);
  return out;
}

/** Mede o alvo efetivo, nunca w/h base. mobile é definido pelo chamador, não inferido do nome. */
export function auditTouch(rows: MeasuredRow[], find: (id: string) => Node | undefined, context: { label: string; mobile: boolean }): ExpandedIssue[] {
  const minimum = context.mobile ? 44 : 24;
  return rows.flatMap(row => {
    const node = find(row.id);
    if (!node || !['a', 'button'].includes(row.tag ?? node.tag) || !row.rendered || !row.visible) return [];
    if (!row.box) throw new Error('Medição de alvo visível sem caixa.');
    const { w, h } = row.box;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 0 || h < 0) throw new Error('Dimensões inválidas na medição do alvo.');
    if (w >= minimum && h >= minimum) return [];
    return [{ severity: 'aviso' as const, type: 'alvo-pequeno' as const, layerId: node.id, layerName: node.name, where: context.label,
      message: `“${node.name}” tem área clicável medida de ${Math.round(w)}×${Math.round(h)}px em ${context.label}; recomendamos ${minimum}×${minimum}px.`,
      fix: 'Aumente padding ou o tamanho nesta largura. É uma recomendação geométrica: espaçamento entre alvos e exceções de links no texto não foram avaliados.' }];
  });
}

/** Contagens sempre totais; não permite página vazia fingindo que não há problemas. */
export function expandedReport<T extends { severity: 'erro' | 'aviso' }>(issues: T[], options: { offset?: number; limit?: number; maxBytes?: number } = {}) {
  const { offset = 0, limit = 60, maxBytes = 8192 } = options;
  if (!Number.isInteger(offset) || offset < 0 || (issues.length > 0 && offset >= issues.length)) throw new Error('offset fora do relatório; recomece com offset:0 após alterações.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 60 || !Number.isInteger(maxBytes) || maxBytes < 1024 || maxBytes > 65536) throw new Error('Use limit de 1 a 60 e maxBytes de 1024 a 65536.');
  const sorted = [...issues].sort((a, b) => a.severity === b.severity ? 0 : a.severity === 'erro' ? -1 : 1);
  const result = { errors: issues.filter(i => i.severity === 'erro').length, warnings: issues.filter(i => i.severity === 'aviso').length,
    issues: sorted.slice(offset, offset + limit), total: issues.length, count: 0, offset, nextOffset: null as number | null, truncated: false };
  function refresh() { result.count = result.issues.length; result.nextOffset = offset + result.count < result.total ? offset + result.count : null; result.truncated = offset > 0 || result.nextOffset !== null; }
  refresh();
  while (new TextEncoder().encode(JSON.stringify(result, null, 2)).length > maxBytes && result.issues.length) { result.issues.pop(); refresh(); }
  if (new TextEncoder().encode(JSON.stringify(result, null, 2)).length > maxBytes || (issues.length && !result.issues.length)) throw new Error('Um problema não cabe no limite de resposta; aumente maxBytes ou reduza o escopo com id.');
  return result;
}
