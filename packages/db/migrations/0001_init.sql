-- Stylo: esquema inicial do banco local (SQLite).
-- Convenções: datas em texto ISO-8601 (UTC), booleanos 0/1, JSON e listas em texto JSON, bytes em BLOB, ids em texto (uuid).
-- Operation.id é inteiro crescente (autoincrement).

CREATE TABLE "User" (
  "id"                 TEXT PRIMARY KEY NOT NULL,
  "email"              TEXT NOT NULL UNIQUE,
  "name"               TEXT NOT NULL,
  "passwordHash"       TEXT NOT NULL,
  "role"               TEXT NOT NULL DEFAULT 'MEMBER',
  "color"              TEXT,
  "avatar"             TEXT,
  "preferences"        TEXT NOT NULL DEFAULT '{}',
  "suspended"          INTEGER NOT NULL DEFAULT 0,
  "mustChangePassword" INTEGER NOT NULL DEFAULT 0,
  "createdAt"          TEXT NOT NULL
);

CREATE TABLE "AuthEvent" (
  "id"        TEXT PRIMARY KEY NOT NULL,
  "userId"    TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "email"     TEXT NOT NULL,
  "kind"      TEXT NOT NULL,
  "createdAt" TEXT NOT NULL
);
CREATE INDEX "AuthEvent_userId_createdAt" ON "AuthEvent"("userId", "createdAt");

CREATE TABLE "Session" (
  "id"        TEXT PRIMARY KEY NOT NULL,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "createdAt" TEXT NOT NULL,
  "expiresAt" TEXT NOT NULL
);
CREATE INDEX "Session_userId" ON "Session"("userId");

CREATE TABLE "Agent" (
  "id"         TEXT PRIMARY KEY NOT NULL,
  "name"       TEXT NOT NULL,
  "type"       TEXT NOT NULL DEFAULT 'mcp',
  "ownerId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash"  TEXT NOT NULL UNIQUE,
  "scopes"     TEXT NOT NULL DEFAULT '[]',
  "status"     TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt"  TEXT NOT NULL,
  "lastSeenAt" TEXT
);
CREATE INDEX "Agent_ownerId" ON "Agent"("ownerId");

CREATE TABLE "Project" (
  "id"        TEXT PRIMARY KEY NOT NULL,
  "slug"      TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "ownerId"   TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "doc"       TEXT NOT NULL,
  "revision"  INTEGER NOT NULL DEFAULT 0,
  "size"      INTEGER NOT NULL DEFAULT 0,
  "docHash"   TEXT,
  "thumb"     TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  UNIQUE ("ownerId", "slug")
);

CREATE TABLE "ProjectMember" (
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "role"      TEXT NOT NULL DEFAULT 'EDITOR',
  PRIMARY KEY ("projectId", "userId")
);

CREATE TABLE "AgentProject" (
  "agentId"   TEXT NOT NULL REFERENCES "Agent"("id") ON DELETE CASCADE,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "createdAt" TEXT NOT NULL,
  PRIMARY KEY ("agentId", "projectId")
);
CREATE INDEX "AgentProject_projectId" ON "AgentProject"("projectId");

CREATE TABLE "PublishRecord" (
  "id"        TEXT PRIMARY KEY NOT NULL,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "format"    TEXT NOT NULL,
  "status"    TEXT NOT NULL,
  "warnings"  TEXT,
  "label"     TEXT,
  "blobHash"  TEXT,
  "bytes"     INTEGER,
  "createdAt" TEXT NOT NULL
);
CREATE INDEX "PublishRecord_projectId_createdAt" ON "PublishRecord"("projectId", "createdAt");

CREATE TABLE "Asset" (
  "id"        TEXT PRIMARY KEY NOT NULL,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "hash"      TEXT NOT NULL,
  "mime"      TEXT NOT NULL,
  "size"      INTEGER NOT NULL,
  "data"      BLOB NOT NULL,
  "createdAt" TEXT NOT NULL,
  UNIQUE ("projectId", "hash")
);

CREATE TABLE "ProjectVersion" (
  "id"        TEXT PRIMARY KEY NOT NULL,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "revision"  INTEGER NOT NULL,
  "label"     TEXT,
  "size"      INTEGER NOT NULL DEFAULT 0,
  "doc"       TEXT NOT NULL,
  "createdAt" TEXT NOT NULL
);
CREATE INDEX "ProjectVersion_projectId_createdAt" ON "ProjectVersion"("projectId", "createdAt");

CREATE TABLE "Operation" (
  "id"        INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "actorType" TEXT NOT NULL,
  "userId"    TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "agentId"   TEXT REFERENCES "Agent"("id") ON DELETE SET NULL,
  "tool"      TEXT NOT NULL,
  "args"      TEXT,
  "summary"   TEXT,
  "layerIds"  TEXT NOT NULL DEFAULT '[]',
  "ok"        INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL
);
CREATE INDEX "Operation_projectId_createdAt" ON "Operation"("projectId", "createdAt");
CREATE INDEX "Operation_agentId_createdAt" ON "Operation"("agentId", "createdAt");

CREATE TABLE "Note" (
  "id"         TEXT PRIMARY KEY NOT NULL,
  "projectId"  TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "layerId"    TEXT,
  "kind"       TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "authorType" TEXT NOT NULL,
  "userId"     TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "agentId"    TEXT REFERENCES "Agent"("id") ON DELETE SET NULL,
  "parentId"   TEXT REFERENCES "Note"("id") ON DELETE CASCADE,
  "resolved"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TEXT NOT NULL
);
CREATE INDEX "Note_projectId_layerId" ON "Note"("projectId", "layerId");

CREATE TABLE "LibraryAsset" (
  "id"         TEXT PRIMARY KEY NOT NULL,
  "userId"     TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "kind"       TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "mime"       TEXT NOT NULL,
  "size"       INTEGER NOT NULL,
  "hash"       TEXT NOT NULL,
  "width"      INTEGER,
  "height"     INTEGER,
  "duration"   REAL,
  "tags"       TEXT NOT NULL DEFAULT '[]',
  "source"     TEXT NOT NULL DEFAULT 'upload',
  "sourceUrl"  TEXT,
  "license"    TEXT,
  "credit"     TEXT,
  "capturedAt" TEXT,
  "createdAt"  TEXT NOT NULL,
  UNIQUE ("userId", "hash")
);
CREATE INDEX "LibraryAsset_userId_kind" ON "LibraryAsset"("userId", "kind");

CREATE TABLE "ProviderSecret" (
  "userId"     TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "providerId" TEXT NOT NULL,
  "secret"     TEXT NOT NULL,
  "updatedAt"  TEXT NOT NULL,
  PRIMARY KEY ("userId", "providerId")
);

CREATE TABLE "AssetSource" (
  "id"        TEXT PRIMARY KEY NOT NULL,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name"      TEXT NOT NULL,
  "config"    TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  UNIQUE ("userId", "name")
);
