// Agentes ("conexões criativas"): ferramentas de IA que trabalham nos projetos pelo MCP.
// No alto, o caminho em 3 passos que se marca sozinho conforme a pessoa avança.
// Cada conexão é um cartão: quem é, se está ligada, o que pode fazer (chips que ligam e desligam) e o resto num menu.
import { useEffect, useRef, useState } from 'react';
import * as api from '../../lib/api';
import { toast, useApp } from '../../lib/app';
import { Icon } from '../../ui/Icon';
import { formatDate, formatRelativeTime, t, tp } from '../../lib/i18n';

const SCOPES = ['read', 'comment', 'write', 'export'] as const;
const CLIENTS: Array<[string, string]> = [['claude-code', 'Claude Code'], ['claude-desktop', 'Claude Desktop'], ['codex', 'Codex'], ['cursor', 'Cursor'], ['windsurf', 'Windsurf'], ['opencode', 'OpenCode'], ['quine', 'Quine'], ['opencog', 'OpenCog']];
const INKS = ['c', 'm', 'y'] as const;
const inkFor = (id: string) => INKS[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % INKS.length];
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

export function AgentsArea() {
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const scopeLabel = (scope: string) => scope === 'read' ? tr('ui.workspace.view') : scope === 'comment' ? tr('tool.comment') : scope === 'write' ? tr('admin.edit') : tr('inspector.extra.exportTitle');
  const typeLabel = (type?: string) => CLIENTS.find(([id]) => id === type)?.[1] || (type && type !== 'mcp' ? type : tr('agents.generic'));
  const [agents, setAgents] = useState<api.AgentInfo[]>([]);
  const [scopes, setScopes] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('mcp');
  const [newScopes, setNewScopes] = useState<string[]>([...SCOPES]);
  const [grantId, setGrantId] = useState<string | null>(null);
  const [grantFile, setGrantFile] = useState('');
  const [activity, setActivity] = useState<Record<string, api.AgentActivity[]>>({});
  const [projects, setProjects] = useState<Record<string, Array<{ projectId: string; project: { id: string; slug: string; name: string; updatedAt: string } }>>>({});
  const [panel, setPanel] = useState<Record<string, 'projects' | 'activity' | undefined>>({});

  useEffect(() => {
    void api.agentsList()
      .then((rows) => { setAgents(rows); setScopes(Object.fromEntries(rows.map((a) => [a.id, a.scopes]))); })
      .catch((e) => toast('error', String(e)))
      .finally(() => setLoading(false));
  }, []);

  const create = async () => {
    if (!newName.trim()) return toast('error', tr('ui.workspace.nameTheAgent'));
    try {
      const a = await api.createAgent(newName.trim(), newScopes, newType);
      setAgents((x) => [...x, a.agent]);
      setScopes((x) => ({ ...x, [a.agent.id]: a.agent.scopes }));
      setNewToken(a.token);
      setNewOpen(false);
      setNewName('');
      setNewType('mcp');
    } catch (e) { toast('error', String(e)); }
  };
  const grant = async () => {
    const agent = agents.find((v) => v.id === grantId);
    const file = grantFile.trim();
    if (!agent) return;
    if (!file) return toast('error', tr('ui.workspace.enterTheProjectToAuthorize'));
    try {
      await api.grantAgentProject(agent.id, file);
      toast('ok', tr('ui.workspace.agentAuthorizedForTheProject'));
      setGrantId(null);
      setGrantFile('');
      if (panel[agent.id] === 'projects') void showProjects(agent, true);
    } catch (e) { toast('error', String(e)); }
  };
  const rotate = async (agent: api.AgentInfo) => { try { const result = await api.rotateAgent(agent.id); setNewToken(result.token); toast('ok', tr('ui.workspace.tokenRotated', { name: agent.name })); } catch (e) { toast('error', String(e)); } };
  const showActivity = async (agent: api.AgentInfo) => {
    if (panel[agent.id] === 'activity') return setPanel((x) => ({ ...x, [agent.id]: undefined }));
    try { const rows = await api.agentActivity(agent.id); setActivity((x) => ({ ...x, [agent.id]: rows })); setPanel((x) => ({ ...x, [agent.id]: 'activity' })); } catch (e) { toast('error', String(e)); }
  };
  const showProjects = async (agent: api.AgentInfo, keepOpen = false) => {
    if (!keepOpen && panel[agent.id] === 'projects') return setPanel((x) => ({ ...x, [agent.id]: undefined }));
    try { const rows = await api.agentProjects(agent.id); setProjects((x) => ({ ...x, [agent.id]: rows })); setPanel((x) => ({ ...x, [agent.id]: 'projects' })); } catch (e) { toast('error', String(e)); }
  };
  const toggleStatus = (a: api.AgentInfo) => void (a.status === 'REVOKED' ? api.approveAgent(a.id) : api.revokeAgent(a.id))
    .then(() => setAgents((x) => x.map((v) => v.id === a.id ? { ...v, status: v.status === 'REVOKED' ? 'ACTIVE' : 'REVOKED' } : v)))
    .catch((e) => toast('error', String(e)));
  const saveScopes = (a: api.AgentInfo) => void api.updateAgent(a.id, scopes[a.id] || [])
    .then(() => { setAgents((x) => x.map((v) => v.id === a.id ? { ...v, scopes: scopes[a.id] || [] } : v)); toast('ok', tr('agents.savePermissions')); })
    .catch((e) => toast('error', String(e)));

  const active = agents.filter((a) => a.status !== 'REVOKED').length;
  const paused = agents.length - active;
  // os passos do guia se marcam com o que já aconteceu de verdade
  const progress = [agents.length > 0, agents.some((a) => a.lastProject), agents.some((a) => a.lastSeenAt)];

  return (
    <section className="workspace-section agents-area">
      <header className="area-head">
        <div>
          <h1>{tr('agents.title')}</h1>
          <p className="muted">{tr('agents.subtitle')}</p>
          {agents.length > 0 && <p className="area-summary">
            <span className="live-dot-wrap"><i className="live-dot" aria-hidden="true" /><b>{tp(language, 'ui.agents.activeCount', active)}</b></span>
            {paused > 0 && <span>{tp(language, 'ui.agents.pausedCount', paused)}</span>}
          </p>}
        </div>
        <button className="btn primary lg" onClick={() => setNewOpen(true)}><Icon name="plus" size={15} />{tr('agents.new')}</button>
      </header>

      {newToken && (
        <div className="account-card token-card">
          <div className="card-head"><span className="card-icon ok"><Icon name="key" size={16} /></span><div><b>{tr('agents.tokenCreated')}</b><p className="hint">{tr('agents.tokenHint')}</p></div></div>
          <div className="codebox">
            <code>{newToken}</code>
            <div className="row"><button className="btn sm" onClick={() => void navigator.clipboard.writeText(newToken).then(() => toast('ok', tr('agents.tokenCopied')))}><Icon name="copy" size={13} />{tr('actions.copy')}</button></div>
          </div>
          <div className="card-actions"><button className="btn sm" onClick={() => setNewToken(null)}>{tr('agents.close')}</button></div>
        </div>
      )}

      {loading ? (
        <div className="workspace-loading" aria-live="polite"><span /><span /><span /></div>
      ) : (
        <>
          {agents.length > 0 && <>
            <h2 className="area-subhead">{tr('ui.agents.yourConnections')}<span>{agents.length}</span></h2>
            <ul className="resource-list agent-list">
              {agents.map((a, i) => {
                const on = a.status !== 'REVOKED';
                const current = scopes[a.id] || [];
                const dirty = [...current].sort().join() !== [...a.scopes].sort().join();
                return (
                  <li key={a.id} className={`agent-card${on ? '' : ' paused'}`} style={{ '--i': Math.min(i, 12) } as React.CSSProperties}>
                    <div className="agent-main">
                      <span className="agent-avatar" data-ink={inkFor(a.id)} aria-hidden="true">{initials(a.name)}<i className={on ? 'on' : ''} /></span>
                      <div className="agent-text">
                        <div className="agent-title"><b>{a.name}</b><span className="chip-tag">{typeLabel(a.type)}</span><span className={`status-pill ${on ? 'ok' : 'off'}`}>{on ? tr('ui.workspace.connected') : tr('ui.workspace.paused')}</span></div>
                        <span className="agent-meta">
                          <span><Icon name="clock" size={12} />{a.lastSeenAt ? tr('ui.agents.seen', { when: formatRelativeTime(language, a.lastSeenAt) }) : tr('ui.agents.neverSeen')}</span>
                          <span><Icon name="frame" size={12} />{a.lastProject?.name || a.lastProject?.slug || tr('ui.agents.noProjectYet')}</span>
                          {a.ownerName && <span><Icon name="user" size={12} />{a.ownerName}</span>}
                        </span>
                      </div>
                      <div className="agent-side">
                        <button className={`btn sm${on ? '' : ' primary'}`} onClick={() => toggleStatus(a)}>{on ? tr('agents.revoke') : tr('agents.approve')}</button>
                        <Menu label={tr('ui.agents.more')}>
                          <button type="button" onClick={() => { setGrantId(a.id); setGrantFile(''); }}><Icon name="plus" size={14} />{tr('agents.authorizeProject')}</button>
                          <button type="button" onClick={() => void showProjects(a)}><Icon name="folder" size={14} />{tr('agents.authorizedProjects')}</button>
                          <button type="button" onClick={() => void showActivity(a)}><Icon name="history" size={14} />{tr('agents.viewActivity')}</button>
                          <button type="button" onClick={() => void rotate(a)}><Icon name="key" size={14} />{tr('agents.rotateToken')}</button>
                        </Menu>
                      </div>
                    </div>
                    <div className="agent-scopes" role="group" aria-label={tr('agents.permissions')}>
                      <span className="faint small">{tr('agents.permissions')}</span>
                      {SCOPES.map((scope) => <button type="button" key={scope} className="scope-chip" aria-pressed={current.includes(scope)} onClick={() => setScopes((x) => ({ ...x, [a.id]: current.includes(scope) ? current.filter((v) => v !== scope) : [...current, scope] }))}><Icon name={current.includes(scope) ? 'check' : 'plus'} size={11} />{scopeLabel(scope)}</button>)}
                      {dirty && <span className="scope-save"><button type="button" className="btn ghost sm" onClick={() => setScopes((x) => ({ ...x, [a.id]: a.scopes }))}>{tr('agents.cancel')}</button><button type="button" className="btn primary sm" onClick={() => saveScopes(a)}>{tr('comments.save')}</button></span>}
                    </div>
                    {panel[a.id] === 'projects' && projects[a.id] && <div className="agent-panel">
                      <b className="small">{tr('agents.authorizedProjects')}</b>
                      <ul className="activity compact">{projects[a.id].map((row) => <li key={row.projectId}><span className="dot" /><span><b>{row.project.name || row.project.slug}</b> <span className="faint">{row.project.slug}</span></span><button className="btn ghost sm" onClick={() => void api.revokeAgentProject(a.id, row.projectId).then(() => { setProjects((x) => ({ ...x, [a.id]: x[a.id].filter((v) => v.projectId !== row.projectId) })); toast('ok', tr('agents.revoke')); }).catch((e) => toast('error', String(e)))}>{tr('agents.revoke')}</button></li>)}{!projects[a.id].length && <li className="faint">{tr('agents.noProjects')}</li>}</ul>
                    </div>}
                    {panel[a.id] === 'activity' && activity[a.id] && <div className="agent-panel">
                      <b className="small">{tr('agents.viewActivity')}</b>
                      <ul className="activity compact">{activity[a.id].map((entry) => <li key={entry.id}><span className={entry.ok ? 'dot ok' : 'dot error'} /><span><b>{entry.tool}</b> · {entry.project}<br /><span className="faint">{entry.summary} · {formatDate(language, entry.at, { dateStyle: 'short', timeStyle: 'short' })}</span></span></li>)}{!activity[a.id].length && <li className="faint">{tr('agents.noActivity')}</li>}</ul>
                    </div>}
                  </li>
                );
              })}
            </ul>
          </>}
          <McpGuide newToken={newToken} progress={progress} onAdd={agents.length ? undefined : () => setNewOpen(true)} />
        </>
      )}

      {newOpen && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setNewOpen(false); }}><div className="modal" role="dialog" aria-modal="true" aria-label={tr('agents.newTitle')}>
        <h3>{tr('agents.newTitle')}</h3><p className="muted small">{tr('agents.tokenOnce')}</p>
        <label className="small">{tr('agents.name')}<input className="field" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void create(); }} placeholder={tr('ui.workspace.agentNamePlaceholder')} /></label>
        <label className="small">{tr('agents.type')}<select className="field" value={newType} onChange={(e) => setNewType(e.target.value)}><option value="mcp">{tr('agents.generic')}</option>{CLIENTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <div className="small">{tr('agents.permissions')}<div className="agent-scopes in-modal">{SCOPES.map((scope) => <label className="scope-chip" key={scope}><input type="checkbox" checked={newScopes.includes(scope)} onChange={(e) => setNewScopes((v) => e.target.checked ? [...new Set([...v, scope])] : v.filter((x) => x !== scope))} /><Icon name={newScopes.includes(scope) ? 'check' : 'plus'} size={11} />{scopeLabel(scope)}</label>)}</div></div>
        <div className="row modal-actions"><span className="grow" /><button className="btn" onClick={() => setNewOpen(false)}>{tr('agents.cancel')}</button><button className="btn primary" onClick={() => void create()}>{tr('agents.create')}</button></div>
      </div></div>}
      {grantId && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setGrantId(null); }}><div className="modal" role="dialog" aria-modal="true" aria-label={tr('agents.authorizeTitle')}>
        <h3>{tr('agents.authorizeTitle')}</h3><p className="muted small">{tr('agents.authorizeHint')}</p>
        <label className="small">{tr('agents.projectFile')}<input className="field" autoFocus value={grantFile} onChange={(e) => setGrantFile(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void grant(); }} placeholder={tr('ui.workspace.projectPlaceholder')} /></label>
        <div className="row modal-actions"><span className="grow" /><button className="btn" onClick={() => setGrantId(null)}>{tr('agents.cancel')}</button><button className="btn primary" onClick={() => void grant()}>{tr('agents.authorize')}</button></div>
      </div></div>}
    </section>
  );
}

