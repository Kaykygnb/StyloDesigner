// Serviços do servidor sobre o banco: contas, sessões, cadastro de agentes e regras de gravação dos projetos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '@stylo/db/client.ts';
import { createAuth, verifyPassword, hashPassword } from '../apps/server/src/services/auth.ts';
import { createAgents } from '../apps/server/src/services/agents.ts';
import { createProjects } from '../apps/server/src/services/projects.ts';

const doc = (name: string) => ({ name, pages: [{ id: 'p1', name: 'Página 1', children: [] }], assets: {}, styles: { colors: [], texts: [] } });

test('senha: scrypt confere a certa, recusa a errada e o usuário técnico nunca entra', () => {
  const stored = hashPassword('uma-senha-boa');
  assert.ok(verifyPassword('uma-senha-boa', stored));
  assert.ok(!verifyPassword('outra', stored));
  assert.ok(!verifyPassword('qualquer', '!'));
  assert.notEqual(hashPassword('uma-senha-boa'), stored, 'sal diferente a cada vez');
});

test('conta mestre: o setup só funciona uma vez; login cria sessão; token errado e logout invalidam', async () => {
  const { db, close } = await createDb();
  const auth = createAuth(db);
  assert.equal(await auth.hasAccounts(), false);
  await auth.localUser(); // o usuário técnico não conta como conta de pessoa
  assert.equal(await auth.hasAccounts(), false);
  await assert.rejects(auth.setup({ email: 'x', name: 'A', password: '12345678' }), /E-mail inválido/);
  await assert.rejects(auth.setup({ email: 'a@x.com', name: 'A', password: 'curta' }), /8 caracteres/);
  const owner = await auth.setup({ email: 'Dono@X.com', name: 'Dono', password: 'senha-do-dono' });
  assert.equal(owner.role, 'OWNER');
  assert.equal(owner.email, 'dono@x.com');
  const avatar = 'data:image/png;base64,' + 'a'.repeat(80);
  const withAvatar = await auth.updateUser(owner.id, { avatar });
  assert.equal(withAvatar.avatar, avatar);
  const withPreferences = await auth.updateUser(owner.id, { preferences: { theme: 'light', accent: '#4c8dff', density: 'compact', language: 'pt-BR' } });
  assert.deepEqual(withPreferences.preferences, { theme: 'light', accent: '#4c8dff', density: 'compact', language: 'pt-BR' });
  await assert.rejects(auth.updateUser(owner.id, { avatar: 'javascript:alert(1)' }), /Avatar inválido/);
  await assert.rejects(auth.setup({ email: 'b@x.com', name: 'B', password: '12345678' }), /Já existe uma conta mestre/);

  await assert.rejects(auth.login('dono@x.com', 'errada'), /incorretos/);
  for (let i = 0; i < 8; i++) await assert.rejects(auth.login('bloqueado@x.com', 'errada'), /incorretos/);
  await assert.rejects(auth.login('bloqueado@x.com', 'errada'), /Muitas tentativas/);
  await assert.rejects(auth.login('ninguem@x.com', 'qualquer'), /incorretos/, 'mesma mensagem para e-mail inexistente');
  const { token } = await auth.login('DONO@x.com', 'senha-do-dono');
  assert.equal((await auth.userFromToken(token))?.preferences.theme, 'light');
  assert.equal((await auth.userFromToken(token))?.name, 'Dono');
  const second = await auth.login('dono@x.com', 'senha-do-dono');
  assert.equal((await auth.sessions(owner.id, token)).length, 2);
  const revoked = await auth.revokeAllSessions(owner.id);
  assert.equal(revoked.count, 2);
  assert.equal((await auth.userFromToken(token)), null);
  assert.equal((await auth.userFromToken(second.token)), null);
  const { token: activeToken } = await auth.login('dono@x.com', 'senha-do-dono');
  assert.equal(await auth.userFromToken('token-falso'), null);
  const stored = await db.session.findFirstOrThrow();
  assert.notEqual(stored.tokenHash, token, 'só o hash fica no banco');
  await auth.logout(activeToken);
  assert.equal(await auth.userFromToken(activeToken), null);
  const authEvents = await auth.authEvents(owner.id);
  assert.ok(authEvents.some((e) => e.kind === 'login'));
  assert.ok(authEvents.some((e) => e.kind === 'logout'));

  const member = await auth.createUser({ email: 'm@x.com', name: 'Membro', password: 'senha-membro' });
  assert.equal(member.role, 'MEMBER');
  assert.equal(member.mustChangePassword, true, 'convite exige troca da senha temporária');
  await auth.login('m@x.com', 'senha-membro');
  const suspended = await auth.setSuspended(member.id, true);
  assert.equal(suspended.suspended, true);
  await assert.rejects(auth.login('m@x.com', 'senha-membro'), /incorretos/);
  const active = await auth.setSuspended(member.id, false);
  assert.equal(active.suspended, false);
  await assert.rejects(auth.createUser({ email: 'm@x.com', name: 'Outro', password: 'senha-membro' }), /Já existe uma conta/);
  assert.equal((await auth.users()).length, 2);
  await close();
});

