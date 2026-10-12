// Aba Recursos: fotos livres, imagens do projeto, componentes, estilos de cor/texto/sombra/gradiente, variáveis, modos de cor e paletas.
// Cada ação é uma ferramenta do MCP (create_*_styles, update_design_resource, apply_text_style, insert_asset, create_instance, add_asset…).
import { useMemo, useState } from 'react';
import { walk } from '@stylo/core/model.js';
import { getPalettes, createPalette, changePalette, deletePalette, addColor as paletteAdd, removeColor as paletteRemove, normalizeHex } from '@stylo/core/palettes.js';
import { canEdit, setProps } from '../lib/actions';
import { app, run, select, toast, useApp } from '../lib/app';
import { confirmDialog, askText } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { readImageFile } from '../lib/uploads';
import { findNode, flatten as flatList, pageOf } from '../lib/doc';
import type { LayerNode } from '../lib/types';

// ---------------------------------------------------------------- pedaços
function Block({ title, right, children, open = true }: { title: string; right?: React.ReactNode; children: React.ReactNode; open?: boolean }) {
  const [shown, setShown] = useState(open);
  return (
    <section className="res-block">
      <header onClick={() => setShown(!shown)}><Icon name={shown ? 'chevrondown' : 'chevron'} size={13} /><h4>{title}</h4><span className="spacer" />{right && <span onClick={(e) => e.stopPropagation()}>{right}</span>}</header>
      {shown && <div className="res-body">{children}</div>}
    </section>
  );
}

const selectedNodes = (): LayerNode[] => {
  const s = app.get();
  const page = s.doc ? pageOf(s.doc, s.pageId) : null;
  return page ? s.selection.map((id) => findNode(page.children, id)).filter((n): n is LayerNode => !!n) : [];
};

// ---------------------------------------------------------------- fotos
interface Photo { id: string; provider: string; thumb: string; full: string; author: string; authorUrl?: string; sourceUrl?: string; license: string; licenseUrl?: string; attribution?: string; attributionRequired?: boolean }
const SUGGESTIONS = ['pessoas', 'escritório', 'natureza', 'comida', 'textura'];

type PluginAsset = { id?: string; ref?: string; title?: string; name?: string; provider?: string; kind?: string; preview_url?: string; license?: { name?: string } };

function PluginAssets() {
  const [kind, setKind] = useState<'video' | 'audio' | 'model3d' | 'lottie' | 'font' | 'icon'>('font');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PluginAsset[]>([]);
  const [status, setStatus] = useState('Fontes, ícones e mídias do plugin assets.');
  const [busy, setBusy] = useState(false);
  const editable = canEdit();
  const search = async () => {
    if (!q.trim()) { setStatus('Digite o que deseja buscar.'); return; }
    setBusy(true); setStatus('Buscando no plugin assets…');
    try { const out = await run<{ results?: PluginAsset[]; count?: number }>('search_assets', { kind, query: q.trim() }); setResults(out?.results ?? []); setStatus(`${out?.count ?? out?.results?.length ?? 0} resultado(s).`); }
    catch (e) { setStatus(e instanceof Error ? e.message : 'Falha na busca.'); setResults([]); } finally { setBusy(false); }
  };
  const use = async (item: PluginAsset) => {
    if (!editable) return;
    try {
      if (kind === 'font') { await run('add_font', { id: item.id, weights: [400, 700] }); toast('ok', `Fonte “${item.title || item.id}” adicionada ao projeto.`); return; }
      if (kind === 'icon') { await run('insert_icon', { name: item.name || item.title || item.id, color: '#111111', size: 48, style: 'outlined', filled: false }); toast('ok', 'Ícone inserido no projeto.'); return; }
      const saved = await run<{ saved?: { id?: string } }>('library_save', { ref: item.ref, name: item.title });
      if (saved?.saved?.id) { await run('library_use', { id: saved.saved.id, insert: true }); toast('ok', 'Asset inserido no projeto.'); }
    } catch (e) { toast('error', e instanceof Error ? e.message : 'Não consegui usar este asset.'); }
  };
  return <Block title="Banco do plugin assets">
    <div className="plugin-search"><select className="field" aria-label="Tipo de asset" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="font">Fontes</option><option value="icon">Ícones</option><option value="video">Vídeos</option><option value="audio">Áudio</option><option value="model3d">3D</option><option value="lottie">Lottie</option></select><input className="field" aria-label="Buscar assets do plugin" placeholder="Buscar no plugin…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void search(); }} /><button className="btn primary" disabled={busy} onClick={() => void search()}>Buscar</button></div>
    <p className="hint" role="status">{status}</p>
    <div className="plugin-results">{results.map((item, i) => <div className="plugin-result" key={`${item.ref || item.id}-${i}`}>{item.preview_url && <img src={item.preview_url} alt="" />}<div className="grow"><b className="ellipsis">{item.title || item.name || item.id}</b><span className="faint">fonte: {item.provider || item.kind}</span><span className="faint">licença: {item.license?.name || 'não informada pelo resultado'}</span><span className="faint">ref: {item.ref || item.id}</span></div><button className="btn ghost sm" disabled={!editable} onClick={() => void use(item)}>{kind === 'font' ? 'Adicionar' : 'Usar'}</button></div>)}</div>
  </Block>;
}

