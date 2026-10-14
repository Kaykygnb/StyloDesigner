// DOC-STUDIO-001: o painel (createStudioCaller) e o MCP (createToolCaller) executam o mesmo roteiro
// em projetos equivalentes. A comparação é pela forma observável — contagens, nomes, props, paths/bytes,
// undo efetivo e log por ator — porque os ids nascem em cada execução. Sem Chromium.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '@stylo/db/client.ts';
import { createProjects } from '../apps/server/src/services/projects.ts';
import { createOperations } from '../apps/server/src/services/operations.ts';
import { createNotes } from '../apps/server/src/services/notes.ts';
import { createSharing } from '../apps/server/src/services/sharing.ts';
import { createWorkspace } from '../apps/server/src/workspace/index.ts';
import { createStudioCaller, studioSessionId } from '../apps/server/src/studio/studio-calls.ts';
import { createToolCaller } from '../apps/server/src/mcp/agent-calls.ts';
import { createPresence } from '../apps/server/src/presence.js';
import { createEvents } from '../apps/server/src/events.ts';

const LAYOUT = {
  type: 'frame',
  props: { name: 'Card', w: 320, h: 180, fill: '#f4f4f5', layout: { mode: 'column', gap: 8 } },
  children: [{ type: 'text', props: { name: 'Titulo', text: 'Ola', fill: '#111111' } }],
};

async function setup({ now = Date.now } = {}) {
  const { db, close } = await createDb({ pglite: {} });
  const studioOwner = await db.user.create({ data: { email: 'pessoa-paridade@parity.test', name: 'Pessoa Paridade', passwordHash: '!', role: 'OWNER' } });
  const agentOwner = await db.user.create({ data: { email: 'dono-agente@parity.test', name: 'Dono Agente', passwordHash: '!', role: 'OWNER' } });
  const viewer = await db.user.create({ data: { email: 'leitor-paridade@parity.test', name: 'Leitor Paridade', passwordHash: '!', role: 'MEMBER' } });
  const operations = createOperations(db);
  const presence = createPresence({ now });
  const events = createEvents({ presence });
  let workspace;
  const projects = createProjects({ db, getConfig: () => ({ keepVersions: 5 }), onWrite: (e) => { void workspace.externalWrite(e); } });
  workspace = createWorkspace({ projects, notes: createNotes(db), sharing: createSharing(db), operations, presence: () => presence.snapshot(), onOperation: (op) => { void operations.record(op); } });
  const studio = createStudioCaller({ workspace, presence, events });
  const mcp = createToolCaller({ workspace, presence, events });
  const agentOf = async (name, scopes, user = agentOwner) => {
    const row = await db.agent.create({ data: { name, ownerId: user.id, tokenHash: `h-${name}-${Math.random()}`, scopes, status: 'ACTIVE' } });
    return {
      id: `mcp-${row.id}`, name, activeCalls: 0, closing: false, lastSeen: Date.now(),
      agent: { id: row.id, name, type: 'mcp', ownerId: user.id, scopes: row.scopes },
    };
  };
  const closeAll = async () => { await operations.idle(); await close(); };
  return { db, studioOwner, agentOwner, viewer, workspace, operations, presence, studio, mcp, agentOf, close: closeAll };
}

const person = (user) => ({ id: user.id, email: user.email, name: user.name, color: null });

/** Forma estável do documento: ignora ids gerados e conserva ordem, nomes e props visíveis. */
function observableDoc(doc) {
  const layer = (node) => {
    const out = {};
    for (const key of ['type', 'name', 'x', 'y', 'w', 'h', 'fill', 'stroke', 'layout', 'flipX', 'flipY', 'text', 'sizeX', 'sizeY', 'visible', 'opacity']) {
      if (node[key] !== undefined) out[key] = node[key];
    }
    if (node.children?.length) out.children = node.children.map(layer);
    return out;
  };
  return { name: doc.name, pages: doc.pages.map((page) => ({ name: page.name, children: (page.children || []).map(layer) })) };
}

function selectionShape(out) {
  return (out.layers || []).map((layer) => ({
    name: layer.name, type: layer.type,
    children: (layer.children || []).map((child) => ({ name: child.name, type: child.type })),
  }));
}

function siteShape(out) {
  return {
    totalBytes: out.totalBytes,
    warnings: out.warnings ?? [],
    files: (out.files || []).map((file) => ({ path: file.path, bytes: file.bytes, binary: !!file.binary })).sort((a, b) => a.path.localeCompare(b.path)),
  };
}

