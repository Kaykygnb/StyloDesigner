/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  main.js — PONTO DE ENTRADA: MONTA O APP
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Cria o store e liga todas as peças, nesta ordem:
 *    salvamento (lê o projeto guardado no navegador e pergunta se o servidor está aí) →
 *    store → canvas (desenha) → overlay (seleção) → commands/tools (editar) → painéis (camadas, recursos,
 *    propriedades, protótipo, código) → barra superior, barra de ferramentas, zoom, menus → preferências.
 *  Este arquivo só COLA os módulos; a lógica de cada coisa mora no módulo dela.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { createStore } from './store.js';
import { createCanvas } from './canvas.js';
import { createOverlay } from './overlay.js';
import { createRulers } from './rulers.js';
import { openGuides, setGuidesLocked } from './ui/guides.js';
import { createCommands } from './commands.js';
import { createTools } from './tools.js';
import { createLayersPanel } from './ui/layers.js';
import { createDesignPanel } from './ui/props.js';
import { createCodePanel } from './ui/code.js';
import { createAssetsPanel } from './ui/assets.js';
import { createProtoPanel } from './ui/proto.js';
import { createCommentsPanel } from './ui/comments.js';
import { createResponsiveBar } from './ui/responsive.js';
import { openCount } from './comments.js';
import { createIconsPanel } from './ui/googleicons.js';
import { ensureFonts, usedFonts } from './fonts.js';
import { createPresent } from './present.js';
import { contextMenuItems, showHelp, showMenu, ask } from './ui/menus.js';
import { VERSION } from './version.js';
import { h, ico, iconButton, tip, installAutoTips } from './ui/dom.js';
import { openProjectFile, saveProject, exportHtmlFile, exportPng } from './export.js';
import { buildSampleShowcase } from './sample-vitrine.js';
import { loadLocal, loadPrefs, savePrefs as writePrefs } from './storage.js';
import { createSaving } from './saving.js';
import { openSettings as openSettingsDialog } from './ui/settings.js';
import { openProjects as openProjectsDialog } from './ui/projects.js';
import { createHome } from './ui/home.js';
import { closeInformation } from './ui/info.js';
import { pageThumbnail } from './thumbnail.js';
import { folder } from './storage.js';
import { createRunner } from './agent/runner.js';
import { createApprover, connectMcpBridge } from './agent/bridge.js';
import { createAssistant } from './ui/assistant.js';
import { createPresence } from './ui/presence.js';
/** Lugar da presença na barra do topo (preenchido quando a presença é criada, mais abaixo). */
const presenceSlot = document.createElement('span');

/** Atalho: primeiro elemento que casa com o seletor CSS. */
const $ = (sel) => document.querySelector(sel);

// ---------------------------------------------------------------- toasts
// timer para sumir com o aviso depois de alguns segundos
let toastTimer = 0;
/** Mostra um aviso curto (balão preto) na parte de baixo da tela por ~3s. Só um por vez: o novo substitui o antigo. */
function toast(msg) {
  const box = $('#toasts');
  const t = h('div.toast', msg);
  box.replaceChildren(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 3200);
}

// ---------------------------------------------------------------- salvamento + store
// PREFERÊNCIAS DE INTERFACE (largura dos painéis, auto-salvar na pasta, roda do mouse), guardadas à parte do
// projeto: mudar o layout não "suja" o documento
installAutoTips(); // todo title="..." vira dica rica (mesmo estilo em tudo)
const prefs = loadPrefs();
/** Grava as preferências (falhas silenciosas: é só conveniência). */
const savePrefs = () => writePrefs(prefs);
// SALVAMENTO: regras de onde gravar (navegador sempre; pasta do computador quando o projeto tem um arquivo)
// `thumbnail` gera a miniatura da página aberta para a página inicial (usa `commands`, criado mais abaixo — a
// função só é chamada depois, quando tudo já existe)
const saving = createSaving({ prefs, toast, thumbnail: () => pageThumbnail(store, commands) });
// lê o projeto guardado no navegador e, ao mesmo tempo, pergunta se o servidor (pasta) está disponível.
// `await` no topo do módulo: o app só monta quando o projeto já foi lido (IndexedDB é assíncrono).
const [initial] = await Promise.all([loadLocal(), saving.refresh()]);
// o STORE: todos os outros módulos recebem ele (ver store.js). `persist` é chamado a cada salvamento automático.
const store = createStore({ initial, persist: saving.persist });
saving.attach(store);
// projeto ligado a um arquivo da pasta? confere se o arquivo mudou desde a última vez (ver saving.reconcile)
await saving.reconcile();
// estado de interface (seleção, ferramenta, painel aberto...)
const ui = store.ui;
ui.wheelMode = prefs.wheelMode || 'pan';
// avisa só UMA vez que o salvamento automático falhou (senão encheria a tela de avisos)
let warnedSave = false;
// quando o navegador recusa gravar (espaço cheio), orienta a salvar na pasta
store.onSaveError = () => {
  if (warnedSave) return;
  warnedSave = true;
  toast('Não consegui salvar no navegador (espaço cheio?). Use Arquivo → Salvar na pasta.');
};
/** Janelas de Configurações e Projetos (ver ui/settings.js e ui/projects.js). */
const openSettings = () => openSettingsDialog({ store, saving, prefs, savePrefs, toast });
const openProjects = (mode = 'open') => openProjectsDialog({ store, saving, canvas, toast, openSettings, confirmReplace, mode });
/** Ctrl+S: grava no arquivo ligado; se ainda não há arquivo, abre a janela para dar um nome. */
const quickSave = async () => { if (!(await saving.quickSave())) openProjects('save'); };

