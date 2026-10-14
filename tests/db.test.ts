// O banco (Postgres via PGlite em memória): esquema aplicado pelas migrações e relações principais funcionando.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '@stylo/db/client.ts';

test('migração cria o esquema; usuário, agente, projeto, operação e nota se relacionam', async () => {
  const { db, close } = await createDb({ pglite: {} });
  try {
    const owner = await db.user.create({ data: { email: 'dono@exemplo.com', name: 'Dono', passwordHash: 'x', role: 'OWNER' } });
    const agent = await db.agent.create({ data: { name: 'Claude Code', ownerId: owner.id, tokenHash: 'hash-1', scopes: ['read', 'write'], status: 'ACTIVE' } });
    const project = await db.project.create({
      data: { slug: 'meu-site.json', name: 'Meu site', ownerId: owner.id, doc: { pages: [{ id: 'p1', name: 'Home', children: [] }] } },
    });
    await db.operation.create({
      data: { projectId: project.id, actorType: 'AGENT', agentId: agent.id, tool: 'create_layer', layerIds: ['abc'], summary: 'criou o hero', args: { type: 'frame' } },
    });
    await db.note.create({
      data: { projectId: project.id, layerId: 'abc', kind: 'DECISION', body: 'Hero em coluna para caber no celular', authorType: 'AGENT', agentId: agent.id },
    });

    const loaded = await db.project.findUniqueOrThrow({
      where: { ownerId_slug: { ownerId: owner.id, slug: 'meu-site.json' } },
      include: { operations: { include: { agent: true } }, notes: true },
    });
    assert.equal((loaded.doc as { pages: unknown[] }).pages.length, 1);
    assert.equal(loaded.operations[0].agent?.name, 'Claude Code');
    assert.deepEqual(loaded.operations[0].layerIds, ['abc']);
    assert.equal(loaded.notes[0].kind, 'DECISION');
    assert.equal(typeof loaded.operations[0].id, 'bigint');

    // o mesmo dono não repete o nome de arquivo
    await assert.rejects(db.project.create({ data: { slug: 'meu-site.json', name: 'Outro', ownerId: owner.id, doc: {} } }));
    // apagar o agente mantém o registro das operações (SetNull)
    await db.agent.delete({ where: { id: agent.id } });
    assert.equal((await db.operation.findFirstOrThrow()).agentId, null);
  } finally {
    await close();
  }
});
