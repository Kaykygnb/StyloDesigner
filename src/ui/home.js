/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/home.js — PÁGINA INICIAL (os seus projetos)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Uma tela cheia por cima do editor, no estilo "tela de arquivos" do Figma/Penpot:
 *    - CONTINUAR: o projeto aberto agora, com miniatura ao vivo e onde ele está salvo;
 *    - NA PASTA: os projetos da pasta (miniatura, nome, data, tamanho), com busca, ordenação e um menu ⋯
 *      por projeto (abrir, renomear, duplicar, versões);
 *    - EXEMPLOS: os dois projetos de exemplo.
 *  Abre ao iniciar o app (dá para desligar em Configurações) e pelo logo / Arquivo → Página inicial.
 *  Enquanto está aberta, o editor fica `inert` (nem o mouse nem o teclado alcançam) e os atalhos do canvas
 *  ficam desligados (ui.homeOpen, ver tools.js → covered()).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico, iconButton } from './dom.js';
import { showMenu } from './menus.js';
import { folder } from '../storage.js';
import { formatBytes } from './settings.js';

/** "há 5 min", "há 3 h", "ontem", ou a data. */
function when(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'agora mesmo';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 2 * 86400) return 'ontem';
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Nome bonito a partir do arquivo: "meu-app.json" → "meu-app". */
const baseName = (file) => file.replace(/\.json$/i, '');

/** Cor de fundo estável por nome (para os projetos sem miniatura não ficarem todos iguais). */
function hue(text) {
  let x = 0;
  for (const c of text) x = (x * 31 + c.charCodeAt(0)) % 360;
  return x;
}

/** Miniatura de um card: a imagem SVG (se houver) ou uma "capa" com a inicial do nome. */
function thumbBox(name, src) {
  const box = h('div.home-thumb', { style: { '--h': hue(name) } });
  const fallback = () => box.replaceChildren(h('span.home-initial', (name.trim()[0] || '?').toUpperCase()));
  if (src) {
    const img = h('img', { src, alt: '', loading: 'lazy', decoding: 'async' });
    img.addEventListener('error', fallback);
    box.append(img);
  } else fallback();
  return box;
}

/**
 * Cria a PÁGINA INICIAL: cards dos projetos da pasta (com miniatura, busca, renomear, duplicar), "continuar de
 * onde parou" e exemplos. Abre por cima do editor e o deixa inativo (inert) enquanto estiver aberta.
 * @param {object} deps
 * @param {object} deps.store, deps.saving, deps.canvas
 * @param {() => string|null} deps.thumbnail      miniatura da página aberta (thumbnail.js)
 * @param {(m: string) => void} deps.toast
 * @param {() => void} deps.openSettings
 * @param {(mode) => void} deps.openProjects
 * @param {(q: string) => Promise<boolean>} deps.confirmReplace   pergunta antes de trocar o projeto aberto
 * @param {() => void} deps.importFile             abre o seletor de .json do computador
 * @param {{ blank: () => void, samples: {label, description, load}[] }} deps.create
 */