test('agentes: token aparece uma vez; pendente não entra; revogar vale na hora; política decide o cadastro', async () => {
  const { db, close } = await createDb();
  const auth = createAuth(db);
  const agents = createAgents(db);
  const owner = await auth.setup({ email: 'dono@x.com', name: 'Dono', password: 'senha-do-dono' });

  const { agent, token } = await agents.create(owner.id, { name: 'Claude Code', scopes: ['read', 'write', 'lixo'] });
  assert.deepEqual(agent.scopes, ['read', 'write'], 'escopos desconhecidos são descartados');
  assert.ok(token.startsWith('stylo_agt_'));
  assert.notEqual((await db.agent.findFirstOrThrow()).tokenHash, token);
  assert.equal((await agents.authenticate(token)).name, 'Claude Code');
  await assert.rejects(agents.authenticate('stylo_agt_falso'), /inválido/);
  const rotated = await agents.rotate(agent.id);
  assert.notEqual(rotated.token, token);
  await assert.rejects(agents.authenticate(token), /inválido/);
  assert.equal((await agents.authenticate(rotated.token)).id, agent.id);

  await agents.revoke(agent.id);
  await assert.rejects(agents.authenticate(rotated.token), /revogado/);
  await agents.approve(agent.id);
  assert.equal((await agents.authenticate(rotated.token)).id, agent.id);

  // política aberta: registra sozinho pelo nome e reaproveita o mesmo agente depois
  const a1 = await agents.forClient(owner.id, 'Codex', 'open');
  const a2 = await agents.forClient(owner.id, 'Codex', 'open');
  assert.equal(a1.id, a2.id);
  // política de aprovação: nasce pendente; entra só depois de aprovado
  await assert.rejects(agents.forClient(owner.id, 'Cursor', 'approval'), /aguarde a conta mestre/);
  await assert.rejects(agents.forClient(owner.id, 'Cursor', 'approval'), /ainda não foi aprovado/);
  const pending = (await agents.list()).find((a) => a.name === 'Cursor')!;
  assert.equal(pending.status, 'PENDING');
  await agents.approve(pending.id);
  assert.equal((await agents.forClient(owner.id, 'Cursor', 'approval')).id, pending.id);
  const project = await db.project.create({ data: { slug: 'privado.json', name: 'Privado', ownerId: owner.id, doc: doc('Privado'), size: JSON.stringify(doc('Privado')).length } });
  assert.equal(await agents.projectAccess(agent.id, project.id), false);
  await agents.grantProject(agent.id, project.id);
  assert.equal(await agents.projectAccess(agent.id, project.id), true);
  assert.equal((await agents.projects(agent.id)).length, 1);
  await agents.revokeProject(agent.id, project.id);
  assert.equal(await agents.projectAccess(agent.id, project.id), false);
  // política fechada: sem token não entra
  await assert.rejects(agents.forClient(owner.id, 'Novo', 'closed'), /só aceita agentes com token/);
  await close();
});

