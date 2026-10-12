// Aba Ícones: Material Symbols do Google (mais de 4 mil), busca em português ou inglês; clicar insere como vetor editável (insert_icon).
import { useEffect, useMemo, useState } from 'react';
import { iconUrl, lucideIconUrl, searchIcons } from '@stylo/core/icons.ts';
import { canEdit } from '../lib/actions';
import { assetSearch } from '../lib/api';
import { app, run, select, toast, useApp } from '../lib/app';
import { t } from '../lib/i18n';
import { findNode, pageOf } from '../lib/doc';
import { ColorRow } from '../ui/ColorPicker';
import { Icon } from '../ui/Icon';

const PAGE = 120;
type Style = 'outlined' | 'rounded' | 'sharp';
type Collection = 'Material Symbols' | 'Lucide';

export function IconsTab() {
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const [query, setQuery] = useState('');
  const [collection, setCollection] = useState<Collection>('Material Symbols');
  const [style, setStyle] = useState<Style>('outlined');
  const [filled, setFilled] = useState(false);
  const [color, setColor] = useState('#111111');
  const [size, setSize] = useState(48);
  const [shown, setShown] = useState(PAGE);
  const editable = canEdit();
  const matches: string[] = useMemo(() => searchIcons(query), [query]);
  const [lucideMatches, setLucideMatches] = useState<Array<{ title: string; preview_url?: string; license: { name: string; url?: string }; credit: string }>>([]);
  const [loadingLucide, setLoadingLucide] = useState(false);
  useEffect(() => {
    if (collection !== 'Lucide') return;
    let live = true;
    setLoadingLucide(true);
    void assetSearch('icon', query, 'lucide-icons').then((result) => { if (live) setLucideMatches(result.results); }).catch((error) => { if (live) { setLucideMatches([]); toast('error', String(error)); } }).finally(() => { if (live) setLoadingLucide(false); });
    return () => { live = false; };
  }, [collection, query]);

  const insert = async (name: string) => {
    if (!editable) return;
    const s = app.get();
    const page = s.doc ? pageOf(s.doc, s.pageId) : null;
    const sel = page && s.selection.length === 1 ? findNode(page.children, s.selection[0]) : null;
    const parent = sel && (sel.type === 'frame' || sel.type === 'group') ? sel : null;
    const out = await run<{ created?: { id: string } }>('insert_icon', { name, color, size, style, filled, collection, ...(parent ? { parent_id: parent.id } : {}) });
    if (out?.created?.id) select([out.created.id]);
    else toast('error', tr('icons.insertError'));
  };

  const copySvg = async (name: string) => {
    try {
      const response = await fetch(collection === 'Lucide' ? lucideIconUrl(name) : iconUrl(name, style, filled));
      if (!response.ok) throw new Error('download');
      await navigator.clipboard.writeText(await response.text());
      toast('ok', tr('icons.copySuccess', { collection, license: collection === 'Lucide' ? tr('icons.lucideLicense') : tr('icons.materialLicense') }));
    } catch { toast('error', tr('icons.copyError')); }
  };

  return (
    <div className="tab-body icons-tab">
      <div className="panel-pad">
        <div className="search"><Icon name="search" size={14} /><input className="field" type="search" placeholder={tr('icons.searchPlaceholder')} aria-label={tr('icons.searchLabel')} value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} onKeyDown={(e) => e.stopPropagation()} /></div>
        <div className="frow">
          <select className="field" aria-label={tr('icons.collection')} value={collection} onChange={(e) => { setCollection(e.target.value as Collection); setShown(PAGE); }}><option>Material Symbols</option><option>Lucide</option></select>
          <select className="field" aria-label={tr('icons.style')} value={style} onChange={(e) => setStyle(e.target.value as Style)}><option value="outlined">{tr('icons.outlined')}</option><option value="rounded">{tr('icons.rounded')}</option><option value="sharp">{tr('icons.sharp')}</option></select>
          <select className="field" aria-label={tr('icons.size')} value={size} onChange={(e) => setSize(Number(e.target.value))}>{[16, 20, 24, 32, 48, 64, 96].map((n) => <option key={n} value={n}>{n}px</option>)}</select>
        </div>
        <label className="check"><input type="checkbox" checked={filled} onChange={(e) => setFilled(e.target.checked)} /><span>{tr('icons.filled')}</span></label>
        <ColorRow color={color} hideOpacity onChange={(hex) => setColor(hex)} />
        <p className="hint">{collection === 'Lucide' ? tr('icons.countLucide', { count: lucideMatches.length.toLocaleString(language) }) : tr('icons.countMaterial', { count: matches.length.toLocaleString(language) })} <a className="inline-link" href={collection === 'Lucide' ? 'https://lucide.dev/icons/' : 'https://fonts.google.com/icons'} target="_blank" rel="noreferrer">{tr('icons.source')}</a> · {tr('icons.offlineHint')}</p>
      </div>
      <div className="icon-grid">
        {collection === 'Lucide' ? lucideMatches.slice(0, shown).map((item) => {
          const name = item.title;
          return <div key={name} className="icon-cell-wrap" title={`${name} · Lucide · ${item.license.name}`}>
            <button type="button" className="icon-cell" aria-label={tr('icons.insert', { name })} disabled={!editable || loadingLucide} onClick={() => void insert(name)}><img src={item.preview_url} alt="" loading="lazy" className="icon-img" /><span className="icon-name">{name.replace(/_/g, ' ')}</span></button>
            <button type="button" className="icon-copy" aria-label={tr('icons.copy', { name })} onClick={() => void copySvg(name)}>SVG</button>
          </div>;
        }) : matches.slice(0, shown).map((name) => (
          <div key={name} className="icon-cell-wrap" title={`${name.replace(/_/g, ' ')} · Material Symbols · Apache 2.0`}>
            <button type="button" className="icon-cell" aria-label={tr('icons.insert', { name })} disabled={!editable} onClick={() => void insert(name)}>
              <img src={iconUrl(name, style, filled)} alt="" loading="lazy" className="icon-img" /><span className="icon-name">{name.replace(/_/g, ' ')}</span>
            </button>
            <button type="button" className="icon-copy" aria-label={tr('icons.copy', { name })} onClick={() => void copySvg(name)}>SVG</button>
          </div>
        ))}
      </div>
      {((collection === 'Lucide' ? lucideMatches.length : matches.length) > shown) && <div className="panel-pad"><button className="btn block" onClick={() => setShown(shown + PAGE)}>{tr('icons.more')}</button></div>}
      {((collection === 'Lucide' && !lucideMatches.length) || (collection === 'Material Symbols' && !matches.length)) && <p className="muted pad">{tr('icons.none')}</p>}
    </div>
  );
}
