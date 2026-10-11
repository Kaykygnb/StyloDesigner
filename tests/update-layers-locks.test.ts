import test from 'node:test';
import assert from 'node:assert/strict';
import { createToolCaller } from '../apps/server/src/mcp/agent-calls.ts';
import { createPresence, LOCK_MS } from '../apps/server/src/presence.js';

const session = (id: string) => ({ id, name: id, activeCalls: 0, closing: false, lastSeen: 0, agent: { id, ownerId: 'owner', scopes: ['read', 'write'] } }) as any;

function fixture() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let now = 1000;
  const presence = createPresence({ now: () => now });
  const calls: string[] = [];
  const caller = createToolCaller({ presence, events: { broadcastPresence() {} } as any, workspace: {
    async call(tool: string) { calls.push(tool); if (tool === 'update_layers') await gate; return { ok: true }; },
    endSession() {},
  } as any });
  return { caller, calls, release, expire: () => { now += LOCK_MS + 1; } };
}

test('lote comum reserva todos os IDs e permite trabalhar em outra camada', async () => {
  const f = fixture();
  const pending = f.caller.call(session('A'), 'update_layers', { updates: [{ id: 'a', props: { radius: 8 } }, { id: 'b', props: { fill: '#112233' } }] });
  assert.match((await f.caller.call(session('B'), 'update_layer', { id: 'b', props: { radius: 2 } })).error, /camada b.*alterada/);
  assert.equal((await f.caller.call(session('B'), 'update_layer', { id: 'c', props: { radius: 2 } })).ok, true);
  f.release(); await pending;
});

test('lote de tamanho ou modo de layout reserva documento enquanto executa', async () => {
  for (const props of [{ w: 400 }, { h: 300 }, { layout: { mode: 'row' } }]) {
    const f = fixture();
    const pending = f.caller.call(session('A'), 'update_layers', { updates: [{ id: 'pai', props }] });
    assert.match((await f.caller.call(session('B'), 'update_layer', { id: 'filho', props: { radius: 2 } })).error, /documento inteiro.*alterado/);
    assert.deepEqual(f.calls, ['update_layers'], 'a chamada conflitante não alcança o workspace');
    f.release(); await pending; f.expire();
    assert.equal((await f.caller.call(session('B'), 'update_layer', { id: 'filho', props: { radius: 2 } })).ok, true);
  }
});
