// Presença e travas: vários agentes MCP no mesmo projeto não sobrescrevem o trabalho um do outro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPresence, targetsOf, colorFor, LOCK_MS, DOCUMENT_LOCK } from '../server/presence.js';

test('targetsOf junta as camadas que a ferramenta vai alterar', () => {
  assert.deepEqual(targetsOf({ id: 'a', ids: ['b', 'a'], parent_id: 'root' }), ['a', 'b']);
  assert.deepEqual(targetsOf({ parent_id: 'p', component_id: 'c' }), ['p', 'c']);
  assert.deepEqual(targetsOf({}), []);
});

test('trava: outro agente espera; o dono continua; a trava vence sozinha', () => {
  let t = 1000;
  const p = createPresence({ now: () => t });
  p.touchAgent('s1', 'Claude Code');
  p.touchAgent('s2', 'Codex');
  assert.equal(p.lock('s1', ['card']).ok, true);
  const conflito = p.lock('s2', ['card', 'outra']);
  assert.equal(conflito.ok, false);
  assert.equal(conflito.by, 'Claude Code');
  assert.equal(p.lock('s1', ['card']).ok, true, 'o dono pode continuar');
  assert.equal(p.lock('s2', ['outra']).ok, true, 'camadas diferentes não brigam');
  t += LOCK_MS + 1;
  assert.equal(p.lock('s2', ['card']).ok, true, 'a trava vence');
});

test('snapshot: pessoas, agentes com suas travas e atividade', () => {
  let t = 0;
  const p = createPresence({ now: () => t });
  p.addPerson('aba1', 'Kayky', '#123456');
  p.touchAgent('s1', 'Claude Code');
  p.lock('s1', ['x']);
  p.done('s1', 'update_layer', 'Alterou “Botão”: radius');
  const s = p.snapshot();
  assert.equal(s.people[0].name, 'Kayky');
  assert.equal(s.people[0].color, '#123456');
  assert.deepEqual(s.agents[0].locks, ['x']);
  assert.equal(s.agents[0].color, colorFor('Claude Code'));
  assert.match(s.activity[0].text, /radius/);
  p.removePerson('aba1');
  assert.equal(p.snapshot().people.length, 0);
});

test('duas chamadas paralelas da mesma sessão MCP são donas distintas da trava', () => {
  const p = createPresence({ now: () => 1000 });
  p.touchAgent('sessao', 'Claude Code');
  assert.equal(p.lock('chamada-1', ['card'], 0, { agentId: 'sessao', name: 'Claude Code' }).ok, true);
  const conflict = p.lock('chamada-2', ['card'], 0, { agentId: 'sessao', name: 'Claude Code' });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.by, 'Claude Code');
  assert.deepEqual(p.snapshot().agents[0].locks, ['card']);
  p.finishLocks('chamada-1', ['card']);
  assert.equal(p.lock('chamada-2', ['card'], 0, { agentId: 'sessao', name: 'Claude Code' }).ok, true, 'a mesma sessão pode continuar após a conclusão');
  p.removeAgent('sessao');
  assert.deepEqual(p.snapshot().agents, []);
});

test('trava de documento conflita com qualquer camada e vice-versa', () => {
  let t = 1000;
  const p = createPresence({ now: () => t });
  p.touchAgent('a', 'Agente A'); p.touchAgent('b', 'Agente B');
  p.lock('call-a', [DOCUMENT_LOCK], 0, { agentId: 'a' });
  assert.equal(p.lock('call-b', ['card'], 0, { agentId: 'b' }).ok, false);
  p.finishLocks('call-a', [DOCUMENT_LOCK]);
  t += LOCK_MS + 1;
  p.lock('call-b', ['card'], 0, { agentId: 'b' });
  assert.equal(p.lock('call-a', [DOCUMENT_LOCK], 0, { agentId: 'a' }).ok, false);
});

test('trava durante escrita pendente não expira; ao terminar, recebe o prazo normal', () => {
  let t = 1000;
  const p = createPresence({ now: () => t });
  p.touchAgent('s1', 'Claude'); p.touchAgent('s2', 'Codex');
  p.lock('s1', ['card'], 0);
  t += LOCK_MS * 10;
  assert.equal(p.lock('s2', ['card']).ok, false);
  p.finishLocks('s1', ['card']);
  t += LOCK_MS + 1;
  assert.equal(p.lock('s2', ['card']).ok, true);
});

test('removeAgent libera as travas da sessão e registra a desconexão', () => {
  const p = createPresence({ now: () => 1000 });
  p.touchAgent('s1', 'Claude Code');
  p.lock('s1', ['card', 'hero']);
  assert.equal(p.removeAgent('s1'), true);
  assert.equal(p.agent('s1'), null);
  assert.deepEqual(p.snapshot().agents, []);
  assert.equal(p.lock('s2', ['card']).ok, true);
  assert.match(p.snapshot().activity[0].text, /desconectou/);
  assert.equal(p.removeAgent('s1'), false);
});
