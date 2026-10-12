// Efeitos: sombras (externas e internas), desfoque da camada, vidro (desfoque do fundo) e filtros de cor.
import { useState } from 'react';
import { defaultShadow } from '@stylo/core/model.js';
import { colorGroups } from '../../lib/colors';
import { ColorRow } from '../../ui/ColorPicker';
import { Cap, Check, IconBtn, Num, Row, Section, Sel } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import type { Ctx } from './ctx';

type Shadow = { x: number; y: number; blur: number; spread: number; color: string; opacity: number; inset: boolean };

export function EffectsSection({ c }: { c: Ctx }) {
  const { n, doc } = c;
  const off = c.readOnly;
  const isText = n.type === 'text';
  const shadows = (n.shadows ?? []) as Shadow[];
  const fx = (n.fx ?? {}) as Record<string, number>;
  const fxUsed = Object.keys(fx).length > 0;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const effectStyles = (doc.styles?.effects ?? []) as { id: string; name: string }[];
  const setShadow = (i: number, patch: Partial<Shadow>) => void c.set({ shadows: shadows.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const setFx = (key: string, def: number) => (v: number | null) => {
    const next = { ...fx };
    if (v == null || v === def) delete next[key]; else next[key] = v;
    void c.set({ fx: Object.keys(next).length ? next : null });
  };
  const filt = (label: string, css: string, key: string, def: number, unit: string, min: number, max: number) => (
    <Cap label={label} css={css}><Num value={fx[key] ?? def} min={min} max={max} decimals={0} unit={unit} disabled={off} onCommit={setFx(key, def)} /></Cap>
  );

  return (
    <Section id="effects" title="Efeitos" defaultOpen={shadows.length > 0 || n.blur > 0 || n.bgBlur > 0 || fxUsed}
      right={!off ? <IconBtn icon="plus" title="Adicionar sombra" onClick={() => void c.set({ shadows: [...shadows, defaultShadow()] })} /> : undefined}>
      {effectStyles.length > 0 && (
        <Sel value={n.effectStyleId ?? ''} options={[['', 'Sombra própria'], ...effectStyles.map((e) => [e.id, e.name] as [string, string])]} disabled={off} title="Estilo de sombra do projeto" onChange={(v) => void c.set({ effectStyleId: v || null })} />
      )}
      {shadows.map((s, i) => (
        <div className="effect-card" key={i}>
          <Row>
            <Cap label="Horizontal" css="box-shadow"><Num label="X" value={s.x} decimals={0} disabled={off} onCommit={(v) => setShadow(i, { x: v ?? 0 })} /></Cap>
            <Cap label="Vertical"><Num label="Y" value={s.y} decimals={0} disabled={off} onCommit={(v) => setShadow(i, { y: v ?? 0 })} /></Cap>
          </Row>
          <Row>
            <Cap label="Desfoque"><Num label="B" value={s.blur} min={0} decimals={0} disabled={off} onCommit={(v) => setShadow(i, { blur: Math.max(0, v ?? 0) })} /></Cap>
            {!isText && <Cap label="Espalhar"><Num label="S" value={s.spread} decimals={0} disabled={off} onCommit={(v) => setShadow(i, { spread: v ?? 0 })} /></Cap>}
          </Row>
          <div className="effect-foot">
            <ColorRow color={s.color} opacity={s.opacity} groups={colorGroups(doc)} disabled={off} onChange={(hex, a) => setShadow(i, { color: hex, opacity: a })} />
          </div>
          <div className="effect-foot">
            {!isText && <Check label="Interna" checked={!!s.inset} disabled={off} onChange={(v) => setShadow(i, { inset: v })} />}
            <span className="spacer" />
            {!off && <IconBtn icon="minus" title="Remover sombra" onClick={() => void c.set({ shadows: shadows.filter((_, k) => k !== i) })} />}
          </div>
        </div>
      ))}
      <Row>
        <Cap label="Desfoque" css="blur"><Num label="◌" value={n.blur ?? 0} min={0} decimals={0} disabled={off} onCommit={(v) => void c.set({ blur: Math.max(0, v ?? 0) })} /></Cap>
        {!isText && <Cap label="Vidro (fundo)" css="backdrop-filter"><Num label="▨" value={n.bgBlur ?? 0} min={0} decimals={0} disabled={off} onCommit={(v) => void c.set({ bgBlur: Math.max(0, v ?? 0) })} /></Cap>}
      </Row>
      <div className="fold">
        <button type="button" className="fold-head" aria-expanded={filtersOpen || fxUsed} onClick={() => setFiltersOpen(!filtersOpen)}>
          <Icon name={filtersOpen || fxUsed ? 'chevrondown' : 'chevron'} size={12} /> Filtros de cor{fxUsed && <span className="dot-on" />}
        </button>
        {(filtersOpen || fxUsed) && (
          <div className="fold-body">
            <Row>{filt('Brilho', 'brightness', 'brightness', 100, '%', 0, 300)}{filt('Contraste', 'contrast', 'contrast', 100, '%', 0, 300)}</Row>
            <Row>{filt('Saturação', 'saturate', 'saturate', 100, '%', 0, 300)}{filt('Tons de cinza', 'grayscale', 'grayscale', 0, '%', 0, 100)}</Row>
            <Row>{filt('Matiz', 'hue-rotate', 'hue', 0, '°', -360, 360)}{fxUsed && !off && <button type="button" className="btn" onClick={() => void c.set({ fx: null })}><Icon name="close" size={13} /> Limpar</button>}</Row>
          </div>
        )}
      </div>
    </Section>
  );
}
