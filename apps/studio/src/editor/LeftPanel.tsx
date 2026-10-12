// Painel da esquerda: Camadas (páginas e árvore), Recursos (fotos, componentes, estilos) e Ícones.
import { app, useApp, type LeftTab } from '../lib/app';
import { AssetsTab } from './AssetsTab';
import { IconsTab } from './IconsTab';
import { LayersTab } from './LayersPanel';

const TABS: { id: LeftTab; label: string }[] = [{ id: 'layers', label: 'Camadas' }, { id: 'assets', label: 'Recursos' }, { id: 'icons', label: 'Ícones' }];

export function LeftPanel() {
  const tab = useApp((s) => s.leftTab);
  return (
    <aside className="left-panel" aria-label="Camadas e recursos">
      <div className="tabs" role="tablist">
        {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => app.set({ leftTab: t.id })}>{t.label}</button>)}
      </div>
      <div className="left-body">
        {tab === 'layers' && <LayersTab />}
        {tab === 'assets' && <AssetsTab />}
        {tab === 'icons' && <IconsTab />}
      </div>
    </aside>
  );
}