test('projetos: conflito por revisão, versões a cada intervalo com limite, papéis e renomear', async () => {
  const { db, close } = await createDb();
  const owner = await db.user.create({ data: { email: 'o@x.com', name: 'O', passwordHash: '!' } });
  const guest = await db.user.create({ data: { email: 'g@x.com', name: 'G', passwordHash: '!' } });
  const projects = createProjects({ db, getConfig: () => ({ keepVersions: 2 }), versionEveryMs: 0 });
  const me = { id: owner.id };

  const first = await projects.write(me, 'site.json', doc('v1'));
  assert.equal(first.revision, 1);
  await assert.rejects(projects.write(me, 'site.json', doc('sem base')), /alterado por outra pessoa/);
  const second = await projects.write(me, 'site.json', doc('v2'), { base: { hash: first.contentHash } });
  await assert.rejects(projects.write(me, 'site.json', doc('base velha'), { base: { hash: first.contentHash } }), /alterado/);
  const third = await projects.write(me, 'site.json', doc('v3'), { base: { hash: second.contentHash } });
  await projects.write(me, 'site.json', doc('v4'), { base: { hash: third.contentHash } });
  // duas gravações disputando a mesma revisão: só uma passa
  const cur = (await projects.load(me, 'site.json')).contentHash;
  const race = await Promise.allSettled([
    projects.write(me, 'site.json', doc('A'), { base: { hash: cur } }),
    projects.write(me, 'site.json', doc('B'), { base: { hash: cur } }),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
  const versions = await projects.versions(me, 'site.json');
  assert.equal(versions.length, 2, 'só as 2 versões mais novas ficam (keepVersions)');
  assert.ok(versions[0].size > 0);
  await projects.labelVersion(me, 'site.json', versions[0].id, 'Antes da revisão final');
  assert.equal((await projects.versions(me, 'site.json'))[0].label, 'Antes da revisão final');
  const comparison = await projects.compareVersions(me, 'site.json', versions[0].id, versions[1].id);
  assert.equal(comparison.same, false);
  assert.ok(comparison.changed.includes('name'));
  const copy = await projects.duplicateVersion(me, 'site.json', versions[0].id, 'copia da versão');
  assert.equal(copy.file, 'copia-da-versao.json');
  assert.equal((await projects.load(me, copy.file)).doc.name, 'v4');

  // papéis: quem não é membro nem vê; VIEWER lê mas não grava; EDITOR grava
  const stranger = { id: guest.id };
  await assert.rejects(projects.load(stranger, 'site.json'), /não encontrado/);
  const project = await db.project.findFirstOrThrow();
  await db.projectMember.create({ data: { projectId: project.id, userId: guest.id, role: 'VIEWER' } });
  assert.equal((await projects.load(stranger, 'site.json')).role, 'VIEWER');
  await assert.rejects(projects.write(stranger, 'site.json', doc('x'), { overwrite: true }), /só pode ler/);
  assert.equal((await projects.list(stranger)).length, 1);
  await db.projectMember.update({ where: { projectId_userId: { projectId: project.id, userId: guest.id } }, data: { role: 'EDITOR' } });
  await projects.write(stranger, 'site.json', doc('do editor'), { overwrite: true });
  assert.equal((await projects.load(me, 'site.json')).doc.name, 'do editor');

  // renomear: só o dono, recusa nome existente e inválido
  await projects.write(me, 'outro.json', doc('outro'));
  await assert.rejects(projects.rename(me, 'site.json', 'outro.json'), /Já existe/);
  await assert.rejects(projects.rename(me, 'site.json', '../fora.json'), /inválido/);
  await assert.rejects(projects.rename(stranger, 'site.json', 'novo.json'), /Só o dono/);
  assert.equal((await projects.rename(me, 'site.json', 'final.json')).file, 'final.json');
  assert.equal(await projects.exists(me, 'site.json'), false);
  await close();
});

test('gravar o mesmo conteúdo de novo não cria revisão, versão nem aviso (evita laço editor ↔ servidor)', async () => {
  const { db, close } = await createDb();
  const owner = await db.user.create({ data: { email: 'o@x.com', name: 'O', passwordHash: '!' } });
  const events: string[] = [];
  const projects = createProjects({ db, getConfig: () => ({ keepVersions: 5 }), versionEveryMs: 0, onWrite: (e) => events.push(e.contentHash) });
  const me = { id: owner.id };
  const a = await projects.write(me, 'a.json', doc('igual'));
  const b = await projects.write(me, 'a.json', doc('igual'), { base: { hash: a.contentHash } });
  assert.equal(b.revision, a.revision);
  assert.deepEqual(events, [a.contentHash], 'só a primeira gravação avisa');
  assert.equal((await projects.versions(me, 'a.json')).length, 0);
  const c = await projects.write(me, 'a.json', doc('diferente'), { base: { hash: a.contentHash } });
  assert.equal(c.revision, a.revision + 1);
  await close();
});

const PNG_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const GIF_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

test('imagens saem do JSON: uma vez por conteúdo, o documento volta com data URLs, versões leves, lixo recolhido', async () => {
  const { db, close } = await createDb();
  const owner = await db.user.create({ data: { email: 'o@x.com', name: 'O', passwordHash: '!' } });
  const stranger = await db.user.create({ data: { email: 's@x.com', name: 'S', passwordHash: '!' } });
  const projects = createProjects({ db, getConfig: () => ({ keepVersions: 5 }), versionEveryMs: 0 });
  const me = { id: owner.id };
  const withAssets = (assets: Record<string, string>, name = 'img') => ({ ...doc(name), assets });

  // duas ids com o MESMO conteúdo + uma imagem diferente + um valor que não é imagem
  const first = await projects.write(me, 'foto.json', withAssets({ a: PNG_URL, b: PNG_URL, c: GIF_URL, d: 'https://exemplo.com/x.png' }));
  const stored = (await db.project.findFirstOrThrow()).doc as any;
  assert.match(stored.assets.a, /^asset:[0-9a-f]{64}$/, 'o JSON leva só a referência');
  assert.equal(stored.assets.a, stored.assets.b, 'mesmo conteúdo, mesma referência');
  assert.equal(stored.assets.d, 'https://exemplo.com/x.png', 'o que não é imagem embutida fica como está');
  assert.equal(JSON.stringify(stored).includes('base64'), false, 'nenhum base64 no JSON');
  assert.equal(await db.asset.count(), 2, 'duas imagens distintas guardadas, não três');

  const loaded = await projects.load(me, 'foto.json');
  assert.equal(loaded.doc.assets.a, PNG_URL, 'ao ler, volta o data URL');
  assert.equal(loaded.doc.assets.c, GIF_URL);

  // por endereço: o dono lê, quem não tem acesso não
  const hash = stored.assets.a.slice('asset:'.length);
  const served = await projects.asset(me, 'foto.json', hash);
  assert.equal(served.mime, 'image/png');
  assert.equal(served.data.length, Buffer.from(PNG_URL.split(',')[1], 'base64').length);
  await assert.rejects(projects.asset({ id: stranger.id }, 'foto.json', hash), /não encontrado/i);
  await assert.rejects(projects.asset(me, 'foto.json', 'f'.repeat(64)), /Imagem não encontrada/);

  // tirar a imagem do documento: a versão guardada ainda precisa dela, então ela fica; a versão hidrata
  await projects.write(me, 'foto.json', withAssets({ c: GIF_URL }), { base: { hash: first.contentHash } });
  assert.equal(await db.asset.count(), 2, 'a versão anterior ainda usa a imagem PNG');
  const versions = await projects.versions(me, 'foto.json');
  const old = await projects.readVersion(me, 'foto.json', versions[0].id) as any;
  assert.equal(old.assets.a, PNG_URL, 'a versão antiga também volta com data URL');
  const versionRow = await db.projectVersion.findFirstOrThrow();
  assert.equal(JSON.stringify(versionRow.doc).includes('base64'), false, 'versões também são leves');

  // quando a versão sai do limite de versões, a imagem some
  const p = createProjects({ db, getConfig: () => ({ keepVersions: 1 }), versionEveryMs: 0 });
  let base = (await p.load(me, 'foto.json')).contentHash;
  for (const label of ['x1', 'x2', 'x3']) base = (await p.write(me, 'foto.json', withAssets({ c: GIF_URL }, label), { base: { hash: base } })).contentHash;
  assert.equal(await db.asset.count(), 1, 'só a imagem ainda usada continua guardada');
  await close();
});

test('projeto antigo com imagem embutida no JSON é externalizado na próxima gravação', async () => {
  const { db, close } = await createDb();
  const owner = await db.user.create({ data: { email: 'o@x.com', name: 'O', passwordHash: '!' } });
  const old = await db.project.create({ data: { slug: 'velho.json', name: 'Velho', ownerId: owner.id, doc: { ...doc('velho'), assets: { a: PNG_URL } }, revision: 1 } });
  const projects = createProjects({ db, getConfig: () => ({ keepVersions: 5 }), versionEveryMs: 0 });
  const me = { id: owner.id };
  const loaded = await projects.load(me, 'velho.json');
  assert.equal(loaded.doc.assets.a, PNG_URL, 'lê normalmente o formato antigo');
  await projects.write(me, 'velho.json', { ...loaded.doc, name: 'Velho 2' }, { base: { hash: loaded.contentHash } });
  const stored = (await db.project.findUniqueOrThrow({ where: { id: old.id } })).doc as any;
  assert.match(stored.assets.a, /^asset:/);
  await close();
});
