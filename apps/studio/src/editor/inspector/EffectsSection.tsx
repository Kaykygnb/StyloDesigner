// Efeitos: sombras (externas e internas), desfoque da camada, vidro (desfoque do fundo) e filtros de cor.
import { useState } from 'react';
import { defaultShadow } from '@stylo/core/model.js';
import { colorGroups } from '../../lib/colors';
import { useApp } from '../../lib/app';
import { t } from '../../lib/i18n';
import { ColorRow } from '../../ui/ColorPicker';
import { Cap, Check, IconBtn, Num, Row, Section, Sel } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import type { Ctx } from './ctx';

type Shadow = { x: number; y: number; blur: number; spread: number; color: string; opacity: number; inset: boolean };

export function EffectsSection({ c }: { c: Ctx }) {
  const { n, doc } = c;
  const language = useApp((s) => s.language);
  const tr = (key: string) => t(language, key);
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
  const presetLabels = language === 'en-US'
    ? [['soft', 'Soft shadow'], ['elevated', 'Elevated'], ['inner', 'Inner shadow'], ['glow', 'Glow'], ['glass', 'Glass']]
    : [['soft', 'Sombra suave'], ['elevated', 'Sombra elevada'], ['inner', 'Sombra interna'], ['glow', 'Glow'], ['glass', 'Vidro']];
  const applyPreset = (name: string) => {
    const base = { x: 0, y: 8, blur: 24, spread: 0, color: '#000000', opacity: 0.16, inset: false };
    const preset = name === 'elevated' ? { ...base, y: 14, blur: 32, opacity: 0.22 }
      : name === 'inner' ? { ...base, y: 2, blur: 8, opacity: 0.22, inset: true }
      : name === 'glow' ? { ...base, y: 0, blur: 20, color: '#4C8DFF', opacity: 0.42 }
      : name === 'glass' ? null : { ...base, y: 4, blur: 16, opacity: 0.14 };
    void c.set({ shadows: preset ? [preset] : [], ...(name === 'glass' ? { bgBlur: 18 } : {}) });
  };
  const filt = (label: string, css: string, key: string, def: number, unit: string, min: number, max: number) => (
      <Cap label={label} css={css}><Num value={fx[key] ?? def} min={min} max={max} decimals={0} unit={unit} disabled={off} onCommit={setFx(key, def)} /></Cap>
  );

  return (
    <Section id="effects" title={tr('inspector.effects.title')} defaultOpen={shadows.length > 0 || n.blur > 0 || n.bgBlur > 0 || fxUsed}
      right={!off ? <IconBtn icon="plus" title={tr('inspector.effects.addShadow')} onClick={() => void c.set({ shadows: [...shadows, defaultShadow()] })} /> : undefined}>
      {effectStyles.length > 0 && (
        <Sel value={n.effectStyleId ?? ''} options={[['', tr('inspector.effects.ownShadow')], ...effectStyles.map((e) => [e.id, e.name] as [string, string])]} disabled={off} title={tr('inspector.effects.shadowStyle')} onChange={(v) => void c.set({ effectStyleId: v || null })} />
      )}
      {!off && <div className="effect-presets" aria-label={language === 'en-US' ? 'Effect presets' : 'Presets de efeito'}>
        {presetLabels.map(([id, label]) => <button key={id} type="button" className="btn ghost sm" onClick={() => applyPreset(id)}>{label}</button>)}
      </div>}
      {shadows.map((s, i) => (
        <div className="effect-card" key={i}>
          <Row>
            <Cap label={tr('inspector.effects.horizontal')} css="box-shadow"><Num label="X" value={s.x} decimals={0} disabled={off} onCommit={(v) => setShadow(i, { x: v ?? 0 })} /></Cap>
            <Cap label={tr('inspector.effects.vertical')}><Num label="Y" value={s.y} decimals={0} disabled={off} onCommit={(v) => setShadow(i, { y: v ?? 0 })} /></Cap>
          </Row>
          <Row>
            <Cap label={tr('inspector.effects.blur')}><Num label="B" value={s.blur} min={0} decimals={0} disabled={off} onCommit={(v) => setShadow(i, { blur: Math.max(0, v ?? 0) })} /></Cap>
            {!isText && <Cap label={tr('inspector.effects.spread')}><Num label="S" value={s.spread} decimals={0} disabled={off} onCommit={(v) => setShadow(i, { spread: v ?? 0 })} /></Cap>}
          </Row>
          <div className="effect-foot">
            <ColorRow color={s.color} opacity={s.opacity} groups={colorGroups(doc)} disabled={off} onChange={(hex, a) => setShadow(i, { color: hex, opacity: a })} />
          </div>
          <div className="effect-foot">
            {!isText && <Check label={tr('inspector.effects.inner')} checked={!!s.inset} disabled={off} onChange={(v) => setShadow(i, { inset: v })} />}
            <span className="spacer" />
            {!off && <IconBtn icon="minus" title={tr('inspector.effects.removeShadow')} onClick={() => void c.set({ shadows: shadows.filter((_, k) => k !== i) })} />}
          </div>
        </div>
      ))}
      <Row>
        <Cap label={tr('inspector.effects.blur')} css="blur"><Num label="◌" value={n.blur ?? 0} min={0} decimals={0} disabled={off} onCommit={(v) => void c.set({ blur: Math.max(0, v ?? 0) })} /></Cap>
        {!isText && <Cap label={tr('inspector.effects.glass')} css="backdrop-filter"><Num label="▨" value={n.bgBlur ?? 0} min={0} decimals={0} disabled={off} onCommit={(v) => void c.set({ bgBlur: Math.max(0, v ?? 0) })} /></Cap>}
      </Row>
      <div className="fold">
        <button type="button" className="fold-head" aria-expanded={filtersOpen || fxUsed} onClick={() => setFiltersOpen(!filtersOpen)}>
          <Icon name={filtersOpen || fxUsed ? 'chevrondown' : 'chevron'} size={12} /> {tr('inspector.effects.filters')}{fxUsed && <span className="dot-on" />}
        </button>
        {(filtersOpen || fxUsed) && (
          <div className="fold-body">
            <Row>{filt(tr('inspector.effects.brightness'), 'brightness', 'brightness', 100, '%', 0, 300)}{filt(tr('inspector.effects.contrast'), 'contrast', 'contrast', 100, '%', 0, 300)}</Row>
            <Row>{filt(tr('inspector.effects.saturation'), 'saturate', 'saturate', 100, '%', 0, 300)}{filt(tr('inspector.effects.grayscale'), 'grayscale', 'grayscale', 0, '%', 0, 100)}</Row>
            <Row>{filt(tr('inspector.effects.hue'), 'hue-rotate', 'hue', 0, '°', -360, 360)}{fxUsed && !off && <button type="button" className="btn" onClick={() => void c.set({ fx: null })}><Icon name="close" size={13} /> {tr('inspector.effects.clear')}</button>}</Row>
          </div>
        )}
      </div>
      {!off && (shadows.length > 0 || n.blur > 0 || n.bgBlur > 0 || fxUsed) && <button type="button" className="btn ghost sm effect-clear" onClick={() => void c.set({ shadows: null, blur: null, bgBlur: null, fx: null, effectStyleId: null })}>{language === 'en-US' ? 'Clear effects' : 'Limpar efeitos'}</button>}
    </Section>
  );
}
