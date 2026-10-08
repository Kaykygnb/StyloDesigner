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
import { ask } from './ui/menus.js';

/** Intervalo mínimo entre duas miniaturas do mesmo projeto: gerar SVG da página toda a cada tecla seria desperdício. */
const THUMB_EVERY_MS = 15 * 1000;

/**
 * Cria o SALVAMENTO: decide quando e onde gravar (navegador sempre; pasta do computador quando o projeto está
 * ligado a um arquivo), reconcilia ao abrir (navegador × pasta, avisando conflito) e envia as miniaturas.
 * @param {object} deps
 * @param {object} deps.store   o store (criado DEPOIS: use `attach(store)`)
 * @param {object} deps.prefs   preferências (prefs.autoFolder: auto-salvar na pasta; padrão ligado)
 * @param {(msg: string) => void} deps.toast
 * @param {() => string|null} [deps.thumbnail]  gera a miniatura SVG da página aberta (ver thumbnail.js)
 */
export function createSaving({ prefs, toast, thumbnail = () => null }) {
  let store = null;
  // quando a última miniatura foi enviada, por arquivo (ver THUMB_EVERY_MS)
  const thumbAt = new Map();
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
        sendThumb(link.file);
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
   * Gera e envia a miniatura do projeto (no máximo 1 a cada 15 s por arquivo; `force` ignora o intervalo).
   * Roda "por fora": não atrasa o salvamento e, se falhar, só fica sem miniatura nova.
   */
  function sendThumb(file, { force = false } = {}) {
    if (!force && Date.now() - (thumbAt.get(file) || 0) < THUMB_EVERY_MS) return;
    thumbAt.set(file, Date.now());
    // espera o navegador ficar ocioso: gerar o SVG mede o DOM, e não queremos competir com um arrasto em andamento
    (globalThis.requestIdleCallback || ((f) => setTimeout(f, 200)))(() => {
      let svg = null;
      try { svg = thumbnail(); } catch (err) { console.warn('miniatura:', err); }
      if (svg) folder.saveThumb(file, svg).catch(() => {});
    });
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
      const choice = await ask({
        title: 'O arquivo mudou fora do editor',
        message: [`"${link.file}" foi alterado por outro programa, outra aba ou outro computador enquanto você editava aqui.`,
          'Substituir grava o que está na tela; o conteúdo atual do arquivo não se perde: vira uma versão antiga.'],
        buttons: [
          { label: 'Cancelar', value: null },
          { label: 'Salvar com outro nome', value: 'other' },
          { label: 'Substituir o arquivo', value: 'replace', primary: true },
        ],
      });
      if (choice === 'other') return false;
      if (choice === 'replace') return saveAs(link.file, { overwrite: true });
      return true;
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
      // acabou de ser gravado na pasta: o indicador e a troca de projeto já podem contar com isso (antes só o próximo
      // salvamento automático marcava, e abrir outro projeto logo depois perguntava à toa)
      store.ui.savedWhere = 'folder';
      store.emit('ui');
      sendThumb(file, { force: true });
      toast(`Salvo em ${file}`);
      return true;
    } catch (err) {
      if (err.status === 409 && !overwrite) {
        const ok = await ask({
          title: 'Substituir o arquivo?',
          message: `Já existe "${file}" na pasta. Se substituir, o conteúdo atual dele vira uma versão antiga (não se perde).`,
          buttons: [{ label: 'Cancelar', value: false }, { label: 'Substituir', value: true, primary: true }],
        });
        if (!ok) return false;
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

  /**
   * Renomeia um projeto da pasta. Se for o projeto aberto, o vínculo passa para o nome novo.
   * @returns {Promise<string|null>} o nome final do arquivo, ou null se não deu
   */
  async function renameFile(file, newName) {
    const to = fileNameFor(String(newName).replace(/\.json$/i, ''));
    try {
      const r = await folder.rename(file, to);
      if (store.ui.link?.file === file) store.setLink({ ...store.ui.link, file: r.file, modified: r.modified });
      return r.file;
    } catch (err) {
      toast(err.message || 'Não consegui renomear.');
      return null;
    }
  }

  /** Cria uma cópia de um projeto da pasta ("nome-copia.json", "nome-copia-2.json"...). Não abre a cópia. */
  async function duplicateFile(file) {
    const { doc } = await folder.load(file);
    const names = new Set((await folder.list()).map((p) => p.file));
    const base = file.replace(/\.json$/i, '');
    let n = 1;
    let target = `${base}-copia.json`;
    while (names.has(target)) target = `${base}-copia-${++n}.json`;
    doc.name = `${doc.name || base} (cópia)`;
    await folder.save(target, doc);
    // a miniatura também vem junto (se existir), para a cópia não aparecer em branco na página inicial
    try {
      const r = await fetch(folder.thumbUrl(file, Date.now()));
      if (r.ok) await folder.saveThumb(target, await r.text());
    } catch { /* sem miniatura: tudo bem */ }
    return target;
  }

  return {
    attach: (s) => { store = s; s.ui.server = server; },
    renameFile,
    duplicateFile,
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
