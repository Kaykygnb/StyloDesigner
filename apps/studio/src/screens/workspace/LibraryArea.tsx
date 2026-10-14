// Biblioteca: os arquivos da conta como uma grade de cartões com prévia grande.
// O que se lê de relance fica no cartão (nome, tipo, tamanho e um selo quando algo pede atenção);
// o resto (licença, crédito, onde é usado, ações) mora no painel de detalhes, que abre ao clicar.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../../lib/api';
import { toast, useApp } from '../../lib/app';
import { confirmDialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { formatDate, formatNumber, t, tp } from '../../lib/i18n';
import type { Language } from '../../lib/app';

type Usage = Record<string, { useCount: number; orphan: boolean; projects: Array<{ file: string; name: string }> }>;
type View = 'grid' | 'list';

// cada tipo de arquivo tem um ícone e uma das tintas da marca, para a grade ser lida pela cor
const KINDS: Record<string, { icon: string; ink: 'c' | 'm' | 'y' | 'k' }> = {
  IMAGE: { icon: 'image', ink: 'c' },
  VIDEO: { icon: 'video', ink: 'm' },
  AUDIO: { icon: 'music', ink: 'y' },
  MODEL3D: { icon: 'cube', ink: 'c' },
  LOTTIE: { icon: 'play', ink: 'm' },
  FONT: { icon: 'fonttype', ink: 'y' },
  OTHER: { icon: 'file', ink: 'k' },
};
const kindOf = (a: api.LibraryAsset) => { const k = (a.kind || 'OTHER').toUpperCase(); return k in KINDS ? k : 'OTHER'; };
const fileUrl = (a: api.LibraryAsset) => `/api/library/${encodeURIComponent(a.id)}/file`;
const VIEW_KEY = 'stylo.libraryView';

/** "PNG", "SVG", "WOFF2": a extensão do nome ou, sem ela, o subtipo do MIME. */
function extOf(a: api.LibraryAsset): string {
  const dot = a.name.lastIndexOf('.');
  if (dot > 0 && dot > a.name.length - 7) return a.name.slice(dot + 1).toUpperCase();
  return (a.mime.split('/')[1] || '').split('+')[0].toUpperCase() || '—';
}

export function formatBytes(language: Language, bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${formatNumber(language, kb, { maximumFractionDigits: kb < 10 ? 1 : 0 })} KB`;
  return `${formatNumber(language, kb / 1024, { maximumFractionDigits: 1 })} MB`;
}

export function LibraryArea() {
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const [assets, setAssets] = useState<api.LibraryAsset[]>([]);
  const [usage, setUsage] = useState<Usage>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [source, setSource] = useState('all');
  const [license, setLicense] = useState('all');
  const [credit, setCredit] = useState<'all' | 'required' | 'missing'>('all');
  const [size, setSize] = useState<'all' | 'small' | 'large'>('all');
  const [date, setDate] = useState<'all' | 'recent'>('all');
  const [used, setUsed] = useState<'all' | 'used' | 'orphan'>('all');
  const [tag, setTag] = useState('');
  const [moreFilters, setMoreFilters] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [view, setView] = useState<View>(() => { try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'; } catch { return 'grid'; } });
  const input = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    void Promise.all([api.libraryList(), api.libraryUsageDetail()])
      .then(([list, detail]) => {
        setAssets(list.assets);
        setUsage(Object.fromEntries(detail.assets.map((item) => [item.assetId, { useCount: item.useCount, orphan: item.orphan, projects: item.projects }])));
      })
      .catch((e) => toast('error', String(e)))
      .finally(() => setLoading(false));
  }, []);

  const changeView = (next: View) => { setView(next); try { localStorage.setItem(VIEW_KEY, next); } catch { /* sem armazenamento: vale só nesta visita */ } };

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setUploading(files.length);
    let ok = 0;
    for (const file of files) {
      try {
        const { asset } = await api.libraryUpload(file);
        setAssets((x) => [asset, ...x.filter((item) => item.id !== asset.id)]);
        ok++;
      } catch (e) { toast('error', `${file.name}: ${String(e)}`); }
      setUploading((n) => n - 1);
    }
    if (ok === 1) toast('ok', tr('library.assetUploaded'));
    else if (ok > 1) toast('ok', tp(language, 'ui.library.uploadedMany', ok));
  };

  const removeIds = async (ids: string[]) => {
    const names = assets.filter((a) => ids.includes(a.id)).map((a) => a.name);
    const sure = await confirmDialog(ids.length === 1 ? tr('ui.library.removeOne', { name: names[0] || '' }) : tp(language, 'ui.library.removeMany', ids.length), tr('ui.library.removeHint'), { okLabel: tr('library.remove'), danger: true });
    if (!sure) return;
    try {
      if (ids.length === 1) await api.libraryRemove(ids[0]); else await api.libraryRemoveMany(ids);
      setAssets((x) => x.filter((a) => !ids.includes(a.id)));
      setSelected((x) => x.filter((id) => !ids.includes(id)));
      if (openId && ids.includes(openId)) setOpenId(null);
      toast('ok', tp(language, 'ui.library.removed', ids.length));
    } catch (e) { toast('error', String(e)); }
  };

  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    for (const a of assets) if (a.hash) seen.set(a.hash, (seen.get(a.hash) || 0) + 1);
    return new Set([...seen].filter(([, n]) => n > 1).map(([h]) => h));
  }, [assets]);
  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assets) counts.set(kindOf(a), (counts.get(kindOf(a)) || 0) + 1);
    return Object.keys(KINDS).filter((k) => counts.has(k)).map((k) => [k, counts.get(k)!] as const);
  }, [assets]);
  const sources = [...new Set(assets.map((a) => a.source || 'upload'))].sort();
  const licenses = [...new Set(assets.map((a) => a.license?.name).filter((x): x is string => !!x))].sort();
  const totalBytes = assets.reduce((sum, a) => sum + a.size, 0);
  const unusedCount = assets.filter((a) => usage[a.id]?.orphan).length;

  const filtered = assets.filter((a) => {
    const needle = q.trim().toLowerCase();
    const haystack = [a.name, a.mime, a.source || '', ...(a.tags || []), a.license?.name || '', a.credit || ''].join(' ').toLowerCase();
    const tags = tag.trim().toLowerCase().split(/\s*,\s*/).filter(Boolean);
    return (!needle || haystack.includes(needle))
      && (kind === 'all' || kindOf(a) === kind)
      && (source === 'all' || (a.source || 'upload') === source)
      && (license === 'all' || a.license?.name === license)
      && (credit === 'all' || (credit === 'required' ? a.license?.attribution === 'required' : !a.credit && a.license?.attribution !== 'required'))
      && (size === 'all' || (size === 'small' ? a.size < 1024 * 1024 : a.size >= 1024 * 1024))
      && (date === 'all' || (!!a.addedAt && Date.now() - Date.parse(a.addedAt) <= 30 * 24 * 60 * 60 * 1000))
      && (used === 'all' || (used === 'orphan' ? usage[a.id]?.orphan : (usage[a.id]?.useCount ?? 0) > 0))
      && (!tags.length || tags.every((x) => (a.tags || []).includes(x)));
  });
  const advancedActive = [source, license, credit, size, date, used].filter((v) => v !== 'all').length + (tag.trim() ? 1 : 0);
  const clearFilters = () => { setQ(''); setKind('all'); setSource('all'); setLicense('all'); setCredit('all'); setSize('all'); setDate('all'); setUsed('all'); setTag(''); };
  const open = assets.find((a) => a.id === openId) || null;
  const step = (dir: 1 | -1) => {
    const i = filtered.findIndex((a) => a.id === openId);
    if (i < 0 || !filtered.length) return;
    setOpenId(filtered[(i + dir + filtered.length) % filtered.length].id);
  };
  const toggle = (id: string, on: boolean) => setSelected((x) => on ? [...new Set([...x, id])] : x.filter((v) => v !== id));

  // arrastar arquivos para qualquer ponto da página mostra a área de soltar
  const hasFiles = (e: React.DragEvent) => [...e.dataTransfer.types].includes('Files');
  const dragProps = {
    onDragEnter: (e: React.DragEvent) => { if (!hasFiles(e)) return; dragDepth.current++; setDragging(true); },
    onDragOver: (e: React.DragEvent) => { if (hasFiles(e)) e.preventDefault(); },
    onDragLeave: () => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); },
    onDrop: (e: React.DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth.current = 0; setDragging(false); void upload([...e.dataTransfer.files]); },
  };

  return (
    <section className="workspace-section library-area" {...dragProps}>
      <input ref={input} hidden type="file" multiple onChange={(e) => { void upload([...(e.target.files || [])]); e.currentTarget.value = ''; }} />
      <header className="area-head">
        <div>
          <h1>{tr('library.title')}</h1>
          <p className="muted">{tr('library.subtitle')}</p>
          {assets.length > 0 && <p className="area-summary">
            <span><b>{tp(language, 'ui.library.files', assets.length)}</b></span>
            <span>{formatBytes(language, totalBytes)}</span>
            {unusedCount > 0 && <button type="button" className="summary-flag" onClick={() => { setUsed('orphan'); setMoreFilters(true); }}>{tp(language, 'ui.library.unusedCount', unusedCount)}</button>}
            {duplicates.size > 0 && <span className="summary-flag warn">{tp(language, 'ui.library.duplicates', duplicates.size)}</span>}
          </p>}
        </div>
        <button className="btn primary lg" onClick={() => input.current?.click()} disabled={uploading > 0}>
          {uploading > 0 ? <span className="spinner" /> : <Icon name="upload" size={15} />}{tr('library.upload')}
        </button>
      </header>

      <>
        <div className="library-toolbar">
          <div className="search library-search"><Icon name="search" size={14} /><input className="field" placeholder={tr('library.search')} value={q} onChange={(e) => setQ(e.target.value)} />{q && <button type="button" className="search-clear" aria-label={tr('ui.workspace.clearFilters')} onClick={() => setQ('')}><Icon name="close" size={12} /></button>}</div>
          <button type="button" className={`btn ghost${moreFilters || advancedActive ? ' active' : ''}`} aria-expanded={moreFilters} onClick={() => setMoreFilters((v) => !v)}>
            <Icon name="sliders" size={14} /> {tr('ui.workspace.moreFilters')}{advancedActive > 0 && <span className="badge">{advancedActive}</span>}
          </button>
          <div className="view-toggle" role="group" aria-label={tr('ui.library.view')}>
            <button type="button" aria-pressed={view === 'grid'} title={tr('ui.library.gridView')} aria-label={tr('ui.library.gridView')} onClick={() => changeView('grid')}><Icon name="grid" size={14} /></button>
            <button type="button" aria-pressed={view === 'list'} title={tr('ui.library.listView')} aria-label={tr('ui.library.listView')} onClick={() => changeView('list')}><Icon name="rows" size={14} /></button>
          </div>
        </div>
        {assets.length > 0 && <div className="kind-chips" role="group" aria-label={tr('library.type')}>
          <button type="button" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>{tr('ui.library.all')}<span>{assets.length}</span></button>
          {kindCounts.map(([k, n]) => <button type="button" key={k} aria-pressed={kind === k} data-ink={KINDS[k].ink} onClick={() => setKind(kind === k ? 'all' : k)}><i aria-hidden="true" />{tr(`ui.library.kind.${k}`)}<span>{n}</span></button>)}
        </div>}
        {moreFilters && <div className="library-filters more">
          <select className="field" aria-label={tr('library.source')} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">{tr('library.allSources')}</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="field" aria-label={tr('library.license')} value={license} onChange={(e) => setLicense(e.target.value)}>
            <option value="all">{tr('library.allLicenses')}</option>
            {licenses.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className="field" aria-label={tr('library.credit')} value={credit} onChange={(e) => setCredit(e.target.value as typeof credit)}>
            <option value="all">{tr('library.anyCredit')}</option>
            <option value="required">{tr('library.requiredCredit')}</option>
            <option value="missing">{tr('library.missingCredit')}</option>
          </select>
          <select className="field" aria-label={tr('library.size')} value={size} onChange={(e) => setSize(e.target.value as typeof size)}><option value="all">{tr('library.anySize')}</option><option value="small">{tr('library.small')}</option><option value="large">{tr('library.large')}</option></select>
          <select className="field" aria-label={tr('library.date')} value={date} onChange={(e) => setDate(e.target.value as typeof date)}><option value="all">{tr('library.anyDate')}</option><option value="recent">{tr('library.recent')}</option></select>
          <select className="field" aria-label={tr('library.usage')} value={used} onChange={(e) => setUsed(e.target.value as typeof used)}><option value="all">{tr('library.anyUsage')}</option><option value="used">{tr('library.used')}</option><option value="orphan">{tr('library.orphan')}</option></select>
          <input className="field" placeholder={tr('library.tags')} value={tag} onChange={(e) => setTag(e.target.value)} />
          {advancedActive > 0 && <button type="button" className="btn ghost sm" onClick={clearFilters}>{tr('ui.workspace.clearFilters')}</button>}
        </div>}
      </>

      {loading ? (
        <div className="asset-grid skeleton" aria-live="polite">{Array.from({ length: 8 }, (_, i) => <span key={i} style={{ '--i': i } as React.CSSProperties} />)}</div>
      ) : !assets.length ? (
        // biblioteca vazia: explica para que serve e aceita arquivos arrastados
        <button type="button" className={`library-empty${dragging ? ' dragging' : ''}`} onClick={() => input.current?.click()}>
          <span className="library-empty-art" aria-hidden="true"><i /><i /><i /><Icon name="upload" size={20} /></span>
          <b>{tr('ui.workspace.libraryEmptyTitle')}</b>
          <span className="muted">{tr('ui.workspace.libraryEmptyHint')}</span>
        </button>
      ) : !filtered.length ? (
        <div className="library-none">
          <Icon name="search" size={20} />
          <b>{tr('library.notFound')}</b>
          <button type="button" className="btn sm" onClick={clearFilters}>{tr('ui.workspace.clearFilters')}</button>
        </div>
      ) : (
        <ul className={`asset-grid ${view}`}>
          {filtered.map((a, i) => {
            const k = kindOf(a);
            const u = usage[a.id];
            const isDup = !!a.hash && duplicates.has(a.hash);
            const checked = selected.includes(a.id);
            return (
              <li key={a.id} className={`asset-card${checked ? ' selected' : ''}`} data-ink={KINDS[k].ink} style={{ '--i': Math.min(i, 16) } as React.CSSProperties}>
                <button type="button" className="asset-open" onClick={() => setOpenId(a.id)} aria-label={`${a.name}, ${tr('ui.library.details').toLowerCase()}`}>
                  <span className="asset-preview"><Preview asset={a} /></span>
                  <span className="asset-info">
                    <b title={a.name}>{a.name}</b>
                    <span className="asset-meta"><span className="ext">{extOf(a)}</span>{formatBytes(language, a.size)}{a.width && a.height ? ` · ${a.width}×${a.height}` : ''}</span>
                    <span className="asset-flags">
                      {u?.useCount ? <span className="flag ok">{tp(language, 'ui.library.inProjects', u.useCount)}</span> : u?.orphan ? <span className="flag">{tr('ui.library.unused')}</span> : null}
                      {isDup && <span className="flag warn">{tr('ui.library.dupBadge')}</span>}
                      {a.license?.attribution === 'required' && <span className="flag info">{tr('ui.library.creditBadge')}</span>}
                    </span>
                  </span>
                </button>
                <label className="asset-check" title={tr('library.select')}>
                  <input type="checkbox" aria-label={`${tr('library.select')} ${a.name}`} checked={checked} onChange={(e) => toggle(a.id, e.target.checked)} />
                  <span aria-hidden="true"><Icon name="check" size={12} /></span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {selected.length > 0 && <div className="selection-bar" role="region" aria-label={tr('library.removeSelected')}>
        <b>{tp(language, 'ui.library.selected', selected.length)}</b>
        <button type="button" className="btn ghost sm" onClick={() => setSelected(filtered.map((a) => a.id))}>{tr('ui.library.selectAll')}</button>
        <button type="button" className="btn ghost sm" onClick={() => setSelected([])}>{tr('ui.library.clearSelection')}</button>
        <button type="button" className="btn danger sm" onClick={() => void removeIds(selected)}><Icon name="trash" size={13} />{tr('library.removeSelected')}</button>
      </div>}

      {dragging && assets.length > 0 && <div className="drop-overlay" aria-hidden="true"><div><Icon name="upload" size={28} /><b>{tr('ui.library.dropToUpload')}</b></div></div>}

      {open && <AssetDrawer
        key={open.id}
        asset={open}
        usage={usage[open.id]}
        duplicate={!!open.hash && duplicates.has(open.hash)}
        position={`${filtered.findIndex((a) => a.id === open.id) + 1} / ${filtered.length}`}
        onClose={() => setOpenId(null)}
        onStep={step}
        onRemove={() => void removeIds([open.id])}
        onChange={(updated) => setAssets((x) => x.map((v) => v.id === updated.id ? updated : v))}
      />}
    </section>
  );
}

/** A miniatura: a própria imagem; para fontes, "Aa" desenhado na fonte; vídeo mostra o primeiro quadro; o resto, o ícone do tipo. */
function Preview({ asset, large = false }: { asset: api.LibraryAsset; large?: boolean }) {
  const k = kindOf(asset);
  if (k === 'IMAGE' || asset.mime.startsWith('image/')) return <img src={fileUrl(asset)} alt="" loading="lazy" draggable={false} />;
  if (k === 'VIDEO') return <video src={`${fileUrl(asset)}#t=0.1`} muted preload="metadata" playsInline controls={large} />;
  if (k === 'FONT') return <FontSample asset={asset} large={large} />;
  if (k === 'AUDIO' && large) return <span className="preview-icon"><Icon name="music" size={34} /><audio src={fileUrl(asset)} controls preload="none" /></span>;
  return <span className="preview-icon"><Icon name={KINDS[k].icon} size={large ? 40 : 26} /></span>;
}

function FontSample({ asset, large }: { asset: api.LibraryAsset; large: boolean }) {
  const family = `stylo-lib-${asset.id.replace(/[^a-z0-9]/gi, '')}`;
  const [ready, setReady] = useState(() => [...document.fonts].some((f) => f.family === family));
  useEffect(() => {
    if (ready) return;
    let alive = true;
    const face = new FontFace(family, `url(${fileUrl(asset)})`);
    face.load().then((loaded) => { document.fonts.add(loaded); if (alive) setReady(true); }).catch(() => { /* fonte inválida: fica o ícone */ });
    return () => { alive = false; };
  }, [family]);
  if (!ready) return <span className="preview-icon"><Icon name="fonttype" size={large ? 40 : 26} /></span>;
  return <span className="font-sample" style={{ fontFamily: `'${family}'` }}>{large ? <>Aa Bb Cc<small>0123456789 · {asset.name.replace(/\.[^.]+$/, '')}</small></> : 'Aa'}</span>;
}

function AssetDrawer({ asset, usage, duplicate, position, onClose, onStep, onRemove, onChange }: {
  asset: api.LibraryAsset;
  usage?: Usage[string];
  duplicate: boolean;
  position: string;
  onClose(): void;
  onStep(dir: 1 | -1): void;
  onRemove(): void;
  onChange(asset: api.LibraryAsset): void;
}) {
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: asset.name, license: asset.license?.name || tr('ui.workspace.uploadedByAccount'), credit: asset.credit || '', tags: (asset.tags || []).join(', '), commercial: asset.license?.commercial !== false, attribution: (asset.license?.attribution as 'required' | 'optional' | 'none') || 'none' });
  const panel = useRef<HTMLElement>(null);
  const k = kindOf(asset);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea, select');
      if (e.key === 'Escape') { e.preventDefault(); if (editing) setEditing(false); else onClose(); }
      else if (!typing && !editing && e.key === 'ArrowRight') onStep(1);
      else if (!typing && !editing && e.key === 'ArrowLeft') onStep(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, onClose, onStep]);

  const save = async () => {
    if (!draft.name.trim() || !draft.license.trim()) return toast('error', tr('ui.workspace.nameAndLicenseRequired'));
    try {
      const tags = draft.tags.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
      const updated = await api.libraryUpdate(asset.id, { name: draft.name.trim(), tags, license: { ...(asset.license || {}), name: draft.license.trim(), commercial: draft.commercial, attribution: draft.attribution }, credit: draft.credit.trim() || null });
      onChange(updated);
      setEditing(false);
      toast('ok', tr('library.assetUpdated'));
    } catch (e) { toast('error', String(e)); }
  };
  const replace = (file?: File) => {
    if (!file) return;
    void api.libraryReplace(asset.id, file).then((updated) => { onChange(updated); toast('ok', tr('library.assetReplaced')); }).catch((e) => toast('error', String(e)));
  };

  const attribution = asset.license?.attribution === 'required' ? tr('library.requiredAttribution') : asset.license?.attribution === 'optional' ? tr('library.recommendedCredit') : tr('library.noRequiredCredit');
  return (
    <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside ref={panel} tabIndex={-1} className="asset-drawer" role="dialog" aria-modal="true" aria-label={asset.name} data-ink={KINDS[k].ink}>
        <div className="drawer-top">
          <span className="drawer-kind"><Icon name={KINDS[k].icon} size={13} />{tr(`ui.library.kind.${k}`)}</span>
          <span className="drawer-pos">{position}</span>
          <button type="button" className="btn ghost icon" aria-label={tr('ui.library.previous')} title={tr('ui.library.previous')} onClick={() => onStep(-1)}><Icon name="chevronleft" size={14} /></button>
          <button type="button" className="btn ghost icon" aria-label={tr('ui.library.next')} title={tr('ui.library.next')} onClick={() => onStep(1)}><Icon name="chevron" size={14} /></button>
          <button type="button" className="btn ghost icon" aria-label={tr('ui.library.close')} title={tr('ui.library.close')} onClick={onClose}><Icon name="close" size={14} /></button>
        </div>
        <div className="drawer-preview"><Preview asset={asset} large /></div>
        <div className="drawer-body">
          <h2 title={asset.name}>{asset.name}</h2>
          <p className="drawer-sub"><span className="ext">{extOf(asset)}</span>{formatBytes(language, asset.size)}{asset.width && asset.height ? ` · ${asset.width}×${asset.height} px` : ''}</p>
          <div className="drawer-actions">
            <a className="btn primary" href={fileUrl(asset)} download={asset.name}><Icon name="download" size={14} />{tr('library.download')}</a>
            <label className="btn"><Icon name="upload" size={14} />{tr('library.replace')}<input hidden type="file" onChange={(e) => { replace(e.target.files?.[0]); e.currentTarget.value = ''; }} /></label>
            <button type="button" className={`btn${editing ? ' active' : ''}`} onClick={() => setEditing((v) => !v)}><Icon name="pencil" size={14} />{tr('library.editMetadata')}</button>
            <button type="button" className="btn ghost danger" onClick={onRemove}><Icon name="trash" size={14} />{tr('library.remove')}</button>
          </div>

          {(duplicate || asset.license?.attribution === 'required') && <div className="drawer-notes">
            {duplicate && <p className="note warn"><Icon name="copy" size={14} />{tr('ui.library.duplicateNote')}</p>}
            {asset.license?.attribution === 'required' && <p className="note info"><Icon name="alert" size={14} />{asset.credit ? tr('ui.library.creditNote', { credit: asset.credit }) : tr('ui.library.creditMissingNote')}</p>}
          </div>}

          {editing ? (
            <div className="drawer-form">
              <label className="small">{tr('library.assetName')}<input className="field" autoFocus value={draft.name} onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))} /></label>
              <label className="small">{tr('library.assetLicense')}<input className="field" value={draft.license} onChange={(e) => setDraft((v) => ({ ...v, license: e.target.value }))} /></label>
              <div className="form-grid">
                <label className="small">{tr('library.commercial')}<select className="field" value={draft.commercial ? 'yes' : 'no'} onChange={(e) => setDraft((v) => ({ ...v, commercial: e.target.value === 'yes' }))}><option value="yes">{tr('library.yes')}</option><option value="no">{tr('library.no')}</option></select></label>
                <label className="small">{tr('library.attribution')}<select className="field" value={draft.attribution} onChange={(e) => setDraft((v) => ({ ...v, attribution: e.target.value as typeof v.attribution }))}><option value="none">{tr('library.noRequiredCredit')}</option><option value="optional">{tr('library.recommendedCredit')}</option><option value="required">{tr('library.requiredAttribution')}</option></select></label>
              </div>
              <label className="small">{tr('ui.library.credit')}<input className="field" placeholder={tr('library.creditOptional')} value={draft.credit} onChange={(e) => setDraft((v) => ({ ...v, credit: e.target.value }))} /></label>
              <label className="small">{tr('ui.library.tags')}<input className="field" placeholder={tr('library.tagsHint')} value={draft.tags} onChange={(e) => setDraft((v) => ({ ...v, tags: e.target.value }))} /></label>
              <div className="card-actions"><button type="button" className="btn ghost" onClick={() => setEditing(false)}>{tr('library.cancel')}</button><button type="button" className="btn primary" onClick={() => void save()}>{tr('library.save')}</button></div>
            </div>
          ) : (
            <>
              <section className="drawer-block">
                <h3>{tr('ui.library.usage')}</h3>
                {usage?.projects?.length ? <ul className="usage-list">{usage.projects.map((p) => <li key={p.file}><Icon name="frame" size={13} /><span>{p.name || p.file}</span></li>)}</ul>
                  : <p className="faint">{tr('ui.library.notUsed')}</p>}
              </section>
              <section className="drawer-block">
                <h3>{tr('ui.library.details')}</h3>
                <dl className="detail-list">
                  <dt>{tr('ui.library.source')}</dt><dd>{asset.sourceUrl ? <a href={asset.sourceUrl} target="_blank" rel="noreferrer">{asset.source || tr('ui.workspace.external')} <Icon name="external" size={11} /></a> : (asset.source || tr('ui.workspace.upload'))}</dd>
                  <dt>{tr('ui.library.license')}</dt><dd>{asset.license?.url ? <a href={asset.license.url} target="_blank" rel="noreferrer">{asset.license.name} <Icon name="external" size={11} /></a> : (asset.license?.name || tr('library.accountLicense'))}</dd>
                  <dt>{tr('library.commercial')}</dt><dd>{asset.license?.commercial === false ? tr('library.no') : tr('library.yes')}</dd>
                  <dt>{tr('library.attribution')}</dt><dd>{attribution}</dd>
                  <dt>{tr('ui.library.credit')}</dt><dd>{asset.credit || '—'}</dd>
                  <dt>{tr('ui.library.added')}</dt><dd>{asset.addedAt || asset.createdAt ? formatDate(language, (asset.addedAt || asset.createdAt)!, { dateStyle: 'medium' }) : '—'}</dd>
                  {asset.capturedAt && <><dt>{tr('library.capture')}</dt><dd>{formatDate(language, asset.capturedAt, { dateStyle: 'medium' })}</dd></>}
                  <dt>{tr('ui.library.tags')}</dt><dd>{asset.tags?.length ? <span className="tag-list">{asset.tags.map((x) => <span key={x} className="chip-tag">{x}</span>)}</span> : <span className="faint">{tr('ui.library.noTags')}</span>}</dd>
                </dl>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
