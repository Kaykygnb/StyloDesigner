/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/projects.js — JANELA "PROJETOS NA PASTA" (salvar com nome, abrir, versões antigas)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Aberta por Arquivo → Abrir da pasta (Ctrl+O), por Ctrl+S na primeira vez (para dar um nome) e por
 *  Arquivo → Salvar como (Ctrl+Shift+S).
 *  Em cima: campo "Salvar como" com o nome do arquivo. Embaixo: os projetos da pasta, do mais recente ao mais
 *  antigo, com "Abrir" e "Versões" (as cópias antigas que o servidor guarda; dá para abrir qualquer uma).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { openModal } from './menus.js';
import { folder, fileNameFor, listLocalProjects, openLocalProject, deleteLocalProject, isActiveLocalProject } from '../storage.js';
import { saveProject } from '../export.js';
import { formatBytes } from './settings.js';

/** Data relativa curta: "agora", "há 5 min", "há 3 h", ou a data/hora completa. */
function when(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Abre a janela.
 * @param {object} deps
 * @param {object} deps.store
 * @param {object} deps.saving     ver saving.js
 * @param {object} deps.canvas     para "ajustar tudo" depois de abrir
 * @param {(m: string) => void} deps.toast
 * @param {() => void} deps.openSettings
 * @param {(q: string) => Promise<boolean>} [deps.confirmReplace]  pergunta antes de trocar o projeto aberto (main.js)
 * @param {'open'|'save'} [deps.mode='open']  'save' = o foco vai para o nome (Ctrl+S / Salvar como)
 */
export function openProjects({ store, saving, canvas, toast, openSettings, confirmReplace = async () => true, mode = 'open' }) {
  const body = h('div.modal-body.projects');
  const { close } = openModal({ title: mode === 'save' ? 'Salvar na pasta' : 'Projetos na pasta', body });

  async function render() {
    const server = await saving.refresh();
    const localProjects = await listLocalProjects();
    const localRows = localProjects.map((project) => {
      const row = h('li.proj-row',
        h('div.proj-main',
          h('div.proj-info', h('strong', project.name),
            h('span.muted.small', `${project.conflict ? 'Rascunho de conflito' : 'Cópia local'} · ${when(project.savedAt)}`)),
          h('button.btn.small', { type: 'button', onclick: async () => {
            if (!(await confirmReplace(`Abrir a cópia local "${project.name}"?`))) return;
            try {
              const record = await openLocalProject(project.key);
              store.loadDoc(record.doc, { views: record.views, theme: record.theme, link: null });
              canvas.fit(null);
              toast(`Cópia local "${project.name}" aberta.`);
              close();
            } catch (err) { toast(err.message || 'Não consegui abrir a cópia local.'); }
          } }, 'Abrir'),
          h('button.btn.ghost.small', { type: 'button', 'aria-label': `Apagar ${project.name}`,
            onclick: async () => {
              if (!window.confirm(`Apagar a cópia local "${project.name}"?`)) return;
              try { await deleteLocalProject(project.key); await render(); }
              catch (err) { toast(err.message || 'Não consegui apagar a cópia local.'); }
            } }, 'Apagar')));
      return row;
    });
    const localSection = localRows.length
      ? h('section.proj-local', h('h3', 'Cópias e rascunhos neste navegador'),
        h('p.muted.small', 'Inclui cópias separadas e conflitos de abas que já foram fechadas.'),
        h('ul.proj-list', { 'aria-label': 'Cópias e rascunhos locais' }, localRows))
      : null;
    if (!server) {
      body.replaceChildren(
        h('p', 'O servidor do projeto não está rodando, então não há pasta para salvar.'),
        h('p.muted', 'Abra o app com ', h('code', 'npm start'), ' para salvar e abrir arquivos de uma pasta do computador. Enquanto isso, você pode baixar o projeto:'),
        h('button.btn.primary', { type: 'button', onclick: async () => {
          saveProject(store.state.doc);
          if (store.ui.saveState === 'conflict') await saving.recoverConflictCopy(null);
          close();
        } }, ico('download', 14), ' Baixar .json'),
        ...(localSection ? [localSection] : []));
      return;
    }
    let list = [];
    let error = null;
    try { list = await folder.list(); } catch (err) { error = err.message; }

    // ---- salvar como
    const link = store.ui.link;
    const nameInput = h('input.text.mono', {
      type: 'text', spellcheck: false, 'aria-label': 'Nome do arquivo',
      value: (link?.file || fileNameFor(store.state.doc.name)).replace(/\.json$/, ''),
    });
    const doSave = async () => {
      if (await saving.saveAs(nameInput.value)) close();
    };
    nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && doSave());

    const rows = list.map((p) => {
      const isOpen = link?.file === p.file;
      const versionsBox = h('div.proj-versions', { hidden: true });
      const toggle = h('button.btn.ghost.small', {
        type: 'button', 'aria-expanded': 'false', title: 'Versões antigas guardadas deste projeto',
        onclick: async () => {
          const show = versionsBox.hidden;
          versionsBox.hidden = !show;
          toggle.setAttribute('aria-expanded', String(show));
          if (!show) return;
          versionsBox.replaceChildren(h('p.muted.small', 'Carregando…'));
          const vs = await folder.versions(p.file).catch(() => []);
          versionsBox.replaceChildren(...(vs.length
            ? vs.map((v) => h('div.proj-version',
              h('span', ico('history', 13), ' ', new Date(v.modified).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })),
              h('span.muted', formatBytes(v.size)),
              h('button.btn.small', {
                type: 'button',
                onclick: async () => {
                  if (!(await confirmReplace('Abrir esta versão antiga?'))) return;
                  try {
                    await saving.openVersion(p.file, v.id);
                    canvas.fit(null);
                    toast('Versão antiga aberta (não ligada a arquivo). Para restaurar, salve com o mesmo nome.');
                    close();
                  } catch (err) { toast(err.message); }
                },
              }, 'Abrir esta versão')))
            : [h('p.muted.small', 'Nenhuma versão antiga ainda. Elas aparecem conforme você edita (no máximo uma a cada 10 min).')]));
        },
      }, ico('history', 13), ' Versões');
      return h('li.proj-row' + (isOpen ? '.current' : ''),
        h('div.proj-main',
          h('div.proj-info',
            h('strong', p.file.replace(/\.json$/, '')),
            h('span.muted.small', `${when(p.modified)} · ${formatBytes(p.size)}`, isOpen ? ' · aberto agora' : '')),
          toggle,
          h('button.btn.small', {
            type: 'button', disabled: isOpen,
            onclick: async () => {
              if (!(await confirmReplace(`Abrir "${p.file.replace(/\.json$/, '')}"?`))) return;
              try {
                await saving.open(p.file);
                canvas.fit(null);
                toast(`"${p.file}" aberto.`);
                close();
              } catch (err) { toast(err.message || 'Não consegui abrir.'); }
            },
          }, 'Abrir')),
        versionsBox);
    });

    body.replaceChildren(
      h('div.proj-folder', ico('folder', 14), h('span.mono.small', server.folder),
        h('button.btn.ghost.small', { type: 'button', onclick: () => { close(); openSettings('folder'); } }, 'Trocar pasta…')),
      h('div.proj-save',
        h('label.set-label', { for: 'proj-name' }, 'Salvar o projeto atual como'),
        h('div.set-path', h('div.field', Object.assign(nameInput, { id: 'proj-name' }), h('span.muted.mono.small', '.json ')),
          h('button.btn.primary', { type: 'button', onclick: doSave }, ico('save', 14), ' Salvar'))),
      // (replaceChildren escreveria "null" como texto: por isso o erro entra só quando existe)
      ...(error ? [h('p.set-msg.error', error)] : []),
      list.length
        ? h('ul.proj-list', { 'aria-label': 'Projetos na pasta' }, rows)
        : h('p.muted', 'Nenhum projeto nesta pasta ainda.'),
      ...(localSection ? [localSection] : []));
    if (mode === 'save') { nameInput.focus(); nameInput.select(); }
    else body.querySelector('.proj-row:not(.current) .btn.small:not(.ghost)')?.focus();
  }

  body.append(h('p.muted', 'Carregando…'));
  render();
  return { close };
}