function activityTools(out) {
  return [...out.activity].reverse().map((row) => ({ tool: row.tool, actorType: row.actorType, who: row.who, ok: row.ok }));
}

async function runScript(call, shapeOf) {
  const ok = async (tool, args) => {
    const out = await call(tool, args);
    assert.equal(out.error, undefined, `${tool}: ${out.error}`);
    return out;
  };
  const snap = () => structuredClone(shapeOf());
  await ok('new_project', { name: 'Paridade' });
  const tela = await ok('create_layer', { type: 'frame', props: { name: 'Tela', w: 800, h: 400, fill: '#ffffff' } });
  const caixa = await ok('create_layer', { type: 'rect', parent_id: tela.created.id, props: { name: 'Caixa', x: 10, y: 20, w: 120, h: 40, fill: '#ff0000' } });
  const outra = await ok('create_layer', { type: 'rect', parent_id: tela.created.id, props: { name: 'Outra', x: 40, y: 30, w: 80, h: 40, fill: '#00aa44' } });
  const selectionAfterCreate = selectionShape(await ok('get_selection', {}));
  await ok('update_layer', { id: caixa.created.id, props: { x: 77, fill: '#112233' } });
  const afterUnit = snap();
  await ok('update_layers', { updates: [
    { id: caixa.created.id, props: { name: 'Caixa A' } },
    { id: outra.created.id, props: { name: 'Caixa B', y: 48 } },
  ] });
  const afterBatch = snap();
  assert.notDeepEqual(afterBatch, afterUnit, 'o lote muda o documento');
  await ok('undo', {});
  assert.deepEqual(snap(), afterUnit, 'undo desfaz o update em lote');
  await ok('redo', {});
  assert.deepEqual(snap(), afterBatch, 'redo refaz o update em lote');
  await ok('arrange_layers', { ids: [caixa.created.id], action: 'front' });
  const selectionAfterArrange = selectionShape(await ok('get_selection', {}));
  const afterArrange = snap();
  assert.notDeepEqual(afterArrange, afterBatch, 'arrange muda a ordem observável');
  await ok('undo', {});
  assert.deepEqual(snap(), afterBatch, 'undo desfaz o arranjo');
  await ok('redo', {});
  assert.deepEqual(snap(), afterArrange, 'redo refaz o arranjo');
  await ok('build_layout', { tree: LAYOUT });
  const selectionAfterLayout = selectionShape(await ok('get_selection', {}));
  const afterLayout = snap();
  assert.notDeepEqual(afterLayout, afterArrange, 'build_layout acrescenta a estrutura');
  await ok('undo', {});
  assert.deepEqual(snap(), afterArrange, 'undo desfaz o layout');
  await ok('redo', {});
  assert.deepEqual(snap(), afterLayout, 'redo refaz o layout');
  const selection = selectionShape(await ok('get_selection', {}));
  const site = siteShape(await ok('export_site', {}));
  return { shape: afterLayout, selection, selectionAfterCreate, selectionAfterArrange, selectionAfterLayout, site };
}

