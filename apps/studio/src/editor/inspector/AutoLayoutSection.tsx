// Auto layout (flexbox e grid de verdade): modo em 4 cartões, espaço entre itens, respiro interno, alinhamento e, nos itens, as regras do filho.
import { useState } from 'react';
import { cleanTrackList } from '@stylo/core/model.js';
import { Cap, Check, Hint, IconBtn, Num, Row, Section, Sel, Txt } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import { useApp } from '../../lib/app';
import { t } from '../../lib/i18n';
import type { Ctx } from './ctx';
import type { LayerNode } from '../../lib/types';

const MODES: { v: string; icon: string; name: string; css: string; tip: string }[] = [
  { v: 'none', icon: 'free', name: 'Livre', css: 'absolute', tip: 'Cada camada fica exatamente onde você a coloca (position: absolute).' },
  { v: 'row', icon: 'autolayout', name: 'Linha', css: 'flex · row', tip: 'display: flex; flex-direction: row — os itens se enfileiram lado a lado.' },
  { v: 'column', icon: 'rows', name: 'Coluna', css: 'flex · column', tip: 'display: flex; flex-direction: column — os itens se empilham.' },
  { v: 'grid', icon: 'grid', name: 'Grade', css: 'grid', tip: 'display: grid — uma tabela invisível de colunas e linhas.' },
];
const JUSTIFY: [string, string][] = [['flex-start', 'flex-start'], ['center', 'center'], ['flex-end', 'flex-end'], ['space-between', 'space-between'], ['space-around', 'space-around'], ['space-evenly', 'space-evenly']];
const ALIGN: [string, string][] = [['flex-start', 'flex-start'], ['center', 'center'], ['flex-end', 'flex-end'], ['stretch', 'stretch'], ['baseline', 'baseline']];
const GRID_ALIGN: [string, string][] = [['flex-start', 'start'], ['center', 'center'], ['flex-end', 'end'], ['stretch', 'stretch']];
const THREE = ['flex-start', 'center', 'flex-end'];
const TRACK_PRESETS: [string, string][] = [
  ['', 'Escolher um modelo…'], ['repeat(2, minmax(0, 1fr))', '2 colunas iguais'], ['repeat(3, minmax(0, 1fr))', '3 colunas iguais'], ['repeat(4, minmax(0, 1fr))', '4 colunas iguais'],
  ['repeat(auto-fit, minmax(180px, 1fr))', 'Cards responsivos (mín. 180 px)'], ['240px minmax(0, 1fr)', 'Lateral + conteúdo'],
];

type Sides4 = [number, number, number, number];

/** Quatro lados (topo, direita, base, esquerda): dois campos (↔ ↕) ou os quatro, alternável. */
export function SidesFields({ value, onChange, disabled, titles }: { value: Sides4; onChange: (v: Sides4) => void; disabled?: boolean; titles: string }) {
  const [open, setOpen] = useState(false);
  const asym = value[0] !== value[2] || value[1] !== value[3];
  const all = open || asym;
  const set = (i: number, v: number | null) => { const next = [...value] as Sides4; next[i] = Math.max(0, v ?? 0); onChange(next); };
  if (all) {
    return (
      <div className="sides4">
        <Row><Num label="T" value={value[0]} min={0} decimals={0} disabled={disabled} title={`${titles}-top`} onCommit={(v) => set(0, v)} /><Num label="R" value={value[1]} min={0} decimals={0} disabled={disabled} title={`${titles}-right`} onCommit={(v) => set(1, v)} /></Row>
        <Row><Num label="L" value={value[3]} min={0} decimals={0} disabled={disabled} title={`${titles}-left`} onCommit={(v) => set(3, v)} /><Num label="B" value={value[2]} min={0} decimals={0} disabled={disabled} title={`${titles}-bottom`} onCommit={(v) => set(2, v)} /></Row>
      </div>
    );
  }
  return (
    <Row>
      <Num label="↔" value={value[3]} min={0} decimals={0} disabled={disabled} title={`${titles} horizontal`} onCommit={(v) => { const n = Math.max(0, v ?? 0); onChange([value[0], n, value[2], n]); }} />
      <Num label="↕" value={value[0]} min={0} decimals={0} disabled={disabled} title={`${titles} vertical`} onCommit={(v) => { const n = Math.max(0, v ?? 0); onChange([n, value[1], n, value[3]]); }} />
      <IconBtn icon="corner" title={`${titles} por lado`} on={open} onClick={() => setOpen(!open)} />
    </Row>
  );
}

