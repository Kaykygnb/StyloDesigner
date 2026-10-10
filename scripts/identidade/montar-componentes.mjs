// Segunda parte do guia: botão primário como componente, estados reais, abas, etiquetas e campos. Rode depois de montar-guia.mjs.
// Seção "Componentes e estados" do guia: botão primário como COMPONENTE (com :hover, :active e :focus-visible reais),
// instâncias com os estados forçados para aparecerem no guia, abas, campos e chips. Tudo pelo MCP.
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sid = readFileSync(join(tmpdir(), 'stylo-mcp-sid.txt'), 'utf8').trim();
const root = readFileSync(join(tmpdir(), 'stylo-guia-root.txt'), 'utf8').trim();
const call = async (name, args) => {
  const res = await fetch('http://localhost:5173/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Mcp-Session-Id': sid, 'X-Stylo-Agent': 'Claude' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }) });
  const j = await res.json();
  const text = (j.result?.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  if (j.error || j.result?.isError) throw new Error(`${name}: ${JSON.stringify(j.error || text).slice(0, 500)}`);
  try { return JSON.parse(text); } catch { return text; }
};

// estilos de cor extras para os estados
let doc = await call('get_document', {});
const extras = [{ name: 'Âmbar hover', color: '#F2B652' }, { name: 'Âmbar pressionado', color: '#C98618' }].filter((c) => !doc.colorStyles.some((x) => x.name === c.name));
if (extras.length) { await call('create_color_styles', { colors: extras }); doc = await call('get_document', {}); }
const S = Object.fromEntries(doc.colorStyles.map((s) => [s.name, { styleId: s.id }]));
const C = (n) => { if (!S[n]) throw new Error('cor inexistente: ' + n); return S[n]; };

const SANS = 'IBM Plex Sans', MONO = 'JetBrains Mono';
const t = (text, size, weight, color, extra = {}) => ({ type: 'text', props: { text, fontFamily: SANS, fontSize: size, fontWeight: weight, lineHeight: size >= 28 ? 1.15 : 1.5, fill: C(color), sizeX: 'hug', ...extra } });
const m = (text, size, color, extra = {}) => ({ type: 'text', props: { text, fontFamily: MONO, fontSize: size, fontWeight: 400, lineHeight: 1.5, fill: C(color), sizeX: 'hug', ...extra } });
const col = (children, props = {}) => ({ type: 'frame', props: { layout: { mode: 'column', gap: 12 }, fill: 'none', ...props }, children });
const row = (children, props = {}) => ({ type: 'frame', props: { layout: { mode: 'row', gap: 12, align: 'center' }, fill: 'none', ...props }, children });

const botao = (rotulo, nome = 'Botão primário') => ({ type: 'frame', props: { name: nome, tag: 'button', cursor: 'pointer', sizeX: 'hug', sizeY: 'hug', fill: C('Âmbar'), radius: 4, layout: { mode: 'row', gap: 8, padding: [8, 14, 8, 14], justify: 'center', align: 'center' } }, children: [t(rotulo, 13, 600, 'Sobre âmbar', { name: 'Rótulo' })] });
const slot = (nome, legenda) => col([{ type: 'frame', props: { name: `Slot ${nome}`, sizeX: 'hug', sizeY: 'hug', fill: 'none', layout: { mode: 'row', gap: 0 } }, children: [] }, m(legenda, 11, 'Texto suave claro')], { name: `Estado ${nome}`, layout: { mode: 'column', gap: 10 }, sizeX: 'hug' });
const campo = (nome, valor, props, legenda) => col([
  { type: 'frame', props: { name: nome, w: 200, sizeX: 'fixed', sizeY: 'hug', fill: C('Grafite 800'), radius: 4, layout: { mode: 'row', gap: 8, padding: [8, 10, 8, 10], align: 'center' }, ...props }, children: [t(valor, 13, 400, 'Texto claro')] },
  m(legenda, 11, 'Texto suave claro'),
], { name: `Campo ${nome}`, layout: { mode: 'column', gap: 8 }, sizeX: 'hug' });
const aba = (rotulo, ativa) => ({ type: 'frame', props: { name: ativa ? 'Aba selecionada' : 'Aba', sizeX: 'hug', sizeY: 'hug', fill: 'none', stroke: { color: ativa ? '#E9A23B' : '#2C2A27', width: ativa ? 2 : 1, sides: [0, 0, ativa ? 2 : 1, 0] }, layout: { mode: 'row', gap: 0, padding: [10, 14, 10, 14] } }, children: [t(rotulo, 13, ativa ? 600 : 400, ativa ? 'Texto claro' : 'Texto suave claro')] });
const chip = (rotulo, destaque) => ({ type: 'frame', props: { name: 'Chip', sizeX: 'hug', sizeY: 'hug', fill: destaque ? C('Âmbar') : C('Grafite 700'), radius: 2, layout: { mode: 'row', padding: [2, 6, 2, 6], align: 'center' } }, children: [t(rotulo, 11, 500, destaque ? 'Sobre âmbar' : 'Texto claro')] });

