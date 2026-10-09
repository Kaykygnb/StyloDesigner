/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  agent/subagents.js — SUBAGENTES: O AGENTE DIVIDE O TRABALHO EM ATÉ 4 AJUDANTES EM PARALELO
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Com a ferramenta `delegate_task` (só do agente interno, como `remember`), o agente principal cria de 1 a 4
 *  subagentes, cada um com uma TAREFA, um ESCOPO opcional (ids de camadas onde ele pode mexer) e um MODELO opcional.
 *  Cada subagente roda o mesmo laço de ferramentas do agente (ui/assistant.js), em paralelo, com contexto mínimo
 *  (instruções + tarefa + resumo do documento) e um limite de passos; no fim, devolve um resumo ao principal.
 *
 *  TRAVAS POR CAMADA (a mesma ideia de server/presence.js, aqui no navegador): quando um subagente altera uma camada,
 *  ela fica dele até ele terminar. Outro subagente que tentar alterar a mesma camada recebe um erro claro ("está com
 *  o Subagente 2") e pode trabalhar em outra parte. Com escopo, ele só altera camadas DENTRO do escopo.
 *  As alterações continuam passando pela permissão (ou "Fazer sem perguntar") e saem com Ctrl+Z.
 *  Só lógica, sem DOM: os testes importam este arquivo.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Máximo de subagentes por chamada de delegate_task. */
export const MAX_SUBAGENTS = 4;
/** Passos (rodadas de ferramentas) de cada subagente. */
export const SUBAGENT_STEPS = 14;

/** A ferramenta, no formato da OpenAI (só o agente principal recebe; subagentes não delegam de novo). */
export const DELEGATE_TOOL = {
  type: 'function',
  function: {
    name: 'delegate_task',
    description: 'Divide um trabalho GRANDE em partes independentes e cria de 1 a 4 subagentes que trabalham AO MESMO TEMPO, cada um com as mesmas ferramentas de design (ex.: um monta o cabeçalho, outro o rodapé, outro ajusta o celular). Cada um recebe só a tarefa e um resumo do projeto, então escreva tarefas completas e independentes, com os ids das camadas envolvidas. Use "scope" (ids de frames) para cada um mexer só na sua parte: dois subagentes não podem alterar a mesma camada ao mesmo tempo. Devolve um resumo de cada um. Para pedidos pequenos, NÃO use: faça você mesmo.',
    parameters: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array', minItems: 1, maxItems: MAX_SUBAGENTS,
          items: {
            type: 'object',
            properties: {
              task: { type: 'string', description: 'A tarefa completa, em português (o subagente não vê esta conversa).' },
              name: { type: 'string', description: 'Nome curto que aparece na tela (ex.: "Rodapé").' },
              scope: { type: 'array', items: { type: 'string' }, description: 'ids das camadas (e o que estiver dentro delas) que ele pode alterar. Vazio = qualquer uma.' },
              model: { type: 'string', description: 'Modelo opcional para este subagente (padrão: o da conversa).' },
            },
            required: ['task'],
          },
        },
      },
      required: ['tasks'],
    },
  },
};

/**
 * Confere e limpa os argumentos de delegate_task. Lança Error com mensagem que a IA entende.
 * @param {object} args
 * @returns {{ id: string, name: string, task: string, scope: string[], model: string }[]}
 */
export function normalizeTasks(args) {
  const list = Array.isArray(args?.tasks) ? args.tasks : [];
  if (!list.length) throw new Error('tasks: mande de 1 a 4 tarefas {task, name?, scope?, model?}.');
  if (list.length > MAX_SUBAGENTS) throw new Error(`No máximo ${MAX_SUBAGENTS} subagentes por vez. Junte tarefas parecidas.`);
  return list.map((t, i) => {
    const task = String(typeof t === 'string' ? t : t?.task || '').trim();
    if (!task) throw new Error(`tasks[${i}].task está vazio.`);
    const scope = Array.isArray(t?.scope) ? [...new Set(t.scope.filter((x) => typeof x === 'string' && x && x !== 'root'))].slice(0, 40) : [];
    const model = typeof t?.model === 'string' && /^[\w.:/@+-]{1,120}$/.test(t.model.trim()) ? t.model.trim() : '';
    const name = String(t?.name || '').replace(/\s+/g, ' ').trim().slice(0, 40) || `Subagente ${i + 1}`;
    return { id: `sub${i + 1}`, name, task: task.slice(0, 4000), scope, model };
  });
}

/** ids que uma ferramenta vai ALTERAR (as travas valem para estes; o pai de uma criação só confere o escopo). */
export function changedIds(args = {}) {
  const ids = [];
  if (typeof args.id === 'string') ids.push(args.id);
  if (typeof args.component_id === 'string') ids.push(args.component_id);
  if (Array.isArray(args.ids)) ids.push(...args.ids.filter((x) => typeof x === 'string'));
  return [...new Set(ids.filter((x) => x && x !== 'root'))];
}

