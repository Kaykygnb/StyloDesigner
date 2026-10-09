// Fase 2 do agente: streaming (SSE → texto, raciocínio e ferramentas), controle de raciocínio da NVIDIA NIM,
// subagentes (agendador e travas por camada) e o Jev (montar pedido e ler resposta).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSseReader, createChatAccumulator, parseChatStream, reasoningParams, rejectsExtras, rejectsTools } from '../src/agent/stream.js';
import { normalizeTasks, createLayerLocks, runSubagents, changedIds, subagentBrief, DELEGATE_TOOL, MAX_SUBAGENTS } from '../src/agent/subagents.js';
import { JEV_TOOLS, buildJevRequest, readJevAnswer, isJevTool } from '../src/agent/jev.js';

const sse = (...objs) => objs.map((o) => `data: ${typeof o === 'string' ? o : JSON.stringify(o)}\n\n`).join('');
const delta = (d, extra = {}) => ({ choices: [{ index: 0, delta: d, ...extra }] });

test('SSE: junta linhas cortadas no meio, ignora comentários e entende [DONE]', () => {
  const got = [];
  const r = createSseReader((d) => got.push(d));
  const body = ': ping\n\ndata: {"a":1}\n\ndata: {"b":\r\n\r\ndata: [DONE]\n\n';
  for (const ch of body) r.push(ch); // um caractere por vez: o pior caso
  r.end();
  assert.deepEqual(got, ['{"a":1}', '{"b":', null]);
});

test('stream: texto em pedaços, raciocínio em reasoning_content e em <think> cortado no meio da tag', () => {
  const acc = createChatAccumulator();
  const shown = { text: '', reasoning: '' };
  const feed = (d) => { const o = acc.add(delta(d)); shown.text += o.text; shown.reasoning += o.reasoning; };
  feed({ reasoning_content: 'Vou ler a seleção. ' });
  feed({ reasoning: 'Depois altero.' });
  feed({ content: '<thi' });
  feed({ content: 'nk>pensando em voz alta</th' });
  feed({ content: 'ink>Pronto: ' });
  feed({ content: 'deixei o botão azul.' });
  const end = acc.end();
  shown.text += end.text;
  const r = acc.result();
  assert.equal(r.content, 'Pronto: deixei o botão azul.');
  assert.equal(shown.text, 'Pronto: deixei o botão azul.');
  assert.match(r.reasoning, /Vou ler a seleção\. Depois altero\.pensando em voz alta/);
  assert.ok(!shown.text.includes('<'), 'nenhum pedaço de tag aparece para a pessoa');
});

test('stream: tool_calls montados a partir dos deltas (nome uma vez, argumentos picados, várias por index)', () => {
  const body = sse(
    delta({ role: 'assistant', content: null, tool_calls: [{ index: 0, id: 'c1', type: 'function', function: { name: 'get_selection', arguments: '' } }] }),
    delta({ tool_calls: [{ index: 0, function: { arguments: '{}' } }] }),
    delta({ tool_calls: [{ index: 1, id: 'c2', type: 'function', function: { name: 'update_layer', arguments: '{"id":"a1",' } }] }),
    delta({ tool_calls: [{ index: 1, function: { arguments: '"props":{"radius":8}}' } }] }),
    { choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] },
    '[DONE]',
  );
  const r = parseChatStream(body);
  assert.equal(r.tool_calls.length, 2);
  assert.deepEqual(r.tool_calls.map((c) => c.function.name), ['get_selection', 'update_layer']);
  assert.deepEqual(JSON.parse(r.tool_calls[1].function.arguments), { id: 'a1', props: { radius: 8 } });
  assert.equal(r.tool_calls[0].id, 'c1');
  assert.equal(r.finish_reason, 'tool_calls');
  assert.equal(r.content, '');
});

