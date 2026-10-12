// O editor: barra superior, páginas/camadas (e recursos) à esquerda, canvas ao centro, propriedades (ou outros painéis) à direita.
import { useCallback, useEffect, useState } from 'react';
import { setPanel, useApp, type Panel } from '../lib/app';
import { Canvas } from './Canvas';
import { Toolbar } from './Toolbar';
import { Inspector } from './Inspector';
import { LeftPanel } from './LeftPanel';
import { AgentsPanel, ExportPanel, IssuesPanel } from './Panels';
import { CodePanel } from './CodePanel';
import { CommentsPanel } from './CommentsPanel';
import { InspectPanel } from './InspectPanel';
import { PrototypePanel } from './PrototypePanel';
import { HelpDialog, SettingsDialog } from './Dialogs';
import { Presentation } from './Presentation';
import { VersionsPanel } from './VersionsPanel';
import { useShortcuts } from './shortcuts';
import { TopBar } from './TopBar';

const MAIN_TABS: { id: Panel; label: string }[] = [
  { id: 'design', label: 'Design' },
  { id: 'prototype', label: 'Protótipo' },
  { id: 'code', label: 'Código' },
  { id: 'comments', label: 'Comentários' },
  { id: 'inspect', label: 'Inspecionar' },
];
const EXTRA: Record<string, string> = { issues: 'Problemas', agents: 'Agentes', versions: 'Histórico', export: 'Exportar' };

export function Editor() {
  useShortcuts();
  const doc = useApp((s) => s.doc);
  const panel = useApp((s) => s.panel);
  const issues = useApp((s) => s.issues);
  const hidden = useApp((s) => s.panelsHidden);
  const comments = useApp((s) => (s.doc?.comments as { resolved?: boolean }[] | undefined)?.filter((c) => !c.resolved).length ?? 0);
  const [leftWidth, setLeftWidth] = useState(252);
  const [rightWidth, setRightWidth] = useState(300);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const resize = useCallback((side: 'left' | 'right') => {
    const move = (e: PointerEvent) => side === 'left'
      ? setLeftWidth(Math.max(180, Math.min(460, e.clientX)))
      : setRightWidth(Math.max(240, Math.min(520, window.innerWidth - e.clientX)));
    const done = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', done); document.body.style.removeProperty('cursor'); };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', done, { once: true });
  }, []);
  useEffect(() => { const onKey = () => { const closed = leftCollapsed || rightCollapsed; setLeftCollapsed(!closed); setRightCollapsed(!closed); }; window.addEventListener('stylo:panels', onKey); return () => window.removeEventListener('stylo:panels', onKey); }, [leftCollapsed, rightCollapsed]);
  if (!doc) return <div className="center-note"><span className="spinner" /> Abrindo o projeto…</div>;

  const tabs = [...MAIN_TABS, ...(EXTRA[panel] ? [{ id: panel, label: EXTRA[panel] }] : [])];

  return (
    <div className={`editor${hidden ? ' panels-hidden' : ''}`} style={{ ['--left-w' as string]: leftCollapsed ? '24px' : `${leftWidth}px`, ['--right-w' as string]: rightCollapsed ? '24px' : `${rightWidth}px` }}>
      <TopBar />
      {!hidden && !leftCollapsed && <LeftPanel />}
      <main className="stage">
        <Canvas />
        <Toolbar />
        {!hidden && <button className="panel-toggle left-toggle" aria-label={leftCollapsed ? 'Abrir painel esquerdo' : 'Recolher painel esquerdo'} title={leftCollapsed ? 'Abrir painel esquerdo' : 'Recolher painel esquerdo'} onClick={() => setLeftCollapsed((v) => !v)}>‹</button>}
        {!hidden && <button className="panel-toggle right-toggle" aria-label={rightCollapsed ? 'Abrir painel direito' : 'Recolher painel direito'} title={rightCollapsed ? 'Abrir painel direito' : 'Recolher painel direito'} onClick={() => setRightCollapsed((v) => !v)}>›</button>}
      </main>
      {!hidden && !rightCollapsed && (
        <aside className="right-panel" aria-label="Painel lateral">
          <div className="tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={panel === t.id} className={panel === t.id ? 'on' : ''} onClick={() => setPanel(t.id)}>
                {t.label}
                {t.id === 'comments' && comments > 0 ? <span className="badge">{comments}</span> : null}
                {t.id === 'issues' && issues?.length ? <span className="badge">{issues.length}</span> : null}
              </button>
            ))}
          </div>
          <div className="right-body">
            {panel === 'design' && <Inspector />}
            {panel === 'prototype' && <PrototypePanel />}
            {panel === 'code' && <CodePanel />}
            {panel === 'comments' && <CommentsPanel />}
            {panel === 'inspect' && <InspectPanel />}
            {panel === 'issues' && <IssuesPanel />}
            {panel === 'agents' && <AgentsPanel />}
            {panel === 'versions' && <VersionsPanel />}
            {panel === 'export' && <ExportPanel />}
          </div>
        </aside>
      )}
      {!hidden && !leftCollapsed && <div className="panel-resizer left-resizer" role="separator" aria-label="Redimensionar painel esquerdo" onPointerDown={() => resize('left')} />}
      {!hidden && !rightCollapsed && <div className="panel-resizer right-resizer" role="separator" aria-label="Redimensionar painel direito" onPointerDown={() => resize('right')} />}
      <HelpDialog />
      <SettingsDialog />
      <Presentation />
    </div>
  );
}