function Matrix({ c, grid }: { c: Ctx; grid: boolean }) {
  const L = c.n.layout!;
  const col = L.mode === 'column';
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < 3; r++) {
    for (let k = 0; k < 3; k++) {
      const [mainI, crossI] = col ? [r, k] : [k, r];
      const j = THREE[mainI], a = THREE[crossI];
      const on = L.justify === j && L.align === a;
      cells.push(<button key={`${r}${k}`} type="button" className={`al-cell${on ? ' on' : ''}`} aria-pressed={on} aria-label={`${grid ? 'justify-items' : 'justify-content'}: ${j}; align-items: ${a}`} disabled={c.readOnly} onClick={() => void c.set({ layout: { justify: j, align: a } })}><i /></button>);
    }
  }
  const language = useApp((s) => s.language);
  return <div className="al-matrix" title={t(language, 'inspector.layout.quickAlign')}>{cells}</div>;
}

function GridPicker({ c }: { c: Ctx }) {
  const N = 6;
  const language = useApp((s) => s.language);
  const L = c.n.layout!;
  const [hover, setHover] = useState<[number, number] | null>(null);
  const cur: [number, number] = [L.cols ?? 2, L.rows || Math.ceil(Math.max(1, (c.n.children ?? []).filter((k) => !k.absolute).length) / (L.cols ?? 2))];
  const [pc, pr] = hover ?? cur;
  return (
    <div className="grid-picker" onMouseLeave={() => setHover(null)}>
      <div className="gp-cells" role="grid" aria-label={t(language, 'inspector.layout.chooseGrid')}>
        {Array.from({ length: N * N }, (_, i) => {
          const cc = i % N, rr = Math.floor(i / N);
          return <button key={i} type="button" className={`gp-cell${cc < pc && rr < pr ? (hover ? ' hover' : ' on') : ''}`} aria-label={`${cc + 1} colunas × ${rr + 1} linhas`} disabled={c.readOnly}
            onMouseEnter={() => setHover([cc + 1, rr + 1])} onClick={() => void c.set({ layout: { cols: cc + 1, rows: rr + 1, colsTemplate: '', rowsTemplate: '' } })} />;
        })}
      </div>
      <div className="gp-label">{L.colsTemplate || L.rowsTemplate ? 'Trilhas CSS personalizadas' : `${pc} × ${hover ? pr : L.rows ? L.rows : 'auto'}`}</div>
    </div>
  );
}