// ---------------------------------------------------------------- núcleo
// NÚCLEO: canvas (desenha), overlay (seleção por cima), comandos (editar), ferramentas (mouse/teclado) e réguas.
// A ordem importa: o overlay assina o store DEPOIS do canvas para sempre medir o DOM já atualizado.
const viewport = $('#viewport');
const canvas = createCanvas(store, viewport);
// o overlay precisa do SVG da caneta, que vem de `tools`, criado depois — então passamos uma função que consulta `toolsRef` quando for chamada
let toolsRef = null;
createOverlay(store, canvas, viewport, { penSvg: () => toolsRef?.pen.overlaySvg() || '' });
const commands = createCommands(store, canvas);
commands.notify = (msg) => toast(msg);
const tools = createTools({ store, canvas, commands, viewport, toast });
toolsRef = tools;
createRulers({ store, canvas, stage: $('.stage'), commands, onManageGuides: () => openGuides({ store, commands, canvas }) });
const responsive = createResponsiveBar({ store, canvas, commands, toast, stage: $('.stage') });

// ---------------------------------------------------------------- painel esquerdo
// PAINEL ESQUERDO: abas "Camadas" e "Recursos" (cada uma é um painel pronto; a aba só escolhe qual mostrar)
const leftBody = h('div.left-body');
const layersBox = h('div.left-body');
const assetsBox = h('div.left-body');
const iconsBox = h('div.left-body');
// o painel de ícones só é montado na 1ª vez que a aba abre (são milhares de nomes; não precisa no início)
let iconsPanel = null;
const assets = createAssetsPanel({ store, commands, canvas, container: assetsBox, toast });
createLayersPanel({ store, commands, container: layersBox });
const ltLayers = h('button.tab', { type: 'button', role: 'tab', onclick: () => setLeftTab('layers') }, ico('layers', 14), ' Camadas');
const ltAssets = h('button.tab', { type: 'button', role: 'tab', onclick: () => setLeftTab('assets') }, ico('component', 14), ' Recursos');
const ltIcons = h('button.tab', { type: 'button', role: 'tab', onclick: () => setLeftTab('icons') }, ico('star', 14), ' Ícones');
/** Uma parada de Tab por painel; as setas percorrem as abas sem acionar atalhos do canvas. */
function bindPanelTabs(buttons, panel, id) {
  panel.id = `${id}-content`;
  panel.setAttribute('role', 'tabpanel');
  panel.tabIndex = 0;
  buttons.forEach((button, index) => {
    button.id = `${id}-tab-${index}`;
    button.setAttribute('aria-controls', panel.id);
    button.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      else if (event.key === 'ArrowLeft') next = (index + buttons.length - 1) % buttons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      else return;
      event.preventDefault();
      event.stopPropagation();
      buttons[next].click();
      buttons[next].focus();
    });
  });
}
bindPanelTabs([ltLayers, ltAssets, ltIcons], leftBody, 'left');
$('#left').append(h('div.tabs', { role: 'tablist', 'aria-label': 'Painel esquerdo' }, ltLayers, ltAssets, ltIcons), leftBody);
/** Troca a aba do painel esquerdo ('layers' | 'assets' | 'icons'). */
function setLeftTab(tab) {
  ui.leftTab = tab;
  // aria-selected: o leitor de tela anuncia qual aba está ativa
  for (const [b, t] of [[ltLayers, 'layers'], [ltAssets, 'assets'], [ltIcons, 'icons']]) {
    b.classList.toggle('on', tab === t);
    b.setAttribute('aria-selected', String(tab === t));
    b.tabIndex = tab === t ? 0 : -1;
    if (tab === t) leftBody.setAttribute('aria-labelledby', b.id);
  }
  leftBody.replaceChildren(tab === 'layers' ? layersBox : tab === 'assets' ? assetsBox : iconsBox);
  if (tab === 'assets') assets.render();
  if (tab === 'icons') {
    iconsPanel ||= createIconsPanel({ commands, container: iconsBox, toast });
    iconsPanel.focus();
  }
}
setLeftTab('layers');

