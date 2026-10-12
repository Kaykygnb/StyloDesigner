// Barra flutuante de ferramentas: mover, mão e as formas que se desenham no canvas. Cada uma cria a camada com create_layer.
import { useRef } from 'react';
import { canEdit, uploadImage } from '../lib/actions';
import { setTool, useApp, type Tool } from '../lib/app';
import { Icon } from '../ui/Icon';

const TOOLS: ({ tool: Tool; icon: string; label: string; key: string } | 'sep')[] = [
  { tool: 'move', icon: 'cursor', label: 'Mover', key: 'V' },
  { tool: 'hand', icon: 'hand', label: 'Mão (ou segure Espaço)', key: 'H' },
  'sep',
  { tool: 'frame', icon: 'frame', label: 'Frame / tela', key: 'F' },
  { tool: 'section', icon: 'section', label: 'Seção', key: '⇧S' },
  'sep',
  { tool: 'rect', icon: 'rect', label: 'Retângulo', key: 'R' },
  { tool: 'ellipse', icon: 'ellipse', label: 'Elipse', key: 'E' },
  { tool: 'line', icon: 'line', label: 'Linha', key: 'L' },
  { tool: 'polygon', icon: 'polygon', label: 'Polígono', key: '' },
  { tool: 'star', icon: 'star', label: 'Estrela', key: '' },
  'sep',
  { tool: 'text', icon: 'text', label: 'Texto', key: 'T' },
  { tool: 'html', icon: 'code', label: 'Código HTML (escrito à mão)', key: '⇧E' },
  'sep',
  { tool: 'comment', icon: 'comment', label: 'Comentar', key: 'C' },
  { tool: 'inspect', icon: 'inspect', label: 'Inspecionar (como o F12)', key: 'I' },
];

export function Toolbar() {
  const tool = useApp((s) => s.tool);
  const file = useRef<HTMLInputElement>(null);
  const editable = canEdit();
  return (
    <div className="toolbar" role="toolbar" aria-label="Ferramentas">
      {TOOLS.map((t, i) => t === 'sep'
        ? <span key={i} className="tb-sep" />
        : (
          <button key={t.tool} className={`tb-btn${tool === t.tool ? ' on' : ''}`} aria-pressed={tool === t.tool} disabled={!editable && t.tool !== 'move' && t.tool !== 'hand' && t.tool !== 'inspect'}
            title={`${t.label}${t.key ? ` (${t.key})` : ''}`} onClick={() => setTool(t.tool)}>
            <Icon name={t.icon} size={18} />
          </button>
        ))}
      <button className="tb-btn" disabled={!editable} title="Imagem do computador" onClick={() => file.current?.click()}><Icon name="image" size={18} /></button>
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); e.target.value = ''; }} />
    </div>
  );
}
