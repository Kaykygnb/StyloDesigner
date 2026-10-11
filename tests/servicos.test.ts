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
  const { db, close } = await createDb({ pglite: {} });
  const auth = createAuth(db);
  assert.equal(await auth.hasAccounts(), false);
  await auth.localUser(); // o usuário técnico não conta como conta de pessoa
  assert.equal(await auth.hasAccounts(), false);
  await assert.rejects(auth.setup({ email: 'x', name: 'A', password: '12345678' }), /E-mail inválido/);
  await assert.rejects(auth.setup({ email: 'a@x.com', name: 'A', password: 'curta' }), /8 caracteres/);
  const owner = await auth.setup({ email: 'Dono@X.com', name: 'Dono', password: 'senha-do-dono' });
  assert.equal(owner.role, 'OWNER');
  assert.equal(owner.email, 'dono@x.com');
  await assert.rejects(auth.setup({ email: 'b@x.com', name: 'B', password: '12345678' }), /Já existe uma conta mestre/);

  await assert.rejects(auth.login('dono@x.com', 'errada'), /incorretos/);
  await assert.rejects(auth.login('ninguem@x.com', 'qualquer'), /incorretos/, 'mesma mensagem para e-mail inexistente');
  const { token } = await auth.login('DONO@x.com', 'senha-do-dono');
  assert.equal((await auth.userFromToken(token))?.name, 'Dono');
  assert.equal(await auth.userFromToken('token-falso'), null);
  const stored = await db.session.findFirstOrThrow();
  assert.notEqual(stored.tokenHash, token, 'só o hash fica no banco');
  await auth.logout(token);
  assert.equal(await auth.userFromToken(token), null);

  const member = await auth.createUser({ email: 'm@x.com', name: 'Membro', password: 'senha-membro' });
  assert.equal(member.role, 'MEMBER');
  await assert.rejects(auth.createUser({ email: 'm@x.com', name: 'Outro', password: 'senha-membro' }), /Já existe uma conta/);
  assert.equal((await auth.users()).length, 2);
  await close();
});

test('agentes: token aparece uma vez; pendente não entra; revogar vale na hora; política decide o cadastro', async () => {
  const { db, close } = await createDb({ pglite: {} });
  const auth = createAuth(db);
  const agents = createAgents(db);
  const owner = await auth.setup({ email: 'dono@x.com', name: 'Dono', password: 'senha-do-dono' });

  const { agent, token } = await agents.create(owner.id, { name: 'Claude Code', scopes: ['read', 'write', 'lixo'] });
  assert.deepEqual(agent.scopes, ['read', 'write'], 'escopos desconhecidos são descartados');
  assert.ok(token.startsWith('stylo_agt_'));
  assert.notEqual((await db.agent.findFirstOrThrow()).tokenHash, token);
  assert.equal((await agents.authenticate(token)).name, 'Claude Code');
  await assert.rejects(agents.authenticate('stylo_agt_falso'), /inválido/);

  await agents.revoke(agent.id);
  await assert.rejects(agents.authenticate(token), /revogado/);
  await agents.approve(agent.id);
  assert.equal((await agents.authenticate(token)).id, agent.id);

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
  // política fechada: sem token não entra
  await assert.rejects(agents.forClient(owner.id, 'Novo', 'closed'), /só aceita agentes com token/);
  await close();
});

test('projetos: conflito por revisão, versões a cada intervalo com limite, papéis e renomear', async () => {
  const { db, close } = await createDb({ pglite: {} });
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
  const { db, close } = await createDb({ pglite: {} });
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
