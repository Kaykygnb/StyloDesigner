// Barra flutuante para inserir camadas. Cada botão = uma ferramenta de criação do MCP.
import { useRef } from 'react';
import { canEdit, insert, uploadImage, type InsertKind } from '../lib/actions';
import { Icon } from '../ui/Icon';

const ITEMS: { kind: InsertKind; icon: string; label: string; key: string }[] = [
  { kind: 'screen', icon: 'monitor', label: 'Nova tela', key: '' },
  { kind: 'frame', icon: 'frame', label: 'Caixa', key: 'F' },
  { kind: 'text', icon: 'text', label: 'Texto', key: 'T' },
  { kind: 'rect', icon: 'rect', label: 'Retângulo', key: 'R' },
  { kind: 'ellipse', icon: 'ellipse', label: 'Elipse', key: 'O' },
  { kind: 'line', icon: 'line', label: 'Linha', key: 'L' },
];

export function InsertBar() {
  const file = useRef<HTMLInputElement>(null);
  const editable = canEdit();
  return (
    <div className="insert-bar" role="toolbar" aria-label="Inserir">
      {ITEMS.map((i) => (
        <button key={i.kind} className="btn ghost icon" disabled={!editable} title={`${i.label}${i.key ? ` (${i.key})` : ''}`} onClick={() => void insert(i.kind)}>
          <Icon name={i.icon} size={18} />
        </button>
      ))}
      <button className="btn ghost icon" disabled={!editable} title="Imagem do computador" onClick={() => file.current?.click()}><Icon name="image" size={18} /></button>
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); e.target.value = ''; }} />
    </div>
  );
}