test('stream: argumentos já como objeto, id ausente e resposta não-stream (servidor que ignora stream:true)', () => {
  const acc = createChatAccumulator();
  acc.add(delta({ tool_calls: [{ function: { name: 'remember', arguments: { note: 'azul' } } }] }));
  const r = acc.result();
  assert.deepEqual(r.tool_calls[0].function.arguments, { note: 'azul' });
  assert.ok(r.tool_calls[0].id, 'ganha um id');
  const whole = createChatAccumulator();
  const o = whole.add({ choices: [{ message: { role: 'assistant', content: '<think>x</think>Oi' } }] });
  assert.equal(o.text, 'Oi');
  assert.equal(whole.result().reasoning, 'x');
});

test('stream: só o </think> de fechamento (DeepSeek-R1) separa o raciocínio no fim', () => {
  const r = parseChatStream(sse(delta({ content: 'pensei bastante' }), delta({ content: '</think>\n\nResposta.' }), '[DONE]'));
  assert.equal(r.content, 'Resposta.');
  assert.equal(r.reasoning, 'pensei bastante');
});

test('stream: answering() só fica verdadeiro com texto ou ferramenta (raciocínio não conta)', () => {
  const acc = createChatAccumulator();
  acc.add(delta({ reasoning_content: 'hmm' }));
  assert.equal(acc.started(), true);
  assert.equal(acc.answering(), false);
  acc.add(delta({ tool_calls: [{ index: 0, id: 'x', function: { name: 'get_document', arguments: '{}' } }] }));
  assert.equal(acc.answering(), true);
});

test('raciocínio na NVIDIA NIM: parâmetro certo por modelo; outros provedores não recebem nada', () => {
  const nim = (m, o = {}) => reasoningParams(m, { provider: 'nvidia', maxTokens: 4096, ...o });
  assert.deepEqual(nim('deepseek-ai/deepseek-v3.1').body, { max_tokens: 4096, chat_template_kwargs: { thinking: false } });
  assert.deepEqual(nim('qwen/qwen3-235b-a22b').body.chat_template_kwargs, { enable_thinking: false });
  assert.deepEqual(nim('nvidia/nemotron-3-nano-30b-a3b').body.chat_template_kwargs, { enable_thinking: false });
  assert.equal(nim('nvidia/llama-3.3-nemotron-super-49b-v1').system, 'detailed thinking off');
  assert.equal(nim('nvidia/llama-3.3-nemotron-super-49b-v1.5').system, '/no_think');
  assert.equal(nim('nvidia/nvidia-nemotron-nano-9b-v2').system, '/no_think');
  assert.equal(nim('openai/gpt-oss-120b').body.reasoning_effort, 'low');
  assert.match(nim('deepseek-ai/deepseek-r1').note, /não dá para desligar/);
  assert.deepEqual(nim('meta/llama-3.3-70b-instruct').body, { max_tokens: 4096 });
  assert.deepEqual(nim('qwen/qwen3-235b-a22b', { limit: false }).body, { max_tokens: 4096 });
  assert.deepEqual(reasoningParams('qwen3', { provider: 'openai', maxTokens: 4096 }), { body: {}, system: '', note: '' });
  assert.equal(rejectsExtras(400, 'Unrecognized request argument: chat_template_kwargs'), true);
  assert.equal(rejectsExtras(401, 'chat_template_kwargs'), false);
  assert.equal(rejectsTools(400, '"auto" tool choice requires --enable-auto-tool-choice'), true);
  assert.equal(rejectsTools(500, 'tool'), false);
});