function Photos() {
  const [q, setQ] = useState('');
  const [orientation, setOrientation] = useState('');
  const [results, setResults] = useState<Photo[]>([]);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('Busque fotos gratuitas no Openverse.');
  const [busy, setBusy] = useState(false);
  const editable = canEdit();

  const search = async (append: boolean, term = q) => {
    if (busy) return;
    if (!term.trim()) { setStatus('Digite um tema ou escolha uma sugestão.'); return; }
    setBusy(true);
    const next = append ? page + 1 : 1;
    setPage(next);
    setStatus('Buscando fotos…');
    try {
      const res = await fetch(`/api/photos/search?${new URLSearchParams({ q: term, page: String(next), orientation })}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não consegui buscar fotos.');
      setResults(append ? [...results, ...data.results] : data.results);
      setMore(!!data.hasMore);
      setStatus(data.results.length || append ? `${append ? results.length + data.results.length : data.results.length} fotos${data.hasPexels ? ' · Openverse e Pexels' : ' · Openverse'}.` : 'Nenhuma foto encontrada.');
    } catch (e) { if (!append) { setResults([]); setMore(false); } setStatus(e instanceof Error ? e.message : 'Falha na busca de fotos.'); } finally { setBusy(false); }
  };

  const download = async (item: Photo): Promise<File> => {
    const res = await fetch(`/api/photos/fetch?url=${encodeURIComponent(item.full)}`);
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || 'Não consegui baixar esta foto.');
    const blob = await res.blob();
    return new File([blob], `foto-${item.id.replace(':', '-')}.${(blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`, { type: blob.type || 'image/jpeg' });
  };
  const credit = (item: Photo) => ({ provider: item.provider, author: item.author, authorUrl: item.authorUrl, sourceUrl: item.sourceUrl, license: item.license, licenseUrl: item.licenseUrl, attribution: item.attribution, attributionRequired: item.attributionRequired });

  const insert = async (item: Photo) => {
    try {
      const { dataUrl } = await readImageFile(await download(item));
      const sel = selectedNodes();
      const parent = sel.length === 1 && sel[0].type === 'frame' ? sel[0] : null;
      const out = await run<{ created?: { id: string } }>('add_asset', { name: `Foto de ${item.author}`.slice(0, 60), data_url: dataUrl, insert: true, ...(parent ? { parent_id: parent.id } : {}) });
      const id = out?.created?.id;
      if (id) { await run('update_layer', { id, props: { photoCredit: credit(item) } }); select([id]); toast('ok', 'Foto inserida com crédito.'); }
    } catch (e) { toast('error', e instanceof Error ? e.message : 'Não consegui inserir a foto.'); }
  };
  const asFill = async (item: Photo) => {
    const targets = selectedNodes().filter((n) => !['group', 'path', 'text', 'section'].includes(n.type));
    if (!targets.length) { toast('error', 'Selecione uma camada com preenchimento para usar a foto.'); return; }
    try {
      const { dataUrl, w, h } = await readImageFile(await download(item));
      const added = await run<{ asset_id?: string }>('add_asset', { name: `Foto de ${item.author}`.slice(0, 60), data_url: dataUrl });
      if (!added?.asset_id) return;
      for (const n of targets) await run('update_layer', { id: n.id, props: { fill: { type: 'image', assetId: added.asset_id, fit: 'cover', natW: w, natH: h }, photoCredit: credit(item) } });
      toast('ok', 'Foto aplicada como preenchimento.');
    } catch (e) { toast('error', e instanceof Error ? e.message : 'Não consegui aplicar a foto.'); }
  };

  return (
    <>
      <div className="photo-search">
        <input className="field" type="search" placeholder="Buscar fotos" aria-label="Buscar fotos" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void search(false); }} />
        <button className="btn primary" disabled={busy} onClick={() => void search(false)}>Buscar</button>
      </div>
      <select className="field" aria-label="Orientação da foto" value={orientation} onChange={(e) => { setOrientation(e.target.value); }}>
        <option value="">Todas as orientações</option><option value="landscape">Horizontal</option><option value="portrait">Vertical</option><option value="square">Quadrada</option>
      </select>
      <div className="chips">{SUGGESTIONS.map((s) => <button key={s} className="chip-btn" onClick={() => { setQ(s); void search(false, s); }}>{s}</button>)}</div>
      <p className="hint" role="status">{status}</p>
      <div className="photo-grid">
        {results.map((item) => (
          <article className="photo-card" key={item.id} title={`${item.author} · ${item.license}`}>
            <button type="button" className="photo-image" disabled={!editable} aria-label={`Inserir foto de ${item.author}`} onClick={() => void insert(item)}><img src={item.thumb} alt={`Foto de ${item.author}`} loading="lazy" /></button>
            <div className="photo-meta"><span>{item.provider}</span><span className="faint ellipsis">{item.author} · {item.license}</span><span className="faint ellipsis" title={item.sourceUrl || item.full}>origem: {item.sourceUrl || item.full}</span>
              <button type="button" className="ibtn" title="Usar como preenchimento da camada selecionada" disabled={!editable} onClick={() => void asFill(item)}><Icon name="rect" size={13} /></button></div>
          </article>
        ))}
      </div>
      {more && <button className="btn block" disabled={busy} onClick={() => void search(true)}>Carregar mais</button>}
    </>
  );
}

// ---------------------------------------------------------------- imagens do projeto
function ProjectImages() {
  const doc = useApp((s) => s.doc)!;
  const assets = Object.entries((doc.assets ?? {}) as Record<string, string>).filter(([, src]) => typeof src === 'string' && src.startsWith('data:image/'));
  const editable = canEdit();
  const upload = async (f: File) => {
    try { const { dataUrl } = await readImageFile(f); const out = await run<{ created?: { id: string } }>('add_asset', { name: f.name.replace(/\.[^.]+$/, ''), data_url: dataUrl, insert: true }); if (out?.created?.id) select([out.created.id]); }
    catch (e) { toast('error', e instanceof Error ? e.message : 'Não consegui ler a imagem.'); }
  };
  return (
    <>
      {editable && <label className="btn block"><Icon name="plus" size={13} /> Enviar imagem<input type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} /></label>}
      {assets.length ? (
        <div className="asset-grid small">
          {assets.map(([id, src]) => <button key={id} type="button" className="asset-thumb" title="Inserir no canvas" disabled={!editable} onClick={() => void run<{ created?: { id: string } }>('insert_asset', { id }).then((o) => { if (o?.created?.id) select([o.created.id]); })}><img src={src} alt="" /></button>)}
        </div>
      ) : <p className="hint">As imagens que você usar no projeto aparecem aqui para reaproveitar.</p>}
    </>
  );
}

// ---------------------------------------------------------------- componentes
function Components() {
  const doc = useApp((s) => s.doc)!;
  const editable = canEdit();
  const list = useMemo(() => {
    const out: { n: LayerNode; page: string; uses: number }[] = [];
    const uses = new Map<string, number>();
    for (const p of doc.pages) walk(p.children, (x: LayerNode) => { if (x.instanceOf) uses.set(x.instanceOf, (uses.get(x.instanceOf) ?? 0) + 1); });
    for (const p of doc.pages) walk(p.children, (x: LayerNode) => { if (x.component) out.push({ n: x, page: p.name, uses: uses.get(x.id) ?? 0 }); });
    return out;
  }, [doc]);
  if (!list.length) return <p className="hint">Selecione uma camada, clique com o botão direito e escolha “Criar componente”. Mudou o principal, mudam todas as cópias.</p>;
  return (
    <>
      {list.map(({ n, page, uses }) => (
        <button key={n.id} className="res-row" disabled={!editable} title={`Inserir uma cópia de “${n.name}”`} onClick={() => void run<{ created?: { id: string } }>('create_instance', { component_id: n.id }).then((o) => { if (o?.created?.id) select([o.created.id]); })}>
          <Icon name="component" size={14} /><span className="grow ellipsis">{n.name}</span><span className="faint">{page} · {uses}×</span>
        </button>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- estilos (cores, texto, sombra, gradiente) e variáveis
type Res = { id: string; name: string; [k: string]: any };

function ResourceRow({ kind, r, swatch, sub, onApply, extra }: { kind: 'color' | 'text' | 'effect' | 'gradient' | 'variable' | 'mode'; r: Res; swatch?: React.ReactNode; sub?: string; onApply?: () => void; extra?: React.ReactNode }) {
  const editable = canEdit();
  const rename = async () => { const name = await askText('Renomear', r.name, { okLabel: 'Salvar' }); if (name?.trim() && name.trim() !== r.name) await run('update_design_resource', { kind, id: r.id, changes: { name: name.trim() } }); };
  const remove = async () => {
    if (await confirmDialog(`Excluir “${r.name}”?`, 'As camadas ligadas a ele ficam com os valores de agora (dá para desfazer).', { okLabel: 'Excluir', danger: true })) await run('delete_design_resource', { kind, id: r.id, detach: true });
  };
  return (
    <div className="res-row static">
      <button type="button" className="res-main" disabled={!onApply || !editable} title={onApply ? 'Clique para aplicar à seleção' : r.name} onClick={onApply}>
        {swatch}<span className="grow ellipsis">{r.name}</span>{sub && <span className="faint">{sub}</span>}
      </button>
      {extra}
      {editable && <button type="button" className="ibtn" title="Renomear" onClick={() => void rename()}><Icon name="note" size={13} /></button>}
      {editable && <button type="button" className="ibtn" title="Excluir" onClick={() => void remove()}><Icon name="trash" size={13} /></button>}
    </div>
  );
}

function ColorStyles() {
  const doc = useApp((s) => s.doc)!;
  const mode = useApp((s) => s.colorMode);
  const styles = (doc.styles?.colors ?? []) as Res[];
  const editable = canEdit();
  const fromSelection = async () => {
    const n = selectedNodes().find((x) => x.fill?.type === 'solid');
    if (!n) { toast('error', 'Selecione uma camada com preenchimento de cor sólida.'); return; }
    const name = await askText('Nome do estilo de cor', `Cor ${styles.length + 1}`, { okLabel: 'Salvar' });
    if (!name?.trim()) return;
    const made = await run<{ created?: { id: string }[] }>('create_color_styles', { colors: [{ name: name.trim(), color: n.fill.color }] });
    if (made?.created?.[0]?.id) await run('update_layer', { id: n.id, props: { fill: { styleId: made.created[0].id } } });
  };
  const valueOf = (c: Res) => (mode && c.modes?.[mode]?.color) || c.color;
  return (
    <Block title="Cores" right={editable ? <button className="ibtn" title="Criar estilo de cor a partir da seleção" onClick={() => void fromSelection()}><Icon name="plus" size={14} /></button> : undefined}>
      {!styles.length && <p className="hint">Crie estilos de cor: mudou aqui, muda em todas as camadas.</p>}
      {styles.map((c) => (
        <ResourceRow key={c.id} kind="color" r={c} swatch={<span className="style-dot" style={{ background: valueOf(c) }} />} sub={valueOf(c)}
          onApply={() => { const ids = app.get().selection; if (ids.length) void setProps(ids, { fill: { styleId: c.id } }); }}
          extra={editable ? <input type="color" className="mini-color" title={mode ? 'Editar a cor neste modo' : 'Editar a cor (muda em todas as camadas ligadas)'} value={valueOf(c)} onChange={(e) => void run('update_design_resource', { kind: 'color', id: c.id, changes: { color: e.target.value, ...(mode ? { mode_id: mode } : {}) } })} /> : undefined} />
      ))}
    </Block>
  );
}

function TextStyles() {
  const doc = useApp((s) => s.doc)!;
  const styles = (doc.styles?.texts ?? []) as Res[];
  const editable = canEdit();
  const fromSelection = async () => {
    const n = selectedNodes().find((x) => x.type === 'text');
    if (!n) { toast('error', 'Selecione uma camada de texto.'); return; }
    const name = await askText('Nome do estilo de texto', `Texto ${styles.length + 1}`, { okLabel: 'Salvar' });
    if (!name?.trim()) return;
    const made = await run<{ created?: { id: string }[] }>('create_text_styles', { styles: [{ name: name.trim(), fontFamily: n.fontFamily, fontSize: n.fontSize, fontWeight: n.fontWeight, lineHeight: n.lineHeight, letterSpacing: n.letterSpacing, textAlign: n.textAlign }] });
    if (made?.created?.[0]?.id) await run('apply_text_style', { ids: [n.id], style_id: made.created[0].id });
  };
  return (
    <Block title="Tipografia" right={editable ? <button className="ibtn" title="Criar estilo de texto a partir da seleção" onClick={() => void fromSelection()}><Icon name="plus" size={14} /></button> : undefined}>
      {!styles.length && <p className="hint">Crie estilos de texto a partir de uma camada de texto.</p>}
      {styles.map((t) => (
        <ResourceRow key={t.id} kind="text" r={t} swatch={<span className="type-sample" style={{ fontFamily: `'${t.fontFamily}', system-ui`, fontWeight: t.fontWeight }}>Aa</span>} sub={`${t.fontFamily} ${t.fontSize}`}
          onApply={() => { const ids = selectedNodes().filter((x) => x.type === 'text').map((x) => x.id); if (ids.length) void run('apply_text_style', { ids, style_id: t.id }); else toast('error', 'Selecione uma camada de texto.'); }} />
      ))}
    </Block>
  );
}

function Effects() {
  const doc = useApp((s) => s.doc)!;
  const styles = (doc.styles?.effects ?? []) as Res[];
  const grads = (doc.styles?.gradients ?? []) as Res[];
  const editable = canEdit();
  const fromSelection = async () => {
    const n = selectedNodes().find((x) => x.shadows?.length);
    if (!n) { toast('error', 'Selecione uma camada que tenha sombra.'); return; }
    const name = await askText('Nome do estilo de sombra', `Sombra ${styles.length + 1}`, { okLabel: 'Salvar' });
    if (!name?.trim()) return;
    const made = await run<{ created?: { id: string }[] }>('create_effect_styles', { styles: [{ name: name.trim(), shadows: n.shadows }] });
    if (made?.created?.[0]?.id) await run('update_layer', { id: n.id, props: { effectStyleId: made.created[0].id } });
  };
  const gradFromSelection = async () => {
    const n = selectedNodes().find((x) => ['linear', 'radial', 'conic'].includes(x.fill?.type));
    if (!n) { toast('error', 'Selecione uma camada com gradiente.'); return; }
    const name = await askText('Nome do estilo de gradiente', `Gradiente ${grads.length + 1}`, { okLabel: 'Salvar' });
    if (!name?.trim()) return;
    const made = await run<{ created?: { id: string }[] }>('create_gradient_styles', { styles: [{ name: name.trim(), type: n.fill.type, angle: n.fill.angle, stops: n.fill.stops }] });
    if (made?.created?.[0]?.id) await run('update_layer', { id: n.id, props: { fill: { gradientId: made.created[0].id } } });
  };
  return (
    <>
      <Block title="Sombras" open={styles.length > 0} right={editable ? <button className="ibtn" title="Criar estilo de sombra a partir da seleção" onClick={() => void fromSelection()}><Icon name="plus" size={14} /></button> : undefined}>
        {!styles.length && <p className="hint">Guarde uma sombra para reaproveitar em várias camadas.</p>}
        {styles.map((e) => <ResourceRow key={e.id} kind="effect" r={e} swatch={<Icon name="layers" size={14} />} sub={`${e.shadows?.length ?? 0} sombra(s)`} onApply={() => { const ids = app.get().selection; if (ids.length) void setProps(ids, { effectStyleId: e.id }); }} />)}
      </Block>
      <Block title="Gradientes" open={grads.length > 0} right={editable ? <button className="ibtn" title="Criar estilo de gradiente a partir da seleção" onClick={() => void gradFromSelection()}><Icon name="plus" size={14} /></button> : undefined}>
        {!grads.length && <p className="hint">Guarde um gradiente para reaproveitar em várias camadas.</p>}
        {grads.map((g) => <ResourceRow key={g.id} kind="gradient" r={g} swatch={<span className="style-dot" style={{ backgroundImage: `linear-gradient(90deg, ${(g.stops ?? []).map((s: { color: string; pos: number }) => `${s.color} ${s.pos}%`).join(',')})` }} />} sub={g.type} onApply={() => { const ids = app.get().selection; if (ids.length) void setProps(ids, { fill: { gradientId: g.id } }); }} />)}
      </Block>
    </>
  );
}

function Variables() {
  const doc = useApp((s) => s.doc)!;
  const vars = (doc.styles?.vars ?? []) as Res[];
  const editable = canEdit();
  const add = async () => {
    const name = await askText('Nova variável', `Variável ${vars.length + 1}`, { okLabel: 'Próximo', message: 'Nome (ex.: Espaço médio, Raio dos cards)' });
    if (!name?.trim()) return;
    const value = await askText('Valor da variável', '16', { okLabel: 'Criar', message: 'Valor em pixels' });
    if (value == null) return;
    await run('create_size_variables', { variables: [{ name: name.trim(), value: Number(value) || 0 }] });
  };
  return (
    <Block title="Variáveis" open={vars.length > 0} right={editable ? <button className="ibtn" title="Nova variável" onClick={() => void add()}><Icon name="plus" size={14} /></button> : undefined}>
      {!vars.length && <p className="hint">Números reutilizáveis (espaçamento, raio, fonte). Ligue um campo do painel Design a uma variável: mudou aqui, muda em todas as camadas, e o CSS usa var(--nome).</p>}
      {vars.map((v) => (
        <ResourceRow key={v.id} kind="variable" r={v} sub={`${v.value}px`}
          onApply={() => void askText(`Valor de “${v.name}”`, String(v.value), { okLabel: 'Salvar', message: 'Valor em pixels' }).then((val) => { if (val != null && !Number.isNaN(Number(val))) void run('update_design_resource', { kind: 'variable', id: v.id, changes: { value: Math.max(0, Number(val)) } }); })} />
      ))}
    </Block>
  );
}

function Modes() {
  const doc = useApp((s) => s.doc)!;
  const current = useApp((s) => s.colorMode);
  const modes = (doc.styles?.modes ?? []) as Res[];
  const editable = canEdit();
  const add = async () => {
    const name = await askText('Novo modo de cor', 'Escuro', { okLabel: 'Criar', message: 'Um modo é um conjunto alternativo de valores para os estilos de cor (ex.: Escuro). O modo “Escuro” é gerado invertendo a luminosidade; ajuste cada cor depois.' });
    if (!name?.trim()) return;
    const dark = /escur|dark/i.test(name);
    await run('add_color_mode', { name: name.trim(), ...(dark ? { scheme: 'dark', auto: true } : {}) });
  };
  return (
    <Block title="Modos de cor" open={modes.length > 0} right={editable ? <button className="ibtn" title="Novo modo de cor" onClick={() => void add()}><Icon name="plus" size={14} /></button> : undefined}>
      {!modes.length && <p className="hint">Modos de cor (claro/escuro...) trocam o valor dos estilos de cor. Crie um e escolha-o na barra do topo.</p>}
      {modes.map((m) => <ResourceRow key={m.id} kind="mode" r={m} swatch={<Icon name={m.scheme === 'dark' ? 'moon' : 'sun'} size={14} />} sub={current === m.id ? 'em edição' : ''} onApply={() => app.set({ colorMode: current === m.id ? null : m.id })} />)}
    </Block>
  );
}

// ---------------------------------------------------------------- paletas (ficam neste navegador)
function Palettes() {
  const [tick, setTick] = useState(0);
  const editable = canEdit();
  void tick;
  const palettes = getPalettes() as { id: string; name: string; colors: string[] }[];
  const refresh = () => setTick((t) => t + 1);
  const apply = (hex: string, stroke: boolean) => { const ids = app.get().selection; if (ids.length) void setProps(ids, stroke ? { stroke: { color: hex } } : { fill: { type: 'solid', color: hex, styleId: null } }); };
  const addFromSelection = (id: string) => { const n = selectedNodes().find((x) => x.fill?.type === 'solid'); if (!n) { toast('error', 'Selecione uma camada com cor sólida.'); return; } changePalette(id, (p: { colors: string[] }) => paletteAdd(p, n.fill.color)); refresh(); };
  const newPalette = async () => { const name = await askText('Nova paleta', `Paleta ${palettes.length + 1}`, { okLabel: 'Criar', message: 'As paletas ficam salvas neste navegador e valem em qualquer projeto.' }); if (name?.trim()) { createPalette(name.trim()); refresh(); } };
  return (
    <Block title="Paletas" open={false} right={editable ? <button className="ibtn" title="Nova paleta" onClick={() => void newPalette()}><Icon name="plus" size={14} /></button> : undefined}>
      {!palettes.length && <p className="hint">Suas paletas ficam salvas neste navegador e aparecem em qualquer projeto. Crie uma com o +.</p>}
      {palettes.map((p) => (
        <div className="palette" key={p.id}>
          <div className="row"><b className="grow ellipsis">{p.name}</b>
            <button className="ibtn" title="Adicionar a cor da seleção" onClick={() => addFromSelection(p.id)}><Icon name="plus" size={13} /></button>
            <button className="ibtn" title="Excluir paleta" onClick={() => void confirmDialog(`Excluir a paleta “${p.name}”?`, 'Ela será apagada deste navegador.', { okLabel: 'Excluir', danger: true }).then((ok) => { if (ok) { deletePalette(p.id); refresh(); } })}><Icon name="trash" size={13} /></button></div>
          <div className="cp-swatches">{p.colors.map((c) => <button key={c} className="chip" style={{ background: c }} title={`${c} — clique: preenchimento · Shift+clique: contorno · Alt+clique: tirar da paleta`} onClick={(e) => { if (e.altKey) { changePalette(p.id, (x: { colors: string[] }) => paletteRemove(x, c)); refresh(); } else apply(normalizeHex(c) ?? c, e.shiftKey); }} />)}</div>
        </div>
      ))}
    </Block>
  );
}

export function AssetsTab() {
  return (
    <div className="tab-body assets-tab">
      <PluginAssets />
      <Block title="Fotos"><Photos /></Block>
      <Block title="Imagens do projeto" open={false}><ProjectImages /></Block>
      <Block title="Componentes"><Components /></Block>
      <ColorStyles />
      <TextStyles />
      <Effects />
      <Variables />
      <Modes />
      <Palettes />
    </div>
  );
}

export { flatList };