/** Menu de "mais ações": abre abaixo do botão e fecha ao clicar fora, com Esc ou ao escolher algo. */
function Menu({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc); };
  }, [open]);
  return <div className="menu-wrap" ref={box}>
    <button type="button" className={`btn ghost sm icon${open ? ' active' : ''}`} aria-label={label} title={label} aria-expanded={open} onClick={() => setOpen((v) => !v)}><Icon name="more" size={15} /></button>
    {open && <div className="menu-pop" role="menu" onClick={() => setOpen(false)}>{children}</div>}
  </div>;
}

function McpGuide({ newToken, progress, onAdd }: { newToken: string | null; progress: boolean[]; onAdd?: () => void }) {
  const language = useApp((s) => s.language);
  const tr = (key: string) => t(language, key);
  const [client, setClient] = useState('Claude Code');
  const [token, setToken] = useState(newToken || '');
  const [format, setFormat] = useState<'command' | 'json'>('command');
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  useEffect(() => { if (newToken) setToken(newToken); }, [newToken]);
  const endpoint = `${location.origin}/mcp`;
  const configToken = token.trim() || t(language, 'ui.workspace.agentTokenPlaceholder');
  const command = `claude mcp add --transport http stylo ${endpoint} --header "Authorization: Bearer ${configToken}"`;
  const json = JSON.stringify({ mcpServers: { stylo: { url: endpoint, headers: { Authorization: `Bearer ${configToken}` } } } }, null, 2);
  const value = client === 'Claude Code' && format === 'command' ? command : json;
  const hint = client === 'Claude Code'
    ? (format === 'command' ? t(language, 'ui.workspace.pasteThisIntoTheTerminal') : t(language, 'ui.workspace.useThisJsonInClaude'))
    : client === 'Codex'
      ? t(language, 'ui.workspace.addThisMcpServerIn')
      : client === 'Cursor' || client === 'Windsurf' || client === 'OpenCode'
        ? t(language, 'ui.workspace.pasteJsonInto', { client })
        : t(language, 'ui.workspace.useTheUrlAndAuthorization');
  const test = async () => {
    setTestState('testing'); setTestMessage(tr('agents.testing'));
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'stylo-guide', version: '1' } } }) });
      const body = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
      setTestState('ok'); setTestMessage(tr('agents.responding'));
    } catch (error) { setTestState('error'); setTestMessage(error instanceof Error ? error.message : String(error)); }
  };
  const steps: Array<[string, string]> = [['ui.workspace.choose', 'ui.workspace.yourAiTool'], ['ui.workspace.authorize', 'ui.workspace.yourProject'], ['ui.workspace.create', 'ui.workspace.sideBySide']];
  const next = progress.findIndex((done) => !done);
  return <div className={`account-card connection-guide${onAdd ? ' first' : ''}`}>
    <div className="connection-hero">
      <span className="connection-orb" aria-hidden="true"><i /><i /><i /><Icon name="spark" size={22} /></span>
      <div><h3>{t(language, 'ui.workspace.connectYourCreativeCoPilot')}</h3><p className="muted small">{t(language, 'ui.workspace.chooseAToolAuthorizeAccess')}</p></div>
      {onAdd && <button className="btn primary" onClick={onAdd}>{t(language, 'ui.workspace.connectFirstAgent')}</button>}
    </div>
    <ol className="connection-steps">
      {steps.map(([title, sub], i) => <li key={title} className={progress[i] ? 'done' : i === next ? 'current' : ''}>
        <span className="step-mark" aria-hidden="true">{progress[i] ? <Icon name="check" size={13} /> : i + 1}</span>
        <span><b>{t(language, title)}</b><span>{t(language, sub)}</span></span>
        {progress[i] && <span className="sr-only">{t(language, 'ui.agents.stepDone')}</span>}
      </li>)}
    </ol>
    <details className="connection-details"><summary><Icon name="code" size={13} />{t(language, 'ui.workspace.openConnectionSetup')}<Icon name="chevrondown" size={13} /></summary><div className="connection-details-body"><div className="workspace-head"><b>{tr('agents.connectionGuide')}</b><div className="row"><select className="field" aria-label={tr('agents.client')} value={client} onChange={(e) => { setClient(e.target.value); setFormat(e.target.value === 'Claude Code' ? 'command' : 'json'); }}><option>Claude Code</option><option>Claude Desktop</option><option>Codex</option><option>Cursor</option><option>Windsurf</option><option>OpenCode</option><option>Quine</option><option>OpenCog</option><option>{t(language, 'ui.workspace.genericMcpClient')}</option></select><select className="field" aria-label={tr('agents.configFormat')} value={client === 'Claude Code' ? format : 'json'} onChange={(e) => setFormat(e.target.value as 'command' | 'json')}><option value="command" disabled={client !== 'Claude Code'}>{tr('agents.command')}</option><option value="json">JSON</option></select></div></div><label className="small">{tr('agents.bearerToken')}<input className="field" placeholder={tr('agents.tokenPlaceholder')} value={token} onChange={(e) => { setToken(e.target.value); setTestState('idle'); }} /></label><p className="hint">{tr('agents.endpoint')}: <code>{endpoint}</code> · {tr('agents.transport')}. {hint} {tr('agents.tokenRecovery')}</p>{!token.trim() && <p className="hint">{tr('agents.createFirst')}</p>}{newToken && <p className="success">{tr('agents.tokenLoaded')}</p>}<div className="codebox"><pre className="code">{value}</pre><div className="row"><button className="btn ghost sm" onClick={() => void navigator.clipboard.writeText(value).then(() => toast('ok', tr('agents.guideCopied')))}>{tr('actions.copy')}</button><button className="btn ghost sm" disabled={testState === 'testing' || !token.trim()} onClick={() => void test()}>{tr('agents.testConnection')}</button></div></div>{testMessage && <p className={testState === 'ok' ? 'success' : testState === 'error' ? 'error' : 'hint'}>{testMessage}</p>}</div></details>
  </div>;
}
