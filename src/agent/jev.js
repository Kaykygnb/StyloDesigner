/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  agent/jev.js — O JEV (TypeSafe) COMO "SEGUNDA OPINIÃO" RÁPIDA DO AGENTE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  O Jev é um modelo "System One" da TypeSafe: não escreve texto, só responde perguntas FECHADAS com
 *  probabilidades, em menos de meio segundo e quase de graça. O agente usa para decisões limitadas:
 *    - jev_choose: escolher entre opções que ele já tem (ex.: 3 paletas, 2 estruturas de página);
 *    - jev_score:  dar nota numa rubrica (ex.: "o contraste desta tela está bom?" de 1 a 5);
 *    - jev_check:  a evidência sustenta a afirmação? (ex.: "o rodapé tem 3 colunas" × os dados do get_layer).
 *  Quem chama a API é o SERVIDOR (server.js → POST /api/agent/jev), com a chave JEV_API_KEY guardada lá: a chave
 *  nunca vai para o navegador. Sem chave, estas ferramentas nem são oferecidas ao modelo.
 *  Formato da API (POST {url}, Bearer): { state, model, questions: { id: { type: choice|score|noul, instructions,
 *  criteria } } } → { answers: { id: { choice, probabilities, confidence, score, legend, noul } }, usage, model }.
 *  Este arquivo só monta os pedidos e lê as respostas (sem rede): o servidor e os testes importam.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Endereço padrão da API do Jev (TypeSafe System One). */
export const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
/** Modelo padrão do Jev. */
export const JEV_MODEL = 'jev-latest';
/** Aviso que vai junto de toda resposta: é um sinal, não uma ordem. */
const ADVISORY = 'Sinal consultivo (o Jev pode errar). decision: proceed = siga; confirm = confirme com a pessoa se for algo grande; review = julgue você mesmo.';

const text = (max, description) => ({ type: 'string', maxLength: max, description });
/** As 3 ferramentas do Jev no formato da OpenAI (o agente interno recebe só se houver chave). */
export const JEV_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'jev_choose',
      description: 'Segunda opinião rápida (Jev): escolhe a MELHOR entre 2 a 10 opções que você já tem (ex.: qual de 3 paletas combina com uma pizzaria; qual estrutura de hero funciona melhor). Devolve a escolha, a probabilidade de cada opção e "decision". Não gera texto. Mande só o contexto necessário.',
      parameters: {
        type: 'object',
        properties: {
          context: text(8000, 'Fatos relevantes (pedido da pessoa, restrições, dados do design). Só o necessário.'),
          question: text(1500, 'A pergunta, com uma única melhor resposta.'),
          options: {
            type: 'array', minItems: 2, maxItems: 10, description: 'As opções.',
            items: { type: 'object', properties: { id: { type: 'string', description: 'id curto, ex.: paleta_quente' }, description: text(800, 'O que a opção é.') }, required: ['id', 'description'] },
          },
        },
        required: ['context', 'question', 'options'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'jev_score',
      description: 'Segunda opinião rápida (Jev): dá uma nota numa rubrica que você define, do nível mais baixo ao mais alto (ex.: legibilidade do texto de 1 a 4). Uma dimensão por chamada. Devolve o nível mais provável, a nota esperada e "decision".',
      parameters: {
        type: 'object',
        properties: {
          context: text(8000, 'O que avaliar (dados das camadas, código, pedido).'),
          question: text(1500, 'A dimensão avaliada, ex.: "o contraste do texto com o fundo".'),
          levels: { type: 'array', minItems: 2, maxItems: 8, items: text(400), description: 'Níveis do pior ao melhor, com descrição concreta.' },
        },
        required: ['context', 'question', 'levels'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'jev_check',
      description: 'Segunda opinião rápida (Jev): a evidência sustenta a afirmação? Use para conferir o próprio trabalho antes de dizer "pronto" (ex.: afirmação "o cabeçalho tem logo, menu e botão" × evidência = resultado do get_layer). Devolve probabilidade, veredito yes/no/uncertain e "decision". Não é prova.',
      parameters: {
        type: 'object',
        properties: {
          claim: text(1500, 'Uma afirmação precisa e literal.'),
          evidence: text(8000, 'A evidência (só o trecho necessário).'),
        },
        required: ['claim', 'evidence'],
      },
    },
  },
];
/** Nomes das ferramentas do Jev. */
export const JEV_NAMES = JEV_TOOLS.map((t) => t.function.name);
/** É uma ferramenta do Jev? */
export const isJevTool = (name) => JEV_NAMES.includes(name);

const round = (n) => Math.round(Number(n || 0) * 1000) / 1000;
const ID_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/;
/** id de opção aceito pela API (o modelo às vezes manda "Opção 1"): vira opcao_1. */
const safeId = (id, i) => {
  const s = String(id || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^[^a-zA-Z]+/, '').slice(0, 40);
  return ID_RE.test(s) ? s : `opcao_${i + 1}`;
};
const need = (v, what) => {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`${what} é obrigatório.`);
  return v.trim().slice(0, 12000);
};

/**
 * Monta o pedido à API do Jev para uma ferramenta. Lança Error com mensagem clara se os argumentos não servem.
 * @param {string} tool  jev_choose | jev_score | jev_check
 * @param {object} args
 * @returns {{ state: object, questions: object, ids?: string[] }}
 */
