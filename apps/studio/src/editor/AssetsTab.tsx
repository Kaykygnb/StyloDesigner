// Aba Recursos: fotos livres, imagens do projeto, componentes, estilos de cor/texto/sombra/gradiente, variáveis, modos de cor e paletas.
// Cada ação é uma ferramenta do MCP (create_*_styles, update_design_resource, apply_text_style, insert_asset, create_instance, add_asset…).
import { useMemo, useState } from 'react';
import { walk } from '@stylo/core/model.js';
import { getPalettes, createPalette, changePalette, deletePalette, addColor as paletteAdd, removeColor as paletteRemove, normalizeHex } from '@stylo/core/palettes.js';
import { canEdit, setProps } from '../lib/actions';
import { app, run, select, toast, useApp } from '../lib/app';
import { t } from '../lib/i18n';
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
const SUGGESTIONS = ['people', 'office', 'nature', 'food', 'texture'];

type PluginAsset = {
  id?: string; ref?: string; title?: string; name?: string; provider?: string; kind?: string; preview_url?: string;
  page_url?: string; credit?: string; license?: { name?: string; url?: string; commercial?: boolean; attribution?: string };
};

function PluginAssets() {
  const [kind, setKind] = useState<'image' | 'video' | 'audio' | 'model3d' | 'lottie' | 'font' | 'icon'>('font');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PluginAsset[]>([]);
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const [status, setStatus] = useState(tr('assets.pluginHint'));
  const [busy, setBusy] = useState(false);
  const editable = canEdit();
  const kindOptions: Array<[typeof kind, string]> = [['image', tr('assets.kindImage')], ['font', tr('assets.kindFont')], ['icon', tr('assets.kindIcon')], ['video', tr('assets.kindVideo')], ['audio', tr('assets.kindAudio')], ['model3d', '3D'], ['lottie', 'Lottie']];
  const search = async () => {
    if (!q.trim()) { setStatus(tr('assets.searchEmpty')); return; }
    setBusy(true); setStatus(tr('assets.searching'));
    try {
      const out = await run<{ results?: PluginAsset[]; count?: number; skipped?: Array<{ provider?: string; reason?: string }> }>('search_assets', { kind, query: q.trim() });
      setResults(out?.results ?? []);
      const skipped = out?.skipped?.length ? ` · ${t(language, 'ui.assets.unavailableProviders')}: ${out.skipped.map((item) => item.provider || 'provider').join(', ')}` : '';
      setStatus(`${tr('assets.results', { count: out?.count ?? out?.results?.length ?? 0 })}${skipped}`);
    }
    catch (e) { setStatus(e instanceof Error ? e.message : tr('assets.searchFailed')); setResults([]); } finally { setBusy(false); }
  };
  const use = async (item: PluginAsset) => {
    if (!editable) return;
    try {
      if (kind === 'font') { await run('add_font', { id: item.id, weights: [400, 700] }); toast('ok', tr('assets.fontAdded', { name: item.title || item.id || '' })); return; }
      if (kind === 'icon') { await run('insert_icon', { name: item.name || item.title || item.id, color: '#111111', size: 48, style: 'outlined', filled: false }); toast('ok', tr('assets.iconAdded')); return; }
      const saved = await run<{ saved?: { id?: string } }>('library_save', { ref: item.ref, name: item.title });
      if (saved?.saved?.id) { await run('library_use', { id: saved.saved.id, insert: true }); toast('ok', tr('assets.assetAdded')); }
    } catch (e) { toast('error', e instanceof Error ? e.message : tr('assets.useFailed')); }
  };
  return <Block title={tr('assets.pluginBank')}>
    <div className="asset-kind-tabs" role="tablist" aria-label={tr('assets.assetType')}>
      {kindOptions.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={kind === id} className={`chip-btn${kind === id ? ' active' : ''}`} onClick={() => setKind(id)}>{label}</button>)}
    </div>
    <div className="plugin-search"><input className="field" aria-label={tr('assets.searchPlugin')} placeholder={tr('assets.pluginSearchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void search(); }} /><button className="btn primary" disabled={busy} onClick={() => void search()}>{tr('assets.search')}</button></div>
    <p className="hint" role="status">{status}</p>
    <div className="plugin-results">{results.map((item, i) => <div className="plugin-result" key={`${item.ref || item.id}-${i}`}>{item.preview_url && <img src={item.preview_url} alt="" />}<div className="grow"><b className="ellipsis">{item.title || item.name || item.id}</b><span className="faint">{tr('assets.source')}: {item.provider || item.kind}</span><span className="faint">{tr('assets.license')}: {item.license?.url ? <a href={item.license.url} target="_blank" rel="noreferrer">{item.license.name || tr('assets.license')}</a> : (item.license?.name || tr('assets.licenseUnknown'))}{item.license?.commercial === false ? ` · ${tr('assets.nonCommercial')}` : ''}{item.license?.attribution === 'required' ? ` · ${tr('assets.attributionRequired')}` : ''}</span>{item.page_url ? <a className="faint ellipsis" href={item.page_url} target="_blank" rel="noreferrer">{tr('assets.source')}: {item.page_url}</a> : <span className="faint">{tr('assets.source')}: {item.ref || item.id}</span>}{item.credit && <span className="faint ellipsis" title={item.credit}>{tr('assets.credit')}: {item.credit}</span>}</div><button className="btn ghost sm" disabled={!editable} onClick={() => void use(item)}>{kind === 'font' ? tr('assets.add') : tr('assets.use')}</button></div>)}</div>
  </Block>;
}

function Photos() {
  const [q, setQ] = useState('');
  const [orientation, setOrientation] = useState('');
  const [results, setResults] = useState<Photo[]>([]);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(1);
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const [status, setStatus] = useState(tr('assets.photosHint'));
  const [busy, setBusy] = useState(false);
  const editable = canEdit();

  const search = async (append: boolean, term = q) => {
    if (busy) return;
    if (!term.trim()) { setStatus(tr('assets.photosSearchEmpty')); return; }
    setBusy(true);
    const next = append ? page + 1 : 1;
    setPage(next);
    setStatus(tr('assets.photosSearching'));
    try {
      const res = await fetch(`/api/photos/search?${new URLSearchParams({ q: term, page: String(next), orientation })}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr('assets.photosFailed'));
      setResults((current) => append ? [...current, ...data.results] : data.results);
      setMore(!!data.hasMore);
      setStatus(data.results.length || append ? `${append ? results.length + data.results.length : data.results.length} fotos${data.hasPexels ? ' · Openverse e Pexels' : ' · Openverse'}.` : tr('assets.photosNone'));
    } catch (e) { if (!append) { setResults([]); setMore(false); } setStatus(e instanceof Error ? e.message : tr('assets.photosFailed')); } finally { setBusy(false); }
  };

  const download = async (item: Photo): Promise<File> => {
    const res = await fetch(`/api/photos/fetch?url=${encodeURIComponent(item.full)}`);
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || tr('assets.photoDownloadFailed'));
    const blob = await res.blob();
    return new File([blob], `foto-${item.id.replace(':', '-')}.${(blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`, { type: blob.type || 'image/jpeg' });
  };
  const credit = (item: Photo) => ({ provider: item.provider, author: item.author, authorUrl: item.authorUrl, sourceUrl: item.sourceUrl, license: item.license, licenseUrl: item.licenseUrl, attribution: item.attribution, attributionRequired: item.attributionRequired });

  const insert = async (item: Photo) => {
    try {
      const { dataUrl } = await readImageFile(await download(item));
      const sel = selectedNodes();
      const parent = sel.length === 1 && sel[0].type === 'frame' ? sel[0] : null;
      const out = await run<{ created?: { id: string } }>('add_asset', { name: t(language, 'ui.assets.photoBy', { author: item.author }).slice(0, 60), data_url: dataUrl, insert: true, ...(parent ? { parent_id: parent.id } : {}) });
      const id = out?.created?.id;
      if (id) { await run('update_layer', { id, props: { photoCredit: credit(item) } }); select([id]); toast('ok', tr('assets.photoInserted')); }
    } catch (e) { toast('error', e instanceof Error ? e.message : tr('assets.photoInsertFailed')); }
  };
  const asFill = async (item: Photo) => {
    const targets = selectedNodes().filter((n) => !['group', 'path', 'text', 'section'].includes(n.type));
    if (!targets.length) { toast('error', tr('assets.photosSelectFill')); return; }
    try {
      const { dataUrl, w, h } = await readImageFile(await download(item));
      const added = await run<{ asset_id?: string }>('add_asset', { name: t(language, 'ui.assets.photoBy', { author: item.author }).slice(0, 60), data_url: dataUrl });
      if (!added?.asset_id) return;
      for (const n of targets) await run('update_layer', { id: n.id, props: { fill: { type: 'image', assetId: added.asset_id, fit: 'cover', natW: w, natH: h }, photoCredit: credit(item) } });
      toast('ok', tr('assets.photosApplied'));
    } catch (e) { toast('error', e instanceof Error ? e.message : tr('assets.photosFailed')); }
  };

  return (
    <>
      <div className="photo-search">
        <input className="field" type="search" placeholder={tr('assets.photosSearchEmpty')} aria-label={tr('assets.photosSearchEmpty')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void search(false); }} />
        <button className="btn primary" disabled={busy} onClick={() => void search(false)}>{tr('assets.search')}</button>
      </div>
      <select className="field" aria-label={tr('assets.photosAll')} value={orientation} onChange={(e) => { setOrientation(e.target.value); }}>
        <option value="">{tr('assets.photosAll')}</option><option value="landscape">{tr('assets.photosLandscape')}</option><option value="portrait">{tr('assets.photosPortrait')}</option><option value="square">{tr('assets.photosSquare')}</option>
      </select>
      <div className="chips">{SUGGESTIONS.map((id) => { const s = tr(`ui.assets.suggest.${id}`); return <button key={id} className="chip-btn" onClick={() => { setQ(s); void search(false, s); }}>{s}</button>; })}</div>
      <p className="hint" role="status">{status}</p>
      <div className="photo-results-scroll" tabIndex={0} aria-label={t(language, 'ui.assets.photoResults')}>
      <div className="photo-grid">
        {results.map((item) => (
          <article className="photo-card" key={item.id} title={`${item.author} · ${item.license}`}>
            <button type="button" className="photo-image" disabled={!editable} aria-label={tr('assets.photosInsert', { author: item.author })} onClick={() => void insert(item)}><img src={item.thumb} alt={tr('assets.photosInsert', { author: item.author })} loading="lazy" /></button>
            <div className="photo-meta"><span>{item.provider}</span><span className="faint ellipsis">{item.author} · {item.license}</span><span className="faint ellipsis" title={item.sourceUrl || item.full}>{tr('assets.photosOrigin')}: {item.sourceUrl || item.full}</span>
              <button type="button" className="ibtn" title={tr('assets.photosFill')} disabled={!editable} onClick={() => void asFill(item)}><Icon name="rect" size={13} /></button></div>
          </article>
        ))}
      </div>
      {more && <button className="btn block" disabled={busy} onClick={() => void search(true)}>{tr('assets.photosMore')}</button>}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- imagens do projeto
function ProjectImages() {
  const doc = useApp((s) => s.doc)!;
  const language = useApp((s) => s.language);
  const tr = (key: string) => t(language, key);
  const assets = Object.entries((doc.assets ?? {}) as Record<string, string>).filter(([, src]) => typeof src === 'string' && src.startsWith('data:image/'));
  const editable = canEdit();
  const upload = async (f: File) => {
    try { const { dataUrl } = await readImageFile(f); const out = await run<{ created?: { id: string } }>('add_asset', { name: f.name.replace(/\.[^.]+$/, ''), data_url: dataUrl, insert: true }); if (out?.created?.id) select([out.created.id]); }
    catch (e) { toast('error', e instanceof Error ? e.message : tr('assets.imageReadFailed')); }
  };
  return (
    <>
      {editable && <label className="btn block"><Icon name="plus" size={13} /> {tr('assets.uploadImage')}<input type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} /></label>}
      {assets.length ? (
        <div className="asset-grid small">
          {assets.map(([id, src]) => <button key={id} type="button" className="asset-thumb" title={tr('assets.insertCanvas')} disabled={!editable} onClick={() => void run<{ created?: { id: string } }>('insert_asset', { id }).then((o) => { if (o?.created?.id) select([o.created.id]); })}><img src={src} alt="" /></button>)}
        </div>
      ) : <p className="hint">{tr('assets.projectImagesHint')}</p>}
    </>
  );
}

// ---------------------------------------------------------------- componentes
function Components() {
  const doc = useApp((s) => s.doc)!;
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const editable = canEdit();
  const list = useMemo(() => {
    const out: { n: LayerNode; page: string; uses: number }[] = [];
    const uses = new Map<string, number>();
    for (const p of doc.pages) walk(p.children, (x: LayerNode) => { if (x.instanceOf) uses.set(x.instanceOf, (uses.get(x.instanceOf) ?? 0) + 1); });
    for (const p of doc.pages) walk(p.children, (x: LayerNode) => { if (x.component) out.push({ n: x, page: p.name, uses: uses.get(x.id) ?? 0 }); });
    return out;
  }, [doc]);
  if (!list.length) return <p className="hint">{tr('assets.componentsEmpty')}</p>;
  return (
    <>
      {list.map(({ n, page, uses }) => (
        <button key={n.id} className="res-row" disabled={!editable} title={tr('assets.insertComponent', { name: n.name })} onClick={() => void run<{ created?: { id: string } }>('create_instance', { component_id: n.id }).then((o) => { if (o?.created?.id) select([o.created.id]); })}>
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
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const rename = async () => { const name = await askText(tr('assets.rename'), r.name, { okLabel: tr('assets.save') }); if (name?.trim() && name.trim() !== r.name) await run('update_design_resource', { kind, id: r.id, changes: { name: name.trim() } }); };
  const remove = async () => {
    if (await confirmDialog(tr('assets.deleteResource', { name: r.name }), tr('assets.deleteResourceHint'), { okLabel: tr('assets.delete'), danger: true })) await run('delete_design_resource', { kind, id: r.id, detach: true });
  };
  return (
    <div className="res-row static">
      <button type="button" className="res-main" disabled={!onApply || !editable} title={onApply ? tr('assets.applySelection') : r.name} onClick={onApply}>
        {swatch}<span className="grow ellipsis">{r.name}</span>{sub && <span className="faint">{sub}</span>}
      </button>
      {extra}
      {editable && <button type="button" className="ibtn" title={tr('assets.rename')} onClick={() => void rename()}><Icon name="note" size={13} /></button>}
      {editable && <button type="button" className="ibtn" title={tr('assets.delete')} onClick={() => void remove()}><Icon name="trash" size={13} /></button>}
    </div>
  );
}

function ColorStyles() {
  const doc = useApp((s) => s.doc)!;
  const mode = useApp((s) => s.colorMode);
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const styles = (doc.styles?.colors ?? []) as Res[];
  const editable = canEdit();
  const fromSelection = async () => {
    const n = selectedNodes().find((x) => x.fill?.type === 'solid');
    if (!n) { toast('error', tr('assets.selectSolidFill')); return; }
    const name = await askText(tr('assets.colorStyleName'), t(language, 'ui.assets.colorStyleDefault', { n: styles.length + 1 }), { okLabel: tr('assets.save') });
    if (!name?.trim()) return;
    const made = await run<{ created?: { id: string }[] }>('create_color_styles', { colors: [{ name: name.trim(), color: n.fill.color }] });
    if (made?.created?.[0]?.id) await run('update_layer', { id: n.id, props: { fill: { styleId: made.created[0].id } } });
  };
  const valueOf = (c: Res) => (mode && c.modes?.[mode]?.color) || c.color;
  return (
    <Block title={tr('assets.colors')} right={editable ? <button className="ibtn" title={tr('assets.createColorStyle')} onClick={() => void fromSelection()}><Icon name="plus" size={14} /></button> : undefined}>
      {!styles.length && <p className="hint">{tr('assets.colorStyleEmpty')}</p>}
      {styles.map((c) => (
        <ResourceRow key={c.id} kind="color" r={c} swatch={<span className="style-dot" style={{ background: valueOf(c) }} />} sub={valueOf(c)}
          onApply={() => { const ids = app.get().selection; if (ids.length) void setProps(ids, { fill: { styleId: c.id } }); }}
          extra={editable ? <input type="color" className="mini-color" title={mode ? tr('assets.editColorMode') : tr('assets.editColorAll')} value={valueOf(c)} onChange={(e) => void run('update_design_resource', { kind: 'color', id: c.id, changes: { color: e.target.value, ...(mode ? { mode_id: mode } : {}) } })} /> : undefined} />
      ))}
    </Block>
  );
}

function TextStyles() {
  const doc = useApp((s) => s.doc)!;
  const styles = (doc.styles?.texts ?? []) as Res[];
  const language = useApp((s) => s.language);
  const tr = (key: string) => t(language, key);
  const editable = canEdit();
  const fromSelection = async () => {
    const n = selectedNodes().find((x) => x.type === 'text');
    if (!n) { toast('error', tr('assets.selectText')); return; }
    const name = await askText(tr('assets.textStyleName'), t(language, 'ui.assets.textStyleDefault', { n: styles.length + 1 }), { okLabel: tr('assets.save') });
    if (!name?.trim()) return;
    const made = await run<{ created?: { id: string }[] }>('create_text_styles', { styles: [{ name: name.trim(), fontFamily: n.fontFamily, fontSize: n.fontSize, fontWeight: n.fontWeight, lineHeight: n.lineHeight, letterSpacing: n.letterSpacing, textAlign: n.textAlign }] });
    if (made?.created?.[0]?.id) await run('apply_text_style', { ids: [n.id], style_id: made.created[0].id });
  };
  return (
    <Block title={tr('assets.textStyles')} right={editable ? <button className="ibtn" title={tr('assets.createTextStyle')} onClick={() => void fromSelection()}><Icon name="plus" size={14} /></button> : undefined}>
      {!styles.length && <p className="hint">{tr('assets.textStyleEmpty')}</p>}
      {styles.map((t) => (
        <ResourceRow key={t.id} kind="text" r={t} swatch={<span className="type-sample" style={{ fontFamily: `'${t.fontFamily}', system-ui`, fontWeight: t.fontWeight }}>Aa</span>} sub={`${t.fontFamily} ${t.fontSize}`}
          onApply={() => { const ids = selectedNodes().filter((x) => x.type === 'text').map((x) => x.id); if (ids.length) void run('apply_text_style', { ids, style_id: t.id }); else toast('error', tr('assets.selectText')); }} />
      ))}
    </Block>
  );
}

function Effects() {
  const doc = useApp((s) => s.doc)!;
  const styles = (doc.styles?.effects ?? []) as Res[];
  const grads = (doc.styles?.gradients ?? []) as Res[];
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const editable = canEdit();
  const fromSelection = async () => {
    const n = selectedNodes().find((x) => x.shadows?.length);
    if (!n) { toast('error', tr('assets.selectShadow')); return; }
    const name = await askText(tr('assets.shadowStyleName'), `Sombra ${styles.length + 1}`, { okLabel: tr('assets.save') });
    if (!name?.trim()) return;
    const made = await run<{ created?: { id: string }[] }>('create_effect_styles', { styles: [{ name: name.trim(), shadows: n.shadows }] });
    if (made?.created?.[0]?.id) await run('update_layer', { id: n.id, props: { effectStyleId: made.created[0].id } });
  };
  const gradFromSelection = async () => {
    const n = selectedNodes().find((x) => ['linear', 'radial', 'conic'].includes(x.fill?.type));
    if (!n) { toast('error', tr('assets.selectGradient')); return; }
    const name = await askText(tr('assets.gradientStyleName'), `Gradiente ${grads.length + 1}`, { okLabel: tr('assets.save') });
    if (!name?.trim()) return;
    const made = await run<{ created?: { id: string }[] }>('create_gradient_styles', { styles: [{ name: name.trim(), type: n.fill.type, angle: n.fill.angle, stops: n.fill.stops }] });
    if (made?.created?.[0]?.id) await run('update_layer', { id: n.id, props: { fill: { gradientId: made.created[0].id } } });
  };
  return (
    <>
      <Block title={tr('assets.shadows')} open={styles.length > 0} right={editable ? <button className="ibtn" title={tr('assets.createShadowStyle')} onClick={() => void fromSelection()}><Icon name="plus" size={14} /></button> : undefined}>
        {!styles.length && <p className="hint">{tr('assets.shadowEmpty')}</p>}
        {styles.map((e) => <ResourceRow key={e.id} kind="effect" r={e} swatch={<Icon name="layers" size={14} />} sub={tr('assets.shadowCount', { count: e.shadows?.length ?? 0 })} onApply={() => { const ids = app.get().selection; if (ids.length) void setProps(ids, { effectStyleId: e.id }); }} />)}
      </Block>
      <Block title={tr('assets.gradients')} open={grads.length > 0} right={editable ? <button className="ibtn" title={tr('assets.createGradientStyle')} onClick={() => void gradFromSelection()}><Icon name="plus" size={14} /></button> : undefined}>
        {!grads.length && <p className="hint">{tr('assets.gradientEmpty')}</p>}
        {grads.map((g) => <ResourceRow key={g.id} kind="gradient" r={g} swatch={<span className="style-dot" style={{ backgroundImage: `linear-gradient(90deg, ${(g.stops ?? []).map((s: { color: string; pos: number }) => `${s.color} ${s.pos}%`).join(',')})` }} />} sub={g.type} onApply={() => { const ids = app.get().selection; if (ids.length) void setProps(ids, { fill: { gradientId: g.id } }); }} />)}
      </Block>
    </>
  );
}

function Variables() {
  const doc = useApp((s) => s.doc)!;
  const vars = (doc.styles?.vars ?? []) as Res[];
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const editable = canEdit();
  const add = async () => {
    const name = await askText(tr('assets.newVariable'), t(language, 'ui.assets.variableDefault', { n: vars.length + 1 }), { okLabel: tr('assets.variableNext'), message: tr('assets.variableNameHint') });
    if (!name?.trim()) return;
    const value = await askText(tr('assets.variableValue'), '16', { okLabel: tr('assets.variableCreate'), message: tr('assets.variableValueHint') });
    if (value == null) return;
    await run('create_size_variables', { variables: [{ name: name.trim(), value: Number(value) || 0 }] });
  };
  return (
    <Block title={tr('assets.variables')} open={vars.length > 0} right={editable ? <button className="ibtn" title={tr('assets.newVariable')} onClick={() => void add()}><Icon name="plus" size={14} /></button> : undefined}>
      {!vars.length && <p className="hint">{tr('assets.variableEmpty')}</p>}
      {vars.map((v) => (
        <ResourceRow key={v.id} kind="variable" r={v} sub={`${v.value}px`}
          onApply={() => void askText(tr('assets.variableValueTitle', { name: v.name }), String(v.value), { okLabel: tr('assets.save'), message: tr('assets.variableValueHint') }).then((val) => { if (val != null && !Number.isNaN(Number(val))) void run('update_design_resource', { kind: 'variable', id: v.id, changes: { value: Math.max(0, Number(val)) } }); })} />
      ))}
    </Block>
  );
}

function Modes() {
  const doc = useApp((s) => s.doc)!;
  const current = useApp((s) => s.colorMode);
  const modes = (doc.styles?.modes ?? []) as Res[];
  const language = useApp((s) => s.language);
  const tr = (key: string) => t(language, key);
  const editable = canEdit();
  const add = async () => {
    const name = await askText(tr('assets.newMode'), 'Escuro', { okLabel: tr('assets.variableCreate'), message: tr('assets.modeCreateHint') });
    if (!name?.trim()) return;
    const dark = /escur|dark/i.test(name);
    await run('add_color_mode', { name: name.trim(), ...(dark ? { scheme: 'dark', auto: true } : {}) });
  };
  return (
    <Block title={tr('assets.modes')} open={modes.length > 0} right={editable ? <button className="ibtn" title={tr('assets.newMode')} onClick={() => void add()}><Icon name="plus" size={14} /></button> : undefined}>
      {!modes.length && <p className="hint">{tr('assets.modesEmpty')}</p>}
      {modes.map((m) => <ResourceRow key={m.id} kind="mode" r={m} swatch={<Icon name={m.scheme === 'dark' ? 'moon' : 'sun'} size={14} />} sub={current === m.id ? tr('assets.modeEditing') : ''} onApply={() => app.set({ colorMode: current === m.id ? null : m.id })} />)}
    </Block>
  );
}

// ---------------------------------------------------------------- paletas (ficam neste navegador)
function Palettes() {
  const [tick, setTick] = useState(0);
  const editable = canEdit();
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  void tick;
  const palettes = getPalettes() as { id: string; name: string; colors: string[] }[];
  const refresh = () => setTick((t) => t + 1);
  const apply = (hex: string, stroke: boolean) => { const ids = app.get().selection; if (ids.length) void setProps(ids, stroke ? { stroke: { color: hex } } : { fill: { type: 'solid', color: hex, styleId: null } }); };
  const addFromSelection = (id: string) => { const n = selectedNodes().find((x) => x.fill?.type === 'solid'); if (!n) { toast('error', tr('assets.selectSolidFill')); return; } changePalette(id, (p: { colors: string[] }) => paletteAdd(p, n.fill.color)); refresh(); };
  const newPalette = async () => { const name = await askText(tr('assets.newPalette'), `Paleta ${palettes.length + 1}`, { okLabel: tr('assets.variableCreate'), message: tr('assets.paletteCreateHint') }); if (name?.trim()) { createPalette(name.trim()); refresh(); } };
  return (
    <Block title={tr('assets.palettes')} open={false} right={editable ? <button className="ibtn" title={tr('assets.newPalette')} onClick={() => void newPalette()}><Icon name="plus" size={14} /></button> : undefined}>
      {!palettes.length && <p className="hint">{tr('assets.paletteEmpty')}</p>}
      {palettes.map((p) => (
        <div className="palette" key={p.id}>
          <div className="row"><b className="grow ellipsis">{p.name}</b>
            <button className="ibtn" title={tr('assets.addSelectionColor')} onClick={() => addFromSelection(p.id)}><Icon name="plus" size={13} /></button>
            <button className="ibtn" title={tr('assets.deletePalette')} onClick={() => void confirmDialog(tr('assets.deletePaletteQuestion', { name: p.name }), tr('assets.deletePaletteHint'), { okLabel: tr('assets.delete'), danger: true }).then((ok) => { if (ok) { deletePalette(p.id); refresh(); } })}><Icon name="trash" size={13} /></button></div>
          <div className="cp-swatches">{p.colors.map((c) => <button key={c} className="chip" style={{ background: c }} title={tr('assets.paletteSwatchHint', { color: c })} onClick={(e) => { if (e.altKey) { changePalette(p.id, (x: { colors: string[] }) => paletteRemove(x, c)); refresh(); } else apply(normalizeHex(c) ?? c, e.shiftKey); }} />)}</div>
        </div>
      ))}
    </Block>
  );
}

export function AssetsTab() {
  const language = useApp((s) => s.language);
  const tr = (key: string) => t(language, key);
  return (
    <div className="tab-body assets-tab">
      <PluginAssets />
      <Block title={t(language, 'ui.assets.photos')}><Photos /></Block>
      <Block title={tr('assets.projectImages')} open={false}><ProjectImages /></Block>
      <Block title={tr('assets.components')}><Components /></Block>
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
