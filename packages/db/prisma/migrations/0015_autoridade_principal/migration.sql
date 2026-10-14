-- Autoridade principal da instalação (DOC-SERVER-006).
-- A coluna nasce nula: nenhuma conta existente é escolhida por data ou identificador.
CREATE TABLE "Installation" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "principalUserId" UUID,

    CONSTRAINT "Installation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Installation_singleton" CHECK ("id" = 1)
);

CREATE UNIQUE INDEX "Installation_principalUserId_key" ON "Installation"("principalUserId");

ALTER TABLE "Installation" ADD CONSTRAINT "Installation_principalUserId_fkey" FOREIGN KEY ("principalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Installation" ("id", "principalUserId") VALUES (1, NULL);
