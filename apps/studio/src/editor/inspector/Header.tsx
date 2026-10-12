// Cabeçalho do painel: ícone, nome e tipo da camada (com a etiqueta HTML que ela vira), mostrar/ocultar, travar, nota e componente.
import { tagOf } from '@stylo/core/model.js';
import { run } from '../../lib/app';
import { toggleFlag, noteOn } from '../../lib/editing';
import { TYPE_LABEL } from '../../lib/doc';
import { Icon } from '../../ui/Icon';
import { IconBtn } from '../../ui/Fields';
import type { Ctx } from './ctx';

export const NODE_ICON: Record<string, string> = { frame: 'frame', text: 'text', rect: 'rect', ellipse: 'ellipse', line: 'line', group: 'group', media: 'photo', section: 'section', path: 'pen', html: 'code' };

export function Header({ c }: { c: Ctx }) {
  const { n, nodes, single, bp } = c;
  const hidden = n.visible === false;
  return (
    <div className="sel-head">
      <span className="sel-ico"><Icon name={single ? (n.component ? 'component' : NODE_ICON[n.type] ?? 'rect') : 'layers'} size={18} /></span>
      <div className="sel-info">
        <div className="sel-name ellipsis">{single ? n.name : `${nodes.length} camadas`}</div>
        <div className="sel-sub">{single ? <>{TYPE_LABEL[n.type] ?? n.type} · <code className="sel-tag" title="Etiqueta HTML no código exportado">&lt;{tagOf(n)}&gt;</code></> : 'Edição em grupo: valores da 1ª camada'}</div>
      </div>
      <div className="sel-actions">
        <IconBtn icon={hidden ? 'eyeoff' : 'eye'} on={hidden} disabled={c.readOnly} title={bp ? (hidden ? 'Mostrar nesta largura' : 'Ocultar só nesta largura (display: none)') : hidden ? 'Mostrar' : 'Ocultar (display: none)'}
          onClick={() => { if (bp) void c.set({ visible: hidden }); else void toggleFlag('visible'); }} />
        {!bp && <IconBtn icon={n.locked ? 'lock' : 'unlock'} on={!!n.locked} disabled={c.readOnly} title={n.locked ? 'Destravar' : 'Travar: não dá para clicar nela no canvas'} onClick={() => void toggleFlag('locked')} />}
        {single && !bp && <IconBtn icon="note" on={!!n.note} disabled={c.readOnly} title={n.note ? 'Editar a nota da camada' : 'Adicionar nota à camada'} onClick={() => void noteOn(n.id)} />}
      </div>
    </div>
  );
}

/** Aviso do modo responsivo: em que largura se está editando e o botão para voltar uma camada ao Desktop. */
export function BpBanner({ c }: { c: Ctx }) {
  const { bp, nodes } = c;
  if (!bp) return null;
  const touched = nodes.filter((x) => (x as { bps?: Record<string, Record<string, unknown>> }).bps?.[bp.id] && Object.keys((x as unknown as { bps: Record<string, Record<string, unknown>> }).bps[bp.id]).length);
  return (
    <div className="bp-banner">
      <span>Editando o <b>{bp.name}</b>. Só o que for diferente do Desktop é guardado; o resto continua herdando.</span>
      {touched.length > 0 && !c.readOnly && (
        <button type="button" className="btn sm" title={`Apaga os ajustes do ${bp.name} desta camada e volta a herdar do Desktop`}
          onClick={() => { void (async () => { for (const x of touched) await run('set_responsive', { id: x.id, breakpoint: bp.id, reset: true }); })(); }}>
          <Icon name="undo" size={12} /> Restaurar ao Desktop
        </button>
      )}
    </div>
  );
}
