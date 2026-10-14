// Barra flutuante de ferramentas: mover, mão e as formas que se desenham no canvas. Cada uma cria a camada com create_layer.
import { useEffect, useRef, useState } from 'react';
import { canEdit, uploadImage } from '../lib/actions';
import { run, setTool, toast, useApp, type Tool } from '../lib/app';
import { t } from '../lib/i18n';
import { findNode, pageOf } from '../lib/doc';
import { arrange, commentOn } from '../lib/editing';
import { Icon } from '../ui/Icon';

type ToolDef = { tool: Tool; icon: string; key: string };
type Slot = ToolDef | ToolDef[] | 'sep' | 'image';
const T = (tool: Tool, icon: string, key = ''): ToolDef => ({ tool, icon, key });
// Ferramentas parecidas ficam juntas num botão só (com a setinha para trocar): menos ícones na tela, mesmo poder.
const SLOTS: Slot[] = [
  T('move', 'cursor', 'V'), T('hand', 'hand', 'H'),
  'sep',
  [T('frame', 'frame', 'F'), T('section', 'section', '⇧S')],
  [T('rect', 'rect', 'R'), T('ellipse', 'ellipse', 'E'), T('line', 'line', 'L'), T('polygon', 'polygon'), T('star', 'star')],
  T('text', 'text', 'T'),
  [T('pen', 'pen', 'P'), T('pencil', 'pencil')],
  'image',
  'sep',
  T('comment', 'comment', 'C'), T('inspect', 'inspect', 'I'),
];
const READ_ONLY_OK = new Set<Tool>(['move', 'hand', 'inspect']);

