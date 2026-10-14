// Posição: alinhar, X/Y, restrições, rotação, espelhar, inclinação e ordem de empilhamento.
import { hasLayout } from '@stylo/core/model.js';
import { align, distribute } from '../../lib/actions';
import { arrange } from '../../lib/editing';
import { run, useApp } from '../../lib/app';
import { t } from '../../lib/i18n';
import { inFlow, parentOf } from '../../lib/doc';
import { useState } from 'react';
import { Cap, Check, Hint, IconBtn, Num, Row, Section, Sel } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import { union } from '../canvas/geometry';
import type { Ctx } from './ctx';


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
  const [moreOpen, setMoreOpen] = useState(false);
  // uma tela (frame na raiz) não gira nem inclina: isso só confunde quem está montando a página
  const board = single && !parent && n.type === 'frame';
  const moreUsed = !!(n.skewX || n.skewY || n.rotateX || n.rotateY || n.depth || n.parallax || n.perspective || n.preserve3d);

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
      {!board && <>
      <Cap label={tr('inspector.position.rotation')} css="transform">
        <Row>
          <Num label="↻" value={n.rotation ?? 0} decimals={1} min={-360} max={360} unit="°" disabled={off} title={tr('ui.position.rotateTip')} mixed={c.mixed((x) => x.rotation)} onCommit={(v) => void c.set({ rotation: v ?? 0 })} />
          {!bp && (
            <div className="btn-group">
              <IconBtn icon="flipH" title={tr('inspector.position.flipH')} on={!!n.flipX} disabled={off} onClick={() => void arrange('flip_h')} />
              <IconBtn icon="flipV" title={tr('inspector.position.flipV')} on={!!n.flipY} disabled={off} onClick={() => void arrange('flip_v')} />
            </div>
          )}
        </Row>
      </Cap>
      <div className="fold">
        <button type="button" className="fold-head" aria-expanded={moreOpen || moreUsed} onClick={() => setMoreOpen(!moreOpen)}>
          <Icon name={moreOpen || moreUsed ? 'chevrondown' : 'chevron'} size={12} /> {tr('inspector.position.moreTransforms')}{moreUsed && <span className="dot-on" />}
        </button>
        {(moreOpen || moreUsed) && <div className="fold-body">
      <Cap label={tr('inspector.position.skew')} css="skew">
        <Row>
          <Num label="X" value={n.skewX ?? 0} decimals={1} min={-80} max={80} unit="°" disabled={off} title={tr('ui.position.skewH')} onCommit={(v) => void c.set({ skewX: v || null })} />
          <Num label="Y" value={n.skewY ?? 0} decimals={1} min={-80} max={80} unit="°" disabled={off} title={tr('ui.position.skewV')} onCommit={(v) => void c.set({ skewY: v || null })} />
        </Row>
      </Cap>
      <Cap label={tr('inspector.position.threeD')} css="transform · perspective" tip={tr('inspector.position.threeDTip')}>
        <Row>
          <Num label="X" value={n.rotateX ?? 0} decimals={1} min={-360} max={360} unit="°" disabled={off} title={tr('ui.position.rotateXTip')} onCommit={(v) => void c.set({ rotateX: v || null })} />
          <Num label="Y" value={n.rotateY ?? 0} decimals={1} min={-360} max={360} unit="°" disabled={off} title={tr('ui.position.rotateYTip')} onCommit={(v) => void c.set({ rotateY: v || null })} />
        </Row>
        <Row>
          <Num label="Z" value={n.depth ?? 0} decimals={0} min={-2000} max={2000} unit="px" disabled={off} title={tr('ui.position.depthTip')} onCommit={(v) => void c.set({ depth: v || null })} />
          <Num label="⇅" value={n.parallax ?? 0} decimals={2} step={0.1} min={-1} max={1} disabled={off} title={tr('ui.position.parallaxTip')} onCommit={(v) => void c.set({ parallax: v || null })} />
        </Row>
        {single && ['frame', 'group', 'section'].includes(n.type) && (
          <Row>
            <Num label="◎" value={n.perspective ?? 0} decimals={0} min={0} max={5000} unit="px" nullable disabled={off} title={tr('ui.position.perspectiveTip')} onCommit={(v) => void c.set({ perspective: v && v >= 100 ? v : null })} />
            <Check label="3D" checked={!!n.preserve3d} disabled={off} title={tr('ui.position.preserve3dTip')} onChange={(v) => void c.set({ preserve3d: v || null })} />
          </Row>
        )}
      </Cap>
        </div>}
      </div>
      </>}
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