// ---------------------------------------------------------------- painel direito
// PAINEL DIREITO: abas "Design", "Protótipo" e "Código". Os 3 painéis são criados uma vez e só trocados de lugar.
const design = createDesignPanel({ store, canvas, commands, tools, toast });
const code = createCodePanel({ store, commands, toast });
const present = createPresent({ store, canvas });
const proto = createProtoPanel({ store, present, toast });
const comments = createCommentsPanel({ store, canvas, prefs, toast });
const rightBody = h('div.right-body');
const tabDesign = h('button.tab', { type: 'button', role: 'tab', 'aria-label': 'Design', onclick: () => setTab('design') }, ico('sliders', 14), h('span.tab-label', 'Design'));
const tabProto = h('button.tab', { type: 'button', role: 'tab', 'aria-label': 'Protótipo', onclick: () => setTab('proto') }, ico('play', 13), h('span.tab-label', 'Protótipo'));
const tabCode = h('button.tab', { type: 'button', role: 'tab', 'aria-label': 'Código', onclick: () => setTab('code') }, ico('code', 14), h('span.tab-label', 'Código'));
// Quatro abas com rótulos; em painéis estreitos o CSS mostra seus ícones.
const cmBadge = h('span.cm-badge', { hidden: true });
const tabComments = h('button.tab.tab-cm', { type: 'button', role: 'tab', title: 'Comentários', 'aria-label': 'Comentários', onclick: () => setTab('comments') }, ico('comment', 14), h('span.tab-label', 'Comentários'), cmBadge);
bindPanelTabs([tabDesign, tabProto, tabCode, tabComments], rightBody, 'right');
$('#right').append(h('div.tabs', { role: 'tablist', 'aria-label': 'Painel direito' }, tabDesign, tabProto, tabCode, tabComments), rightBody);
/** Troca a aba do painel direito ('design' | 'proto' | 'code' | 'comments') e já redesenha o painel escolhido. */
function setTab(tab) {
  closeInformation();
  ui.rightTab = tab;
  tabDesign.classList.toggle('on', tab === 'design');
  tabProto.classList.toggle('on', tab === 'proto');
  tabCode.classList.toggle('on', tab === 'code');
  tabComments.classList.toggle('on', tab === 'comments');
  [[tabDesign, 'design'], [tabProto, 'proto'], [tabCode, 'code'], [tabComments, 'comments']].forEach(([b, t]) => {
    b.setAttribute('aria-selected', String(tab === t));
    b.tabIndex = tab === t ? 0 : -1;
    if (tab === t) rightBody.setAttribute('aria-labelledby', b.id);
  });
  rightBody.replaceChildren(tab === 'design' ? design.el : tab === 'proto' ? proto.el : tab === 'comments' ? comments.el : code.el);
  if (tab === 'comments') comments.render();
  else if (tab === 'code') code.render();
  else if (tab === 'proto') proto.render();
  else design.render();
  store.emit('overlay');
}
setTab('design');
ui.setRightTab = setTab; // outros módulos (ferramenta Comentar, pinos no canvas, menu de contexto) abrem a aba por aqui

// ---------------------------------------------------------------- barra superior
// BARRA SUPERIOR: nome do projeto (editável), indicador de salvo, desfazer/refazer, tema, apresentar, ajuda
const nameInput = h('input.doc-name', { value: store.state.doc.name, spellcheck: false, title: 'Nome do projeto' });
nameInput.addEventListener('change', () => {
  store.state.doc.name = nameInput.value.trim() || 'Sem título';
  nameInput.value = store.state.doc.name;
  store.commit();
});
nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && nameInput.blur());

// indicador de salvamento (atualizado em syncTopbar). É um botão: clicar abre as Configurações de onde salvar.
const saveEl = h('button.save-state', { type: 'button', onclick: () => openSettings() }, 'Salvo');
const undoBtn = iconButton('undo', 'Desfazer (Ctrl+Z)', () => store.undo());
const redoBtn = iconButton('redo', 'Refazer (Ctrl+Shift+Z)', () => store.redo());
const themeBtn = iconButton('sun', 'Alternar tema claro/escuro', () => store.setTheme(ui.theme === 'dark' ? 'light' : 'dark'));
const settingsBtn = iconButton('settings', 'Configurações (Ctrl+,)', () => openSettings());
// seletor de arquivo escondido: o menu Arquivo → Abrir "clica" nele para abrir o diálogo do sistema
const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
fileInput.addEventListener('change', async () => {
  const f = fileInput.files[0];
  fileInput.value = '';
  if (!f) return;
  if (!(await confirmReplace(`Importar "${f.name}"?`))) return;
  try {
    await store.saveNow();
    store.loadDoc(await openProjectFile(f));
    home.close();
    canvas.fit(null);
    toast(`Projeto "${store.state.doc.name}" importado. Use Ctrl+S para guardá-lo na pasta.`);
  } catch (err) {
    toast(err.message || 'Arquivo inválido.');
  }
});

