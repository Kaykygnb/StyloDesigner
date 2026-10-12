// Barra flutuante de ferramentas: mover, mão e as formas que se desenham no canvas. Cada uma cria a camada com create_layer.
import { useRef } from 'react';
import { canEdit, uploadImage } from '../lib/actions';
import { run, setTool, toast, useApp, type Tool } from '../lib/app';
import { t } from '../lib/i18n';
import { findNode, pageOf } from '../lib/doc';
import { arrange, commentOn } from '../lib/editing';
import { Icon } from '../ui/Icon';

const TOOLS: ({ tool: Tool; icon: string; key: string } | 'sep')[] = [
  { tool: 'move', icon: 'cursor', key: 'V' }, { tool: 'hand', icon: 'hand', key: 'H' },
  'sep',
  { tool: 'frame', icon: 'frame', key: 'F' }, { tool: 'section', icon: 'section', key: '⇧S' },
  'sep',
  { tool: 'rect', icon: 'rect', key: 'R' }, { tool: 'ellipse', icon: 'ellipse', key: 'E' }, { tool: 'line', icon: 'line', key: 'L' },
  { tool: 'polygon', icon: 'polygon', key: '' }, { tool: 'star', icon: 'star', key: '' },
  'sep',
  { tool: 'text', icon: 'text', key: 'T' },
  'sep',
  { tool: 'pen', icon: 'pen', key: 'P' }, { tool: 'pencil', icon: 'pencil', key: '' }, { tool: 'node', icon: 'node', key: 'N' },
  'sep',
  { tool: 'comment', icon: 'comment', key: 'C' }, { tool: 'inspect', icon: 'inspect', key: 'I' },
];

export function Toolbar() {
  const tool = useApp((s) => s.tool);
  const selection = useApp((s) => s.selection);
  const doc = useApp((s) => s.doc);
  const pageId = useApp((s) => s.pageId);
  const language = useApp((s) => s.language);
  const file = useRef<HTMLInputElement>(null);
  const editable = canEdit();
  const selectedNodes = doc && pageId ? selection.map((id) => findNode(pageOf(doc, pageId).children, id)).filter(Boolean) : [];
  const booleanSupported = selectedNodes.length >= 2 && selectedNodes.every((node) => node && ['path', 'rect', 'ellipse', 'frame'].includes(node.type) && !(node.type === 'frame' && node.children?.length));
  const booleanActions: Array<['boolean_union' | 'boolean_subtract' | 'boolean_intersect' | 'boolean_exclude', string, string]> = [
    ['boolean_union', '∪', 'inspector.boolean.union'], ['boolean_subtract', '−', 'inspector.boolean.subtract'],
    ['boolean_intersect', '∩', 'inspector.boolean.intersect'], ['boolean_exclude', '⊕', 'inspector.boolean.exclude'],
  ];
  const paths = selectedNodes.filter((node) => node?.type === 'path');
  const vectorActions: [string, string, () => Promise<unknown>][] = paths.length === 1 ? [
    ['↔', 'Inverter a direção do caminho', () => run('reverse_vector', { id: paths[0]!.id })],
    ['≈', 'Simplificar (menos pontos)', () => run('simplify_vector', { id: paths[0]!.id, tolerance: 1 })],
    ['◜', 'Arredondar os cantos', () => run('set_path_effect', { id: paths[0]!.id, kind: 'round-corners', radius: 8 })],
    ['▭', 'Converter o contorno em forma preenchida', () => run('stroke_to_path', { id: paths[0]!.id })],
  ] : [];
  const twoPaths = paths.length === 2 ? [
    ['◐', 'Interpolar: cria a forma do meio entre as duas (as originais ficam)', () => run('interpolate_vectors', { from_id: paths[0]!.id, to_id: paths[1]!.id, t: 0.5 })] as [string, string, () => Promise<unknown>],
  ] : [];
  return (
    <>
    {(selection.length >= 2 || paths.length === 1) && <div className="toolbar context-bar" role="toolbar" aria-label="Ações da seleção">
      {selection.length >= 2 && <>
        <span className="tb-context" aria-label={t(language, 'inspector.boolean.title')}>
          {twoPaths.map(([symbol, label, go]) => <button key={label} className="tb-btn tb-action" disabled={!editable} title={label} aria-label={label} onClick={() => { void go().catch((e) => toast('error', e instanceof Error ? e.message : String(e))); }}>{symbol}</button>)}
          {booleanActions.map(([action, symbol, label]) => <button key={action} className="tb-btn tb-action" disabled={!editable || !booleanSupported} title={t(language, label)} aria-label={t(language, label)} onClick={() => void arrange(action)}>{symbol}</button>)}
        </span>
      </>}
      {paths.length === 1 && <>
        <span className="tb-context" aria-label="Ferramentas de vetor">
          <button className={`tb-btn tb-action${tool === 'node' ? ' on' : ''}`} title={t(language, 'tool.node')} aria-label={t(language, 'tool.node')} onClick={() => setTool('node')}><Icon name="node" size={16} /></button>
          {vectorActions.map(([symbol, label, go]) => <button key={label} className="tb-btn tb-action" disabled={!editable} title={label} aria-label={label} onClick={() => { void go().catch((e) => toast('error', e instanceof Error ? e.message : String(e))); }}>{symbol}</button>)}
        </span>
      </>}
    </div>}
    <div className="toolbar insert-bar" role="toolbar" aria-label="Ferramentas">
      {TOOLS.map((item, i) => item === 'sep'
        ? <span key={i} className="tb-sep" />
        : (
          <button key={item.tool} className={`tb-btn${tool === item.tool ? ' on' : ''}`} aria-pressed={tool === item.tool} disabled={!editable && item.tool !== 'move' && item.tool !== 'hand' && item.tool !== 'inspect'}
            title={`${t(language, `tool.${item.tool}`)}${item.key ? ` (${item.key})` : ''}`} aria-label={t(language, `tool.${item.tool}`)} onClick={() => {
              if (item.tool === 'comment' && selection.length === 1) commentOn(selection[0]);
              else if (['frame', 'section', 'text', 'rect', 'ellipse', 'line', 'polygon', 'star', 'html'].includes(item.tool)) setTool(item.tool);
              else setTool(item.tool);
            }}>
            <Icon name={item.icon} size={18} />
          </button>
        ))}
      <button className="tb-btn" disabled={!editable} title={t(language, 'tool.image')} aria-label={t(language, 'tool.image')} onClick={() => file.current?.click()}><Icon name="image" size={18} /></button>
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); e.target.value = ''; }} />
    </div>
    </>
  );
}
