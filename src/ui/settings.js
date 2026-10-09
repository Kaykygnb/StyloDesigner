/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/settings.js — PÁGINA "CONFIGURAÇÕES" (tela cheia dentro do app, não é janela modal)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Aberta pelo menu da conta (avatar no topo), por Arquivo → Configurações, pelo indicador "Salvo" ou Ctrl+,
 *  (vírgula). Abrir só ESCONDE o editor (fica `inert` por trás, sem recarregar nada); "Voltar ao editor" e Esc
 *  fecham. À esquerda, uma barra fixa com as seções; à direita, o conteúdo da seção escolhida, em cartões:
 *   1. Conta              — o seu perfil local (nome, e-mail, cargo, avatar, idioma), salvo sozinho (account.js).
 *   2. Projetos e pasta   — pasta do computador (o SERVIDOR grava lá), auto-salvar, versões e a cópia no navegador.
 *   3. Agente de IA       — provedor, modelo (lista "Ver modelos", "Testar modelo" com os resultados guardados), endereço
 *                           da API, tempos (1º pedaço, tempo máximo pensando) e "Pedir menos raciocínio" (NVIDIA NIM).
 *   4. Chaves de API      — a chave do provedor escolhido e a do Jev (TypeSafe); ficam só neste computador.
 *   5. MCP e agentes      — acesso de administrador e como ligar Claude Code / Codex / Claude Desktop.
 *   6. Aparência          — tema, tela ao abrir o app e o que a roda do mouse faz.
 *   7. Atalhos            — a lista de atalhos de teclado.
 *   8. Sobre e suporte    — versão e a Central de ajuda.
 *  Explicações longas (copiar a pasta para a nuvem, caminhos, comandos) ficam atrás do botão "i" ou de um
 *  "Mostrar detalhes": quem não precisa delas não as vê.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { showHelp, SHORTCUTS } from './menus.js';
import { informationButton, closeInformation } from './info.js';
import { browserUsage, requestPersistence, folder } from '../storage.js';
import { PROVIDERS } from '../agent/providers.js';
import { ACCOUNT_COLORS, avatarEl, shrinkAvatar } from '../account.js';
import { VERSION } from '../version.js';

/** "12345678" bytes → "11,8 MB". */
export const formatBytes = (b) =>
  b == null ? '?' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

/** Caixa de seleção no estilo do app (a mesma de props.js). */
const checkbox = (label, checked, onchange) => {
  const input = h('input', { type: 'checkbox', checked, onchange: () => onchange(input.checked) });
  return h('label.check', input, h('span.box', ico('check', 10)), h('span', label));
};

