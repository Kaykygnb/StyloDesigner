// Lado esquerdo do editor em duas peças: uma rail fina de ícones (sempre visível)
// e um painel encaixado ao lado dela com a aba escolhida (empurra o canvas, nunca o cobre).
import { app, useApp, type LeftTab } from '../lib/app';
import { t } from '../lib/i18n';
import { Icon } from '../ui/Icon';
import { AssetsTab } from './AssetsTab';
import { IconsTab } from './IconsTab';
import { LayersTab } from './LayersPanel';

const TABS: { id: LeftTab; key: string; icon: string }[] = [
  { id: 'layers', key: 'left.layers', icon: 'layers' },
  { id: 'assets', key: 'left.assets', icon: 'photo' },
  { id: 'icons', key: 'left.icons', icon: 'star' },
];

// Rail fina estilo VS Code/Linear: ícones empilhados, aba ativa com fio de luz à esquerda.
export function LeftRail({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse: () => void }) {
  const tab = useApp((s) => s.leftTab);
  const language = useApp((s) => s.language);
  return (
    <nav className="rail" aria-label={t(language, 'left.aria')}>
      {TABS.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={tab === item.id && !collapsed}
          className={`rail-btn${tab === item.id && !collapsed ? ' on' : ''}`}
          title={t(language, item.key)}
          onClick={() => { if (tab === item.id && !collapsed) onToggleCollapse(); else { app.set({ leftTab: item.id }); if (collapsed) onToggleCollapse(); } }}
        >
          <Icon name={item.icon} size={17} />
        </button>
      ))}
      <span className="spacer" />
      <button className="rail-btn" title={collapsed ? t(language, 'editor.leftOpen') : t(language, 'editor.leftClose')} onClick={onToggleCollapse}>
        <Icon name="chevron" size={15} />
      </button>
    </nav>
  );
}

// Painel com o conteúdo da aba (camadas, recursos, ícones).
export function LeftFlyout() {
  const tab = useApp((s) => s.leftTab);
  const language = useApp((s) => s.language);
  return (
    <aside className="left-panel docked" aria-label={t(language, 'left.aria')}>
      <div className="panel-head flyout-head">
        <h3>{t(language, TABS.find((x) => x.id === tab)?.key ?? 'left.layers')}</h3>
      </div>
      <div className="left-body">
        {tab === 'layers' && <LayersTab />}
        {tab === 'assets' && <AssetsTab />}
        {tab === 'icons' && <IconsTab />}
      </div>
    </aside>
  );
}
