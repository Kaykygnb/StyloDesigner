// Contorno: cor, espessura, estilo, posição (dentro/centro/fora), lados (só retângulo e frame) e, em vetores, ponta, quina e tracejado.
import { defaultStroke } from '@stylo/core/model.js';
import { colorGroups } from '../../lib/colors';
import { ColorRow } from '../../ui/ColorPicker';
import { Cap, IconBtn, Num, Row, Section, Sel, Seg, Txt } from '../../ui/Fields';
import type { Ctx } from './ctx';

type Stroke = { color: string; opacity: number; width: number; style: string; position: string; align?: string; cap?: string; join?: string; dash?: string; sides?: number[]; sidesCustom?: boolean };
const SIDE_KEYS = ['top', 'right', 'bottom', 'left'];

export function StrokeSection({ c }: { c: Ctx }) {
  const { n, doc } = c;
  const off = c.readOnly;
  const st = n.stroke as Stroke | null;
  const has = !!st;
  const sides = st?.sides;
  const setStroke = (patch: Record<string, unknown>) => void c.set({ stroke: patch });
  const lit = (i: number) => (sides ? sides[i] > 0 : true);

  const sidePreset = (key: string) => {
    const w = st?.width || 1;
    if (key === 'all') return setStroke({ sides: null, sidesCustom: null });
    if (key === 'custom') return setStroke({ sides: sides ?? [w, w, w, w], sidesCustom: true, position: 'inside' });
    return undefined;
  };
  const toggleSide = (i: number) => {
    const w = st?.width || 1;
    const sd = sides ? [...sides] : null;
    if (!sd) return setStroke({ sides: [0, 1, 2, 3].map((k) => (k === i ? w : 0)), position: 'inside' });
    sd[i] = sd[i] > 0 ? 0 : w;
    if (sd.every((v) => v === 0) || (sd.every((v) => v > 0) && !st?.sidesCustom)) return setStroke({ sides: null, sidesCustom: null });
    return setStroke({ sides: sd, position: 'inside' });
  };
  const mode = !sides ? 'all' : st?.sidesCustom ? 'custom' : 'sides';

  return (
    <Section id="stroke" title="Contorno" right={!off ? <IconBtn icon={has ? 'minus' : 'plus'} title={has ? 'Remover contorno' : 'Adicionar contorno'} onClick={() => void c.set({ stroke: has ? null : defaultStroke() })} /> : undefined}>
      {has && st && (
        <>
          <ColorRow color={st.color} opacity={st.opacity ?? 1} groups={colorGroups(doc)} disabled={off} onChange={(hex, a) => setStroke({ color: hex, opacity: a })} />
          <Row>
            <Cap label="Espessura" css="border-width">
              <Num label="▭" value={st.width} min={0} step={0.5} decimals={1} disabled={off} onCommit={(v) => { const w = Math.max(0, v ?? 0); setStroke({ width: w, ...(sides ? { sides: sides.map((x) => (x > 0 ? w : 0)) } : {}) }); }} />
            </Cap>
            {n.type !== 'text' && <Cap label="Estilo" css="border-style"><Sel value={st.style} options={[['solid', 'Sólido'], ['dashed', 'Tracejado'], ['dotted', 'Pontilhado']]} disabled={off} onChange={(v) => setStroke({ style: v })} /></Cap>}
          </Row>
          {n.type !== 'text' && !sides && (
            n.type === 'path'
              ? <Cap label="Posição" css="stroke-position"><Sel value={st.align ?? 'center'} options={[['center', 'Centro'], ['inside', 'Dentro'], ['outside', 'Fora']]} disabled={off} onChange={(v) => setStroke({ align: v })} /></Cap>
              : <Cap label="Posição" css="outline-offset"><Sel value={st.position} options={[['inside', 'Dentro'], ['center', 'Centro'], ['outside', 'Fora']]} disabled={off} onChange={(v) => setStroke({ position: v })} /></Cap>
          )}
          {n.type === 'path' && (
            <>
              <Row>
                <Cap label="Extremidade" css="stroke-linecap"><Sel value={st.cap ?? 'round'} options={[['round', 'Redonda'], ['butt', 'Reta'], ['square', 'Quadrada']]} disabled={off} onChange={(v) => setStroke({ cap: v })} /></Cap>
                <Cap label="Quina" css="stroke-linejoin"><Sel value={st.join ?? 'round'} options={[['round', 'Redonda'], ['miter', 'Pontuda'], ['bevel', 'Chanfrada']]} disabled={off} onChange={(v) => setStroke({ join: v })} /></Cap>
              </Row>
              <Cap label="Tracejado" css="stroke-dasharray"><Txt value={st.dash ?? ''} mono placeholder="ex.: 8 4  ·  12 4 2 4" disabled={off} onCommit={(v) => setStroke({ dash: v.trim() || null })} /></Cap>
            </>
          )}
          {(n.type === 'rect' || n.type === 'frame') && (
            <Cap label="Lados do contorno" css="border-top · right · bottom · left">
              <Seg value={mode === 'all' ? 'all' : mode === 'custom' ? 'custom' : 'sides'} title="Lados do contorno"
                options={[{ value: 'all', label: 'Todos', title: 'O contorno completo em volta da camada' }, { value: 'sides', label: 'Lados', title: 'Escolher quais lados têm linha' }, { value: 'custom', label: 'Por lado', title: 'Espessura diferente em cada lado' }]}
                onChange={(v) => { if (v === 'sides') toggleSide(0); else sidePreset(v); }} />
              {mode !== 'all' && (
                <div className="side-toggles">
                  {SIDE_KEYS.map((k, i) => <button key={k} type="button" className={`side-btn${lit(i) ? ' on' : ''}`} aria-pressed={lit(i)} disabled={off} title={`border-${k}`} onClick={() => toggleSide(i)}>{['↑', '→', '↓', '←'][i]}</button>)}
                </div>
              )}
              {mode === 'custom' && sides && (
                <>
                  <Row><Num label="↑" value={sides[0]} min={0} step={0.5} decimals={1} disabled={off} onCommit={(v) => setStroke({ sides: sides.map((x, k) => (k === 0 ? Math.max(0, v ?? 0) : x)) })} /><Num label="→" value={sides[1]} min={0} step={0.5} decimals={1} disabled={off} onCommit={(v) => setStroke({ sides: sides.map((x, k) => (k === 1 ? Math.max(0, v ?? 0) : x)) })} /></Row>
                  <Row><Num label="↓" value={sides[2]} min={0} step={0.5} decimals={1} disabled={off} onCommit={(v) => setStroke({ sides: sides.map((x, k) => (k === 2 ? Math.max(0, v ?? 0) : x)) })} /><Num label="←" value={sides[3]} min={0} step={0.5} decimals={1} disabled={off} onCommit={(v) => setStroke({ sides: sides.map((x, k) => (k === 3 ? Math.max(0, v ?? 0) : x)) })} /></Row>
                </>
              )}
            </Cap>
          )}
        </>
      )}
    </Section>
  );
}
