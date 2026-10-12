import test from 'node:test';
import assert from 'node:assert/strict';
import { createToolCaller } from '../apps/server/src/mcp/agent-calls.ts';
import { createPresence, LOCK_MS } from '../apps/server/src/presence.js';
const session = (id: string) => ({ id, name: id, activeCalls: 0, closing: false, lastSeen: 0, agent: { id, ownerId: 'owner', scopes: ['read', 'write'] } }) as any;
test('manutenção de recurso reserva documento, não apenas seu ID, e libera após a janela de proteção', async () => {
 for (const tool of ['update_design_resource','delete_design_resource']) {
  let release!: () => void; const gate=new Promise<void>(resolve=>release=resolve);
  let now=1000;
  const caller=createToolCaller({presence:createPresence({now:()=>now}),events:{broadcastPresence(){}} as any,workspace:{async call(name:string){if(name===tool)await gate;return {ok:true};},endSession(){}} as any});
  const pending=caller.call(session('A'),tool,{kind:'color',id:'recurso',changes:{color:'#123456'}});
  assert.match((await caller.call(session('B'),'update_layer',{id:'qualquer-camada',props:{radius:3}})).error,/documento inteiro/);
  release();await pending;now+=LOCK_MS+1;
  assert.equal((await caller.call(session('B'),'update_layer',{id:'qualquer-camada',props:{radius:3}})).ok,true);
 }
});

test('orçamento da lista de recursos inclui aviso sem perder o cursor', async () => {
 const {boundPagedItems}=await import('../packages/core/src/tools/runner/response-budget.ts');
 const source={count:10,total:20,offset:0,nextOffset:10,hasMore:true,resources:Array.from({length:10},(_,i)=>({id:`n${i}`,name:'😀'.repeat(60)})),notice:'mudança '.repeat(1000)};
 const out=boundPagedItems(source,1024,'aumente maxBytes','resources');
 assert.ok(Buffer.byteLength(JSON.stringify(out,null,2),'utf8')<=1024);assert.ok(out.count>0&&out.count<10);
 assert.equal(out.nextOffset,out.count);assert.equal(out.resources[0].id,'n0');assert.equal(source.resources.length,10);
});
