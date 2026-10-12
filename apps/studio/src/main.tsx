import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { app } from './lib/app';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/canvas.css';
import './styles/inspector.css';

// Leitura do estado do painel para testes e diagnóstico (no console: __stylo.get()). Não altera nada.
(window as unknown as { __stylo: { get: typeof app.get } }).__stylo = { get: app.get };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
