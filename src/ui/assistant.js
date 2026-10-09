/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/assistant.js — ABA DO AGENTE (chat de IA dentro do editor)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Um painel próprio, encaixado à direita do canvas. Você escreve ("deixa o botão com cantos de 12px", "monta
 *  um rodapé"), o agente lê o design com as ferramentas de agent/schema.js e altera com a sua permissão (ou
 *  direto, com "Fazer sem perguntar"); cada alteração sai com Ctrl+Z.
 *
 *  O que ele guarda (só neste navegador, em localStorage — nada vai para o arquivo do projeto):
 *    - CONVERSAS: várias por projeto, com título, modelo escolhido e histórico. Reabrir continua de onde parou.
 *    - MEMÓRIA do projeto: notas curtas ("a marca usa azul #2f6ae0") que o agente grava com a ferramenta
 *      `remember` ou que você escreve. Vão junto em todo pedido, então ele lembra entre conversas.
 *  O MODELO é escolhido por conversa no topo do painel (lista da sua conta, ou qualquer nome); sem escolha, vale o
 *  das Configurações.
 *
 *  COMO FUNCIONA (o "laço do agente"):
 *    1. manda a conversa + ferramentas + memória para POST /api/agent/chat (o servidor junta docs/AGENTE.md e usa
 *       a SUA chave, que fica só no seu computador);
 *    2. a resposta chega EM TEMPO REAL (streaming, NDJSON): o texto aparece enquanto o modelo escreve e o raciocínio
 *       vai para um bloco "Pensando… 12 s" recolhível. "Parar" fecha a conexão e o servidor aborta o pedido à API;
 *    3. se a resposta pede ferramentas, o runner executa cada uma no editor e devolve o resultado;
 *    4. repete até a IA responder só com texto (no máximo MAX_STEPS rodadas por mensagem).
 *  SUBAGENTES (delegate_task, agent/subagents.js): o agente divide um trabalho grande em até 4 ajudantes que rodam
 *  este mesmo laço em paralelo, cada um num cartão recolhível, com travas por camada. JEV (agent/jev.js): segunda
 *  opinião rápida (escolher, dar nota, conferir), oferecida só se o servidor tiver a chave.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { openAiTools, toolByName } from '../agent/schema.js';
import { DELEGATE_TOOL, SUBAGENT_STEPS, normalizeTasks, createLayerLocks, runSubagents, subagentBrief } from '../agent/subagents.js';
import { JEV_TOOLS, isJevTool } from '../agent/jev.js';
import { showMenu, askText } from './menus.js';

/** Máximo de rodadas "IA pede ferramenta → editor responde" por mensagem (evita laço infinito e gasto à toa). */
const MAX_STEPS = 30;
/** Resultados de ferramenta maiores que isso são cortados antes de voltar à IA (economiza tokens). */
const MAX_RESULT = 24000;
/** Onde as conversas e a memória ficam guardadas. */
const STORE_KEY = 'stylo.agent.v1';
/** Marca onde começa o contexto do editor anexado à mensagem (não aparece na conversa). */
const CONTEXT_MARK = '\n\n[Contexto do editor';
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
/**
 * Lê uma resposta NDJSON (um JSON por linha) enquanto ela chega e chama `onEvent` para cada linha.
 * Linhas cortadas entre dois pedaços são juntadas; linhas inválidas são ignoradas.
 * @param {ReadableStream<Uint8Array>} body
 * @param {(ev: object) => void} onEvent  pode lançar (interrompe a leitura)
 */
export async function readNdjson(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const line = (l) => { if (!l.trim()) return; let ev; try { ev = JSON.parse(l); } catch { return; } onEvent(ev); };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); line(l); }
    }
    line(buf + decoder.decode());
  } finally {
    reader.releaseLock?.();
  }
}
/** Título automático de uma conversa a partir da 1ª mensagem. */
export const titleFrom = (text) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > 42 ? `${t.slice(0, 40).trim()}…` : t || 'Nova conversa';
};

/** Ferramenta só do agente interno: guardar uma nota na memória do projeto. */
const REMEMBER_TOOL = {
  type: 'function',
  function: {
    name: 'remember',
    description: 'Guarda uma nota curta na memória deste projeto (decisões, preferências da pessoa, padrões da marca: "títulos em 52px", "o botão primário é azul #2f6ae0"). A memória vai junto em todas as próximas conversas. Use quando a pessoa pedir para lembrar algo ou quando combinar uma regra que vale para o projeto todo.',
    parameters: { type: 'object', properties: { note: { type: 'string', description: 'A nota, em uma frase.' } }, required: ['note'] },
  },
};

