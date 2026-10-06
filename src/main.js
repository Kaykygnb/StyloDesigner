// Monta o app: barra superior, painéis, canvas, barra de ferramentas e menus.
import { createStore } from './store.js';
import { createCanvas } from './canvas.js';
import { createOverlay } from './overlay.js';
import { createRulers } from './rulers.js';
import { createCommands } from './commands.js';
import { createTools } from './tools.js';
import { createLayersPanel } from './ui/layers.js';
import { createDesignPanel } from './ui/props.js';
import { createCodePanel } from './ui/code.js';
import { createAssetsPanel } from './ui/assets.js';
import { createProtoPanel } from './ui/proto.js';
import { createPresent } from './present.js';
import { contextMenuItems, showHelp, showMenu } from './ui/menus.js';
import { h, ico, iconButton } from './ui/dom.js';
import { openProjectFile, saveProject, exportHtmlFile, exportPng } from './export.js';

const $ = (sel) => document.querySelector(sel);
const store = createStore();
const ui = store.ui;

// ---------------------------------------------------------------- toasts
let toastTimer = 0;
function toast(msg) {
  const box = $('#toasts');
  const t = h('div.toast', msg);
  box.replaceChildren(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 3200);
}
let warnedSave = false;
store.onSaveError = () => {
  if (warnedSave) return;
  warnedSave = true;
  toast('Auto-salvar falhou (muitas imagens?). Use Arquivo → Salvar projeto.');
};

// ---------------------------------------------------------------- núcleo
const viewport = $('#viewport');
const canvas = createCanvas(store, viewport);
let toolsRef = null;
createOverlay(store, canvas, viewport, { penSvg: () => toolsRef?.pen.overlaySvg() || '' });
const commands = createCommands(store, canvas);
const tools = createTools({ store, canvas, commands, viewport, toast });
toolsRef = tools;
createRulers({ store, canvas, stage: $('.stage'), commands });

// ---------------------------------------------------------------- painel esquerdo
const leftBody = h('div.left-body');
const layersBox = h('div.left-body');
const assetsBox = h('div.left-body');
const assets = createAssetsPanel({ store, commands, canvas, container: assetsBox });
createLayersPanel({ store, commands, container: layersBox });
const ltLayers = h('button.tab', { type: 'button', onclick: () => setLeftTab('layers') }, ico('layers', 14), ' Camadas');
const ltAssets = h('button.tab', { type: 'button', onclick: () => setLeftTab('assets') }, ico('component', 14), ' Recursos');
$('#left').append(h('div.tabs', ltLayers, ltAssets), leftBody);
function setLeftTab(tab) {
  ui.leftTab = tab;
  ltLayers.classList.toggle('on', tab === 'layers');
  ltAssets.classList.toggle('on', tab === 'assets');
  leftBody.replaceChildren(tab === 'layers' ? layersBox : assetsBox);
  if (tab === 'assets') assets.render();
}
setLeftTab('layers');

// ---------------------------------------------------------------- painel direito
const design = createDesignPanel({ store, canvas, commands, tools, toast });
const code = createCodePanel({ store, commands, toast });
const present = createPresent({ store, canvas });
const proto = createProtoPanel({ store, present, toast });
const rightBody = h('div.right-body');
const tabDesign = h('button.tab', { type: 'button', onclick: () => setTab('design') }, ico('sliders', 14), ' Design');
const tabProto = h('button.tab', { type: 'button', onclick: () => setTab('proto') }, ico('play', 13), ' Protótipo');
const tabCode = h('button.tab', { type: 'button', onclick: () => setTab('code') }, ico('code', 14), ' Código');
$('#right').append(h('div.tabs', tabDesign, tabProto, tabCode), rightBody);
function setTab(tab) {
  ui.rightTab = tab;
  tabDesign.classList.toggle('on', tab === 'design');
  tabProto.classList.toggle('on', tab === 'proto');
  tabCode.classList.toggle('on', tab === 'code');
  rightBody.replaceChildren(tab === 'design' ? design.el : tab === 'proto' ? proto.el : code.el);
  if (tab === 'code') code.render();
  else if (tab === 'proto') proto.render();
  else design.render();
  store.emit('overlay');
}
setTab('design');

