/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  agent/stream.js — RESPOSTA DA IA EM TEMPO REAL (streaming) E CONTROLE DO "RACIOCÍNIO"
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Com `stream: true`, as APIs compatíveis com a OpenAI (OpenAI, NVIDIA NIM, Ollama...) mandam a resposta aos
 *  pedaços, no formato SSE ("data: {json}" por linha, terminando com "data: [DONE]"). Cada pedaço traz um "delta":
 *    - `content`: texto da resposta (pode vir com o raciocínio entre <think> e </think>, como no DeepSeek-R1);
 *    - `reasoning_content` ou `reasoning`: o raciocínio em campo separado (NIM, DeepSeek, Qwen, gpt-oss);
 *    - `tool_calls`: pedaços das chamadas de ferramenta (o nome vem uma vez; os argumentos vêm picados por `index`).
 *  Este arquivo junta tudo isso: o servidor repassa o texto e o raciocínio ao navegador enquanto chegam e, no fim,
 *  monta a mensagem completa (com as ferramentas). Também decide, por modelo, como pedir MENOS raciocínio à NVIDIA
 *  NIM (os modelos que "pensam, pensam e nunca dão em nada").
 *  Só lógica, sem DOM nem Node: o servidor e os testes importam este arquivo.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Leitor de SSE: recebe o texto em pedaços (que podem cortar uma linha no meio) e chama `onData` com o conteúdo de
 * cada evento `data:` completo. "[DONE]" vira `onData(null)`. Linhas de comentário (": ping") são ignoradas.
 * @param {(data: string|null) => void} onData
 * @returns {{ push: (chunk: string) => void, end: () => void }}
 */
export function createSseReader(onData) {
  let buf = '';
  let lines = [];
  const flush = () => {
    if (!lines.length) return;
    const data = lines.join('\n');
    lines = [];
    onData(data.trim() === '[DONE]' ? null : data);
  };
  const line = (raw) => {
    const l = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (l === '') return flush(); // linha em branco = fim do evento
    if (l.startsWith(':')) return; // comentário
    if (l.startsWith('data:')) lines.push(l.slice(5).replace(/^ /, ''));
    // outros campos (event:, id:, retry:) não são usados pelas APIs de chat
  };
  return {
    push(chunk) {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { line(buf.slice(0, i)); buf = buf.slice(i + 1); }
    },
    end() { if (buf) { line(buf); buf = ''; } flush(); },
  };
}

const OPEN = '<think>';
const CLOSE = '</think>';
/** Quantos caracteres do fim de `text` podem ser o começo de `tag` (para não cortar "<thi" + "nk>" ao meio). */
const partialTail = (text, tag) => {
  for (let n = Math.min(tag.length - 1, text.length); n > 0; n--) if (tag.startsWith(text.slice(-n))) return n;
  return 0;
};

/**
 * Junta os pedaços de UMA resposta de chat em streaming.
 * `add(json)` recebe cada objeto do SSE e devolve o que é novo para mostrar: `{ text, reasoning }` (strings, podem
 * ser vazias). `result()` devolve a mensagem completa: `{ content, reasoning, tool_calls, finish_reason, usage }`.
 * O raciocínio entre <think>…</think> dentro do `content` é separado do texto, mesmo se a tag vier cortada.
 */
export function createChatAccumulator() {
  let content = '';
  let reasoning = '';
  let inThink = false;
  let pending = ''; // pedaço guardado que pode ser o começo de uma tag
  let sawContent = false; // já veio texto "de verdade" (antes disso, um <think> no começo é raciocínio)
  let finish = null;
  let usage = null;
  const calls = []; // por index: { id, type, function: { name, arguments } }

  /** Separa texto e raciocínio de um pedaço de `content` (máquina de estados do <think>). */
  function splitContent(piece) {
    let s = pending + piece;
    pending = '';
    let text = '';
    let think = '';
    while (s) {
      if (inThink) {
        const i = s.indexOf(CLOSE);
        if (i >= 0) { think += s.slice(0, i); s = s.slice(i + CLOSE.length); inThink = false; continue; }
        const keep = partialTail(s, CLOSE);
        think += s.slice(0, s.length - keep);
        pending = s.slice(s.length - keep);
        break;
      }
      const i = s.indexOf(OPEN);
      if (i >= 0) { text += s.slice(0, i); s = s.slice(i + OPEN.length); inThink = true; continue; }
      const keep = partialTail(s, OPEN);
      text += s.slice(0, s.length - keep);
      pending = s.slice(s.length - keep);
      break;
    }
    if (!sawContent && !think) text = text.replace(/^\s+/, ''); // espaços antes da resposta não contam
    if (text) sawContent = true;
    return { text, think };
  }

  function addToolDelta(d, k) {
    const index = Number.isInteger(d.index) ? d.index : k;
    const c = (calls[index] ||= { id: '', type: 'function', function: { name: '', arguments: '' } });
    if (d.id) c.id = d.id;
    if (d.type) c.type = d.type;
    const fn = d.function || {};
    if (fn.name) c.function.name += c.function.name && c.function.name === fn.name ? '' : fn.name;
    if (fn.arguments !== undefined && fn.arguments !== null) {
      // servidores que mandam o objeto pronto (sem picar em texto)
      if (typeof fn.arguments === 'object') c.function.arguments = fn.arguments;
      else if (typeof c.function.arguments === 'string') c.function.arguments += fn.arguments;
    }
  }

  return {
    /** Um objeto do stream (chunk "chat.completion.chunk"). */
    add(json) {
      const out = { text: '', reasoning: '' };
      if (!json || typeof json !== 'object') return out;
      if (json.usage) usage = json.usage;
      const ch = json.choices?.[0];
      if (!ch) return out;
      if (ch.finish_reason) finish = ch.finish_reason;
      // respostas não-stream (algum servidor ignorou stream:true) chegam como "message" inteira
      const d = ch.delta || ch.message || {};
      const r = d.reasoning_content ?? d.reasoning;
      if (typeof r === 'string' && r) { reasoning += r; out.reasoning += r; }
      if (typeof d.content === 'string' && d.content) {
        const { text, think } = splitContent(d.content);
        content += text; reasoning += think;
        out.text += text; out.reasoning += think;
      }
      if (Array.isArray(d.tool_calls)) d.tool_calls.forEach(addToolDelta);
      return out;
    },
    /** Fim do stream: solta o que estava guardado esperando completar uma tag. */
    end() {
      const out = { text: '', reasoning: '' };
      if (pending) { if (inThink) { reasoning += pending; out.reasoning = pending; } else { content += pending; out.text = pending; } pending = ''; }
      return out;
    },
    /** Já chegou alguma coisa (texto, raciocínio ou ferramenta)? */
    started: () => !!(content || reasoning || calls.length),
    /** Já chegou resposta "de verdade" (texto ou ferramenta), não só raciocínio? */
    answering: () => !!(content.trim() || calls.some((c) => c?.function?.name)),
    result() {
      const tool_calls = calls.filter(Boolean).map((c, i) => ({ ...c, id: c.id || `call_${i}_${Date.now().toString(36)}`, function: { ...c.function } }));
      let text = content;
      let think = reasoning;
      // alguns modelos (DeepSeek-R1 na NIM) mandam só o "</think>" de fechamento, sem abrir: o que vem antes era raciocínio
      const j = text.indexOf(CLOSE);
      if (j >= 0) { think = [think, text.slice(0, j)].filter(Boolean).join('\n'); text = text.slice(j + CLOSE.length); }
      return { content: text.trim(), reasoning: think.trim(), tool_calls, finish_reason: finish, usage };
    },
  };
}

