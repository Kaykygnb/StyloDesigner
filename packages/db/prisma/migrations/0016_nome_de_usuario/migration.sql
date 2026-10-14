-- Nome de usuário obrigatório e e-mail opcional (DOC-SERVER-011, ADR 0002 §2.1).
-- Cada conta existente recebe um usuário gerado. O e-mail não é apagado.
-- A parte local, em minúsculas, fica só com letras e dígitos. Vazio vira "user".
-- Colisão ganha sufixo -2, -3, e assim por diante. O nome de exibição não muda.
-- O endereço é guardado em minúsculas para o login não distinguir caixa.

UPDATE "User" SET "email" = lower("email") WHERE "email" IS NOT NULL AND "email" <> lower("email");

ALTER TABLE "User" ADD COLUMN "username" TEXT;

DO $$
DECLARE
  rec RECORD;
  base TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR rec IN SELECT "id", "email" FROM "User" ORDER BY "createdAt" ASC, "id" ASC LOOP
    base := lower(regexp_replace(split_part(COALESCE(rec.email, ''), '@', 1), '[^a-zA-Z0-9]', '', 'g'));
    IF base IS NULL OR base = '' THEN
      base := 'user';
    END IF;
    candidate := base;
    n := 2;
    WHILE EXISTS (SELECT 1 FROM "User" WHERE "username" = candidate) LOOP
      candidate := base || '-' || n;
      n := n + 1;
    END LOOP;
    UPDATE "User" SET "username" = candidate WHERE "id" = rec.id;
  END LOOP;
END $$;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

CREATE UNIQUE INDEX "User_username_lower_key" ON "User"(lower("username"));

ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

DROP INDEX "User_email_key";

CREATE UNIQUE INDEX "User_email_key" ON "User"(lower("email")) WHERE "email" IS NOT NULL;
