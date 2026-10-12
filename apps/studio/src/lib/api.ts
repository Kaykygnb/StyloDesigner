// Conversa com o servidor. Toda mudança no projeto é uma chamada de FERRAMENTA (as mesmas do MCP): não há outro caminho.
import type { AuthState, Presence, ProjectInfo, Snapshot } from './types';

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