// ---------------------------------------------------------------- barra superior
const nameInput = h('input.doc-name', { value: store.state.doc.name, spellcheck: false, title: 'Nome do projeto' });
nameInput.addEventListener('change', () => {
  store.state.doc.name = nameInput.value.trim() || 'Sem título';
  nameInput.value = store.state.doc.name;
  store.commit();
});
nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && nameInput.blur());

const saveEl = h('span.save-state', { title: 'O projeto é salvo sozinho neste navegador' }, 'Salvo');
const undoBtn = iconButton('undo', 'Desfazer (Ctrl+Z)', () => store.undo());
const redoBtn = iconButton('redo', 'Refazer (Ctrl+Shift+Z)', () => store.redo());
const themeBtn = iconButton('sun', 'Alternar tema claro/escuro', () => store.setTheme(ui.theme === 'dark' ? 'light' : 'dark'));
const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
fileInput.addEventListener('change', async () => {
  const f = fileInput.files[0];
  fileInput.value = '';
  if (!f) return;
  try {
    store.loadDoc(await openProjectFile(f));
    canvas.fit(null);
    toast(`Projeto "${store.state.doc.name}" aberto.`);
  } catch (err) {
    toast(err.message || 'Arquivo inválido.');
  }
});

const fileBtn = h('button.btn.ghost', {
  type: 'button',
  onclick: (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    showMenu(r.left, r.bottom + 6, [
      { label: 'Novo projeto', icon: 'file', onClick: () => confirm('Descartar o projeto atual e começar um novo em branco?') && (store.newDoc(), canvas.fit(null)) },
      { label: 'Abrir arquivo…', icon: 'folder', onClick: () => fileInput.click() },
      { label: 'Salvar projeto (.json)', hint: 'Ctrl+S', icon: 'download', onClick: () => saveProject(store.state.doc) },
      'sep',
      {
        label: 'Exportar seleção como HTML', icon: 'code', disabled: !ui.selection.length,
        onClick: () => commands.topSelection().forEach((n) => exportHtmlFile(n, store.state.doc.assets)),
      },
      {
        label: 'Exportar todos os frames da página (PNG 2x)', icon: 'image',
        disabled: !store.page().children.some((n) => n.type === 'frame'),
        onClick: async () => {
          const frames = store.page().children.filter((n) => n.type === 'frame' && n.visible);
          try {
            for (const f of frames) { await exportPng(f, store.state.doc.assets, 2); await new Promise((r) => setTimeout(r, 250)); }
            toast(`${frames.length} imagens exportadas.`);
          } catch (err) { toast(err.message); }
        },
      },
      'sep',
      { label: 'Carregar projeto de exemplo', icon: 'layers', onClick: () => confirm('Substituir o projeto atual pelo exemplo?') && (store.loadSample(), canvas.fit(null)) },
    ]);
  },
}, ico('folder', 15), ' Arquivo');

