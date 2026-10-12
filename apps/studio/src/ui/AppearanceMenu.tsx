// Aparência pessoal: tema e cor de destaque. É uma preferência desta pessoa neste navegador; nunca vai para o projeto nem para a exportação.
import { ACCENTS, setAccent, setTheme, useApp } from '../lib/app';
import { Icon } from './Icon';
import { Popover } from './Popover';

export function AppearanceMenu() {
  const theme = useApp((s) => s.theme);
  const accent = useApp((s) => s.accent);
  return (
    <Popover label="Aparência" trigger={<Icon name={theme === 'dark' ? 'moon' : 'sun'} size={17} />}>
      <div className="menu-pad">
        <h4>Tema</h4>
        <div className="segmented wide">
          {([['light', 'Claro'], ['dark', 'Escuro'], ['system', 'Sistema']] as const).map(([v, l]) => (
            <button key={v} className={theme === v ? 'on' : ''} onClick={() => setTheme(v)}>{l}</button>
          ))}
        </div>
        <h4>Cor de destaque</h4>
        <div className="swatches">
          {ACCENTS.map((c) => (
            <button key={c} className={`swatch${accent.toLowerCase() === c ? ' on' : ''}`} style={{ background: c }} aria-label={`Destaque ${c}`} aria-pressed={accent.toLowerCase() === c} onClick={() => setAccent(c)}>
              {accent.toLowerCase() === c && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
        <p className="faint small">Só muda a aparência deste painel, para você. Os projetos e os arquivos exportados não mudam.</p>
      </div>
    </Popover>
  );
}