test('paridade: Studio e MCP produzem o mesmo documento, seleção, undo, exportação e trilha por ator', async (t) => {
  const env = await setup();
  t.after(() => env.close());
  const user = person(env.studioOwner);
  const tabId = 'aba-paridade-001';
  const session = await env.agentOf('Agente Paridade', ['read', 'write', 'export']);
  const studioSid = () => studioSessionId(user.id, tabId);
  const studioShape = () => observableDoc(env.workspace.snapshot(studioSid()).doc);
  const mcpShape = () => observableDoc(env.workspace.snapshot(session.id).doc);
  const studioCall = (tool, args) => {
    const pageId = env.workspace.snapshot(studioSid())?.pageId;
    return env.studio.call(user, { sid: tabId, tool, args, ...(pageId ? { pageId } : {}) });
  };
  const studioResult = await runScript(studioCall, studioShape);
  const studioPresence = env.presence.snapshot().activity.filter((item) => item.who === 'Pessoa Paridade').map((item) => item.text);
  const mcpResult = await runScript((tool, args) => env.mcp.call(session, tool, args), mcpShape);
  const mcpPresence = env.presence.snapshot().activity.filter((item) => item.who === 'Agente Paridade' && item.text !== 'conectou pelo MCP').map((item) => item.text);

  assert.deepEqual(studioResult.shape, mcpResult.shape, 'documento observável igual');
  assert.deepEqual(studioResult.selectionAfterCreate, mcpResult.selectionAfterCreate);
  assert.deepEqual(studioResult.selectionAfterCreate, [{ name: 'Outra', type: 'rect', children: [] }]);
  assert.deepEqual(studioResult.selectionAfterArrange, mcpResult.selectionAfterArrange);
  assert.deepEqual(studioResult.selectionAfterArrange, [{ name: 'Caixa A', type: 'rect', children: [] }]);
  assert.deepEqual(studioResult.selectionAfterLayout, mcpResult.selectionAfterLayout);
  assert.ok(studioResult.selectionAfterLayout.some((layer) => layer.name === 'Card' && layer.children.some((child) => child.name === 'Titulo')));
  assert.deepEqual(studioResult.selection, mcpResult.selection, 'seleção depois de undo/redo igual');
  assert.deepEqual(studioResult.site, mcpResult.site, 'metadados de export_site iguais');
  assert.ok(studioResult.site.files.some((file) => file.path.endsWith('.html') && file.bytes > 0));
  assert.equal(studioResult.site.totalBytes, studioResult.site.files.reduce((sum, file) => sum + file.bytes, 0));

  await env.operations.idle();
  const studioActivity = activityTools(await studioCall('get_activity', {}));
  const mcpActivity = activityTools(await env.mcp.call(session, 'get_activity', {}));
  const tools = ['new_project', 'create_layer', 'create_layer', 'create_layer', 'update_layer', 'update_layers', 'undo', 'redo', 'arrange_layers', 'undo', 'redo', 'build_layout', 'undo', 'redo'];
  assert.deepEqual(studioActivity.map((row) => row.tool), tools);
  assert.deepEqual(mcpActivity.map((row) => row.tool), tools);
  assert.ok(studioActivity.every((row) => row.actorType === 'USER' && row.who === 'Pessoa Paridade' && row.ok));
  assert.ok(mcpActivity.every((row) => row.actorType === 'AGENT' && row.who === 'Agente Paridade' && row.ok));

  assert.deepEqual(studioPresence, mcpPresence, 'presença registra os mesmos resumos para pessoa e agente');
  assert.equal(studioPresence.length, tools.length);
});

