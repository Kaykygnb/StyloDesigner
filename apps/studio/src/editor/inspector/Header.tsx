// Cabeçalho do painel: ícone, nome e tipo da camada (com a etiqueta HTML que ela vira), mostrar/ocultar, travar, nota e componente.
import { tagOf } from '@stylo/core/model.js';
import { run, useApp } from '../../lib/app';
import { t, tp } from '../../lib/i18n';
import { toggleFlag, noteOn } from '../../lib/editing';
import { typeLabel } from '../../lib/doc';
import { Icon } from '../../ui/Icon';
import { IconBtn } from '../../ui/Fields';
import type { Ctx } from './ctx';

export const NODE_ICON: Record<string, string> = { frame: 'frame', text: 'text', rect: 'rect', ellipse: 'ellipse', line: 'line', group: 'group', media: 'photo', section: 'section', path: 'pen', html: 'code' };

export function Header({ c }: { c: Ctx }) {
  const { n, nodes, single, bp } = c;
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const hidden = n.visible === false;
  return (
    <div className="sel-head">
      <span className="sel-ico"><Icon name={single ? (n.component ? 'component' : NODE_ICON[n.type] ?? 'rect') : 'layers'} size={18} /></span>
      <div className="sel-info">
        <div className="sel-name ellipsis">{single ? n.name : tp(language, 'ui.inspector.layersCount', nodes.length)}</div>
        <div className="sel-sub">{single ? <>{typeLabel(n.type)} · <code className="sel-tag" title={tr('inspector.header.htmlTag')}>&lt;{tagOf(n)}&gt;</code></> : tr('inspector.header.groupEdit')}</div>
      </div>
      <div className="sel-actions">
        <IconBtn icon={hidden ? 'eyeoff' : 'eye'} on={hidden} disabled={c.readOnly} title={bp ? (hidden ? tr('inspector.header.showAtBreakpoint') : tr('inspector.header.hideAtBreakpoint')) : hidden ? tr('inspector.header.show') : tr('inspector.header.hide')}
          onClick={() => { if (bp) void c.set({ visible: hidden }); else void toggleFlag('visible'); }} />
        {!bp && <IconBtn icon={n.locked ? 'lock' : 'unlock'} on={!!n.locked} disabled={c.readOnly} title={n.locked ? tr('inspector.header.unlock') : tr('inspector.header.lock')} onClick={() => void toggleFlag('locked')} />}
        {single && !bp && <IconBtn icon="note" on={!!n.note} disabled={c.readOnly} title={n.note ? tr('inspector.header.editNote') : tr('inspector.header.addNote')} onClick={() => void noteOn(n.id)} />}
      </div>
    </div>
  );
}

/** Aviso do modo responsivo: em que largura se está editando e o botão para voltar uma camada ao Desktop. */
export function BpBanner({ c }: { c: Ctx }) {
  const { bp, nodes } = c;
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  if (!bp) return null;
  const touched = nodes.filter((x) => (x as { bps?: Record<string, Record<string, unknown>> }).bps?.[bp.id] && Object.keys((x as unknown as { bps: Record<string, Record<string, unknown>> }).bps[bp.id]).length);
  return (
    <div className="bp-banner">
      <span>{tr('inspector.header.responsive', { name: bp.name })}</span>
      {touched.length > 0 && !c.readOnly && (
        <button type="button" className="btn sm" title={tr('inspector.header.resetResponsive', { name: bp.name })}
          onClick={() => { void (async () => { await run('set_responsive', { ids: touched.map((x) => x.id), breakpoint: bp.id, reset: true }); })(); }}>
          <Icon name="undo" size={12} /> {tr('inspector.header.restoreDesktop')}
        </button>
      )}
    </div>
  );
}
