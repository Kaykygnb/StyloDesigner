/** Auditoria com regras extras opt-in e resultado paginado, sem confundir ausência de medidas com sucesso. */
import { BREAKPOINTS, walk } from '../../model.js';
import { auditStatic, overflowIssues, type Issue } from '../../audit.ts';
import { auditStyles, auditTouch, expandedReport } from '../../audit-expanded.ts';
import { boundPagedItems, shortName } from './response-budget.ts';
import type { RunnerContext, ToolArgs } from './types.ts';

export function boundAuditResponse(result: ToolArgs, maxBytes = 8192) {
  const out = boundPagedItems(result, maxBytes, 'Um problema não cabe no limite de resposta. Aumente maxBytes até 65536 ou limite a uma tela com id.', 'issues');
  out.truncated = out.offset > 0 || out.hasMore;
  return out;
}
export async function checkDesign(ctx: RunnerContext, { id, breakpoints, checks = [], limit = 20, offset = 0, maxBytes = 8192, maxTargets = 200 }: ToolArgs = {}) {
  const { store, need, auditLayout, inspectLayout } = ctx;
  const original = id ? [need(id)] : store.page().children.flatMap(n => n.type === 'section' ? n.children : [n]).filter(n => n.type === 'frame' && n.visible !== false);
  if (!original.length) throw new Error('Não há telas para conferir nesta página (crie um frame na raiz).');
  const wantTouch = checks.includes('touch');
  if (wantTouch && original.some(n => n.type !== 'frame' || (store.parentOf(n.id) && (store.parentOf(n.id).type !== 'section' || store.parentOf(store.parentOf(n.id).id))))) throw new Error('Para conferir área clicável por largura, id deve identificar uma tela frame raiz ou dentro de uma seção raiz. Use find_layers para localizar a tela.');
  const source = store.state.doc;
  const doc = { ...source, styles: structuredClone(source.styles), fonts: structuredClone(source.fonts), assets: { ...source.assets } };
  const boards = structuredClone(original);
  const all = source.breakpoints?.length ? structuredClone(source.breakpoints) : BREAKPOINTS.map(b => ({ ...b }));
  const chosen = breakpoints?.length ? breakpoints.map(b => all.find(x => x.id === b) || (() => { throw new Error(`Breakpoint "${b}" não existe. Disponíveis: ${all.map(x => x.id).join(', ')}.`); })()) : all;
  const byId = new Map<string, any>();
  for (const board of boards) walk([board], n => { byId.set(n.id, n); });
  const issues: Issue[] = auditStatic(boards).filter(issue => !wantTouch || issue.type !== 'alvo-pequeno');
  if (checks.includes('styles')) issues.push(...auditStyles(boards, doc));
  const widths = boards.flatMap(board => [{ rootId: board.id, label: `desktop (${Math.round(board.w)}px)`, width: Math.round(board.w) }, ...chosen.map(bp => ({ rootId: board.id, label: `${bp.name.toLowerCase()} (${bp.preview}px)`, width: bp.preview }))]);
  const notes: string[] = [];
  let overflowChecked = false, touchChecked = false;
  if (auditLayout) {
    try { issues.push(...overflowIssues(await auditLayout(boards, doc, widths), nid => byId.get(nid))); overflowChecked = true; }
    catch { notes.push('Vazamento horizontal NÃO foi conferido: a medição falhou.'); }
  } else notes.push('Vazamento horizontal NÃO foi conferido: sem navegador de medição.');
  if (wantTouch) {
    const targets = boards.flatMap(board => {
      const ids: string[] = []; walk([board], n => { if (['a','button'].includes(n.tag)) ids.push(n.id); });
      return ids.map(targetId => ({ rootId: board.id, id: targetId }));
    });
    if (targets.length > maxTargets) notes.push(`Área clicável NÃO foi conferida: ${targets.length} alvos excedem maxTargets:${maxTargets}. Restrinja id a uma tela ou aumente maxTargets até 1000.`);
    else if (!inspectLayout) notes.push('Área clicável NÃO foi conferida: sem Chromium de inspeção.');
    else {
      const measuredIssues: Issue[] = [];
      try {
        for (const viewport of widths) {
          const root = boards.find(board => board.id === viewport.rootId);
          const ids = targets.filter(target => target.rootId === root.id).map(target => target.id);
          const opaqueIds: string[] = []; walk([root], n => { if (['html','path','media'].includes(n.type)) opaqueIds.push(n.id); });
          for (let start = 0; start < ids.length; start += 100) {
            const expected = ids.slice(start, start + 100);
            const measured = await inspectLayout(root, doc, { width: viewport.width, ids: expected, opaqueIds });
            if (expected.some(nid => !measured.layers.some(row => row.id === nid))) throw new Error('Medição incompleta.');
            measuredIssues.push(...auditTouch(measured.layers, nid => byId.get(nid), { label: viewport.label, mobile: viewport.width <= 640 }));
          }
        }
        issues.push(...measuredIssues); touchChecked = true;
      } catch { notes.push('Área clicável NÃO foi conferida completamente: a medição falhou; medidas parciais foram descartadas.'); }
    }
    notes.push('Área clicável é recomendação geométrica: 44px até640px de largura,24px acima. Exceções, espaçamento entre alvos, recorte/oclusão e controles internos de HTML manual não foram avaliados.');
  }
  const report = expandedReport(issues, { limit, offset, maxBytes });
  const labels = [...new Set(widths.map(w => w.label))];
  const complete = overflowChecked && (!wantTouch || touchChecked);
  return boundAuditResponse({
    screens: boards.slice(0,20).map(board => shortName(board.name,80)), screenCount: boards.length,
    widths: labels.slice(0,20), widthCount: labels.length,
    ...report, hasMore: report.nextOffset !== null,
    checked: { static: true, overflow: overflowChecked, styles: checks.includes('styles'), touch: wantTouch && touchChecked },
    ...(notes.length ? { note: notes.join(' ') } : {}),
    ...(issues.length === 0 && complete ? { ok: 'Nenhum problema encontrado nas regras conferidas.' } : {}),
  }, maxBytes);
}