/**
 * Travas das camadas entre subagentes do mesmo agente.
 * @param {{ isWithin?: (id: string, scope: string[]) => boolean }} [opts]  a camada está dentro do escopo?
 *        (o painel passa uma função que sobe pelos pais no documento; padrão: só o próprio id)
 */
export function createLayerLocks({ isWithin = (id, scope) => scope.includes(id) } = {}) {
  const locks = new Map(); // id da camada → { owner, name }
  return {
    /**
     * Antes de uma ferramenta de ESCRITA: confere escopo e travas e, se tudo bem, trava as camadas para `owner`.
     * @returns {{ ok: true } | { ok: false, error: string }}
     */
    acquire(owner, name, args = {}, scope = []) {
      const ids = changedIds(args);
      if (scope.length) {
        const parent = typeof args.parent_id === 'string' ? args.parent_id : null;
        const outside = [...ids, ...(parent ? [parent] : [])].find((id) => id === 'root' || !isWithin(id, scope));
        if (outside) return { ok: false, error: `A camada ${outside} está fora do seu escopo (${scope.join(', ')}). Mexa só dentro dele; o resto é de outro subagente.` };
        if (!ids.length && !parent && args.tree) return { ok: false, error: `Crie dentro do seu escopo: use parent_id com um destes ids: ${scope.join(', ')}.` };
      }
      for (const id of ids) {
        const l = locks.get(id);
        if (l && l.owner !== owner) return { ok: false, error: `A camada ${id} está sendo alterada por “${l.name}” agora. Trabalhe em outra parte do design; ela fica livre quando ele terminar.` };
      }
      for (const id of ids) locks.set(id, { owner, name });
      return { ok: true };
    },
    /** O subagente terminou (ou parou): solta todas as camadas dele. */
    release(owner) { for (const [id, l] of locks) if (l.owner === owner) locks.delete(id); },
    /** Quem está com a camada (ou null). */
    holder: (id) => locks.get(id)?.name || null,
    /** Quantas camadas estão travadas agora. */
    size: () => locks.size,
  };
}

/**
 * Roda os subagentes em paralelo (no máximo `concurrency` ao mesmo tempo) e devolve um resultado por tarefa, na
 * mesma ordem. Um subagente que falha não derruba os outros.
 * @param {object[]} tasks  de normalizeTasks
 * @param {(task: object, index: number) => Promise<{ summary: string, steps?: number, stopped?: boolean }>} runOne
 * @param {{ concurrency?: number, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ id, name, status: 'done'|'error'|'stopped', summary?, error?, steps }[]>}
 */
export async function runSubagents(tasks, runOne, { concurrency = MAX_SUBAGENTS, signal } = {}) {
  const results = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      const t = tasks[i];
      if (signal?.aborted) { results[i] = { id: t.id, name: t.name, status: 'stopped', steps: 0, error: 'Parado antes de começar.' }; continue; }
      try {
        const r = await runOne(t, i);
        results[i] = { id: t.id, name: t.name, status: r?.stopped ? 'stopped' : 'done', summary: String(r?.summary || '').slice(0, 2000), steps: r?.steps || 0 };
      } catch (err) {
        const stopped = err?.name === 'AbortError';
        results[i] = { id: t.id, name: t.name, status: stopped ? 'stopped' : 'error', error: stopped ? 'Parado.' : String(err?.message || err), steps: err?.steps || 0 };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, tasks.length)) }, worker));
  return results;
}

/**
 * A mensagem que o subagente recebe (o "contexto mínimo"): quem ele é, a tarefa, o escopo e um resumo do documento.
 * @param {{ name: string, task: string, scope: string[] }} t
 * @param {string} docSummary  resumo curto do projeto (telas e camadas principais com ids)
 */
export function subagentBrief(t, docSummary) {
  return [
    `Você é “${t.name}”, um SUBAGENTE do Assistente do Stylo. Outros subagentes trabalham ao mesmo tempo em outras partes do design.`,
    `SUA TAREFA: ${t.task}`,
    t.scope.length ? `ESCOPO: altere só estas camadas e o que está dentro delas: ${t.scope.join(', ')}. Para criar, use parent_id dentro do escopo.` : 'ESCOPO: livre, mas não mexa no que não faz parte da sua tarefa.',
    'Regras: faça a tarefa com as ferramentas, sem perguntar nada (ninguém vai responder). Se uma camada estiver travada por outro subagente, trabalhe em outra parte. Ao terminar, responda em 1 a 3 frases o que ficou pronto (com os ids criados), ou o que impediu.',
    `Resumo do projeto agora:\n${docSummary || '(vazio)'}`,
  ].join('\n\n');
}