// menu "Arquivo": novo, abrir/salvar na pasta, importar/baixar .json, exportar (HTML da seleção; PNG de todos os
// frames), exemplos e configurações
const fileBtn = h('button.btn.ghost', {
  type: 'button',
  onclick: async (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    // RECENTES: os 5 projetos da pasta mexidos por último (menos o aberto). Pede a lista antes de abrir o menu;
    // é rápido (servidor local), e se falhar o menu abre sem eles.
    const recent = ui.server ? (await folder.list().catch(() => [])).filter((p) => p.file !== ui.link?.file).slice(0, 5) : [];
    showMenu(r.left, r.bottom + 6, [
      { label: 'Página inicial', icon: 'layers', onClick: () => home.open() },
      'sep',
      { label: 'Novo ícone (24×24)', icon: 'pen', onClick: () => { commands.newIcon(24); toast('Ícone 24×24 pronto: desenhe com a caneta. Para exportar sem fundo, ponha o Preenchimento do frame em Nenhum.'); } },
      { label: 'Novo projeto', icon: 'file', onClick: async () => { if (await confirmReplace('Começar um projeto novo em branco?')) { store.newDoc(); canvas.fit(null); } } },
      { label: 'Abrir da pasta…', hint: 'Ctrl+O', icon: 'folder', onClick: () => openProjects('open') },
      ...(recent.length ? [{ label: 'Recentes', disabled: true, heading: true }, ...recent.map((p) => ({
        label: p.file.replace(/\.json$/, ''), icon: 'history',
        onClick: async () => {
          if (!(await confirmReplace(`Abrir "${p.file.replace(/\.json$/, '')}"?`))) return;
          try { await saving.open(p.file); canvas.fit(null); } catch (err) { toast(err.message); }
        },
      }))] : []),
      'sep',
      { label: ui.link ? `Salvar (${ui.link.file})` : 'Salvar na pasta…', hint: 'Ctrl+S', icon: 'save', onClick: quickSave },
      { label: 'Salvar como…', hint: 'Ctrl+⇧+S', onClick: () => openProjects('save') },
      'sep',
      { label: 'Importar arquivo .json…', icon: 'upload', onClick: () => fileInput.click() },
      { label: 'Baixar cópia (.json)', icon: 'download', onClick: () => saveProject(store.state.doc) },
      'sep',
      {
        label: 'Exportar seleção como HTML', icon: 'code', disabled: !ui.selection.length,
        onClick: () => commands.topSelection().forEach((n) => exportHtmlFile(n, store.state.doc.assets, store.state.doc.styles)),
      },
      {
        label: 'Exportar todos os frames da página (PNG 2x)', icon: 'image',
        disabled: !store.page().children.some((n) => n.type === 'frame'),
        onClick: async () => {
          const frames = store.page().children.filter((n) => n.type === 'frame' && n.visible);
          try {
            for (const f of frames) { await exportPng(f, store.state.doc.assets, 2, store.state.doc.styles); await new Promise((r) => setTimeout(r, 250)); }
            toast(`${frames.length} imagens exportadas.`);
          } catch (err) { toast(err.message); }
        },
      },
      'sep',
      { label: 'Abrir o projeto base (vitrine completa)', icon: 'star', onClick: async () => { if (await confirmReplace('Abrir o exemplo "Vitrine completa"?')) { store.loadDoc(buildSampleShowcase(), { pristine: true }); canvas.fit(null); } } },
      'sep',
      { label: 'Configurações…', hint: 'Ctrl+,', icon: 'settings', onClick: () => openSettings() },
    ]);
  },
}, ico('folder', 15), ' Arquivo');
fileBtn.setAttribute('aria-haspopup', 'menu');

/**
 * Antes de TROCAR o projeto aberto (abrir outro, novo, exemplo, importar). Regras:
 *  - projeto gravado na pasta, ou exemplo/em branco não editado → troca sem perguntar (nada se perde);
 *  - projeto que só existe no navegador → pergunta, porque o navegador guarda UM projeto: ele seria substituído.
 *    Opções: salvar na pasta antes (abre "Salvar na pasta" e cancela a troca), trocar mesmo assim, ou cancelar.
 * @returns {Promise<boolean>} true = pode trocar
 */
async function confirmReplace(question) {
  if (ui.pristine || (ui.link && ui.savedWhere === 'folder' && !ui.link.conflict)) return true;
  const choice = await ask({
    title: question,
    message: [
      h('p', h('strong', `"${store.state.doc.name}"`), ' só está salvo neste navegador, e o navegador guarda um projeto por vez.'),
      'Se continuar, ele será substituído e não dá para desfazer.',
    ],
    buttons: [
      { label: 'Cancelar', value: null },
      ...(ui.server ? [{ label: 'Salvar na pasta antes', value: 'save', primary: true }] : [{ label: 'Baixar cópia antes', value: 'download', primary: true }]),
      { label: 'Descartar e continuar', value: 'go', danger: true },
    ],
  });
  if (choice === 'save') { quickSave(); return false; }
  if (choice === 'download') { saveProject(store.state.doc); return false; }
  return choice === 'go';
}