/** Nome amigável de cada ferramenta na conversa. */
const TOOL_LABEL = {
  get_document: 'Leu o projeto', get_layer: 'Leu uma camada', get_code: 'Leu o código', find_layers: 'Procurou camadas',
  get_selection: 'Leu a seleção', select_layers: 'Selecionou camadas', update_layer: 'Alterou', create_layer: 'Criou',
  delete_layers: 'Apagou', move_layer: 'Moveu', undo: 'Desfez', build_layout: 'Montou', search_icons: 'Procurou ícones',
  insert_icon: 'Inseriu o ícone', list_fonts: 'Consultou fontes', create_color_styles: 'Criou estilos de cor', create_page: 'Criou a página',
  switch_page: 'Abriu a página', set_responsive: 'Ajustou no breakpoint', set_state: 'Ajustou o estado', remember: 'Guardou na memória',
  delegate_task: 'Criou subagentes', jev_choose: 'Pediu ao Jev para escolher', jev_score: 'Pediu nota ao Jev', jev_check: 'Conferiu com o Jev',
};

/** Lê/grava o estado guardado (conversas + memória). Navegador sem localStorage: tudo vive só na memória. */
function loadSaved() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (data && Array.isArray(data.sessions)) return { sessions: data.sessions, memory: data.memory || {}, current: data.current || null };
  } catch { /* sem armazenamento: começa vazio */ }
  return { sessions: [], memory: {}, current: null };
}

/**
 * Cria o painel.
 * @param {object} deps
 * @param {object} deps.store
 * @param {{ run: Function }} deps.runner
 * @param {() => void} deps.openSettings  abre as Configurações numa seção ('ai', 'keys')
 * @param {HTMLElement} deps.stage  onde o painel se encaixa
 * @param {{ setAuto: Function, isAuto: Function }} [deps.approve]  para a opção "Fazer sem perguntar"
 * @param {object} [deps.prefs]  preferências (lembra a opção) · @param {() => void} [deps.savePrefs]
 * @returns {{ el: HTMLElement, toggle: () => void, open: () => void, close: () => void, isOpen: () => boolean }}
 */
