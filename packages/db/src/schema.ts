/**
 * schema.ts — DESCRIÇÃO DOS MODELOS (a "planta" que o motor de consultas usa)
 *
 * O SQL das tabelas está em migrations/*.sql; aqui só dizemos ao motor o TIPO de cada coluna (para converter datas,
 * JSON, listas, bytes...), os valores padrão e como as tabelas se ligam. Um teste confere que as duas coisas batem.
 */

export type FieldType = 'string' | 'int' | 'bigint' | 'float' | 'bool' | 'date' | 'json' | 'bytes' | 'list';

export interface FieldDef {
  type: FieldType;
  optional?: boolean;
  /** 'uuid' | 'now' | 'autoincrement' ou um valor fixo (listas e JSON usam cópia do valor). */
  default?: unknown;
  /** Atualizado com a data atual a cada update. */
  updatedAt?: boolean;
}

export interface RelationDef {
  model: string;
  /** one: esta tabela tem a chave estrangeira (`fk`) que aponta para `ref` (padrão id). many: a outra tabela aponta para cá por `by`. */
  kind: 'one' | 'many';
  fk?: string;
  ref?: string;
  by?: string;
}

export interface ModelDef {
  table: string;
  /** Chave primária (um ou mais campos). */
  pk: string[];
  fields: Record<string, FieldDef>;
  /** Conjuntos de campos únicos além da chave primária; o nome composto é os campos unidos por "_" (ex.: ownerId_slug). */
  uniques: string[][];
  relations: Record<string, RelationDef>;
}

const id: FieldDef = { type: 'string', default: 'uuid' };
const str: FieldDef = { type: 'string' };
const optStr: FieldDef = { type: 'string', optional: true };
const now: FieldDef = { type: 'date', default: 'now' };
const one = (model: string, fk: string): RelationDef => ({ model, kind: 'one', fk, ref: 'id' });
const many = (model: string, by: string): RelationDef => ({ model, kind: 'many', by });

