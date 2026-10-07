/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/settings.js — JANELA "CONFIGURAÇÕES" (onde salvar, versões, cópia no navegador, aparência)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Aberta pela engrenagem do topo, por Arquivo → Configurações ou Ctrl+, (vírgula).
 *  Seções:
 *   1. Pasta de projetos  — caminho no computador (o SERVIDOR grava lá), auto-salvar e nº de versões.
 *      Explica como usar Google Drive/OneDrive/Dropbox: escolher uma pasta sincronizada por eles.
 *   2. Cópia no navegador — sempre ligada (IndexedDB); mostra o espaço e pede proteção contra limpeza.
 *   3. Aparência e controles — tema e o que a roda do mouse faz.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { openModal } from './menus.js';
import { browserUsage, requestPersistence, folder } from '../storage.js';

/** "12345678" bytes → "11,8 MB". */
export const formatBytes = (b) =>
  b == null ? '?' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

/** Caixa de seleção no estilo do app (a mesma de props.js). */
const checkbox = (label, checked, onchange) => {
  const input = h('input', { type: 'checkbox', checked, onchange: () => onchange(input.checked) });
  return h('label.check', input, h('span.box', ico('check', 10)), h('span', label));
};

/**
 * Abre a janela de Configurações.
 * @param {object} deps
 * @param {object} deps.store
 * @param {object} deps.saving   ver saving.js (refresh, server)
 * @param {object} deps.prefs    preferências (autoFolder, wheelMode)
 * @param {() => void} deps.savePrefs
 * @param {(m: string) => void} deps.toast
 */
export function openSettings({ store, saving, prefs, savePrefs, toast }) {
  const ui = store.ui;
  const body = h('div.modal-body.settings');
  const { close } = openModal({ title: 'Configurações', body, cls: 'narrow' });

  /** Redesenha o conteúdo (chamado ao abrir e depois de cada mudança que o servidor confirma). */
  async function render() {
    const server = await saving.refresh();
    const usage = await browserUsage();
    const persisted = await navigator.storage?.persisted?.().catch(() => false);
    body.replaceChildren(folderSection(server), browserSection(usage, persisted), lookSection());
  }

  // ---------------------------------------------------------------- 1. pasta
  function folderSection(server) {
    if (!server) {
      return h('section.set-section',
        h('h3', ico('folder', 15), ' Pasta de projetos'),
        h('p.set-status.off', '● Sem servidor'),
        h('p.muted', 'Para salvar numa pasta do seu computador, abra o app com ', h('code', 'npm start'),
          ' (o servidor do projeto). Do jeito que está, o projeto fica só no navegador, e "Salvar" baixa um arquivo .json.'));
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

    const versions = h('input.text', { type: 'number', min: 0, max: 200, value: server.keepVersions, 'aria-label': 'Quantidade de versões guardadas', style: { width: '64px' } });
    versions.addEventListener('change', async () => {
      try {
        const r = await folder.setConfig({ keepVersions: Number(versions.value) });
        versions.value = r.keepVersions;
        toast(r.keepVersions ? `Guardando até ${r.keepVersions} versões por projeto.` : 'Versões antigas desligadas.');
      } catch (err) { toast(err.message); }
    });

    return h('section.set-section',
      h('h3', ico('folder', 15), ' Pasta de projetos'),
      h('p.set-status.on', '● Servidor conectado — projetos são gravados como arquivos .json nesta pasta:'),
      h('div.set-path', h('div.field', pathInput), apply),
      msg,
      h('p.muted.small', 'Caminho completo. Exemplos: ', h('code', 'C:\\Users\\voce\\Documents\\Designer'), ' · ',
        h('code', '/home/voce/Designer'), ' · ', h('code', '~/Designer'), '. A pasta é criada se não existir.'),
      h('div.set-tip',
        h('strong', 'Quer cópia na nuvem (Google Drive)?'),
        h('p', 'Instale o ', h('em', 'Google Drive para computador'), ' e escolha aqui uma pasta DENTRO dele (no Windows costuma ser ',
          h('code', 'G:\\Meu Drive\\Designer'), '). O próprio Drive sobe os arquivos para a nuvem; funciona igual com OneDrive e Dropbox.'),
        h('p.muted.small', 'Se abrir o mesmo projeto em dois computadores ao mesmo tempo, o editor percebe que o arquivo mudou e para de gravar nele em vez de apagar o trabalho do outro.')),
      h('div.set-row', checkbox('Salvar automaticamente na pasta enquanto edito', prefs.autoFolder !== false, (v) => {
        prefs.autoFolder = v;
        savePrefs();
        toast(v ? 'Auto-salvar na pasta ligado.' : 'Auto-salvar na pasta desligado: use Ctrl+S para gravar.');
      })),
      h('div.set-row', h('span', 'Guardar até'), h('div.field', versions), h('span', 'versões antigas de cada projeto')),
      h('p.muted.small', 'No máximo uma versão a cada 10 minutos de edição. Abra-as em Arquivo → Abrir da pasta → Versões. 0 = não guardar.'));
  }

  // ---------------------------------------------------------------- 2. navegador
  function browserSection(usage, persisted) {
    const protect = h('button.btn', {
      type: 'button', disabled: persisted,
      onclick: async () => {
        const ok = await requestPersistence();
        toast(ok ? 'Pronto: o navegador não vai apagar a cópia sozinho.' : 'O navegador recusou (ele decide com base no uso do site).');
        render();
      },
    }, persisted ? 'Protegida' : 'Proteger contra limpeza automática');
    return h('section.set-section',
      h('h3', ico('layers', 15), ' Cópia no navegador'),
      h('p', 'Sempre ligada. A cada mudança o projeto aberto é guardado no navegador (', usage.engine, '), mesmo sem servidor. ',
        usage.usage != null ? `Usando ${formatBytes(usage.usage)}.` : ''),
      h('p.muted.small', 'Ela some se você limpar os dados do site ou trocar de navegador. Para guardar de verdade, use a pasta acima.'),
      h('div.set-row', protect));
  }

  // ---------------------------------------------------------------- 3. aparência
  function lookSection() {
    const opt = (group, value, label, current, onPick) =>
      h('label.set-radio', h('input', { type: 'radio', name: group, value, checked: current === value, onchange: () => onPick(value) }), h('span', label));
    return h('section.set-section',
      h('h3', ico('sliders', 15), ' Aparência e controles'),
      h('div.set-row', { role: 'radiogroup', 'aria-label': 'Tema' }, h('span.set-label', 'Tema'),
        opt('theme', 'dark', 'Escuro', ui.theme, (v) => store.setTheme(v)),
        opt('theme', 'light', 'Claro', ui.theme, (v) => store.setTheme(v))),
      h('div.set-row', { role: 'radiogroup', 'aria-label': 'Roda do mouse' }, h('span.set-label', 'Roda do mouse'),
        opt('wheel', 'pan', 'Rola o canvas (Ctrl + roda = zoom)', ui.wheelMode || 'pan', (v) => { ui.wheelMode = v; prefs.wheelMode = v; savePrefs(); }),
        opt('wheel', 'zoom', 'Dá zoom', ui.wheelMode || 'pan', (v) => { ui.wheelMode = v; prefs.wheelMode = v; savePrefs(); })));
  }

  body.append(h('p.muted', 'Carregando…'));
  render();
  return { close };
}