// botão do Assistente de IA (o painel é criado mais abaixo, junto com o MCP)
const aiBtn = h('button.btn.ghost.ai-btn', { type: 'button', title: 'Agente de IA: conversas, modelos e memória do projeto' }, ico('sparkle', 15), h('span.tab-label', ' Agente'));
// monta a barra superior
$('#topbar').append(
  h('button.brand', { type: 'button', title: 'Página inicial (seus projetos)', onclick: () => home.open() },
    h('div.logo', { html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#0b0c0e" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M16.5 7.2C15.6 6.2 14.1 5.6 12.4 5.6c-2.5 0-4.2 1.3-4.2 3.2 0 4.2 8.6 2.2 8.6 6.3 0 1.9-1.8 3.3-4.4 3.3-1.9 0-3.5-.7-4.5-1.9"/></svg>' }),
    h('span.brand-name', 'Stylo')),
  fileBtn,
  h('span.sep'),
  undoBtn, redoBtn,
  nameInput,
  saveEl,
  h('div.spacer'),
  responsive.topEl,
  h('div.spacer'),
  presenceSlot,
  aiBtn,
  h('button.btn.primary', { type: 'button', title: 'Apresentar protótipo (Ctrl+Alt+Enter)', onclick: () => { if (!present.open(ui.selection[0])) toast('Crie pelo menos um frame para apresentar.'); } }, ico('play', 13), ' Apresentar'),
  themeBtn,
  settingsBtn,
  iconButton('help', 'Central de ajuda (?)', () => showHelp('start', VERSION)),
  fileInput,
);

/** Atualiza a barra superior conforme o estado: desfazer/refazer habilitados, ícone do tema, nome e indicador de salvo. */
function syncTopbar() {
  undoBtn.disabled = !store.canUndo();
  redoBtn.disabled = !store.canRedo();
  themeBtn.replaceChildren(ico(ui.theme === 'dark' ? 'sun' : 'moon'));
  if (document.activeElement !== nameInput) nameInput.value = store.state.doc.name;
  const [state, text, title] = saveStatus();
  saveEl.dataset.state = state;
  saveEl.replaceChildren(h('span.save-label', text));
  saveEl.setAttribute('aria-label', `${text}. Configurações de salvamento`);
  tip(saveEl, { title: text, text: title }); // dica rica (ui/dom.js) no lugar do title nativo
}
/**
 * O que o indicador do topo mostra: [estado (cor), texto, dica ao passar o mouse].
 *  - "Salvo na pasta"       → gravado no arquivo .json da pasta (e no navegador)
 *  - "Salvo no navegador"   → projeto ainda sem arquivo: só a cópia do navegador existe
 *  - "Só no navegador"      → tem arquivo, mas a pasta falhou (servidor desligado, conflito, permissão)
 */
function saveStatus() {
  if (ui.saveState === 'saving') return ['saving', 'Salvando…', 'Gravando as últimas mudanças'];
  if (ui.saveState === 'error') return ['error', 'Não salvou!', 'O navegador recusou gravar. Use Arquivo → Salvar na pasta.'];
  if (ui.link && ui.savedWhere === 'folder') return ['saved', 'Salvo na pasta', `Gravado em ${ui.link.file} — ${ui.server?.folder || ''}`];
  if (ui.link && ui.link.conflict) return ['warn', 'Conflito no arquivo', `${ui.link.file} mudou fora do editor. Ctrl+S para decidir; enquanto isso, salvo só no navegador.`];
  if (ui.link && prefs.autoFolder === false) return ['saved', 'Salvo no navegador', 'Auto-salvar na pasta está desligado: Ctrl+S grava no arquivo.'];
  if (ui.link) return ['warn', 'Só no navegador', ui.folderProblem === 'offline' || !ui.server ? 'Servidor desligado: rode npm start para voltar a gravar na pasta.' : `Não gravou na pasta: ${ui.folderProblem}`];
  return ['saved', 'Salvo no navegador', 'Este projeto ainda não tem arquivo. Ctrl+S salva na pasta do computador.'];
}

// ---------------------------------------------------------------- barra de ferramentas
/** Ferramentas da barra flutuante: [id, ícone, dica com atalho]. A ordem é a ordem na tela. */
const TOOLS = [
  ['move', 'move', 'Mover (V)'],
  ['frame', 'frame', 'Frame (F)'],
  ['section', 'section', 'Seção (⇧S)'],
  ['rect', 'rect', 'Retângulo (R)'],
  ['ellipse', 'ellipse', 'Elipse (E)'],
  ['line', 'line', 'Linha (L)'],
  ['polygon', 'polygon', 'Polígono'],
  ['star', 'star', 'Estrela'],
  ['pen', 'pen', 'Caneta / vetor (P)'],
  ['text', 'text', 'Texto (T)'],
  ['comment', 'comment', 'Comentar (C)'],
  ['inspect', 'inspect', 'Inspecionar (I): passe o mouse para ver o HTML e o CSS, como o F12'],
  ['hand', 'hand', 'Mão (H)'],
];
const toolBtns = TOOLS.map(([id, ic, title]) =>
  h('button.tool', { type: 'button', title, 'aria-label': title, dataset: { tool: id }, onclick: () => store.setTool(id) }, ico(ic, 18)));
// botão de imagem: abre o seletor de arquivos e cria camadas com as imagens escolhidas
const imgInput = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
imgInput.addEventListener('change', async () => {
  const files = [...imgInput.files];
  imgInput.value = '';
  try { await commands.addImageFiles(files); } catch { toast('Não consegui abrir a imagem.'); }
});
// Grupos mantêm juntas as ferramentas relacionadas, inclusive quando a barra quebra em duas linhas.
const toolGroup = (label, ...buttons) => h('div.tool-group', { role: 'group', 'aria-label': label }, ...buttons);
$('#toolbar').append(
  toolGroup('Navegar', toolBtns[0], toolBtns[12]),
  toolGroup('Estruturar', toolBtns[1], toolBtns[2]),
  toolGroup('Desenhar formas', ...toolBtns.slice(3, 8)),
  toolGroup('Criar conteúdo', toolBtns[8], toolBtns[9],
    h('button.tool', { type: 'button', title: 'Imagem (ou arraste/cole no canvas)', 'aria-label': 'Inserir imagem', onclick: () => imgInput.click() }, ico('image', 18))),
  toolGroup('Revisar', toolBtns[10], toolBtns[11]),
  imgInput,
);
$('#toolbar').setAttribute('role', 'toolbar');
$('#toolbar').setAttribute('aria-label', 'Ferramentas');
// O zoom acompanha a altura real da barra, mesmo quando os painéis estreitam o canvas.
new ResizeObserver(() => {
  $('.stage').style.setProperty('--tools-height', `${$('#toolbar').offsetHeight}px`);
}).observe($('#toolbar'));
// ---------------------------------------------------------------- barra da caneta (encaixe na grade + dicas)
// Aparece sozinha quando a caneta está ativa ou quando se editam pontos de um vetor. O "Encaixe" faz os pontos
// grudarem numa grade de 1, 2, 4 ou 8 px (contada do canto do frame): é o que deixa um ícone nítido.
const penBar = h('div.pen-bar', { hidden: true });
let penBarSig = '';
function renderPenBar() {
  const show = ui.tool === 'pen' || !!ui.editPathId;
  const snap = Number(ui.penSnap) || 0;
  const sig = `${show}|${snap}|${!!ui.editPathId}`;
  if (sig === penBarSig) return;
  penBarSig = sig;
  penBar.hidden = !show;
  if (!show) return;
  penBar.replaceChildren(
    h('span.pen-bar-title', ico('pen', 13), ui.editPathId ? 'Editando pontos' : 'Caneta'),
    tip(h('div.segmented.wide', [0, 1, 2, 4, 8].map((s) =>
      h('button.seg-btn.wide' + (snap === s ? '.on' : ''), { type: 'button', onclick: () => { ui.penSnap = s; store.emit('ui'); renderPenBar(); } }, s ? `${s}px` : 'Livre'))),
    { title: 'Encaixe na grade', text: 'Os pontos grudam numa grade de pixels, contada do canto do frame onde você desenha. Em ícones de 24×24, use 1px.' }),
    h('span.pen-bar-hint', 'Shift trava 45° · Alt+clique no ponto: canto/suave · Enter termina'));
}
store.subscribe((reasons) => { if (reasons.has('tool') || reasons.has('overlay') || reasons.has('ui') || reasons.has('selection')) renderPenBar(); });
$('.stage').append(penBar);
renderPenBar();

/** Destaca o botão da ferramenta ativa (aria-pressed diz ao leitor de tela qual está ligada). */
const syncTools = () => toolBtns.forEach((b) => {
  const on = b.dataset.tool === ui.tool;
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', String(on));
});

// ---------------------------------------------------------------- zoom
// controle de zoom (canto inferior direito): −, porcentagem (abre menu com ajustar/50%/100%/200%, réguas, guias, grades), +, ajustar
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
      { label: 'Réguas', hint: 'Ctrl R', checked: ui.showRulers, onClick: () => store.toggleRulers() },
      { label: 'Notas', checked: ui.showNotes !== false, onClick: () => { ui.showNotes = ui.showNotes === false; store.emit('overlay'); } },
      { label: 'Guias', checked: ui.showGuides !== false, onClick: () => { ui.showGuides = ui.showGuides === false; store.emit('overlay'); } },
      { label: 'Gerenciar guias…', onClick: () => openGuides({ store, commands, canvas }) },
      { label: 'Travar guias', checked: !!ui.guidesLocked, onClick: () => setGuidesLocked(store, !ui.guidesLocked) },
      { label: 'Grades de layout', checked: ui.showGrids !== false, onClick: () => { ui.showGrids = ui.showGrids === false; store.emit('overlay'); } },
      'sep',
      { label: 'Roda do mouse dá zoom', checked: ui.wheelMode === 'zoom', onClick: () => { ui.wheelMode = ui.wheelMode === 'zoom' ? 'pan' : 'zoom'; prefs.wheelMode = ui.wheelMode; savePrefs(); toast(ui.wheelMode === 'zoom' ? 'Roda = zoom' : 'Roda = rolar (Ctrl + roda = zoom)'); } },
    ], { anchorRight: true });
  },
});
$('#zoomw').append(
  iconButton('minus', 'Diminuir zoom', () => tools.zoomTo(canvas.getView().zoom / 1.25), 'small'),
  zoomLabel,
  iconButton('plus', 'Aumentar zoom', () => tools.zoomTo(canvas.getView().zoom * 1.25), 'small'),
  iconButton('fit', 'Ajustar tudo (Shift+1)', () => canvas.fit(null), 'small'),
);
/** Mostra o zoom atual em % no botão. */
const syncZoom = () => { zoomLabel.textContent = `${Math.round(canvas.getView().zoom * 100)}%`; };

