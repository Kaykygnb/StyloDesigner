// Conversa com o servidor. Toda mudança no projeto é uma chamada de FERRAMENTA (as mesmas do MCP): não há outro caminho.
import type { AuthState, Presence, ProjectInfo, Snapshot, PublicUser } from './types';
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
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ToolError((data as { error?: string }).error || `O servidor respondeu ${res.status}.`);
  return data as T;
}

const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

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
export const login = (email: string, password: string) => request<unknown>('/api/auth/login', json({ email, password }));
export const setup = (email: string, name: string, password: string) => request<unknown>('/api/auth/setup', json({ email, name, password }));
export const logout = () => request<unknown>('/api/auth/logout', json({}));
export const updateMe = (body: { name?: string; color?: string }) => request<PublicUser>('/api/me', { ...json(body), method: 'PUT' });
export const sessionsList = () => request<Array<{ id: string; createdAt: string; expiresAt: string; current: boolean }>>('/api/me/sessions');
export const revokeSession = (id: string) => request<unknown>(`/api/me/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const changePassword = (current: string, next: string) => request<unknown>('/api/me/password', json({ current, next }));
export const libraryList = (q = '') => request<{ assets: LibraryAsset[]; usage: { bytes: number; count: number } }>('/api/library' + (q ? `?q=${encodeURIComponent(q)}` : ''));
export const libraryUpload = (file: File) => request<LibraryAsset>('/api/library', { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Name': encodeURIComponent(file.name) }, body: file });
export const libraryRemove = (id: string) => request<unknown>(`/api/library/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const agentsList = () => request<AgentInfo[]>('/api/agents');
export const usersList = () => request<PublicUser[]>('/api/users');
export const createUser = (email: string, name: string) => request<{ user: PublicUser; temporaryPassword?: string }>('/api/users', json({ email, name }));
export const updateUser = (id: string, body: { name?: string; email?: string; color?: string | null; role?: 'OWNER' | 'ADMIN' | 'EDITOR' | 'COMMENTER' | 'VIEWER' | 'MEMBER' }) => request<PublicUser>(`/api/users/${encodeURIComponent(id)}`, { ...json(body), method: 'PUT' });
export const resetUserPassword = (id: string) => request<{ temporaryPassword: string }>(`/api/users/${encodeURIComponent(id)}/reset-password`, json({}));
export const revokeUserSessions = (id: string) => request<unknown>(`/api/users/${encodeURIComponent(id)}/revoke-sessions`, json({}));
export const setUserSuspended = (id: string, suspended: boolean) => request<PublicUser>(`/api/users/${encodeURIComponent(id)}/suspend`, json({ suspended }));
export const deleteUser = (id: string) => request<unknown>(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const createAgent = (name: string, scopes: string[] = ['read', 'comment', 'write', 'export']) => request<{ agent: { id: string; name: string; status: string; scopes: string[] }; token: string }>('/api/agents', json({ name, scopes }));
export const approveAgent = (id: string) => request<unknown>(`/api/agents/${encodeURIComponent(id)}/approve`, json({}));
export const revokeAgent = (id: string) => request<unknown>(`/api/agents/${encodeURIComponent(id)}/revoke`, json({}));
export const rotateAgent = (id: string) => request<{ agent: AgentInfo; token: string }>(`/api/agents/${encodeURIComponent(id)}/rotate`, json({}));
export const updateAgent = (id: string, scopes: string[]) => request<unknown>(`/api/agents/${encodeURIComponent(id)}`, { ...json({ scopes }), method: 'PUT' });
export const grantAgentProject = (id: string, file: string) => request<unknown>(`/api/agents/${encodeURIComponent(id)}/projects`, json({ file }));
export const revokeAgentProject = (id: string, projectId: string) => request<unknown>(`/api/agents/${encodeURIComponent(id)}/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
export const projectActivity = (file: string, agent?: string) => request<Array<{ id: number; at: string; who: string; tool: string; summary: string; ok: boolean }>>(`/api/projects/${encodeURIComponent(file)}/activity?limit=50${agent ? `&agent=${encodeURIComponent(agent)}` : ''}`);
export const projectVersions = (file: string) => request<Array<{ id: string; modified: number; size: number }>>(`/api/projects/${encodeURIComponent(file)}/versions`);
export const restoreProjectVersion = (file: string, id: string) => request<unknown>(`/api/projects/${encodeURIComponent(file)}/versions/${encodeURIComponent(id)}/restore`, json({}));
export const publishProject = (file: string, format: 'html' | 'react') => request<{ ok: true; id: string; format: string; bytes: number; download: string; warnings: string[] }>(`/api/projects/${encodeURIComponent(file)}/publish`, json({ format }));
export const projectPublishing = (file: string) => request<Array<{ id: string; format: string; status: string; createdAt: string; warnings?: unknown }>>(`/api/projects/${encodeURIComponent(file)}/publishing`);
export const projectPresence = (file: string) => request<{ projectId: string; people: unknown[]; agents: AgentInfo[]; locks: string[]; activity: unknown[] }>(`/api/projects/${encodeURIComponent(file)}/presence`);
export const backupsList = () => request<Array<{ id: string; createdAt: string; bytes: number }>>('/api/backups');
export const createBackup = () => request<{ id: string; createdAt: string; bytes: number }>('/api/backups', json({}));
export const restoreBackup = (id: string) => request<{ ok: true; restartRequired: true; id: string }>(`/api/backups/${encodeURIComponent(id)}/restore`, json({}));
export const agentConfig = () => request<{ mcpUrl: string; pexels: boolean; pexelsSource: string; agentPolicy?: string }>('/api/agent/config');
export const pluginsCatalog = () => request<{ plugins: PluginInfo[]; providers: ProviderInfo[]; registration: { trustedCode: string; declarativeAssets: string } }>('/api/plugins/catalog');
export const assetSources = () => request<{ sources: unknown[] }>('/api/asset-sources');
export const addAssetSource = (source: unknown) => request<unknown>('/api/asset-sources', json(source));
export const removeAssetSource = (name: string) => request<unknown>(`/api/asset-sources/${encodeURIComponent(name)}`, { method: 'DELETE' });
export const updateAgentConfig = (body: { agentPolicy?: 'open' | 'approval' | 'closed'; pexelsKey?: string }) => request<unknown>('/api/agent/config', json(body));

export interface LibraryAsset { id: string; name: string; mime: string; size: number; tags?: string[]; source?: string; sourceUrl?: string | null; license?: { name: string; url?: string; commercial: boolean; attribution: string } | null; credit?: string | null; createdAt?: string }
export interface AgentInfo { id: string; name: string; status: string; scopes: string[]; lastSeenAt?: string | null; createdAt?: string }
export interface PluginInfo { id: string; name: string; description: string; tools: { name: string; description: string; write: boolean; needsProject: boolean }[] }
export interface ProviderInfo { id: string; name: string; kinds: string[]; custom: boolean; ready: boolean; needsKey?: { label: string; envVar?: string; signupUrl?: string } | null; hasKey: boolean; unverified: boolean; licenseSummary: string }

export interface LiveHandlers { onPresence: (p: Presence) => void; onProject: (e: { file?: string; by?: string }) => void; onState: (connected: boolean) => void }

/** Avisos ao vivo do servidor: quem está aqui e "o projeto mudou" (outro agente ou aba gravou). */
export function connectLive(name: string, h: LiveHandlers): () => void {
  const source = new EventSource(`/api/agent/events?id=${encodeURIComponent(sid)}&user=${encodeURIComponent(name)}`);
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
