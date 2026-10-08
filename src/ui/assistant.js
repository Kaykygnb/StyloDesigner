/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/assistant.js — PAINEL "ASSISTENTE" (agente de IA dentro do editor)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Uma conversa flutuante no canto do canvas. Você escreve ("deixa o botão com cantos de 12px", "esse card
 *  precisa de mais respiro"), a IA lê o design com as ferramentas de agent/schema.js e propõe alterações, que
 *  passam pela janela de permissão antes de valer (e saem com Ctrl+Z).
 *
 *  COMO FUNCIONA (o "laço do agente"):
 *    1. manda a conversa + a lista de ferramentas para POST /api/agent/chat (o servidor usa a SUA chave da OpenAI,
 *       que fica só no seu computador, e repassa para a API — ou para um servidor compatível, como o Ollama);
 *    2. se a resposta pede ferramentas (tool_calls), o runner executa cada uma no editor e devolve o resultado;
 *    3. repete até a IA responder só com texto (no máximo MAX_STEPS rodadas por mensagem).
 *  A conversa vive só na memória (some ao recarregar) e não entra no arquivo do projeto.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { openAiTools, AGENT_INSTRUCTIONS } from '../agent/schema.js';

/** Máximo de rodadas "IA pede ferramenta → editor responde" por mensagem (evita laço infinito e gasto à toa). */
const MAX_STEPS = 12;
/** Resultados de ferramenta maiores que isso são cortados antes de voltar à IA (economiza tokens). */
const MAX_RESULT = 24000;
/** Nome amigável de cada ferramenta na conversa. */
const TOOL_LABEL = {
  get_document: 'Leu o projeto', get_layer: 'Leu uma camada', get_code: 'Leu o código', find_layers: 'Procurou camadas',
  get_selection: 'Leu a seleção', select_layers: 'Selecionou camadas', update_layer: 'Alterou', create_layer: 'Criou',
  delete_layers: 'Apagou', move_layer: 'Moveu', undo: 'Desfez',
};

/**
 * Cria o painel.
 * @param {object} deps
 * @param {object} deps.store
 * @param {{ run: Function }} deps.runner
 * @param {() => void} deps.openSettings  abre as Configurações (para pôr a chave)
 * @param {HTMLElement} deps.stage  onde o painel flutua
 * @returns {{ el: HTMLElement, toggle: () => void, open: () => void, close: () => void, isOpen: () => boolean }}
 */
export function createAssistant({ store, runner, openSettings, stage }) {
  /** Conversa no formato da API (sem a mensagem de sistema, que é montada a cada envio). */
  let messages = [];
  let busy = false;
  let aborter = null;
  const log = h('div.ai-log', { role: 'log', 'aria-live': 'polite' });
  const input = h('textarea.ai-input', { rows: 2, placeholder: 'Peça uma mudança ou uma revisão… (Enter envia, Shift+Enter quebra linha)', 'aria-label': 'Mensagem para o assistente' });
  const sendBtn = h('button.icon-btn.ai-send', { type: 'button', title: 'Enviar (Enter)', 'aria-label': 'Enviar', onclick: () => submit() }, ico('send', 16));
  const stopBtn = h('button.btn.small.ai-stop', { type: 'button', hidden: true, onclick: () => aborter?.abort() }, 'Parar');
  const modelEl = h('span.ai-model');
  const el = h('section.ai-panel', { hidden: true, 'aria-label': 'Assistente de IA' },
    h('header.ai-head',
      h('span.ai-title', ico('sparkle', 15), 'Assistente'),
      modelEl,
      h('div.spacer'),
      h('button.icon-btn.small', { type: 'button', title: 'Nova conversa', 'aria-label': 'Nova conversa', onclick: () => reset() }, ico('trash', 14)),
      h('button.icon-btn.small', { type: 'button', title: 'Configurar (chave, modelo)', 'aria-label': 'Configurar assistente', onclick: () => openSettings() }, ico('settings', 14)),
      h('button.icon-btn.small', { type: 'button', title: 'Fechar', 'aria-label': 'Fechar assistente', onclick: () => close() }, ico('x', 14))),
    log,
    h('div.ai-compose', input, h('div.ai-actions', stopBtn, sendBtn)));
  stage.append(el);

  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // atalhos do canvas (Delete, letras) não podem disparar enquanto se digita aqui
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    if (e.key === 'Escape') close();
  });

  /** Acrescenta uma linha na conversa e rola até ela. */
  const add = (node) => { log.append(node); log.scrollTop = log.scrollHeight; return node; };
  /** Texto da IA → parágrafos, com `código` destacado (sem HTML vindo da IA: tudo vira texto). */
  const rich = (text) => String(text || '').split(/\n{2,}/).map((para) => h('p', ...para.split(/(`[^`]+`)/).map((part) =>
    (part.startsWith('`') && part.endsWith('`') ? h('code', part.slice(1, -1)) : part.replace(/\*\*(.+?)\*\*/g, '$1')))));

  /** Mostra a configuração atual (modelo) e, sem chave, o convite para configurar. */
  async function refreshConfig() {
    try {
      const c = await (await fetch('/api/agent/config')).json();
      modelEl.textContent = c.model || '';
      const needsKey = !c.hasKey && /api\.openai\.com/.test(c.baseUrl || '');
      if (needsKey && !log.querySelector('.ai-setup')) {
        add(h('div.ai-setup',
          h('p', 'Para conversar, o assistente precisa da sua chave da OpenAI (ela fica só neste computador).'),
          h('button.btn.primary.small', { type: 'button', onclick: () => openSettings() }, 'Configurar a chave')));
      }
      if (!needsKey) log.querySelector('.ai-setup')?.remove();
      return c;
    } catch {
      modelEl.textContent = '';
      if (!log.querySelector('.ai-setup')) add(h('div.ai-setup', h('p', 'O assistente precisa do servidor do app: abra com "npm start".')));
      return null;
    }
  }

  /** Começa do zero (esquece a conversa). */
  function reset() {
    if (busy) aborter?.abort();
    messages = [];
    log.replaceChildren();
    add(h('div.ai-hello', h('p', 'Oi! Eu leio o seu design e faço alterações com a sua permissão. Selecione algo no canvas e diga o que quer, por exemplo:'),
      h('ul', h('li', '“deixa este botão com cantos de 12px”'), h('li', '“revisa o CSS deste card”'), h('li', '“cria um cabeçalho com logo à esquerda e menu à direita”'))));
    refreshConfig();
  }

  /** Contexto do editor anexado a cada pedido (onde a pessoa está e o que selecionou), sem aparecer na conversa. */
  function context() {
    const sel = store.ui.selection.map((id) => store.get(id)).filter(Boolean);
    const page = store.page();
    return `\n\n[Contexto do editor — página “${page.name}”; seleção: ${sel.length ? sel.map((n) => `“${n.name}” (${n.type}, id ${n.id})`).join(', ') : 'nada selecionado'}${store.ui.bp ? `; modo responsivo: ${store.ui.bp}` : ''}]`;
  }

  /** Envia a mensagem digitada e roda o laço do agente. */
  async function submit() {
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    add(h('div.ai-msg.user', rich(text)));
    messages.push({ role: 'user', content: text + context() });
    busy = true;
    aborter = new AbortController();
    sendBtn.disabled = true;
    stopBtn.hidden = false;
    const thinking = add(h('div.ai-thinking', 'Pensando…'));
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const r = await fetch('/api/agent/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: aborter.signal,
          body: JSON.stringify({ messages: [{ role: 'system', content: AGENT_INSTRUCTIONS }, ...messages], tools: openAiTools() }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || `Erro ${r.status}`);
        const m = data.message;
        const calls = Array.isArray(m.tool_calls) ? m.tool_calls : [];
        messages.push({ role: 'assistant', content: m.content || '', ...(calls.length ? { tool_calls: calls } : {}) });
        if (m.content) log.insertBefore(h('div.ai-msg.bot', rich(m.content)), thinking);
        if (!calls.length) break;
        for (const call of calls) {
          if (aborter.signal.aborted) throw new DOMException('parado', 'AbortError');
          let args = null;
          try { args = JSON.parse(call.function?.arguments || '{}'); } catch { /* argumentos quebrados */ }
          const name = call.function?.name;
          const result = args ? await runner.run(name, args, 'Assistente') : { error: 'Os argumentos não são um JSON válido.' };
          log.insertBefore(stepLine(name, args, result), thinking);
          log.scrollTop = log.scrollHeight;
          const json = JSON.stringify(result);
          messages.push({ role: 'tool', tool_call_id: call.id, content: json.length > MAX_RESULT ? `${json.slice(0, MAX_RESULT)}… (cortado)` : json });
        }
        if (step === MAX_STEPS - 1) log.insertBefore(h('div.ai-note', 'Parei aqui para não rodar sem fim. Mande "continua" se quiser que eu siga.'), thinking);
      }
    } catch (err) {
      log.insertBefore(h('div.ai-error', err.name === 'AbortError' ? 'Parado.' : err.message), thinking);
    } finally {
      thinking.remove();
      busy = false;
      sendBtn.disabled = false;
      stopBtn.hidden = true;
      input.focus();
    }
  }

  /** Linha discreta mostrando o que a IA fez com cada ferramenta (✓ feito, ✗ erro, ⊘ recusado). */
  function stepLine(name, args, result) {
    const target = args?.id && store.get(args.id)?.name;
    const label = `${TOOL_LABEL[name] || name}${target ? ` “${target}”` : ''}${name === 'update_layer' && args?.props ? `: ${Object.keys(args.props).join(', ')}` : ''}${name === 'create_layer' ? ` ${args?.props?.name ? `“${args.props.name}”` : args?.type || ''}` : ''}`;
    const state = result?.error ? 'err' : result?.refused ? 'refused' : 'ok';
    const mark = { ok: '✓', err: '✗', refused: '⊘' }[state];
    return h(`div.ai-step.${state}`, { title: result?.error || result?.message || '' }, `${mark} ${label}${state === 'refused' ? ' (recusado)' : ''}${state === 'err' ? ` — ${result.error}` : ''}`);
  }

  const open = () => { el.hidden = false; if (!log.childElementCount) reset(); else refreshConfig(); input.focus(); };
  const close = () => { el.hidden = true; };
  const toggle = () => (el.hidden ? open() : close());
  return { el, open, close, toggle, isOpen: () => !el.hidden, refreshConfig };
}