// ---------------------------------------------------------------- menu de contexto
// o canvas pede o menu de contexto (botão direito) emitindo 'contextmenu'; abrimos o menu na posição do mouse
store.subscribe((reasons) => {
  if (reasons.has('contextmenu') && ui.contextMenu) {
    const { x, y } = ui.contextMenu;
    ui.contextMenu = null;
    showMenu(x, y, contextMenuItems({ store, commands, tools }));
  }
});

// ---------------------------------------------------------------- atalhos globais do app
// Atalhos GLOBAIS do app (os do canvas estão em tools.js): Ctrl+S salva na pasta · Ctrl+Shift+S salvar como ·
// Ctrl+O abre da pasta · Ctrl+, configurações · Ctrl+Alt+Enter apresenta · "?" atalhos (não enquanto digita num campo)
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  const typing = e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  // com uma janela aberta (Configurações, Projetos, ajuda), os atalhos do app ficam quietos
  if (document.querySelector('.modal-backdrop') || ui.homeOpen) return;
  const key = e.key.toLowerCase();
  if (mod && key === 's') { e.preventDefault(); e.shiftKey ? openProjects('save') : quickSave(); }
  if (mod && e.altKey && e.key === 'Enter') { e.preventDefault(); present.open(ui.selection[0]); }
  if (mod && key === 'o') { e.preventDefault(); openProjects('open'); }
  if (mod && e.key === ',') { e.preventDefault(); openSettings(); }
  if (e.key === '?' && !typing) showHelp('keys', VERSION);
});
// ao esconder a aba (trocar de aba, minimizar, fechar) e ao sair, grava na hora, sem esperar o atraso do auto-salvar.
// `visibilitychange` é o mais confiável: o IndexedDB é assíncrono e pode não terminar dentro do `beforeunload`.
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && store.saveNow());
window.addEventListener('pagehide', () => store.saveNow());
// voltando para a aba: o servidor pode ter sido ligado/desligado enquanto isso
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && saving.refresh());