export function createHome({ store, saving, canvas, thumbnail, toast, openSettings, openProjects, confirmReplace, importFile, create }) {
  const ui = store.ui;
  let root = null;
  let list = [];
  let query = '';
  let sort = 'recent';
  let renaming = null;

  /** Fecha a página inicial e devolve o editor (foco no canvas para os atalhos voltarem a funcionar). */
  function close() {
    if (!root) return;
    root.remove();
    root = null;
    window.removeEventListener('keydown', onKey);
    ui.homeOpen = false;
    const app = document.getElementById('app');
    app.inert = false;
    app.removeAttribute('aria-hidden');
    store.emit('ui');
    requestAnimationFrame(() => { if (canvas.getView().fresh) canvas.fit(null); });
  }

  /** Abre (ou redesenha) a página inicial. */
  async function open() {
    ui.homeOpen = true;
    const app = document.getElementById('app');
    app.inert = true; // o editor por trás não recebe foco nem cliques
    app.setAttribute('aria-hidden', 'true');
    if (!root) {
      root = h('section.home', { 'aria-label': 'Página inicial', tabindex: -1 });
      // ouvinte na JANELA (não só na página): se o foco "cair" no <body> (ex.: o botão focado foi redesenhado),
      // o Esc e o "/" continuam funcionando
      window.addEventListener('keydown', onKey);
      document.body.append(root);
    }
    renderShell();
    root.querySelector('.home-continue .btn.primary')?.focus();
    await refreshList();
  }

  /** Esc fecha (volta ao editor); "/" foca a busca, como em muitos apps. */
  function onKey(e) {
    if (document.querySelector('.modal-backdrop') || document.querySelector('.menu')) return;
    const typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
    // codex: a busca deve permitir que Esc volte ao editor mesmo enquanto mantém o foco.
    if (e.key === 'Escape' && (!typing || e.target.matches?.('.home-search input'))) { e.preventDefault(); close(); }
    if (e.key === '/' && !typing) { e.preventDefault(); root.querySelector('.home-search input')?.focus(); }
  }

  /** Busca a lista da pasta e redesenha a grade. */
  async function refreshList() {
    const server = await saving.refresh();
    list = server ? await folder.list().catch(() => []) : [];
    if (!root) return;
    // redesenhar troca os elementos: se o foco estava num deles, devolve ao botão principal (teclado não se perde)
    const hadFocus = root.contains(document.activeElement) || document.activeElement === document.body;
    renderShell();
    if (hadFocus && !root.contains(document.activeElement)) root.querySelector('.home-continue .btn.primary')?.focus();
  }

  /** Troca o projeto aberto por `action` (abrir da pasta, exemplo, novo), perguntando antes se for perder algo. */
  async function replaceWith(question, action) {
    if (!(await confirmReplace(question))) return;
    try {
      await action();
      close();
      canvas.fit(null);
    } catch (err) {
      toast(err.message || 'Não consegui abrir.');
    }
  }

  /** Abre um projeto da pasta. Se já é o aberto, só volta ao editor. */
  function openFile(file) {
    if (ui.link?.file === file) return close();
    replaceWith(`Abrir "${baseName(file)}"?`, () => saving.open(file));
  }

  // ---------------------------------------------------------------- desenho
  function renderShell() {
    const server = ui.server;
    const search = h('input', {
      type: 'search', placeholder: 'Buscar projeto', value: query, 'aria-label': 'Buscar projeto',
      oninput: () => { query = search.value; renderGrid(); },
    });
    const top = h('header.home-top',
      h('div.brand',
        h('div.logo', { html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4z"/></svg>' }),
        h('span.brand-name', 'Projeto Designer'),
        h('span.home-version', 'v0.13')),
      h('div.spacer'),
      h('label.home-search', ico('search', 15), search, h('kbd', '/')),
      iconButton(ui.theme === 'dark' ? 'sun' : 'moon', 'Alternar tema claro/escuro', () => { store.setTheme(ui.theme === 'dark' ? 'light' : 'dark'); renderShell(); }),
      iconButton('settings', 'Configurações (Ctrl+,)', () => openSettings()),
      // em telas estreitas o texto encurta para "Editor" (as duas versões existem; o CSS mostra uma)
      h('button.btn.home-to-editor', { type: 'button', onclick: close, 'aria-label': 'Ir para o editor' },
        h('span.wide-only', 'Ir para o editor'), h('span.narrow-only', 'Editor'), h('kbd', 'Esc')));

    const hero = h('div.home-hero',
      h('div',
        h('span.home-eyebrow', 'Seu espaço de trabalho'),
        h('h1', 'Seus projetos'),
        h('p.muted', server ? ['Salvos em ', h('span.mono', server.folder), ' · ', h('button.link', { type: 'button', onclick: () => openSettings() }, 'trocar pasta')]
          : 'Sem servidor: os projetos ficam só no navegador. Rode npm start para salvar numa pasta do computador.')),
      h('div.home-actions',
        h('button.btn.primary', { type: 'button', onclick: () => replaceWith('Começar um projeto novo em branco?', async () => create.blank()) }, ico('plus', 14), ' Novo projeto'),
        h('button.btn', { type: 'button', onclick: () => importFile() }, ico('upload', 14), ' Importar .json')));

    // ---- continuar
    let liveThumb = null;
    try { const svg = thumbnail(); if (svg) liveThumb = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); } catch { /* sem prévia */ }
    const where = ui.link
      ? (ui.savedWhere === 'folder' ? `Salvo na pasta · ${ui.link.file}` : `Ligado a ${ui.link.file} · ainda não gravado na pasta`)
      : 'Só no navegador · use Ctrl+S no editor para salvar na pasta';
    const pages = store.state.doc.pages.length;
    const cont = h('section.home-section.home-continue',
      h('h2', 'Continuar de onde parou'),
      h('div.home-wide',
        thumbBox(store.state.doc.name, liveThumb),
        h('div.home-wide-info',
          h('strong', store.state.doc.name),
          h('span.muted', `${pages} ${pages === 1 ? 'página' : 'páginas'}`),
          h('span.home-where' + (ui.link && ui.savedWhere === 'folder' ? '.ok' : '.warn'), where),
          h('button.btn.primary', { type: 'button', onclick: close }, 'Continuar editando', ico('chevron', 14)))));

    // ---- pasta
    const grid = h('div.home-grid', { role: 'list' });
    const sortSel = h('select.home-sort', { 'aria-label': 'Ordenar', onchange: () => { sort = sortSel.value; renderGrid(); } },
      h('option', { value: 'recent', selected: sort === 'recent' }, 'Mais recentes'),
      h('option', { value: 'name', selected: sort === 'name' }, 'Nome (A–Z)'));
    const folderSec = h('section.home-section.home-folder',
      h('div.home-section-head', h('h2', 'Na pasta', h('span.home-count')), server ? sortSel : null),
      server ? grid : h('div.home-empty', h('p', 'Sem servidor, não há pasta para listar.'), h('p.muted', 'Abra o app com npm start para ver aqui os projetos salvos no seu computador.')));

    // ---- exemplos
    const samples = h('section.home-section.home-examples',
      h('h2', 'Comece por um exemplo'),
      h('div.home-grid.samples', create.samples.map((s, i) => h('button.home-card.sample', {
        type: 'button', onclick: () => replaceWith(`Abrir o exemplo "${s.label}"?`, async () => s.load()),
      }, h('div.home-thumb.sample-art', { dataset: { variant: String(i) } },
        h('img', { src: `assets/example-${i ? 'mobile' : 'landing'}.png`, alt: '', loading: 'lazy', decoding: 'async' })),
      h('div.home-card-info', h('strong', s.label), h('span.muted', s.description))))));

    root.replaceChildren(top, h('div.home-main', hero, cont, folderSec, samples));
    renderGrid();
  }

  /** Só a grade de projetos da pasta (redesenhada ao buscar/ordenar sem perder o foco do campo de busca). */
  function renderGrid() {
    const grid = root?.querySelector('.home-grid:not(.samples)');
    if (!grid) return;
    const q = query.trim().toLowerCase();
    let items = list.filter((p) => !q || baseName(p.file).toLowerCase().includes(q));
    items = items.sort(sort === 'name' ? (a, b) => a.file.localeCompare(b.file, 'pt-BR') : (a, b) => b.modified - a.modified);
    root.querySelector('.home-count').textContent = list.length ? ` ${list.length}` : '';
    if (!list.length) {
      grid.replaceChildren(h('div.home-empty', h('p', 'Nenhum projeto na pasta ainda.'),
        h('p.muted', 'No editor, aperte Ctrl+S para dar um nome ao projeto e salvá-lo aqui.')));
      return;
    }
    if (!items.length) { grid.replaceChildren(h('div.home-empty', h('p', `Nada encontrado para "${query}".`))); return; }
    grid.replaceChildren(...items.map(card));
  }

  /** Card de um projeto da pasta: clique abre; ⋯ abre o menu; no modo "renomear", o nome vira um campo. */
  function card(p) {
    const name = baseName(p.file);
    const isOpen = ui.link?.file === p.file;
    const info = h('div.home-card-info');
    if (renaming === p.file) {
      const input = h('input.home-rename', { type: 'text', value: name, 'aria-label': 'Novo nome do arquivo', spellcheck: false });
      const finish = async (save) => {
        if (renaming !== p.file) return;
        renaming = null;
        if (save && input.value.trim() && input.value.trim() !== name) {
          const res = await saving.renameFile(p.file, input.value.trim());
          if (res) toast(`Renomeado para ${res}`);
          await refreshList();
        } else renderGrid();
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
      });
      input.addEventListener('blur', () => finish(true));
      info.append(input, h('span.muted', 'Enter confirma · Esc cancela'));
      requestAnimationFrame(() => { input.focus(); input.select(); });
    } else {
      info.append(h('strong', { title: p.file }, name),
        h('span.muted', `${when(p.modified)} · ${formatBytes(p.size)}`, isOpen ? h('span.home-badge', 'aberto') : null));
    }
    const more = h('button.icon-btn.home-more', {
      type: 'button', title: 'Mais ações', 'aria-label': `Mais ações para ${name}`, 'aria-haspopup': 'menu',
      onclick: (e) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        showMenu(r.right, r.bottom + 4, [
          { label: isOpen ? 'Voltar a este projeto' : 'Abrir', icon: 'folder', onClick: () => openFile(p.file) },
          { label: 'Renomear', icon: 'text', onClick: () => { renaming = p.file; renderGrid(); } },
          { label: 'Duplicar', icon: 'copy', onClick: async () => {
            try { const t = await saving.duplicateFile(p.file); toast(`Cópia criada: ${t}`); await refreshList(); } catch (err) { toast(err.message); }
          } },
          { label: 'Versões antigas…', icon: 'history', onClick: () => openProjects('open') },
        ], { anchorRight: true });
      },
    }, ico('more'));
    const openBtn = h('button.home-card-open', { type: 'button', 'aria-label': `Abrir ${name}`, onclick: () => renaming !== p.file && openFile(p.file) },
      thumbBox(name, p.thumb ? folder.thumbUrl(p.file, p.thumb) : null));
    return h('div.home-card' + (isOpen ? '.current' : ''), { role: 'listitem' }, openBtn, h('div.home-card-row', info, more));
  }

  return { open, close, refresh: refreshList, get isOpen() { return !!root; } };
}