const tree = {
  type: 'frame', props: { name: 'Componentes e estados', tag: 'section', sizeX: 'fill', fill: 'none', layout: { mode: 'column', gap: 32, padding: [72, 80, 72, 80] } }, children: [
    t('Componentes e estados', 28, 600, 'Texto claro', { tag: 'h2', letterSpacing: -0.4 }),
    t('Cada componente nasce com os estados que o CSS tem de verdade (:hover, :active, :focus-visible). O botão abaixo é um componente do projeto; as cópias mostram cada estado forçado para aparecer no guia.', 15, 400, 'Texto suave claro', { lineHeight: 1.6, sizeX: 'fill', maxW: 640 }),
    row([col([botao('Exportar site'), m('componente principal', 11, 'Âmbar')], { name: 'Principal', layout: { mode: 'column', gap: 10 }, sizeX: 'hug' }),
      slot('padrão', 'padrão'), slot('hover', ':hover'), slot('pressionado', ':active'), slot('foco', ':focus-visible'), slot('desabilitado', 'desabilitado')],
    { name: 'Botão primário e estados', layout: { mode: 'row', gap: 48, align: 'flex-start' }, sizeX: 'fill' }),
    row([
      col([t('Abas', 13, 600, 'Texto claro'), row([aba('Design', true), aba('Protótipo'), aba('Código')], { layout: { mode: 'row', gap: 0 }, sizeX: 'hug', name: 'Abas' })], { name: 'Abas', layout: { mode: 'column', gap: 12 }, sizeX: 'hug' }),
      col([t('Etiquetas', 13, 600, 'Texto claro'), row([chip('flex', true), chip('<section>'), chip('hug')], { layout: { mode: 'row', gap: 8 }, sizeX: 'hug', name: 'Etiquetas' })], { name: 'Etiquetas', layout: { mode: 'column', gap: 12 }, sizeX: 'hug' }),
    ], { name: 'Abas e etiquetas', layout: { mode: 'row', gap: 80, align: 'flex-start' }, sizeX: 'fill' }),
    col([t('Campos', 13, 600, 'Texto claro'),
      row([
        campo('normal', 'padding: 8px', { stroke: { color: '#2C2A27', width: 1 } }, 'normal'),
        campo('foco', 'padding: 8px', { stroke: { color: '#E9A23B', width: 1 }, shadows: [{ x: 0, y: 0, blur: 0, spread: 3, color: '#E9A23B', opacity: 0.18 }] }, 'foco: borda âmbar + anel de 3 px'),
        campo('erro', 'padding: 8px', { stroke: { color: '#FF6B6B', width: 1 } }, 'erro: borda vermelha + mensagem'),
      ], { name: 'Campos', layout: { mode: 'row', gap: 32, align: 'flex-start' }, sizeX: 'hug' })], { name: 'Campos', layout: { mode: 'column', gap: 12 }, sizeX: 'fill' }),
  ],
};

const r = await call('build_layout', { parent_id: root, tree });
console.log('seção criada:', JSON.stringify(r).slice(0, 120));

const find = async (q) => { const f = await call('find_layers', { query: q }); const list = f.layers || f.results || f.matches || f; const hit = (Array.isArray(list) ? list : []).find((x) => x.name === q); if (!hit) throw new Error('não achei: ' + q + ' → ' + JSON.stringify(f).slice(0, 200)); return hit.id; };
const principal = await find('Botão primário');
await call('create_component', { id: principal });
await call('set_state', { id: principal, state: 'hover', props: { fill: C('Âmbar hover') } });
await call('set_state', { id: principal, state: 'active', props: { fill: C('Âmbar pressionado') } });
await call('set_state', { id: principal, state: 'focus', props: { stroke: { color: '#ECE9E4', width: 2 } } });
console.log('componente com :hover, :active e :focus-visible');

const estados = [
  ['Slot padrão', {}],
  ['Slot hover', { fill: C('Âmbar hover') }],
  ['Slot pressionado', { fill: C('Âmbar pressionado') }],
  ['Slot foco', { stroke: { color: '#ECE9E4', width: 2 } }],
  ['Slot desabilitado', { opacity: 0.45 }],
];
for (const [nome, props] of estados) {
  const slotId = await find(nome);
  await call('create_instance', { component_id: principal, parent_id: slotId, props: { text: undefined, ...props } });
  console.log('instância em', nome);
}
