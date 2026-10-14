// Posição: alinhar, X/Y, restrições, rotação, espelhar, inclinação e ordem de empilhamento.
import { hasLayout } from '@stylo/core/model.js';
import { align, distribute } from '../../lib/actions';
import { arrange } from '../../lib/editing';
import { run, useApp } from '../../lib/app';
import { t } from '../../lib/i18n';
import { inFlow, parentOf } from '../../lib/doc';
import { Cap, Hint, IconBtn, Num, Row, Section, Sel } from '../../ui/Fields';
import { union } from '../canvas/geometry';
import type { Ctx } from './ctx';

const H_CONS: [string, string][] = [['left', 'Esquerda'], ['right', 'Direita'], ['leftright', 'Esq. e dir.'], ['center', 'Centro'], ['scale', 'Escala']];
const V_CONS: [string, string][] = [['top', 'Topo'], ['bottom', 'Base'], ['topbottom', 'Topo e base'], ['center', 'Centro'], ['scale', 'Escala']];

function AlignBar({ c }: { c: Ctx }) {
  const language = useApp((s) => s.language);
  const tr = (key: string) => t(language, key);
  const multi = c.ids.length >= 2;
  const canAlign = multi || (c.parent && !c.flow);
  const off = c.readOnly || !canAlign;
  const A = (icon: string, title: string, a: Parameters<typeof align>[0]) => <IconBtn key={title} icon={icon} title={title} disabled={off} onClick={() => void align(a)} />;
  return (
    <div className="align-bar">
      {A('alignleft', tr('inspector.position.alignLeft'), 'left')}{A('aligncenter', tr('inspector.position.alignCenterH'), 'hcenter')}{A('alignright', tr('inspector.position.alignRight'), 'right')}
      <span className="tb-sep" />
      {A('aligntop', tr('inspector.position.alignTop'), 'top')}{A('alignmiddle', tr('inspector.position.alignCenterV'), 'vcenter')}{A('alignbottom', tr('inspector.position.alignBottom'), 'bottom')}
      <span className="tb-sep" />
      <IconBtn icon="distributeh" title={tr('inspector.position.distributeH')} disabled={c.readOnly || c.ids.length < 3} onClick={() => void distribute('h')} />
      <IconBtn icon="distributev" title={tr('inspector.position.distributeV')} disabled={c.readOnly || c.ids.length < 3} onClick={() => void distribute('v')} />
    </div>
  );
}

