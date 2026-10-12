/**
 * events.ts — AVISOS AO VIVO PARA OS EDITORES ABERTOS (Server-Sent Events)
 *
 * Cada aba do editor mantém uma conexão em GET /api/agent/events e recebe:
 *   presence  quem está no servidor (pessoas e agentes) e o que fizeram por último
 *   project   um projeto foi gravado (por um agente ou outra aba): quem não tem alterações pendentes recarrega
 * Limite de conexões simultâneas (sem teto, um laço de pedidos cresceria sem fim).
 */

import { randomUUID } from 'node:crypto';
import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';

export const MAX_EDITORS = 32;

interface Client { id: string; personId: string; name: string; projectFile: string; connectedAt: string; send: (event: string, data: string) => void; close: () => void }

export function createEvents({ presence }: { presence: { snapshot: () => unknown; snapshotForProject?: (file: string) => unknown; addPerson: (id: string, name: string, color?: string | null, projectFile?: string) => void; removePerson: (id: string) => void } }) {
  const clients = new Set<Client>();

  function broadcast(event: string, payload: unknown) {
    const data = JSON.stringify(payload);
    for (const client of clients) {
      try { client.send(event, data); } catch { clients.delete(client); }
    }
  }
  const broadcastPresence = () => {
    for (const client of clients) {
      try { client.send('presence', JSON.stringify(presence.snapshotForProject ? presence.snapshotForProject(client.projectFile) : presence.snapshot())); } catch { clients.delete(client); }
    }
  };
  const broadcastProject = (event: unknown) => broadcast('project', event);

  /** GET /api/agent/events: a conexão fica aberta até a aba fechar. */
  function handler(c: Context) {
    if (clients.size >= MAX_EDITORS) return c.json({ error: 'Editores conectados demais.' }, 429);
    const q = c.req.query();
    // a aba diz quem é (nome e cor do perfil): aparece na presença para os outros
    const personId = String(q.id || randomUUID()).slice(0, 60);
    const personName = String(q.user || 'Pessoa').slice(0, 40);
    return streamSSE(c, async (stream) => {
      const projectFile = String(q.file || '').slice(0, 240);
      const client: Client = { id: randomUUID(), personId, name: personName, projectFile, connectedAt: new Date().toISOString(), send: (event, data) => { void stream.writeSSE({ event, data }); }, close: () => stream.abort() };
      clients.add(client);
      presence.addPerson(personId, personName, q.color, projectFile);
      stream.onAbort(() => {
        clients.delete(client);
        presence.removePerson(personId);
        broadcastPresence();
      });
      await stream.write(': conectado\n\n');
      broadcastPresence();
      // "batimento" a cada 25 s: sem tráfego, alguns navegadores/antivírus derrubam a conexão parada
      while (!stream.aborted) {
        await stream.sleep(25_000);
        if (!stream.aborted) await stream.write(': ping\n\n');
      }
    });
  }

  const list = () => [...clients].map(({ id, personId, name, connectedAt }) => ({ id, personId, name, connectedAt }));
  const close = (id: string) => { const client = [...clients].find((x) => x.id === id); if (!client) return false; clients.delete(client); client.close(); presence.removePerson(client.personId); broadcastPresence(); return true; };
  return { handler, broadcastPresence, broadcastProject, count: () => clients.size, list, close };
}

export type Events = ReturnType<typeof createEvents>;
