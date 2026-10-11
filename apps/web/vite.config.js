import { defineConfig } from 'vite';

// O servidor (apps/server) sobe o Vite em middleware na mesma porta; este arquivo também vale para `vite build`.
export default defineConfig({
  root: import.meta.dirname,
  publicDir: 'public',
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
});
