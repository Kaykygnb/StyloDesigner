// Páginas e árvore de camadas. Reordenar e mover = a ferramenta move_layer; renomear = update_layer; esconder = update_layer {visible}.
import { useEffect, useMemo, useRef, useState } from 'react';
import { addPage, canEdit, removePage, rename, renamePage, setProps } from '../lib/actions';
import { run, select, setPage, useApp, hoverLayer } from '../lib/app';
import { findNode, pageOf, parentOf, TYPE_LABEL } from '../lib/doc';
import type { LayerNode } from '../lib/types';
import { Icon } from '../ui/Icon';

type Zone = 'before' | 'after' | 'inside';
interface Row { node: LayerNode; depth: number; hasKids: boolean }

const isContainer = (n: LayerNode) => n.type === 'frame' || n.type === 'group' || n.type === 'section';
/** Camadas livres empilham (a última fica por cima): a lista mostra a de cima primeiro. Em layout automático a ordem é a do layout. */
const reversedIn = (parent: LayerNode | null | undefined) => (parent?.layout?.mode ?? 'none') === 'none';
const displayOrder = (list: LayerNode[], parent: LayerNode | null | undefined) => (reversedIn(parent) ? [...list].reverse() : list);

function flatten(list: LayerNode[], parent: LayerNode | null, depth: number, collapsed: Record<string, boolean>, out: Row[] = []): Row[] {
  for (const node of displayOrder(list, parent)) {
    const hasKids = !!node.children?.length;
    out.push({ node, depth, hasKids });
    if (hasKids && !collapsed[node.id]) flatten(node.children!, node, depth + 1, collapsed, out);
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

export function LayersPanel() {
  const doc = useApp((s) => s.doc)!;
  const pageId = useApp((s) => s.pageId);
  const selection = useApp((s) => s.selection);
  const hover = useApp((s) => s.hover);
  const page = pageOf(doc, pageId);
  const editable = canEdit();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hint, setHint] = useState<{ id: string; zone: Zone } | null>(null);
  const list = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => flatten(page.children, null, 0, collapsed), [page, collapsed]);

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
    await run('move_layer', { id, ...(t.parentId ? { parent_id: t.parentId } : {}), index: t.index });
  };

  return (
    <aside className="left-panel" aria-label="Páginas e camadas">
      <div className="panel-head">
        <h3>Páginas</h3>
        <span className="spacer" />
        <button className="btn ghost icon sm" title="Nova página" disabled={!editable} onClick={() => void addPage()}><Icon name="plus" size={15} /></button>
      </div>
      <div className="pages">
        {doc.pages.map((p) => (
          <div key={p.id} className={`page-row${p.id === page.id ? ' on' : ''}`} onClick={() => setPage(p.id)} onDoubleClick={() => editable && setEditingPage(p.id)}>
            {editingPage === p.id ? (
              <input autoFocus className="inline-edit" defaultValue={p.name} onClick={(e) => e.stopPropagation()}
                onBlur={(e) => { setEditingPage(null); if (e.target.value.trim() && e.target.value !== p.name) void renamePage(p.id, e.target.value); }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingPage(null); }} />
            ) : <span className="ellipsis">{p.name}</span>}
            {doc.pages.length > 1 && editable && p.id === page.id && (
              <button className="btn ghost icon sm danger" title="Apagar página" onClick={(e) => { e.stopPropagation(); if (confirm(`Apagar a página “${p.name}” e tudo que há nela?`)) void removePage(p.id); }}><Icon name="trash" size={14} /></button>
            )}
          </div>
        ))}
      </div>

      <div className="panel-head">
        <h3>Camadas</h3>
        <span className="spacer" />
        <span className="faint">{rows.length}</span>
      </div>
      <div className="layers" ref={list} onMouseLeave={() => hoverLayer(null)}>
        {rows.map(({ node, depth, hasKids }) => {
          const on = selection.includes(node.id);
          const dropping = hint?.id === node.id ? hint.zone : null;
          return (
            <div
              key={node.id} data-id={node.id}
              className={`layer-row${on ? ' on' : ''}${hover === node.id ? ' hover' : ''}${node.visible === false ? ' hidden' : ''}${dropping ? ` drop-${dropping}` : ''}${dragId === node.id ? ' dragging' : ''}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              draggable={editable && !node.locked && editing !== node.id}
              onDragStart={(e) => { setDragId(node.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', node.id); }}
              onDragEnd={() => { setDragId(null); setHint(null); }}
              onDragOver={(e) => { if (!dragId) return; const z = zoneOf(e, node); if (dropTarget(page.children, dragId, node.id, z)) { e.preventDefault(); if (hint?.id !== node.id || hint.zone !== z) setHint({ id: node.id, zone: z }); } }}
              onDrop={(e) => { e.preventDefault(); void onDrop(node.id, zoneOf(e, node)); }}
              onClick={(e) => select(e.shiftKey || e.ctrlKey || e.metaKey ? (on ? selection.filter((x) => x !== node.id) : [...selection, node.id]) : [node.id])}
              onMouseEnter={() => hoverLayer(node.id)}
              onDoubleClick={() => editable && setEditing(node.id)}
            >
              <span className="twisty" onClick={(e) => { e.stopPropagation(); if (hasKids) setCollapsed({ ...collapsed, [node.id]: !collapsed[node.id] }); }}>
                {hasKids && <Icon name={collapsed[node.id] ? 'chevron' : 'chevrondown'} size={13} />}
              </span>
              <span className="layer-icon"><Icon name={({ frame: 'frame', text: 'text', rect: 'rect', ellipse: 'ellipse', line: 'line', group: 'group', media: 'image', section: 'layers' } as Record<string, string>)[node.type] ?? 'rect'} size={14} /></span>
              {editing === node.id ? (
                <input autoFocus className="inline-edit" defaultValue={node.name} onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => { setEditing(null); if (e.target.value.trim() && e.target.value !== node.name) void rename(node.id, e.target.value); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(null); }} />
              ) : <span className="layer-name ellipsis" title={`${TYPE_LABEL[node.type] ?? node.type}: ${node.name}`}>{node.name}</span>}
              {node.locked && <span className="faint"><Icon name="lock" size={12} /></span>}
              {editable && (
                <button className="btn ghost icon sm vis" title={node.visible === false ? 'Mostrar' : 'Esconder'} onClick={(e) => { e.stopPropagation(); void setProps([node.id], { visible: node.visible === false }); }}>
                  <Icon name={node.visible === false ? 'eyeoff' : 'eye'} size={14} />
                </button>
              )}
            </div>
          );
        })}
        {!rows.length && <p className="muted pad">Nenhuma camada nesta página.</p>}
      </div>
    </aside>
  );
}

