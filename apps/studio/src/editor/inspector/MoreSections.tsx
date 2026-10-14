// As seções menores do painel: Componente, Estados, HTML, Nota, Grades de layout, Vetor, CSS livre e Exportar.
import { useEffect, useState } from 'react';
import { BOX_TAGS, TEXT_TAGS, STATE_LIST, canHaveStates, hasStates, htmlTagIn, tagOf } from '@stylo/core/model.js';
import { tool as api_tool } from '../../lib/api';
import { app, run, toast, useApp } from '../../lib/app';
import { t } from '../../lib/i18n';
import { arrange, noteOn, selectMainOf } from '../../lib/editing';
import { colorGroups } from '../../lib/colors';
import { ColorRow } from '../../ui/ColorPicker';
import { Area, Cap, Check, Hint, IconBtn, Num, Row, Section, Seg, Sel, Txt } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import { parentOf } from '../../lib/doc';
import { shapePoints } from '../../lib/shapes';
import { askText } from '../../ui/Dialog';
import type { Ctx } from './ctx';
import type { StateName } from '../../lib/app';

// ---------------------------------------------------------------- Operações vetoriais
export function BooleanSection({ c }: { c: Ctx }) {
  const language = useApp((s) => s.language);
  const tr = (key: string) => t(language, key);
  const supported = c.nodes.length >= 2 && c.nodes.every((x) => ['path', 'rect', 'ellipse', 'frame'].includes(x.type));
  if (c.bp || c.editState || c.readOnly) return null;
  const action = (name: 'boolean_union' | 'boolean_subtract' | 'boolean_intersect' | 'boolean_exclude') => void arrange(name);
  return (
    <Section id="boolean" title={tr('inspector.boolean.title')} defaultOpen={supported}>
      <Hint>{supported ? tr('inspector.boolean.goodHint') : tr('inspector.boolean.chooseHint')}</Hint>
      <div className="row wrap">
        <button type="button" className="btn" data-bool="union" disabled={!supported} onClick={() => action('boolean_union')}>{tr('inspector.boolean.union')}</button>
        <button type="button" className="btn" data-bool="subtract" disabled={!supported} onClick={() => action('boolean_subtract')}>{tr('inspector.boolean.subtract')}</button>
        <button type="button" className="btn" data-bool="intersect" disabled={!supported} onClick={() => action('boolean_intersect')}>{tr('inspector.boolean.intersect')}</button>
        <button type="button" className="btn" data-bool="exclude" disabled={!supported} onClick={() => action('boolean_exclude')}>{tr('inspector.boolean.exclude')}</button>
      </div>
    </Section>
  );
}