export function PositionSection({ c }: { c: Ctx }) {
  const { n, bp, flow, parent, single } = c;
  const world = useApp((s) => s.worldBoxes);
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const hConstraints: [string, string][] = [['left', tr('inspector.position.left')], ['right', tr('inspector.position.right')], ['leftright', tr('inspector.position.leftRight')], ['center', tr('inspector.position.center')], ['scale', tr('inspector.position.scale')]];
  const vConstraints: [string, string][] = [['top', tr('inspector.position.top')], ['bottom', tr('inspector.position.bottom')], ['topbottom', tr('inspector.position.topBottom')], ['center', tr('inspector.position.center')], ['scale', tr('inspector.position.scale')]];
  const off = c.readOnly;

  if (!single && bp) return <Section id="pos" title={tr('inspector.position.title')}><Hint>{tr('inspector.position.responsiveHint')}</Hint></Section>;

  // várias camadas: X/Y da caixa que envolve todas (move todas juntas)
  const box = !single ? union(c.ids.map((id) => world[id]).filter(Boolean)) : null;
  const moveAll = async (dx: number, dy: number) => {
    const updates = c.nodes
      .filter((x) => !x.locked && !inFlow(parentOf(c.page.children, x.id), x))
      .map((x) => ({ id: x.id, props: { x: Math.round(x.x + dx), y: Math.round(x.y + dy) } }));
    if (updates.length) await run('update_layers', { updates });
  };

  return (
    <Section id="pos" title={tr('inspector.position.title')}>
      {!bp && <Cap label={tr('inspector.position.alignment')}><AlignBar c={c} /></Cap>}
      {single ? (
        <Cap label={tr('inspector.position.single')} css="left · top" tip={flow ? tr('inspector.position.autoLayout') : undefined}>
          <Row>
            <Num label="X" value={n.x} decimals={1} disabled={off || flow} title="left" onCommit={(v) => void c.set({ x: v ?? 0 })} />
            <Num label="Y" value={n.y} decimals={1} disabled={off || flow} title="top" onCommit={(v) => void c.set({ y: v ?? 0 })} />
          </Row>
        </Cap>
      ) : (
        <Cap label={tr('inspector.position.multi', { count: c.ids.length })}>
          <Row>
            <Num label="X" value={box?.x} decimals={1} disabled={off || !box} onCommit={(v) => { if (box && v != null) void moveAll(v - box.x, 0); }} />
            <Num label="Y" value={box?.y} decimals={1} disabled={off || !box} onCommit={(v) => { if (box && v != null) void moveAll(0, v - box.y); }} />
          </Row>
        </Cap>
      )}
      {single && parent?.type === 'frame' && !hasLayout(parent as never) && !n.absolute && !bp && (
        <Cap label={tr('inspector.position.constraints')} css="left · right · top · bottom" tip={tr('inspector.position.constraintsTip')}>
          <Row>
            <Sel title={tr('inspector.position.horizontalConstraint')} value={n.constraints?.h ?? 'left'} options={hConstraints} disabled={off} onChange={(v) => void c.set({ constraints: { h: v } })} />
            <Sel title={tr('inspector.position.verticalConstraint')} value={n.constraints?.v ?? 'top'} options={vConstraints} disabled={off} onChange={(v) => void c.set({ constraints: { v } })} />
          </Row>
        </Cap>
      )}
      <Cap label={tr('inspector.position.rotation')} css="transform">
        <Row>
          <Num label="↻" value={n.rotation ?? 0} decimals={1} min={-360} max={360} unit="°" disabled={off} title="rotação (transform: rotate)" mixed={c.mixed((x) => x.rotation)} onCommit={(v) => void c.set({ rotation: v ?? 0 })} />
          {!bp && (
            <div className="btn-group">
              <IconBtn icon="flipH" title={tr('inspector.position.flipH')} on={!!n.flipX} disabled={off} onClick={() => void arrange('flip_h')} />
              <IconBtn icon="flipV" title={tr('inspector.position.flipV')} on={!!n.flipY} disabled={off} onClick={() => void arrange('flip_v')} />
            </div>
          )}
        </Row>
      </Cap>
      <Cap label={tr('inspector.position.skew')} css="skew">
        <Row>
          <Num label="X" value={n.skewX ?? 0} decimals={1} min={-80} max={80} unit="°" disabled={off} title="inclinar na horizontal" onCommit={(v) => void c.set({ skewX: v || null })} />
          <Num label="Y" value={n.skewY ?? 0} decimals={1} min={-80} max={80} unit="°" disabled={off} title="inclinar na vertical" onCommit={(v) => void c.set({ skewY: v || null })} />
        </Row>
      </Cap>
      {c.baseOnly && (
        <Cap label={tr('inspector.position.stack')} css="z-index">
          <div className="btn-group">
            <IconBtn icon="front" title={tr('inspector.position.front')} disabled={off} onClick={() => void arrange('front')} />
            <IconBtn icon="arrowup" title={tr('inspector.position.forward')} disabled={off} onClick={() => void arrange('forward')} />
            <IconBtn icon="arrowdown" title={tr('inspector.position.backward')} disabled={off} onClick={() => void arrange('backward')} />
            <IconBtn icon="back" title={tr('inspector.position.back')} disabled={off} onClick={() => void arrange('back')} />
          </div>
        </Cap>
      )}
    </Section>
  );
}
