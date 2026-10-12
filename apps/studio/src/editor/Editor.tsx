// O editor: barra superior, páginas/camadas à esquerda, canvas ao centro, propriedades (ou painéis) à direita.
import { setPanel, useApp } from '../lib/app';
import { Canvas } from './Canvas';
import { InsertBar } from './InsertBar';
import { Inspector } from './Inspector';
import { LayersPanel } from './LayersPanel';
import { AgentsPanel, ExportPanel, IssuesPanel } from './Panels';
import { useShortcuts } from './shortcuts';
import { TopBar } from './TopBar';

export function Editor() {
  useShortcuts();
  const doc = useApp((s) => s.doc);
  const panel = useApp((s) => s.panel);
  const issues = useApp((s) => s.issues);
  if (!doc) return <div className="center-note"><span className="spinner" /> Abrindo o projeto…</div>;

  const tabs = [
    { id: null, label: 'Propriedades' },
    { id: 'issues' as const, label: 'Problemas', count: issues?.length },
    { id: 'agents' as const, label: 'Agentes' },
    { id: 'export' as const, label: 'Exportar' },
  ];

  return (
    <div className="editor">
      <TopBar />
      <LayersPanel />
      <main className="stage">
        <Canvas />
        <InsertBar />
      </main>
      <aside className="right-panel" aria-label="Painel lateral">
        <div className="tabs" role="tablist">
          {tabs.map((t) => (
            <button key={String(t.id)} role="tab" aria-selected={panel === t.id} className={panel === t.id ? 'on' : ''} onClick={() => (t.id === null ? setPanel(panel) : setPanel(t.id))}>
              {t.label}{t.count ? <span className="badge">{t.count}</span> : null}
            </button>
          ))}
        </div>
        <div className="right-body">
          {panel === null && <Inspector />}
          {panel === 'issues' && <IssuesPanel />}
          {panel === 'agents' && <AgentsPanel />}
          {panel === 'export' && <ExportPanel />}
        </div>
      </aside>
    </div>
  );
}