/** Fontes preservadas de uma booleana. A edição passa pelo MCP/runner para manter o mesmo histórico do editor. */
export function BooleanSourcesSection({ c }: { c: Ctx }) {
  const language = useApp((s) => s.language);
  const tr = (key: string) => t(language, key);
  const boolean = (c.n as LayerNodeWithBoolean).boolean;
  const [sourceIndex, setSourceIndex] = useState(0);
  const [pointKey, setPointKey] = useState('0:0');
  const sources = boolean?.sources ?? [];
  const index = Math.min(sourceIndex, Math.max(0, sources.length - 1));
  const edit = (patch: Record<string, number | boolean | string>) => void run('edit_boolean_source', { id: c.n.id, source_index: index, ...patch });
  const source = sources[index] ?? { rings: [] };
  const pointOptions = source.rings.flatMap((ring, contourIndex) => ring.map((_, pointIndex) => [String(`${contourIndex}:${pointIndex}`), `Contorno ${contourIndex + 1} · ponto ${pointIndex + 1}`] as [string, string]));
  useEffect(() => { if (!pointOptions.some(([value]) => value === pointKey)) setPointKey(pointOptions[0]?.[0] ?? '0:0'); }, [index, pointOptions.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [contourText, pointText] = pointKey.split(':');
  const contourIndex = Number(contourText) || 0;
  const pointIndex = Number(pointText) || 0;
  const point = source.rings[contourIndex]?.[pointIndex];
  const structuredPoint = source.contours?.[contourIndex]?.points?.[pointIndex];
  if (!c.single || c.bp || c.editState || !sources.length) return null;
  return (
    <Section id="boolean-sources" title={tr('inspector.boolean.sources')} defaultOpen>
      <Hint>{boolean?.op === 'subtract' ? tr('inspector.boolean.baseHint') : tr('inspector.boolean.editableHint')}</Hint>
      <Sel
        value={String(index)}
        options={sources.map((source, i) => [`${i}`, `${tr('inspector.boolean.source')} ${i + 1}${source.name ? ` · ${source.name}` : ''}`] as [string, string])}
        disabled={c.readOnly}
        title={tr('inspector.boolean.sourceTitle')}
        onChange={(value) => setSourceIndex(Math.max(0, Number(value) || 0))}
      />
      <Row>
        <Num label="↔" value={0} unit="px" step={1} decimals={1} disabled={c.readOnly} title={tr('inspector.boolean.moveHorizontal')} onCommit={(value) => edit({ dx: value ?? 0 })} />
        <Num label="↕" value={0} unit="px" step={1} decimals={1} disabled={c.readOnly} title={tr('inspector.boolean.moveVertical')} onCommit={(value) => edit({ dy: value ?? 0 })} />
      </Row>
      <Cap label={tr('inspector.boolean.scale')} css="transform"><Num label="×" value={1} min={0.1} max={10} step={0.05} decimals={2} disabled={c.readOnly} title={tr('inspector.boolean.scaleTitle')} onCommit={(value) => edit({ scale: value ?? 1 })} /></Cap>
      {pointOptions.length > 0 && <Cap label={tr('inspector.boolean.editPoint')} css="geometria"><Sel value={pointKey} options={pointOptions} disabled={c.readOnly} title={tr('inspector.boolean.pointTitle')} onChange={setPointKey} /><Row><Num label="X" value={point?.x} decimals={2} disabled={c.readOnly || !point} title={tr('inspector.boolean.pointX')} onCommit={(value) => value != null && edit({ contour_index: contourIndex, point_index: pointIndex, x: value })} /><Num label="Y" value={point?.y} decimals={2} disabled={c.readOnly || !point} title={tr('inspector.boolean.pointY')} onCommit={(value) => value != null && edit({ contour_index: contourIndex, point_index: pointIndex, y: value })} /></Row>{structuredPoint && (structuredPoint.hin || structuredPoint.hout) && <><Hint>{tr('inspector.boolean.handleHint')}</Hint><Row><Num label="In X" value={structuredPoint.hin?.x} decimals={2} disabled={c.readOnly} title={tr('inspector.boolean.handleInX')} onCommit={(value) => value != null && edit({ contour_index: contourIndex, point_index: pointIndex, hin_x: value })} /><Num label="In Y" value={structuredPoint.hin?.y} decimals={2} disabled={c.readOnly} title={tr('inspector.boolean.handleInY')} onCommit={(value) => value != null && edit({ contour_index: contourIndex, point_index: pointIndex, hin_y: value })} /></Row><Row><Num label="Out X" value={structuredPoint.hout?.x} decimals={2} disabled={c.readOnly} title={tr('inspector.boolean.handleOutX')} onCommit={(value) => value != null && edit({ contour_index: contourIndex, point_index: pointIndex, hout_x: value })} /><Num label="Out Y" value={structuredPoint.hout?.y} decimals={2} disabled={c.readOnly} title={tr('inspector.boolean.handleOutY')} onCommit={(value) => value != null && edit({ contour_index: contourIndex, point_index: pointIndex, hout_y: value })} /></Row></>}</Cap>}
    </Section>
  );
}

type LayerNodeWithBoolean = Ctx['n'] & { boolean?: { op?: string; sources?: Array<{ id?: string; name?: string; type?: string; shape?: { kind?: string }; rings: Array<Array<{ x: number; y: number }>>; contours?: Array<{ points: Array<{ x: number; y: number; hin?: { x: number; y: number } | null; hout?: { x: number; y: number } | null }>; closed?: boolean }> }> } };
type LayerNodeWithShape = Ctx['n'] & { shape?: { kind: 'polygon' | 'star'; sides: number; innerRatio: number } };

// ---------------------------------------------------------------- Componente
export function ComponentSection({ c }: { c: Ctx }) {
  const { n, doc, page } = c;
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const off = c.readOnly;
  if (!c.single || c.bp) return null;
  const main = n.instanceOf ? (page.children.length ? findMain(page.children, n.instanceOf) : null) : null;
  void doc;
  return (
    <Section id="component" title={tr('inspector.component.title')}>
      {n.component ? (
        <>
          <div className="badge-pill purple"><Icon name="component" size={13} /> {tr('inspector.component.main')}</div>
          <Hint>{tr('inspector.component.mainHint')}</Hint>
          <button type="button" className="btn block" disabled={off} onClick={() => void run('create_instance', { component_id: n.id }).then((r: { created?: { id: string } } | undefined) => { if (r?.created?.id) app.set({ selection: [r.created.id] }); })}><Icon name="plus" size={13} /> {tr('inspector.component.createInstance')}</button>
        </>
      ) : n.instanceOf ? (
        <>
          <div className="badge-pill purple"><Icon name="component" size={13} /> {tr('inspector.component.instanceOf', { name: main?.name ?? '?' })}</div>
          <Row>
            <button type="button" className="btn grow" onClick={() => selectMainOf(n.id)}>{tr('inspector.component.goMain')}</button>
            <button type="button" className="btn grow" disabled={off} onClick={() => void arrange('detach_instance')}>{tr('inspector.component.detach')}</button>
          </Row>
        </>
      ) : (
        <button type="button" className="btn block" disabled={off} onClick={() => void arrange('create_component')}><Icon name="component" size={13} /> {tr('inspector.component.create')}</button>
      )}
    </Section>
  );
}
function findMain(list: Ctx['nodes'], id: string): Ctx['n'] | null {
  for (const x of list) { if (x.id === id) return x; const r = x.children && findMain(x.children, id); if (r) return r; }
  return null;
}

// ---------------------------------------------------------------- Estados
const CURSORS: [string, string][] = [['', 'Padrão'], ['pointer', 'Mãozinha (pointer)'], ['text', 'Texto (text)'], ['grab', 'Mão aberta (grab)'], ['not-allowed', 'Bloqueado (not-allowed)'], ['default', 'Seta (default)']];
const EASINGS: [string, string][] = [['ease', 'Suave (ease)'], ['ease-in-out', 'Entra e sai (ease-in-out)'], ['ease-out', 'Desacelera (ease-out)'], ['ease-in', 'Acelera (ease-in)'], ['linear', 'Constante (linear)']];
const STATE_KEYS: Record<string, string> = { hover: 'ui.states.hover', active: 'ui.states.active', focus: 'ui.states.focus' };
const STICKY: [string, string][] = [['', 'Não'], ['0', 'No topo (0px)'], ['16', '16px do topo'], ['64', '64px do topo']];

export function StatesSection({ c }: { c: Ctx }) {
  const { base, n, bp } = c;
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const off = c.readOnly;
  if (!c.single || bp || !canHaveStates(base as never)) return null;
  const cur = c.editState;
  const tabs: [StateName | '', string][] = [['', tr('inspector.states.normal')], ...(STATE_LIST as [StateName, string, string][]).map(([k, l]) => [k, STATE_KEYS[k] ? tr(STATE_KEYS[k]) : l] as [StateName, string])];
  return (
    <Section id="states" title={tr('inspector.states.title')} defaultOpen={!!cur || hasStates(base as never, undefined as never)}>
      <div className="segmented wide states">
        {tabs.map(([k, label]) => (
          <button key={k || 'normal'} type="button" className={(cur ?? '') === k ? 'on' : ''} onClick={() => app.set({ editState: k || null })}>
            {label}{k && hasStates(base as never, k) ? <span className="dot-on" /> : null}
          </button>
        ))}
      </div>
      {cur ? (
        <>
          <Hint>{tr('inspector.states.editing', { state: STATE_KEYS[cur as string] ? tr(STATE_KEYS[cur as string]) : (STATE_LIST as string[][]).find(([k]) => k === cur)?.[1] ?? cur, css: (STATE_LIST as string[][]).find(([k]) => k === cur)?.[2] ?? cur })}</Hint>
          <Cap label={tr('inspector.states.scale')} css="transform"><Num label="×" value={Number((n as { scale?: number }).scale ?? 1)} min={0.1} max={3} step={0.01} decimals={2} disabled={off} onCommit={(v) => void c.set({ scale: v ?? 1 })} /></Cap>
          {hasStates(base as never, cur) && !off && <button type="button" className="btn" onClick={() => void run('set_state', { id: base.id, state: cur, reset: true })}><Icon name="close" size={13} /> {tr('inspector.states.clear')}</button>}
        </>
      ) : (
        <>
          <Row>
            <Cap label={tr('inspector.states.duration')} css="transition"><Num label="ms" value={n.transition?.duration ?? 0} min={0} max={5000} step={50} decimals={0} disabled={off} onCommit={(v) => void c.set({ transition: v ? { duration: Math.round(v), easing: n.transition?.easing ?? 'ease' } : null })} /></Cap>
            <Cap label={tr('inspector.states.easing')} css="transition"><Sel value={n.transition?.easing ?? 'ease'} options={EASINGS.map(([value, label]) => [value, ({ ease: tr('inspector.states.smoothValue'), 'ease-in-out': tr('inspector.states.easeInOutValue'), 'ease-out': tr('inspector.states.easeOutValue'), 'ease-in': tr('inspector.states.easeInValue'), linear: tr('inspector.states.linearValue') } as Record<string, string>)[value] ?? label] as [string, string])} disabled={off || !n.transition} onChange={(v) => void c.set({ transition: { duration: n.transition?.duration ?? 200, easing: v } })} /></Cap>
          </Row>
          <Cap label={tr('inspector.states.cursor')} css="cursor"><Sel value={n.cursor ?? ''} options={CURSORS.map(([value, label]) => [value, ({ '': tr('inspector.states.default'), pointer: tr('inspector.states.pointerValue'), text: tr('inspector.states.textValue'), grab: tr('inspector.states.grabValue'), 'not-allowed': tr('inspector.states.blockedValue'), default: tr('inspector.states.arrowValue') } as Record<string, string>)[value] ?? label] as [string, string])} disabled={off} onChange={(v) => void c.set({ cursor: v || null })} /></Cap>
          <Row>
            <Cap label={tr('inspector.states.sticky')} css="sticky"><Sel value={n.sticky == null ? '' : String(n.sticky)} options={STICKY.map(([value, label]) => [value, ({ '': tr('inspector.states.no'), '0': tr('inspector.states.top'), '16': tr('inspector.states.top16'), '64': tr('inspector.states.top64') } as Record<string, string>)[value] ?? label] as [string, string])} disabled={off} onChange={(v) => void c.set({ sticky: v === '' ? null : Number(v) })} /></Cap>
            <Cap label={tr('inspector.states.pointer')} css="pointer-events"><Sel value={n.pointerEvents ?? ''} options={[['', tr('inspector.states.pointerNormal')], ['none', tr('inspector.states.pointerNone')]]} disabled={off} onChange={(v) => void c.set({ pointerEvents: v || null })} /></Cap>
          </Row>
        </>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- HTML
const TAG_NAMES: Record<string, string> = Object.fromEntries(['p', 'h1', 'h2', 'h3', 'span', 'a', 'label', 'li', 'button', 'div', 'section', 'header', 'footer', 'nav', 'main', 'aside', 'article', 'ul', 'ol', 'form'].map((tag) => [tag, `ui.html.tag.${tag}`]));

export function HtmlSection({ c }: { c: Ctx }) {
  const { n, page } = c;
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const off = c.readOnly;
  if (!c.single || c.bp || c.editState || n.type === 'line') return null;
  const isText = n.type === 'text';
  const tags = ((isText ? TEXT_TAGS : BOX_TAGS) as string[]).map((t) => [t, TAG_NAMES[t] ? tr(TAG_NAMES[t]) : t] as [string, string]);
  const tag = tagOf(n as never);
  // etiqueta que não vale onde a camada está (ex.: <li> fora de uma lista): o HTML exportado usa a padrão
  const chain: Ctx['n'][] = [];
  for (let a = parentOf(page.children, n.id); a; a = parentOf(page.children, a.id)) chain.unshift(a);
  const anc: string[] = [];
  for (const a of chain) anc.push(htmlTagIn(a as never, anc).tag);
  const check = htmlTagIn(n as never, anc);
  return (
    <Section id="html" title={tr('inspector.html.title')} defaultOpen={false}>
      <Cap label={tr('inspector.html.tag')} css="tag"><Sel value={tag} options={tags} disabled={off} title={tr('inspector.html.tagTitle')} onChange={(v) => void c.set({ tag: v })} /></Cap>
      {check.reason && <Hint warn>{tr('inspector.html.invalidTag', { tag: check.tag, reason: check.reason })}</Hint>}
      {tag === 'a' && <Cap label={tr('inspector.html.linkAddress')} css="href"><Txt value={n.href ?? ''} placeholder={tr('ui.more.linkPlaceholder')} disabled={off} onCommit={(v) => void c.set({ href: v.trim() || null })} /></Cap>}
      {tag === 'a' && <Row><Cap label={tr('inspector.html.openIn')} css="target"><Sel value={n.target ?? ''} options={[['', tr('inspector.html.sameTab')], ['_blank', tr('inspector.html.newTab')]]} disabled={off} onChange={(v) => void c.set({ target: v || null })} /></Cap></Row>}
      {tag === 'button' && <Cap label={tr('inspector.html.buttonType')} css="type"><Sel value={n.buttonType ?? ''} options={[['', tr('inspector.html.default')], ['button', 'button'], ['submit', 'submit'], ['reset', 'reset']]} disabled={off} onChange={(v) => void c.set({ buttonType: v || null })} /></Cap>}
      <Cap label={isText ? tr('inspector.html.textDescription') : tr('inspector.html.description')} css="aria-label"><Txt value={n.alt ?? ''} placeholder={isText ? tr('inspector.html.textPlaceholder') : tr('inspector.html.imagePlaceholder')} disabled={off} onCommit={(v) => void c.set({ alt: v.trim() || null })} /></Cap>
      <Row>
        <Cap label="Id" css="id"><Txt value={n.htmlId ?? ''} mono placeholder={tr('ui.more.idExample')} disabled={off} onCommit={(v) => void c.set({ htmlId: v.trim() || null })} /></Cap>
        <Cap label={tr('inspector.html.classes')} css="class"><Txt value={n.classes ?? ''} mono placeholder={tr('ui.more.classExample')} disabled={off} onCommit={(v) => void c.set({ classes: v.trim() || null })} /></Cap>
      </Row>
      <Row>
        <Cap label={tr('inspector.html.tooltip')} css="title"><Txt value={n.title ?? ''} disabled={off} onCommit={(v) => void c.set({ title: v.trim() || null })} /></Cap>
        <Cap label={tr('inspector.html.role')} css="role"><Txt value={n.role ?? ''} mono disabled={off} onCommit={(v) => void c.set({ role: v.trim() || null })} /></Cap>
      </Row>
    </Section>
  );
}

// ---------------------------------------------------------------- Nota
export function NoteSection({ c }: { c: Ctx }) {
  const { n } = c;
  const language = useApp((s) => s.language);
  const tr = (key: string) => t(language, key);
  if (!c.single || c.bp || c.editState) return null;
  // sempre à vista: a nota da camada vai para o mapa do projeto e o agente lê antes de construir
  return (
    <Section id="note" title={tr('inspector.note.title')} badge={n.note ? <span className="dot-on" /> : undefined}>
      {c.readOnly ? (n.note ? <p className="note-text">{n.note}</p> : <Hint>{tr('inspector.note.empty')}</Hint>) : (
        <textarea key={n.id} className="field layer-note" rows={2} defaultValue={n.note ?? ''} placeholder={tr('inspector.note.placeholder')}
          onKeyDown={(e) => e.stopPropagation()}
          onBlur={(e) => { const v = e.target.value.trim(); if (v !== (n.note ?? '')) void c.set({ note: v || null }); }} />
      )}
      {n.note && <Check label={tr('inspector.note.include')} checked={n.noteInCode !== false} disabled={c.readOnly} onChange={(v) => void c.set({ noteInCode: v ? null : false })} />}
    </Section>
  );
}

// ---------------------------------------------------------------- Grades de layout
type Grid = { type: 'columns' | 'rows' | 'grid'; count: number; gutter: number; margin: number; size: number; color: string; opacity: number };
export function GridsSection({ c }: { c: Ctx }) {
  const { n, doc } = c;
  const language = useApp((s) => s.language);
  const tr = (key: string) => t(language, key);
  const off = c.readOnly;
  if (n.type !== 'frame' || c.bp || c.editState) return null;
  const grids = (n.grids ?? []) as Grid[];
  const set = (i: number, patch: Partial<Grid>) => void c.set({ grids: grids.map((g, k) => (k === i ? { ...g, ...patch } : g)) });
  return (
    <Section id="grids" title={tr('inspector.grids.title')} defaultOpen={grids.length > 0}
      right={!off ? <IconBtn icon="plus" title={tr('inspector.grids.add')} onClick={() => void c.set({ grids: [...grids, { type: 'columns', count: 12, gutter: 16, margin: 24, size: 8, color: '#FF3D3D', opacity: 0.12 }] })} /> : undefined}>
      {!grids.length && <Hint>{tr('inspector.grids.hint')}</Hint>}
      {grids.map((g, i) => (
        <div className="effect-card" key={i}>
          <Sel value={g.type} options={[['columns', tr('inspector.grids.columns')], ['rows', tr('inspector.grids.rows')], ['grid', tr('inspector.grids.grid')]]} disabled={off} title={tr('inspector.grids.type')} onChange={(v) => set(i, { type: v as Grid['type'] })} />
          {g.type === 'grid'
            ? <Row><Num label="▦" value={g.size} min={2} decimals={0} disabled={off} title={tr('inspector.grids.cellSize')} onCommit={(v) => set(i, { size: Math.max(2, v ?? 8) })} /></Row>
            : (
              <>
                <Row><Num label="#" value={g.count} min={1} decimals={0} disabled={off} title={tr('inspector.grids.count')} onCommit={(v) => set(i, { count: Math.max(1, Math.round(v ?? 12)) })} /><Num label="↔" value={g.gutter} min={0} decimals={0} disabled={off} title={tr('inspector.grids.gutter')} onCommit={(v) => set(i, { gutter: Math.max(0, v ?? 0) })} /></Row>
                <Row><Num label="▏" value={g.margin} min={0} decimals={0} disabled={off} title={tr('inspector.grids.margin')} onCommit={(v) => set(i, { margin: Math.max(0, v ?? 0) })} /></Row>
              </>
            )}
          <div className="effect-foot">
            <ColorRow color={g.color} opacity={g.opacity} groups={colorGroups(doc)} disabled={off} onChange={(hex, a) => set(i, { color: hex, opacity: a })} />
            {!off && <IconBtn icon="minus" title={tr('inspector.grids.remove')} onClick={() => void c.set({ grids: grids.filter((_, k) => k !== i) })} />}
          </div>
        </div>
      ))}
    </Section>
  );
}

// ---------------------------------------------------------------- Vetor
export function VectorSection({ c }: { c: Ctx }) {
  const { n } = c;
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  if (n.type !== 'path' || c.bp || c.editState) return null;
  const points = n.points ?? [];
  const pathEffect = (n as { pathEffect?: { kind: 'round-corners'; radius: number } | null }).pathEffect;
  const shape = (n as LayerNodeWithShape).shape;
  const parametric = shape && (shape.kind === 'polygon' || shape.kind === 'star') ? shape : null;
  const updateShape = (patch: Record<string, number>) => {
    if (!parametric) return;
    const next = { ...parametric, ...patch };
    const w = Number(n.vw ?? n.w ?? 120), h = Number(n.vh ?? n.h ?? 120);
    void c.set({ shape: next, points: shapePoints(next.kind, w, h, next.sides, next.innerRatio), vw: w, vh: h });
  };
  const updatePoint = (index: number, patch: Record<string, unknown>) => {
    const current = points[index];
    let changes = patch;
    if (patch.mode !== undefined && current) {
      const mode = patch.mode as string | null;
      if (mode === null || mode === 'corner') changes = { ...patch, hin: null, hout: null, mode: null };
      else {
        const span = Math.max(4, Math.min(40, (Number(n.vw ?? n.w ?? 40) || 40) / 8));
        const hin = current.hin ?? { x: current.x - span, y: current.y };
        const hout = current.hout ?? { x: current.x + span, y: current.y };
        changes = mode === 'symmetric'
          ? { ...patch, hin, hout: { x: current.x * 2 - hin.x, y: current.y * 2 - hin.y }, mode }
          : { ...patch, hin, hout, mode };
      }
    }
    const next = points.map((point, i) => i === index ? { ...point, ...changes } : point);
    void c.set({ points: next });
  };
  const removePoint = (index: number) => void c.set({ points: points.filter((_, i) => i !== index) });
  const addPoint = () => {
    const last = points.at(-1) ?? { x: 0, y: 0 };
    void c.set({ points: [...points, { x: Number(last.x) + 10, y: Number(last.y) + 10, hin: null, hout: null }] });
  };
  const reverse = async () => { try { await run('reverse_vector', { id: n.id }); } catch (error) { toast('error', String(error)); } };
  const strokeToPath = async () => { try { await run('stroke_to_path', { id: n.id }); } catch (error) { toast('error', String(error)); } };
  const split = async () => {
    if (points.length < 3) { toast('error', tr('inspector.vector.splitMinError')); return; }
    const raw = await askText(tr('inspector.vector.splitTitle'), '1', { okLabel: tr('inspector.vector.splitOk'), message: tr('inspector.vector.splitMessage', { max: points.length - 2 }) });
    if (raw == null || !raw.trim()) return;
    const nodeIndex = Number(raw);
    if (!Number.isInteger(nodeIndex) || nodeIndex < 1 || nodeIndex >= points.length - 1) { toast('error', tr('inspector.vector.splitRange', { max: points.length - 2 })); return; }
    try { await run('split_vector_contour', { id: n.id, node_index: nodeIndex }); } catch (error) { toast('error', String(error)); }
  };
  const join = async () => { try { await run('join_vector_contours', { id: n.id }); } catch (error) { toast('error', String(error)); } };
  const setPathEffect = async (kind: 'round-corners' | 'none', radius = pathEffect?.radius ?? 8) => { try { await run('set_path_effect', { id: n.id, kind, ...(kind === 'round-corners' ? { radius } : {}) }); } catch (error) { toast('error', String(error)); } };
  const simplify = async () => {
    const raw = await askText(tr('inspector.vector.simplifyTitle'), '1', { okLabel: tr('inspector.vector.simplifyOk'), message: tr('inspector.vector.simplifyMessage') });
    if (raw == null || !raw.trim()) return;
    const tolerance = Number(raw.replace(',', '.'));
    if (!Number.isFinite(tolerance) || tolerance <= 0) { toast('error', tr('inspector.vector.toleranceError')); return; }
    try { await run('simplify_vector', { id: n.id, tolerance }); } catch (error) { toast('error', String(error)); }
  };
  const offset = async () => {
    const raw = await askText(tr('inspector.vector.offsetTitle'), '4', { okLabel: tr('inspector.vector.offsetOk'), message: tr('inspector.vector.offsetMessage') });
    if (raw == null || !raw.trim()) return;
    const distance = Number(raw.replace(',', '.'));
    if (!Number.isFinite(distance) || distance === 0) { toast('error', tr('inspector.vector.distanceError')); return; }
    try { await run('offset_path', { id: n.id, distance }); } catch (error) { toast('error', String(error)); }
  };
  return (
    <Section id="vector" title={tr('inspector.vector.title')}>
      {parametric && <Cap label={parametric.kind === 'star' ? tr('inspector.vector.star') : tr('inspector.vector.polygon')} css="shape">
        <Row><Num label={tr('inspector.vector.sides')} value={parametric.sides} min={3} max={24} decimals={0} disabled={c.readOnly} onCommit={(value) => updateShape({ sides: Math.round(value ?? parametric.sides) })} />
          {parametric.kind === 'star' && <Num label={tr('inspector.vector.innerRadius')} value={parametric.innerRatio * 100} min={10} max={90} decimals={0} disabled={c.readOnly} onCommit={(value) => updateShape({ innerRatio: Math.max(0.1, Math.min(0.9, (value ?? parametric.innerRatio * 100) / 100)) })} />}</Row>
        <Hint>{tr('inspector.vector.parametricHint')}</Hint>
      </Cap>}
      <Cap label={tr('inspector.vector.fillRule')} css="fill-rule">
        <Sel value={(n as { fillRule?: string }).fillRule ?? 'nonzero'} options={[['nonzero', tr('inspector.vector.nonzero')], ['evenodd', tr('inspector.vector.evenodd')]]} disabled={c.readOnly} onChange={(v) => void c.set({ fillRule: v === 'evenodd' ? 'evenodd' : null })} />
      </Cap>
      <Cap label={tr('inspector.vector.effect')} css="path-effect">
        <div className="row wrap"><Sel value={pathEffect?.kind ?? 'none'} options={[['none', '—'], ['round-corners', tr('inspector.vector.roundCorners')]]} disabled={c.readOnly} onChange={(v) => void setPathEffect(v as 'round-corners' | 'none')} />{pathEffect && <><Num label={tr('inspector.vector.radius')} value={pathEffect.radius} min={0.1} max={100000} decimals={2} disabled={c.readOnly} onCommit={(value) => value != null && void setPathEffect('round-corners', value)} /><button className="btn ghost sm" title={tr('inspector.vector.removeEffect')} onClick={() => void setPathEffect('none')}>{tr('inspector.vector.removeEffect')}</button></>}</div>
        <Hint>{tr('inspector.vector.effectHint')}</Hint>
      </Cap>
      <div className="row wrap"><span className="small muted">{points.length} {tr('inspector.vector.points')} · viewBox {n.vw ?? n.w} × {n.vh ?? n.h}</span><span className="grow" />{!c.readOnly && <><Check label={tr('inspector.vector.closed')} checked={n.closed !== false} onChange={(value) => void c.set({ closed: value })} /><button className="btn ghost sm" title={tr('inspector.vector.reverseHint')} onClick={() => void reverse()}>{tr('inspector.vector.reverse')}</button><button className="btn ghost sm" title={tr('inspector.vector.strokeHint')} onClick={() => void strokeToPath()}>{tr('inspector.vector.strokeToPath')}</button><button className="btn ghost sm" title={tr('inspector.vector.offsetHint')} onClick={() => void offset()}>{tr('inspector.vector.offset')}</button><button className="btn ghost sm" title={tr('inspector.vector.splitHint')} onClick={() => void split()}>{tr('inspector.vector.split')}</button>{(n.contours?.length ?? 0) > 0 && <button className="btn ghost sm" title={tr('inspector.vector.joinHint')} onClick={() => void join()}>{tr('inspector.vector.join')}</button>}<button className="btn ghost sm" title={tr('inspector.vector.simplifyHint')} onClick={() => void simplify()}>{tr('inspector.vector.simplify')}</button><button className="btn ghost sm" onClick={addPoint}>{tr('inspector.vector.addPoint')}</button></>}</div>
      <div className="vector-points">{points.map((point, index) => {
        const p = point as typeof point & { hin?: { x: number; y: number } | null; hout?: { x: number; y: number } | null; mode?: string };
        const handle = (name: 'hin' | 'hout', fallback: { x: number; y: number }) => p[name] ?? fallback;
        const changeHandle = (name: 'hin' | 'hout', patch: { x?: number; y?: number }) => {
          const value = { ...handle(name, { x: p.x, y: p.y }), ...patch };
          if (p.mode === 'symmetric') {
            const other = name === 'hin' ? 'hout' : 'hin';
            updatePoint(index, { [name]: value, [other]: { x: p.x * 2 - value.x, y: p.y * 2 - value.y } });
          } else updatePoint(index, { [name]: value });
        };
        return <div className="vector-point" key={index}>
          <span className="small muted">#{index + 1}</span>
          <Num label="x" value={p.x} min={-100000} decimals={2} disabled={c.readOnly} onCommit={(value) => updatePoint(index, { x: value ?? p.x })} />
          <Num label="y" value={p.y} min={-100000} decimals={2} disabled={c.readOnly} onCommit={(value) => updatePoint(index, { y: value ?? p.y })} />
          {!c.readOnly && <IconBtn icon="trash2" title={tr('inspector.vector.removePoint')} onClick={() => removePoint(index)} />}
          <details className="vector-point-handles"><summary>{tr('inspector.vector.handles')}</summary>
            <div className="row"><label className="small">{tr('inspector.vector.mode')}<select className="field" value={p.mode ?? 'corner'} onChange={(e) => updatePoint(index, { mode: e.target.value === 'corner' ? null : e.target.value })} disabled={c.readOnly}><option value="corner">{tr('inspector.vector.corner')}</option><option value="smooth">{tr('inspector.vector.smooth')}</option><option value="symmetric">{tr('inspector.vector.symmetric')}</option></select></label></div>
            {(['hin', 'hout'] as const).map((name) => { const h = p[name]; return <div className="row" key={name}><span className="small muted">{name === 'hin' ? tr('inspector.vector.in') : tr('inspector.vector.out')}</span>{h ? <><Num label="x" value={h.x} min={-100000} decimals={2} disabled={c.readOnly} onCommit={(value) => changeHandle(name, { x: value ?? h.x })} /><Num label="y" value={h.y} min={-100000} decimals={2} disabled={c.readOnly} onCommit={(value) => changeHandle(name, { y: value ?? h.y })} /><IconBtn icon="minus" title={tr('inspector.vector.removeHandle')} onClick={() => updatePoint(index, { [name]: null })} /></> : <button className="btn ghost sm" disabled={c.readOnly} onClick={() => updatePoint(index, { [name]: { x: p.x, y: p.y } })}>{tr('inspector.vector.add')}</button>}</div>; })}
          </details>
        </div>;
      })}</div>
      {!points.length && <Hint>{tr('inspector.vector.empty')}</Hint>}
    </Section>
  );
}

// ---------------------------------------------------------------- CSS livre
export function CssSection({ c }: { c: Ctx }) {
  const { n } = c;
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const [status, setStatus] = useState<{ text: string; warn: boolean }>({ text: '', warn: false });
  if (!c.single || c.editState) return null;
  const check = (text: string) => {
    const bad = text.split(/;|\n/).map((l) => l.trim()).filter(Boolean).filter((l) => {
      const i = l.indexOf(':');
      if (i < 0) return true;
      const prop = l.slice(0, i).trim();
      return typeof CSS !== 'undefined' && !prop.startsWith('--') && !CSS.supports(prop, l.slice(i + 1).trim().replace(/!important$/, ''));
    });
    setStatus(bad.length ? { text: tr('inspector.extra.cssInvalid', { items: bad.slice(0, 3).join(' · ') }), warn: true } : { text: text.trim() ? tr('inspector.extra.cssOk') : '', warn: false });
  };
  return (
    <Section id="css" title={tr('inspector.extra.cssTitle')} defaultOpen={!!n.customCss}>
      <Cap label={tr('inspector.extra.declarations')} css="custom-css">
        <Area value={n.customCss ?? ''} mono rows={4} placeholder={'scroll-margin-top: 80px;\naccent-color: #2f6ae0;'} label={tr('inspector.extra.cssLabel')} onCommit={(v) => { check(v); void c.set({ customCss: v.trim() || null }); }} />
      </Cap>
      {status.text && <Hint warn={status.warn}>{status.text}</Hint>}
    </Section>
  );
}

// ---------------------------------------------------------------- Exportar
export function ExportSection({ c }: { c: Ctx }) {
  const language = useApp((s) => s.language);
  const tr = (key: string) => t(language, key);
  const [scale, setScale] = useState('1');
  const download = (name: string, href: string) => { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
  const png = async () => {
    for (const x of c.nodes) {
      try {
        const out = await api_tool('get_image', { id: x.id, scale: Number(scale) });
        const img = (out as { _image?: { data: string; mimeType: string } })._image;
        if (img) download(`${x.name}.png`, `data:${img.mimeType};base64,${img.data}`);
        else toast('error', tr('inspector.extra.imageError'));
      } catch (e) { toast('error', e instanceof Error ? e.message : tr('inspector.extra.exportError')); }
    }
  };
  const html = async () => {
    for (const x of c.nodes) {
      try {
        const out = await api_tool('get_code', { id: x.id }) as { html: string; css: string };
        const blob = new Blob([`<!doctype html>\n<meta charset="utf-8">\n<style>\n${out.css}\n</style>\n${out.html}\n`], { type: 'text/html' });
        download(`${x.name}.html`, URL.createObjectURL(blob));
      } catch (e) { toast('error', e instanceof Error ? e.message : tr('inspector.extra.exportError')); }
    }
  };
  return (
    <Section id="export" title={tr('inspector.extra.exportTitle')} defaultOpen={false}>
      <Row>
        <Sel value={scale} options={[['0.5', '0.5x'], ['1', '1x'], ['2', '2x']]} title={tr('inspector.extra.scale')} onChange={setScale} />
        <button type="button" className="btn" onClick={() => void png()}>PNG</button>
        <button type="button" className="btn" onClick={() => void html()}>HTML</button>
      </Row>
      <Hint>{tr('inspector.extra.exportHint')}</Hint>
    </Section>
  );
}