export function buildJevRequest(tool, args = {}) {
  if (tool === 'jev_choose') {
    const context = need(args.context, 'context');
    const question = need(args.question, 'question');
    const opts = Array.isArray(args.options) ? args.options.slice(0, 10) : [];
    if (opts.length < 2) throw new Error('options: mande de 2 a 10 opções {id, description}.');
    const ids = [];
    const entries = opts.map((o, i) => {
      let id = safeId(o?.id, i);
      while (ids.includes(id) || id === 'none_of_the_above') id = `${id}_${i + 1}`;
      ids.push(id);
      return [id, need(o?.description || o?.id, `options[${i}].description`)];
    });
    entries.push(['none_of_the_above', 'Nenhuma das opções serve.']);
    // duas passadas com a ordem invertida no mesmo pedido: anula o viés de "primeira opção"
    const reversed = [...entries.slice(0, -1).reverse(), entries.at(-1)];
    return {
      state: { context, question },
      questions: {
        pass_a: { type: 'choice', instructions: question, criteria: Object.fromEntries(entries) },
        pass_b: { type: 'choice', instructions: question, criteria: Object.fromEntries(reversed) },
      },
      ids: opts.map((o, i) => [String(o?.id ?? ''), ids[i]]),
    };
  }
  if (tool === 'jev_score') {
    const levels = Array.isArray(args.levels) ? args.levels.map((l) => String(l || '').trim()).filter(Boolean).slice(0, 8) : [];
    if (levels.length < 2) throw new Error('levels: mande de 2 a 8 níveis, do pior ao melhor.');
    return { state: { context: need(args.context, 'context') }, questions: { judgment: { type: 'score', instructions: need(args.question, 'question'), criteria: levels } } };
  }
  if (tool === 'jev_check') {
    return {
      state: { statement: need(args.claim, 'claim'), evidence: need(args.evidence, 'evidence') },
      questions: {
        supported: {
          type: 'noul',
          instructions: 'A evidência fornecida sustenta diretamente a afirmação? Julgue só o que está mostrado.',
          criteria: { true: 'A evidência sustenta diretamente a afirmação.', false: 'A evidência é insuficiente ou contradiz a afirmação.' },
        },
      },
    };
  }
  throw new Error(`Ferramenta do Jev desconhecida: ${tool}.`);
}

/** Confiança de uma escolha: quanto a maior probabilidade passa do "chute" (1/n). */
const choiceConfidence = (probs) => {
  const v = Object.values(probs);
  if (v.length < 2) return 1;
  const top = Math.max(...v);
  return Math.max(0, (top - 1 / v.length) / (1 - 1 / v.length));
};
const decide = (conf) => (conf >= 0.75 ? 'proceed' : conf >= 0.5 ? 'confirm' : 'review');

/**
 * Lê a resposta da API e devolve um resultado curto para o agente (com "decision").
 * @param {string} tool
 * @param {object} payload  corpo da resposta ({ answers, usage, model })
 * @param {object} [req]    o que buildJevRequest devolveu (para traduzir os ids de volta)
 */
export function readJevAnswer(tool, payload, req = {}) {
  const ans = payload?.answers;
  if (!ans || typeof ans !== 'object') throw new Error('O Jev respondeu num formato inesperado.');
  const meta = { advisory: ADVISORY, ...(payload.model ? { model: payload.model } : {}) };
  if (tool === 'jev_choose') {
    const a = ans.pass_a || {};
    const b = ans.pass_b || a;
    const back = new Map((req.ids || []).map(([orig, id]) => [id, orig || id]));
    const ids = Object.keys(a.probabilities || {});
    const probabilities = Object.fromEntries(ids.map((id) => [back.get(id) || id, round(((a.probabilities?.[id] ?? 0) + (b.probabilities?.[id] ?? 0)) / 2)]));
    const ranked = Object.entries(probabilities).sort((x, y) => y[1] - x[1]);
    const confidence = round(choiceConfidence(probabilities));
    const consistent = !b.choice || a.choice === b.choice;
    return { ...meta, choice: ranked[0]?.[0], runnerUp: ranked[1]?.[0], probabilities, confidence, orderConsistent: consistent, decision: consistent ? decide(confidence) : 'review' };
  }
  if (tool === 'jev_score') {
    const a = ans.judgment || {};
    const ranked = Object.entries(a.probabilities || {}).sort((x, y) => y[1] - x[1]);
    const level = ranked[0]?.[0];
    const confidence = round(a.confidence ?? 0);
    return { ...meta, expectedScore: round(a.score), mostLikelyLevel: level !== undefined ? Number(level) : null, mostLikelyLabel: a.legend?.[level] ?? null, confidence, decision: decide(confidence) };
  }
  if (tool === 'jev_check') {
    const a = ans.supported || {};
    const p = typeof a.noul === 'number' ? a.noul : typeof a.probability === 'number' ? a.probability : 0.5;
    const verdict = p >= 0.75 ? 'yes' : p <= 0.25 ? 'no' : 'uncertain';
    return { ...meta, probability: round(p), verdict, decision: verdict === 'uncertain' ? 'review' : 'proceed' };
  }
  throw new Error(`Ferramenta do Jev desconhecida: ${tool}.`);
}
