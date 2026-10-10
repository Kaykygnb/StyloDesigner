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

const waitForRetry = (ms, signal) => new Promise((resolve) => {
  let timer;
  const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', finish); resolve(); };
  timer = setTimeout(finish, ms);
  if (signal?.aborted) finish(); else signal?.addEventListener('abort', finish, { once: true });
});

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
  const approve = ({ client, summary, signal }) => {
    // subagentes do Assistente ("Assistente · Rodapé") seguem a escolha do Assistente ("Fazer sem perguntar", "Permitir tudo")
    const base = String(client || '').split(' · ')[0];
    const turn = queue.then(async () => {
      if (signal?.aborted) return false;
      if (allowed.has(base) || auto.has(base)) return true;
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
        dismissOnBackdrop: false,
        signal,
      });
      if (choice === 'all') allowed.add(base);
      return choice === 'yes' || choice === 'all';
    });
    queue = turn.catch(() => false);
    if (!signal) return turn;
    // A aprovação em fila também precisa responder ao cancelamento antes de chegar sua vez.
    // `ask()` só observa o sinal quando esta operação começa; a corrida libera logo a chamada MCP
    // e a trava do servidor. A operação continua na fila e verifica `signal.aborted` antes de abrir
    // um diálogo de permissão que já perdeu a validade.
    let abort;
    const cancelled = new Promise((resolve) => {
      abort = () => resolve(false);
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    });
    return Promise.race([turn, cancelled]).finally(() => signal.removeEventListener('abort', abort));
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
  const running = new Map();
  const lifetime = new AbortController();
  let es = null;
  async function replyUntilAccepted(id, result) {
    let retryIn = 120;
    while (!lifetime.signal.aborted) {
      try {
        const response = await fetch('/api/agent/reply', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, result }), signal: lifetime.signal,
        });
        // O servidor pode ter encerrado o pedido quando o editor reconectou ou a sessão expirou.
        if (response.status === 410) return;
        if (response.ok) {
          const ack = await response.json().catch(() => null);
          if (ack?.ok === true || ack?.ok === false) return;
        }
      } catch { /* reconexão curta: mantém a chamada no servidor e tenta de novo */ }
      await waitForRetry(retryIn, lifetime.signal);
      retryIn = Math.min(3000, Math.ceil(retryIn * 1.8));
    }
  }
  const onCall = async (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (!greeted.has(msg.client)) { greeted.add(msg.client); toast(`${msg.client} está usando o editor pelo MCP.`); }
    // external: veio de um programa de fora; admin: a pessoa ligou o "Acesso de administrador" (age sem perguntar)
    const controller = new AbortController();
    running.set(String(msg.id), controller);
    try {
      let result;
      try { result = await runner.run(msg.tool, msg.args, msg.client, { external: true, admin: !!msg.admin, signal: controller.signal }); }
      catch (err) { result = { error: err?.message || String(err) }; }
      // com acesso de administrador não há janela de permissão: avisa na tela o que mudou (transparência)
      if (result?._summary) toast(`${msg.client}: ${result._summary}`);
      await replyUntilAccepted(msg.id, result);
    } finally { running.delete(String(msg.id)); }
  };
  const onCancel = (ev) => {
    try { running.get(String(JSON.parse(ev.data).id))?.abort(); } catch { /* evento inválido */ }
  };
  const onPresenceEvent = (ev) => { try { onPresence(JSON.parse(ev.data)); } catch { /* ignora */ } };
  function connect() {
    for (const controller of running.values()) controller.abort();
    es?.close();
    const p = profile();
    const q = new URLSearchParams({ id: tabId, user: p.name || 'Pessoa', color: p.color || '' });
    es = new EventSource(`/api/agent/events?${q}`);
    es.addEventListener('call', onCall);
    es.addEventListener('cancel', onCancel);
    es.addEventListener('presence', onPresenceEvent);
  }
  connect();
  return {
    close() { lifetime.abort(); for (const controller of running.values()) controller.abort(); es?.close(); },
    reconnect: connect,
  };
}
