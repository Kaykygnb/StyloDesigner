import test from 'node:test';
import assert from 'node:assert/strict';
import {createNode,makeDoc} from '@stylo/core/model.js';
import {createStore} from '@stylo/core/store.js';
import {createRunner} from '@stylo/core/tools/runner.js';
function fixture(count=1,options:any={}){
 const root=createNode('frame',{w:800,h:600});
 const buttons=Array.from({length:count},()=>createNode('frame',{tag:'button',w:80,h:60}));root.children.push(...buttons);
 const doc=makeDoc();doc.pages[0].children.push(root);const store=createStore({initial:{doc}});const calls:any[]=[];
 const inspectLayout=options.absent?null:async(_root:any,_doc:any,opts:any)=>{calls.push(opts);if(options.fail&&calls.length===2)throw new Error('falhou');return{viewport:{width:opts.width,height:800},root:{x:0,y:0,w:opts.width,h:600},layers:opts.ids.map((id:string)=>({id,tag:options.tag??'button',parentId:root.id,rendered:true,visible:true,box:{x:0,y:0,w:opts.width<=640?30:50,h:30}}))};};
 const runner=createRunner({store,commands:{},auditLayout:async()=>[],inspectLayout});return{root,buttons,store,calls,run:(args:any={})=>runner.run('check_design',{id:root.id,...args})};
}
test('touch usa medidas por largura, não dimensões base, e snapshot sem alterações',async()=>{
 const f=fixture(),before=JSON.stringify(f.store.state.doc);const out=await f.run({checks:['touch'],breakpoints:['mobile']});
 assert.equal(out.error,undefined);assert.equal(out.checked.touch,true);assert.equal(out.issues.filter((i:any)=>i.type==='alvo-pequeno').length,1);
 assert.match(out.issues[0].where,/390/);assert.equal(JSON.stringify(f.store.state.doc),before);assert.equal(f.calls.length,2);
});
test('touch percorre todos os alvos em lotes100 antes de afirmar conferido',async()=>{
 const f=fixture(137);const out=await f.run({checks:['touch'],breakpoints:['mobile']});
 assert.equal(out.error,undefined);assert.equal(out.checked.touch,true);assert.equal(out.warnings,137);assert.equal(out.total,137);
 assert.deepEqual(f.calls.map(c=>c.ids.length),[100,37,100,37]);assert.ok(out.hasMore);assert.ok(Buffer.byteLength(JSON.stringify(out,null,2),'utf8')<=8192);
 const next=await f.run({checks:['touch'],breakpoints:['mobile'],offset:out.nextOffset});assert.equal(next.offset,out.count);assert.equal(next.warnings,137);
});
test('limite, ausência e falha não afirmam sucesso nem publicam medidas parciais',async()=>{
 const tooMany=fixture(3);const limited=await tooMany.run({checks:['touch'],maxTargets:2});assert.equal(limited.checked.touch,false);assert.match(limited.note,/excedem/);assert.equal(limited.ok,undefined);assert.equal(tooMany.calls.length,0);
 const absent=await fixture(1,{absent:true}).run({checks:['touch']});assert.equal(absent.checked.touch,false);assert.match(absent.note,/NÃO/);assert.equal(absent.ok,undefined);
 const fail=await fixture(1,{fail:true}).run({checks:['touch']});assert.equal(fail.checked.touch,false);assert.equal(fail.issues.length,0);assert.match(fail.note,/parciais foram descartadas/);
});
test('tag efetiva div não vira aviso de botão e default não executa touch',async()=>{
 const f=fixture(1,{tag:'div'});const out=await f.run({checks:['touch']});assert.equal(out.warnings,0);
 const plain=fixture();await plain.run();assert.equal(plain.calls.length,0);
});
test('checks styles sugere só estilo existente e valida parâmetros extras',async()=>{
 const f=fixture();f.store.update(()=>{f.store.state.doc.styles.colors.push({id:'marca',name:'Marca',color:f.buttons[0].fill.color,opacity:1});});f.store.commit();
 const out=await f.run({checks:['styles']});assert.equal(out.error,undefined);assert.ok(out.issues.some((i:any)=>i.type==='estilo-sem-vinculo'));
 for(const args of [{checks:['desconhecido']},{checks:['styles','styles']},{limit:61},{maxTargets:1001},{offset:-1}])assert.ok((await f.run(args)).error);
});