test('delegate_task: valida de 1 a 4 tarefas, limpa escopo e modelo, dá nomes', () => {
  assert.equal(DELEGATE_TOOL.function.name, 'delegate_task');
  assert.equal(DELEGATE_TOOL.function.parameters.properties.tasks.maxItems, MAX_SUBAGENTS);
  const t = normalizeTasks({ tasks: [{ task: 'monta o rodapé', scope: ['f1', 'f1', 'root', 3], model: 'meta/llama' }, { task: 'ajusta o celular', name: 'Celular', model: 'x y' }] });
  assert.deepEqual(t.map((x) => x.name), ['Subagente 1', 'Celular']);
  assert.deepEqual(t[0].scope, ['f1']);
  assert.equal(t[0].model, 'meta/llama');
  assert.equal(t[1].model, '', 'modelo com espaço é ignorado');
  assert.throws(() => normalizeTasks({ tasks: [] }), /de 1 a 4/);
  assert.throws(() => normalizeTasks({ tasks: Array(5).fill({ task: 'x' }) }), /No máximo 4/);
  assert.throws(() => normalizeTasks({ tasks: [{ task: '  ' }] }), /vazio/);
  assert.match(subagentBrief(t[0], 'Tela (id f0)'), /SUA TAREFA: monta o rodapé[\s\S]*ESCOPO: altere só[\s\S]*f1[\s\S]*Tela \(id f0\)/);
});

test('travas entre subagentes: a mesma camada não pode ser alterada por dois ao mesmo tempo; escopo é respeitado', () => {
  const parents = { a1: 'f1', a2: 'f2', f1: null, f2: null };
  const isWithin = (id, scope) => { for (let x = id; x; x = parents[x]) if (scope.includes(x)) return true; return false; };
  const locks = createLayerLocks({ isWithin });
  assert.deepEqual(changedIds({ id: 'a1', parent_id: 'f1', ids: ['a2', 'a1'] }), ['a1', 'a2']);
  assert.deepEqual(locks.acquire('sub1', 'Cabeçalho', { id: 'a1', props: {} }), { ok: true });
  assert.deepEqual(locks.acquire('sub1', 'Cabeçalho', { id: 'a1', props: {} }), { ok: true }, 'o dono pode alterar de novo');
  const busy = locks.acquire('sub2', 'Rodapé', { ids: ['a2', 'a1'] });
  assert.equal(busy.ok, false);
  assert.match(busy.error, /a1.*“Cabeçalho”/);
  assert.equal(locks.holder('a2'), null, 'pedido recusado não trava nada');
  // escopo: sub2 só pode mexer dentro de f2
  assert.equal(locks.acquire('sub2', 'Rodapé', { id: 'a2' }, ['f2']).ok, true);
  assert.match(locks.acquire('sub2', 'Rodapé', { type: 'rect', parent_id: 'f1' }, ['f2']).error, /fora do seu escopo/);
  assert.match(locks.acquire('sub2', 'Rodapé', { tree: {} }, ['f2']).error, /parent_id/);
  locks.release('sub1');
  assert.equal(locks.acquire('sub2', 'Rodapé', { id: 'a1' }).ok, true, 'depois que o 1º termina, a camada fica livre');
  assert.equal(locks.size(), 2);
});

test('agendador de subagentes: roda em paralelo, mantém a ordem e isola erros e paradas', async () => {
  const tasks = normalizeTasks({ tasks: [{ task: 'a' }, { task: 'b' }, { task: 'c' }] });
  let running = 0, peak = 0;
  const out = await runSubagents(tasks, async (t, i) => {
    running++; peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 30 - i * 10));
    running--;
    if (t.task === 'b') throw Object.assign(new Error('quebrou'), { steps: 2 });
    if (t.task === 'c') throw new DOMException('parado', 'AbortError');
    return { summary: `fiz ${t.task}`, steps: 3 };
  });
  assert.equal(peak, 3, 'os três ao mesmo tempo');
  assert.deepEqual(out.map((r) => [r.name, r.status]), [['Subagente 1', 'done'], ['Subagente 2', 'error'], ['Subagente 3', 'stopped']]);
  assert.equal(out[0].summary, 'fiz a');
  assert.equal(out[1].error, 'quebrou');
  assert.equal(out[1].steps, 2);
  // concorrência limitada e sinal já abortado
  let peak2 = 0, run2 = 0;
  await runSubagents(tasks, async () => { run2++; peak2 = Math.max(peak2, run2); await new Promise((r) => setTimeout(r, 5)); run2--; return { summary: '' }; }, { concurrency: 1 });
  assert.equal(peak2, 1);
  const ac = new AbortController(); ac.abort();
  const stopped = await runSubagents(tasks, async () => ({ summary: 'não devia' }), { signal: ac.signal });
  assert.ok(stopped.every((r) => r.status === 'stopped'));
});

