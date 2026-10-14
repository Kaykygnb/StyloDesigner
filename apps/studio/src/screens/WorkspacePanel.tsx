import { useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import { toast, useApp } from "../lib/app";
import { formatDate, t } from '../lib/i18n';
import { LibraryArea } from './workspace/LibraryArea';
import { AgentsArea } from './workspace/AgentsArea';
import { AccountArea } from './workspace/AccountArea';

type Tab = "library" | "agents" | "admin" | "account";

export function WorkspacePanel({ tab }: { tab: Tab }) {
  if (tab === "library") return <LibraryArea />;
  if (tab === "agents") return <AgentsArea />;
  if (tab === "account") return <AccountArea />;
  return <AdminArea />;
}

function AdminArea() {
  const user = useApp((s) => s.user);
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const [users, setUsers] = useState<api.PublicUser[]>([]);
  const [policy, setPolicy] = useState("closed");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null,
  );
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'MEMBER' as api.PublicUser['role'], color: '#6d5dfc', avatar: '' });
  const [editUserDraft, setEditUserDraft] = useState<(api.PublicUser & { avatar: string }) | null>(null);
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
  const [userQ, setUserQ] = useState("");
  const [userStatus, setUserStatus] = useState<"all" | "active" | "suspended">("all");
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({});
  const [userProjects, setUserProjects] = useState<Record<string, Array<api.ProjectInfo & { id: string; role: string }>>>({});

  useEffect(() => {
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
      .catch((e) => toast("error", String(e)));
  }, []);

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
