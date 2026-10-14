// Aparência pessoal: tema e cor de destaque. É uma preferência desta pessoa neste navegador; nunca vai para o projeto nem para a exportação.
import { ACCENTS, persistAccountPreferences, setAccent, setDensity, setLanguage, setMotion, setTheme, useApp, type Density, type Language, type Motion } from '../lib/app';
import { Icon } from './Icon';
import { Popover } from './Popover';
import { SUPPORTED_LANGUAGES, t } from '../lib/i18n';

export function AppearanceMenu() {
  const theme = useApp((s) => s.theme);
  const accent = useApp((s) => s.accent);
  const language = useApp((s) => s.language);
  const density = useApp((s) => s.density);
  const motion = useApp((s) => s.motion);
  return (
    <Popover label={t(language, 'inspector.appearance.title')} trigger={<Icon name={theme === 'dark' ? 'moon' : 'sun'} size={17} />}>
      <div className="menu-pad">
        <h4>{t(language, 'ui.appearance.theme')}</h4>
        <div className="segmented wide theme-choices">
          {([['light', t(language, 'ui.appearance.light')], ['dark', t(language, 'ui.appearance.dark')], [ 'system', t(language, 'admin.system')]] as const).map(([v, l]) => (
            <button key={v} className={`theme-choice${theme === v ? ' on' : ''}`} aria-pressed={theme === v} onClick={() => setTheme(v)}><span className={`theme-swatch ts-${v}`} aria-hidden="true" />{l}</button>
          ))}
        </div>
        <h4>{t(language, 'ui.appearance.accentColor')}</h4>
        <div className="swatches">
          {ACCENTS.map((c) => (
            <button key={c} className={`swatch${accent.toLowerCase() === c ? ' on' : ''}`} style={{ background: c }} aria-label={`${t(language, 'ui.appearance.accent')} ${c}`} aria-pressed={accent.toLowerCase() === c} onClick={() => setAccent(c)}>
              {accent.toLowerCase() === c && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
        <h4>{t(language, 'ui.appearance.density')}</h4>
        <div className="segmented wide density-choice">
          {([['comfortable', t(language, 'settings.comfortable')], ['compact', t(language, 'settings.compact')]] as const).map(([v, l]) => <button key={v} className={density === v ? 'on' : ''} onClick={() => setDensity(v as Density)}>{l}</button>)}
        </div>
        <h4>{t(language, 'ui.appearance.motion')}</h4>
        <div className="segmented wide">
          {([['full', t(language, 'ui.appearance.motionFull')], ['reduced', t(language, 'ui.appearance.motionReduced')]] as const).map(([v, l]) => <button key={v} className={motion === v ? 'on' : ''} aria-pressed={motion === v} onClick={() => setMotion(v as Motion)}>{l}</button>)}
        </div>
        <p className="faint small">{t(language, 'ui.appearance.onlyYourWorkspaceAppearanceChanges')}</p>
        <label className="small">{t(language, 'settings.language')}
          <select className="field" value={language} onChange={(e) => { const next = e.target.value as Language; setLanguage(next); persistAccountPreferences({ language: next }); }}>
            {SUPPORTED_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>
    </Popover>
  );
}
