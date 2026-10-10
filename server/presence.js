/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  server/presence.js — QUEM ESTÁ NO PROJETO (pessoas e agentes) E AS TRAVAS POR CAMADA
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Várias IAs podem usar o mesmo editor ao mesmo tempo pelo MCP (Claude Code, Codex, ChatGPT...). Cada conexão MCP
 *  é uma SESSÃO com nome próprio. Para duas não brigarem pela mesma camada, quem altera uma camada fica com a TRAVA
 *  dela por alguns segundos: outro agente que tentar mexer nela recebe um aviso claro ("espere") em vez de
 *  sobrescrever o trabalho. Pessoas (abas do editor) também aparecem aqui, com nome e cor.
 *  Só memória: nada disso é gravado em disco. Sem dependências (o servidor e os testes importam este arquivo).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Cores das pessoas e agentes (escolhidas pelo nome: o mesmo nome tem sempre a mesma cor). */
export const PRESENCE_COLORS = ['#4c8dff', '#f7a541', '#c79bff', '#5cc98f', '#ff7a90', '#3ec5d6', '#e3c14b', '#9aa7ff'];
export const colorFor = (name) => {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return PRESENCE_COLORS[h % PRESENCE_COLORS.length];
};

/** Tempo da trava de uma camada depois de uma alteração. */
export const LOCK_MS = 10000;
/** Agente sem atividade há mais que isso some da lista. */
export const AGENT_IDLE_MS = 10 * 60 * 1000;
/** Recurso compartilhado por operações que mudam a estrutura ou o estado inteiro do projeto. */
export const DOCUMENT_LOCK = '__document__';

/** ids de camadas que uma ferramenta vai alterar (para as travas). */
export function targetsOf(args = {}) {
  const ids = [];
  for (const k of ['id', 'parent_id', 'component_id']) if (typeof args[k] === 'string' && args[k] !== 'root') ids.push(args[k]);
  if (Array.isArray(args.ids)) ids.push(...args.ids.filter((x) => typeof x === 'string'));
  return [...new Set(ids)];
}

/**
 * Cria o registro de presença.
 * @param {{ now?: () => number }} [opts]  relógio (os testes passam um falso)
 */
export function createPresence({ now = Date.now } = {}) {
  const agents = new Map(); // id da sessão MCP → { id, name, color, since, lastSeen, lastTool, calls }
  const people = new Map(); // id da aba do editor → { id, name, color, since }
  const locks = new Map(); // id da camada → { owner, name, until }
  const activity = []; // últimas ações: { at, who, color, text }

  const record = (who, color, text) => {
    activity.unshift({ at: now(), who, color, text });
    activity.length = Math.min(activity.length, 40);
  };

  return {
    /** Uma sessão MCP apareceu ou chamou algo. */
    touchAgent(id, name) {
      const a = agents.get(id);
      if (a) { a.lastSeen = now(); if (name && name !== a.name) { a.name = name; a.color = colorFor(name); } return a; }
      const n = name || 'IA externa';
      const fresh = { id, name: n, color: colorFor(n), since: now(), lastSeen: now(), lastTool: null, calls: 0 };
      agents.set(id, fresh);
      record(n, fresh.color, 'conectou pelo MCP');
      return fresh;
    },
    agent: (id) => agents.get(id) || null,
    /** Uma conexão MCP encerrou a sessão; libera também as travas que ela deixou. */
    removeAgent(id) {
      const a = agents.get(id);
      if (!a) return false;
      agents.delete(id);
      for (const [layerId, lock] of locks) if (lock.agentId === id) locks.delete(layerId);
      record(a.name, a.color, 'desconectou do MCP');
      return true;
    },
    /** Uma aba do editor conectou (pessoa). */
    addPerson(id, name, color) {
      const n = String(name || 'Pessoa').slice(0, 40);
      const p = { id, name: n, color: /^#[0-9a-f]{6}$/i.test(color || '') ? color : colorFor(n), since: now() };
      people.set(id, p);
      record(n, p.color, 'abriu o editor');
      return p;
    },
    removePerson(id) {
      const p = people.get(id);
      if (!p) return;
      people.delete(id);
      record(p.name, p.color, 'saiu');
    },
    /**
     * Tenta travar as camadas para a sessão. Devolve { ok: true } ou { ok: false, id, by } se outra sessão está
     * mexendo numa delas agora.
     */
    lock(owner, ids, ms = LOCK_MS, { agentId = owner, name } = {}) {
      const t = now();
      for (const id of ids) {
        const conflicts = id === DOCUMENT_LOCK
          ? [...locks.entries()]
          : [[id, locks.get(id)], [DOCUMENT_LOCK, locks.get(DOCUMENT_LOCK)]];
        for (const [key, l] of conflicts) {
          const sameAgentAfterCompletion = l?.agentId === agentId && Number.isFinite(l.until);
          if (l && l.owner !== owner && l.until > t && !sameAgentAfterCompletion) return { ok: false, id: key, by: l.name, wait: Number.isFinite(l.until) ? Math.ceil((l.until - t) / 1000) : 10 };
        }
      }
      const displayName = name || agents.get(agentId)?.name || 'IA externa';
      for (const id of ids) locks.set(id, { owner, agentId, name: displayName, until: ms === 0 ? Infinity : t + ms });
      return { ok: true };
    },
    /** Ao terminar a edição, converte as travas sem expiração em uma janela curta pós-edição. */
    finishLocks(owner, ids, ms = LOCK_MS) {
      const until = now() + ms;
      for (const id of ids) { const lock = locks.get(id); if (lock?.owner === owner) lock.until = until; }
    },
    /** Uma ferramenta terminou: guarda na atividade. */
    done(owner, tool, summary, ok = true) {
      const a = agents.get(owner);
      if (!a) return;
      a.lastTool = tool; a.calls++; a.lastSeen = now();
      if (summary) record(a.name, a.color, ok ? summary : `não conseguiu: ${summary}`);
    },
    /** Retrato para a tela (sem travas vencidas nem agentes parados há muito). */
    snapshot() {
      const t = now();
      for (const [id, l] of locks) if (l.until <= t) locks.delete(id);
      for (const [id, a] of agents) if (t - a.lastSeen > AGENT_IDLE_MS) agents.delete(id);
      return {
        people: [...people.values()],
        agents: [...agents.values()].map((a) => ({ ...a, active: t - a.lastSeen < 15000, locks: [...locks].filter(([, l]) => l.agentId === a.id).map(([id]) => id) })),
        activity: activity.slice(0, 20),
      };
    },
  };
}
