/**
 * events.ts — AVISOS AO VIVO PARA OS EDITORES ABERTOS (Server-Sent Events)
 *
 * Cada aba autenticada mantém uma conexão em GET /api/agent/events e recebe:
 *   presence  quem está no mesmo projeto (pessoas e agentes)
 *   project   um projeto que essa conta pode ver foi gravado
 * Identidade vem da sessão. Query não escolhe usuário. Projeto na query só entra se a conta pode vê-lo.
 * Limite de conexões simultâneas (sem teto, um laço de pedidos cresceria sem fim).
 */

import { randomUUID } from 'node:crypto';
import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';

export const MAX_EDITORS = 32;
const RECHECK_MS = 1_000;

interface LiveAudience {
  userId: string;
  name: string;
  color?: string | null;
  projectFile: string;
  /** Sessão web ainda válida e conta não suspensa. */
  sessionLive: () => Promise<boolean>;
  /** Audiência do evento de projeto: dono, membro ou OWNER da instalação. ADMIN sem membership não entra. */
  allowsProject: (event: { projectId?: string }) => Promise<boolean>;
}

interface Client {
  id: string;
  userId: string;
  name: string;
  projectFile: string;
  connectedAt: string;
  send: (event: string, data: string) => void;
  close: () => void;
  allowsProject: LiveAudience['allowsProject'];
}

export function createEvents({ presence }: { presence: { snapshot: () => unknown; snapshotForProject?: (file: string) => unknown; addPerson: (id: string, name: string, color?: string | null, projectFile?: string) => void; removePerson: (id: string) => void } }) {
  const clients = new Set<Client>();

  function broadcast(event: string, payload: unknown, allow: (client: Client) => Promise<boolean>) {
    const data = JSON.stringify(payload);
    for (const client of clients) {
      void allow(client).then((ok) => {
        if (!ok || !clients.has(client)) return;
        try { client.send(event, data); } catch { clients.delete(client); }
      }).catch(() => {});
    }
  }
  const broadcastPresence = () => {
    for (const client of clients) {
      try { client.send('presence', JSON.stringify(presence.snapshotForProject ? presence.snapshotForProject(client.projectFile) : presence.snapshot())); } catch { clients.delete(client); }
    }
  };
  const broadcastProject = (event: { projectId?: string }) => broadcast('project', event, (client) => client.allowsProject(event));

  /** GET /api/agent/events: a rota já autenticou. A conexão cai quando a sessão deixa de valer. */
  function handler(c: Context, audience: LiveAudience) {
    if (clients.size >= MAX_EDITORS) return c.json({ error: 'Editores conectados demais.' }, 429);
    return streamSSE(c, async (stream) => {
      const client: Client = {
        id: randomUUID(),
        userId: audience.userId,
        name: audience.name,
        projectFile: audience.projectFile,
        connectedAt: new Date().toISOString(),
        send: (event, data) => { void stream.writeSSE({ event, data }); },
        close: () => stream.abort(),
        allowsProject: audience.allowsProject,
      };
      clients.add(client);
      presence.addPerson(client.id, audience.name, audience.color, audience.projectFile);
      const leave = () => {
        if (!clients.delete(client)) return;
        presence.removePerson(client.id);
        broadcastPresence();
      };
      stream.onAbort(leave);
      await stream.write(': conectado\n\n');
      broadcastPresence();
      let idle = 0;
      while (!stream.aborted) {
        await stream.sleep(RECHECK_MS);
        if (stream.aborted) break;
        const live = await audience.sessionLive().catch(() => false);
        if (!live) { stream.abort(); break; }
        idle += RECHECK_MS;
        if (idle >= 25_000) {
          idle = 0;
          if (!stream.aborted) await stream.write(': ping\n\n');
        }
      }
    });
  }

  const list = () => [...clients].map(({ id, userId, name, connectedAt }) => ({ id, personId: userId, name, connectedAt }));
  const close = (id: string) => {
    const client = [...clients].find((x) => x.id === id);
    if (!client) return false;
    clients.delete(client);
    client.close();
    presence.removePerson(client.id);
    broadcastPresence();
    return true;
  };
  const closeForUser = (userId: string) => {
    for (const client of [...clients]) {
      if (client.userId !== userId) continue;
      clients.delete(client);
      client.close();
      presence.removePerson(client.id);
    }
    broadcastPresence();
  };
  return { handler, broadcastPresence, broadcastProject, count: () => clients.size, list, close, closeForUser };
}

export type Events = ReturnType<typeof createEvents>;
