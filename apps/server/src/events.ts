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

interface Client { send: (event: string, data: string) => void }

export function createEvents({ presence }: { presence: { snapshot: () => unknown; addPerson: (id: string, name: string, color?: string | null) => void; removePerson: (id: string) => void } }) {
  const clients = new Set<Client>();

  function broadcast(event: string, payload: unknown) {
    const data = JSON.stringify(payload);
    for (const client of clients) {
      try { client.send(event, data); } catch { clients.delete(client); }
    }
  }
  const broadcastPresence = () => broadcast('presence', presence.snapshot());
  const broadcastProject = (event: unknown) => broadcast('project', event);

  /** GET /api/agent/events: a conexão fica aberta até a aba fechar. */
  function handler(c: Context) {
    if (clients.size >= MAX_EDITORS) return c.json({ error: 'Editores conectados demais.' }, 429);
    const q = c.req.query();
    // a aba diz quem é (nome e cor do perfil): aparece na presença para os outros
    const personId = String(q.id || randomUUID()).slice(0, 60);
    const personName = String(q.user || 'Pessoa').slice(0, 40);
    return streamSSE(c, async (stream) => {
      const client: Client = { send: (event, data) => { void stream.writeSSE({ event, data }); } };
      clients.add(client);
      presence.addPerson(personId, personName, q.color);
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

  return { handler, broadcastPresence, broadcastProject, count: () => clients.size };
}

export type Events = ReturnType<typeof createEvents>;