export function Toolbar() {
  const tool = useApp((s) => s.tool);
  const selection = useApp((s) => s.selection);
  const doc = useApp((s) => s.doc);
  const pageId = useApp((s) => s.pageId);
  const language = useApp((s) => s.language);
  const file = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<Tool | null>(null);
  // última ferramenta usada em cada grupo (a forma que aparece no botão)
  const [lastOf, setLastOf] = useState<Partial<Record<Tool, Tool>>>({});
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    const away = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.('.tb-slot')) setOpen(null); };
    document.addEventListener('keydown', esc); document.addEventListener('mousedown', away);
    return () => { document.removeEventListener('keydown', esc); document.removeEventListener('mousedown', away); };
  }, [open]);
  const pick = (next: Tool, groupKey: Tool) => {
    setLastOf((m) => ({ ...m, [groupKey]: next }));
    if (next === 'comment' && selection.length === 1) commentOn(selection[0]);
    else setTool(next);
  };
  const editable = canEdit();
  const selectedNodes = doc && pageId ? selection.map((id) => findNode(pageOf(doc, pageId).children, id)).filter(Boolean) : [];
  const booleanSupported = selectedNodes.length >= 2 && selectedNodes.every((node) => node && ['path', 'rect', 'ellipse', 'frame'].includes(node.type) && !(node.type === 'frame' && node.children?.length));
  const booleanActions: Array<['boolean_union' | 'boolean_subtract' | 'boolean_intersect' | 'boolean_exclude', string, string]> = [
    ['boolean_union', '∪', 'inspector.boolean.union'], ['boolean_subtract', '−', 'inspector.boolean.subtract'],
    ['boolean_intersect', '∩', 'inspector.boolean.intersect'], ['boolean_exclude', '⊕', 'inspector.boolean.exclude'],
  ];
  const paths = selectedNodes.filter((node) => node?.type === 'path');
  const vectorActions: [string, string, () => Promise<unknown>][] = paths.length === 1 ? [
    ['rotate', t(language, 'ui.toolbar.reversePath'), () => run('reverse_vector', { id: paths[0]!.id })],
    ['spark', t(language, 'ui.toolbar.simplify'), () => run('simplify_vector', { id: paths[0]!.id, tolerance: 1 })],
    ['corner', t(language, 'ui.toolbar.roundCorners'), () => run('set_path_effect', { id: paths[0]!.id, kind: 'round-corners', radius: 8 })],
    ['pen', t(language, 'ui.toolbar.strokeToPath'), () => run('stroke_to_path', { id: paths[0]!.id })],
  ] : [];
  const twoPaths = paths.length === 2 ? [
    ['component', t(language, 'ui.toolbar.interpolate'), () => run('interpolate_vectors', { from_id: paths[0]!.id, to_id: paths[1]!.id, t: 0.5 })] as [string, string, () => Promise<unknown>],
  ] : [];
  return (
    <>
    {(selection.length >= 2 || paths.length === 1) && <div className="toolbar context-bar" role="toolbar" aria-label={t(language, 'ui.toolbar.selectionActions')}>
      {selection.length >= 2 && <>
        <span className="tb-context" aria-label={t(language, 'inspector.boolean.title')}>
          <span className="tb-context-label">{t(language, 'ui.toolbar.combine')}</span>
          {twoPaths.map(([icon, label, go]) => <button key={label} className="tb-btn tb-action" disabled={!editable} title={label} aria-label={label} onClick={() => { void go().catch((e) => toast('error', e instanceof Error ? e.message : String(e))); }}><Icon name={icon} size={15} /></button>)}
          {booleanActions.map(([action, symbol, label]) => <button key={action} className="tb-btn tb-action" disabled={!editable || !booleanSupported} title={t(language, label)} aria-label={t(language, label)} onClick={() => void arrange(action)}><span aria-hidden="true">{symbol}</span></button>)}
        </span>
      </>}
      {paths.length === 1 && <>
        <span className="tb-context" aria-label={t(language, 'ui.toolbar.vectorTools')}>
          <span className="tb-context-label">{t(language, 'inspector.vector.title')}</span>
          <button className={`tb-btn tb-action${tool === 'node' ? ' on' : ''}`} title={t(language, 'tool.node')} aria-label={t(language, 'tool.node')} onClick={() => setTool('node')}><Icon name="node" size={16} /></button>
          {vectorActions.map(([icon, label, go]) => <button key={label} className="tb-btn tb-action" disabled={!editable} title={label} aria-label={label} onClick={() => { void go().catch((e) => toast('error', e instanceof Error ? e.message : String(e))); }}><Icon name={icon} size={15} /></button>)}
        </span>
      </>}
    </div>}
    <div className="toolbar insert-bar" role="toolbar" aria-label={t(language, 'ui.toolbar.tools')}>
      {SLOTS.map((slot, i) => {
        if (slot === 'sep') return <span key={i} className="tb-sep" />;
        if (slot === 'image') return <button key={i} className="tb-btn" disabled={!editable} title={t(language, 'tool.image')} aria-label={t(language, 'tool.image')} onClick={() => file.current?.click()}><Icon name="image" size={18} /></button>;
        const group = Array.isArray(slot) ? slot : [slot];
        const current = group.find((x) => x.tool === tool) ?? group.find((x) => x.tool === lastOf[group[0].tool]) ?? group[0];
        const on = group.some((x) => x.tool === tool);
        const disabled = !editable && !READ_ONLY_OK.has(current.tool);
        return (
          <span key={i} className={`tb-slot${group.length > 1 ? ' has-more' : ''}`}>
            <button className={`tb-btn${on ? ' on' : ''}`} aria-pressed={on} disabled={disabled}
              title={`${t(language, `tool.${current.tool}`)}${current.key ? ` (${current.key})` : ''}`} aria-label={t(language, `tool.${current.tool}`)}
              onClick={() => pick(current.tool, group[0].tool)}>
              <Icon name={current.icon} size={18} />
            </button>
            {group.length > 1 && (
              <button className={`tb-more${open === group[0].tool ? ' open' : ''}`} disabled={!editable} aria-haspopup="menu" aria-expanded={open === group[0].tool}
                aria-label={t(language, 'ui.toolbar.moreTools', { tool: t(language, `tool.${group[0].tool}`) })}
                onClick={() => setOpen(open === group[0].tool ? null : group[0].tool)}>
                <Icon name="chevrondown" size={10} />
              </button>
            )}
            {open === group[0].tool && (
              <div className="tb-flyout" role="menu" onMouseLeave={() => setOpen(null)}>
                {group.map((x) => (
                  <button key={x.tool} role="menuitemradio" aria-checked={tool === x.tool} className={tool === x.tool ? 'on' : ''} onClick={() => { pick(x.tool, group[0].tool); setOpen(null); }}>
                    <Icon name={x.icon} size={16} /><span className="grow">{t(language, `tool.${x.tool}`)}</span>{x.key && <kbd>{x.key}</kbd>}
                  </button>
                ))}
              </div>
            )}
          </span>
        );
      })}
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); e.target.value = ''; }} />
    </div>
    </>
  );
}
