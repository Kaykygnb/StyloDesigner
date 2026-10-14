import { useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import { app, toast, useApp } from "../lib/app";
import { askText } from "../ui/Dialog";
import { Icon } from '../ui/Icon';
import { formatDate, t } from '../lib/i18n';

type Tab = "library" | "agents" | "admin" | "account";

export function WorkspacePanel({ tab }: { tab: Tab }) {
  const user = useApp((s) => s.user);
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const [assets, setAssets] = useState<api.LibraryAsset[]>([]);
  const [agents, setAgents] = useState<api.AgentInfo[]>([]);
  const [users, setUsers] = useState<api.PublicUser[]>([]);
  const [policy, setPolicy] = useState("closed");
  const [scopes, setScopes] = useState<Record<string, string[]>>({});
  const [newToken, setNewToken] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null,
  );
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'MEMBER' as api.PublicUser['role'], color: '#6d5dfc', avatar: '' });
  const [editUserDraft, setEditUserDraft] = useState<(api.PublicUser & { avatar: string }) | null>(null);
  const [newAgentOpen, setNewAgentOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentType, setNewAgentType] = useState('mcp');
  const [newAgentScopes, setNewAgentScopes] = useState(['read', 'comment', 'write', 'export']);
  const [grantAgentId, setGrantAgentId] = useState<string | null>(null);
  const [grantProjectFile, setGrantProjectFile] = useState('');
  const [catalog, setCatalog] = useState<{
    plugins: api.PluginInfo[];
    providers: api.ProviderInfo[];
  } | null>(null);
  const [pluginChecks, setPluginChecks] = useState<Record<string, Awaited<ReturnType<typeof api.pluginDiagnostics>>>>({});
  const [backups, setBackups] = useState<Array<{ id: string; createdAt: string; bytes: number }>>([]);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof api.systemHealth>> | null>(null);
  const [connections, setConnections] = useState<Array<{ id: string; personId: string; name: string; connectedAt: string }>>([]);
  const [adminSessions, setAdminSessions] = useState<Awaited<ReturnType<typeof api.adminSessionsList>>>([]);
  const [adminActivity, setAdminActivity] = useState<Awaited<ReturnType<typeof api.adminActivity>>>([]);
  const [adminActivityFilter, setAdminActivityFilter] = useState('all');
  const [accountName, setAccountName] = useState(user?.name || "");
  const [accountEmail, setAccountEmail] = useState(user?.email || "");
  const [accountColor, setAccountColor] = useState(user?.color || "#6d5dfc");
  const [accountAvatar, setAccountAvatar] = useState(user?.avatar || "");
  const [sessions, setSessions] = useState<
    Array<{
      id: string;
      createdAt: string;
      expiresAt: string;
      current: boolean;
    }>
  >([]);
  const [authEvents, setAuthEvents] = useState<Array<{ id: string; email: string; kind: string; createdAt: string }>>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [q, setQ] = useState("");
  const [editingAsset, setEditingAsset] = useState<string | null>(null);
  const [assetDraft, setAssetDraft] = useState({ name: '', license: '', credit: '', tags: '', commercial: true, attribution: 'none' as 'required' | 'optional' | 'none' });
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [assetUsage, setAssetUsage] = useState<Record<string, { useCount: number; orphan: boolean; projects: Array<{ file: string; name: string }> }>>({});
  const [libraryUsage, setLibraryUsage] = useState<"all" | "used" | "orphan">("all");
  const [libraryKind, setLibraryKind] = useState("all");
  const [moreFilters, setMoreFilters] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [librarySource, setLibrarySource] = useState("all");
  const [libraryLicense, setLibraryLicense] = useState("all");
  const [libraryCredit, setLibraryCredit] = useState<"all" | "required" | "missing">("all");
  const [librarySize, setLibrarySize] = useState<"all" | "small" | "large">("all");
  const [libraryDate, setLibraryDate] = useState<"all" | "recent">("all");
  const [libraryTag, setLibraryTag] = useState("");
  const [userQ, setUserQ] = useState("");
  const [userStatus, setUserStatus] = useState<"all" | "active" | "suspended">("all");
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({});
  const [agentActivity, setAgentActivity] = useState<Record<string, api.AgentActivity[]>>({});
  const [agentProjects, setAgentProjects] = useState<Record<string, Array<{ projectId: string; project: { id: string; slug: string; name: string; updatedAt: string } }>>>({});
  const [userProjects, setUserProjects] = useState<Record<string, Array<api.ProjectInfo & { id: string; role: string }>>>({});
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab === "library") {
      setLoading(true);
      void Promise.all([api.libraryList(), api.libraryUsageDetail()])
        .then(([x, usage]) => { setAssets(x.assets); setAssetUsage(Object.fromEntries(usage.assets.map((item) => [item.assetId, { useCount: item.useCount, orphan: item.orphan, projects: item.projects }]))); })
        .catch((e) => toast("error", String(e)))
        .finally(() => setLoading(false));
    }
    if (tab === "agents") {
      setLoading(true);
      void api
        .agentsList()
        .then((rows) => {
          setAgents(rows);
          setScopes(Object.fromEntries(rows.map((a) => [a.id, a.scopes])));
        })
        .catch((e) => toast("error", String(e)))
        .finally(() => setLoading(false));
    }
    if (tab === "admin") {
      setLoading(true);
      void Promise.all([
        api.usersList(),
        api.agentConfig(),
        api.pluginsCatalog(),
        api.backupsList(),
        api.systemHealth(),
        api.connectionsList(),
        api.adminActivity(),
        api.adminSessionsList(),
      ])
        .then(([u, c, p, b, h, currentConnections, activity, allSessions]) => {
          setUsers(u);
          setPolicy(c.agentPolicy || "closed");
          setCatalog(p);
          setBackups(b);
          setHealth(h);
          setConnections(currentConnections);
          setAdminActivity(activity);
          setAdminSessions(allSessions);
        })
        .catch((e) => toast("error", String(e)))
        .finally(() => setLoading(false));
    }
    if (tab === "account") {
      void Promise.all([api.sessionsList(), api.authEvents()]).then(([s, e]) => { setSessions(s); setAuthEvents(e); }).catch(() => { setSessions([]); setAuthEvents([]); });
    }
  }, [tab]);

  const upload = async (file?: File) => {
    if (!file) return;
    try {
      const { asset } = await api.libraryUpload(file);
      setAssets((x) => [asset, ...x.filter((item) => item.id !== asset.id)]);
      toast("ok", tr('library.assetUploaded'));
    } catch (e) {
      toast("error", String(e));
    }
  };
  const editAsset = (asset: api.LibraryAsset) => {
    setEditingAsset(asset.id);
    setAssetDraft({ name: asset.name, license: asset.license?.name || t(language, 'ui.workspace.uploadedByAccount'), credit: asset.credit || '', tags: (asset.tags || []).join(', '), commercial: asset.license?.commercial !== false, attribution: (asset.license?.attribution as 'required' | 'optional' | 'none') || 'none' });
  };
  const saveAsset = async (asset: api.LibraryAsset) => {
    if (!assetDraft.name.trim() || !assetDraft.license.trim()) return toast('error', t(language, 'ui.workspace.nameAndLicenseRequired'));
    try {
      const tags = assetDraft.tags.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean);
      const updated = await api.libraryUpdate(asset.id, { name: assetDraft.name.trim(), tags, license: { ...(asset.license || {}), name: assetDraft.license.trim(), commercial: assetDraft.commercial, attribution: assetDraft.attribution }, credit: assetDraft.credit.trim() || null });
      setAssets((x) => x.map((v) => v.id === asset.id ? updated : v));
      setEditingAsset(null);
      toast('ok', tr('library.assetUpdated'));
    } catch (e) { toast('error', String(e)); }
  };
  const create = async () => {
    if (!newAgentName.trim()) return toast('error', t(language, 'ui.workspace.nameTheAgent'));
    try {
      const a = await api.createAgent(newAgentName.trim(), newAgentScopes, newAgentType);
      setAgents((x) => [...x, a.agent]);
      setScopes((x) => ({ ...x, [a.agent.id]: a.agent.scopes }));
      setNewToken(a.token);
      setNewAgentOpen(false);
      setNewAgentName('');
      setNewAgentType('mcp');
    } catch (e) {
      toast("error", String(e));
    }
  };
  const grantProject = async (agent: api.AgentInfo) => {
    const file = grantProjectFile.trim();
    if (!file) return toast('error', t(language, 'ui.workspace.enterTheProjectToAuthorize'));
    try {
      await api.grantAgentProject(agent.id, file.trim());
      toast("ok", t(language, 'ui.workspace.agentAuthorizedForTheProject'));
      setGrantAgentId(null);
      setGrantProjectFile('');
    } catch (e) {
      toast("error", String(e));
    }
  };
  const rotate = async (agent: api.AgentInfo) => { try { const result = await api.rotateAgent(agent.id); setNewToken(result.token); toast('ok', t(language, 'ui.workspace.tokenRotated', { name: agent.name })); } catch (e) { toast('error', String(e)); } };
  const showAgentActivity = async (agent: api.AgentInfo) => { try { const rows = await api.agentActivity(agent.id); setAgentActivity((x) => ({ ...x, [agent.id]: rows })); } catch (e) { toast('error', String(e)); } };
  const showAgentProjects = async (agent: api.AgentInfo) => { try { const rows = await api.agentProjects(agent.id); setAgentProjects((x) => ({ ...x, [agent.id]: rows })); } catch (e) { toast('error', String(e)); } };
  const createUser = async () => {
    if (!newUser.email.trim() || !newUser.name.trim()) return toast('error', t(language, 'ui.workspace.nameAndEmailRequired'));
    try {
      const created = await api.createUser({ ...newUser, email: newUser.email.trim(), name: newUser.name.trim(), avatar: newUser.avatar || null });
      setUsers((x) => [...x, created.user]);
      setTemporaryPassword(created.temporaryPassword || null);
      setNewUserOpen(false);
      setNewUser({ name: '', email: '', role: 'MEMBER', color: '#6d5dfc', avatar: '' });
    } catch (e) {
      toast("error", String(e));
    }
  };
  const editUser = async (u: api.PublicUser) => {
    setEditUserDraft({ ...u, avatar: u.avatar || '' });
  };
  const saveEditedUser = async () => {
    if (!editUserDraft) return;
    const { id, name, email, color, avatar, role } = editUserDraft;
    if (!name.trim() || !email.trim()) return toast('error', t(language, 'ui.workspace.nameAndEmailRequired'));
    try {
      const updated = await api.updateUser(id, { name: name.trim(), email: email.trim(), color, avatar: avatar || null, role });
      setUsers((x) => x.map((v) => (v.id === id ? updated : v)));
      setEditUserDraft(null);
      toast('ok', t(language, 'ui.workspace.userUpdated'));
    } catch (e) {
      toast("error", String(e));
    }
  };
  const resetUser = async (u: api.PublicUser) => {
    try {
      const result = await api.resetUserPassword(u.id);
      setTemporaryPassword(result.temporaryPassword);
      toast('ok', t(language, 'ui.workspace.tempPasswordGenerated'));
    } catch (e) {
      toast("error", String(e));
    }
  };
  const setRole = async (u: api.PublicUser, role: api.PublicUser["role"]) => { try { const updated = await api.updateUser(u.id, { role }); setUsers((x) => x.map((v) => v.id === u.id ? updated : v)); toast('ok', t(language, 'ui.workspace.roleUpdated')); } catch (e) { toast('error', String(e)); } };
  const toggleSuspended = async (u: api.PublicUser) => { try { const updated = await api.setUserSuspended(u.id, !u.suspended); setUsers((x) => x.map((v) => v.id === u.id ? updated : v)); toast('ok', t(language, updated.suspended ? 'ui.workspace.userSuspended' : 'ui.workspace.userReactivated')); } catch (e) { toast('error', String(e)); } };
  const showUserProjects = async (u: api.PublicUser) => { try { const rows = await api.userProjects(u.id); setUserProjects((x) => ({ ...x, [u.id]: rows })); } catch (e) { toast('error', String(e)); } };
  const saveProvider = async (provider: api.ProviderInfo) => {
    const key = (providerKeys[provider.id] || '').trim();
    if (key.length < 8) { toast('error', t(language, 'ui.workspace.keyTooShort')); return; }
    try { await api.saveProviderKey(provider.id, key); setCatalog((x) => x && ({ ...x, providers: x.providers.map((p) => p.id === provider.id ? { ...p, hasKey: true, ready: true } : p) })); setProviderKeys((x) => ({ ...x, [provider.id]: '' })); toast('ok', t(language, 'ui.workspace.keySaved', { name: provider.name })); }
    catch (e) { toast('error', String(e)); }
  };
  const removeProvider = async (provider: api.ProviderInfo) => {
    try { await api.removeProviderKey(provider.id); setCatalog((x) => x && ({ ...x, providers: x.providers.map((p) => p.id === provider.id ? { ...p, hasKey: false, ready: false } : p) })); toast('ok', t(language, 'ui.workspace.keyRemoved', { name: provider.name })); }
    catch (e) { toast('error', String(e)); }
  };

  if (tab === "account")
    return (
      <section className="workspace-section">
        <h1>{tr('account.title')}</h1>
        <p className="muted">{tr('account.subtitle')}</p>
        <div className="account-card">
          <div className="account-identity">
            <button className="avatar avatar-lg" type="button" title={tr('account.changeAvatar')} aria-label={tr('account.changeAvatar')} style={{ background: accountColor }} onClick={() => avatarInput.current?.click()}>{accountAvatar ? <img src={accountAvatar} alt="" /> : (accountName || user?.name || "?").slice(0, 1).toUpperCase()}<span className="avatar-edit" aria-hidden="true"><Icon name="image" size={12} /></span></button>
            <div className="account-identity-text">
              <b>{accountName || user?.name || tr('account.noLogin')}</b>
              <span className="faint">{user?.email || tr('account.noLogin')}{user?.role ? ` · ${tr(`role.${user.role}`) || user.role}` : ''}</span>
              <span className="hint">{tr('account.avatarHint')}</span>
            </div>
          </div>
          <div className="form-grid">
            <label className="small">
              {tr('account.name')}
              <input className="field" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            </label>
            <label className="small">
              {tr('account.email')}
              <input className="field" type="email" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} />
            </label>
            <label className="small color-field">
              {tr('account.profileColor')}
              <span className="color-field-row"><input type="color" value={accountColor} onChange={(e) => setAccountColor(e.target.value)} /><code>{accountColor.toUpperCase()}</code></span>
            </label>
          </div>
          <input ref={avatarInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 160 * 1024) { toast('error', t(language, 'ui.workspace.avatarTooBig')); return; } const reader = new FileReader(); reader.onload = () => setAccountAvatar(String(reader.result || '')); reader.readAsDataURL(file); }} />
          <div className="card-actions">
            <button
              className="btn primary"
              onClick={() =>
                void api
                  .updateMe({ name: accountName, email: accountEmail, color: accountColor, avatar: accountAvatar || null })
                  .then((updated) => { app.set({ user: updated }); setAccountEmail(updated.email); toast("ok", tr('account.profileSaved')); })
                  .catch((e) => toast("error", String(e)))
              }
            >
              {tr('account.saveProfile')}
            </button>
          </div>
        </div>
        <div className="account-card">
          <b>{tr('account.changePassword')}</b>
          <div className="form-grid">
            <label className="small">
              {tr('account.currentPassword')}
              <input className="field" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </label>
            <label className="small">
              {tr('account.newPassword')}
              <input className="field" type="password" autoComplete="new-password" value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} />
            </label>
          </div>
          <div className="card-actions">
            <button
              className="btn"
              disabled={!currentPassword || !nextPassword}
              onClick={() =>
                void api
                  .changePassword(currentPassword, nextPassword)
                  .then(() => {
                    setCurrentPassword("");
                    setNextPassword("");
                    toast("ok", tr('account.passwordChanged'));
                  })
                  .catch((e) => toast("error", String(e)))
              }
            >
              {tr('account.updatePassword')}
            </button>
          </div>
        </div>
        <div className="account-card">
          <div className="workspace-head">
            <b>{tr('account.activeSessions')}</b>
            <button
              className="btn ghost sm"
              onClick={() => void api.sessionsList().then(setSessions)}
            >
              {tr('actions.refresh')}
            </button>
            <button className="btn ghost sm" onClick={() => void api.revokeAllSessions().then(() => { toast("ok", tr('account.sessionsEnded')); window.location.reload(); }).catch((e) => toast("error", String(e)))}>{tr('account.endAll')}</button>
          </div>
          <ul className="resource-list">
            {sessions.map((s) => (
              <li key={s.id}>
                <div>
                  <b>{s.current ? tr('account.thisSession') : tr('account.otherSession')}</b>
                  <span className="faint">
                    {tr('account.startedAt')} {formatDate(language, s.createdAt, { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                {!s.current && (
                  <button
                    className="btn sm"
                    onClick={() =>
                      void api.revokeSession(s.id).then(() => {
                        setSessions((x) => x.filter((v) => v.id !== s.id));
                        toast('ok', t(language, 'ui.workspace.sessionRevoked'));
                      })
                    }
                  >
                    {tr('account.revoke')}
                  </button>
                )}
              </li>
            ))}
            {!sessions.length && (
              <li className="muted">{tr('account.noSessions')}</li>
            )}
          </ul>
        </div>
        <div className="account-card"><div className="workspace-head"><b>{tr('account.accessHistory')}</b><button className="btn ghost sm" onClick={() => void api.authEvents().then(setAuthEvents)}>{tr('actions.refresh')}</button><button className="btn ghost sm" onClick={() => void api.accountExport().then((data) => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'stylo-conta.json'; a.click(); URL.revokeObjectURL(url); toast('ok', tr('account.dataExported')); }).catch((e) => toast('error', String(e)))}>{tr('account.exportData')}</button></div><ul className="resource-list">{authEvents.map((e) => <li key={e.id}><div><b>{e.kind === 'login' ? tr('account.login') : tr('account.logout')}</b><span className="faint">{formatDate(language, e.createdAt, { dateStyle: 'short', timeStyle: 'short' })} · {e.email}</span></div></li>)}{!authEvents.length && <li className="faint">{tr('account.noEvents')}</li>}</ul></div>
      </section>
    );
  if (tab === "agents")
    return (
      <section className="workspace-section">
        <div className="workspace-head">
          <div>
            <h1>{tr('agents.title')}</h1>
            <p className="muted">{tr('agents.subtitle')}</p>
          </div>
          <button className="btn primary" onClick={() => setNewAgentOpen(true)}>
            {tr('agents.new')}
          </button>
        </div>
        {agents.length > 0 && <div className="workspace-metrics two" aria-label={t(language, 'ui.workspace.workspaceOverview')}>
          <div><strong>{agents.filter((a) => a.status !== 'REVOKED').length}</strong><span>{t(language, 'ui.workspace.activeConnections')}</span></div>
          <div><strong>{agents.length}</strong><span>{t(language, 'ui.workspace.creativePartners')}</span></div>
        </div>}
        {newAgentOpen && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setNewAgentOpen(false); }}><div className="modal" role="dialog" aria-modal="true" aria-label={tr('agents.newTitle')}>
          <h3>{tr('agents.newTitle')}</h3><p className="muted small">{tr('agents.tokenOnce')}</p>
          <label className="small">{tr('agents.name')}<input className="field" autoFocus value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder={t(language, 'ui.workspace.agentNamePlaceholder')} /></label>
          <label className="small">{tr('agents.type')}<select className="field" value={newAgentType} onChange={(e) => setNewAgentType(e.target.value)}><option value="mcp">{tr('agents.generic')}</option><option value="claude-code">Claude Code</option><option value="claude-desktop">Claude Desktop</option><option value="codex">Codex</option><option value="cursor">Cursor</option><option value="windsurf">Windsurf</option><option value="opencode">OpenCode</option><option value="quine">Quine</option><option value="opencog">OpenCog</option></select></label>
          <div className="small">{tr('agents.permissions')}{(['read', 'comment', 'write', 'export'] as const).map((scope) => <label className="check-row" key={scope}><input type="checkbox" checked={newAgentScopes.includes(scope)} onChange={(e) => setNewAgentScopes((v) => e.target.checked ? [...new Set([...v, scope])] : v.filter((x) => x !== scope))} />{scope === 'read' ? (t(language, 'ui.workspace.view')) : scope === 'comment' ? (t(language, 'tool.comment')) : scope === 'write' ? (t(language, 'admin.edit')) : (t(language, 'inspector.extra.exportTitle'))}</label>)}</div>
          <div className="row modal-actions"><span className="grow"/><button className="btn" onClick={() => setNewAgentOpen(false)}>{tr('agents.cancel')}</button><button className="btn primary" onClick={() => void create()}>{tr('agents.create')}</button></div>
        </div></div>}
        {newToken && (
          <div className="account-card">
            <b>{tr('agents.tokenCreated')}</b>
            <p className="hint">
              {tr('agents.tokenHint')}
            </p>
            <div className="codebox">
              <code>{newToken}</code>
              <div className="row">
              <button
                className="btn ghost sm"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(newToken)
                    .then(() => toast("ok", tr('agents.tokenCopied')))
                }
              >
                 {tr('actions.copy')}
              </button>
              </div>
            </div>
            <button className="btn sm" onClick={() => setNewToken(null)}>
               {tr('agents.close')}
            </button>
          </div>
        )}
        {loading ? (
          <div className="workspace-loading" aria-live="polite"><span /><span /><span /></div>
        ) : (
          <>
            <McpGuide newToken={newToken} />
            {!agents.length && <div className="agent-empty"><div className="empty-art"><Icon name="users" size={24} /></div><div><b>{t(language, 'ui.workspace.noCreativePartnerConnectedYet')}</b><p className="muted small">{t(language, 'ui.workspace.createYourFirstConnectionTo')}</p></div><button className="btn primary sm" onClick={() => setNewAgentOpen(true)}>{t(language, 'ui.workspace.connectFirstAgent')}</button></div>}
            <ul className="resource-list">
              {agents.map((a) => (
                <li key={a.id}>
                  <div>
                    <b>{a.name}</b>
                    <span className="agent-meta">
                      <span className={`badge ${a.status === 'REVOKED' ? 'error' : 'ok'}`}>{a.status === 'REVOKED' ? (t(language, 'ui.workspace.paused')) : (t(language, 'ui.workspace.connected'))}</span>
                      <span>{a.type || 'MCP'}</span>
                      {a.lastSeenAt && <span>{t(language, 'ui.workspace.lastSeen')} {new Date(a.lastSeenAt).toLocaleString(language)}</span>}
                    </span>
                    <span className="faint">{t(language, 'ui.workspace.owner')}: {a.ownerName || '—'} · {t(language, 'ui.workspace.lastProject')}: {a.lastProject?.name || a.lastProject?.slug || (t(language, 'ui.workspace.none'))}</span>
                    <div className="row wrap">
                      {["read", "comment", "write", "export"].map((scope) => (
                        <label className="check small" key={scope}>
                          <input
                            type="checkbox"
                            checked={scopes[a.id]?.includes(scope) ?? false}
                            onChange={(e) =>
                              setScopes((x) => ({
                                ...x,
                                [a.id]: e.target.checked
                                  ? [...(x[a.id] || []), scope]
                                  : (x[a.id] || []).filter((v) => v !== scope),
                              }))
                            }
                          />
                          {scope === 'read' ? (t(language, 'ui.workspace.view')) : scope === 'comment' ? (t(language, 'tool.comment')) : scope === 'write' ? (t(language, 'admin.edit')) : (t(language, 'inspector.extra.exportTitle'))}
                        </label>
                      ))}
                      <button
                        className="btn ghost sm"
                        onClick={() =>
                          void api
                            .updateAgent(a.id, scopes[a.id] || [])
                            .then(() => toast("ok", tr('agents.savePermissions')))
                            .catch((e) => toast("error", String(e)))
                        }
                      >
                        {tr('comments.save')}
                      </button>
                      <details className="agent-actions">
                        <summary className="btn ghost sm">{t(language, 'ui.workspace.actions')}</summary>
                        <div className="row wrap agent-actions-menu">
                          <button className="btn ghost sm" onClick={() => { setGrantAgentId(a.id); setGrantProjectFile(''); }}>{tr('agents.authorizeProject')}</button>
                          <button className="btn ghost sm" onClick={() => void rotate(a)}>{tr('agents.rotateToken')}</button>
                          <button className="btn ghost sm" onClick={() => void showAgentProjects(a)}>{tr('agents.authorizedProjects')}</button>
                          <button className="btn ghost sm" onClick={() => void showAgentActivity(a)}>{tr('agents.viewActivity')}</button>
                        </div>
                      </details>
                    </div>
                    {agentProjects[a.id] && <ul className="activity compact">{agentProjects[a.id].map((row) => <li key={row.projectId}><span className="dot" /><span><b>{row.project.name || row.project.slug}</b><span className="faint">{row.project.slug}</span></span><button className="btn ghost sm" onClick={() => void api.revokeAgentProject(a.id, row.projectId).then(() => { setAgentProjects((x) => ({ ...x, [a.id]: x[a.id].filter((v) => v.projectId !== row.projectId) })); toast('ok', tr('agents.revoke')); }).catch((e) => toast('error', String(e)))}>{tr('agents.revoke')}</button></li>)}{!agentProjects[a.id].length && <li className="faint">{tr('agents.noProjects')}</li>}</ul>}
                    {agentActivity[a.id] && <ul className="activity compact">{agentActivity[a.id].map((entry) => <li key={entry.id}><span className={entry.ok ? 'dot ok' : 'dot error'} /><span><b>{entry.tool}</b> · {entry.project}<br /><span className="faint">{entry.summary} · {formatDate(language, entry.at, { dateStyle: 'short', timeStyle: 'short' })}</span></span></li>)}{!agentActivity[a.id].length && <li className="faint">{tr('agents.noActivity')}</li>}</ul>}
                  </div>
                  <button
                    className="btn sm"
                    onClick={() =>
                      void (
                        a.status === "REVOKED"
                          ? api.approveAgent(a.id)
                          : api.revokeAgent(a.id)
                      )
                        .then(() =>
                          setAgents((x) =>
                            x.map((v) =>
                              v.id === a.id
                                ? {
                                    ...v,
                                    status:
                                      v.status === "REVOKED"
                                        ? "ACTIVE"
                                        : "REVOKED",
                                  }
                                : v,
                            ),
                          ),
                        )
                        .catch((e) => toast("error", String(e)))
                    }
                  >
                    {a.status === "REVOKED" ? tr('agents.approve') : tr('agents.revoke')}
                  </button>
                </li>
              ))}
            </ul>
            {grantAgentId && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setGrantAgentId(null); }}><div className="modal" role="dialog" aria-modal="true" aria-label={tr('agents.authorizeTitle')}>
              <h3>{tr('agents.authorizeTitle')}</h3><p className="muted small">{tr('agents.authorizeHint')}</p>
              <label className="small">{tr('agents.projectFile')}<input className="field" autoFocus value={grantProjectFile} onChange={(e) => setGrantProjectFile(e.target.value)} placeholder={t(language, 'ui.workspace.projectPlaceholder')} /></label>
              <div className="row modal-actions"><span className="grow"/><button className="btn" onClick={() => setGrantAgentId(null)}>{tr('agents.cancel')}</button><button className="btn primary" onClick={() => { const agent = agents.find((v) => v.id === grantAgentId); if (agent) void grantProject(agent); }}>{tr('agents.authorize')}</button></div>
            </div></div>}
          </>
        )}
      </section>
    );
  if (tab === "admin")
    return (
      <section className="workspace-section">
        <div className="workspace-head">
          <div>
            <h1>{tr('admin.title')}</h1>
            <p className="muted">{tr('admin.subtitle')}</p>
          </div>
        </div>
        <SectionNav label={t(language, 'ui.workspace.jumpTo')} />
        <div className="account-card">
          <b>{tr('admin.health')}</b>
          <p className="faint">Banco: {health?.database.engine ? tr('admin.local') : '—'} · {health?.database.ok ? tr('admin.connected') : tr('admin.unavailable')} · {health?.counts?.projects ?? '—'} {tr('admin.projectsCount')} · {health?.transport.editors ?? '—'} {tr('admin.editorsCount')}</p>
          <p className="faint small">{tr('admin.storageHint')}</p>
          {health?.database.schemaVersion != null && <p className="faint">{tr('admin.migrations')}: {health.database.schemaVersion}</p>}
        </div>
        <div className="account-card">
          <b>{tr('admin.network')}</b>
          <p className="faint">{tr('admin.onlyComputer')}</p>
          <ul className="resource-list"><li><div><b>{tr('admin.thisComputer')}</b><span className="faint">{location.origin}/studio/ · MCP {location.origin}/mcp</span></div></li></ul>
        </div>
        <div className="account-card">
          <div className="workspace-head"><b>{tr('admin.activity')}</b><button className="btn ghost sm" onClick={() => void api.adminActivity().then(setAdminActivity)}>{tr('actions.refresh')}</button></div>
          <select className="field" aria-label={tr('admin.allOperations')} value={adminActivityFilter} onChange={(e) => setAdminActivityFilter(e.target.value)}><option value="all">{tr('admin.allOperations')}</option>{[...new Set(adminActivity.map((item) => `projeto:${item.project.slug}`))].map((key) => <option key={key} value={key}>{key.slice(8)}</option>)}{[...new Set(adminActivity.map((item) => `ferramenta:${item.tool}`))].map((key) => <option key={key} value={key}>{key.slice(11)}</option>)}{[...new Set(adminActivity.filter((item) => item.user).map((item) => `usuario:${item.user!.id}`))].map((key) => { const item = adminActivity.find((row) => `usuario:${row.user?.id}` === key); return <option key={key} value={key}>{tr('admin.user')}: {item?.user?.name || key.slice(8)}</option>; })}{[...new Set(adminActivity.filter((item) => item.agent).map((item) => `agente:${item.agent!.id}`))].map((key) => { const item = adminActivity.find((row) => `agente:${row.agent?.id}` === key); return <option key={key} value={key}>{tr('admin.agent')}: {item?.agent?.name || key.slice(7)}</option>; })}</select>
          <ul className="activity">{adminActivity.filter((item) => adminActivityFilter === 'all' || adminActivityFilter === `projeto:${item.project.slug}` || adminActivityFilter === `ferramenta:${item.tool}` || adminActivityFilter === `usuario:${item.user?.id}` || adminActivityFilter === `agente:${item.agent?.id}`).map((item) => <li key={item.id}><span className={`badge ${item.ok ? 'ok' : 'error'}`}>{item.ok ? 'OK' : (t(language, 'issues.error'))}</span><span><b>{item.agent?.name || item.user?.name || tr('admin.system')}</b> · {item.project.name || item.project.slug} · {item.summary || item.tool}<span className="faint"> · {formatDate(language, item.at, { dateStyle: 'short', timeStyle: 'short' })}</span></span></li>)}{!adminActivity.length && <li className="faint">{tr('admin.noActivity')}</li>}</ul>
        </div>
        <div className="account-card">
          <div className="workspace-head"><b>{tr('admin.connections')}</b><button className="btn ghost sm" onClick={() => void api.connectionsList().then(setConnections)}>{tr('actions.refresh')}</button></div>
          <ul className="resource-list">{connections.map((connection) => <li key={connection.id}><div><b>{connection.name}</b><span className="faint">{connection.personId} · {tr('admin.since')} {formatDate(language, connection.connectedAt, { dateStyle: 'short', timeStyle: 'short' })}</span></div><button className="btn ghost sm" onClick={() => void api.closeConnection(connection.id).then(() => { setConnections((items) => items.filter((item) => item.id !== connection.id)); toast('ok', tr('admin.end')); }).catch((e) => toast('error', String(e)))}>{tr('admin.end')}</button></li>)}{!connections.length && <li className="faint">{tr('admin.noConnections')}</li>}</ul>
        </div>
        {temporaryPassword && (
          <div className="account-card">
            <b>{tr('admin.temporaryPassword')}</b>
            <p className="hint">
              {tr('admin.temporaryPasswordHint')}
            </p>
            <div className="codebox">
              <code>{temporaryPassword}</code>
              <button
                className="btn ghost sm"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(temporaryPassword)
                    .then(() => toast("ok", t(language, 'ui.workspace.passwordCopied')))
                }
              >
                {tr('actions.copy')}
              </button>
            </div>
            <button
              className="btn sm"
              onClick={() => setTemporaryPassword(null)}
            >
              Fechar
            </button>
          </div>
        )}
        {editUserDraft && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditUserDraft(null); }}><div className="modal" role="dialog" aria-modal="true" aria-label={t(language, 'ui.workspace.editUser')}>
          <h3>{tr('admin.editUser')}</h3>
          <label className="small">{tr('account.name')}<input className="field" autoFocus value={editUserDraft.name} onChange={(e) => setEditUserDraft((v) => v && ({ ...v, name: e.target.value }))} /></label>
          <label className="small">{t(language, 'ui.workspace.email')}<input className="field" type="email" value={editUserDraft.email} onChange={(e) => setEditUserDraft((v) => v && ({ ...v, email: e.target.value }))} /></label>
          <label className="small">{tr('admin.accessLevel')}<select className="field" value={editUserDraft.role} disabled={editUserDraft.id === user?.id} onChange={(e) => setEditUserDraft((v) => v && ({ ...v, role: e.target.value as api.PublicUser['role'] }))}><option value="MEMBER">{tr('admin.member')}</option><option value="VIEWER">{tr('admin.viewer')}</option><option value="COMMENTER">{tr('admin.commenter')}</option><option value="EDITOR">{tr('admin.editor')}</option><option value="ADMIN">{tr('admin.adminRole')}</option><option value="OWNER">{tr('admin.owner')}</option></select></label>
          <label className="small">{tr('account.profileColor')}<input className="field" type="color" value={editUserDraft.color || '#6d5dfc'} onChange={(e) => setEditUserDraft((v) => v && ({ ...v, color: e.target.value }))} /></label>
          <label className="small">{tr('admin.profilePhoto')}<input className="field" type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setEditUserDraft((v) => v && ({ ...v, avatar: String(reader.result || '') })); reader.readAsDataURL(file); }} /></label>
          <div className="row modal-actions"><span className="grow"/><button className="btn" onClick={() => setEditUserDraft(null)}>{tr('actions.cancel')}</button><button className="btn primary" onClick={() => void saveEditedUser()}>{tr('comments.save')}</button></div>
        </div></div>}
        <div className="account-card">
          <div className="row">
            <b>{tr('admin.agentPolicy')}</b>
            <select
              className="field"
              value={policy}
              onChange={(e) => {
                const v = e.target.value as "open" | "approval" | "closed";
                setPolicy(v);
                void api
                  .updateAgentConfig({ agentPolicy: v })
                  .catch((x) => toast("error", String(x)));
              }}
            >
              <option value="closed">{tr('admin.policyClosed')}</option>
              <option value="approval">{tr('admin.policyApproval')}</option>
              <option value="open">{tr('admin.policyOpen')}</option>
            </select>
          </div>
          <p className="hint">
            {tr('admin.policyHint')}
          </p>
        </div>
        <div className="account-card">
          <div className="workspace-head">
            <b>{tr('admin.users')}</b>
            <button
              className="btn primary sm"
              onClick={() => setNewUserOpen(true)}
            >
              {tr('admin.newUser')}
            </button>
          </div>
          <div className="row wrap">
            <input className="field grow" aria-label={tr('admin.searchUsers')} placeholder={tr('admin.searchUsers')} value={userQ} onChange={(e) => setUserQ(e.target.value)} />
            <select className="field" aria-label={tr('admin.filterUsers')} value={userStatus} onChange={(e) => setUserStatus(e.target.value as typeof userStatus)}>
              <option value="all">{tr('admin.all')}</option><option value="active">{tr('admin.active')}</option><option value="suspended">{tr('admin.suspended')}</option>
            </select>
          </div>
          <ul className="resource-list">
            {users.filter((u) => {
              const text = `${u.name} ${u.email}`.toLowerCase();
              return (!userQ.trim() || text.includes(userQ.trim().toLowerCase())) && (userStatus === "all" || (userStatus === "suspended" ? u.suspended : !u.suspended));
            }).map((u) => (
              <li key={u.id}>
                <div>
                  <b>{u.name}</b>
                  <span className="faint">
                    {u.email} · {tr(`role.${u.role}`)} · {u.suspended ? tr('admin.suspended') : u.mustChangePassword ? (t(language, 'ui.workspace.passwordChangePending')) : tr('admin.active')}
                  </span>
                </div>
                <div className="row">
                  {u.id !== user?.id && <select className="field" value={u.role} onChange={(e) => void setRole(u, e.target.value as api.PublicUser["role"])}><option value="VIEWER">{tr('admin.viewer')}</option><option value="COMMENTER">{tr('admin.commenter')}</option><option value="EDITOR">{tr('admin.editor')}</option><option value="ADMIN">{tr('admin.adminRole')}</option><option value="MEMBER">{tr('admin.member')}</option></select>}
                  <button
                    className="btn ghost sm"
                    onClick={() => void editUser(u)}
                  >
                    {tr('admin.edit')}
                  </button>
                  <button className="btn ghost sm" onClick={() => void showUserProjects(u)}>{tr('admin.projectsAction')}</button>
                  <button
                    className="btn ghost sm"
                    onClick={() => void resetUser(u)}
                  >
                    {tr('admin.resetPassword')}
                  </button>
                  {u.id !== user?.id && (
                    <button className="btn ghost sm" onClick={() => void toggleSuspended(u)}>{u.suspended ? tr('admin.reactivate') : tr('admin.suspend')}</button>
                  )}
                  {u.id !== user?.id && (
                    <button
                      className="btn ghost sm"
                      onClick={() =>
                        void api
                          .revokeUserSessions(u.id)
                          .then(() => toast('ok', t(language, 'ui.workspace.sessionsRevoked')))
                          .catch((e) => toast("error", String(e)))
                      }
                    >
                      {tr('admin.revokeSessions')}
                    </button>
                  )}
                  {u.id !== user?.id && u.role !== "OWNER" && (
                    <button
                      className="btn sm"
                      onClick={() =>
                        void api
                          .deleteUser(u.id)
                          .then(() =>
                            setUsers((x) => x.filter((v) => v.id !== u.id)),
                          )
                          .catch((e) => toast("error", String(e)))
                      }
                    >
                      {tr('admin.delete')}
                    </button>
                  )}
                </div>
                {userProjects[u.id] && <ul className="activity compact">{userProjects[u.id].map((p) => <li key={p.file}><span className="dot" /><span><b>{p.name || p.file}</b><span className="faint">{p.file} · {tr(`role.${p.role}`)} · {t(language, 'ui.workspace.updated')} {formatDate(language, p.modified, { dateStyle: 'short', timeStyle: 'short' })}</span></span>{p.role !== 'OWNER' && <button className="btn ghost sm" onClick={() => void api.revokeUserProject(u.id, p.id).then(() => { setUserProjects((x) => ({ ...x, [u.id]: x[u.id].filter((v) => v.id !== p.id) })); toast('ok', tr('agents.revoke')); }).catch((e) => toast('error', String(e)))}>{tr('agents.revoke')}</button>}</li>)}{!userProjects[u.id].length && <li className="faint">{tr('admin.noAccessibleProjects')}</li>}</ul>}
              </li>
            ))}
            {!users.some((u) => {
              const text = `${u.name} ${u.email}`.toLowerCase();
              return (!userQ.trim() || text.includes(userQ.trim().toLowerCase())) && (userStatus === "all" || (userStatus === "suspended" ? u.suspended : !u.suspended));
            }) && <li className="muted">{tr('admin.noUserMatch')}</li>}
          </ul>
        </div>
        <div className="account-card"><div className="workspace-head"><b>{tr('admin.serverSessions')}</b><button className="btn ghost sm" onClick={() => void api.adminSessionsList().then(setAdminSessions).catch((e) => toast('error', String(e)))}>{tr('actions.refresh')}</button></div><ul className="resource-list">{adminSessions.map((session) => <li key={session.id}><div><b>{session.user.name}</b><span className="faint">{session.user.email} · {tr(`role.${session.user.role}`)} · {tr('account.startedAt').toLowerCase()} {formatDate(language, session.createdAt, { dateStyle: 'short', timeStyle: 'short' })}</span></div><div className="row"><button className="btn ghost sm" onClick={() => void api.revokeAdminSession(session.id).then(() => { setAdminSessions((rows) => rows.filter((row) => row.id !== session.id)); toast('ok', tr('account.sessionRevoked')); }).catch((e) => toast('error', String(e)))}>{tr('account.revoke')}</button><button className="btn ghost sm" onClick={() => void api.revokeUserSessions(session.userId).then(() => { setAdminSessions((rows) => rows.filter((row) => row.userId !== session.userId)); toast('ok', tr('account.revoke')); }).catch((e) => toast('error', String(e)))}>{tr('admin.revokeSessions')}</button></div></li>)}{!adminSessions.length && <li className="faint">{tr('admin.noSessions')}</li>}</ul></div>
        {newUserOpen && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setNewUserOpen(false); }}><div className="modal" role="dialog" aria-modal="true" aria-label={tr('admin.newUserTitle')}>
          <h3>{tr('admin.newUserTitle')}</h3><p className="muted small">{tr('admin.newUserHint')}</p>
          <label className="small">{tr('account.name')}<input className="field" autoFocus value={newUser.name} onChange={(e) => setNewUser((v) => ({ ...v, name: e.target.value }))} /></label>
          <label className="small">{tr('account.email')}<input className="field" type="email" value={newUser.email} onChange={(e) => setNewUser((v) => ({ ...v, email: e.target.value }))} /></label>
          <label className="small">{tr('admin.accessLevel')}<select className="field" value={newUser.role} onChange={(e) => setNewUser((v) => ({ ...v, role: e.target.value as api.PublicUser['role'] }))}><option value="MEMBER">{tr('admin.member')}</option><option value="VIEWER">{tr('admin.viewer')}</option><option value="COMMENTER">{tr('admin.commenter')}</option><option value="EDITOR">{tr('admin.editor')}</option><option value="ADMIN">{tr('admin.adminRole')}</option></select></label>
          <label className="small">{tr('account.profileColor')}<input className="field" type="color" value={newUser.color} onChange={(e) => setNewUser((v) => ({ ...v, color: e.target.value }))} /></label>
          <label className="small">{tr('admin.profilePhoto')}<input className="field" type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setNewUser((v) => ({ ...v, avatar: String(reader.result || '') })); reader.readAsDataURL(file); }} /></label>
          <div className="row modal-actions"><span className="grow"/><button className="btn" onClick={() => setNewUserOpen(false)}>{tr('actions.cancel')}</button><button className="btn primary" onClick={() => void createUser()}>{tr('admin.createUser')}</button></div>
        </div></div>}
        <AssetSourceAdmin />
        <div className="account-card">
          <div className="workspace-head">
            <b>{tr('admin.backups')}</b>
            <button className="btn primary sm" onClick={() => void api.createBackup().then((b) => { setBackups((x) => [b, ...x]); toast("ok", tr('admin.createBackup')); }).catch((e) => toast("error", String(e)))}>{tr('admin.createBackup')}</button>
          </div>
          <p className="hint">{tr('admin.backupHint')}</p>
          <ul className="resource-list">
            {backups.map((b) => <li key={b.id}><div><b>{formatDate(language, b.createdAt, { dateStyle: 'short', timeStyle: 'short' })}</b><span className="faint">{Math.ceil(b.bytes / 1024)} KB · {b.id}</span></div><button className="btn ghost sm" onClick={() => void api.restoreBackup(b.id).then(() => toast("ok", tr('admin.restoreNextBoot'))).catch((e) => toast("error", String(e)))}>{tr('admin.restoreNextBoot')}</button></li>)}
            {!backups.length && <li className="faint">{tr('admin.noBackups')}</li>}
          </ul>
        </div>
        <div className="account-card">
          <b>{tr('admin.plugins')}</b>
          {catalog?.plugins.map((p) => (
            <div className={`plugin-admin${p.enabled === false ? ' off' : ''}`} key={p.id}>
              <div className="plugin-head">
                <div className="plugin-title"><b>{p.name}</b><span className="chip-tag">{tr(`admin.pluginCategory.${p.category || 'utility'}`)}</span><span className="faint">{p.tools.length} {p.tools.length === 1 ? 'ferramenta' : 'ferramentas'}</span></div>
                <div className="row">
  <button className="btn ghost sm" onClick={() => void api.pluginDiagnostics(p.id).then((result) => { setPluginChecks((value) => ({ ...value, [p.id]: result })); toast("ok", tr('admin.pluginDiagnosticDone', { name: p.name })); }).catch((e) => toast("error", String(e)))}>{tr('admin.verifyPlugin')}</button>
  <button className="btn ghost sm" onClick={() => void api.setPluginEnabled(p.id, !p.enabled).then((state) => { setCatalog((value) => value && ({ ...value, plugins: value.plugins.map((plugin) => plugin.id === state.id ? { ...plugin, enabled: state.enabled } : plugin) })); toast('ok', state.enabled ? tr('admin.pluginEnabled') : tr('admin.pluginDisabled')); }).catch((e) => toast('error', String(e)))}>{p.enabled ? tr('admin.disablePlugin') : tr('admin.enablePlugin')}</button>
                </div>
              </div>
              <span className="faint">{p.description}</span>
              <span className="faint">v{p.version || '—'} · {tr('admin.pluginLicense')} {p.license || tr('library.notInformed')} · {tr('admin.pluginAuthor')} {p.author || '—'}{p.sourceUrl && <> · <a href={p.sourceUrl} target="_blank" rel="noreferrer">{tr('admin.source')}</a></>}</span>
              <span className="faint">{tr('admin.pluginPermissions')}: {(p.permissions || []).join(', ') || tr('admin.noPermissions')} · {tr('admin.pluginDependencies')}: {(p.dependencies || []).join(', ') || tr('admin.noDependencies')}</span>
              {pluginChecks[p.id] && <span className={pluginChecks[p.id].ok ? "faint" : "error-text"}>
                {pluginChecks[p.id].ok ? tr('admin.pluginDiagnosticOk') : tr('admin.pluginDiagnostic', { items: pluginChecks[p.id].checks.filter((check) => !check.ok).map((check) => check.label).join(", ") })}
              </span>}
              <details className="plugin-tools">
                <summary>{tr('admin.pluginTools', { count: p.tools.length })}</summary>
                <ul className="resource-list compact">
                  {p.tools.map((tool) => <li key={tool.name}><div><code>{tool.name}</code><span className="faint">{tool.description}</span></div><span className="faint">{tool.write ? tr('admin.pluginWrite') : tr('admin.pluginRead')} · {tool.needsProject ? tr('admin.pluginProject') : tr('admin.pluginGlobal')}</span></li>)}
                </ul>
              </details>
            </div>
          ))}
          <hr />
          {catalog?.providers.map((p) => (
            <div className="plugin-admin" key={p.id}>
              <b>{p.name}</b>
              <span className="faint">
                {p.kinds.map((kind) => tr(`admin.assetKinds.${kind}`)).join(", ")} ·{" "}
                {p.ready ? tr('admin.providerReady') : tr('admin.providerNeedsConfig')}
              </span>
              <span className="faint">{tr('admin.providerLicense')}: {p.licenseSummary}</span>
              <span className="faint">{p.sourceUrl && <a href={p.sourceUrl} target="_blank" rel="noreferrer">{tr('admin.source')}</a>}{p.sourceUrl && p.licenseUrl ? ' · ' : ''}{p.licenseUrl && <a href={p.licenseUrl} target="_blank" rel="noreferrer">{tr('admin.licenseText')}</a>}</span>
              {p.needsKey && <div className="row wrap provider-key">
                <input className="field" type="password" autoComplete="off" placeholder={p.hasKey ? tr('admin.providerKeyPlaceholder') : p.needsKey.label} value={providerKeys[p.id] || ''} onChange={(e) => setProviderKeys((x) => ({ ...x, [p.id]: e.target.value }))} />
                <button className="btn ghost sm" disabled={(providerKeys[p.id] || '').trim().length < 8} onClick={() => void saveProvider(p)}>{tr('admin.saveKey')}</button>
                {p.hasKey && <button className="btn ghost sm" onClick={() => void removeProvider(p)}>{tr('admin.removeKey')}</button>}
                {p.needsKey.signupUrl && <a className="btn ghost sm" href={p.needsKey.signupUrl} target="_blank" rel="noreferrer">{tr('admin.getKey')}</a>}
              </div>}
            </div>
          ))}
          <p className="hint">
            Plugin com código: registre em{" "}
            <code>packages/plugins/src/&lt;plugin&gt;/index.ts</code> e adicione
            ao catálogo embutido. Fonte de assets sem código: use{" "}
            <code>asset_source_add</code>, informando URL, campos e licença.
          </p>
        </div>
      </section>
    );
  const librarySources = [...new Set(assets.map((a) => a.source || "upload"))].sort();
  const libraryLicenses = [...new Set(assets.map((a) => a.license?.name).filter((x): x is string => !!x))].sort();
  const duplicateHashes = new Set(assets.filter((a) => a.hash && assets.some((b) => b.id !== a.id && b.hash === a.hash)).map((a) => a.hash));
  const filtered = assets.filter((a) => {
    const needle = q.trim().toLowerCase();
    const haystack = [a.name, a.mime, a.source || "", ...(a.tags || []), a.license?.name || "", a.credit || ""].join(" ").toLowerCase();
    const tags = libraryTag.trim().toLowerCase().split(/\s*,\s*/).filter(Boolean);
    return (!needle || haystack.includes(needle))
      && (libraryKind === "all" || a.kind === libraryKind)
      && (librarySource === "all" || (a.source || "upload") === librarySource)
      && (libraryLicense === "all" || a.license?.name === libraryLicense)
      && (libraryCredit === "all" || (libraryCredit === "required" ? a.license?.attribution === "required" : !a.credit && a.license?.attribution !== "required"))
      && (librarySize === "all" || (librarySize === "small" ? a.size < 1024 * 1024 : a.size >= 1024 * 1024))
      && (libraryDate === "all" || (!!a.addedAt && Date.now() - Date.parse(a.addedAt) <= 30 * 24 * 60 * 60 * 1000))
      && (libraryUsage === "all" || (libraryUsage === "orphan" ? assetUsage[a.id]?.orphan : (assetUsage[a.id]?.useCount ?? 0) > 0))
      && (!tags.length || tags.every((tag) => (a.tags || []).includes(tag)));
  });
  const advancedActive = [librarySource, libraryLicense, libraryCredit, librarySize, libraryDate, libraryUsage].filter((v) => v !== 'all').length + (libraryTag.trim() ? 1 : 0);
  const clearFilters = () => { setQ(''); setLibraryKind('all'); setLibrarySource('all'); setLibraryLicense('all'); setLibraryCredit('all'); setLibrarySize('all'); setLibraryDate('all'); setLibraryUsage('all'); setLibraryTag(''); };
  return (
    <section className="workspace-section">
      <div className="workspace-head">
        <div>
          <h1>{tr('library.title')}</h1>
          <p className="muted">{tr('library.subtitle')}</p>
        </div>
        <>
          <input
            ref={input}
            hidden
            type="file"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          <button
            className="btn primary"
            onClick={() => input.current?.click()}
          >
            {tr('library.upload')}
          </button>
        </>
      </div>
      {assets.length > 0 && <div className="workspace-metrics" aria-label={t(language, 'ui.workspace.libraryOverview')}>
        <div><strong>{assets.length}</strong><span>{t(language, 'ui.workspace.assetsCollected')}</span></div>
        <div><strong>{filtered.length}</strong><span>{t(language, 'ui.workspace.visibleNow')}</span></div>
        <div><strong>{duplicateHashes.size}</strong><span>{t(language, 'ui.workspace.duplicatesToReview')}</span></div>
      </div>}
      {/* o básico sempre à vista (busca e tipo); o resto dos filtros só para quem pede */}
      <div className="library-filters">
        <div className="search library-search"><Icon name="search" size={14} /><input className="field" placeholder={tr('library.search')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="field" aria-label={tr('library.type')} value={libraryKind} onChange={(e) => setLibraryKind(e.target.value)}>
          <option value="all">{tr('library.allTypes')}</option>
          {[...new Set(assets.map((a) => a.kind).filter(Boolean))].sort().map((kind) => <option key={kind} value={kind}>{kind}</option>)}
        </select>
        <button type="button" className={`btn ghost${moreFilters ? ' active' : ''}`} aria-expanded={moreFilters} onClick={() => setMoreFilters((v) => !v)}>
          <Icon name="sliders" size={14} /> {t(language, 'ui.workspace.moreFilters')}{advancedActive > 0 && <span className="badge">{advancedActive}</span>}
        </button>
        {selectedAssets.length > 0 && <button className="btn ghost sm" onClick={() => void api.libraryRemoveMany(selectedAssets).then(() => { setAssets((items) => items.filter((item) => !selectedAssets.includes(item.id))); setSelectedAssets([]); toast('ok', `${selectedAssets.length} ${tr('library.removeSelected').toLowerCase()}.`); }).catch((e) => toast('error', String(e)))}>{tr('library.removeSelected')} ({selectedAssets.length})</button>}
      </div>
      {moreFilters && <div className="library-filters more">
        <select className="field" aria-label={tr('library.source')} value={librarySource} onChange={(e) => setLibrarySource(e.target.value)}>
          <option value="all">{tr('library.allSources')}</option>
          {librarySources.map((source) => <option key={source} value={source}>{source}</option>)}
        </select>
        <select className="field" aria-label={tr('library.license')} value={libraryLicense} onChange={(e) => setLibraryLicense(e.target.value)}>
          <option value="all">{tr('library.allLicenses')}</option>
          {libraryLicenses.map((license) => <option key={license} value={license}>{license}</option>)}
        </select>
        <select className="field" aria-label={tr('library.credit')} value={libraryCredit} onChange={(e) => setLibraryCredit(e.target.value as typeof libraryCredit)}>
          <option value="all">{tr('library.anyCredit')}</option>
          <option value="required">{tr('library.requiredCredit')}</option>
          <option value="missing">{tr('library.missingCredit')}</option>
        </select>
        <select className="field" aria-label={tr('library.size')} value={librarySize} onChange={(e) => setLibrarySize(e.target.value as typeof librarySize)}><option value="all">{tr('library.anySize')}</option><option value="small">{tr('library.small')}</option><option value="large">{tr('library.large')}</option></select>
        <select className="field" aria-label={tr('library.date')} value={libraryDate} onChange={(e) => setLibraryDate(e.target.value as typeof libraryDate)}><option value="all">{tr('library.anyDate')}</option><option value="recent">{tr('library.recent')}</option></select>
        <select className="field" aria-label={tr('library.usage')} value={libraryUsage} onChange={(e) => setLibraryUsage(e.target.value as typeof libraryUsage)}><option value="all">{tr('library.anyUsage')}</option><option value="used">{tr('library.used')}</option><option value="orphan">{tr('library.orphan')}</option></select>
        <input className="field" placeholder={tr('library.tags')} value={libraryTag} onChange={(e) => setLibraryTag(e.target.value)} />
        {advancedActive > 0 && <button type="button" className="btn ghost sm" onClick={clearFilters}>{t(language, 'ui.workspace.clearFilters')}</button>}
      </div>}
      {loading ? (
        <div className="workspace-loading" aria-live="polite"><span /><span /><span /></div>
      ) : !assets.length ? (
        // biblioteca vazia: explica para que serve e aceita arquivos arrastados
        <button type="button" className={`library-empty${dragging ? ' dragging' : ''}`} onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files?.[0]); }}>
          <span className="library-empty-art" aria-hidden="true"><i /><i /><i /><Icon name="upload" size={20} /></span>
          <b>{t(language, 'ui.workspace.libraryEmptyTitle')}</b>
          <span className="muted">{t(language, 'ui.workspace.libraryEmptyHint')}</span>
        </button>
      ) : (
        <ul className="resource-list">
          {filtered.map((a) => (
            <li key={a.id}>
              <input type="checkbox" aria-label={`${tr('library.select')} ${a.name}`} checked={selectedAssets.includes(a.id)} onChange={(e) => setSelectedAssets((items) => e.target.checked ? [...new Set([...items, a.id])] : items.filter((id) => id !== a.id))} />
              {editingAsset === a.id ? <div className="grow">
                 <div className="row wrap"><input className="field" aria-label={tr('library.assetName')} value={assetDraft.name} onChange={(e) => setAssetDraft((v) => ({ ...v, name: e.target.value }))} /><input className="field" aria-label={tr('library.assetLicense')} value={assetDraft.license} onChange={(e) => setAssetDraft((v) => ({ ...v, license: e.target.value }))} /><select className="field" aria-label={tr('library.commercial')} value={assetDraft.commercial ? 'yes' : 'no'} onChange={(e) => setAssetDraft((v) => ({ ...v, commercial: e.target.value === 'yes' }))}><option value="yes">{tr('library.commercial')}: {tr('library.yes')}</option><option value="no">{tr('library.commercial')}: {tr('library.no')}</option></select><select className="field" aria-label={tr('library.attribution')} value={assetDraft.attribution} onChange={(e) => setAssetDraft((v) => ({ ...v, attribution: e.target.value as typeof v.attribution }))}><option value="none">{tr('library.noRequiredCredit')}</option><option value="optional">{tr('library.recommendedCredit')}</option><option value="required">{tr('library.requiredAttribution')}</option></select><input className="field" aria-label={tr('library.creditLabel')} placeholder={tr('library.creditOptional')} value={assetDraft.credit} onChange={(e) => setAssetDraft((v) => ({ ...v, credit: e.target.value }))} /><input className="field" aria-label={tr('library.tags')} placeholder={tr('library.tagsHint')} value={assetDraft.tags} onChange={(e) => setAssetDraft((v) => ({ ...v, tags: e.target.value }))} /></div>
                 <div className="row"><button className="btn primary sm" onClick={() => void saveAsset(a)}>{tr('library.save')}</button><button className="btn ghost sm" onClick={() => setEditingAsset(null)}>{tr('library.cancel')}</button></div>
              </div> : <>
              <span className="asset-thumb" aria-hidden="true">{(a.mime || '').startsWith('image/') ? <img src={`/api/library/${encodeURIComponent(a.id)}/file`} alt="" loading="lazy" /> : <Icon name={a.kind === 'font' ? 'fonttype' : 'file'} size={18} />}</span>
              <div className="grow">
                <b>{a.name}</b>
                <span className="faint">
                  {a.mime} · {Math.ceil(a.size / 1024)} KB · {tr('library.origin')}:{" "}
                  {a.sourceUrl ? <a href={a.sourceUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{a.source || (t(language, 'ui.workspace.external'))}</a> : (a.source || (t(language, 'ui.workspace.upload')))}
                </span>
                <span className="faint">
                  {tr('library.capture')}: {a.capturedAt ? formatDate(language, a.capturedAt) : tr('library.notInformed')} · {tr('library.licenseLabel')}: {a.license?.url ? <a href={a.license.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{a.license.name}</a> : (a.license?.name || tr('library.accountLicense'))}
                  {a.license?.attribution === "required" ? ` · ${tr('library.requiredAttribution')}` : ""}
                  {a.credit ? ` · ${tr('library.creditLabel')}: ${a.credit}` : ""}
                </span>
                <span className="faint" title={(assetUsage[a.id]?.projects || []).map((project) => project.file).join(', ')}>{tr('library.usageLabel')}: {assetUsage[a.id]?.useCount ?? 0} {tr('library.projectCount')}{assetUsage[a.id]?.orphan ? ` · ${tr('library.orphanLabel')}` : assetUsage[a.id]?.projects?.length ? ` · ${(assetUsage[a.id]?.projects || []).map((project) => project.name).join(', ')}` : ''}{a.hash && duplicateHashes.has(a.hash) ? ` · ${tr('library.duplicate')}` : ''}</span>
              </div></>}
              <div className="row">
                <a className="btn ghost sm" href={`/api/library/${encodeURIComponent(a.id)}/file`} download={a.name}>{tr('library.download')}</a>
                <label className="btn ghost sm">{tr('library.replace')}<input hidden type="file" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; void api.libraryReplace(a.id, file).then((updated) => { setAssets((items) => items.map((item) => item.id === updated.id ? updated : item)); toast('ok', tr('library.assetReplaced')); }).catch((e) => toast('error', String(e))); e.currentTarget.value = ''; }} /></label>
                <button className="btn ghost sm" onClick={() => void editAsset(a)}>{tr('library.editMetadata')}</button>
                <button className="btn ghost sm" onClick={() => void api.libraryRemove(a.id).then(() => setAssets((x) => x.filter((v) => v.id !== a.id))).catch((e) => toast("error", String(e)))}>{tr('library.remove')}</button>
              </div>
            </li>
          ))}
          {assets.length > 0 && !filtered.length && (
            <li className="muted">{tr('library.notFound')} <button type="button" className="btn ghost sm" onClick={clearFilters}>{t(language, 'ui.workspace.clearFilters')}</button></li>
          )}
        </ul>
      )}
    </section>
  );
}

