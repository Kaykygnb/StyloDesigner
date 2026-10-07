/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  saving.js — REGRAS DE SALVAMENTO (navegador + pasta do computador)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  storage.js sabe GRAVAR; este módulo decide O QUE fazer em cada situação:
 *
 *   auto-salvar (a cada mudança, via store) →  1. se o projeto está LIGADO a um arquivo da pasta, grava lá
 *                                              2. SEMPRE grava a cópia no navegador (IndexedDB)
 *   Ctrl+S / "Salvar na pasta"              →  ligado: grava agora · não ligado: abre "Projetos" para dar um nome
 *   abrir da pasta / abrir versão antiga    →  salva o atual antes de trocar
 *
 *  Situações difíceis, tratadas de propósito:
 *   - CONFLITO: o arquivo mudou fora do editor (outra aba, outro programa, sincronização do Drive). O servidor
 *     responde 409; paramos de gravar nele e avisamos. Nada é sobrescrito sem você confirmar.
 *   - SERVIDOR DESLIGADO no meio do trabalho: continua salvando no navegador e o topo mostra o aviso.
 *   - SEM SERVIDOR (app aberto por outro servidor estático): "Salvar na pasta" vira "Baixar .json".
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { folder, saveLocal, fileNameFor } from './storage.js';
import { saveProject } from './export.js';

/**
 * @param {object} deps
 * @param {object} deps.store   o store (criado DEPOIS: use `attach(store)`)
 * @param {object} deps.prefs   preferências (prefs.autoFolder: auto-salvar na pasta; padrão ligado)
 * @param {(msg: string) => void} deps.toast
 */
