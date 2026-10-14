// Aparência pessoal: tema e cor de destaque. É uma preferência desta pessoa neste navegador; nunca vai para o projeto nem para a exportação.
import { ACCENTS, persistAccountPreferences, setAccent, setDensity, setLanguage, setTheme, useApp, type Density, type Language } from '../lib/app';
import { Icon } from './Icon';
import { Popover } from './Popover';
import { SUPPORTED_LANGUAGES } from '../lib/i18n';

export function AppearanceMenu() {
  const theme = useApp((s) => s.theme);
  const accent = useApp((s) => s.accent);
  const language = useApp((s) => s.language);
  const density = useApp((s) => s.density);
  const en = language === 'en-US';
  return (
    <Popover label={language === 'en-US' ? 'Appearance' : 'Aparência'} trigger={<Icon name={theme === 'dark' ? 'moon' : 'sun'} size={17} />}>
      <div className="menu-pad">
        <h4>{en ? 'Theme' : 'Tema'}</h4>
        <div className="segmented wide">
          {([['light', en ? 'Light' : 'Claro'], ['dark', en ? 'Dark' : 'Escuro'], [ 'system', en ? 'System' : 'Sistema']] as const).map(([v, l]) => (
            <button key={v} className={theme === v ? 'on' : ''} onClick={() => setTheme(v)}>{l}</button>
          ))}
        </div>
        <h4>{en ? 'Accent color' : 'Cor de destaque'}</h4>
        <div className="swatches">
          {ACCENTS.map((c) => (
            <button key={c} className={`swatch${accent.toLowerCase() === c ? ' on' : ''}`} style={{ background: c }} aria-label={`${en ? 'Accent' : 'Destaque'} ${c}`} aria-pressed={accent.toLowerCase() === c} onClick={() => setAccent(c)}>
              {accent.toLowerCase() === c && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
        <h4>{en ? 'Density' : 'Densidade'}</h4>
        <div className="segmented wide density-choice">
          {([['comfortable', en ? 'Comfortable' : 'Confortável'], ['compact', en ? 'Compact' : 'Compacta']] as const).map(([v, l]) => <button key={v} className={density === v ? 'on' : ''} onClick={() => setDensity(v as Density)}>{l}</button>)}
        </div>
        <p className="faint small">{en ? 'Only your workspace appearance changes. Projects and exports stay untouched.' : 'Só muda a aparência deste painel, para você. Os projetos e os arquivos exportados não mudam.'}</p>
        <label className="small">{language === 'en-US' ? 'Language' : 'Idioma'}
          <select className="field" value={language} onChange={(e) => { const next = e.target.value as Language; setLanguage(next); persistAccountPreferences({ language: next }); }}>
            {SUPPORTED_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>
    </Popover>
  );
}