/**
 * Junta um stream SSE inteiro (texto) de uma vez: útil nos testes e para respostas já completas.
 * @param {string} body
 */
export function parseChatStream(body) {
  const acc = createChatAccumulator();
  const r = createSseReader((data) => { if (data) { try { acc.add(JSON.parse(data)); } catch { /* pedaço inválido: ignora */ } } });
  r.push(body);
  r.end();
  acc.end();
  return acc.result();
}

/**
 * Como pedir MENOS raciocínio a cada modelo da NVIDIA NIM (documentação "Reasoning Models" da NIM e cartões dos
 * modelos). Devolve `{ body, system, note }`: campos extras do pedido, uma linha para o INÍCIO da mensagem de
 * sistema e um aviso para a tela (modelos que não dá para desligar). Outros provedores: nada (a OpenAI recusa campos
 * desconhecidos).
 *   - Nemotron Super 49B v1 / Ultra 253B v1 → "detailed thinking off" na mensagem de sistema;
 *   - Nemotron v1.5 e Nemotron Nano v2 → "/no_think" na mensagem de sistema;
 *   - Nemotron 3, Qwen3, MiMo, GLM, Kimi → chat_template_kwargs { enable_thinking: false };
 *   - DeepSeek V3.1/V3.2 → chat_template_kwargs { thinking: false };
 *   - gpt-oss → reasoning_effort "low" (não desliga, só encurta);
 *   - DeepSeek-R1, QwQ e outros "só raciocínio" → não desliga: só o limite de tokens (aviso na tela).
 * @param {string} model
 * @param {{ provider?: string, limit?: boolean, maxTokens?: number }} [opts]
 */
export function reasoningParams(model, { provider = '', limit = true, maxTokens = 0 } = {}) {
  const m = String(model || '').toLowerCase();
  const out = { body: {}, system: '', note: '' };
  if (provider !== 'nvidia') return out;
  if (maxTokens > 0) out.body.max_tokens = maxTokens;
  if (!limit) return out;
  if (/nemotron/.test(m) && /v1\.5|nano.*v2/.test(m)) out.system = '/no_think';
  else if (/nemotron.*(super-49b-v1|ultra-253b-v1)/.test(m)) out.system = 'detailed thinking off';
  else if (/deepseek-v3\.[12]/.test(m)) out.body.chat_template_kwargs = { thinking: false };
  else if (/nemotron-3|qwen3|mimo|glm-?4\.[5-9]|glm-?5|kimi/.test(m)) out.body.chat_template_kwargs = { enable_thinking: false };
  else if (/gpt-oss/.test(m)) out.body.reasoning_effort = 'low';
  else if (/deepseek-r1|qwq|-thinking|reason/.test(m)) out.note = `O modelo “${model}” sempre raciocina antes de responder (não dá para desligar): pode demorar. Para mexer no design rápido, prefira um modelo “instruct”.`;
  return out;
}

/** O erro da API fala de um campo extra que ela não aceita? (aí tentamos de novo sem os extras) */
export const rejectsExtras = (status, detail) => status === 400 || status === 422
  ? /chat_template_kwargs|reasoning_effort|max_tokens|unrecognized|unexpected|extra (fields|inputs)|not permitted|unknown (field|param)/i.test(String(detail || ''))
  : false;

/** O erro da API diz que o modelo não aceita ferramentas? */
export const rejectsTools = (status, detail) => (status === 400 || status === 422 || status === 404)
  && /tool|function call/i.test(String(detail || ''));
