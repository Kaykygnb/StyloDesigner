// Aba Ícones: Material Symbols do Google (mais de 4 mil), busca em português ou inglês; clicar insere como vetor editável (insert_icon).
import { useMemo, useState } from 'react';
import { iconUrl, searchIcons } from '@stylo/core/icons.ts';
import { canEdit } from '../lib/actions';
import { app, run, select, toast } from '../lib/app';
import { findNode, pageOf } from '../lib/doc';
import { ColorRow } from '../ui/ColorPicker';
import { Icon } from '../ui/Icon';

const PAGE = 120;
type Style = 'outlined' | 'rounded' | 'sharp';

export function IconsTab() {
  const [query, setQuery] = useState('');
  const [style, setStyle] = useState<Style>('outlined');
  const [filled, setFilled] = useState(false);
  const [color, setColor] = useState('#111111');
  const [size, setSize] = useState(48);
  const [shown, setShown] = useState(PAGE);
  const editable = canEdit();
  const matches: string[] = useMemo(() => searchIcons(query), [query]);

  const insert = async (name: string) => {
    if (!editable) return;
    const s = app.get();
    const page = s.doc ? pageOf(s.doc, s.pageId) : null;
    const sel = page && s.selection.length === 1 ? findNode(page.children, s.selection[0]) : null;
    const parent = sel && (sel.type === 'frame' || sel.type === 'group') ? sel : null;
    const out = await run<{ created?: { id: string } }>('insert_icon', { name, color, size, style, filled, ...(parent ? { parent_id: parent.id } : {}) });
    if (out?.created?.id) select([out.created.id]);
    else toast('error', 'Não consegui inserir o ícone (ele é baixado do Google: confira a internet).');
  };

  return (
    <div className="tab-body icons-tab">
      <div className="panel-pad">
        <div className="search"><Icon name="search" size={14} /><input className="field" type="search" placeholder="Buscar ícone (casa, seta, sino…)" aria-label="Buscar ícone" value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} onKeyDown={(e) => e.stopPropagation()} /></div>
        <div className="frow">
          <select className="field" aria-label="Estilo" value={style} onChange={(e) => setStyle(e.target.value as Style)}><option value="outlined">Contorno</option><option value="rounded">Arredondado</option><option value="sharp">Reto</option></select>
          <select className="field" aria-label="Tamanho" value={size} onChange={(e) => setSize(Number(e.target.value))}>{[16, 20, 24, 32, 48, 64, 96].map((n) => <option key={n} value={n}>{n}px</option>)}</select>
        </div>
        <label className="check"><input type="checkbox" checked={filled} onChange={(e) => setFilled(e.target.checked)} /><span>Preenchido</span></label>
        <ColorRow color={color} hideOpacity onChange={(hex) => setColor(hex)} />
        <p className="hint">{matches.length.toLocaleString('pt-BR')} ícones · Material Symbols (Apache 2.0). O ícone entra como vetor editável; depois de inserido funciona sem internet.</p>
      </div>
      <div className="icon-grid">
        {matches.slice(0, shown).map((name) => (
          <button key={name} type="button" className="icon-cell" title={name.replace(/_/g, ' ')} aria-label={name} disabled={!editable} onClick={() => void insert(name)}>
            <img src={iconUrl(name, style, filled)} alt="" loading="lazy" className="icon-img" />
          </button>
        ))}
      </div>
      {matches.length > shown && <div className="panel-pad"><button className="btn block" onClick={() => setShown(shown + PAGE)}>Mostrar mais</button></div>}
      {!matches.length && <p className="muted pad">Nenhum ícone com esse nome.</p>}
    </div>
  );
}