export function AutoLayoutSection({ c }: { c: Ctx }) {
  const { n } = c;
  const language = useApp((s) => s.language);
  const tr = (key: string) => t(language, key);
  const L = n.layout!;
  const off = c.readOnly;
  const mode = L.mode;
  const modes = MODES.map((m) => ({ ...m, name: tr(m.v === 'none' ? 'inspector.layout.free' : m.v === 'row' ? 'inspector.layout.row' : m.v === 'column' ? 'inspector.layout.column' : 'inspector.layout.grid') }));
  const [split, setSplit] = useState(false);
  const [tracksOpen, setTracksOpen] = useState(false);
  const setL = (patch: Record<string, unknown>) => void c.set({ layout: patch });
  const grid = mode === 'grid';
  const mainArrow = mode === 'row' ? '↔' : '↕', crossArrow = mode === 'row' ? '↕' : '↔';
  const pad = (L.padding ?? [0, 0, 0, 0]) as Sides4;
  const gapSplit = split || (L.colGap ?? 8) !== (L.rowGap ?? 8);
  const trackError = (v: string, prop: string) => !!v.trim() && (!cleanTrackList(v) || (typeof CSS !== 'undefined' && !CSS.supports(prop, cleanTrackList(v))));

  return (
    <Section id="layout" title={tr('inspector.layout.title')} badge={<span className="al-badge" title={language === 'en-US' ? 'What you configure here becomes real flexbox and grid in the browser and export.' : 'O que você configura aqui vira flexbox e grid de verdade no navegador e na exportação'}>{tr('inspector.layout.cssPure')}</span>}>
      <div className="al-modes">
        {modes.map((m) => (
          <button key={m.v} type="button" className={`al-mode${mode === m.v ? ' on' : ''}`} aria-pressed={mode === m.v} title={m.tip} disabled={off} onClick={() => void c.set({ layout: { mode: m.v } })}>
            <Icon name={m.icon} size={20} /><span className="al-mode-name">{m.name}</span><span className="al-mode-css">{m.css}</span>
          </button>
        ))}
      </div>
      {mode === 'none' && <Hint>{tr('inspector.layout.noLayout')}</Hint>}

      {mode !== 'none' && grid && (
        <>
          <Cap label={tr('inspector.layout.quickGrid')} css="grid-template"><GridPicker c={c} /></Cap>
          <Row>
            <Cap label={tr('inspector.layout.columns')} css="grid-template-columns"><Num label="col" value={L.cols ?? 2} min={1} decimals={0} disabled={off} onCommit={(v) => setL({ cols: Math.max(1, Math.round(v ?? 1)), colsTemplate: '' })} /></Cap>
            <Cap label={tr('inspector.layout.rows')} css="grid-template-rows"><Num label="lin" value={L.rows ?? 0} min={0} decimals={0} disabled={off} onCommit={(v) => setL({ rows: Math.max(0, Math.round(v ?? 0)), rowsTemplate: '' })} /></Cap>
          </Row>
          <div className="fold">
            <button type="button" className="fold-head" aria-expanded={tracksOpen || !!(L.colsTemplate || L.rowsTemplate)} onClick={() => setTracksOpen(!tracksOpen)}>
              <Icon name={tracksOpen || L.colsTemplate || L.rowsTemplate ? 'chevrondown' : 'chevron'} size={12} /> {tr('inspector.layout.customTracks')}
            </button>
            {(tracksOpen || !!(L.colsTemplate || L.rowsTemplate)) && (
              <div className="fold-body">
                <Sel value="" options={[[ '', tr('inspector.layout.chooseModel') ], ...TRACK_PRESETS.slice(1)]} disabled={off} title={tr('inspector.layout.chooseModel')} onChange={(v) => { if (v) setL({ colsTemplate: cleanTrackList(v) }); }} />
                <Cap label={tr('inspector.layout.columns')} css="grid-template-columns"><Txt mono value={L.colsTemplate ?? ''} placeholder="200px 1fr 2fr" disabled={off} onCommit={(v) => { if (!trackError(v, 'grid-template-columns')) setL({ colsTemplate: cleanTrackList(v) || '' }); }} /></Cap>
                <Cap label={tr('inspector.layout.rows')} css="grid-template-rows"><Txt mono value={L.rowsTemplate ?? ''} placeholder="auto 1fr auto" disabled={off} onCommit={(v) => { if (!trackError(v, 'grid-template-rows')) setL({ rowsTemplate: cleanTrackList(v) || '' }); }} /></Cap>
                <Hint>{tr('inspector.layout.trackHint')}</Hint>
              </div>
            )}
          </div>
          <Cap label={tr('inspector.layout.cellGap')} css="gap">
            {gapSplit ? (
              <Row>
                <Num label="↔" value={L.colGap ?? 8} min={0} decimals={0} disabled={off} title="column-gap" onCommit={(v) => setL({ colGap: Math.max(0, v ?? 0) })} />
                <Num label="↕" value={L.rowGap ?? 8} min={0} decimals={0} disabled={off} title="row-gap" onCommit={(v) => setL({ rowGap: Math.max(0, v ?? 0) })} />
                <IconBtn icon="link" title={tr('inspector.layout.joinGaps')} onClick={() => { setSplit(false); setL({ rowGap: L.colGap ?? 8 }); }} />
              </Row>
            ) : (
              <Row>
                <Num label="⇔" value={L.colGap ?? 8} min={0} decimals={0} disabled={off} title="gap" onCommit={(v) => setL({ colGap: Math.max(0, v ?? 0), rowGap: Math.max(0, v ?? 0) })} />
                <IconBtn icon="corner" title={tr('inspector.layout.splitGaps')} onClick={() => setSplit(true)} />
              </Row>
            )}
          </Cap>
          <Cap label={tr('inspector.layout.padding')} css="padding"><SidesFields value={pad} disabled={off} titles="padding" onChange={(v) => setL({ padding: v })} /></Cap>
          <Cap label={tr('inspector.layout.cellPosition')} css="justify-items">
            <Row wide>
              <Matrix c={c} grid />
              <div className="col">
                <div className="sub-label">justify-items {mainArrow}</div>
                <Sel value={L.justify} options={GRID_ALIGN} disabled={off} title="justify-items" onChange={(v) => setL({ justify: v })} />
                <div className="sub-label">align-items {crossArrow}</div>
                <Sel value={L.align} options={GRID_ALIGN} disabled={off} title="align-items" onChange={(v) => setL({ align: v })} />
              </div>
            </Row>
          </Cap>
          {!off && (
            <button type="button" className="btn block" title={tr('inspector.layout.fillCellsHint')} onClick={() => void (async () => {
              const kids = (n.children ?? []).filter((k) => !k.absolute);
              const { run } = await import('../../lib/app');
              if (kids.length) await run('update_layers', { updates: kids.map((k) => ({ id: k.id, props: { sizeX: 'fill', sizeY: 'fill' } })) });
            })()}><Icon name="grid" size={13} /> {tr('inspector.layout.fillCells')}</button>
          )}
        </>
      )}

      {mode !== 'none' && !grid && (
        <>
          <Row>
            <Cap label={tr('inspector.layout.itemGap')} css="gap"><Num label={mainArrow} value={L.gap} min={0} decimals={0} disabled={off} onCommit={(v) => setL({ gap: Math.max(0, v ?? 0) })} /></Cap>
            <Cap label={tr('inspector.layout.wrap')} css="flex-wrap"><div className="al-check"><Check label="wrap" checked={!!L.wrap} disabled={off} onChange={(v) => setL({ wrap: v })} /></div></Cap>
          </Row>
          <Cap label={tr('inspector.layout.padding')} css="padding"><SidesFields value={pad} disabled={off} titles="padding" onChange={(v) => setL({ padding: v })} /></Cap>
          <Cap label={tr('inspector.layout.alignment')} css="justify-content">
            <Row wide>
              <Matrix c={c} grid={false} />
              <div className="col">
                <div className="sub-label">justify-content {mainArrow}</div>
                <Sel value={L.justify} options={JUSTIFY} disabled={off} title="justify-content" onChange={(v) => setL({ justify: v })} />
                <div className="sub-label">align-items {crossArrow}</div>
                <Sel value={L.align} options={ALIGN} disabled={off} title="align-items" onChange={(v) => setL({ align: v })} />
              </div>
            </Row>
          </Cap>
        </>
      )}
    </Section>
  );
}

