// Tamanho: largura e altura (com trava de proporção), modos fixo/hug/fill, tamanhos prontos de tela, largura fluida, limites e proporção.
import { useState } from 'react';
import { hasLayout } from '@stylo/core/model.js';
import { run, useApp } from '../../lib/app';
import { t } from '../../lib/i18n';
import { Cap, Check, Hint, IconBtn, Num, Row, Section, Sel } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import { scaleInto, union } from '../canvas/geometry';
import type { Ctx } from './ctx';

const PRESETS: [string, string][] = [
  ['', 'ui.size.preset.placeholder'], ['1440x900', 'ui.size.preset.desktop'], ['1280x800', 'ui.size.preset.laptop'], ['1920x1080', 'ui.size.preset.fullhd'],
  ['768x1024', 'ui.size.preset.tablet'], ['390x844', 'ui.size.preset.phone'], ['360x740', 'ui.size.preset.smallPhone'], ['393x852', 'ui.size.preset.iphone'],
  ['1080x1080', 'ui.size.preset.square'], ['1080x1920', 'ui.size.preset.story'], ['595x842', 'ui.size.preset.a4'],
];
/** [valor, chave do texto]; '' e 'atual' usam textos próprios mais abaixo. */
const ASPECTS: [string, string][] = [
  ['', ''], ['1', 'ui.size.aspect.square'], ['1.3333', ''], ['1.7778', ''], ['1.5', ''], ['2', ''],
  ['0.75', 'ui.size.aspect.portrait'], ['0.5625', 'ui.size.aspect.story'], ['atual', ''],
];
const RATIO_LABEL: Record<string, string> = { '1.3333': '4 : 3', '1.7778': '16 : 9', '1.5': '3 : 2', '2': '2 : 1' };