// ---------------------------------------------------------------- sincronização
// mantém topo, ferramentas e zoom em dia (1x por frame)
store.subscribe((reasons) => {
  syncTopbar();
  syncTools();
  syncZoom();
  if (ui.rightTab === 'design' && reasons.has('tool')) design.render();
  // comentários: o painel (se aberto) e o número na aba acompanham o documento
  if (ui.rightTab === 'comments' && ['doc', 'selection', 'history'].some((r) => reasons.has(r))) comments.render();
  syncCommentBadge();
});
/** Número de comentários abertos no selo da aba (some quando é zero). */
function syncCommentBadge() {
  const open = openCount(store.state.doc);
  cmBadge.hidden = !open;
  if (open) cmBadge.textContent = open > 9 ? '9+' : String(open);
}
// zoom reage na hora; e, na primeira vez que uma página abre, "ajusta tudo" sozinho para o conteúdo aparecer
store.subscribeSync((reason) => {
  if (reason === 'view') syncZoom();
  if (reason === 'doc' && canvas.getView().fresh) requestAnimationFrame(() => canvas.getView().fresh && canvas.fit(null));
});

// primeiro desenho: ajusta a vista e sincroniza os controles (precisa esperar o layout existir)
requestAnimationFrame(() => {
  if (canvas.getView().fresh) canvas.fit(null);
  syncTopbar(); syncTools(); syncZoom(); syncCommentBadge();
});

// ---------------------------------------------------------------- IA: assistente interno e MCP
// As duas portas de entrada de uma IA usam o MESMO executor (agent/runner.js) e a MESMA janela de permissão:
// o Assistente (painel flutuante, com a sua chave da OpenAI) e programas externos via MCP (Claude Code, Codex...).
const approve = createApprover();
const runner = createRunner({ store, commands, approve, saving, folder });
const assistant = createAssistant({ store, runner, openSettings, stage: $('.stage'), approve, prefs, savePrefs });
aiBtn.addEventListener('click', () => assistant.toggle());
// o editor fica "ouvindo" pedidos do MCP enquanto o servidor estiver no ar (sem servidor, não há MCP)
let bridge = null;
const presence = createPresence({ store, prefs, savePrefs, toast, onProfile: () => bridge?.reconnect() });
presenceSlot.replaceWith(presence.el);
if (ui.server) bridge = connectMcpBridge({ runner, toast, profile: () => presence.profile(), onPresence: (d) => presence.update(d) });

// exposto no console do navegador para depuração e para os testes automáticos (window.designer.store etc.)
window.designer = { store, canvas, commands, tools, agent: { runner, approve, assistant } };

// ---------------------------------------------------------------- fontes do Google
// Baixa as fontes do Google que os textos do projeto usam: ao abrir e depois de cada mudança gravada no histórico
// (abrir outro projeto, colar, trocar fonte, desfazer...). Cada fonte é baixada uma vez só (ver fonts.js).
ensureFonts(usedFonts(store.state.doc));
store.subscribe((reasons) => { if (reasons.has('history')) ensureFonts(usedFonts(store.state.doc)); });
// quando uma fonte termina de carregar, o tamanho dos textos muda (letras mais largas/estreitas): redesenha e
// remede tudo para as caixas de seleção e o auto layout ficarem certos
document.fonts?.addEventListener('loadingdone', () => store.emit('doc'));

