/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/assistant.js — PAINEL "ASSISTENTE" (agente de IA dentro do editor)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Uma conversa flutuante no canto do canvas. Você escreve ("deixa o botão com cantos de 12px", "esse card
 *  precisa de mais respiro"), a IA lê o design com as ferramentas de agent/schema.js e propõe alterações, que
 *  passam pela janela de permissão antes de valer (e saem com Ctrl+Z).
 *
 *  COMO FUNCIONA (o "laço do agente"):
 *    1. manda a conversa + a lista de ferramentas para POST /api/agent/chat (o servidor junta as instruções de
 *       docs/AGENTE.md, usa a SUA chave, que fica só no seu computador, e repassa para o provedor escolhido:
 *       OpenAI, NVIDIA NIM, Ollama ou outro compatível);
 *    2. se a resposta pede ferramentas (tool_calls), o runner executa cada uma no editor e devolve o resultado;
 *    3. repete até a IA responder só com texto (no máximo MAX_STEPS rodadas por mensagem).
 *  A conversa vive só na memória (some ao recarregar) e não entra no arquivo do projeto.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { openAiTools } from '../agent/schema.js';

/** Máximo de rodadas "IA pede ferramenta → editor responde" por mensagem (evita laço infinito e gasto à toa). */
const MAX_STEPS = 30;
/** Resultados de ferramenta maiores que isso são cortados antes de voltar à IA (economiza tokens). */
const MAX_RESULT = 24000;
/**
 * Limpa o texto da IA antes de mostrar: modelos que "pensam em voz alta" (DeepSeek-R1, Qwen e outros da NVIDIA NIM)
 * mandam o raciocínio entre <think> e </think>; a pessoa só precisa da resposta.
 */
export const cleanReply = (text) => String(text || '').replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
/**
 * O modelo "escreveu" a chamada de ferramenta como texto em vez de usar o formato certo? (Acontece com modelos sem
 * suporte bom a ferramentas: a documentação da NVIDIA avisa desse caso.) Aí a ferramenta não roda e avisamos.
 */
export const looksLikeTextToolCall = (text) => /<tool_call>|"(name|function)"\s*:\s*"(get_|update_|create_|delete_|move_|find_|select_)/.test(String(text || ''));
/** Argumentos da chamada: texto JSON (OpenAI) ou objeto pronto (alguns servidores compatíveis). null = inválido. */
export const parseArgs = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  if (raw === undefined || raw === null || raw === '') return {};
  try { const v = JSON.parse(raw); return v && typeof v === 'object' ? v : null; } catch { return null; }
};

/** Nome amigável de cada ferramenta na conversa. */
const TOOL_LABEL = {
  get_document: 'Leu o projeto', get_layer: 'Leu uma camada', get_code: 'Leu o código', find_layers: 'Procurou camadas',
  get_selection: 'Leu a seleção', select_layers: 'Selecionou camadas', update_layer: 'Alterou', create_layer: 'Criou',
  delete_layers: 'Apagou', move_layer: 'Moveu', undo: 'Desfez', build_layout: 'Montou', search_icons: 'Procurou ícones',
  insert_icon: 'Inseriu o ícone', list_fonts: 'Consultou fontes', create_color_styles: 'Criou estilos de cor', create_page: 'Criou a página',
  switch_page: 'Abriu a página',
};

/**
 * Cria o painel.
 * @param {object} deps
 * @param {object} deps.store
 * @param {{ run: Function }} deps.runner
 * @param {() => void} deps.openSettings  abre as Configurações (para pôr a chave)
 * @param {HTMLElement} deps.stage  onde o painel flutua
 * @param {{ setAuto: Function, isAuto: Function }} [deps.approve]  para a opção "Fazer sem perguntar"
 * @param {object} [deps.prefs]  preferências (lembra a opção) · @param {() => void} [deps.savePrefs]
 * @returns {{ el: HTMLElement, toggle: () => void, open: () => void, close: () => void, isOpen: () => boolean }}
 */
