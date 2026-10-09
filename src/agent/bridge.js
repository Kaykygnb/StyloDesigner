/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  agent/bridge.js — PERMISSÃO E PONTE COM O MCP (lado do navegador)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  createApprover: a janela "A IA quer alterar o design" que aparece antes de CADA alteração feita por uma IA
 *  (o agente interno ou um programa via MCP). Respostas: Permitir · Permitir tudo nesta sessão · Recusar.
 *  "Sessão" = até recarregar a página, e vale só para aquele programa (permitir o Assistente não libera o Claude).
 *  Os pedidos fazem fila: duas IAs ao mesmo tempo não abrem duas janelas uma em cima da outra.
 *
 *  connectMcpBridge: deixa o editor "ouvindo" o servidor (GET /api/agent/events). Quando um programa de IA chama
 *  uma ferramenta pelo MCP, o servidor repassa para cá, o runner executa (pedindo permissão se for alteração) e
 *  o resultado volta pelo POST /api/agent/reply. Se o servidor cair, o EventSource reconecta sozinho.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h } from '../ui/dom.js';
import { ask } from '../ui/menus.js';

/**
 * Cria a função de permissão.
 * @returns {(req: {client: string, tool: string, summary: string}) => Promise<boolean>}
 */
export function createApprover() {
  /** Programas liberados até recarregar a página ("Permitir tudo nesta sessão"). */
  const allowed = new Set();
  /** Programas em "fazer sem perguntar" (opção do painel do Assistente, lembrada nas preferências). */
  const auto = new Set();
  /** Fila: cada pergunta espera a anterior terminar. */
  let queue = Promise.resolve();
  const approve = ({ client, summary }) => {
    const turn = queue.then(async () => {
      if (allowed.has(client) || auto.has(client)) return true;
      const choice = await ask({
        title: `${client} quer alterar o design`,
        message: [
          h('p.agent-ask-what', summary),
          h('p.muted', 'Você pode desfazer depois com Ctrl+Z. "Permitir tudo" vale até recarregar a página, só para este programa.'),
        ],
        buttons: [
          { label: 'Recusar', value: 'no' },
          { label: 'Permitir tudo nesta sessão', value: 'all' },
          { label: 'Permitir', value: 'yes', primary: true },
        ],
      });
      if (choice === 'all') allowed.add(client);
      return choice === 'yes' || choice === 'all';
    });
    queue = turn.catch(() => false);
    return turn;
  };
  approve.reset = () => allowed.clear();
  /** Liga/desliga "fazer sem perguntar" para um programa (as alterações continuam saindo com Ctrl+Z). */
  approve.setAuto = (client, on) => (on ? auto.add(client) : auto.delete(client));
  approve.isAuto = (client) => auto.has(client);
  return approve;
}

/**
 * Liga o editor à ponte do servidor (MCP) e à presença.
 * @param {object} deps
 * @param {{ run: Function }} deps.runner
 * @param {(m: string) => void} deps.toast
 * @param {() => {name: string, color: string}} [deps.profile]  quem está nesta aba (vai para a presença)
 * @param {(data: object) => void} [deps.onPresence]  recebe o retrato de quem está no projeto
 * @returns {{ close: () => void, reconnect: () => void }}
 */
export function connectMcpBridge({ runner, toast, profile = () => ({ name: 'Pessoa', color: '' }), onPresence = () => {} }) {
  if (typeof EventSource === 'undefined') return { close() {}, reconnect() {} };
  // id desta aba (igual enquanto ela existir): a presença não duplica a pessoa ao reconectar
  let tabId = '';
  try { tabId = sessionStorage.getItem('stylo.tab') || ''; } catch { /* sem sessionStorage */ }
  if (!tabId) { tabId = `t${Math.random().toString(36).slice(2, 10)}`; try { sessionStorage.setItem('stylo.tab', tabId); } catch { /* idem */ } }
  /** Avisa (uma vez por programa) que uma IA externa começou a usar o editor. */
  const greeted = new Set();
  let es = null;
  const onCall = async (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (!greeted.has(msg.client)) { greeted.add(msg.client); toast(`${msg.client} está usando o editor pelo MCP.`); }
    // external: veio de um programa de fora; admin: a pessoa ligou o "Acesso de administrador" (age sem perguntar)
    const result = await runner.run(msg.tool, msg.args, msg.client, { external: true, admin: !!msg.admin });
    // com acesso de administrador não há janela de permissão: avisa na tela o que mudou (transparência)
    if (result?._summary) toast(`${msg.client}: ${result._summary}`);
    try {
      await fetch('/api/agent/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: msg.id, result }) });
    } catch { /* servidor caiu: o pedido expira do lado de lá */ }
  };
  const onPresenceEvent = (ev) => { try { onPresence(JSON.parse(ev.data)); } catch { /* ignora */ } };
  function connect() {
    es?.close();
    const p = profile();
    const q = new URLSearchParams({ id: tabId, user: p.name || 'Pessoa', color: p.color || '' });
    es = new EventSource(`/api/agent/events?${q}`);
    es.addEventListener('call', onCall);
    es.addEventListener('presence', onPresenceEvent);
  }
  connect();
  return { close: () => es?.close(), reconnect: connect };
}