// ---------------------------------------------------------------- página inicial
// PÁGINA INICIAL: tela com os projetos da pasta, "continuar de onde parou" e exemplos (ver ui/home.js).
// Abre ao iniciar, a não ser que a pessoa prefira ir direto ao editor (Configurações) ou a URL tenha ?editor
// (os testes automáticos usam isso para cair direto no editor).
const home = createHome({
  store, saving, canvas, toast, openSettings, openProjects, confirmReplace,
  thumbnail: () => pageThumbnail(store, commands),
  importFile: () => fileInput.click(),
  create: {
    blank: () => store.newDoc(),
    samples: [
      { label: 'Vitrine completa', description: 'O projeto base: um site responsivo que usa todos os recursos e ensina o app', image: 'assets/example-vitrine.png', load: () => store.loadDoc(buildSampleShowcase(), { pristine: true }) },
    ],
  },
});
window.designer.home = home;
window.designer.saving = saving;
if (prefs.startScreen !== 'editor' && !new URLSearchParams(location.search).has('editor')) home.open();

// ---------------------------------------------------------------- lembrete "só no navegador"
// Projeto SEM arquivo na pasta e com servidor disponível: depois de algumas edições, mostra UMA vez (por projeto)
// um lembrete discreto com o botão "Salvar na pasta". O indicador do topo já diz isso, mas é fácil não reparar.
let notice = null;
let noticeDoc = null;
let editsHere = 0;
const hideNotice = () => { notice?.remove(); notice = null; };
// subscribeSync: conta CADA edição (a assinatura por quadro juntaria várias edições rápidas numa só)
store.subscribeSync((reason) => {
  if (store.state.doc !== noticeDoc) { noticeDoc = store.state.doc; editsHere = 0; hideNotice(); return; }
  if (ui.link) return hideNotice();
  if (reason !== 'history' || !store.canUndo()) return;
  editsHere += 1;
  if (editsHere !== 12 || !ui.server || notice) return;
  notice = h('div.notice', { role: 'status' },
    ico('save', 16),
    h('div', h('strong', 'Este projeto ainda não tem arquivo'), h('span', 'Ele só está guardado neste navegador. Salve na pasta para não perder.')),
    h('button.btn.primary.small', { type: 'button', onclick: () => { hideNotice(); quickSave(); } }, 'Salvar na pasta'),
    h('button.icon-btn.small', { type: 'button', title: 'Agora não', 'aria-label': 'Fechar lembrete', onclick: hideNotice }, ico('x', 14)));
  $('.stage').append(notice);
});

// ---------------------------------------------------------------- painéis redimensionáveis e modo foco
// <html>: as larguras dos painéis são variáveis CSS (--left, --right) definidas aqui
const root = document.documentElement;
/** Define a largura de um painel (entre 200 e 520px), avisa quem depende do tamanho (réguas, canvas) e devolve o valor aplicado. */
const setWidth = (side, w) => {
  const v = Math.max(200, Math.min(520, Math.round(w)));
  root.style.setProperty(`--${side}`, `${v}px`);
  prefs[side] = v;
  window.dispatchEvent(new Event('resize'));
  return v;
};
// restaura as larguras salvas
if (prefs.left) root.style.setProperty('--left', `${prefs.left}px`);
if (prefs.right) root.style.setProperty('--right', `${prefs.right}px`);
// Duas alças verticais (esquerda e direita) para arrastar a borda dos painéis. Duplo clique restaura a largura padrão.
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
// Ctrl+\ : modo foco (esconde os dois painéis para o canvas ocupar a tela toda)
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
// CANVAS VAZIO: mostra uma dica de como começar enquanto a página não tem nenhuma camada
const emptyHint = h('div.empty-canvas',
  h('h3', 'Canvas vazio'),
  h('p', 'Aperte ', h('kbd', 'F'), ' e arraste para desenhar um frame'),
  h('p', 'ou arraste uma imagem para cá'),
  h('p.muted', 'Arquivo → Abrir o projeto base mostra o que dá para fazer'));
$('.stage').append(emptyHint);
/** Mostra/esconde a dica conforme a página tem ou não camadas. */
const syncEmpty = () => { emptyHint.style.display = store.page().children.length ? 'none' : ''; };
store.subscribe(syncEmpty);
syncEmpty();

// ---------------------------------------------------------------- erros inesperados não podem passar em branco
// ERROS INESPERADOS: em vez de o app parar em silêncio, mostra um aviso amigável (no máximo 1 a cada 4s) e registra o erro no console
let lastErr = 0;
/** Trata uma falha inesperada: registra no console e avisa o usuário (com limite de frequência). */
const onFail = (msg) => {
  console.error(msg);
  if (Date.now() - lastErr < 4000) return;
  lastErr = Date.now();
  toast('Ops, algo deu errado. Seu trabalho continua salvo; se travar, recarregue a página.');
};
window.addEventListener('error', (e) => onFail(e.message));
window.addEventListener('unhandledrejection', (e) => onFail(String(e.reason)));