// Atalhos para as seções de uma página longa (Administração): lê o título de cada cartão e rola até ele.
function SectionNav({ label }: { label: string }) {
  const nav = useRef<HTMLElement>(null);
  const [items, setItems] = useState<Array<{ id: string; title: string }>>([]);
  useEffect(() => {
    const section = nav.current?.closest('.workspace-section');
    if (!section) return;
    const cards = [...section.querySelectorAll<HTMLElement>(':scope > .account-card')];
    setItems(cards.flatMap((card, i) => {
      const title = card.querySelector(':scope > b, :scope > .workspace-head > b')?.textContent?.trim();
      if (!title) return [];
      card.id ||= `secao-${i}`;
      return [{ id: card.id, title }];
    }));
  }, []);
  return <nav ref={nav} className="section-nav" aria-label={label}>{items.map((item) => <button key={item.id} type="button" onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{item.title}</button>)}</nav>;
}

function McpGuide({ newToken }: { newToken: string | null }) {
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
    ? (format === 'command' ? (t(language, 'ui.workspace.pasteThisIntoTheTerminal')) : (t(language, 'ui.workspace.useThisJsonInClaude')))
    : client === 'Codex'
      ? (t(language, 'ui.workspace.addThisMcpServerIn'))
      : client === 'Cursor' || client === 'Windsurf' || client === 'OpenCode'
        ? t(language, 'ui.workspace.pasteJsonInto', { client })
        : (t(language, 'ui.workspace.useTheUrlAndAuthorization'));
  const test = async () => {
    setTestState('testing'); setTestMessage(tr('agents.testing'));
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'stylo-guide', version: '1' } } }) });
      const body = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
      setTestState('ok'); setTestMessage(tr('agents.responding'));
    } catch (error) { setTestState('error'); setTestMessage(error instanceof Error ? error.message : String(error)); }
  };
  return <div className="account-card connection-guide">
    <div className="connection-hero"><div><h3>{t(language, 'ui.workspace.connectYourCreativeCoPilot')}</h3><p className="muted small">{t(language, 'ui.workspace.chooseAToolAuthorizeAccess')}</p></div><span className="connection-orb"><Icon name="spark" size={22} /></span></div>
    <div className="connection-steps"><div><strong>01</strong><b>{t(language, 'ui.workspace.choose')}</b><span>{t(language, 'ui.workspace.yourAiTool')}</span></div><div><strong>02</strong><b>{t(language, 'ui.workspace.authorize')}</b><span>{t(language, 'ui.workspace.yourProject')}</span></div><div><strong>03</strong><b>{t(language, 'ui.workspace.create')}</b><span>{t(language, 'ui.workspace.sideBySide')}</span></div></div>
    <details className="connection-details"><summary>{t(language, 'ui.workspace.openConnectionSetup')}</summary><div className="connection-details-body"><div className="workspace-head"><b>{tr('agents.connectionGuide')}</b><div className="row"><select className="field" aria-label={tr('agents.client')} value={client} onChange={(e) => { setClient(e.target.value); setFormat(e.target.value === 'Claude Code' ? 'command' : 'json'); }}><option>Claude Code</option><option>Claude Desktop</option><option>Codex</option><option>Cursor</option><option>Windsurf</option><option>OpenCode</option><option>Quine</option><option>OpenCog</option><option>{t(language, 'ui.workspace.genericMcpClient')}</option></select><select className="field" aria-label={tr('agents.configFormat')} value={client === 'Claude Code' ? format : 'json'} onChange={(e) => setFormat(e.target.value as 'command' | 'json')}><option value="command" disabled={client !== 'Claude Code'}>{tr('agents.command')}</option><option value="json">JSON</option></select></div></div><label className="small">{tr('agents.bearerToken')}<input className="field" placeholder={tr('agents.tokenPlaceholder')} value={token} onChange={(e) => { setToken(e.target.value); setTestState('idle'); }} /></label><p className="hint">{tr('agents.endpoint')}: <code>{endpoint}</code> · {tr('agents.transport')}. {hint} {tr('agents.tokenRecovery')}</p>{!token.trim() && <p className="hint">{tr('agents.createFirst')}</p>}{newToken && <p className="success">{tr('agents.tokenLoaded')}</p>}<div className="codebox"><pre className="code">{value}</pre><div className="row"><button className="btn ghost sm" onClick={() => void navigator.clipboard.writeText(value).then(() => toast('ok', tr('agents.guideCopied')))}>{tr('actions.copy')}</button><button className="btn ghost sm" disabled={testState === 'testing' || !token.trim()} onClick={() => void test()}>{tr('agents.testConnection')}</button></div></div>{testMessage && <p className={testState === 'ok' ? 'success' : testState === 'error' ? 'error' : 'hint'}>{testMessage}</p>}</div></details>
  </div>;
}

