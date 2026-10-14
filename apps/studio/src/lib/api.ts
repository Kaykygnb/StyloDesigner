// Conversa com o servidor. Toda mudança no projeto é uma chamada de FERRAMENTA (as mesmas do MCP): não há outro caminho.
import { tl } from './i18n';
import type { AuthState, Presence, ProjectInfo, Snapshot, PublicUser } from './types';
export type { ProjectInfo } from './types';
export type { PublicUser } from './types';

export class ToolError extends Error {}

/** Identifica esta aba no servidor (o workspace guarda o projeto aberto por sessão). Dura enquanto a aba existir. */
function makeSid(): string {
  const fresh = () => 'web-' + Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
  try {
    const saved = sessionStorage.getItem('stylo.sid');
    if (saved) return saved;
    const v = fresh();
    sessionStorage.setItem('stylo.sid', v);
    return v;
  } catch { return fresh(); }
}
export const sid = makeSid();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = String(init?.method || 'GET').toUpperCase();
  const retryable = method === 'GET' || method === 'HEAD';
  let lastError: unknown;
  for (let attempt = 0; attempt < (retryable ? 3 : 1); attempt++) {
    try {
      const res = await fetch(path, init);
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data as T;
      const transient = res.status === 408 || res.status === 425 || res.status === 429 || res.status >= 500;
      if (!retryable || !transient || attempt === 2) throw new ToolError((data as { error?: string }).error || `O servidor respondeu ${res.status}.`);
      lastError = new ToolError((data as { error?: string }).error || `O servidor respondeu ${res.status}.`);
    } catch (error) {
      lastError = error;
      if (!retryable || attempt === 2 || (error instanceof ToolError && !/servidor respondeu (408|425|429|5\d\d)/.test(error.message))) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new ToolError(tl('api.unreachable'));
}

const json = (body: unknown, method = 'POST'): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/** Chama uma ferramenta do MCP em nome da pessoa. Erro de ferramenta vira exceção com a mensagem explicando o conserto. */
export async function tool<T = any>(name: string, args: Record<string, unknown> = {}, pageId?: string): Promise<T> {
  const out = await request<any>('/api/studio/call', json({ sid, tool: name, args, pageId }));
  if (out?.error) throw new ToolError(out.error);
  if (out?.refused) throw new ToolError(typeof out.refused === 'string' ? out.refused : 'A ferramenta recusou o pedido.');
  return out as T;
}

/** O projeto aberto nesta sessão (null se nenhum). */
export async function snapshot(): Promise<Snapshot | null> {
  const res = await fetch(`/api/studio/doc?sid=${sid}`);
  if (!res.ok) throw new ToolError(((await res.json().catch(() => ({}))) as { error?: string }).error || `O servidor respondeu ${res.status}.`);
  return (await res.json()) as Snapshot | null;
}


export const authState = () => request<AuthState>('/api/auth/state');
export const projectsList = () => request<ProjectInfo[]>('/api/projects');
export const importProject = (name: string, doc: unknown) => request<{ file: string; projectId: string }>('/api/projects/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, doc }) });
export const login = (email: string, password: string) => request<unknown>('/api/auth/login', json({ email, password }));
export const setup = (email: string, name: string, password: string) => request<unknown>('/api/auth/setup', json({ email, name, password }));
export const logout = () => request<unknown>('/api/auth/logout', json({}));
export const updateMe = (body: { name?: string; email?: string; color?: string; avatar?: string | null; preferences?: PublicUser['preferences'] }) => request<PublicUser>('/api/me', { ...json(body), method: 'PUT' });
export const sessionsList = () => request<Array<{ id: string; createdAt: string; expiresAt: string; current: boolean }>>('/api/me/sessions');
export const adminSessionsList = () => request<Array<{ id: string; userId: string; user: { name: string; email: string; role: string }; createdAt: string; expiresAt: string }>>('/api/sessions');
export const revokeAdminSession = (id: string) => request<{ ok: true; revoked: boolean }>(`/api/sessions/${encodeURIComponent(id)}`, json({}, 'DELETE'));
export const authEvents = () => request<Array<{ id: string; email: string; kind: string; createdAt: string }>>('/api/me/auth-events?limit=50');
export const accountExport = () => request<Record<string, unknown>>('/api/me/export');
export const systemHealth = () => request<{ ok: boolean; checkedAt: string; database: { ok: boolean; engine: string; schemaVersion?: number; error?: string }; counts?: { users: number; projects: number }; transport: { port: number; editors: number; mcp: boolean } }>('/api/health');
export const adminActivity = () => request<Array<{ id: string; at: string; project: { id: string; slug: string; name: string }; user: { id: string; name: string; email: string } | null; agent: { id: string; name: string } | null; actorType: string; tool: string; summary: string; ok: boolean; layerIds: string[] }>>('/api/admin/activity?limit=200');
export const connectionsList = () => request<Array<{ id: string; personId: string; name: string; connectedAt: string }>>('/api/connections');
export const closeConnection = (id: string) => request<{ ok: true }>(`/api/connections/${encodeURIComponent(id)}`, json({}, 'DELETE'));
export const revokeSession = (id: string) => request<unknown>(`/api/me/sessions/${encodeURIComponent(id)}`, json({}, 'DELETE'));
export const revokeAllSessions = () => request<{ count: number }>('/api/me/sessions/revoke-all', json({}));
export const changePassword = (current: string, next: string) => request<unknown>('/api/me/password', json({ current, next }));
export const libraryList = (q = '') => request<{ assets: LibraryAsset[]; usage: { bytes: number; count: number } }>('/api/library' + (q ? `?q=${encodeURIComponent(q)}` : ''));
/** O servidor devolve { asset, existed } (existed = o mesmo conteúdo já estava na biblioteca). */
export const libraryUpload = (file: File) => request<{ asset: LibraryAsset; existed: boolean }>('/api/library', { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Name': encodeURIComponent(file.name) }, body: file });
export const libraryRemove = (id: string) => request<unknown>(`/api/library/${encodeURIComponent(id)}`, json({}, 'DELETE'));
export const libraryRemoveMany = (ids: string[]) => request<{ removed: LibraryAsset[]; count: number }>('/api/library', json({ ids }, 'DELETE'));
export const libraryUsageDetail = () => request<{ assets: Array<{ assetId: string; useCount: number; projectIds: string[]; projects: Array<{ id: string; file: string; name: string }>; orphan: boolean }> }>('/api/library/usage-detail');
export const libraryUpdate = (id: string, body: unknown) => request<LibraryAsset>(`/api/library/${encodeURIComponent(id)}`, { ...json(body), method: 'PUT' });
export const libraryReplace = (id: string, file: File) => request<LibraryAsset>(`/api/library/${encodeURIComponent(id)}/replace`, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Name': encodeURIComponent(file.name) }, body: file });
export const agentsList = () => request<AgentInfo[]>('/api/agents');
export const usersList = () => request<PublicUser[]>('/api/users');
export const createUser = (body: { email: string; name: string; role?: PublicUser['role']; color?: string; avatar?: string | null }) => request<{ user: PublicUser; temporaryPassword?: string }>('/api/users', json(body));
export const updateUser = (id: string, body: { name?: string; email?: string; color?: string | null; avatar?: string | null; role?: PublicUser['role'] }) => request<PublicUser>(`/api/users/${encodeURIComponent(id)}`, { ...json(body), method: 'PUT' });
export const resetUserPassword = (id: string) => request<{ temporaryPassword: string }>(`/api/users/${encodeURIComponent(id)}/reset-password`, json({}));
export const revokeUserSessions = (id: string) => request<unknown>(`/api/users/${encodeURIComponent(id)}/revoke-sessions`, json({}));
export const setUserSuspended = (id: string, suspended: boolean) => request<PublicUser>(`/api/users/${encodeURIComponent(id)}/suspend`, json({ suspended }));
export const deleteUser = (id: string) => request<unknown>(`/api/users/${encodeURIComponent(id)}`, json({}, 'DELETE'));
export const userProjects = (id: string) => request<Array<ProjectInfo & { id: string; role: string }>>(`/api/users/${encodeURIComponent(id)}/projects`);
export const revokeUserProject = (userId: string, projectId: string) => request<unknown>(`/api/users/${encodeURIComponent(userId)}/projects/${encodeURIComponent(projectId)}`, json({}, 'DELETE'));
export const createAgent = (name: string, scopes: string[] = ['read', 'comment', 'write', 'export'], type = 'mcp') => request<{ agent: { id: string; name: string; type?: string; status: string; scopes: string[] }; token: string }>('/api/agents', json({ name, type, scopes }));
export const approveAgent = (id: string) => request<unknown>(`/api/agents/${encodeURIComponent(id)}/approve`, json({}));
export const revokeAgent = (id: string) => request<unknown>(`/api/agents/${encodeURIComponent(id)}/revoke`, json({}));
export const rotateAgent = (id: string) => request<{ agent: AgentInfo; token: string }>(`/api/agents/${encodeURIComponent(id)}/rotate`, json({}));
export const updateAgent = (id: string, scopes: string[]) => request<unknown>(`/api/agents/${encodeURIComponent(id)}`, { ...json({ scopes }), method: 'PUT' });
export const agentActivity = (id: string) => request<Array<{ id: string; at: string; project: string; tool: string; summary: string; ok: boolean; layerIds: string[] }>>(`/api/agents/${encodeURIComponent(id)}/activity?limit=50`);
export const grantAgentProject = (id: string, file: string) => request<unknown>(`/api/agents/${encodeURIComponent(id)}/projects`, json({ file }));
export const agentProjects = (id: string) => request<Array<{ projectId: string; project: { id: string; slug: string; name: string; updatedAt: string } }>>(`/api/agents/${encodeURIComponent(id)}/projects`);
export const revokeAgentProject = (id: string, projectId: string) => request<unknown>(`/api/agents/${encodeURIComponent(id)}/projects/${encodeURIComponent(projectId)}`, json({}, 'DELETE'));
export const projectActivity = (file: string, filters: { agent?: string; user?: string; tool?: string; actor?: 'USER' | 'AGENT' } = {}) => request<Array<{ id: number; at: string; who: string; tool: string; summary: string; ok: boolean }>>(`/api/projects/${encodeURIComponent(file)}/activity?limit=50${filters.agent ? `&agent=${encodeURIComponent(filters.agent)}` : ''}${filters.user ? `&user=${encodeURIComponent(filters.user)}` : ''}${filters.tool ? `&tool=${encodeURIComponent(filters.tool)}` : ''}${filters.actor ? `&actor=${filters.actor}` : ''}`);
export const projectVersions = (file: string) => request<Array<{ id: string; modified: number; size: number; label?: string | null; revision?: number }>>(`/api/projects/${encodeURIComponent(file)}/versions`);
export const labelProjectVersion = (file: string, id: string, label: string | null) => request<unknown>(`/api/projects/${encodeURIComponent(file)}/versions/${encodeURIComponent(id)}`, { ...json({ label }), method: 'PUT' });
export const compareProjectVersions = (file: string, left: string, right: string) => request<{ same: boolean; changed: string[] }>(`/api/projects/${encodeURIComponent(file)}/versions/compare?left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}`);
export const duplicateProjectVersion = (file: string, id: string, title: string) => request<{ file: string; projectId: string }>(`/api/projects/${encodeURIComponent(file)}/versions/${encodeURIComponent(id)}/duplicate`, json({ title }));
export const restoreProjectVersion = (file: string, id: string) => request<unknown>(`/api/projects/${encodeURIComponent(file)}/versions/${encodeURIComponent(id)}/restore`, json({}));
export const restoreProject = (file: string, version: string) => request<unknown>(`/api/projects/${encodeURIComponent(file)}/restore`, json({ version }));
export const publishProject = (file: string, format: 'html' | 'react', label?: string) => request<{ ok: true; id: string; version?: { id: string | null; label: string | null; revision?: number }; format: string; bytes: number | null; label?: string | null; download: string; warnings: string[]; audit?: { errors: number; warnings: number; truncated: boolean }; status?: string }>(`/api/projects/${encodeURIComponent(file)}/publish`, json({ format, ...(label?.trim() ? { label: label.trim() } : {}) }));
export const projectPublishing = (file: string) => request<Array<{ id: string; format: string; status: string; createdAt: string; warnings?: string[]; download?: string; label?: string | null }>>(`/api/projects/${encodeURIComponent(file)}/publishing`);
export const projectPresence = (file: string) => request<{ projectId: string; people: Array<{ id: string; name: string; color?: string }>; agents: AgentInfo[]; locks: string[]; activity: unknown[] }>(`/api/projects/${encodeURIComponent(file)}/presence`);
export const backupsList = () => request<Array<{ id: string; createdAt: string; bytes: number }>>('/api/backups');
export const createBackup = () => request<{ id: string; createdAt: string; bytes: number }>('/api/backups', json({}));
export const restoreBackup = (id: string) => request<{ ok: true; restartRequired: true; id: string }>(`/api/backups/${encodeURIComponent(id)}/restore`, json({}));
export const agentConfig = () => request<{ mcpUrl: string; pexels: boolean; pexelsSource: string; agentPolicy?: string }>('/api/agent/config');
export const pluginsCatalog = () => request<{ plugins: PluginInfo[]; providers: ProviderInfo[]; registration: { trustedCode: string; declarativeAssets: string } }>('/api/plugins/catalog');
export const setPluginEnabled = (id: string, enabled: boolean) => request<{ id: string; enabled: boolean }>(`/api/plugins/${encodeURIComponent(id)}`, json({ enabled }, 'PUT'));
export const pluginDiagnostics = (id: string) => request<{ pluginId: string; ok: boolean; checkedAt: string; checks: Array<{ id: string; label: string; ok: boolean }>; missingDependencies: string[]; invalidTools: string[]; duplicateTools: string[] }>(`/api/plugins/${encodeURIComponent(id)}/diagnostics`);
export const saveProviderKey = (id: string, key: string) => request<{ ok: true; provider: string; hasKey: true }>(`/api/providers/${encodeURIComponent(id)}/key`, json({ key }));
export const removeProviderKey = (id: string) => request<unknown>(`/api/providers/${encodeURIComponent(id)}/key`, json({}, 'DELETE'));
export const assetSources = () => request<{ sources: unknown[] }>('/api/asset-sources');
export const addAssetSource = (source: unknown) => request<unknown>('/api/asset-sources', json(source));
export const removeAssetSource = (name: string) => request<unknown>(`/api/asset-sources/${encodeURIComponent(name)}`, json({}, 'DELETE'));
export const assetSearch = (kind: string, query: string, provider?: string) => request<{ results: Array<{ title: string; preview_url?: string; provider: string; license: { name: string; url?: string }; credit: string; extra?: Record<string, unknown> }>; hasMore: boolean; skipped: Array<{ provider: string; reason: string }> }>(`/api/assets/search?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(query)}${provider ? `&provider=${encodeURIComponent(provider)}` : ''}`);
export const updateAgentConfig = (body: { agentPolicy?: 'open' | 'approval' | 'closed'; pexelsKey?: string }) => request<unknown>('/api/agent/config', json(body));

export interface LibraryAsset { id: string; kind?: string; name: string; mime: string; size: number; hash?: string; tags?: string[]; source?: string; sourceUrl?: string | null; license?: { name: string; url?: string; commercial: boolean; attribution: string } | null; credit?: string | null; capturedAt?: string | null; addedAt?: string; createdAt?: string }
export interface AgentInfo { id: string; name: string; type?: string; status: string; scopes: string[]; ownerId?: string; ownerName?: string; lastProject?: { id: string; slug: string; name: string; updatedAt: string } | null; lastSeenAt?: string | null; createdAt?: string }
export interface AgentActivity { id: string; at: string; project: string; tool: string; summary: string; ok: boolean; layerIds: string[] }
export interface PluginInfo { id: string; name: string; description: string; category?: 'design' | 'quality' | 'asset-provider' | 'exporter' | 'integration' | 'utility'; sourceUrl?: string | null; version?: string; author?: string; license?: string; repository?: string | null; permissions?: string[]; dependencies?: string[]; exportCompatibility?: string[]; enabled: boolean; tools: { name: string; description: string; write: boolean; needsProject: boolean }[] }
export interface ProviderInfo { id: string; name: string; kinds: string[]; custom: boolean; ready: boolean; sourceUrl?: string; licenseUrl?: string; needsKey?: { label: string; envVar?: string; signupUrl?: string } | null; hasKey: boolean; unverified: boolean; licenseSummary: string }

export interface LiveHandlers { onPresence: (p: Presence) => void; onProject: (e: { file?: string; by?: string }) => void; onState: (connected: boolean) => void }

/** Avisos ao vivo do servidor: quem está aqui e "o projeto mudou" (outro agente ou aba gravou). */
export function connectLive(name: string, h: LiveHandlers, file?: string | null): () => void {
  const query = `id=${encodeURIComponent(sid)}&user=${encodeURIComponent(name)}${file ? `&file=${encodeURIComponent(file)}` : ''}`;
  const source = new EventSource(`/api/agent/events?${query}`);
  source.addEventListener('presence', (e) => h.onPresence(JSON.parse((e as MessageEvent).data)));
  source.addEventListener('project', (e) => h.onProject(JSON.parse((e as MessageEvent).data)));
  source.onopen = () => h.onState(true);
  source.onerror = () => h.onState(false);
  return () => source.close();
}

export const putThumb = (file: string, svg: string) => request<unknown>(`/api/projects/${encodeURIComponent(file)}/thumb`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ svg }) });

export const thumbUrl = (file: string, v: number) => `/api/projects/${encodeURIComponent(file)}/thumb?v=${v}`;
export const siteZipUrl = (file: string) => `/api/projects/${encodeURIComponent(file)}/site.zip`;
export const reactZipUrl = (file: string) => `/api/projects/${encodeURIComponent(file)}/react.zip`;
