import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// O painel mora em /studio/. O servidor (apps/server) sobe o Vite em middleware na mesma porta; este arquivo também vale para `vite build`.
export default defineConfig({
  root: import.meta.dirname,
  base: '/studio/',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
});