$('#topbar').append(
  h('div.brand',
    h('div.logo', { html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4z"/></svg>' }),
    h('span.brand-name', 'Projeto Designer')),
  fileBtn,
  h('span.sep'),
  undoBtn, redoBtn,
  h('div.spacer'),
  nameInput,
  saveEl,
  h('div.spacer'),
  h('button.btn.primary', { type: 'button', title: 'Apresentar protótipo (Ctrl+Alt+Enter)', onclick: () => { if (!present.open(ui.selection[0])) toast('Crie pelo menos um frame para apresentar.'); } }, ico('play', 13), ' Apresentar'),
  themeBtn,
  iconButton('help', 'Atalhos de teclado (?)', showHelp),
  fileInput,
);

function syncTopbar() {
  undoBtn.disabled = !store.canUndo();
  redoBtn.disabled = !store.canRedo();
  themeBtn.replaceChildren(ico(ui.theme === 'dark' ? 'sun' : 'moon'));
  if (document.activeElement !== nameInput) nameInput.value = store.state.doc.name;
  saveEl.dataset.state = ui.saveState || 'saved';
  saveEl.textContent = { saving: 'Salvando…', error: 'Não salvou!', saved: 'Salvo' }[ui.saveState || 'saved'];
}

// ---------------------------------------------------------------- barra de ferramentas
const TOOLS = [
  ['move', 'move', 'Mover (V)'],
  ['frame', 'frame', 'Frame (F)'],
  ['rect', 'rect', 'Retângulo (R)'],
  ['ellipse', 'ellipse', 'Elipse (E)'],
  ['line', 'line', 'Linha (L)'],
  ['polygon', 'polygon', 'Polígono'],
  ['star', 'star', 'Estrela'],
  ['pen', 'pen', 'Caneta / vetor (P)'],
  ['text', 'text', 'Texto (T)'],
  ['hand', 'hand', 'Mão (H)'],
];
const toolBtns = TOOLS.map(([id, ic, title]) =>
  h('button.tool', { type: 'button', title, dataset: { tool: id }, onclick: () => store.setTool(id) }, ico(ic, 18)));
const imgInput = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
imgInput.addEventListener('change', async () => {
  const files = [...imgInput.files];
  imgInput.value = '';
  try { await commands.addImageFiles(files); } catch { toast('Não consegui abrir a imagem.'); }
});
$('#toolbar').append(
  ...toolBtns.slice(0, 9),
  h('button.tool', { type: 'button', title: 'Imagem (ou arraste/cole no canvas)', onclick: () => imgInput.click() }, ico('image', 18)),
  h('span.tool-sep'),
  toolBtns[9],
  imgInput,
);
const syncTools = () => toolBtns.forEach((b) => b.classList.toggle('on', b.dataset.tool === ui.tool));

// ---------------------------------------------------------------- zoom
const zoomLabel = h('button.zoom-pct', {
  type: 'button', title: 'Opções de zoom',
  onclick: (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    showMenu(r.right, r.top - 8 - 420, [
      { label: 'Ajustar tudo', hint: '⇧ 1', icon: 'fit', onClick: () => canvas.fit(null) },
      { label: 'Ajustar à seleção', hint: '⇧ 2', onClick: () => canvas.fit(ui.selection) },
      'sep',
      { label: '50%', onClick: () => tools.zoomTo(0.5) },
      { label: '100%', hint: '⇧ 0', onClick: () => tools.zoomTo(1) },
      { label: '200%', onClick: () => tools.zoomTo(2) },
      'sep',
      { label: 'Réguas', hint: '⇧ R', checked: ui.showRulers, onClick: () => { ui.showRulers = !ui.showRulers; store.emit('ui'); store.emit('overlay'); } },
      { label: 'Guias', checked: ui.showGuides !== false, onClick: () => { ui.showGuides = ui.showGuides === false; store.emit('overlay'); } },
      { label: 'Grades de layout', checked: ui.showGrids !== false, onClick: () => { ui.showGrids = ui.showGrids === false; store.emit('overlay'); } },
      'sep',
      { label: 'Roda do mouse dá zoom', checked: ui.wheelMode === 'zoom', onClick: () => { ui.wheelMode = ui.wheelMode === 'zoom' ? 'pan' : 'zoom'; toast(ui.wheelMode === 'zoom' ? 'Roda = zoom' : 'Roda = rolar (Ctrl + roda = zoom)'); } },
    ], { anchorRight: true });
  },
});
$('#zoomw').append(
  iconButton('minus', 'Diminuir zoom', () => tools.zoomTo(canvas.getView().zoom / 1.25), 'small'),
  zoomLabel,
  iconButton('plus', 'Aumentar zoom', () => tools.zoomTo(canvas.getView().zoom * 1.25), 'small'),
  iconButton('fit', 'Ajustar tudo (Shift+1)', () => canvas.fit(null), 'small'),
);
const syncZoom = () => { zoomLabel.textContent = `${Math.round(canvas.getView().zoom * 100)}%`; };

// ---------------------------------------------------------------- menu de contexto
store.subscribe((reasons) => {
  if (reasons.has('contextmenu') && ui.contextMenu) {
    const { x, y } = ui.contextMenu;
    ui.contextMenu = null;
    showMenu(x, y, contextMenuItems({ store, commands, tools }));
  }
});

// ---------------------------------------------------------------- atalhos globais do app
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  const typing = e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveProject(store.state.doc); toast('Projeto salvo no seu computador.'); }
  if (mod && e.altKey && e.key === 'Enter') { e.preventDefault(); present.open(ui.selection[0]); }
  if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); fileInput.click(); }
  if (e.key === '?' && !typing) showHelp();
});
window.addEventListener('beforeunload', () => store.saveNow());