function AssetSourceAdmin() {
  type Source = { id?: string; name: string; searchUrl: string; kinds: string[]; resultsPath: string; fields: { id: string; title: string; preview?: string; download: string; author?: string; page?: string; license?: string }; headers?: Record<string, string>; license: { name: string; url?: string; commercial: boolean; attribution: string } };
  const language = useApp((s) => s.language);
  const tr = (key: string) => t(language, key);
  const [sources, setSources] = useState<Source[]>([]);
  const [form, setForm] = useState({ name: '', searchUrl: 'https://exemplo.test/search?q={consulta}&page={pagina}', kinds: ['image'], resultsPath: 'results', id: 'id', title: 'title', preview: 'preview_url', download: 'download_url', author: 'author', page: 'url', itemLicense: 'license', license: 'CC0', licenseUrl: '', commercial: true, attribution: 'optional' as 'required' | 'optional' | 'none', headers: '' });
  useEffect(() => { void api.assetSources().then((x) => setSources(x.sources as typeof sources)).catch(() => setSources([])); }, []);
  const add = async () => {
    try {
      let headers: Record<string, string> | undefined;
      if (form.headers.trim()) headers = JSON.parse(form.headers);
      const source = { name: form.name.trim(), searchUrl: form.searchUrl.trim(), kinds: form.kinds, resultsPath: form.resultsPath.trim(), fields: { id: form.id.trim(), title: form.title.trim(), preview: form.preview.trim() || undefined, download: form.download.trim(), author: form.author.trim() || undefined, page: form.page.trim() || undefined, license: form.itemLicense.trim() || undefined }, headers, license: { name: form.license.trim(), url: form.licenseUrl.trim() || undefined, commercial: form.commercial, attribution: form.attribution } };
      const saved = await api.addAssetSource(source) as Source;
      setSources((x) => [...x.filter((v) => v.name !== saved.name), saved]);
      setForm((x) => ({ ...x, name: '', headers: '' }));
      toast('ok', tr('admin.sourceSaved'));
    } catch (e) { toast('error', e instanceof SyntaxError ? tr('admin.sourceHeadersError') : String(e)); }
  };
  const remove = async (sourceName: string) => { try { await api.removeAssetSource(sourceName); setSources((x) => x.filter((v) => v.name !== sourceName)); toast('ok', tr('admin.sourceRemoved')); } catch (e) { toast('error', String(e)); } };
  const set = (key: keyof typeof form, value: string | boolean) => setForm((x) => ({ ...x, [key]: value }));
  const kinds = ['image', 'video', 'audio', 'model3d', 'lottie', 'font', 'icon'];
  return <div className="account-card"><b>{tr('admin.sourceTitle')}</b><p className="hint">{tr('admin.sourceHint')}</p>
    <div className="row wrap"><input className="field" autoComplete="off" placeholder={tr('admin.sourceName')} aria-label={tr('admin.sourceName')} value={form.name} onChange={(e) => set('name', e.target.value)} /><input className="field grow" autoComplete="url" inputMode="url" placeholder={tr('admin.sourceSearchUrl')} aria-label={tr('admin.sourceSearchUrlLabel')} value={form.searchUrl} onChange={(e) => set('searchUrl', e.target.value)} /><input className="field" autoComplete="off" placeholder="results.items" aria-label={tr('admin.sourceResultsPath')} value={form.resultsPath} onChange={(e) => set('resultsPath', e.target.value)} /></div>
    <div className="row wrap small">{kinds.map((kind) => <label key={kind}><input type="checkbox" checked={form.kinds.includes(kind)} onChange={(e) => setForm((x) => ({ ...x, kinds: e.target.checked ? [...x.kinds, kind] : x.kinds.filter((v) => v !== kind) }))} /> {kind}</label>)}</div>
    <details className="plugin-tools"><summary>{tr('admin.sourceMapping')}</summary><div className="row wrap"><input className="field" placeholder="id" aria-label={tr('admin.sourceFieldId')} value={form.id} onChange={(e) => set('id', e.target.value)} /><input className="field" placeholder="title" aria-label={tr('admin.sourceFieldTitle')} value={form.title} onChange={(e) => set('title', e.target.value)} /><input className="field" placeholder="download_url" aria-label={tr('admin.sourceFieldDownload')} value={form.download} onChange={(e) => set('download', e.target.value)} /><input className="field" placeholder="preview_url" aria-label={tr('admin.sourceFieldPreview')} value={form.preview} onChange={(e) => set('preview', e.target.value)} /><input className="field" placeholder="author" aria-label={tr('admin.sourceFieldAuthor')} value={form.author} onChange={(e) => set('author', e.target.value)} /><input className="field" placeholder="url" aria-label={tr('admin.sourceFieldPage')} value={form.page} onChange={(e) => set('page', e.target.value)} /><input className="field" placeholder="license" aria-label={tr('admin.sourceFieldLicense')} value={form.itemLicense} onChange={(e) => set('itemLicense', e.target.value)} /><input className="field grow" placeholder='{"Authorization":"Bearer ..."}' aria-label={tr('admin.sourceHeaders')} value={form.headers} onChange={(e) => set('headers', e.target.value)} /></div></details>
    <div className="row wrap"><input className="field" autoComplete="off" placeholder={tr('admin.sourceLicense')} aria-label={tr('admin.sourceLicenseLabel')} value={form.license} onChange={(e) => set('license', e.target.value)} /><input className="field" autoComplete="url" inputMode="url" placeholder={tr('admin.sourceLicenseUrl')} aria-label={tr('admin.sourceLicenseUrl')} value={form.licenseUrl} onChange={(e) => set('licenseUrl', e.target.value)} /><select className="field" aria-label={tr('admin.sourceAttribution')} value={form.attribution} onChange={(e) => set('attribution', e.target.value)}><option value="none">{tr('admin.sourceNone')}</option><option value="optional">{tr('admin.sourceOptional')}</option><option value="required">{tr('admin.sourceRequired')}</option></select><label className="small"><input type="checkbox" checked={form.commercial} onChange={(e) => set('commercial', e.target.checked)} /> {tr('admin.sourceCommercial')}</label><button className="btn primary sm" disabled={!form.name.trim() || !form.kinds.length} onClick={() => void add()}>{tr('admin.sourceAdd')}</button></div>
    <ul className="resource-list">{sources.map((s) => <li key={s.name}><div><b>{s.name}</b><span className="faint">{s.kinds.map((kind) => tr(`admin.assetKinds.${kind}`)).join(', ')} · {s.searchUrl} · {tr('admin.sourceLicenseShort')} {s.license.name}{s.license.commercial ? ` · ${tr('admin.sourceCommercialShort')}` : ''}</span></div><button className="btn ghost sm" onClick={() => void remove(s.name)}>{tr('admin.sourceRemove')}</button></li>)}{!sources.length && <li className="faint">{tr('admin.sourceEmpty')}</li>}</ul></div>;
}