export function SizeSection({ c }: { c: Ctx }) {
  const { n, single, bp, parent, flow } = c;
  const world = useApp((s) => s.worldBoxes);
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const off = c.readOnly;

  if (!single && bp) return <Section id="size" title={tr('inspector.size.title')}><Hint>{tr('inspector.size.singleHint')}</Hint></Section>;

  // várias camadas: W/H do conjunto (escala cada camada junto)
  if (!single) {
    const box = union(c.ids.map((id) => world[id]).filter(Boolean));
    const scaleAll = async (w: number | null, h: number | null) => {
      if (!box) return;
      const to = { ...box, w: w ?? box.w, h: h ?? box.h };
      const updates = c.nodes.filter((x) => world[x.id] && !x.locked).map((x) => {
        const b = scaleInto(world[x.id], box, to);
        const props: Record<string, unknown> = { w: Math.max(1, Math.round(b.w)), h: Math.max(1, Math.round(b.h)) };
        if (!c.flow) { props.x = Math.round(x.x + (b.x - world[x.id].x)); props.y = Math.round(x.y + (b.y - world[x.id].y)); }
        return { id: x.id, props };
      });
      if (updates.length) await run('update_layers', { updates });
    };
    return (
      <Section id="size" title={tr('inspector.size.title')}>
        <Cap label={tr('inspector.size.dimensions')} css="width · height">
          <Row>
            <Num label="W" value={box?.w} min={1} disabled={off || !box} onCommit={(v) => void scaleAll(v, null)} />
            <Num label="H" value={box?.h} min={1} disabled={off || !box} onCommit={(v) => void scaleAll(null, v)} />
          </Row>
        </Cap>
      </Section>
    );
  }

  const measured = world[n.id];
  const wShown = n.sizeX === 'fixed' || !measured ? n.w : measured.ow;
  const hShown = n.sizeY === 'fixed' || !measured ? n.h : measured.oh;
  const hasLayoutNode = n.type === 'frame' && hasLayout(n as never);
  const modes = (axis: 'sizeX' | 'sizeY'): [string, string][] => {
    const o: [string, string][] = [['fixed', tr('inspector.size.fixed')]];
    if (n.type === 'text' || hasLayoutNode) o.push(['hug', tr('inspector.size.hug')]);
    if (flow || (parent && c.parentLayout !== 'none' && axis)) o.push(['fill', tr('inspector.size.fill')]);
    return o;
  };
  const isBoard = n.type === 'frame' && (!parent || parent.type === 'section');
  const limitsUsed = !!(n.minW || n.maxW || n.minH || n.maxH || n.aspect);
  const lim = (label: string, key: 'minW' | 'maxW' | 'minH' | 'maxH', css: string) => (
    <Cap label={label} css={css}>
      <Num value={n[key] ?? null} min={0} decimals={0} nullable unit="px" placeholder={tr('ui.size.noLimit')} disabled={off} onCommit={(v) => void c.set({ [key]: v && v > 0 ? Math.round(v) : null })} />
    </Cap>
  );
  const aspectVal = (() => {
    const a = Number(n.aspect);
    if (!(a > 0)) return '';
    const hit = ASPECTS.find(([v]) => v && v !== 'atual' && Math.abs(Number(v) - a) < 0.002);
    return hit ? hit[0] : 'custom';
  })();

  return (
    <Section id="size" title={tr('inspector.size.title')}>
      <Cap label={tr('inspector.size.dimensions')} css="width · height">
        <Row>
          <Num label="W" value={wShown} min={1} decimals={1} disabled={off} title="width" mixed={c.mixed((x) => x.w)} onCommit={(v) => void c.set({ w: v ?? 1 })} />
          <Num label="H" value={hShown} min={1} decimals={1} disabled={off || n.type === 'line'} title="height" mixed={c.mixed((x) => x.h)} onCommit={(v) => void c.set({ h: v ?? 1 })} />
          {!bp && <IconBtn icon={n.lockRatio ? 'link' : 'unlink'} on={!!n.lockRatio} disabled={off} title={tr('inspector.size.ratio')} onClick={() => void c.set({ lockRatio: !n.lockRatio })} />}
        </Row>
      </Cap>
      {(n.type === 'text' || hasLayoutNode || flow) && (
        <Row>
          <Cap label={tr('inspector.size.width')} css="width"><Sel label="W" value={n.sizeX} options={modes('sizeX')} disabled={off} title={tr('inspector.size.width')} onChange={(v) => void c.set({ sizeX: v })} /></Cap>
          <Cap label={tr('inspector.size.height')} css="height"><Sel label="H" value={n.sizeY} options={modes('sizeY')} disabled={off} title={tr('inspector.size.height')} onChange={(v) => void c.set({ sizeY: v })} /></Cap>
        </Row>
      )}
      {isBoard && !bp && (
        <>
          <Sel value="" options={PRESETS.map(([value, key]) => [value, tr(key)] as [string, string])} disabled={off} title={tr('inspector.size.presets')} onChange={(v) => { if (!v) return; const [w, h] = v.split('x').map(Number); void c.set({ w, h, sizeY: 'fixed' }); }} />
          <Check label={tr('inspector.size.fluid')} checked={!!n.fluid} disabled={off} title={tr('ui.size.fluidTip')} onChange={(v) => void c.set({ fluid: v || null })} />
        </>
      )}
      {n.type !== 'group' && n.type !== 'line' && (
        <div className="fold">
          <button type="button" className="fold-head" aria-expanded={limitsOpen || limitsUsed} onClick={() => setLimitsOpen(!limitsOpen)}>
          <Icon name={limitsOpen || limitsUsed ? 'chevrondown' : 'chevron'} size={12} /> {tr('inspector.size.limits')}{limitsUsed && <span className="dot-on" />}
          </button>
          {(limitsOpen || limitsUsed) && (
            <div className="fold-body">
              <Row>{lim(tr('inspector.size.minWidth'), 'minW', 'min-width')}{lim(tr('inspector.size.maxWidth'), 'maxW', 'max-width')}</Row>
              <Row>{lim(tr('inspector.size.minHeight'), 'minH', 'min-height')}{lim(tr('inspector.size.maxHeight'), 'maxH', 'max-height')}</Row>
              {n.type !== 'text' && (
                <Cap label={tr('inspector.size.ratio')} css="aspect-ratio">
                  <Sel value={aspectVal} options={[...ASPECTS.map(([value, label]) => [value, value === '' ? tr('inspector.size.free') : value === 'atual' ? tr('inspector.size.current') : label ? tr(label) : RATIO_LABEL[value] ?? value] as [string, string]), ['custom', tr('inspector.size.custom')]]} disabled={off} title="aspect-ratio"
                    onChange={(v) => { if (v === 'custom') return; void c.set({ aspect: v === '' ? null : v === 'atual' ? Math.round((n.w / n.h) * 10000) / 10000 : Number(v) }); }} />
                </Cap>
              )}
              {Number(n.aspect) > 0 && n.sizeX === 'fixed' && n.sizeY === 'fixed' && <Hint>{tr('inspector.size.ratioHint')}</Hint>}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
