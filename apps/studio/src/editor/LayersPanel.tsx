// Páginas e árvore de camadas (aba Camadas). Reordenar e mover = move_layer; renomear = update_layer; esconder/travar = update_layer.
// Botão direito = o mesmo menu do canvas; busca filtra pelo nome; Shift/Ctrl+clique seleciona vários.
import { useEffect, useMemo, useRef, useState } from 'react';
import { addPage, canEdit, removePage, rename, renamePage } from '../lib/actions';
import { toggleFlag } from '../lib/editing';
import { app, run, select, setPage, useApp, hoverLayer } from '../lib/app';
import { findNode, flatten as flatList, pageOf, parentOf, TYPE_LABEL } from '../lib/doc';
import type { LayerNode } from '../lib/types';
import { confirmDialog } from '../ui/Dialog';
import { showMenu } from '../ui/ContextMenu';
import { Icon } from '../ui/Icon';
import { layerMenuItems } from './menus';
import { NODE_ICON } from './inspector/Header';

type Zone = 'before' | 'after' | 'inside';
interface Row { node: LayerNode; depth: number; hasKids: boolean }

const isContainer = (n: LayerNode) => n.type === 'frame' || n.type === 'group' || n.type === 'section';
/** Camadas livres empilham (a última fica por cima): a lista mostra a de cima primeiro. Em layout automático a ordem é a do layout. */
const reversedIn = (parent: LayerNode | null | undefined) => (parent?.layout?.mode ?? 'none') === 'none';
const displayOrder = (list: LayerNode[], parent: LayerNode | null | undefined) => (reversedIn(parent) ? [...list].reverse() : list);

function flatten(list: LayerNode[], parent: LayerNode | null, depth: number, collapsed: Record<string, boolean>, out: Row[] = [], force = false): Row[] {
  for (const node of displayOrder(list, parent)) {
    const hasKids = !!node.children?.length;
    out.push({ node, depth, hasKids });
    if (hasKids && (force || !collapsed[node.id])) flatten(node.children!, node, depth + 1, collapsed, out, force);
  }
  return out;
}

/** Onde cada zona de soltura leva: pai e posição no array (já considerando a camada arrastada fora da lista). */
function dropTarget(root: LayerNode[], dragId: string, targetId: string, zone: Zone): { parentId: string | null; index: number } | null {
  const drag = findNode(root, dragId);
  const target = findNode(root, targetId);
  if (!drag || !target || dragId === targetId || findNode(drag.children ?? [], targetId)) return null;
  if (zone === 'inside') {
    if (!isContainer(target)) return null;
    const already = (target.children ?? []).some((c) => c.id === dragId);
    return { parentId: target.id, index: (target.children?.length ?? 0) - (already ? 1 : 0) };
  }
  const parent = parentOf(root, targetId) ?? null;
  const siblings = parent ? parent.children ?? [] : root;
  const display = displayOrder(siblings, parent).filter((n) => n.id !== dragId);
  const at = display.findIndex((n) => n.id === targetId);
  const insert = zone === 'before' ? at : at + 1;
  return { parentId: parent?.id ?? null, index: reversedIn(parent) ? display.length - insert : insert };
}

