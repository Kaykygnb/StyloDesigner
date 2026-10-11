// Plugins: o contrato (definePlugin), a matemática de cor e de escalas do plugin de identidade, e a ligação com o workspace.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { definePlugin } from '@stylo/core/plugin.ts';
import { defineTool, toolByName, mcpTools, registerPluginTools } from '@stylo/core/tools/schema.ts';
import { colorScale, contrastRatio, harmony, hexToOklch, oklchToHex, parseHex, textOn } from '@stylo/plugins/identidade/cor.ts';
import { typeScale, spacingScale, radiusScale, shadowScale } from '@stylo/plugins/identidade/tipografia.ts';
import { createDb } from '@stylo/db/client.ts';
import { createProjects } from '../apps/server/src/services/projects.ts';
import { createOperations } from '../apps/server/src/services/operations.ts';
import { createNotes } from '../apps/server/src/services/notes.ts';
import { createSharing } from '../apps/server/src/services/sharing.ts';
import { createWorkspace } from '../apps/server/src/workspace/index.ts';
import { createPlugins } from '../apps/server/src/plugins.ts';
import { builtinPlugins } from '@stylo/plugins/index.ts';

const near = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≉ ${b} (±${tol})`);

test('cor: contraste WCAG conhecido (preto/branco = 21; #777 no branco ≈ 4.48; #767676 passa AA)', () => {
  const white = parseHex('#fff')!, black = parseHex('#000')!;
  near(contrastRatio(black, white), 21, 0.01);
  near(contrastRatio(parseHex('#777777')!, white), 4.48, 0.02);
  assert.ok(contrastRatio(parseHex('#767676')!, white) >= 4.5);
  assert.equal(parseHex('azul'), null);
  assert.equal(parseHex('#12'), null);
});

test('cor: ida e volta hex ↔ OKLCH não perde cor; cinza tem croma ~0', () => {
  for (const hex of ['#2F6AE0', '#FF5500', '#10B981', '#FFFFFF', '#000000', '#7C5CFF']) {
    const back = oklchToHex(hexToOklch(hex)!);
    const a = parseHex(hex)!, b = parseHex(back)!;
    assert.ok(Math.abs(a.r - b.r) <= 1 && Math.abs(a.g - b.g) <= 1 && Math.abs(a.b - b.b) <= 1, `${hex} → ${back}`);
  }
  near(hexToOklch('#888888')!.c, 0, 0.003);
});

test('cor: escala de 11 degraus mantém o matiz, clareia → escurece e o degrau da cor usa a cor exata', () => {
  const out = colorScale('#2F6AE0')!;
  assert.deepEqual(out.scale.map((s) => s.step), [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
  const baseEntry = out.scale.find((s) => s.step === out.baseStep)!;
  assert.equal(baseEntry.hex, '#2F6AE0');
  const lums = out.scale.map((s) => hexToOklch(s.hex)!.l);
  for (let i = 1; i < lums.length; i++) assert.ok(lums[i] < lums[i - 1], `degrau ${out.scale[i].step} mais escuro que o anterior`);
  const baseHue = hexToOklch('#2F6AE0')!.h;
  for (const s of out.scale.slice(1, -1)) near(hexToOklch(s.hex)!.h, baseHue, 8, `matiz do ${s.step}`);
  assert.ok(out.scale.every((s) => /^#[0-9A-F]{6}$/.test(s.hex)));
  assert.equal(colorScale('nada'), null);
  // cor que não existe no sRGB em luminosidades extremas continua válida (croma reduzido, sem estourar)
  assert.ok(colorScale('#00FF00')!.scale.every((s) => /^#[0-9A-F]{6}$/.test(s.hex)));
});

test('cor: harmonias giram o matiz (complementar = 180°, triádica = 120° e 240°) e a primeira é a cor original', () => {
  const base = hexToOklch('#2F6AE0')!;
  const comp = harmony('#2F6AE0', 'complementary')!;
  assert.equal(comp[0].hex, '#2F6AE0');
  near((hexToOklch(comp[1].hex)!.h - base.h + 360) % 360, 180, 6);
  const tri = harmony('#2F6AE0', 'triadic')!;
  assert.equal(tri.length, 3);
  near((hexToOklch(tri[1].hex)!.h - base.h + 360) % 360, 120, 6);
  near((hexToOklch(tri[2].hex)!.h - base.h + 360) % 360, 240, 6);
  assert.equal(harmony('#2F6AE0', 'monochromatic')!.length, 5);
  assert.equal(harmony('xx', 'triadic'), null);
});

test('cor: o melhor texto sobre amarelo é preto; sobre azul-marinho é branco; aceita candidatas', () => {
  assert.equal(textOn('#FFE066')![0].hex, '#000000');
  assert.equal(textOn('#0B1F4D')![0].hex, '#FFFFFF');
  assert.equal(textOn('#0B1F4D', ['#FFD166', '#222222'])![0].hex, '#FFD166');
  assert.equal(textOn('nada'), null);
});

test('escalas: tipográfica modular, espaçamento, raios e sombras', () => {
  const t = typeScale({ base: 16, ratio: 1.25, up: 3, down: 2 });
  assert.deepEqual(t.map((s) => s.px), [31.25, 25, 20, 16, 12.8, 10.24]);
  assert.equal(t.find((s) => s.name === 'base')!.rem, 1);
  assert.ok(t[0].lineHeight < t[t.length - 1].lineHeight, 'títulos têm linha mais justa que texto pequeno');
  assert.deepEqual(spacingScale({ base: 8, steps: [1, 2, 4] }).map((s) => s.px), [8, 16, 32]);
  assert.equal(radiusScale().at(-1)!.px, 9999);
  const sh = shadowScale({ color: '#112233', opacity: 0.2 });
  assert.match(sh[0].css, /rgba\(17, 34, 51, /);
  assert.ok(sh[5].blur > sh[0].blur && sh[5].y > sh[0].y);
});

test('definePlugin recusa id/nome inválidos, ferramenta repetida e escrita sem projeto; registerPluginTools recusa nome do núcleo', () => {
  const tool = (name: string, extra: object = {}) => ({ def: defineTool({ name, write: false, needs: 'read', description: 'x'.repeat(30), input: z.object({}), ...extra } as any), run: () => ({}) });
  assert.throws(() => definePlugin({ id: 'Mau Id', name: 'x' }), /Id de plugin inválido/);
  assert.throws(() => definePlugin({ id: 'ok', name: 'x', tools: [tool('Nome-Ruim')] }), /nome de ferramenta inválido/);
  assert.throws(() => definePlugin({ id: 'ok', name: 'x', tools: [tool('minha_ferramenta'), tool('minha_ferramenta')] }), /repetida/);
  assert.throws(() => definePlugin({ id: 'ok', name: 'x', tools: [tool('altera_algo', { write: true })] }), /não declara projeto/);
  assert.ok(definePlugin({ id: 'ok', name: 'x', tools: [tool('so_calcula')] }));
  assert.throws(() => registerPluginTools([tool('get_document').def]), /repetida/);
});

async function setup() {
  const { db, close } = await createDb({ pglite: {} });
  const owner = await db.user.create({ data: { email: 'o@x.com', name: 'O', passwordHash: '!', role: 'OWNER' } });
  const operations = createOperations(db);
  const plugins = createPlugins({ plugins: builtinPlugins });
  let workspace: ReturnType<typeof createWorkspace>;
  const projects = createProjects({ db, getConfig: () => ({ keepVersions: 5 }), onWrite: (e) => { void workspace.externalWrite(e); } });
  workspace = createWorkspace({ projects, notes: createNotes(db), sharing: createSharing(db), operations, plugins, onOperation: (op) => { void operations.record(op); } });
  const agent = async (scopes: string[]) => {
    const a = await db.agent.create({ data: { name: `A-${Math.random()}`, ownerId: owner.id, tokenHash: `h-${Math.random()}`, scopes, status: 'ACTIVE' } });
    return { type: 'AGENT' as const, userId: owner.id, agentId: a.id, name: a.name, scopes };
  };
  return { workspace, agent, plugins, close: async () => { await operations.idle(); await close(); } };
}

test('as ferramentas do plugin de identidade aparecem no tools/list e funcionam sem projeto aberto', async () => {
  const t = await setup();
  const names = mcpTools().map((x) => x.name);
  for (const n of ['color_scale', 'color_contrast', 'color_harmony', 'color_text_on', 'design_scale']) assert.ok(names.includes(n), n);
  assert.equal(toolByName('color_scale')!.write, false);
  assert.equal((mcpTools().find((x) => x.name === 'color_scale')!.inputSchema as any).required[0], 'color');

  const a = await t.agent(['read']);
  const scale = await t.workspace.call('color_scale', { color: '#2F6AE0' }, { sid: 's', actor: a });
  assert.equal(scale.ok, true);
  assert.equal(scale.scale.length, 11);
  const contrast = await t.workspace.call('color_contrast', { foreground: '#000', background: '#fff' }, { sid: 's', actor: a });
  assert.equal(contrast.ratio, 21);
  assert.equal(contrast.normalText.AAA, true);
  const type = await t.workspace.call('design_scale', { kind: 'type', base: 16, ratio: 'major-third' }, { sid: 's', actor: a });
  assert.equal(type.ratio, 1.25);
  assert.ok(type.steps.some((s: any) => s.px === 20));
  assert.equal((await t.workspace.call('design_scale', { kind: 'shadow', color: '#123456' }, { sid: 's', actor: a })).steps.length, 6);
  await t.close();
});

test('plugins: argumentos inválidos voltam como erro de validação; cor inválida explica; sem leitura não calcula', async () => {
  const t = await setup();
  const a = await t.agent(['read']);
  assert.match((await t.workspace.call('color_scale', {}, { sid: 's', actor: a })).error, /Argumentos inválidos para color_scale — color:/);
  assert.match((await t.workspace.call('color_harmony', { color: '#2F6AE0', scheme: 'quadrada' }, { sid: 's', actor: a })).error, /scheme:/);
  assert.match((await t.workspace.call('color_scale', { color: 'azul' }, { sid: 's', actor: a })).error, /não é uma cor hexadecimal/);
  const nobody = await t.agent([]);
  assert.match((await t.workspace.call('color_scale', { color: '#fff' }, { sid: 's', actor: nobody })).error, /permissão de leitura/);
  await t.close();
});
