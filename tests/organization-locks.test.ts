import test from 'node:test';
import assert from 'node:assert/strict';
import { createToolCaller } from '../apps/server/src/mcp/agent-calls.ts';
import { createPresence, LOCK_MS } from '../apps/server/src/presence.js';
const session=(id:string)=>({id,name:id,activeCalls:0,closing:false,lastSeen:0,agent:{id,ownerId:'owner',scopes:['read','write']}}) as any;
test('organização e páginas reservam documento inteiro e liberam após proteção',async()=>{
 for(const [tool,args]of [['align_layers',{ids:['a','b'],alignment:'left'}],['distribute_layers',{ids:['a','b','c'],axis:'h'}],['group_layers',{ids:['a','b']}],['ungroup_layers',{ids:['g']}],['reorder_layer',{id:'a',index:0}],['rename_page',{id:'p',name:'Nova'}],['reorder_page',{id:'p',index:0}]] as Array<[string,any]>){
  let now=1000,release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
  const caller=createToolCaller({presence:createPresence({now:()=>now}),events:{broadcastPresence(){}} as any,workspace:{async call(name:string){if(name===tool)await gate;return{ok:true};},endSession(){}} as any});
  const pending=caller.call(session('A'),tool,args);
  assert.match((await caller.call(session('B'),'update_layer',{id:'não-selecionada',props:{radius:3}})).error,/documento inteiro/);
  release();await pending;now+=LOCK_MS+1;
  assert.equal((await caller.call(session('B'),'update_layer',{id:'não-selecionada',props:{radius:3}})).ok,true);
 }
});