export function createSaving({ prefs, toast }) {
  let store = null;
  /** Situação do servidor: { ok, folder, keepVersions } ou null (sem servidor). Atualizada por refresh(). */
  let server = null;
  // avisos que só devem aparecer uma vez por "episódio" (senão o auto-salvar repetiria a cada 400 ms)
  let warnedOffline = false;

  /**
   * Pergunta ao servidor se ele está aí e qual é a pasta. Guarda em store.ui.server para os painéis mostrarem.
   * Se o servidor VOLTOU e a pasta tinha ficado para trás, agenda um salvamento para pô-la em dia.
   */
  async function refresh() {
    server = await folder.status();
    if (store) {
      store.ui.server = server;
      if (server && store.ui.link && store.ui.folderProblem && store.ui.folderProblem !== 'conflict') store.touch();
      store.emit('ui');
    }
    return server;
  }

  /**
   * Ao ABRIR o app com um projeto ligado a um arquivo: a cópia do navegador e o arquivo da pasta podem divergir.
   * Decidimos SEM comparar relógios, com duas perguntas:
   *   (a) o arquivo mudou desde a última vez que o vimos?  (data do disco ≠ link.modified)
   *   (b) o navegador tem mudanças que ainda não foram para a pasta?  (link.synced === false)
   *
   *              | (b) não                          | (b) sim
   *   (a) não    | tudo em dia                      | grava na pasta agora (seguro: o arquivo é o que conhecemos)
   *   (a) sim    | abre o do disco (é o mais novo)  | CONFLITO: mantém o do navegador, não grava; Ctrl+S decide
   *
   * Caso real do (a)-sim/(b)-não: a última gravação na pasta aconteceu ao fechar a aba, mas a cópia do navegador
   * não terminou de anotar a data nova. Arquivo sumiu da pasta → desliga o vínculo (o projeto continua no navegador).
   */
  async function reconcile() {
    const link = store.ui.link;
    if (!link || !server) return;
    let disk;
    try {
      disk = await folder.load(link.file);
    } catch (err) {
      if (err.status === 404) {
        store.setLink(null);
        toast(`"${link.file}" não está mais na pasta. O projeto continua salvo no navegador.`);
      }
      return;
    }
    const changedOnDisk = Math.abs(disk.modified - link.modified) > 1;
    const browserAhead = link.synced === false;
    if (!changedOnDisk) {
      if (browserAhead) store.touch();
      else store.ui.savedWhere = 'folder';
    } else if (!browserAhead) {
      store.loadDoc(disk.doc, { link: { file: link.file, modified: disk.modified, synced: true } });
      store.ui.savedWhere = 'folder';
    } else {
      link.conflict = true;
      store.ui.folderProblem = 'conflict';
      toast(`"${link.file}" mudou na pasta e aqui também. Mantive o que está aqui; Ctrl+S para decidir.`);
    }
    store.emit('ui');
  }

  /**
   * Chamado pelo store a cada salvamento automático. Grava na pasta (se ligado e permitido) e no navegador.
   * Ordem importa: pasta PRIMEIRO, para a cópia do navegador já guardar a data nova do arquivo
   * (senão, ao recarregar, o editor acharia que o arquivo "mudou por fora" e acusaria conflito à toa).
   * @returns {Promise<'folder'|'browser'>} onde o projeto ficou salvo
   */
  async function persist(record) {
    const ui = store.ui;
    const link = ui.link;
    let where = 'browser';
    // se NÃO vamos gravar na pasta agora (servidor fora, conflito, auto-salvar desligado), o navegador fica à frente
    if (link && (link.conflict || prefs.autoFolder === false || !server)) link.synced = false;
    if (link && !link.conflict && prefs.autoFolder !== false && server) {
      try {
        const r = await folder.save(link.file, record.doc, { base: link.modified });
        link.modified = r.modified;
        link.synced = true;
        where = 'folder';
        ui.folderProblem = null;
        warnedOffline = false;
      } catch (err) {
        link.synced = false;
        if (err.status === 409) {
          link.conflict = true;
          ui.folderProblem = 'conflict';
          toast(`"${link.file}" foi alterado fora do editor. Parei de gravar nele: use Ctrl+S para decidir.`);
        } else {
          ui.folderProblem = err.status ? err.message : 'offline';
          if (!warnedOffline) toast(err.status ? `Não gravou na pasta: ${err.message}` : 'Servidor desligado: salvando só no navegador.');
          warnedOffline = true;
        }
      }
    }
    await saveLocal({ ...record, link: ui.link });
    return where;
  }

  /**
   * Ctrl+S. Projeto ligado a um arquivo → grava agora. Em conflito → pergunta se substitui o arquivo do disco.
   * Não ligado → devolve false (quem chamou abre a janela "Projetos" para escolher o nome).
   * Sem servidor → baixa o .json (o comportamento antigo).
   * @returns {Promise<boolean>} true se resolveu sozinho
   */
  async function quickSave() {
    if (!server && !(await refresh())) {
      saveProject(store.state.doc);
      toast('Sem servidor (npm start): baixei o projeto como .json.');
      return true;
    }
    const link = store.ui.link;
    if (!link) return false;
    if (link.conflict) {
      if (!confirm(`O arquivo "${link.file}" foi alterado fora deste editor.\n\nOK = substituir pelo que está aqui (o do disco vira uma versão antiga).\nCancelar = escolher outro nome.`)) return false;
      return saveAs(link.file, { overwrite: true });
    }
    await store.saveNow();
    if (store.ui.savedWhere === 'folder') toast(`Salvo em ${link.file}`);
    return true;
  }

  /**
   * Grava o projeto atual com o nome `file` e liga o projeto a ele. Se já existir outro arquivo com esse nome,
   * pergunta antes de substituir. @returns {Promise<boolean>} true se gravou
   */
  async function saveAs(file, { overwrite = false } = {}) {
    file = fileNameFor(String(file).replace(/\.json$/i, ''));
    try {
      const same = store.ui.link?.file === file;
      const r = await folder.save(file, store.state.doc, { base: same ? store.ui.link.modified : undefined, overwrite });
      store.setLink({ file, modified: r.modified, synced: true });
      store.ui.folderProblem = null;
      toast(`Salvo em ${file}`);
      return true;
    } catch (err) {
      if (err.status === 409 && !overwrite) {
        if (!confirm(`Já existe "${file}" na pasta. Substituir? (o arquivo atual vira uma versão antiga)`)) return false;
        return saveAs(file, { overwrite: true });
      }
      toast(err.status ? err.message : 'Servidor desligado: não consegui gravar na pasta.');
      return false;
    }
  }

  /** Abre um projeto da pasta (salvando o atual antes) e liga o editor ao arquivo. */
  async function open(file) {
    await store.saveNow();
    const { doc, modified } = await folder.load(file);
    if (!doc?.pages?.length) throw new Error('Arquivo inválido: não parece um projeto do Projeto Designer.');
    store.loadDoc(doc, { link: { file, modified, synced: true } });
  }

  /**
   * Abre uma VERSÃO ANTIGA como projeto solto (não ligado a arquivo), para você conferir sem estragar o atual.
   * Para restaurar, use "Salvar na pasta" com o mesmo nome e confirme a substituição.
   */
  async function openVersion(file, id) {
    await store.saveNow();
    const doc = await folder.loadVersion(file, id);
    store.loadDoc(doc);
  }

  return {
    attach: (s) => { store = s; s.ui.server = server; },
    persist,
    reconcile,
    refresh,
    quickSave,
    saveAs,
    open,
    openVersion,
    get server() { return server; },
  };
}