/** "1234" ms → "1,2 s". */
export const formatSecs = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`);
/** Selo curto do teste de um modelo (para a lista de modelos): "✓ ferramentas · 1,2 s", "✗ sem ferramentas"... */
export const testBadge = (t) => !t ? '' : t.ok ? `✓ ferramentas · ${formatSecs(t.firstTokenMs)}${t.reasoning ? ' · pensa' : ''}`
  : t.tools === false ? '✗ sem ferramentas' : t.code === 'first_token' || t.code === 'thinking' ? '✗ lento demais' : '✗ falhou';

/** Seções da página: [id, ícone, nome, descrição curta no cabeçalho]. */
const SECTIONS = [
  ['account', 'user', 'Conta', 'Seu perfil neste computador. Ele assina os comentários e aparece para quem está no projeto.'],
  ['folder', 'folder', 'Projetos e pasta', 'Onde os projetos são gravados e como as versões antigas são guardadas.'],
  ['ai', 'sparkle', 'Agente de IA e modelos', 'Qual serviço de IA o Agente usa e com qual modelo.'],
  ['keys', 'key', 'Chaves de API', 'As chaves do provedor de IA e do Jev. Ficam guardadas só neste computador.'],
  ['mcp', 'plug', 'MCP e agentes', 'Deixe programas como Claude Code e Codex lerem e alterarem o design.'],
  ['look', 'sliders', 'Aparência', 'Tema, tela inicial e controles do canvas.'],
  ['keyboard', 'keyboard', 'Atalhos', 'Todos os atalhos de teclado do editor.'],
  ['about', 'help', 'Sobre e suporte', 'Versão do Stylo, guias e ajuda.'],
];

/** A página aberta agora (só existe uma). */
let current = null;

/**
 * Abre a página de Configurações (ou, se já está aberta, só troca de seção).
 * @param {object} deps
 * @param {object} deps.store
 * @param {object} deps.saving   ver saving.js (refresh, server)
 * @param {object} deps.prefs    preferências (autoFolder, wheelMode, startScreen)
 * @param {() => void} deps.savePrefs
 * @param {(m: string) => void} deps.toast
 * @param {object} deps.account  conta local (account.js)
 * @param {string} [deps.section] seção para mostrar ('account', 'folder', 'ai'...)
 * @returns {{ close: () => void }}
 */
export function openSettings({ store, saving, prefs, savePrefs, toast, account, section = 'account' }) {
  if (current) { current.show(section); return current; }
  const ui = store.ui;
  const app = document.getElementById('app');
  const returnFocus = document.activeElement;
  let active = SECTIONS.some((s) => s[0] === section) ? section : 'account';

  const content = h('div.sp-inner');
  const main = h('main.sp-main', { tabindex: -1 }, content);
  const navButtons = SECTIONS.map(([id, icon, label]) => h('button.sp-nav-item', {
    type: 'button', dataset: { section: id }, 'aria-controls': `settings-${id}`,
    onclick: () => show(id, true),
  }, id === 'account' ? h('span.sp-nav-av') : ico(icon, 16), h('span', label)));
  const back = h('button.btn.sp-back', { type: 'button', onclick: () => close() }, ico('arrowLeft', 14), ' Voltar ao editor', h('kbd', 'Esc'));
  const side = h('aside.sp-side',
    h('div.sp-brand', h('img.sp-logo', { src: 'assets/logo-mark.svg', alt: '', width: 28, height: 28 }), h('div', h('strong', 'Configurações'), h('span', 'Stylo ' + VERSION))),
    back,
    h('nav.sp-nav', { 'aria-label': 'Seções das configurações' }, navButtons.slice(0, 5), h('p.sp-nav-caption', 'Editor'), navButtons.slice(5)));
  const root = h('section.settings-page', { role: 'region', 'aria-label': 'Configurações' }, side, main);

  /** Mostra uma seção (as outras ficam escondidas, mas continuam montadas: campos não salvos não se perdem). */
  function show(id, focus = false) {
    if (!SECTIONS.some((s) => s[0] === id)) id = 'account';
    active = id;
    closeInformation();
    for (const sec of content.children) sec.hidden = sec.dataset.section !== id;
    navButtons.forEach((b) => (b.dataset.section === id ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    main.scrollTop = 0;
    if (focus) content.querySelector(`#settings-${id} h2`)?.focus({ preventScroll: true });
  }

  /** Esc fecha (se não houver janela, menu ou balão de informação por cima). */
  function onKey(e) {
    if (e.key !== 'Escape' || document.querySelector('.modal-backdrop, .menu, .inspector-info')) return;
    e.preventDefault();
    e.stopPropagation();
    close();
  }

  function close() {
    if (!root.isConnected) return;
    closeInformation();
    root.remove();
    stopAccount();
    stopNav();
    window.removeEventListener('keydown', onKey);
    ui.settingsOpen = false;
    current = null;
    // o editor só volta a receber foco se a página inicial não estiver aberta por baixo
    if (!ui.homeOpen) { app.inert = false; app.removeAttribute('aria-hidden'); }
    store.emit('ui');
    if (returnFocus?.isConnected) returnFocus.focus?.();
  }

  ui.settingsOpen = true;
  app.inert = true;
  app.setAttribute('aria-hidden', 'true');
  document.body.append(root);
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- peças de layout
  /** Cabeçalho + cartões de uma seção. */
  function sectionEl(id, ...cards) {
    const [, , label, desc] = SECTIONS.find((s) => s[0] === id);
    return h('section.sp-section', { id: `settings-${id}`, dataset: { section: id }, 'aria-labelledby': `settings-${id}-title` },
      h('header.sp-head', h('h2', { id: `settings-${id}-title`, tabindex: -1 }, label), h('p', desc)),
      ...cards);
  }
  /** Cartão: título (com "i" opcional), descrição curta e o conteúdo. */
  function card(title, desc, info, ...body) {
    return h('div.sp-card',
      title ? h('div.sp-card-head', h('h3', title, info ? informationButton(title, info) : null), desc ? h('p', desc) : null) : null,
      ...body);
  }
  /** Linha rótulo/descrição à esquerda e controle à direita. */
  const row = (label, hint, ...control) => h('div.sp-row', h('div.sp-row-label', h('span.sp-label', label), hint ? h('span.sp-hint', hint) : null), h('div.sp-row-control', ...control));
  /** Bloco recolhido "Mostrar detalhes". */
  const details = (summary, ...body) => h('details.sp-details', h('summary', summary), h('div.sp-details-body', ...body));
  const radio = (group, value, label, cur, onPick) =>
    h('label.set-radio', h('input', { type: 'radio', name: group, value, checked: cur === value, onchange: () => onPick(value) }), h('span', label));
  const needServer = (what) => card('Precisa do servidor', null, null,
    h('p.sp-muted', `${what} usa o servidor do app. Abra o Stylo com `, h('code', 'npm start'), ' para ativar.'));

  // ---------------------------------------------------------------- 1. conta
  let stopAccount = () => {};
  let stopNav = () => {};
  function accountSection() {
    const acc = account.data;
    const status = h('span.sp-saved', { role: 'status' });
    const setStatus = (state, text) => { status.dataset.state = state; status.textContent = text; };
    setStatus('idle', account.server ? 'Salvo automaticamente' : 'Salvo neste navegador');
    let timer = 0;
    let pending = {};
    /** Junta mudanças e grava depois de uma pausa curta (indicador "Salvando…" → "Salvo"). */
    const queue = (patch, wait = 450) => {
      Object.assign(pending, patch);
      setStatus('saving', 'Salvando…');
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const p = pending; pending = {};
        try { await account.save(p); setStatus('saved', 'Salvo'); } catch (err) { setStatus('error', err.message || 'Não consegui salvar.'); }
      }, wait);
    };
    const field = (label, key, attrs, hint) => {
      const input = h('input.text', { type: 'text', value: acc[key] || '', spellcheck: false, 'aria-label': label, ...attrs });
      input.addEventListener('input', () => queue({ [key]: input.value }));
      return row(label, hint, h('div.field.grow', input));
    };
    const preview = h('div.sp-avatar-preview');
    const colorHint = h('span.sp-hint');
    const swatches = h('div.sp-colors', { role: 'radiogroup', 'aria-label': 'Cor do avatar' });
    const fileInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true });
    const removeBtn = h('button.btn.small', { type: 'button', onclick: () => queue({ avatar: '' }, 0) }, 'Remover foto');
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files[0];
      fileInput.value = '';
      if (!f) return;
      try { queue({ avatar: await shrinkAvatar(f) }, 0); } catch (err) { setStatus('error', err.message); }
    });
    const paint = (a) => {
      preview.replaceChildren(avatarEl(h, a, '.big'));
      swatches.replaceChildren(...ACCOUNT_COLORS.map((c) => h('button.sp-color', {
        type: 'button', role: 'radio', style: `--c: ${c}`, 'aria-label': `Cor ${c}`, 'aria-checked': String(a.color === c),
        onclick: () => queue({ color: c }, 0),
      })));
      removeBtn.style.display = a.avatar ? '' : 'none';
      colorHint.textContent = a.avatar ? 'Sua cor nos comentários e na presença:' : 'Sem foto, o avatar mostra as suas iniciais nesta cor:';
    };
    paint(acc);
    stopAccount = account.onChange((a) => paint(a));
    const lang = h('select.select', { 'aria-label': 'Idioma' },
      [['pt-BR', 'Português (Brasil)'], ['en', 'English'], ['es', 'Español']].map(([v, l]) => h('option', { value: v, selected: acc.language === v }, l)));
    lang.addEventListener('change', () => queue({ language: lang.value }, 0));
    const created = acc.createdAt ? new Date(acc.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
    return sectionEl('account',
      card('Perfil', null,
        'Esta é uma conta LOCAL, sem senha: o Stylo roda no seu computador e o perfil fica num arquivo ao lado da configuração do servidor (designer.account.json). Nada é enviado para a internet.',
        h('div.sp-profile', preview,
          h('div.sp-profile-actions',
            h('div.sp-profile-buttons', h('button.btn.small', { type: 'button', onclick: () => fileInput.click(), disabled: !account.server }, ico('upload', 13), ' Enviar foto'), removeBtn, fileInput),
            colorHint,
            swatches)),
        field('Nome', 'name', { placeholder: 'Como você quer aparecer', maxLength: 60 }, 'Assina os comentários e aparece na presença'),
        account.server ? field('E-mail', 'email', { type: 'email', placeholder: 'opcional', maxLength: 120 }, 'Opcional. Só fica aqui.') : null,
        account.server ? field('Cargo ou função', 'role', { placeholder: 'ex.: Designer de produto', maxLength: 60 }) : null,
        account.server ? row('Idioma', 'A interface ainda está só em português', h('div.field.select-wrap', lang, ico('chevron', 12))) : null,
        h('div.sp-card-foot', status, created ? h('span.sp-hint', `Conta criada em ${created}`) : null)),
      account.server ? null : card(null, null, null, h('p.sp-muted', 'Sem o servidor (', h('code', 'npm start'), '), só o nome e a cor ficam guardados, neste navegador.')));
  }

  // ---------------------------------------------------------------- 2. pasta e cópias
  function folderSection(server, usage, persisted) {
    const protect = h('button.btn', {
      type: 'button', disabled: persisted,
      onclick: async () => {
        const ok = await requestPersistence();
        toast(ok ? 'Pronto: o navegador não vai apagar a cópia sozinho.' : 'O navegador recusou (ele decide com base no uso do site).');
        render();
      },
    }, persisted ? 'Protegida' : 'Proteger contra limpeza');
    const browserCard = card('Cópia no navegador', `Sempre ligada: cada mudança também fica guardada no navegador (${usage.engine}).`,
      'Ela some se você limpar os dados do site ou trocar de navegador. Para guardar de verdade, use a pasta de projetos.',
      row('Espaço usado', usage.usage != null ? formatBytes(usage.usage) : 'desconhecido', protect));
    if (!server) {
      return sectionEl('folder',
        card('Pasta de projetos', null, null,
          h('p.set-status.off', '● Sem servidor'),
          h('p.sp-muted', 'Para salvar numa pasta do seu computador, abra o app com ', h('code', 'npm start'),
            '. Do jeito que está, o projeto fica só no navegador, e "Salvar" baixa um arquivo .json.')),
        browserCard);
    }
    const pathInput = h('input.text.mono', { type: 'text', value: server.folder, spellcheck: false, 'aria-label': 'Caminho da pasta de projetos' });
    const msg = h('p.set-msg', { role: 'status' });
    const apply = h('button.btn', {
      type: 'button',
      onclick: async () => {
        apply.disabled = true;
        msg.className = 'set-msg';
        msg.textContent = 'Verificando a pasta…';
        try {
          await folder.setConfig({ folder: pathInput.value });
          // o projeto aberto estava ligado a um arquivo da pasta ANTIGA: desliga (senão gravaria um arquivo com o mesmo
          // nome na pasta nova sem você pedir). Ele continua salvo no navegador; use Ctrl+S para pôr na pasta nova.
          if (ui.link) store.setLink(null);
          toast('Pasta de projetos alterada.');
          render();
        } catch (err) {
          msg.className = 'set-msg error';
          msg.textContent = err.message || 'Não consegui usar essa pasta.';
          apply.disabled = false;
        }
      },
    }, 'Usar esta pasta');
    pathInput.addEventListener('keydown', (e) => e.key === 'Enter' && apply.click());

    const versions = h('input.text', { type: 'number', min: 0, max: 200, value: server.keepVersions, 'aria-label': 'Quantidade de versões guardadas', style: { width: '72px' } });
    versions.addEventListener('change', async () => {
      try {
        const r = await folder.setConfig({ keepVersions: Number(versions.value) });
        versions.value = r.keepVersions;
        toast(r.keepVersions ? `Guardando até ${r.keepVersions} versões por projeto.` : 'Versões antigas desligadas.');
      } catch (err) { toast(err.message); }
    });

    return sectionEl('folder',
      card('Pasta de projetos', 'Os projetos são gravados como arquivos .json nesta pasta do computador.',
        'Use o caminho completo (ex.: C:\\Users\\voce\\Documents\\Stylo, /home/voce/Stylo ou ~/Stylo); a pasta é criada se não existir. '
          + 'Quer cópia na nuvem? Instale o Google Drive para computador (ou OneDrive, Dropbox) e escolha uma pasta DENTRO dele, como G:\\Meu Drive\\Stylo: o próprio programa sobe os arquivos. '
          + 'Se o mesmo projeto for aberto em dois computadores, o editor percebe que o arquivo mudou e para de gravar nele em vez de apagar o trabalho do outro.',
        h('p.set-status.on', '● Servidor conectado'),
        h('div.set-path', h('div.field', pathInput), apply),
        msg),
      card('Salvamento', null, null,
        row('Auto-salvar na pasta', 'Grava enquanto você edita', checkbox('Ligado', prefs.autoFolder !== false, (v) => {
          prefs.autoFolder = v;
          savePrefs();
          toast(v ? 'Auto-salvar na pasta ligado.' : 'Auto-salvar na pasta desligado: use Ctrl+S para gravar.');
        })),
        row('Versões antigas', '0 = não guardar', h('div.field', versions), h('span.sp-hint', 'por projeto'),
          informationButton('Versões antigas', 'No máximo uma versão a cada 10 minutos de edição. Abra-as em Arquivo → Abrir da pasta → Versões.'))),
      browserCard);
  }

  // ---------------------------------------------------------------- 3 e 4. agente de IA e chaves
  /** Monta as seções de IA e de chaves juntas: "Ver modelos" usa a chave digitada na seção de chaves. */
  function aiSections(ai) {
    if (!ai) return [sectionEl('ai', needServer('O Agente de IA')), sectionEl('keys', needServer('Guardar a chave'))];
    const msg = h('p.set-msg', { role: 'status' });
    const keyMsg = h('p.set-msg', { role: 'status' });
    const prov = PROVIDERS.find((x) => x.id === ai.provider) || null;
    /** Grava no servidor e redesenha (a chave só vai quando você digita uma nova). */
    const save = async (patch, done = 'Agente configurado.', out = msg) => {
      try {
        await putConfig(patch);
        toast(done);
        render();
      } catch (err) { out.className = 'set-msg error'; out.textContent = err.message || 'Não consegui salvar.'; }
    };
    /** Grava sem redesenhar a página (para não sumir com a lista de modelos aberta). */
    const putConfig = async (patch) => {
      const r = await fetch('/api/agent/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      return data;
    };
    // PROVEDOR: escolher um já grava endereço e modelo sugerido (a chave de cada provedor fica guardada separada)
    const provSel = h('select.select', { 'aria-label': 'Provedor de IA' },
      ...PROVIDERS.map((x) => h('option', { value: x.id, selected: ai.provider === x.id }, x.name)),
      h('option', { value: 'custom', selected: ai.provider === 'custom' }, 'Outro (compatível com a OpenAI)'));
    provSel.addEventListener('change', () => {
      const x = PROVIDERS.find((p) => p.id === provSel.value);
      if (x) save({ baseUrl: x.baseUrl, model: x.model }, `Provedor: ${x.name}.`);
      else { advanced.open = true; base.focus(); base.select(); }
    });
    const key = h('input.text.mono', { type: 'password', placeholder: ai.hasKey ? '•••••••• (chave salva)' : prov?.keyHint || 'chave da API', autocomplete: 'off', spellcheck: false, 'aria-label': 'Chave da API' });
    const model = h('input.text.mono', { type: 'text', value: ai.model, spellcheck: false, 'aria-label': 'Modelo' });
    const base = h('input.text.mono', { type: 'text', value: ai.baseUrl, spellcheck: false, 'aria-label': 'Endereço da API' });
    const saveBtn = h('button.btn.primary', { type: 'button', onclick: () => save({ model: model.value, baseUrl: base.value, ...(key.value.trim() ? { apiKey: key.value.trim() } : {}) }) }, 'Salvar');
    const saveKey = h('button.btn.primary', { type: 'button', onclick: () => key.value.trim() && save({ apiKey: key.value.trim() }, 'Chave salva.', keyMsg) }, 'Salvar chave');
    const forget = ai.hasKey ? h('button.btn', { type: 'button', onclick: () => save({ apiKey: '' }, 'Chave apagada.', keyMsg) }, 'Apagar chave') : null;
    key.addEventListener('keydown', (e) => e.key === 'Enter' && saveKey.click());
    // LISTA DE MODELOS (aparece depois de "Ver modelos"): busca + lista clicável. Uma lista de verdade, e não o
    // <datalist> do navegador, que só mostra o que combina com o texto já escrito no campo (escondia quase tudo).
    const picker = h('div.model-picker', { hidden: true });
    function showPicker(list) {
      const search = h('input.text', { type: 'search', placeholder: `Buscar entre ${list.length} modelos… (ex.: llama, qwen, deepseek)`, 'aria-label': 'Buscar modelo', spellcheck: false });
      const box = h('div.model-list', { role: 'listbox', 'aria-label': 'Modelos disponíveis' });
      const fill = () => {
        const q = search.value.trim().toLowerCase();
        const shown = list.filter((m) => !q || m.toLowerCase().includes(q));
        // modelos já testados aparecem primeiro, com o selo do resultado
        shown.sort((x, y) => (tested[y]?.ok ? 2 : tested[y] ? 1 : 0) - (tested[x]?.ok ? 2 : tested[x] ? 1 : 0));
        box.replaceChildren(...shown.slice(0, 300).map((m) => h('button.model-item' + (m === model.value ? '.on' : '') + (tested[m] ? (tested[m].ok ? '.tested-ok' : '.tested-bad') : ''), {
          type: 'button', role: 'option', 'aria-selected': String(m === model.value), title: tested[m]?.error || '',
          onclick: async () => {
            try {
              await putConfig({ model: m });
              model.value = m;
              msg.className = 'set-msg';
              msg.textContent = `Modelo escolhido: ${m}. Lembre: ele precisa aceitar ferramentas ("tool calling") para mexer no design.`;
              toast('Modelo salvo.');
              fill();
            } catch (err) { msg.className = 'set-msg error'; msg.textContent = err.message; }
          },
        }, h('span.model-name', m), tested[m] ? h('span.model-badge', testBadge(tested[m])) : '')), ...(shown.length ? [] : [h('p.muted.small', 'Nenhum modelo com esse nome.')])); // nada de null: replaceChildren escreveria "null"
      };
      search.addEventListener('input', fill);
      picker.replaceChildren(h('div.field', search), box);
      picker.hidden = false;
      fill();
      search.focus();
    }
    // VER MODELOS: grava antes o que foi digitado (endereço e chave nova), pergunta à API quais modelos a conta tem
    // e mostra a lista. De quebra, testa a chave.
    const listBtn = h('button.btn', {
      type: 'button',
      onclick: async () => {
        listBtn.disabled = true;
        msg.className = 'set-msg';
        msg.textContent = 'Consultando os modelos…';
        try {
          const typed = key.value.trim();
          await putConfig({ baseUrl: base.value, ...(typed ? { apiKey: typed } : {}) });
          if (typed) { key.value = ''; key.placeholder = '•••••••• (chave salva)'; }
          const r = await fetch('/api/agent/models');
          const data = await r.json();
          if (!r.ok) throw new Error(data.error);
          if (!data.models.length) throw new Error('A API não devolveu nenhum modelo.');
          msg.textContent = `A chave funciona: ${data.models.length} modelos. Clique em um para escolher.`;
          showPicker(data.models);
        } catch (err) { msg.className = 'set-msg error'; msg.textContent = err.message || 'Não consegui listar os modelos.'; }
        listBtn.disabled = false;
      },
    }, 'Ver modelos');
    // TESTAR MODELO: o servidor pede ao modelo para chamar uma ferramenta "ping" e mede o tempo até o 1º pedaço. O
    // resultado fica guardado no servidor e marca o modelo na lista ("✓ ferramentas · 1,2 s").
    const tested = { ...(ai.tested || {}) };
    const testedList = h('div.model-tested');
    const renderTested = () => {
      const rows = Object.values(tested).sort((x, y) => y.at - x.at).slice(0, 8);
      testedList.replaceChildren(...(rows.length ? [h('p.sp-label.small', 'Modelos testados'), ...rows.map((t) => h('div.model-test-row' + (t.ok ? '.ok' : '.bad'),
        h('code', t.model), h('span.model-badge', testBadge(t)),
        h('span.sp-hint', t.ok ? `total ${formatSecs(t.totalMs)}` : (t.error || '').slice(0, 90)),
        h('div.spacer'),
        t.model === model.value ? h('span.sp-hint', 'em uso') : h('button.btn.small', { type: 'button', onclick: async () => {
          try { await putConfig({ model: t.model }); model.value = t.model; toast(`Modelo: ${t.model}.`); renderTested(); } catch (err) { msg.className = 'set-msg error'; msg.textContent = err.message; }
        } }, 'Usar')))] : []));
    };
    renderTested();
    const testBtn = h('button.btn', {
      type: 'button', title: 'Mede o tempo até o 1º pedaço da resposta e se o modelo chama ferramentas',
      onclick: async () => {
        const m = model.value.trim();
        if (!m) return;
        testBtn.disabled = true;
        msg.className = 'set-msg';
        const t0 = Date.now();
        msg.textContent = `Testando “${m}”…`;
        const tick = setInterval(() => { msg.textContent = `Testando “${m}”… ${Math.round((Date.now() - t0) / 1000)} s`; }, 1000);
        try {
          const typed = key.value.trim();
          await putConfig({ baseUrl: base.value, ...(typed ? { apiKey: typed } : {}) });
          if (typed) { key.value = ''; key.placeholder = '•••••••• (chave salva)'; }
          const r = await fetch('/api/agent/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: m }) });
          const t = await r.json();
          if (!r.ok) throw new Error(t.error);
          tested[m] = t;
          msg.className = t.ok ? 'set-msg ok' : 'set-msg error';
          msg.textContent = t.ok
            ? `“${m}” funciona: aceita ferramentas, 1º pedaço em ${formatSecs(t.firstTokenMs)}, total ${formatSecs(t.totalMs)}${t.reasoning ? ' (raciocina antes de responder)' : ''}.`
            : `“${m}” não serve para o agente: ${t.error}`;
          renderTested();
          if (!picker.hidden) picker.querySelector('input')?.dispatchEvent(new Event('input'));
        } catch (err) { msg.className = 'set-msg error'; msg.textContent = err.message || 'Não consegui testar.'; }
        clearInterval(tick);
        testBtn.disabled = false;
      },
    }, 'Testar modelo');
    // TEMPOS E RACIOCÍNIO: gravam sozinhos ao mudar
    const numField = (label, keyName, value, min, max) => {
      const input = h('input.text', { type: 'number', min, max, value, 'aria-label': label, style: { width: '84px' } });
      input.addEventListener('change', async () => {
        try { await putConfig({ [keyName]: input.value === '' ? '' : Number(input.value) }); toast('Salvo.'); } catch (err) { toast(err.message); }
      });
      return input;
    };
    const timing = card('Tempo e raciocínio', 'Para o agente nunca ficar travado esperando.',
      'A resposta chega em tempo real. Se o modelo não mandar nada no tempo do 1º pedaço, o agente para e avisa. Modelos de raciocínio (DeepSeek-R1, Qwen3, Nemotron) podem pensar por minutos: o “tempo máximo pensando” corta isso. “Pedir menos raciocínio” manda à NVIDIA NIM o parâmetro de cada modelo para pensar menos (chat_template_kwargs, “detailed thinking off”, /no_think ou reasoning_effort).',
      row('Esperar o 1º pedaço', 'Segundos sem resposta até desistir', h('div.field', numField('Esperar o 1º pedaço (segundos)', 'firstTokenSec', ai.firstTokenSec ?? 60, 5, 600)), h('span.sp-hint', 's')),
      row('Tempo máximo pensando', 'Só raciocínio, sem responder', h('div.field', numField('Tempo máximo pensando (segundos)', 'maxThinkSec', ai.maxThinkSec ?? 120, 10, 1800)), h('span.sp-hint', 's')),
      row('Pedir menos raciocínio', 'NVIDIA NIM: pede ao modelo para pensar menos', checkbox('Ligado', ai.limitReasoning !== false, async (v) => {
        try { await putConfig({ limitReasoning: v }); toast(v ? 'O agente vai pedir menos raciocínio.' : 'Raciocínio livre.'); } catch (err) { toast(err.message); }
      })),
      row('Limite da resposta (NIM)', 'max_tokens; 0 = sem limite', h('div.field', numField('Limite de tokens da resposta', 'maxTokens', ai.maxTokens ?? 4096, 0, 65536)), h('span.sp-hint', 'tokens')));
    const advanced = details('Avançado: endereço da API',
      row('Endereço da API', 'Qualquer servidor compatível com a API da OpenAI', h('div.field.grow', base)),
      h('p.sp-muted.small', 'Funciona com LM Studio, Ollama, OpenRouter, Groq e outros que falam Chat Completions com ferramentas.'));
    const providerName = prov ? prov.name : 'provedor personalizado';
    return [
      sectionEl('ai',
        card('Provedor e modelo', 'O Agente (botão ✦ no topo) conversa com a IA usando a sua chave.',
          `O que a IA sabe sobre a ferramenta e como ela deve trabalhar está no arquivo ${ai.instructions || 'docs/AGENTE.md'}. Edite à vontade: vale na próxima mensagem.`,
          row('Provedor', null, h('div.field.select-wrap', provSel, ico('chevron', 12))),
          row('Modelo', 'Precisa aceitar ferramentas (tool calling)', h('div.field.grow', model), listBtn, testBtn),
          picker,
          testedList,
          advanced,
          h('div.sp-card-foot', msg, h('div.spacer'), saveBtn)),
        timing,
        ai.hasKey ? null : card(null, null, null, h('p.sp-muted', 'Falta a chave de API. ', h('button.link', { type: 'button', onclick: () => show('keys', true) }, 'Adicionar chave →')))),
      sectionEl('keys',
        card(`Chave do ${providerName}`, ai.hasKey ? 'Há uma chave salva para este provedor.' : 'Nenhuma chave salva para este provedor ainda.',
          'A chave fica guardada só neste computador, no arquivo de configuração do servidor, e nunca vai para o projeto nem volta para o navegador. Cada provedor tem a própria chave. Ela também pode vir de uma variável de ambiente (ex.: OPENAI_API_KEY).',
          row('Chave da API', prov ? `Crie em ${prov.keyUrl}` : null, h('div.field.grow', key)),
          prov?.note ? h('p.sp-muted.small', prov.note) : null,
          h('div.sp-card-foot', keyMsg, h('div.spacer'), forget, saveKey)),
        jevCard()),
    ];
    /** CHAVE DO JEV (TypeSafe): liga as ferramentas jev_choose / jev_score / jev_check do agente. */
    function jevCard() {
      const jevMsg = h('p.set-msg', { role: 'status' });
      const jevKey = h('input.text.mono', { type: 'password', placeholder: ai.jev ? '•••••••• (chave salva)' : 'chave da TypeSafe', autocomplete: 'off', spellcheck: false, 'aria-label': 'Chave do Jev' });
      const saveJev = h('button.btn.primary', { type: 'button', onclick: () => jevKey.value.trim() && save({ jevKey: jevKey.value.trim() }, 'Chave do Jev salva: o agente já pode usar o Jev.', jevMsg) }, 'Salvar chave');
      jevKey.addEventListener('keydown', (e) => e.key === 'Enter' && saveJev.click());
      const forgetJev = ai.jevSource === 'config' ? h('button.btn', { type: 'button', onclick: () => save({ jevKey: '' }, 'Chave do Jev apagada.', jevMsg) }, 'Apagar chave') : null;
      return card('Chave do Jev (TypeSafe)', ai.jev ? (ai.jevSource === 'env' ? 'Ligado pela variável de ambiente JEV_API_KEY.' : 'Ligado: o agente pode pedir uma segunda opinião ao Jev.') : 'Opcional. Sem a chave, o agente não usa o Jev.',
        'O Jev é um modelo rápido e barato que não escreve texto: ele escolhe entre opções, dá nota numa rubrica e confere se uma evidência sustenta uma afirmação. O agente usa como segunda opinião (ferramentas jev_choose, jev_score e jev_check). A chave fica só no servidor, nunca volta ao navegador. Também pode vir da variável de ambiente JEV_API_KEY.',
        row('Chave do Jev', 'Crie em console.typesafe.ai', h('div.field.grow', jevKey)),
        h('div.sp-card-foot', jevMsg, h('div.spacer'), forgetJev, saveJev));
    }
  }

  // ---------------------------------------------------------------- 5. MCP
  function mcpSection(ai) {
    if (!ai) return sectionEl('mcp', needServer('O MCP'));
    const copy = (text) => h('button.btn.small', { type: 'button', onclick: () => navigator.clipboard?.writeText(text).then(() => toast('Copiado.')) }, 'Copiar');
    const cmd = (label, text) => h('div.set-cmd', label ? h('span.set-label', label) : null, h('code', text), copy(text));
    return sectionEl('mcp',
      card('Conexão', 'Com o app aberto no navegador, esses programas conseguem ler e alterar o design.', null,
        row('Editores conectados', null, ai.editors
          ? h('span.set-badge.on', `● ${ai.editors} editor${ai.editors > 1 ? 'es' : ''} conectado${ai.editors > 1 ? 's' : ''}`)
          : h('span.set-badge.off', '● nenhum editor conectado')),
        // ACESSO DE ADMINISTRADOR: programas deste computador agem sem perguntar e mexem nos arquivos de projeto
        row('Acesso de administrador', 'O MCP altera sem perguntar e pode abrir, salvar e criar projetos',
          checkbox('Ativar', !!ai.mcpAdmin, async (v) => {
            try {
              const r = await fetch('/api/agent/mcp', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin: v }) });
              if (!r.ok) throw new Error((await r.json()).error);
              toast(v ? 'MCP com acesso de administrador.' : 'MCP volta a pedir permissão a cada alteração.');
            } catch (err) { toast(err.message || 'Não consegui salvar.'); }
          }),
          informationButton('Acesso de administrador', 'Só vale para programas deste computador (o endereço do MCP não aceita pedidos de fora). Tudo continua saindo com Ctrl+Z, e um aviso mostra cada alteração.'))),
      card('Instalar no Claude Code, Codex ou Claude Desktop', 'Copie o comando do programa que você usa.', null,
        details('Mostrar comandos',
          cmd('Plugin do Claude Code', '/plugin marketplace add Kaykygnb/projetodesigner2'),
          cmd('', '/plugin install projeto-designer@projeto-designer'),
          cmd('Claude Code (sem plugin)', `claude mcp add --transport http designer ${ai.mcpUrl}`),
          cmd('Codex / Claude Desktop', `node "${ai.mcpScript}"`),
          h('p.sp-muted.small', 'Guia completo (Claude, Codex/GPT e ChatGPT): ', h('code', 'docs/MCP.md'), '. No Codex: em ', h('code', '~/.codex/config.toml'), ' crie ', h('code', '[mcp_servers.designer]'), ' com ', h('code', 'command = "node"'), ' e ',
            h('code', `args = ["${ai.mcpScript.replace(/\\/g, '\\\\')}"]`), '. No Claude Desktop: Configurações → Desenvolvedor → Editar configuração, em ', h('code', 'mcpServers'), '.'))));
  }

  // ---------------------------------------------------------------- 6. aparência
  function lookSection() {
    return sectionEl('look',
      card('Tema', null, null,
        h('div.sp-choices', { role: 'radiogroup', 'aria-label': 'Tema' },
          radio('theme', 'dark', 'Escuro', ui.theme, (v) => store.setTheme(v)),
          radio('theme', 'light', 'Claro', ui.theme, (v) => store.setTheme(v)))),
      card('Ao abrir o app', null, null,
        h('div.sp-choices', { role: 'radiogroup', 'aria-label': 'Ao abrir o app' },
          radio('start', 'home', 'Mostrar a página inicial', prefs.startScreen || 'home', (v) => { prefs.startScreen = v; savePrefs(); }),
          radio('start', 'editor', 'Ir direto para o editor', prefs.startScreen || 'home', (v) => { prefs.startScreen = v; savePrefs(); }))),
      card('Roda do mouse', null, null,
        h('div.sp-choices', { role: 'radiogroup', 'aria-label': 'Roda do mouse' },
          radio('wheel', 'pan', 'Rola o canvas (Ctrl + roda = zoom)', ui.wheelMode || 'pan', (v) => { ui.wheelMode = v; prefs.wheelMode = v; savePrefs(); }),
          radio('wheel', 'zoom', 'Dá zoom', ui.wheelMode || 'pan', (v) => { ui.wheelMode = v; prefs.wheelMode = v; savePrefs(); }))));
  }

  // ---------------------------------------------------------------- 7. atalhos
  function keysSection() {
    return sectionEl('keyboard', h('div.sp-shortcuts', SHORTCUTS.map(([title, rows]) =>
      card(title, null, null, h('div.sp-sc', rows.map(([k, d]) => h('div.sc-row', h('span', d), h('kbd', k))))))));
  }

  // ---------------------------------------------------------------- 8. sobre
  function aboutSection(server) {
    const help = (tab, icon, label, desc) => h('button.sp-help', { type: 'button', onclick: () => showHelp(tab, VERSION) }, ico(icon, 18), h('span', h('strong', label), h('span', desc)));
    return sectionEl('about',
      card(null, null, null,
        h('div.sp-about',
          h('img', { src: 'assets/logo.svg', alt: 'Stylo', class: 'sp-about-logo' }),
          h('div', h('strong', `Versão ${VERSION}`), h('p.sp-muted', 'Editor de design local onde o canvas é HTML e CSS de verdade.'),
            h('p.sp-muted.small', server ? '● Servidor local conectado' : '● Sem servidor (projetos só no navegador)')))),
      card('Central de ajuda', null, null,
        h('div.sp-help-grid',
          help('start', 'star', 'Primeiros passos', 'Como montar uma tela'),
          help('keys', 'keyboard', 'Atalhos', 'Lista completa'),
          help('faq', 'help', 'Problemas comuns', 'Soluções rápidas'),
          help('support', 'comment', 'Suporte', 'Como pedir ajuda'))));
  }

  /** Redesenha o conteúdo (ao abrir e depois de cada mudança que o servidor confirma). */
  async function render() {
    const server = await saving.refresh();
    const [usage, persisted, ai] = await Promise.all([
      browserUsage(),
      navigator.storage?.persisted?.().catch(() => false),
      server ? fetch('/api/agent/config').then((r) => r.json()).catch(() => null) : null,
    ]);
    if (!root.isConnected) return;
    const scrollTop = main.scrollTop;
    const focusedLabel = content.contains(document.activeElement) ? document.activeElement.getAttribute('aria-label') : null;
    stopAccount();
    content.replaceChildren(accountSection(), folderSection(server, usage, persisted), ...aiSections(ai), mcpSection(ai), lookSection(), keysSection(), aboutSection(server));
    show(active);
    main.scrollTop = scrollTop;
    if (focusedLabel) [...content.querySelectorAll('[aria-label]')].find((el) => el.getAttribute('aria-label') === focusedLabel)?.focus({ preventScroll: true });
  }

  // avatar da conta na barra lateral (acompanha as mudanças do perfil)
  const navAv = navButtons[0].querySelector('.sp-nav-av');
  const paintNav = () => navAv.replaceChildren(avatarEl(h, account.data, '.tiny'));
  paintNav();
  stopNav = account.onChange(paintNav);
  content.append(h('p.sp-muted', { role: 'status' }, 'Carregando preferências…'));
  current = { show, close };
  render().then(() => back.focus());
  return current;
}

/** A página de Configurações está aberta? */
export const settingsOpen = () => !!current;
