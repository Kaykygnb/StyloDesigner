// Estilos de texto, modos de cor, variáveis de tamanho e exportação de tokens, usados pelo MCP como um agente usaria.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '@stylo/db/client.ts';
import { createProjects } from '../apps/server/src/services/projects.ts';
import { createOperations } from '../apps/server/src/services/operations.ts';
import { createNotes } from '../apps/server/src/services/notes.ts';
import { createSharing } from '../apps/server/src/services/sharing.ts';
import { createWorkspace, type Actor } from '../apps/server/src/workspace/index.ts';

async function setup() {
  const { db, close } = await createDb();
  const owner = await db.user.create({ data: { email: 'dono@x.com', name: 'Dono', passwordHash: '!', role: 'OWNER' } });
  const operations = createOperations(db);
  let workspace: ReturnType<typeof createWorkspace>;
  const projects = createProjects({ db, getConfig: () => ({ keepVersions: 5 }), onWrite: (e) => { void workspace.externalWrite(e); } });
  workspace = createWorkspace({ projects, notes: createNotes(db), sharing: createSharing(db), operations, presence: () => ({ agents: [] }) });
  const agent = await db.agent.create({ data: { name: 'Claude', ownerId: owner.id, tokenHash: 'h-tokens', scopes: ['read', 'write', 'export'], status: 'ACTIVE' } });
  const actor = { type: 'AGENT', userId: owner.id, agentId: agent.id, name: 'Claude', scopes: agent.scopes } satisfies Actor;
  const call = (tool: string, args: any = {}) => workspace.call(tool, args, { sid: 's', actor }) as Promise<any>;
  return { call, close: async () => { await operations.idle(); await close(); } };
}