test('paridade: escopo só de leitura e papel VIEWER recusam mutação e preservam o documento', async (t) => {
  let now = 1_700_000_000_000;
  const env = await setup({ now: () => now });
  t.after(() => env.close());
  const user = person(env.studioOwner);
  const viewer = person(env.viewer);
  const full = await env.agentOf('Agente Completo', ['read', 'write', 'export']);
  const reader = await env.agentOf('Agente Leitor', ['read']);

  const created = await env.studio.call(user, { sid: 'aba-dono', tool: 'new_project', args: { name: 'Somente leitura' } });
  assert.equal(created.error, undefined, created.error);
  const board = await env.studio.call(user, { sid: 'aba-dono', tool: 'create_layer', args: { type: 'frame', props: { name: 'Tela', w: 200, h: 120, fill: '#ffffff' } } });
  assert.equal(board.error, undefined, board.error);
  const layer = await env.studio.call(user, { sid: 'aba-dono', tool: 'create_layer', args: { type: 'rect', parent_id: board.created.id, props: { name: 'Intocada', w: 30, h: 20, fill: '#abcdef' } } });
  assert.equal(layer.error, undefined, layer.error);
  const shared = await env.studio.call(user, { sid: 'aba-dono', tool: 'share_project', args: { email: viewer.email, role: 'viewer' } });
  assert.equal(shared.error, undefined, shared.error);
  const openedViewer = await env.studio.call(viewer, { sid: 'aba-leitor', tool: 'open_project', args: { file: created.file } });
  assert.equal(openedViewer.role, 'VIEWER');

  const agentProject = await env.mcp.call(full, 'new_project', { name: 'Somente leitura' });
  assert.equal(agentProject.error, undefined, agentProject.error);
  const agentBoard = await env.mcp.call(full, 'create_layer', { type: 'frame', props: { name: 'Tela', w: 200, h: 120, fill: '#ffffff' } });
  assert.equal(agentBoard.error, undefined, agentBoard.error);
  const agentLayer = await env.mcp.call(full, 'create_layer', { type: 'rect', parent_id: agentBoard.created.id, props: { name: 'Intocada', w: 30, h: 20, fill: '#abcdef' } });
  assert.equal(agentLayer.error, undefined, agentLayer.error);
  const openedReader = await env.mcp.call(reader, 'open_project', { file: agentProject.file });
  assert.equal(openedReader.error, undefined, openedReader.error);

  const studioSid = studioSessionId(viewer.id, 'aba-leitor');
  const beforeStudio = structuredClone(observableDoc(env.workspace.snapshot(studioSid).doc));
  const beforeAgent = structuredClone(observableDoc(env.workspace.snapshot(reader.id).doc));
  await env.operations.idle();
  const studioAudit = (await env.studio.call(viewer, { sid: 'aba-leitor', tool: 'get_activity' })).activity.length;
  const agentAudit = (await env.mcp.call(reader, 'get_activity', {})).activity.length;

  now += 11_000;
  const writes = (id) => [
    ['create_layer', { type: 'rect', props: { name: 'Proibida', w: 8, h: 8 } }],
    ['update_layer', { id, props: { name: 'Alterada' } }],
    ['update_layers', { updates: [{ id, props: { x: 9 } }] }],
    ['arrange_layers', { ids: [id], action: 'front' }],
    ['build_layout', { tree: { type: 'frame', props: { name: 'Extra', w: 40, h: 40 } } }],
    ['undo', {}],
  ];
  for (const [tool, args] of writes(layer.created.id)) {
    const out = await env.studio.call(viewer, { sid: 'aba-leitor', tool, args });
    assert.match(out.error, /só pode ler ou comentar/, `${tool} no painel`);
  }
  for (const [tool, args] of writes(agentLayer.created.id)) {
    const out = await env.mcp.call(reader, tool, args);
    assert.match(out.error, /permissão de escrita/, `${tool} no MCP`);
  }

  const studioSite = await env.studio.call(viewer, { sid: 'aba-leitor', tool: 'export_site' });
  const agentSite = await env.mcp.call(reader, 'export_site', {});
  assert.equal(studioSite.error, undefined, studioSite.error);
  assert.equal(agentSite.error, undefined, agentSite.error);
  assert.deepEqual(siteShape(studioSite), siteShape(agentSite), 'metadados de leitura iguais nos dois projetos equivalentes');
  const studioZip = await env.studio.call(viewer, { sid: 'aba-leitor', tool: 'export_zip' });
  assert.match(studioZip.error, /só pode ler ou comentar/, 'VIEWER no painel');
  assert.equal(studioZip.site_zip_url, undefined);
  assert.match((await env.mcp.call(reader, 'export_zip', {})).error, /permissão de exportar/);

  assert.deepEqual(observableDoc(env.workspace.snapshot(studioSid).doc), beforeStudio);
  assert.deepEqual(observableDoc(env.workspace.snapshot(reader.id).doc), beforeAgent);
  await env.operations.idle();
  assert.equal((await env.studio.call(viewer, { sid: 'aba-leitor', tool: 'get_activity' })).activity.length, studioAudit);
  assert.equal((await env.mcp.call(reader, 'get_activity', {})).activity.length, agentAudit);
  const viewerAgent = await env.agentOf('Agente do leitor', ['read', 'write', 'export'], env.viewer);
  const openedViewerAgent = await env.mcp.call(viewerAgent, 'open_project', { file: created.file });
  assert.equal(openedViewerAgent.role, 'VIEWER');
  const viewerAgentZip = await env.mcp.call(viewerAgent, 'export_zip', {});
  assert.match(viewerAgentZip.error, /só pode ler ou comentar/, 'agente do VIEWER com scope export');
  assert.equal(viewerAgentZip.site_zip_url, undefined);

  const ownerZip = await env.studio.call(user, { sid: 'aba-dono', tool: 'export_zip' });
  assert.equal(ownerZip.error, undefined, ownerZip.error);
  assert.match(ownerZip.site_zip_url, /\/site\.zip$/);
  const fullZip = await env.mcp.call(full, 'export_zip', {});
  assert.equal(fullZip.error, undefined, fullZip.error);
  assert.match(fullZip.site_zip_url, /\/site\.zip$/);
  const commenter = await env.db.user.create({ data: { email: 'comenta-paridade@parity.test', name: 'Comenta Paridade', passwordHash: '!', role: 'MEMBER' } });
  const sharedComment = await env.studio.call(user, { sid: 'aba-dono', tool: 'share_project', args: { email: commenter.email, role: 'commenter' } });
  assert.equal(sharedComment.error, undefined, sharedComment.error);
  const openedComment = await env.studio.call(person(commenter), { sid: 'aba-comenta', tool: 'open_project', args: { file: created.file } });
  assert.equal(openedComment.role, 'COMMENTER');
  const commentZip = await env.studio.call(person(commenter), { sid: 'aba-comenta', tool: 'export_zip' });
  assert.equal(commentZip.error, undefined, commentZip.error);
  assert.match(commentZip.site_zip_url, /\/site\.zip$/);
});
