/** Páginas, histórico e troca/salvamento de projetos pelo adaptador injetado. */

import type { RunnerContext, ToolHandlers } from './types.ts';

export function createProjectsTools(ctx: RunnerContext): ToolHandlers {
  const { store, saving, folder } = ctx;
  /** Trocar de projeto só quando nada se perde (projeto salvo na pasta, ou exemplo/em branco intocado). */
  function guardSwitch() {
    if (!saving) throw new Error('Sem servidor (npm start).');
    const ui = store.ui;
    if (!(ui.pristine || (ui.link && ui.savedWhere === 'folder' && !ui.link.conflict))) {
      throw new Error('O projeto aberto só está salvo no navegador e seria perdido. Salve antes com save_project (name: "...").');
    }
  }

  return {
    create_page({ name }) {
      store.addPage();
      const page = store.page();
      store.update(() => { page.name = String(name || page.name).trim().slice(0, 60) || page.name; });
      return { page: { id: page.id, name: page.name } };
    },
    delete_page({ id }) {
      const doc = store.state.doc;
      const page = doc.pages.find((p) => p.id === id);
      if (!page) throw new Error(`Página "${id}" não existe.`);
      if (doc.pages.length === 1) throw new Error('É a única página; não dá para apagar.');
      store.update(() => doc.pages.splice(doc.pages.indexOf(page), 1));
      store.switchPage(doc.pages[0].id);
      return { deleted: id };
    },
    set_project_css({ css }) {
      if (typeof css !== 'string') throw new Error('css precisa ser uma string com a folha completa do projeto.');
      const text = css.trim();
      store.update(() => {
        const styles = (store.state.doc.styles ||= { colors: [], texts: [], vars: [] });
        if (text) styles.pageCss = css;
        else delete styles.pageCss;
      }, { structural: false });
      return { characters: css.length, cleared: !text, hint: 'Aplique get_image para revisar o canvas. O CSS exportado passa pelo sanitizador da plataforma.' };
    },
    redo() {
      if (!store.canRedo()) throw new Error('Não há nada para refazer.');
      store.redo();
      return { redone: true };
    },
    async open_project({ file }) {
      guardSwitch();
      await saving.open(String(file));
      return { opened: file, project: store.state.doc.name };
    },
    async save_project({ name } = {}) {
      if (!saving || !store.ui.server) throw new Error('Sem servidor (npm start): não há pasta para salvar.');
      if (name) {
        // nome que já existe (e não é o arquivo aberto): recusa com mensagem, em vez de abrir a pergunta "substituir?"
        // mesmo nome de arquivo que o storage.fileNameFor gera (sem acento, minúsculas, hífens)
        const file = `${String(name).replace(/\.json$/i, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'projeto'}.json`;
        const taken = (await folder.list()).some((p) => p.file === file);
        if (taken && store.ui.link?.file !== file) throw new Error(`Já existe "${file}" na pasta. Escolha outro nome.`);
        if (!(await saving.saveAs(name, { overwrite: false }))) throw new Error('Não consegui salvar na pasta.');
      }
      else if (!(await saving.quickSave())) throw new Error('Este projeto ainda não tem arquivo: mande um name.');
      return { saved: store.ui.link?.file || null };
    },
    new_project({ name } = {}) {
      guardSwitch();
      store.newDoc();
      if (name) store.update(() => { store.state.doc.name = String(name).slice(0, 80); });
      return { project: store.state.doc.name };
    },
    undo() {
      if (!store.canUndo()) throw new Error('Não há nada para desfazer.');
      store.undo();
      return { undone: true };
    }
  };
}
