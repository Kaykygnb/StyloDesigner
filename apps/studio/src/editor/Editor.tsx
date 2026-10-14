// O editor: barra superior, páginas/camadas (e recursos) à esquerda, canvas ao centro, propriedades (ou outros painéis) à direita.
import { useCallback, useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { app, closeProject, readPref, runChecks, setPanel, setTool, useApp, writePref, type Panel, type Tool } from '../lib/app';
import { redo, undo } from '../lib/actions';
import { showMenu } from '../ui/ContextMenu';
import { useCommands } from '../ui/CommandPalette';
import { Icon } from '../ui/Icon';
import { Canvas } from './Canvas';
import { Toolbar } from './Toolbar';
import { Inspector } from './Inspector';
import { LeftFlyout, LeftRail } from './LeftPanel';
import { AgentsPanel, ExportPanel, IssuesPanel } from './Panels';
import { CodePanel } from './CodePanel';
import { CommentsPanel } from './CommentsPanel';
import { InspectPanel } from './InspectPanel';
import { PrototypePanel } from './PrototypePanel';
import { HelpDialog, SettingsDialog } from './Dialogs';
import { Presentation } from './Presentation';
import { VersionsPanel } from './VersionsPanel';
import { ProjectDialog } from './ProjectDialog';
import { useShortcuts } from './shortcuts';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { t } from '../lib/i18n';

// O painel direito mostra sempre as quatro abas do dia a dia; as outras ficam em "Mais painéis" e,
// quando abertas, aparecem como uma quinta aba até a pessoa voltar para uma das principais.
const MAIN_TABS: Panel[] = ['design', 'prototype', 'code', 'comments'];
const MORE_TABS: { id: Panel; icon: string }[] = [
  { id: 'export', icon: 'download' }, { id: 'inspect', icon: 'inspect' }, { id: 'issues', icon: 'alert' },
  { id: 'agents', icon: 'users' }, { id: 'versions', icon: 'history' },
];
const TOOL_LIST: { tool: Tool; icon: string; key?: string }[] = [
  { tool: 'move', icon: 'cursor', key: 'V' }, { tool: 'hand', icon: 'hand', key: 'H' }, { tool: 'frame', icon: 'frame', key: 'F' }, { tool: 'section', icon: 'section' },
  { tool: 'rect', icon: 'rect', key: 'R' }, { tool: 'ellipse', icon: 'ellipse', key: 'E' }, { tool: 'line', icon: 'line', key: 'L' }, { tool: 'polygon', icon: 'polygon' }, { tool: 'star', icon: 'star' },
  { tool: 'text', icon: 'text', key: 'T' }, { tool: 'pen', icon: 'pen', key: 'P' }, { tool: 'pencil', icon: 'pencil' }, { tool: 'comment', icon: 'comment', key: 'C' }, { tool: 'inspect', icon: 'inspect', key: 'I' },
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
  const openPanel = (id: Panel) => { setPanel(id); collapseRight(false); if (id === 'issues' && !app.get().issues) void runChecks(); };
  useCommands('editor', () => {
    const actions = t(language, 'ui.command.groupActions');
    const panels = t(language, 'ui.command.groupPanels');
    const tools = t(language, 'ui.command.groupTools');
    return [
      { id: 'ed:undo', group: actions, icon: 'undo', label: t(language, 'top.undo'), run: () => void undo() },
      { id: 'ed:redo', group: actions, icon: 'redo', label: t(language, 'top.redo'), run: () => void redo() },
      { id: 'ed:present', group: actions, icon: 'play', label: t(language, 'top.present'), run: () => app.set({ presenting: true }) },
      { id: 'ed:fit', group: actions, icon: 'fit', label: t(language, 'ui.canvas.fitAll'), run: () => window.dispatchEvent(new Event('stylo:fit')) },
      { id: 'ed:panels', group: actions, icon: 'layers', label: hidden || leftCollapsed ? t(language, 'editor.leftOpen') : t(language, 'editor.leftClose'), hint: 'Ctrl \\', run: () => window.dispatchEvent(new Event('stylo:panels')) },
      { id: 'ed:home', group: actions, icon: 'home', label: t(language, 'top.projects'), run: closeProject },
      ...[...MAIN_TABS, ...MORE_TABS.map((m) => m.id)].map((id) => ({ id: `ed:panel:${id}`, group: panels, icon: MORE_TABS.find((m) => m.id === id)?.icon ?? 'rows', label: t(language, `tabs.${id}`), run: () => openPanel(id) })),
      ...TOOL_LIST.map((x) => ({ id: `ed:tool:${x.tool}`, group: tools, icon: x.icon, label: t(language, `tool.${x.tool}`), hint: x.key, run: () => setTool(x.tool) })),
    ];
  });
  if (!doc) return <div className="center-note"><span className="spinner" /> {t(language, 'ui.editor.openingProject')}</div>;
  if (presenting) return <Presentation />;

  const extra = MORE_TABS.find((m) => m.id === panel);
  const tabs = [...MAIN_TABS, ...(extra ? [extra.id] : [])].map((id) => ({ id, label: t(language, `tabs.${id}`) }));
  const moreMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    showMenu(MORE_TABS.map((m) => ({ label: t(language, `tabs.${m.id}`), icon: m.icon, checked: panel === m.id, hint: m.id === 'issues' && issues?.length ? String(issues.length) : undefined, onClick: () => openPanel(m.id) })), r.right - 220, r.bottom + 6);
  };

  return (
    <div className={`editor${hidden ? ' panels-hidden' : ''}${leftCollapsed ? ' left-closed' : ''}${rightCollapsed ? ' right-closed' : ''}`} style={{ ['--left-w' as string]: `${leftWidth}px`, ['--left-col' as string]: leftCollapsed ? '0px' : `${leftWidth}px`, ['--right-w' as string]: rightCollapsed ? '0px' : `${rightWidth}px` }}>
      <TopBar />
      {!hidden && <LeftRail collapsed={leftCollapsed} onToggleCollapse={() => collapseLeft((v) => !v)} />}
      {!hidden && !leftCollapsed && <LeftFlyout />}
      <main className="stage">
        <Canvas />
        <Toolbar />
        {!hidden && <button className="panel-toggle right-toggle" aria-label={rightCollapsed ? t(language, 'editor.rightOpen') : t(language, 'editor.rightClose')} title={rightCollapsed ? t(language, 'editor.rightOpen') : t(language, 'editor.rightClose')} onClick={() => collapseRight((v) => !v)}>›</button>}
      </main>
      {!hidden && !rightCollapsed && (
        <aside className="right-panel" aria-label={t(language, 'editor.sidePanel')}>
          <div className="tabs-row">
            <div className="tabs" role="tablist">
              {tabs.map((tab) => (
                <button key={tab.id} role="tab" aria-selected={panel === tab.id} className={`${panel === tab.id ? 'on' : ''}${extra?.id === tab.id ? ' extra-tab' : ''}`} onClick={() => setPanel(tab.id)}>
                  {extra?.id === tab.id && <Icon name={extra.icon} size={13} />}
                  {tab.label}
                  {tab.id === 'comments' && comments > 0 ? <span className="badge">{comments}</span> : null}
                  {tab.id === 'issues' && issues?.length ? <span className="badge">{issues.length}</span> : null}
                </button>
              ))}
            </div>
            <button className="tabs-more" aria-haspopup="menu" aria-label={t(language, 'ui.editor.morePanels')} title={t(language, 'ui.editor.morePanels')} onClick={moreMenu}><Icon name="more" size={15} /></button>
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
      {!hidden && !leftCollapsed && <div className="panel-resizer left-resizer" role="separator" tabIndex={0} aria-orientation="vertical" aria-valuemin={180} aria-valuemax={460} aria-valuenow={leftWidth} aria-label={t(language, 'ui.editor.resizeLeftPanel')} onPointerDown={() => resize('left')} onKeyDown={(event) => resizerKeyDown('left', event)} />}
      {!hidden && !rightCollapsed && <div className="panel-resizer right-resizer" role="separator" tabIndex={0} aria-orientation="vertical" aria-valuemin={240} aria-valuemax={520} aria-valuenow={rightWidth} aria-label={t(language, 'ui.editor.resizeRightPanel')} onPointerDown={() => resize('right')} onKeyDown={(event) => resizerKeyDown('right', event)} />}
      <StatusBar />
      <ProjectDialog />
      <HelpDialog />
      <SettingsDialog />
    </div>
  );
}
