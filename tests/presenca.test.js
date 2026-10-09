// Presença e travas: vários agentes MCP no mesmo projeto não sobrescrevem o trabalho um do outro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPresence, targetsOf, colorFor, LOCK_MS } from '../server/presence.js';

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