test('Jev: pedidos no formato da API (choice com 2 passadas, score, noul) e respostas com "decision"', () => {
  assert.deepEqual(JEV_TOOLS.map((t) => t.function.name), ['jev_choose', 'jev_score', 'jev_check']);
  assert.ok(isJevTool('jev_check') && !isJevTool('remember'));
  const q = buildJevRequest('jev_choose', { context: 'pizzaria', question: 'Qual paleta?', options: [{ id: 'Paleta quente', description: 'vermelho e creme' }, { id: 'fria', description: 'azul' }] });
  assert.deepEqual(Object.keys(q.questions), ['pass_a', 'pass_b']);
  assert.deepEqual(Object.keys(q.questions.pass_a.criteria), ['Paleta_quente', 'fria', 'none_of_the_above']);
  assert.deepEqual(Object.keys(q.questions.pass_b.criteria), ['fria', 'Paleta_quente', 'none_of_the_above']);
  const choose = readJevAnswer('jev_choose', { answers: {
    pass_a: { choice: 'Paleta_quente', probabilities: { Paleta_quente: 0.9, fria: 0.08, none_of_the_above: 0.02 } },
    pass_b: { choice: 'Paleta_quente', probabilities: { Paleta_quente: 0.94, fria: 0.04, none_of_the_above: 0.02 } },
  } }, q);
  assert.equal(choose.choice, 'Paleta quente', 'o id volta como o agente mandou');
  assert.equal(choose.decision, 'proceed');
  const flip = readJevAnswer('jev_choose', { answers: { pass_a: { choice: 'fria', probabilities: { fria: 0.6, Paleta_quente: 0.4 } }, pass_b: { choice: 'Paleta_quente', probabilities: { fria: 0.4, Paleta_quente: 0.6 } } } }, q);
  assert.equal(flip.decision, 'review', 'ordem inconsistente = revisar');
  const s = buildJevRequest('jev_score', { context: 'texto cinza claro em branco', question: 'contraste', levels: ['ruim', 'ok', 'ótimo'] });
  assert.equal(s.questions.judgment.type, 'score');
  const score = readJevAnswer('jev_score', { answers: { judgment: { score: 0.2, confidence: 0.8, probabilities: { 0: 0.8, 1: 0.15, 2: 0.05 }, legend: { 0: 'ruim', 1: 'ok', 2: 'ótimo' } } } });
  assert.deepEqual([score.mostLikelyLevel, score.mostLikelyLabel, score.decision], [0, 'ruim', 'proceed']);
  const c = buildJevRequest('jev_check', { claim: 'tem 3 colunas', evidence: 'cols: 3' });
  assert.equal(c.questions.supported.type, 'noul');
  assert.equal(readJevAnswer('jev_check', { answers: { supported: { noul: 0.93 } } }).verdict, 'yes');
  assert.equal(readJevAnswer('jev_check', { answers: { supported: { noul: 0.5 } } }).decision, 'review');
  assert.throws(() => buildJevRequest('jev_choose', { context: 'x', question: 'y', options: [{ id: 'a', description: 'a' }] }), /2 a 10/);
  assert.throws(() => buildJevRequest('jev_check', { claim: '', evidence: 'x' }), /claim/);
  assert.throws(() => readJevAnswer('jev_check', {}), /formato inesperado/);
});