export const MODELS: Record<string, ModelDef> = {
  User: {
    table: 'User', pk: ['id'], uniques: [['email']],
    fields: {
      id, email: str, name: str, passwordHash: str, role: { type: 'string', default: 'MEMBER' }, color: optStr, avatar: optStr,
      preferences: { type: 'json', default: {} }, suspended: { type: 'bool', default: false }, mustChangePassword: { type: 'bool', default: false }, createdAt: now,
    },
    relations: {
      agents: many('Agent', 'ownerId'), projects: many('Project', 'ownerId'), memberships: many('ProjectMember', 'userId'),
      sessions: many('Session', 'userId'), library: many('LibraryAsset', 'userId'), secrets: many('ProviderSecret', 'userId'),
      sources: many('AssetSource', 'userId'), operations: many('Operation', 'userId'), notes: many('Note', 'userId'), authEvents: many('AuthEvent', 'userId'),
    },
  },
  AuthEvent: {
    table: 'AuthEvent', pk: ['id'], uniques: [],
    fields: { id, userId: optStr, email: str, kind: str, createdAt: now },
    relations: { user: one('User', 'userId') },
  },
  Session: {
    table: 'Session', pk: ['id'], uniques: [['tokenHash']],
    fields: { id, userId: str, tokenHash: str, createdAt: now, expiresAt: { type: 'date' } },
    relations: { user: one('User', 'userId') },
  },
  Agent: {
    table: 'Agent', pk: ['id'], uniques: [['tokenHash']],
    fields: {
      id, name: str, type: { type: 'string', default: 'mcp' }, ownerId: str, tokenHash: str, scopes: { type: 'list', default: [] },
      status: { type: 'string', default: 'PENDING' }, createdAt: now, lastSeenAt: { type: 'date', optional: true },
    },
    relations: { owner: one('User', 'ownerId'), operations: many('Operation', 'agentId'), notes: many('Note', 'agentId'), projects: many('AgentProject', 'agentId') },
  },
  Project: {
    table: 'Project', pk: ['id'], uniques: [['ownerId', 'slug']],
    fields: {
      id, slug: str, name: str, ownerId: str, doc: { type: 'json' }, revision: { type: 'int', default: 0 }, size: { type: 'int', default: 0 },
      docHash: optStr, thumb: optStr, createdAt: now, updatedAt: { type: 'date', default: 'now', updatedAt: true },
    },
    relations: {
      owner: one('User', 'ownerId'), members: many('ProjectMember', 'projectId'), versions: many('ProjectVersion', 'projectId'),
      assets: many('Asset', 'projectId'), operations: many('Operation', 'projectId'), notes: many('Note', 'projectId'),
      agents: many('AgentProject', 'projectId'), publishes: many('PublishRecord', 'projectId'),
    },
  },
  ProjectMember: {
    table: 'ProjectMember', pk: ['projectId', 'userId'], uniques: [],
    fields: { projectId: str, userId: str, role: { type: 'string', default: 'EDITOR' } },
    relations: { project: one('Project', 'projectId'), user: one('User', 'userId') },
  },
  AgentProject: {
    table: 'AgentProject', pk: ['agentId', 'projectId'], uniques: [],
    fields: { agentId: str, projectId: str, createdAt: now },
    relations: { agent: one('Agent', 'agentId'), project: one('Project', 'projectId') },
  },
  PublishRecord: {
    table: 'PublishRecord', pk: ['id'], uniques: [],
    fields: { id, projectId: str, format: str, status: str, warnings: { type: 'json', optional: true }, label: optStr, blobHash: optStr, bytes: { type: 'int', optional: true }, createdAt: now },
    relations: { project: one('Project', 'projectId') },
  },
  Asset: {
    table: 'Asset', pk: ['id'], uniques: [['projectId', 'hash']],
    fields: { id, projectId: str, hash: str, mime: str, size: { type: 'int' }, data: { type: 'bytes' }, createdAt: now },
    relations: { project: one('Project', 'projectId') },
  },
  ProjectVersion: {
    table: 'ProjectVersion', pk: ['id'], uniques: [],
    fields: { id, projectId: str, revision: { type: 'int' }, label: optStr, size: { type: 'int', default: 0 }, doc: { type: 'json' }, createdAt: now },
    relations: { project: one('Project', 'projectId') },
  },
  Operation: {
    table: 'Operation', pk: ['id'], uniques: [],
    fields: {
      id: { type: 'bigint', default: 'autoincrement' }, projectId: str, actorType: str, userId: optStr, agentId: optStr, tool: str,
      args: { type: 'json', optional: true }, summary: optStr, layerIds: { type: 'list', default: [] }, ok: { type: 'bool', default: true }, createdAt: now,
    },
    relations: { project: one('Project', 'projectId'), user: one('User', 'userId'), agent: one('Agent', 'agentId') },
  },
  Note: {
    table: 'Note', pk: ['id'], uniques: [],
    fields: {
      id, projectId: str, layerId: optStr, kind: str, body: str, authorType: str, userId: optStr, agentId: optStr, parentId: optStr,
      resolved: { type: 'bool', default: false }, createdAt: now,
    },
    relations: { project: one('Project', 'projectId'), user: one('User', 'userId'), agent: one('Agent', 'agentId'), parent: one('Note', 'parentId'), replies: many('Note', 'parentId') },
  },
  LibraryAsset: {
    table: 'LibraryAsset', pk: ['id'], uniques: [['userId', 'hash']],
    fields: {
      id, userId: str, kind: str, name: str, mime: str, size: { type: 'int' }, hash: str, width: { type: 'int', optional: true }, height: { type: 'int', optional: true },
      duration: { type: 'float', optional: true }, tags: { type: 'list', default: [] }, source: { type: 'string', default: 'upload' }, sourceUrl: optStr,
      license: { type: 'json', optional: true }, credit: optStr, capturedAt: { type: 'date', optional: true }, createdAt: now,
    },
    relations: { user: one('User', 'userId') },
  },
  ProviderSecret: {
    table: 'ProviderSecret', pk: ['userId', 'providerId'], uniques: [],
    fields: { userId: str, providerId: str, secret: str, updatedAt: { type: 'date', default: 'now', updatedAt: true } },
    relations: { user: one('User', 'userId') },
  },
  AssetSource: {
    table: 'AssetSource', pk: ['id'], uniques: [['userId', 'name']],
    fields: { id, userId: str, name: str, config: { type: 'json' }, createdAt: now },
    relations: { user: one('User', 'userId') },
  },
};

/** Nome do delegate no cliente (`db.user`, `db.projectMember`...). */
export const delegateName = (model: string) => model[0].toLowerCase() + model.slice(1);