test('tokens: modos claro/escuro, estilos de texto e variáveis saem como CSS, JSON e Tailwind', async () => {
  const t = await setup();
  await t.call('new_project', { name: 'Tokens' });
  assert.match((await t.call('export_tokens', { format: 'css' })).error, /ainda não tem/);

  const colors = (await t.call('create_color_styles', { colors: [{ name: 'Fundo', color: '#FFFFFF' }, { name: 'Texto', color: '#111111' }] })).created;
  const mode = (await t.call('add_color_mode', { name: 'Escuro', scheme: 'dark', auto: true })).mode;
  assert.equal(mode.scheme, 'dark');
  const set = await t.call('set_style_color', { style_id: colors[0].id, mode_id: mode.id, color: '#0B0B0B' });
  assert.equal(set.error, undefined, set.error);
  assert.match((await t.call('set_style_color', { style_id: colors[0].id, mode_id: 'nada', color: '#000000' })).error, /Modo/);
  assert.match((await t.call('set_style_color', { style_id: colors[0].id, color: 'azul' })).error, /Cor inválida/);

  const styles = (await t.call('create_text_styles', { styles: [{ name: 'Título', fontFamily: 'Playfair Display', fontSize: 48, fontWeight: 700, lineHeight: 1.1 }, { name: 'Corpo', fontFamily: 'Inter', fontSize: 16, lineHeight: 1.5 }] })).created;
  const text = (await t.call('create_layer', { type: 'text', props: { text: 'Olá', fontSize: 20 } })).created ?? null;
  const textId = text?.id ?? (await t.call('find_layers', { type: 'text' })).layers?.[0]?.id;
  assert.ok(textId, 'camada de texto criada');
  const applied = await t.call('apply_text_style', { ids: [textId], style_id: styles[0].id });
  assert.equal(applied.error, undefined, applied.error);
  assert.equal((await t.call('get_layer', { id: textId })).layer?.fontSize ?? (await t.call('get_layer', { id: textId })).fontSize, 48, 'o texto seguiu o estilo');
  assert.match((await t.call('apply_text_style', { ids: [textId], style_id: 'nada' })).error, /não existe/);

  const vars = (await t.call('create_size_variables', { variables: [{ name: 'Espaço M', value: 16 }, { name: 'Raio', value: 8 }] })).variables;
  const frame = (await t.call('create_layer', { type: 'frame', props: { w: 300, h: 200, layout: { mode: 'row', gap: 4 } } })).created;
  const bound = await t.call('bind_variable', { ids: [frame.id], prop: 'gap', variable_id: vars[0].id });
  assert.equal(bound.error, undefined, bound.error);
  assert.equal(bound.value, 16);
  assert.match((await t.call('bind_variable', { ids: [textId], prop: 'gap', variable_id: vars[0].id })).error, /layout/);
  // mudar a variável leva o valor às camadas ligadas
  await t.call('create_size_variables', { variables: [{ name: 'espaço m', value: 24 }] });
  const doc = await t.call('get_document', {});
  assert.equal(doc.sizeVars.length, 2, 'mesmo nome atualiza, não duplica');
  assert.equal(doc.colorModes[0].name, 'Escuro');
  assert.equal((await t.call('get_layer', { id: frame.id })).layer?.layout?.gap ?? (await t.call('get_layer', { id: frame.id })).layout?.gap, 24);

  const css = (await t.call('export_tokens', { format: 'css' })).files[0].content as string;
  assert.match(css, /:root \{[^}]*--cor-fundo: rgba\(255, 255, 255, 1\)|--cor-fundo: #FFFFFF/i);
  assert.match(css, /:root\[data-theme="escuro"\] \{[^}]*--cor-fundo: [^;]*(11, 11, 11|0B0B0B)/i);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  assert.match(css, /--espaco-m: 24px/);
  assert.match(css, /\.texto-titulo \{[^}]*font-family: 'Playfair Display', sans-serif;[^}]*font-size: 48px/);

  const json = JSON.parse((await t.call('export_tokens', { format: 'json' })).files[0].content);
  assert.equal(json.color.Fundo.$type, 'color');
  assert.ok(json.color.Fundo.$modes.escuro);
  assert.equal(json.size['Espaço M'].$value, '24px');
  assert.equal(json.typography['Título'].$value.fontSize, '48px');

  const tw = (await t.call('export_tokens', { format: 'tailwind' })).files;
  assert.deepEqual(tw.map((f: any) => f.path).sort(), ['tailwind.config.js', 'tokens.css']);
  const cfg = tw.find((f: any) => f.path === 'tailwind.config.js').content as string;
  assert.match(cfg, /"fundo": "var\(--cor-fundo\)"/);
  assert.match(cfg, /"titulo": \[\s*"48px"/);
  await t.close();
});

test('estilos de sombra e de gradiente: viram variáveis, as camadas ligadas usam var(), e mexer à mão solta o estilo', async () => {
  const t = await setup();
  await t.call('new_project', { name: 'Efeitos' });
  const fx = (await t.call('create_effect_styles', { styles: [{ name: 'Card', shadows: [{ y: 8, blur: 24, color: '#000000', opacity: 0.2 }, { y: 1, blur: 2, opacity: 0.1 }] }] })).created[0];
  const gr = (await t.call('create_gradient_styles', { styles: [{ name: 'Marca', angle: 135, stops: [{ color: '#6D28D9' }, { color: '#2DD4FF' }] }] })).created[0];
  assert.match((await t.call('create_gradient_styles', { styles: [{ name: 'X', stops: [{ color: '#000000' }] }] })).error, /stops/);
  assert.match((await t.call('create_effect_styles', { styles: [{ name: 'Vazio', shadows: [] }] })).error, /pelo menos uma sombra/);

  const frame = (await t.call('create_layer', { type: 'frame', props: { w: 300, h: 200 } })).created;
  const up = await t.call('update_layer', { id: frame.id, props: { effectStyleId: fx.id, fill: { gradientId: gr.id } } });
  assert.equal(up.error, undefined, up.error);
  assert.match((await t.call('update_layer', { id: frame.id, props: { effectStyleId: 'nada' } })).error, /não existe/);
  assert.match((await t.call('update_layer', { id: frame.id, props: { fill: { gradientId: 'nada' } } })).error, /não existe/);
  const doc = await t.call('get_document', {});
  assert.equal(doc.effectStyles[0].name, 'Card');
  assert.equal(doc.gradientStyles[0].type, 'linear');

  const code = await t.call('get_code', { id: frame.id });
  const text = JSON.stringify(code);
  assert.match(text, /box-shadow: var\(--sombra-card\)/);
  assert.match(text, /background-image: var\(--gradiente-marca\)/);
  assert.match(text, /--sombra-card: 0px 8px 24px 0px rgba\(0, 0, 0, 0\.2\), 0px 1px 2px 0px rgba\(0, 0, 0, 0\.1\)/);
  assert.match(text, /--gradiente-marca: linear-gradient\(135deg, #6d28d9 0%, #2dd4ff 100%\)/);

  const css = (await t.call('export_tokens', { format: 'css' })).files[0].content as string;
  assert.match(css, /--sombra-card: 0px 8px 24px/);
  assert.match(css, /--gradiente-marca: linear-gradient\(135deg/);
  const cfg = (await t.call('export_tokens', { format: 'tailwind' })).files.find((f: any) => f.path === 'tailwind.config.js').content as string;
  assert.match(cfg, /"card": "var\(--sombra-card\)"/);
  assert.match(cfg, /"marca": "var\(--gradiente-marca\)"/);
  assert.equal(JSON.parse((await t.call('export_tokens', { format: 'json' })).files[0].content).gradient.Marca.$type, 'gradient');

  // à mão: solta
  await t.call('update_layer', { id: frame.id, props: { shadows: [{ y: 2, blur: 4 }], fill: '#FF0000' } });
  const after = JSON.stringify(await t.call('get_code', { id: frame.id }));
  assert.doesNotMatch(after, /var\(--sombra-card\)|var\(--gradiente-marca\)/);
  await t.close();
});
