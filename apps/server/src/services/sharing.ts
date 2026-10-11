/**
 * services/sharing.ts — COMPARTILHAR PROJETOS (membros e papéis)
 * Só o dono compartilha. Papéis: EDITOR (altera) e VIEWER (só lê e comenta).
 */

import type { Db } from '@stylo/db/client.ts';
import { httpError } from '../http-error.js';

export type MemberRole = 'EDITOR' | 'VIEWER';

export function createSharing(db: Db) {
  async function ownedBy(userId: string, projectId: string) {
    const p = await db.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
    if (!p) throw httpError(404, 'Projeto não encontrado.');
    if (p.ownerId !== userId) throw httpError(403, 'Só o dono do projeto compartilha.');
  }

  async function share(ownerId: string, projectId: string, email: string, role: MemberRole) {
    await ownedBy(ownerId, projectId);
    const user = await db.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
    if (!user) throw httpError(404, 'Não existe conta com esse e-mail. Peça à conta mestre para criá-la.');
    if (user.id === ownerId) throw httpError(400, 'Você já é o dono deste projeto.');
    await db.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: user.id } },
      create: { projectId, userId: user.id, role }, update: { role },
    });
    return { email: user.email, name: user.name, role };
  }

  async function unshare(ownerId: string, projectId: string, email: string) {
    await ownedBy(ownerId, projectId);
    const user = await db.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
    if (user) await db.projectMember.deleteMany({ where: { projectId, userId: user.id } });
    return { removed: user?.email ?? null };
  }

  async function members(projectId: string) {
    const p = await db.project.findUnique({ where: { id: projectId }, include: { owner: true, members: { include: { user: true } } } });
    if (!p) throw httpError(404, 'Projeto não encontrado.');
    return [
      { email: p.owner.email, name: p.owner.name, role: 'OWNER' as const },
      ...p.members.map((m) => ({ email: m.user.email, name: m.user.name, role: m.role })),
    ];
  }

  return { share, unshare, members };
}

export type Sharing = ReturnType<typeof createSharing>;
