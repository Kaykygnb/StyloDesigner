-- Os projetos não são mais arquivos: o nome deixa de terminar em ".json".
-- Quem já tem um projeto com o nome limpo (raro) mantém os dois: o antigo ganha o sufixo "-antigo".
UPDATE "Project"
   SET "slug" = substr("slug", 1, length("slug") - 5)
 WHERE lower("slug") LIKE '%.json' AND length("slug") > 5
   AND NOT EXISTS (SELECT 1 FROM "Project" other WHERE other."ownerId" = "Project"."ownerId" AND other."slug" = substr("Project"."slug", 1, length("Project"."slug") - 5));
UPDATE "Project"
   SET "slug" = substr("slug", 1, length("slug") - 5) || '-antigo'
 WHERE lower("slug") LIKE '%.json' AND length("slug") > 5;