// ---------------------------------------------------------------- sincronização
store.subscribe((reasons) => {
  syncTopbar();
  syncTools();
  syncZoom();
  if (ui.rightTab === 'design' && reasons.has('tool')) design.render();
});
store.subscribeSync((reason) => {
  if (reason === 'view') syncZoom();
  if (reason === 'doc' && canvas.getView().fresh) requestAnimationFrame(() => canvas.getView().fresh && canvas.fit(null));
});

requestAnimationFrame(() => {
  if (canvas.getView().fresh) canvas.fit(null);
  syncTopbar(); syncTools(); syncZoom();
});

// útil para depuração e testes no navegador
window.designer = { store, canvas, commands, tools };

// ---------------------------------------------------------------- painéis redimensionáveis e modo foco
const PREF_KEY = 'projeto-designer:prefs';
const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch { return {}; } })();
const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* ignore */ } };
const root = document.documentElement;
const setWidth = (side, w) => {
  const v = Math.max(200, Math.min(520, Math.round(w)));
  root.style.setProperty(`--${side}`, `${v}px`);
  prefs[side] = v;
  window.dispatchEvent(new Event('resize'));
  return v;
};
if (prefs.left) root.style.setProperty('--left', `${prefs.left}px`);
if (prefs.right) root.style.setProperty('--right', `${prefs.right}px`);
for (const side of ['left', 'right']) {
  const el = h('div.resizer', { title: 'Arraste para redimensionar' });
  const place = () => {
    el.style.left = side === 'left' ? 'var(--left)' : 'calc(100% - var(--right))';
  };
  place();
  $('#app').append(el);
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.classList.add('active');
    const move = (ev) => setWidth(side, side === 'left' ? ev.clientX : innerWidth - ev.clientX);
    const up = () => {
      el.classList.remove('active');
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      savePrefs();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });
  el.addEventListener('dblclick', () => { root.style.removeProperty(`--${side}`); delete prefs[side]; savePrefs(); window.dispatchEvent(new Event('resize')); });
}
window.addEventListener('keydown', (e) => {
  const typing = e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key === '\\' && !typing) {
    e.preventDefault();
    $('#app').classList.toggle('focus');
    window.dispatchEvent(new Event('resize'));
    store.emit('overlay');
  }
});

// ---------------------------------------------------------------- canvas vazio: dica
const emptyHint = h('div.empty-canvas',
  h('h3', 'Canvas vazio'),
  h('p', 'Aperte ', h('kbd', 'F'), ' e arraste para desenhar um frame'),
  h('p', 'ou arraste uma imagem para cá'),
  h('p.muted', 'Arquivo → Carregar projeto de exemplo mostra o que dá para fazer'));
$('.stage').append(emptyHint);
const syncEmpty = () => { emptyHint.style.display = store.page().children.length ? 'none' : ''; };
store.subscribe(syncEmpty);
syncEmpty();

// ---------------------------------------------------------------- erros inesperados não podem passar em branco
let lastErr = 0;
const onFail = (msg) => {
  console.error(msg);
  if (Date.now() - lastErr < 4000) return;
  lastErr = Date.now();
  toast('Ops, algo deu errado. Seu trabalho continua salvo; se travar, recarregue a página.');
};
window.addEventListener('error', (e) => onFail(e.message));
window.addEventListener('unhandledrejection', (e) => onFail(String(e.reason)));
