// As seções menores do painel: Componente, Estados, HTML, Nota, Grades de layout, Vetor, CSS livre e Exportar.
import { useState } from 'react';
import { BOX_TAGS, TEXT_TAGS, STATE_LIST, canHaveStates, hasStates, htmlTagIn, tagOf } from '@stylo/core/model.js';
import { tool as api_tool } from '../../lib/api';
import { app, run, toast } from '../../lib/app';
import { arrange, noteOn, selectMainOf } from '../../lib/editing';
import { colorGroups } from '../../lib/colors';
import { ColorRow } from '../../ui/ColorPicker';
import { Area, Cap, Check, Hint, IconBtn, Num, Row, Section, Seg, Sel, Txt } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import { parentOf } from '../../lib/doc';
import type { Ctx } from './ctx';
import type { StateName } from '../../lib/app';

// ---------------------------------------------------------------- Componente
export function ComponentSection({ c }: { c: Ctx }) {
  const { n, doc, page } = c;
  const off = c.readOnly;
  if (!c.single || c.bp) return null;
  const main = n.instanceOf ? (page.children.length ? findMain(page.children, n.instanceOf) : null) : null;
  void doc;
  return (
    <Section id="component" title="Componente">
      {n.component ? (
        <>
          <div className="badge-pill purple"><Icon name="component" size={13} /> Componente principal</div>
          <Hint>Mudanças aqui atualizam todas as instâncias.</Hint>
          <button type="button" className="btn block" disabled={off} onClick={() => void run('create_instance', { component_id: n.id }).then((r: { created?: { id: string } } | undefined) => { if (r?.created?.id) app.set({ selection: [r.created.id] }); })}><Icon name="plus" size={13} /> Criar instância</button>
        </>
      ) : n.instanceOf ? (
        <>
          <div className="badge-pill purple"><Icon name="component" size={13} /> Instância de {main?.name ?? '?'}</div>
          <Row>
            <button type="button" className="btn grow" onClick={() => selectMainOf(n.id)}>Ir ao principal</button>
            <button type="button" className="btn grow" disabled={off} onClick={() => void arrange('detach_instance')}>Desanexar</button>
          </Row>
        </>
      ) : (
        <button type="button" className="btn block" disabled={off} onClick={() => void arrange('create_component')}><Icon name="component" size={13} /> Criar componente</button>
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
const STICKY: [string, string][] = [['', 'Não'], ['0', 'No topo (0px)'], ['16', '16px do topo'], ['64', '64px do topo']];

export function StatesSection({ c }: { c: Ctx }) {
  const { base, n, bp } = c;
  const off = c.readOnly;
  if (!c.single || bp || !canHaveStates(base as never)) return null;
  const cur = c.editState;
  const tabs: [StateName | '', string][] = [['', 'Normal'], ...(STATE_LIST as [StateName, string, string][]).map(([k, l]) => [k, l] as [StateName, string])];
  return (
    <Section id="states" title="Estados" defaultOpen={!!cur || hasStates(base as never, undefined as never)}>
      <div className="segmented wide states">
        {tabs.map(([k, label]) => (
          <button key={k || 'normal'} type="button" className={(cur ?? '') === k ? 'on' : ''} onClick={() => app.set({ editState: k || null })}>
            {label}{k && hasStates(base as never, k) ? <span className="dot-on" /> : null}
          </button>
        ))}
      </div>
      {cur ? (
        <>
          <Hint>Editando “{(STATE_LIST as string[][]).find(([k]) => k === cur)?.[1]}”: só o que você mudar aqui vira regra {(STATE_LIST as string[][]).find(([k]) => k === cur)?.[2]} no CSS. Tamanho, posição e layout não mudam com o mouse.</Hint>
          <Cap label="Escala" css="transform"><Num label="×" value={Number((n as { scale?: number }).scale ?? 1)} min={0.1} max={3} step={0.01} decimals={2} disabled={off} onCommit={(v) => void c.set({ scale: v ?? 1 })} /></Cap>
          {hasStates(base as never, cur) && !off && <button type="button" className="btn" onClick={() => void run('set_state', { id: base.id, state: cur, reset: true })}><Icon name="close" size={13} /> Limpar este estado</button>}
        </>
      ) : (
        <>
          <Row>
            <Cap label="Duração" css="transition"><Num label="ms" value={n.transition?.duration ?? 0} min={0} max={5000} step={50} decimals={0} disabled={off} onCommit={(v) => void c.set({ transition: v ? { duration: Math.round(v), easing: n.transition?.easing ?? 'ease' } : null })} /></Cap>
            <Cap label="Curva" css="transition"><Sel value={n.transition?.easing ?? 'ease'} options={EASINGS} disabled={off || !n.transition} onChange={(v) => void c.set({ transition: { duration: n.transition?.duration ?? 200, easing: v } })} /></Cap>
          </Row>
          <Cap label="Cursor" css="cursor"><Sel value={n.cursor ?? ''} options={CURSORS} disabled={off} onChange={(v) => void c.set({ cursor: v || null })} /></Cap>
          <Row>
            <Cap label="Fixar ao rolar" css="sticky"><Sel value={n.sticky == null ? '' : String(n.sticky)} options={STICKY} disabled={off} onChange={(v) => void c.set({ sticky: v === '' ? null : Number(v) })} /></Cap>
            <Cap label="Mouse" css="pointer-events"><Sel value={n.pointerEvents ?? ''} options={[['', 'Normal'], ['none', 'Ignora (none)']]} disabled={off} onChange={(v) => void c.set({ pointerEvents: v || null })} /></Cap>
          </Row>
        </>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- HTML
const TAG_NAMES: Record<string, string> = { p: 'p — parágrafo', h1: 'h1 — título principal', h2: 'h2 — título', h3: 'h3 — subtítulo', h4: 'h4', h5: 'h5', h6: 'h6', span: 'span — trecho de texto', a: 'a — link', label: 'label — rótulo de campo', li: 'li — item de lista', button: 'button — botão', div: 'div — caixa genérica', section: 'section — seção', header: 'header — cabeçalho', footer: 'footer — rodapé', nav: 'nav — navegação', main: 'main — conteúdo principal', aside: 'aside — lateral', article: 'article — artigo', ul: 'ul — lista', ol: 'ol — lista numerada', form: 'form — formulário' };

export function HtmlSection({ c }: { c: Ctx }) {
  const { n, page } = c;
  const off = c.readOnly;
  if (!c.single || c.bp || c.editState || n.type === 'line') return null;
  const isText = n.type === 'text';
  const tags = ((isText ? TEXT_TAGS : BOX_TAGS) as string[]).map((t) => [t, TAG_NAMES[t] ?? t] as [string, string]);
  const tag = tagOf(n as never);
  // etiqueta que não vale onde a camada está (ex.: <li> fora de uma lista): o HTML exportado usa a padrão
  const chain: Ctx['n'][] = [];
  for (let a = parentOf(page.children, n.id); a; a = parentOf(page.children, a.id)) chain.unshift(a);
  const anc: string[] = [];
  for (const a of chain) anc.push(htmlTagIn(a as never, anc).tag);
  const check = htmlTagIn(n as never, anc);
  return (
    <Section id="html" title="HTML" defaultOpen={false}>
      <Cap label="Etiqueta" css="tag"><Sel value={tag} options={tags} disabled={off} title="Etiqueta HTML" onChange={(v) => void c.set({ tag: v })} /></Cap>
      {check.reason && <Hint warn>No código vira &lt;{check.tag}&gt;: {check.reason}.</Hint>}
      {tag === 'a' && <Cap label="Endereço do link" css="href"><Txt value={n.href ?? ''} placeholder="https://… ou #secao" disabled={off} onCommit={(v) => void c.set({ href: v.trim() || null })} /></Cap>}
      {tag === 'a' && <Row><Cap label="Abrir em" css="target"><Sel value={n.target ?? ''} options={[['', 'Mesma aba'], ['_blank', 'Nova aba']]} disabled={off} onChange={(v) => void c.set({ target: v || null })} /></Cap></Row>}
      {tag === 'button' && <Cap label="Tipo do botão" css="type"><Sel value={n.buttonType ?? ''} options={[['', 'Padrão'], ['button', 'button'], ['submit', 'submit'], ['reset', 'reset']]} disabled={off} onChange={(v) => void c.set({ buttonType: v || null })} /></Cap>}
      <Cap label={isText ? 'Descrição (opcional)' : 'Descrição / texto alternativo'} css="aria-label"><Txt value={n.alt ?? ''} placeholder={isText ? 'Só se o texto não bastar' : 'Ex.: Foto da equipe sorrindo'} disabled={off} onCommit={(v) => void c.set({ alt: v.trim() || null })} /></Cap>
      <Row>
        <Cap label="Id" css="id"><Txt value={n.htmlId ?? ''} mono placeholder="contato" disabled={off} onCommit={(v) => void c.set({ htmlId: v.trim() || null })} /></Cap>
        <Cap label="Classes extras" css="class"><Txt value={n.classes ?? ''} mono placeholder="destaque grande" disabled={off} onCommit={(v) => void c.set({ classes: v.trim() || null })} /></Cap>
      </Row>
      <Row>
        <Cap label="Título (tooltip)" css="title"><Txt value={n.title ?? ''} disabled={off} onCommit={(v) => void c.set({ title: v.trim() || null })} /></Cap>
        <Cap label="Papel (role)" css="role"><Txt value={n.role ?? ''} mono disabled={off} onCommit={(v) => void c.set({ role: v.trim() || null })} /></Cap>
      </Row>
    </Section>
  );
}

// ---------------------------------------------------------------- Nota
export function NoteSection({ c }: { c: Ctx }) {
  const { n } = c;
  if (!c.single || c.bp || c.editState) return null;
  if (!n.note) return null;
  return (
    <Section id="note" title="Nota" right={!c.readOnly ? <IconBtn icon="note" title="Editar nota" onClick={() => void noteOn(n.id)} /> : undefined}>
      <p className="note-text">{n.note}</p>
      <Check label="Incluir no código (como comentário)" checked={n.noteInCode !== false} disabled={c.readOnly} onChange={(v) => void c.set({ noteInCode: v ? null : false })} />
    </Section>
  );
}

// ---------------------------------------------------------------- Grades de layout
type Grid = { type: 'columns' | 'rows' | 'grid'; count: number; gutter: number; margin: number; size: number; color: string; opacity: number };
export function GridsSection({ c }: { c: Ctx }) {
  const { n, doc } = c;
  const off = c.readOnly;
  if (n.type !== 'frame' || c.bp || c.editState) return null;
  const grids = (n.grids ?? []) as Grid[];
  const set = (i: number, patch: Partial<Grid>) => void c.set({ grids: grids.map((g, k) => (k === i ? { ...g, ...patch } : g)) });
  return (
    <Section id="grids" title="Grades de layout" defaultOpen={grids.length > 0}
      right={!off ? <IconBtn icon="plus" title="Adicionar grade de layout" onClick={() => void c.set({ grids: [...grids, { type: 'columns', count: 12, gutter: 16, margin: 24, size: 8, color: '#FF3D3D', opacity: 0.12 }] })} /> : undefined}>
      {!grids.length && <Hint>Grades de colunas, linhas ou quadrícula para alinhar o desenho. São só guias: não entram no CSS.</Hint>}
      {grids.map((g, i) => (
        <div className="effect-card" key={i}>
          <Sel value={g.type} options={[['columns', 'Colunas'], ['rows', 'Linhas'], ['grid', 'Quadrícula']]} disabled={off} title="Tipo de grade" onChange={(v) => set(i, { type: v as Grid['type'] })} />
          {g.type === 'grid'
            ? <Row><Num label="▦" value={g.size} min={2} decimals={0} disabled={off} title="tamanho da célula" onCommit={(v) => set(i, { size: Math.max(2, v ?? 8) })} /></Row>
            : (
              <>
                <Row><Num label="#" value={g.count} min={1} decimals={0} disabled={off} title="quantidade" onCommit={(v) => set(i, { count: Math.max(1, Math.round(v ?? 12)) })} /><Num label="↔" value={g.gutter} min={0} decimals={0} disabled={off} title="gutter (espaço entre)" onCommit={(v) => set(i, { gutter: Math.max(0, v ?? 0) })} /></Row>
                <Row><Num label="▏" value={g.margin} min={0} decimals={0} disabled={off} title="margem" onCommit={(v) => set(i, { margin: Math.max(0, v ?? 0) })} /></Row>
              </>
            )}
          <div className="effect-foot">
            <ColorRow color={g.color} opacity={g.opacity} groups={colorGroups(doc)} disabled={off} onChange={(hex, a) => set(i, { color: hex, opacity: a })} />
            {!off && <IconBtn icon="minus" title="Remover grade" onClick={() => void c.set({ grids: grids.filter((_, k) => k !== i) })} />}
          </div>
        </div>
      ))}
    </Section>
  );
}

// ---------------------------------------------------------------- Vetor
export function VectorSection({ c }: { c: Ctx }) {
  const { n } = c;
  if (n.type !== 'path' || c.bp || c.editState) return null;
  return (
    <Section id="vector" title="Vetor">
      <Cap label="Preenchimento" css="fill-rule">
        <Sel value={(n as { fillRule?: string }).fillRule ?? 'nonzero'} options={[['nonzero', 'Diferente de zero'], ['evenodd', 'Par-ímpar (furos)']]} disabled={c.readOnly} onChange={(v) => void c.set({ fillRule: v === 'evenodd' ? 'evenodd' : null })} />
      </Cap>
      <Hint>A edição dos pontos do desenho (caneta) ainda não está no painel novo: um agente pode refazer o vetor com create_layer type “path”.</Hint>
    </Section>
  );
}

// ---------------------------------------------------------------- CSS livre
export function CssSection({ c }: { c: Ctx }) {
  const { n } = c;
  const [status, setStatus] = useState('');
  if (!c.single || c.editState) return null;
  const check = (text: string) => {
    const bad = text.split(/;|\n/).map((l) => l.trim()).filter(Boolean).filter((l) => {
      const i = l.indexOf(':');
      if (i < 0) return true;
      const prop = l.slice(0, i).trim();
      return typeof CSS !== 'undefined' && !prop.startsWith('--') && !CSS.supports(prop, l.slice(i + 1).trim().replace(/!important$/, ''));
    });
    setStatus(bad.length ? `O navegador não entendeu: ${bad.slice(0, 3).join(' · ')}` : text.trim() ? 'Tudo certo: vale no canvas e no código exportado.' : '');
  };
  return (
    <Section id="css" title="CSS livre" defaultOpen={!!n.customCss}>
      <Cap label="Declarações" css="custom-css">
        <Area value={n.customCss ?? ''} mono rows={4} placeholder={'scroll-margin-top: 80px;\naccent-color: #2f6ae0;'} label="CSS livre desta camada" onCommit={(v) => { check(v); void c.set({ customCss: v.trim() || null }); }} />
      </Cap>
      {status && <Hint warn={status.startsWith('O navegador')}>{status}</Hint>}
    </Section>
  );
}

// ---------------------------------------------------------------- Exportar
export function ExportSection({ c }: { c: Ctx }) {
  const [scale, setScale] = useState('1');
  const download = (name: string, href: string) => { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
  const png = async () => {
    for (const x of c.nodes) {
      try {
        const out = await api_tool('get_image', { id: x.id, scale: Number(scale) });
        const img = (out as { _image?: { data: string; mimeType: string } })._image;
        if (img) download(`${x.name}.png`, `data:${img.mimeType};base64,${img.data}`);
        else toast('error', 'O servidor não devolveu a imagem (sem Chromium?).');
      } catch (e) { toast('error', e instanceof Error ? e.message : 'Não consegui exportar.'); }
    }
  };
  const html = async () => {
    for (const x of c.nodes) {
      try {
        const out = await api_tool('get_code', { id: x.id }) as { html: string; css: string };
        const blob = new Blob([`<!doctype html>\n<meta charset="utf-8">\n<style>\n${out.css}\n</style>\n${out.html}\n`], { type: 'text/html' });
        download(`${x.name}.html`, URL.createObjectURL(blob));
      } catch (e) { toast('error', e instanceof Error ? e.message : 'Não consegui exportar.'); }
    }
  };
  return (
    <Section id="export" title="Exportar" defaultOpen={false}>
      <Row>
        <Sel value={scale} options={[['0.5', '0.5x'], ['1', '1x'], ['2', '2x']]} title="Escala" onChange={setScale} />
        <button type="button" className="btn" onClick={() => void png()}>PNG</button>
        <button type="button" className="btn" onClick={() => void html()}>HTML</button>
      </Row>
      <Hint>PNG vem do navegador do servidor (precisa do Chromium); HTML exporta só esta camada.</Hint>
    </Section>
  );
}
