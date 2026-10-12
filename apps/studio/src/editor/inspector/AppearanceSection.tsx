// Aparência: opacidade, mesclagem, cantos arredondados (juntos ou por canto), conteúdo que sai da caixa e máscara.
import { useState } from 'react';
import { BLEND_MODES, overflowOf } from '@stylo/core/model.js';
import { Cap, Check, Hint, IconBtn, Num, Row, Section, Sel } from '../../ui/Fields';
import type { Ctx } from './ctx';

const NO_RADIUS = ['text', 'ellipse', 'group', 'line', 'path', 'section'];
const OVERFLOWS: [string, string][] = [['hidden', 'Cortar (hidden)'], ['visible', 'Mostrar (visible)'], ['scroll-y', 'Rolar na vertical'], ['scroll-x', 'Rolar na horizontal'], ['scroll', 'Rolar nos dois']];

export function AppearanceSection({ c }: { c: Ctx }) {
  const { n, parent } = c;
  const off = c.readOnly;
  const [corners, setCorners] = useState(false);
  const radius = (n.radius ?? [0, 0, 0, 0]) as [number, number, number, number];
  const canRound = !NO_RADIUS.includes(n.type);
  const uneven = radius.some((r) => r !== radius[0]);
  const showCorners = corners || uneven;
  const setCorner = (i: number, v: number | null) => { const next = [...radius]; next[i] = Math.max(0, v ?? 0); void c.set({ radius: next }); };

  return (
    <Section id="appearance" title="Aparência">
      <Row>
        <Cap label="Opacidade" css="opacity"><Num value={(n.opacity ?? 1) * 100} min={0} max={100} decimals={0} unit="%" disabled={off} mixed={c.mixed((x) => x.opacity)} onCommit={(v) => void c.set({ opacity: (v ?? 100) / 100 })} /></Cap>
        <Cap label="Mesclagem" css="mix-blend-mode"><Sel value={n.blend ?? 'normal'} options={BLEND_MODES.map((m: string) => [m, m] as [string, string])} disabled={off} title="mix-blend-mode" onChange={(v) => void c.set({ blend: v })} /></Cap>
      </Row>
      {canRound && (
        <Cap label="Raio dos cantos" css="border-radius">
          <Row>
            <Num label="◜" value={radius[0]} min={0} decimals={1} disabled={off} title="border-radius" mixed={c.mixed((x) => x.radius?.[0])} onCommit={(v) => { const r = Math.max(0, v ?? 0); void c.set({ radius: [r, r, r, r] }); }} />
            <IconBtn icon="corner" title="Cantos independentes" on={showCorners} onClick={() => setCorners(!corners)} />
          </Row>
          {showCorners && (
            <>
              <Row><Num label="↖" value={radius[0]} min={0} decimals={1} disabled={off} title="border-top-left-radius" onCommit={(v) => setCorner(0, v)} /><Num label="↗" value={radius[1]} min={0} decimals={1} disabled={off} title="border-top-right-radius" onCommit={(v) => setCorner(1, v)} /></Row>
              <Row><Num label="↙" value={radius[3]} min={0} decimals={1} disabled={off} title="border-bottom-left-radius" onCommit={(v) => setCorner(3, v)} /><Num label="↘" value={radius[2]} min={0} decimals={1} disabled={off} title="border-bottom-right-radius" onCommit={(v) => setCorner(2, v)} /></Row>
            </>
          )}
        </Cap>
      )}
      {n.type === 'frame' && c.editState == null && (
        <Cap label="Conteúdo que sai" css="overflow">
          <Sel value={overflowOf(n)} options={OVERFLOWS} disabled={off} title="overflow"
            onChange={(v) => void c.set({ clip: v !== 'visible', overflow: v === 'hidden' || v === 'visible' ? null : v })} />
          {overflowOf(n).startsWith('scroll') && <Hint>A rolagem funciona na apresentação e no HTML exportado. No editor o conteúdo aparece cortado.</Hint>}
        </Cap>
      )}
      {c.baseOnly && (n.isMask || parent?.type === 'group') && (
        <Check label="Usar como máscara (clip-path)" checked={!!n.isMask} disabled={off} onChange={(v) => void c.set({ isMask: v })} />
      )}
    </Section>
  );
}
