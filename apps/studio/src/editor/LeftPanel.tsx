// Painel da esquerda: Camadas (páginas e árvore), Recursos (fotos, componentes, estilos) e Ícones.
import { app, useApp, type LeftTab } from '../lib/app';
import { t } from '../lib/i18n';
import { AssetsTab } from './AssetsTab';
import { IconsTab } from './IconsTab';
import { LayersTab } from './LayersPanel';

const TABS: { id: LeftTab; key: string }[] = [{ id: 'layers', key: 'left.layers' }, { id: 'assets', key: 'left.assets' }, { id: 'icons', key: 'left.icons' }];

export function LeftPanel() {
  const tab = useApp((s) => s.leftTab);
  const language = useApp((s) => s.language);
  return (
    <aside className="left-panel" aria-label={t(language, 'left.aria')}>
      <div className="tabs" role="tablist">
        {TABS.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'on' : ''} onClick={() => app.set({ leftTab: item.id })}>{t(language, item.key)}</button>)}
      </div>
      <div className="left-body">
        {tab === 'layers' && <LayersTab />}
        {tab === 'assets' && <AssetsTab />}
        {tab === 'icons' && <IconsTab />}
      </div>
    </aside>
  );
}