export function createAssistant({ store, runner, openSettings, stage, approve, prefs = {}, savePrefs = () => {} }) {
  const saved = loadSaved();
  let busy = false;
  let aborter = null;
  let config = null; // { model, baseUrl, provider, needsKey }
  let modelList = null; // modelos da conta (cache)
  const persist = () => {
    saved.sessions = saved.sessions.slice(0, 60);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(saved)); } catch { /* cheio ou bloqueado: segue só na memória */ }
  };
  /** Projeto aberto: as conversas e a memória são separadas por projeto (pelo nome). */
  const project = () => store.state.doc?.name || 'Sem nome';
  const memory = () => (saved.memory[project()] ||= []);
  const sessionsHere = () => saved.sessions.filter((s) => s.project === project()).sort((a, b) => b.updated - a.updated);
  let session = null;

  function newSession() {
    session = { id: `s${Date.now().toString(36)}`, title: 'Nova conversa', project: project(), model: '', messages: [], updated: Date.now() };
    saved.sessions.unshift(session);
    saved.current = session.id;
    persist();
    renderAll();
  }
  function useSession(id) {
    const s = saved.sessions.find((x) => x.id === id);
    if (!s) return;
    if (busy) aborter?.abort();
    session = s;
    saved.current = s.id;
    persist();
    renderAll();
  }
  /** Conversa ativa (cria uma se o projeto ainda não tem). */
  const ensureSession = () => {
    if (session && session.project === project()) return session;
    const last = saved.sessions.find((s) => s.id === saved.current && s.project === project()) || sessionsHere()[0];
    if (last) { session = last; return session; }
    newSession();
    return session;
  };
  const touch = () => { session.updated = Date.now(); persist(); };

  // ---------------------------------------------------------------- elementos
  const log = h('div.ai-log', { role: 'log', 'aria-live': 'polite' });
  const input = h('textarea.ai-input', { rows: 2, placeholder: 'Peça uma mudança, uma revisão ou uma tela nova… (Enter envia, Shift+Enter quebra linha)', 'aria-label': 'Mensagem para o agente' });
  const sendBtn = h('button.ai-send', { type: 'button', title: 'Enviar (Enter)', 'aria-label': 'Enviar', onclick: () => submit() }, ico('send', 16));
  const stopBtn = h('button.btn.small.ai-stop', { type: 'button', hidden: true, onclick: () => aborter?.abort() }, 'Parar');
  const modelEl = h('span.ai-model');
  const modelBtn = h('button.ai-model-btn', { type: 'button', 'aria-haspopup': 'menu', title: 'Modelo desta conversa', onclick: (e) => modelMenu(e) },
    h('span.ai-dot'), modelEl, ico('chevron', 11));
  const titleEl = h('button.ai-session', { type: 'button', 'aria-haspopup': 'menu', title: 'Conversas deste projeto', onclick: (e) => sessionMenu(e) });
  const memList = h('ul.ai-mem-list');
  const memCount = h('span.ai-mem-count');
  const memBox = h('details.ai-mem', h('summary', ico('bookmark', 13), ' Memória do projeto ', memCount),
    memList,
    h('button.btn.small', { type: 'button', onclick: async () => {
      const note = await askText({ title: 'Lembrar no projeto', label: 'Uma regra ou preferência (ex.: "botões com cantos de 10px")', confirm: 'Guardar' });
      if (note) { addMemory(note); }
    } }, ico('plus', 12), ' Adicionar nota'));
  // FAZER SEM PERGUNTAR: as alterações do agente valem direto (sem a janela de permissão); Ctrl+Z continua
  // desfazendo cada uma. Lembrada nas preferências. Não vale para programas do MCP (esses sempre perguntam).
  const autoInput = h('input', { type: 'checkbox', checked: !!prefs.agentAuto });
  const syncAuto = () => approve?.setAuto?.('Assistente', autoInput.checked);
  autoInput.addEventListener('change', () => { prefs.agentAuto = autoInput.checked; savePrefs(); syncAuto(); });
  syncAuto();
  const autoEl = h('label.ai-auto', { title: 'Ligado: o agente altera o design direto, sem perguntar (Ctrl+Z desfaz cada alteração). Desligado: pede permissão a cada alteração.' },
    autoInput, h('span', 'Fazer sem perguntar'));
  const chips = h('div.ai-chips');
  const el = h('section.ai-panel', { hidden: true, 'aria-label': 'Agente' },
    h('header.ai-head',
      h('span.ai-title', ico('sparkle', 15), 'Agente'),
      titleEl,
      h('div.spacer'),
      h('button.icon-btn.small', { type: 'button', title: 'Nova conversa', 'aria-label': 'Nova conversa', onclick: () => newSession() }, ico('plus', 14)),
      h('button.icon-btn.small', { type: 'button', title: 'Provedores, chaves e modelo padrão', 'aria-label': 'Configurar agente', onclick: () => openSettings('ai') }, ico('settings', 14)),
      h('button.icon-btn.small', { type: 'button', title: 'Fechar', 'aria-label': 'Fechar agente', onclick: () => close() }, ico('x', 14))),
    h('div.ai-bar', modelBtn, h('div.spacer'), autoEl),
    memBox,
    log,
    h('div.ai-compose', chips, h('div.ai-box', input, h('div.ai-actions', stopBtn, sendBtn))));
  stage.append(el);

  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // atalhos do canvas (Delete, letras) não podem disparar enquanto se digita aqui
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    if (e.key === 'Escape') close();
  });

  /** Rola a conversa até o fim (só se a pessoa já estava perto do fim: não puxa quem subiu para ler). */
  const scrollEnd = () => { if (log.scrollHeight - log.scrollTop - log.clientHeight < 160) log.scrollTop = log.scrollHeight; };
  /** Acrescenta uma linha na conversa e rola até ela. */
  const add = (node) => { log.append(node); log.scrollTop = log.scrollHeight; return node; };
  /** Texto da IA → parágrafos, com `código` destacado (sem HTML vindo da IA: tudo vira texto). */
  const rich = (text) => String(text || '').split(/\n{2,}/).map((para) => h('p', ...para.split(/(`[^`]+`)/).map((part) =>
    (part.startsWith('`') && part.endsWith('`') ? h('code', part.slice(1, -1)) : part.replace(/\*\*(.+?)\*\*/g, '$1')))));

  // ---------------------------------------------------------------- memória
  function addMemory(note) {
    const n = String(note || '').trim().slice(0, 300);
    if (!n) return false;
    const list = memory();
    if (!list.includes(n)) list.push(n);
    if (list.length > 60) list.shift();
    persist();
    renderMemory();
    return true;
  }
  function renderMemory() {
    const list = memory();
    memCount.textContent = list.length ? `(${list.length})` : '';
    memList.replaceChildren(...(list.length ? list.map((n, i) => h('li', h('span', n), h('button.icon-btn.small', {
      type: 'button', 'aria-label': `Esquecer: ${n}`, title: 'Esquecer', onclick: () => { list.splice(i, 1); persist(); renderMemory(); },
    }, ico('x', 12)))) : [h('li.muted', 'Nada guardado ainda. Diga "lembre que…" ou adicione uma nota.')]));
  }

  // ---------------------------------------------------------------- modelo
  const currentModel = () => session?.model || config?.model || '';
  function renderModel() {
    modelEl.textContent = currentModel();
    modelBtn.title = `Modelo desta conversa${session?.model ? '' : ' (padrão das Configurações)'}${config?.baseUrl ? ` · ${config.baseUrl}` : ''}`;
  }
  async function modelMenu(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const pick = (m) => { ensureSession(); session.model = m; touch(); renderModel(); };
    if (!modelList) {
      try {
        const res = await fetch('/api/agent/models');
        const data = await res.json();
        modelList = res.ok ? data.models || [] : [];
      } catch { modelList = []; }
    }
    const items = [{ heading: true, label: config?.provider ? `Modelos · ${config.provider}` : 'Modelos' },
      { label: `Padrão: ${config?.model || '—'}`, checked: !session?.model, onClick: () => pick('') }];
    const recent = [...new Set(saved.sessions.map((s) => s.model).filter(Boolean))].slice(0, 5);
    const list = [...new Set([...recent, ...modelList])].filter((m) => m !== config?.model).slice(0, 40);
    // modelos testados em Configurações → "Testar modelo": ✓ funcionou (com o tempo do 1º pedaço), ✗ não serve
    const mark = (m) => { const t = config?.tested?.[m]; return !t ? '' : t.ok ? `  ✓ ${(t.firstTokenMs / 1000).toFixed(1).replace('.', ',')} s` : '  ✗'; };
    for (const m of list) items.push({ label: `${m}${mark(m)}`, checked: session?.model === m, onClick: () => pick(m) });
    if (!modelList.length) items.push({ label: 'Lista indisponível (confira a chave nas Configurações)', disabled: true });
    items.push('sep',
      { label: 'Outro modelo…', icon: 'edit', onClick: async () => { const m = await askText({ title: 'Modelo desta conversa', label: 'Nome exato do modelo (ex.: gpt-4.1, qwen2.5:7b)', value: currentModel(), confirm: 'Usar' }); if (m) pick(m.trim()); } },
      { label: 'Provedores e chaves…', icon: 'settings', onClick: () => openSettings('ai') });
    showMenu(r.left, r.bottom + 6, items);
  }

  // ---------------------------------------------------------------- conversas
  function sessionMenu(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const here = sessionsHere();
    const when = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'agora' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };
    const items = [{ heading: true, label: `Conversas · ${project()}` }];
    for (const s of here.slice(0, 15)) items.push({ label: `${s.title} · ${when(s.updated)}`, checked: s.id === session?.id, onClick: () => useSession(s.id) });
    items.push('sep', { label: 'Nova conversa', icon: 'plus', onClick: () => newSession() });
    if (session) {
      items.push({ label: 'Renomear esta conversa…', icon: 'edit', onClick: async () => { const t = await askText({ title: 'Nome da conversa', label: 'Nome', value: session.title, confirm: 'Salvar' }); if (t) { session.title = t; touch(); renderHead(); } } },
        { label: 'Apagar esta conversa', icon: 'trash', danger: true, onClick: () => {
          saved.sessions = saved.sessions.filter((s) => s.id !== session.id);
          session = null; persist(); ensureSession(); renderAll();
        } });
    }
    showMenu(r.left, r.bottom + 6, items);
  }
  const renderHead = () => { titleEl.replaceChildren(h('span', session?.title || 'Nova conversa'), ico('chevron', 11)); };

  /** Redesenha a conversa guardada (mensagens do usuário, respostas e o que cada ferramenta fez). */
  function renderLog() {
    log.replaceChildren();
    const msgs = session?.messages || [];
    if (!msgs.length) {
      add(h('div.ai-hello', h('p', 'Oi! Eu conheço o Stylo por dentro: leio o seu design, monto telas e ajusto o CSS. Selecione algo no canvas e diga o que quer, por exemplo:'),
        h('ul', h('li', '“deixa este botão com cantos de 12px”'), h('li', '“no Celular, empilha o hero e deixa o botão com largura total”'), h('li', '“cria um rodapé com 3 colunas de links”'), h('li', '“lembre que títulos usam 52px”'))));
    }
    const calls = new Map();
    for (const m of msgs) {
      if (m.role === 'user') add(h('div.ai-msg.user', rich(String(m.content).split(CONTEXT_MARK)[0])));
      else if (m.role === 'assistant') {
        if (m.reasoning) add(thinkBlock(m.reasoning, m.thinkMs || 0).el);
        const reply = cleanReply(m.content);
        if (reply) add(h('div.ai-msg.bot', rich(reply)));
        for (const c of m.tool_calls || []) calls.set(c.id, c);
      } else if (m.role === 'tool') {
        const c = calls.get(m.tool_call_id);
        let result = {};
        try { result = JSON.parse(m.content); } catch { /* resultado cortado */ }
        const args = parseArgs(c?.function?.arguments);
        // subagentes: os cartões voltam (fechados) com o status e o resumo de cada um
        if (c?.function?.name === 'delegate_task' && Array.isArray(result.subagents)) {
          const tasks = Array.isArray(args?.tasks) ? args.tasks : [];
          add(h('div.ai-subs', h('div.ai-subs-head', ico('layers', 12), `${result.subagents.length} subagente${result.subagents.length > 1 ? 's' : ''}`),
            ...result.subagents.map((r, i) => subCard({ name: r.name, task: String(tasks[i]?.task || tasks[i] || '') }, r.status, { summary: r.summary || r.error || '', steps: r.steps || 0 }).el)));
        } else add(stepLine(c?.function?.name, args, result));
      }
    }
    if (config?.needsKey) add(setupBox());
  }
  function renderChips() {
    const sel = store.ui.selection.map((id) => store.get(id)).filter(Boolean);
    chips.replaceChildren(
      h('span.ai-chip', ico('layers', 11), sel.length ? (sel.length === 1 ? sel[0].name : `${sel.length} camadas`) : 'Nada selecionado'),
      h('span.ai-chip', store.page()?.name || ''),
      ...(store.ui.bp ? [h('span.ai-chip.on', `Breakpoint: ${store.ui.bp}`)] : []));
  }
  function renderAll() { ensureSession(); renderHead(); renderModel(); renderMemory(); renderLog(); renderChips(); }

  const setupBox = () => {
    const who = { openai: 'da OpenAI', nvidia: 'da NVIDIA (nvapi-...)' }[config?.provider] || 'da API';
    return h('div.ai-setup', h('p', `Para conversar, o agente precisa da sua chave ${who} (ela fica só neste computador).`),
      h('button.btn.primary.small', { type: 'button', onclick: () => openSettings('keys') }, 'Configurar a chave'));
  };

  /** Lê a configuração do servidor (modelo padrão, provedor, se falta a chave). */
  async function refreshConfig() {
    try {
      config = await (await fetch('/api/agent/config')).json();
      modelList = null;
    } catch {
      config = null;
      if (!log.querySelector('.ai-setup')) add(h('div.ai-setup', h('p', 'O agente precisa do servidor do app: abra com "npm start".')));
    }
    renderModel();
    log.querySelector('.ai-setup')?.remove();
    if (config?.needsKey) add(setupBox());
    return config;
  }

  /** Contexto do editor anexado a cada pedido (onde a pessoa está e o que selecionou), sem aparecer na conversa. */
  function context() {
    const sel = store.ui.selection.map((id) => store.get(id)).filter(Boolean);
    const page = store.page();
    const screens = page.children.filter((n) => n.type === 'frame' || n.type === 'section').slice(0, 12)
      .map((n) => `“${n.name}” (${n.type}, ${Math.round(n.w)}×${Math.round(n.h)}, id ${n.id})`);
    const colors = (store.state.doc.styles?.colors || []).slice(0, 16).map((c) => `${c.name} ${c.color} (id ${c.id})`);
    return `${CONTEXT_MARK} — página “${page.name}”; telas na página: ${screens.length ? screens.join(', ') : 'nenhuma (página vazia)'}`
      + `; seleção: ${sel.length ? sel.map((n) => `“${n.name}” (${n.type}, id ${n.id})`).join(', ') : 'nada selecionado (se o pedido é criar algo, crie uma tela nova com build_layout)'}`
      + `${colors.length ? `; estilos de cor: ${colors.join(', ')}` : ''}${store.ui.bp ? `; breakpoint ativo: ${store.ui.bp}` : ''}]`;
  }

  // ---------------------------------------------------------------- conversa em tempo real (streaming)
  /** "12 s", "1 min 4 s". */
  const secs = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`; };

  /**
   * Bloco de raciocínio recolhível: "Pensando… 12 s" enquanto o modelo pensa (aberto, rolando sozinho), "Pensou por
   * 12 s" quando ele começa a responder (recolhe). Clicar abre/fecha.
   */
  function thinkBlock(text = '', ms = 0, live = false) {
    const label = h('span.ai-think-label', live ? 'Pensando…' : `Pensou por ${secs(ms)}`);
    const body = h('div.ai-think-body', text);
    const el = h('details.ai-think', { open: live }, h('summary', ico('sparkle', 11), label), body);
    if (live) el.classList.add('live');
    return { el, label, body };
  }

  /**
   * Uma rodada de chat em streaming: POST /api/agent/chat e lê a resposta NDJSON enquanto chega. `put` coloca nós na
   * conversa (antes do indicador), `status` muda o indicador. Devolve { message, reasoning, thinkMs, firstTokenMs }.
   * Erros (timeout, modelo sem ferramentas...) viram Error com a mensagem do servidor.
   */
  async function chatTurn({ messages, tools, model, subagent = false, signal, put, status }) {
    const started = Date.now();
    let think = null; // bloco de raciocínio desta rodada
    let thinkStart = 0, thinkEnd = 0;
    let bubble = null; // balão do texto (aparece no 1º pedaço de texto)
    let text = '';
    let gotAny = false;
    const timer = setInterval(() => {
      const now = Date.now();
      if (think && !thinkEnd) think.label.textContent = `Pensando… ${secs(now - thinkStart)}`;
      else if (!gotAny) status(`Esperando o modelo… ${secs(now - started)}`);
    }, 1000);
    const endThink = () => {
      if (!think || thinkEnd) return;
      thinkEnd = Date.now();
      think.label.textContent = `Pensou por ${secs(thinkEnd - thinkStart)}`;
      think.el.open = false;
      think.el.classList.remove('live');
    };
    try {
      const r = await fetch('/api/agent/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
        // as instruções (docs/AGENTE.md) quem põe é o servidor; aqui vão a conversa, as ferramentas e a memória
        body: JSON.stringify({ messages: messages.map(({ role, content, tool_calls, tool_call_id }) => ({ role, content, tool_calls, tool_call_id })), tools, model: model || undefined, memory: memory(), subagent }),
      });
      if (!r.ok || !r.body) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${r.status}`);
      }
      let done = null;
      await readNdjson(r.body, (ev) => {
        if (ev.type === 'reasoning') {
          gotAny = true;
          // o bloco "Pensando… N s" já mostra o que acontece: o indicador de baixo some
          if (!think) { think = thinkBlock('', 0, true); thinkStart = Date.now(); put(think.el); status(''); }
          if (!thinkEnd) { think.body.append(ev.text); think.body.scrollTop = think.body.scrollHeight; }
        } else if (ev.type === 'text') {
          gotAny = true;
          endThink();
          text += ev.text;
          if (!bubble) { bubble = h('div.ai-msg.bot.streaming'); put(bubble); status(''); }
          bubble.textContent = text;
          scrollEnd();
        } else if (ev.type === 'note') put(h('div.ai-note', ev.text));
        else if (ev.type === 'done') done = ev;
        else if (ev.type === 'error') throw Object.assign(new Error(ev.error), { code: ev.code });
      });
      if (!done) throw new Error('A conexão com o servidor caiu no meio da resposta. Tente de novo.');
      endThink();
      const reply = cleanReply(done.message?.content);
      // texto final bonito (código destacado); sem texto, some o balão vazio
      if (bubble) { if (reply) { bubble.classList.remove('streaming'); bubble.replaceChildren(...rich(reply)); } else bubble.remove(); } else if (reply) put(h('div.ai-msg.bot', rich(reply)));
      return { message: done.message || { content: '' }, reasoning: done.reasoning || '', thinkMs: thinkEnd ? thinkEnd - thinkStart : 0, firstTokenMs: done.firstTokenMs };
    } finally {
      clearInterval(timer);
      endThink();
      bubble?.classList.remove('streaming');
    }
  }

  /**
   * O LAÇO DO AGENTE (o mesmo para o agente principal e para cada subagente): pede uma resposta, executa as
   * ferramentas pedidas, devolve os resultados e repete até a IA responder só com texto ou acabar os passos.
   * @returns {Promise<{ reply: string, steps: number, capped: boolean }>}
   */
  async function agentLoop({ messages, tools, model, maxSteps, signal, put, status, execute, onChange = () => {}, subagent = false }) {
    let reply = '';
    for (let step = 0; step < maxSteps; step++) {
      const turn = await chatTurn({ messages, tools, model, subagent, signal, put, status });
      const m = turn.message;
      const calls = Array.isArray(m.tool_calls) ? m.tool_calls : [];
      messages.push({ role: 'assistant', content: m.content || '', ...(calls.length ? { tool_calls: calls } : {}),
        ...(turn.reasoning ? { reasoning: turn.reasoning.slice(0, 6000), thinkMs: turn.thinkMs } : {}) });
      onChange();
      reply = cleanReply(m.content) || reply;
      if (!calls.length) {
        if (looksLikeTextToolCall(m.content)) put(h('div.ai-note', `O modelo “${model || currentModel()}” escreveu a ferramenta como texto em vez de usá-la. Troque por um modelo com suporte a ferramentas (“tool calling”) no topo do painel.`));
        return { reply, steps: step + 1, capped: false };
      }
      for (const call of calls) {
        if (signal.aborted) throw Object.assign(new DOMException('parado', 'AbortError'), { steps: step + 1 });
        const args = parseArgs(call.function?.arguments);
        const name = call.function?.name;
        status(`${TOOL_LABEL[name] || name}…`);
        const result = !args ? { error: 'Os argumentos não são um JSON válido.' } : await execute(name, args, call);
        if (name !== 'delegate_task') put(stepLine(name, args, result));
        // imagem (get_image): o chat não recebe imagens aqui; manda só o resto e um aviso
        const { _image, ...plain } = result || {};
        if (_image) plain.note = 'A imagem foi gerada, mas o agente interno não consegue enviá-la ao modelo. Confie nos dados (get_layer/get_code).';
        const json = JSON.stringify(plain);
        messages.push({ role: 'tool', tool_call_id: call.id, content: json.length > MAX_RESULT ? `${json.slice(0, MAX_RESULT)}… (cortado)` : json });
        onChange();
      }
      status('Pensando…');
    }
    return { reply, steps: maxSteps, capped: true };
  }

  /** Ferramenta do Jev: quem chama a API é o servidor (com a chave guardada lá). */
  async function runJev(name, args) {
    try {
      const r = await fetch('/api/agent/jev', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tool: name, args }) });
      const data = await r.json().catch(() => ({}));
      return r.ok ? data : { error: data.error || `Erro ${r.status}` };
    } catch (err) { return { error: `Não consegui falar com o servidor (${err.message}).` }; }
  }

  /** As ferramentas oferecidas: as do editor + remember + delegate_task (+ Jev, se houver chave). */
  const mainTools = () => [...openAiTools(), REMEMBER_TOOL, DELEGATE_TOOL, ...(config?.jev ? JEV_TOOLS : [])];
  /** As dos subagentes: sem remember e sem delegate_task (não criam outros subagentes). */
  const subTools = () => [...openAiTools(), ...(config?.jev ? JEV_TOOLS : [])];

  /** Resumo curto do projeto para os subagentes (o "contexto mínimo"). */
  async function docSummary() {
    const doc = await runner.run('get_document', { depth: 3 }, 'Assistente');
    const json = JSON.stringify(doc);
    return json.length > 6000 ? `${json.slice(0, 6000)}… (cortado: use get_document/get_layer para ver mais)` : json;
  }

  /**
   * delegate_task: cria os subagentes, mostra um cartão para cada um (nome, status, passos, Parar) e roda todos em
   * paralelo com as travas por camada. Devolve à IA principal o resumo de cada um.
   */
  async function runDelegation(args, signal, put) {
    let tasks;
    try { tasks = normalizeTasks(args); } catch (err) { return { error: err.message }; }
    const locks = createLayerLocks({ isWithin: (id, scope) => scope.includes(id) || scope.some((sc) => store.isAncestor(sc, id)) });
    const summary = await docSummary();
    const group = h('div.ai-subs', h('div.ai-subs-head', ico('layers', 12), `${tasks.length} subagente${tasks.length > 1 ? 's' : ''} trabalhando em paralelo`));
    put(group);
    const results = await runSubagents(tasks, async (t) => {
      const card = subCard(t, 'running');
      group.append(card.el);
      // cada subagente tem o próprio Parar (e para também se a conversa inteira parar)
      const own = new AbortController();
      const stopAll = () => own.abort();
      signal.addEventListener('abort', stopAll, { once: true });
      card.onStop(() => own.abort());
      const messages = [{ role: 'user', content: subagentBrief(t, summary) }];
      let steps = 0;
      try {
        const out = await agentLoop({
          messages, tools: subTools(), model: t.model || currentModel(), maxSteps: SUBAGENT_STEPS, signal: own.signal, subagent: true,
          put: (node) => card.add(node), status: (s) => card.status(s),
          onChange: () => { steps = messages.filter((m) => m.role === 'tool').length; card.steps(steps); },
          execute: async (name, a) => {
            if (isJevTool(name)) return runJev(name, a);
            if (toolByName(name)?.write) {
              const lock = locks.acquire(t.id, t.name, a, t.scope);
              if (!lock.ok) return { error: lock.error };
            }
            return runner.run(name, a, `Assistente · ${t.name}`);
          },
        });
        const text = out.reply || (out.capped ? 'Parei no limite de passos.' : 'Terminei.');
        card.finish('done', text);
        return { summary: out.capped ? `${text} (parou no limite de ${SUBAGENT_STEPS} passos)` : text, steps };
      } catch (err) {
        const stopped = err.name === 'AbortError';
        card.finish(stopped ? 'stopped' : 'error', stopped ? 'Parado.' : err.message);
        throw Object.assign(err, { steps });
      } finally {
        locks.release(t.id);
        signal.removeEventListener('abort', stopAll);
      }
    }, { signal });
    return { ok: true, subagents: results };
  }

  /** Cartão recolhível de um subagente (ao vivo ou redesenhado do histórico). */
  function subCard(t, state, { summary = '', steps = 0 } = {}) {
    const LABEL = { running: 'rodando', done: 'feito', error: 'erro', stopped: 'parado' };
    const badge = h('span.ai-sub-state');
    const stepsEl = h('span.ai-sub-steps');
    const statusEl = h('div.ai-sub-status');
    const body = h('div.ai-sub-body');
    const result = h('div.ai-sub-result');
    let stopFn = () => {};
    const stop = h('button.btn.small.ai-sub-stop', { type: 'button', title: `Parar “${t.name}”`, onclick: (e) => { e.preventDefault(); stopFn(); } }, 'Parar');
    const el = h('details.ai-sub', { open: false },
      h('summary', h('span.ai-sub-dot'), h('strong.ai-sub-name', t.name), badge, stepsEl, h('span.spacer'), stop),
      h('div.ai-sub-task', t.task), statusEl, body, result);
    const setState = (s) => {
      el.dataset.state = s; badge.textContent = LABEL[s] || s;
      stop.hidden = s !== 'running';
      if (s !== 'running') statusEl.textContent = '';
    };
    const setSteps = (n) => { stepsEl.textContent = `${n} passo${n === 1 ? '' : 's'}`; };
    setState(state); setSteps(steps);
    if (summary) result.replaceChildren(...rich(summary));
    return {
      el,
      add: (node) => { body.append(node); scrollEnd(); },
      status: (s) => { statusEl.textContent = s; },
      steps: setSteps,
      onStop: (fn) => { stopFn = fn; },
      finish: (s, text) => {
        setState(s);
        // a última resposta do subagente vira o resumo do cartão (sem repetir o mesmo texto logo acima)
        const last = body.lastElementChild;
        if (last?.matches('.ai-msg.bot') && last.textContent.trim() === cleanReply(text)) last.remove();
        result.replaceChildren(...rich(text));
      },
    };
  }

  /** Envia a mensagem digitada e roda o laço do agente. */
  async function submit() {
    const text = input.value.trim();
    if (!text || busy) return;
    ensureSession();
    const s = session; // a conversa pode mudar no meio; as respostas vão para a que enviou
    input.value = '';
    log.querySelector('.ai-hello')?.remove();
    add(h('div.ai-msg.user', rich(text)));
    if (!s.messages.length) s.title = titleFrom(text);
    s.messages.push({ role: 'user', content: text + context() });
    touch(); renderHead();
    busy = true;
    aborter = new AbortController();
    const signal = aborter.signal;
    sendBtn.disabled = true;
    stopBtn.hidden = false;
    const thinking = add(h('div.ai-thinking', 'Esperando o modelo…'));
    const here = () => session === s;
    // insere antes do indicador (se a conversa foi redesenhada no meio, o indicador volta para o fim)
    const put = (node) => { if (!here()) return; if (!thinking.isConnected) log.append(thinking); log.insertBefore(node, thinking); scrollEnd(); };
    const status = (t) => { thinking.textContent = t; };
    try {
      const out = await agentLoop({
        messages: s.messages, tools: mainTools(), model: s.model, maxSteps: MAX_STEPS, signal, put, status, onChange: touch,
        execute: (name, args) => name === 'remember' ? (addMemory(args.note) ? { ok: true, remembered: args.note } : { error: 'Nota vazia.' })
          : name === 'delegate_task' ? runDelegation(args, signal, put)
            : isJevTool(name) ? runJev(name, args)
              : runner.run(name, args, 'Assistente'),
      });
      if (out.capped) put(h('div.ai-note', 'Parei aqui para não rodar sem fim. Mande "continua" se quiser que eu siga.'));
    } catch (err) {
      put(h('div.ai-error', err.name === 'AbortError' ? 'Parado.' : err.message));
    } finally {
      thinking.remove();
      busy = false;
      aborter = null;
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
            : name === 'create_page' ? ` “${args?.name || ''}”` : name === 'remember' ? `: “${args?.note || ''}”`
              : isJevTool(name) && !result?.error ? ` → ${result?.choice ?? result?.verdict ?? result?.mostLikelyLabel ?? '?'}${result?.decision ? ` (${result.decision})` : ''}` : '';
    const label = `${TOOL_LABEL[name] || name || 'ferramenta'}${target ? ` “${target}”` : ''}${extra}`;
    const state = result?.error ? 'err' : result?.refused ? 'refused' : 'ok';
    const mark = { ok: '✓', err: '✗', refused: '⊘' }[state];
    return h(`div.ai-step.${state}`, { title: result?.error || result?.message || '' }, `${mark} ${label}${state === 'refused' ? ' (recusado)' : ''}${state === 'err' ? ` — ${result.error}` : ''}`);
  }

  // outro projeto aberto: troca para as conversas e a memória dele
  let lastProject = project();
  store.subscribe((reasons) => {
    // acompanha a troca de projeto mesmo com o painel fechado (senão, ao abrir, a 1ª alteração do agente parecia
    // "troca de projeto" e redesenhava a conversa no meio do trabalho)
    if (reasons.has('doc') && project() !== lastProject) {
      lastProject = project();
      session = null;
      if (!el.hidden) renderAll();
      return;
    }
    if (el.hidden) return;
    if (reasons.has('selection') || reasons.has('bp') || reasons.has('view')) renderChips();
  });

  const open = () => {
    if (project() !== lastProject) { lastProject = project(); session = null; }
    el.hidden = false;
    document.body.classList.add('ai-open');
    renderAll();
    refreshConfig();
    input.focus();
  };
  const close = () => { el.hidden = true; document.body.classList.remove('ai-open'); };
  const toggle = () => (el.hidden ? open() : close());
  return { el, open, close, toggle, isOpen: () => !el.hidden, refreshConfig };
}