export function createAssistant({ store, runner, openSettings, stage, approve, prefs = {}, savePrefs = () => {} }) {
  /** Conversa no formato da API (sem a mensagem de sistema, que é montada a cada envio). */
  let messages = [];
  let busy = false;
  let aborter = null;
  const log = h('div.ai-log', { role: 'log', 'aria-live': 'polite' });
  const input = h('textarea.ai-input', { rows: 2, placeholder: 'Peça uma mudança ou uma revisão… (Enter envia, Shift+Enter quebra linha)', 'aria-label': 'Mensagem para o assistente' });
  const sendBtn = h('button.icon-btn.ai-send', { type: 'button', title: 'Enviar (Enter)', 'aria-label': 'Enviar', onclick: () => submit() }, ico('send', 16));
  const stopBtn = h('button.btn.small.ai-stop', { type: 'button', hidden: true, onclick: () => aborter?.abort() }, 'Parar');
  const modelEl = h('span.ai-model');
  // FAZER SEM PERGUNTAR: as alterações do Assistente valem direto (sem a janela de permissão); Ctrl+Z continua
  // desfazendo cada uma. Lembrada nas preferências. Não vale para programas do MCP (esses sempre perguntam).
  const autoInput = h('input', { type: 'checkbox', checked: !!prefs.agentAuto });
  const syncAuto = () => approve?.setAuto?.('Assistente', autoInput.checked);
  autoInput.addEventListener('change', () => { prefs.agentAuto = autoInput.checked; savePrefs(); syncAuto(); });
  syncAuto();
  const autoEl = h('label.ai-auto', { title: 'Ligado: o assistente altera o design direto, sem perguntar (Ctrl+Z desfaz cada alteração). Desligado: pede permissão a cada alteração.' },
    autoInput, h('span', 'Fazer sem perguntar'));
  const el = h('section.ai-panel', { hidden: true, 'aria-label': 'Assistente de IA' },
    h('header.ai-head',
      h('span.ai-title', ico('sparkle', 15), 'Assistente'),
      modelEl,
      h('div.spacer'),
      autoEl,
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
      modelEl.title = c.baseUrl || '';
      const needsKey = !!c.needsKey;
      const who = { openai: 'da OpenAI', nvidia: 'da NVIDIA (nvapi-...)' }[c.provider] || 'da API';
      if (needsKey && !log.querySelector('.ai-setup')) {
        add(h('div.ai-setup',
          h('p', `Para conversar, o assistente precisa da sua chave ${who} (ela fica só neste computador).`),
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
    const screens = page.children.filter((n) => n.type === 'frame' || n.type === 'section').slice(0, 12)
      .map((n) => `“${n.name}” (${n.type}, ${Math.round(n.w)}×${Math.round(n.h)}, id ${n.id})`);
    const colors = (store.state.doc.styles?.colors || []).slice(0, 16).map((c) => `${c.name} ${c.color} (id ${c.id})`);
    return `\n\n[Contexto do editor — página “${page.name}”; telas na página: ${screens.length ? screens.join(', ') : 'nenhuma (página vazia)'}`
      + `; seleção: ${sel.length ? sel.map((n) => `“${n.name}” (${n.type}, id ${n.id})`).join(', ') : 'nada selecionado (se o pedido é criar algo, crie uma tela nova com build_layout)'}`
      + `${colors.length ? `; estilos de cor: ${colors.join(', ')}` : ''}${store.ui.bp ? `; modo responsivo: ${store.ui.bp}` : ''}]`;
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
          // as instruções (docs/AGENTE.md) quem põe é o servidor
          body: JSON.stringify({ messages, tools: openAiTools() }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || `Erro ${r.status}`);
        const m = data.message;
        const calls = Array.isArray(m.tool_calls) ? m.tool_calls : [];
        messages.push({ role: 'assistant', content: m.content || '', ...(calls.length ? { tool_calls: calls } : {}) });
        const reply = cleanReply(m.content);
        if (reply) log.insertBefore(h('div.ai-msg.bot', rich(reply)), thinking);
        if (!calls.length) {
          if (looksLikeTextToolCall(m.content)) {
            log.insertBefore(h('div.ai-note', `O modelo “${modelEl.textContent}” escreveu a ferramenta como texto em vez de usá-la. Troque por um modelo com suporte a ferramentas (“tool calling”) em Configurações.`), thinking);
          }
          break;
        }
        for (const call of calls) {
          if (aborter.signal.aborted) throw new DOMException('parado', 'AbortError');
          const args = parseArgs(call.function?.arguments);
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
    const extra = name === 'update_layer' && args?.props ? `: ${Object.keys(args.props).join(', ')}`
      : name === 'create_layer' ? ` ${args?.props?.name ? `“${args.props.name}”` : args?.type || ''}`
        : name === 'build_layout' ? ` “${args?.tree?.props?.name || 'estrutura'}”${result?.count ? ` (${result.count} camadas)` : ''}`
          : name === 'insert_icon' || name === 'search_icons' ? ` ${args?.name || args?.query || ''}`
            : name === 'create_page' ? ` “${args?.name || ''}”` : '';
    const label = `${TOOL_LABEL[name] || name}${target ? ` “${target}”` : ''}${extra}`;
    const state = result?.error ? 'err' : result?.refused ? 'refused' : 'ok';
    const mark = { ok: '✓', err: '✗', refused: '⊘' }[state];
    return h(`div.ai-step.${state}`, { title: result?.error || result?.message || '' }, `${mark} ${label}${state === 'refused' ? ' (recusado)' : ''}${state === 'err' ? ` — ${result.error}` : ''}`);
  }

  const open = () => { el.hidden = false; if (!log.childElementCount) reset(); else refreshConfig(); input.focus(); };
  const close = () => { el.hidden = true; };
  const toggle = () => (el.hidden ? open() : close());
  return { el, open, close, toggle, isOpen: () => !el.hidden, refreshConfig };
}