export function LayersTab() {
  const doc = useApp((s) => s.doc)!;
  const pageId = useApp((s) => s.pageId);
  const selection = useApp((s) => s.selection);
  const hover = useApp((s) => s.hover);
  const renaming = useApp((s) => s.renaming);
  const page = pageOf(doc, pageId);
  const editable = canEdit();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hint, setHint] = useState<{ id: string; zone: Zone } | null>(null);
  const [q, setQ] = useState('');
  const anchor = useRef<string | null>(null);
  const list = useRef<HTMLDivElement>(null);

  const term = q.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!term) return flatten(page.children, null, 0, collapsed);
    // com busca: mostra as camadas que combinam, com os pais delas (para dar contexto), tudo aberto
    const all = flatten(page.children, null, 0, collapsed, [], true);
    const hit = new Set<string>();
    for (const r of all) {
      if (r.node.name.toLowerCase().includes(term) || (r.node.type === 'text' && String(r.node.text ?? '').toLowerCase().includes(term))) {
        hit.add(r.node.id);
        for (let p = parentOf(page.children, r.node.id); p; p = parentOf(page.children, p.id)) hit.add(p.id);
      }
    }
    return all.filter((r) => hit.has(r.node.id));
  }, [page, collapsed, term]);

  // mantém a camada selecionada à vista
  useEffect(() => {
    if (selection.length !== 1) return;
    list.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(selection[0])}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selection]);

  // abre os pais de uma camada selecionada
  useEffect(() => {
    if (selection.length !== 1) return;
    let changed = false;
    const next = { ...collapsed };
    for (let p = parentOf(page.children, selection[0]); p; p = parentOf(page.children, p.id)) if (next[p.id]) { next[p.id] = false; changed = true; }
    if (changed) setCollapsed(next);
  }, [selection]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoneOf = (e: React.DragEvent, node: LayerNode): Zone => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const f = (e.clientY - r.top) / r.height;
    if (isContainer(node) && f > 0.28 && f < 0.72) return 'inside';
    return f < 0.5 ? 'before' : 'after';
  };

  const onDrop = async (targetId: string, zone: Zone) => {
    const id = dragId;
    setDragId(null); setHint(null);
    if (!id) return;
    const t = dropTarget(page.children, id, targetId, zone);
    if (!t) return;
    await run('move_layers', { moves: [{ id, parent_id: t.parentId ?? 'root', index: t.index }] });
  };

  const pick = (e: React.MouseEvent, node: LayerNode) => {
    if (e.shiftKey && anchor.current) {
      const ids = rows.map((r) => r.node.id);
      const a = ids.indexOf(anchor.current), b = ids.indexOf(node.id);
      if (a >= 0 && b >= 0) { select(ids.slice(Math.min(a, b), Math.max(a, b) + 1)); return; }
    }
    if (e.ctrlKey || e.metaKey) { select(selection.includes(node.id) ? selection.filter((x) => x !== node.id) : [...selection, node.id]); anchor.current = node.id; return; }
    anchor.current = node.id;
    select([node.id]);
  };

  const total = useMemo(() => flatList(page.children).length, [page]);

  return (
    <div className="tab-body layers-tab">
      <div className="panel-head">
        <h3>Páginas</h3>
        <span className="spacer" />
        <button className="btn ghost icon sm" title="Nova página" disabled={!editable} onClick={() => void addPage()}><Icon name="plus" size={15} /></button>
      </div>
      <div className="pages">
        {doc.pages.map((p) => (
          <div key={p.id} className={`page-row${p.id === page.id ? ' on' : ''}`} onClick={() => setPage(p.id)} onDoubleClick={() => editable && setEditingPage(p.id)}>
            <Icon name="file" size={14} />
            {editingPage === p.id ? (
              <input autoFocus className="inline-edit" defaultValue={p.name} onClick={(e) => e.stopPropagation()}
                onBlur={(e) => { setEditingPage(null); if (e.target.value.trim() && e.target.value !== p.name) void renamePage(p.id, e.target.value); }}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingPage(null); }} />
            ) : <span className="ellipsis grow">{p.name}</span>}
            <span className="faint">{p.children.length}</span>
            {doc.pages.length > 1 && editable && p.id === page.id && (
              <button className="btn ghost icon sm danger" title="Apagar página" onClick={(e) => { e.stopPropagation(); void confirmDialog(`Apagar a página “${p.name}”?`, 'Tudo que há nela será apagado (dá para desfazer).', { okLabel: 'Apagar', danger: true }).then((ok) => { if (ok) void removePage(p.id); }); }}><Icon name="trash" size={14} /></button>
            )}
          </div>
        ))}
      </div>

      <div className="panel-head">
        <h3>Camadas</h3>
        <span className="spacer" />
        <span className="faint">{total}</span>
      </div>
      <div className="search-row">
        <div className="search"><Icon name="search" size={14} /><input className="field" placeholder="Buscar camadas…" aria-label="Buscar camadas" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setQ(''); }} /></div>
      </div>
      <div className="layers" ref={list} onMouseLeave={() => hoverLayer(null)}>
        {rows.map(({ node, depth, hasKids }) => {
          const on = selection.includes(node.id);
          const dropping = hint?.id === node.id ? hint.zone : null;
          const isEditing = renaming === node.id;
          const layout = node.type === 'frame' ? node.layout?.mode : null;
          return (
            <div
              key={node.id} data-id={node.id}
              className={`layer-row${on ? ' on' : ''}${hover === node.id ? ' hover' : ''}${node.visible === false ? ' hidden' : ''}${dropping ? ` drop-${dropping}` : ''}${dragId === node.id ? ' dragging' : ''}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              draggable={editable && !node.locked && !isEditing && !term}
              onDragStart={(e) => { setDragId(node.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', node.id); }}
              onDragEnd={() => { setDragId(null); setHint(null); }}
              onDragOver={(e) => { if (!dragId) return; const z = zoneOf(e, node); if (dropTarget(page.children, dragId, node.id, z)) { e.preventDefault(); if (hint?.id !== node.id || hint.zone !== z) setHint({ id: node.id, zone: z }); } }}
              onDrop={(e) => { e.preventDefault(); void onDrop(node.id, zoneOf(e, node)); }}
              onClick={(e) => pick(e, node)}
              onContextMenu={(e) => { e.preventDefault(); if (!selection.includes(node.id)) select([node.id]); showMenu(layerMenuItems(), e.clientX, e.clientY); }}
              onMouseEnter={() => hoverLayer(node.id)}
              onDoubleClick={() => editable && app.set({ renaming: node.id })}
            >
              <span className="twisty" onClick={(e) => { e.stopPropagation(); if (hasKids) setCollapsed({ ...collapsed, [node.id]: !collapsed[node.id] }); }}>
                {hasKids && <Icon name={collapsed[node.id] ? 'chevron' : 'chevrondown'} size={13} />}
              </span>
              <span className={`layer-icon${node.component || node.instanceOf ? ' comp' : ''}`}><Icon name={node.component || node.instanceOf ? 'component' : NODE_ICON[node.type] ?? 'rect'} size={14} /></span>
              {isEditing ? (
                <input autoFocus className="inline-edit" defaultValue={node.name} onFocus={(e) => e.target.select()} onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => { app.set({ renaming: null }); if (e.target.value.trim() && e.target.value !== node.name) void rename(node.id, e.target.value); }}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { app.set({ renaming: null }); } }} />
              ) : <span className="layer-name ellipsis" title={`${TYPE_LABEL[node.type] ?? node.type}: ${node.name}`}>{node.name}</span>}
              {node.note && <span className="note-dot" title="Esta camada tem nota" />}
              {layout && layout !== 'none' && <span className="layout-chip">{layout === 'grid' ? 'grid' : 'flex'}</span>}
              {editable && (
                <>
                  <button className={`btn ghost icon sm vis${node.locked ? ' shown' : ''}`} title={node.locked ? 'Destravar' : 'Travar'} onClick={(e) => { e.stopPropagation(); select([node.id]); void toggleFlag('locked'); }}><Icon name={node.locked ? 'lock' : 'unlock'} size={13} /></button>
                  <button className={`btn ghost icon sm vis${node.visible === false ? ' shown' : ''}`} title={node.visible === false ? 'Mostrar' : 'Esconder'} onClick={(e) => { e.stopPropagation(); select([node.id]); void toggleFlag('visible'); }}><Icon name={node.visible === false ? 'eyeoff' : 'eye'} size={13} /></button>
                </>
              )}
            </div>
          );
        })}
        {!rows.length && <p className="muted pad">{term ? 'Nenhuma camada com esse nome.' : 'Nenhuma camada nesta página.'}</p>}
      </div>
    </div>
  );
}
