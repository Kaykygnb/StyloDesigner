import test from 'node:test';
import assert from 'node:assert/strict';
import { auditStyles, auditTouch, expandedReport } from '../packages/core/src/audit-expanded.ts';
const doc = { styles: { colors: [{ id: 'red', name: 'Marca', color: '#FF0000' }], texts: [{ id: 'body', name: 'Corpo', fontFamily: 'Inter', fontSize: 16 }] } };
test('sugere vínculos existentes sem inventar que cores fora da paleta são erros', () => {
  const issues = auditStyles([{ id: 'a', name: 'A', type: 'text', fill: { type: 'solid', color: '#ff0000' }, fontFamily: 'Inter', fontSize: 16 }, { id: 'b', name: 'B', fill: { type: 'solid', color: '#123456' } }], doc);
  assert.equal(issues.length, 2);
  assert.ok(issues.every(i => i.severity === 'aviso' && i.layerId === 'a'));
});
test('vínculos válidos não avisam; referências quebradas identificam base, breakpoint e estado', () => {
  assert.deepEqual(auditStyles([{ id: 'a', fill: { type: 'solid', color: '#FF0000', styleId: 'red' }, textStyleId: 'body' }], doc), []);
  const result = auditStyles([{ id: 'a', name: 'A', fill: { styleId: 'missing' }, bps: { mobile: { fill: { gradientId: 'missing' } } }, states: { hover: { effectStyleId: 'missing' } } }], doc);
  assert.deepEqual(result.map(i => i.where), ['base', 'breakpoint mobile', 'estado hover']);
});
test('não sugere vínculos em filhos de pai oculto nem estilos de texto parcialmente semelhantes', () => {
  assert.deepEqual(auditStyles([{ id: 'p', visible: false, children: [{ id: 'a', fill: { type: 'solid', color: '#FF0000' } }] }, { id: 'b', type: 'text', fontFamily: 'Inter', fontSize: 18 }], doc), []);
});
test('touch usa medida real, limites distintos e ignora alvos ocultos/não renderizados', () => {
  const nodes = { a: { id: 'a', name: 'Link', tag: 'a', w: 1, h: 1 }, b: { id: 'b', tag: 'button' }, c: { id: 'c', tag: 'div' } };
  const rows = [{ id: 'a', rendered: true, visible: true, box: { x: 0, y: 0, w: 30, h: 30 } }, { id: 'b', rendered: true, visible: false, box: { x: 0, y: 0, w: 10, h: 10 } }, { id: 'c', rendered: true, visible: true, box: { x: 0, y: 0, w: 10, h: 10 } }];
  assert.equal(auditTouch(rows, id => nodes[id], { label: 'desktop', mobile: false }).length, 0);
  const result = auditTouch(rows, id => nodes[id], { label: 'mobile (390px)', mobile: true });
  assert.equal(result.length, 1);
  assert.equal(result[0].where, 'mobile (390px)');
  rows[0].box.w = 44; rows[0].box.h = 44;
  assert.equal(auditTouch(rows, id => nodes[id], { label: 'mobile', mobile: true }).length, 0);
});
test('report limita bytes e contagem sem esconder totais e ordena erros primeiro', () => {
  const issues = Array.from({ length: 100 }, (_, index) => ({ severity: index === 99 ? 'erro' as const : 'aviso' as const, message: 'x'.repeat(200), index }));
  const report = expandedReport(issues);
  assert.equal(report.errors, 1); assert.equal(report.warnings, 99); assert.equal(report.total, 100);
  assert.equal(report.issues[0].index, 99); assert.ok(report.truncated);
  assert.ok(new TextEncoder().encode(JSON.stringify(report, null, 2)).length <= 8192);
  assert.equal(expandedReport(issues, { offset: report.nextOffset! }).issues[0].index, report.count - 1);
});
test('report vazio válido; offset fora ou problema maior que orçamento falha explicitamente', () => {
  assert.equal(expandedReport([]).truncated, false);
  assert.throws(() => expandedReport([{ severity: 'erro' }], { offset: 1 }));
  assert.throws(() => expandedReport([{ severity: 'aviso', message: 'x'.repeat(10000) }], { maxBytes: 1024 }));
});

test('não sugere vínculo que trocaria itálico por normal; alinhamento não é campo de estilo de texto',()=>{
 const style={id:'normal',name:'Normal',fontFamily:'Arial',fontSize:24,fontStyle:'normal',textAlign:'left'};
 const italic={id:'i',name:'I',type:'text',fontFamily:'Arial',fontSize:24,fontStyle:'italic',textAlign:'right'};
 assert.equal(auditStyles([italic],{styles:{texts:[style]}}).length,0);
 assert.equal(auditStyles([{...italic,fontStyle:'normal'}],{styles:{texts:[style]}}).length,1);
});
test('área zero visível avisa; caixa ausente/negativa/NaN visível invalida a medição',()=>{
 const node={id:'b',name:'Botão',tag:'button'};
 const row={id:'b',rendered:true,visible:true,box:{x:0,y:0,w:0,h:20}};
 assert.equal(auditTouch([row],()=>node,{label:'desktop',mobile:false}).length,1);
 for(const box of [null,{x:0,y:0,w:-1,h:20},{x:0,y:0,w:NaN,h:20}])assert.throws(()=>auditTouch([{...row,box}],()=>node,{label:'desktop',mobile:false}));
});
