// O editor: barra superior, páginas/camadas (e recursos) à esquerda, canvas ao centro, propriedades (ou outros painéis) à direita.
import { useCallback, useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { readPref, setPanel, useApp, writePref, type Panel } from '../lib/app';
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
import { t } from '../lib/i18n';

const MAIN_TABS: { id: Panel; label: string }[] = [
  { id: 'design', label: 'Design' },
  { id: 'prototype', label: 'Protótipo' },
  { id: 'code', label: 'Código' },
  { id: 'comments', label: 'Comentários' },
  { id: 'inspect', label: 'Inspecionar' },
  { id: 'issues', label: 'Problemas' },
  { id: 'agents', label: 'Agentes' },
  { id: 'versions', label: 'Histórico' },
  { id: 'export', label: 'Exportar' },
];

export function Editor() {
  useShortcuts();
  const doc = useApp((s) => s.doc);
  const panel = useApp((s) => s.panel);
  const issues = useApp((s) => s.issues);
  const presenting = useApp((s) => s.presenting);
  const hidden = useApp((s) => s.panelsHidden);
  const comments = useApp((s) => (s.doc?.comments as { resolved?: boolean }[] | undefined)?.filter((c) => !c.resolved).length ?? 0);
  const language = useApp((s) => s.language);
  const [leftWidth, setLeftWidth] = useState(() => readPref('stylo.leftWidth', 252));
  const [rightWidth, setRightWidth] = useState(() => readPref('stylo.rightWidth', 300));
  const [leftCollapsed, setLeftCollapsed] = useState(() => readPref('stylo.leftCollapsed', typeof window !== 'undefined' && window.innerWidth < 900));
  const [rightCollapsed, setRightCollapsed] = useState(() => readPref('stylo.rightCollapsed', typeof window !== 'undefined' && window.innerWidth < 900));
  const setLeft = (value: number | ((old: number) => number)) => setLeftWidth((old) => { const next = typeof value === 'function' ? value(old) : value; writePref('stylo.leftWidth', next); return next; });
  const setRight = (value: number | ((old: number) => number)) => setRightWidth((old) => { const next = typeof value === 'function' ? value(old) : value; writePref('stylo.rightWidth', next); return next; });
  const collapseLeft = (value: boolean | ((old: boolean) => boolean)) => setLeftCollapsed((old) => { const next = typeof value === 'function' ? value(old) : value; writePref('stylo.leftCollapsed', next); return next; });
  const collapseRight = (value: boolean | ((old: boolean) => boolean)) => setRightCollapsed((old) => { const next = typeof value === 'function' ? value(old) : value; writePref('stylo.rightCollapsed', next); return next; });
  const resize = useCallback((side: 'left' | 'right') => {
    const move = (e: PointerEvent) => side === 'left'
      ? setLeft(Math.max(180, Math.min(460, e.clientX)))
      : setRight(Math.max(240, Math.min(520, window.innerWidth - e.clientX)));
    const done = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', done); document.body.style.removeProperty('cursor'); };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', done, { once: true });
  }, []);
  const resizeByKeyboard = (side: 'left' | 'right', key: string) => {
    const min = side === 'left' ? 180 : 240;
    const max = side === 'left' ? 460 : 520;
    const current = side === 'left' ? leftWidth : rightWidth;
    const delta = side === 'left' ? (key === 'ArrowRight' ? 16 : -16) : (key === 'ArrowLeft' ? 16 : -16);
    const next = key === 'Home' ? min : key === 'End' ? max : Math.max(min, Math.min(max, current + delta));
    if (side === 'left') setLeft(next); else setRight(next);
  };
  const resizerKeyDown = (side: 'left' | 'right', event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    resizeByKeyboard(side, event.key);
  };
  useEffect(() => { const onKey = () => { const closed = leftCollapsed || rightCollapsed; collapseLeft(!closed); collapseRight(!closed); }; window.addEventListener('stylo:panels', onKey); return () => window.removeEventListener('stylo:panels', onKey); }, [leftCollapsed, rightCollapsed]);
  if (!doc) return <div className="center-note"><span className="spinner" /> Abrindo o projeto…</div>;
  if (presenting) return <Presentation />;

  const tabs = MAIN_TABS.map((tab) => ({ ...tab, label: t(language, `tabs.${tab.id}`) }));

  return (
    <div className={`editor${hidden ? ' panels-hidden' : ''}`} style={{ ['--left-w' as string]: leftCollapsed ? '24px' : `${leftWidth}px`, ['--right-w' as string]: rightCollapsed ? '24px' : `${rightWidth}px` }}>
      <TopBar />
      {!hidden && !leftCollapsed && <LeftPanel />}
      <main className="stage">
        <Canvas />
        <Toolbar />
        {!hidden && <button className="panel-toggle left-toggle" aria-label={leftCollapsed ? t(language, 'editor.leftOpen') : t(language, 'editor.leftClose')} title={leftCollapsed ? t(language, 'editor.leftOpen') : t(language, 'editor.leftClose')} onClick={() => collapseLeft((v) => !v)}>‹</button>}
        {!hidden && <button className="panel-toggle right-toggle" aria-label={rightCollapsed ? t(language, 'editor.rightOpen') : t(language, 'editor.rightClose')} title={rightCollapsed ? t(language, 'editor.rightOpen') : t(language, 'editor.rightClose')} onClick={() => collapseRight((v) => !v)}>›</button>}
      </main>
      {!hidden && !rightCollapsed && (
        <aside className="right-panel" aria-label={t(language, 'editor.sidePanel')}>
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
      {!hidden && !leftCollapsed && <div className="panel-resizer left-resizer" role="separator" tabIndex={0} aria-orientation="vertical" aria-valuemin={180} aria-valuemax={460} aria-valuenow={leftWidth} aria-label="Redimensionar painel esquerdo" onPointerDown={() => resize('left')} onKeyDown={(event) => resizerKeyDown('left', event)} />}
      {!hidden && !rightCollapsed && <div className="panel-resizer right-resizer" role="separator" tabIndex={0} aria-orientation="vertical" aria-valuemin={240} aria-valuemax={520} aria-valuenow={rightWidth} aria-label="Redimensionar painel direito" onPointerDown={() => resize('right')} onKeyDown={(event) => resizerKeyDown('right', event)} />}
      <HelpDialog />
      <SettingsDialog />
    </div>
  );
}