/** Regras do FILHO dentro de um auto layout: fora do fluxo, margem, alinhamento próprio, colunas/linhas ocupadas, peso, ordem. */
export function FlowItemSection({ c }: { c: Ctx }) {
  const { n, parent } = c;
  const language = useApp((s) => s.language);
  const tr = (key: string) => t(language, key);
  const off = c.readOnly;
  const [marginOpen, setMarginOpen] = useState(false);
  if (!parent || c.parentLayout === 'none') return null;
  const grid = c.parentLayout === 'grid';
  const mg = ((n as LayerNode).margin ?? [0, 0, 0, 0]) as Sides4;
  const selfOpts: [string, string][] = [['auto', 'auto'], ['flex-start', grid ? 'start' : 'flex-start'], ['center', 'center'], ['flex-end', grid ? 'end' : 'flex-end'], ['stretch', 'stretch']];
  const selfValue = (key: 'alignSelf' | 'justifySelf', axis: 'sizeX' | 'sizeY') => (n[axis] === 'fill' ? 'stretch' : (n[key] as string) || 'auto');
  const setSelf = (key: 'alignSelf' | 'justifySelf', axis: 'sizeX' | 'sizeY') => (v: string) => {
    if (v === 'stretch') void c.set({ [axis]: 'fill', [key]: 'auto' });
    else void c.set({ ...(n[axis] === 'fill' ? { [axis]: 'fixed' } : {}), [key]: v });
  };
  const cross = c.parentLayout === 'row' ? 'sizeY' : 'sizeX';
  const main = c.parentLayout === 'row' ? 'sizeX' : 'sizeY';
  void marginOpen; void setMarginOpen;
  return (
    <Section id="item" title={tr('inspector.layout.item')}>
      <Check label={tr('inspector.layout.absolute')} checked={!!n.absolute} disabled={off || !c.single} title={tr('inspector.layout.absolute')} onChange={(v) => void c.set({ absolute: v })} />
      {!n.absolute && (
        <>
          <Cap label={tr('inspector.layout.margin')} css="margin"><SidesFields value={mg} disabled={off} titles="margin" onChange={(v) => void c.set({ margin: v.every((x) => !x) ? null : v })} /></Cap>
          {grid ? (
            <>
              <Row>
                <Cap label={tr('inspector.layout.spanColumns')} css="grid-column"><Num label="span" value={n.colSpan ?? 1} min={1} decimals={0} disabled={off} onCommit={(v) => void c.set({ colSpan: Math.max(1, Math.round(v ?? 1)) })} /></Cap>
                <Cap label={tr('inspector.layout.spanRows')} css="grid-row"><Num label="span" value={n.rowSpan ?? 1} min={1} decimals={0} disabled={off} onCommit={(v) => void c.set({ rowSpan: Math.max(1, Math.round(v ?? 1)) })} /></Cap>
              </Row>
              <Row>
                <Cap label={tr('inspector.layout.horizontalCell')} css="justify-self"><Sel value={selfValue('justifySelf', 'sizeX')} options={selfOpts} disabled={off} onChange={setSelf('justifySelf', 'sizeX')} /></Cap>
                <Cap label={tr('inspector.layout.verticalCell')} css="align-self"><Sel value={selfValue('alignSelf', 'sizeY')} options={selfOpts} disabled={off} onChange={setSelf('alignSelf', 'sizeY')} /></Cap>
              </Row>
            </>
          ) : (
            <>
              <Cap label={tr('inspector.layout.itemAlign')} css="align-self"><Sel value={selfValue('alignSelf', cross)} options={selfOpts} disabled={off} onChange={setSelf('alignSelf', cross)} /></Cap>
              {n[main] === 'fill' && (
                <Cap label={tr('inspector.layout.grow')} css="flex-grow"><Num label="×" value={n.grow ?? 1} min={0.1} step={0.5} decimals={1} disabled={off} onCommit={(v) => void c.set({ grow: v && v > 0 && v !== 1 ? v : null })} /></Cap>
              )}
            </>
          )}
          <Row>
            <Cap label={tr('inspector.layout.order')} css="order"><Num label="#" value={n.order ?? 0} min={-99} max={99} decimals={0} disabled={off} title={tr('inspector.layout.order')} onCommit={(v) => void c.set({ order: Math.round(v ?? 0) || null })} /></Cap>
            {!grid && <Cap label={tr('inspector.layout.shrink')} css="flex-shrink"><Sel value={n.shrink ? '1' : ''} options={[['', language === 'en-US' ? 'No (0)' : 'Não (0)'], ['1', language === 'en-US' ? 'Yes (1)' : 'Sim (1)']]} disabled={off} onChange={(v) => void c.set({ shrink: v ? true : null })} /></Cap>}
          </Row>
        </>
      )}
    </Section>
  );
}
