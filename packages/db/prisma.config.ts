import { defineConfig } from 'prisma/config';

// A URL só é lida por comandos que falam com o banco (migrate deploy, studio). Gerar o cliente e gerar SQL não precisam.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://stylo:stylo@localhost:5432/stylo' },
});
