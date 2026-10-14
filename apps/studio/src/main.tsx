import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { app, initLanguage } from './lib/app';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/canvas.css';
import './styles/inspector.css';
import './styles/i18n.css';

// Leitura do estado do painel para testes e diagnóstico (no console: __stylo.get()). Não altera nada.
(window as unknown as { __stylo: { get: typeof app.get } }).__stylo = { get: app.get };

// O navegador avisa "ResizeObserver loop" quando uma tela muda de altura durante a medição. É inofensivo (só dispara a próxima medição) e não deve virar erro.
window.addEventListener('error', (e) => { if (/ResizeObserver loop/.test(e.message)) e.stopImmediatePropagation(); });

// o idioma guardado é carregado antes da primeira tela, para ela já nascer no idioma certo
void initLanguage().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
