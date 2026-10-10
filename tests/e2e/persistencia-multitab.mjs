// Protege a cópia local contra duas abas que abriram a mesma revisão do IndexedDB.
import { chromium } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP = process.env.APP_URL || 'http://localhost:5173/';
const recoveryName = `copia-da-aba-b-${Date.now()}`;
const recoveryFile = `${recoveryName}.json`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const a = await context.newPage();
let b = await context.newPage();
const api = new URL('/api/config', APP);
const origin = new URL(APP).origin;
const originalConfig = await (await fetch(new URL('/api/status', APP))).json();
const isolatedProjects = mkdtempSync(join(tmpdir(), 'stylo-persistencia-e2e-'));
const configResponse = await fetch(api, {
  method: 'PUT', headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ folder: isolatedProjects, keepVersions: originalConfig.keepVersions }),
});
if (!configResponse.ok) throw new Error('Não foi possível isolar a pasta de projetos do E2E.');
const errors = [];
for (const page of [a, b]) {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
}

const waitSaved = async (page) => {
  try {
    await page.waitForFunction(() => document.querySelector('.save-state')?.dataset.state === 'saved', null, { timeout: 8000 });
  } catch (error) {
    const status = await page.evaluate(() => ({
      indicator: document.querySelector('.save-state')?.outerHTML,
      name: designer.store.state.doc.name,
      storeState: designer.store.state.ui.saveState,
      toast: document.querySelector('.toast')?.innerText,
    }));
    throw new Error(`${error.message}\nEstado de salvamento: ${JSON.stringify(status)}`);
  }
};
const setName = (page, name) => page.evaluate((value) => {
  designer.store.state.doc.name = value;
  designer.store.commit();
}, name);
const readRecord = (page, key) => page.evaluate((storageKey) => new Promise((resolve, reject) => {
  const request = indexedDB.open('projeto-designer');
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    const get = db.transaction('kv', 'readonly').objectStore('kv').get(storageKey);
    get.onerror = () => reject(get.error);
    get.onsuccess = () => { resolve(get.result); db.close(); };
  };
}), key);

try {
  // A primeira aba cria o documento de exemplo; só depois a segunda lê a mesma revisão estável.
  await a.goto(new URL('?editor', APP).href);
  await a.waitForFunction(() => !!window.designer?.store);
  await waitSaved(a);
  const tabAId = await a.evaluate(() => sessionStorage.getItem('stylo:editor-tab-id'));
  // Duplicar uma aba pode copiar sessionStorage; simule esse caso para validar a identidade de sessão.
  await b.addInitScript((id) => {
    if (!sessionStorage.getItem('stylo:editor-tab-id')) sessionStorage.setItem('stylo:editor-tab-id', id);
  }, tabAId);
  await b.goto(new URL('?editor', APP).href);
  await b.waitForFunction(() => !!window.designer?.store);
  const tabBId = await b.evaluate(() => sessionStorage.getItem('stylo:editor-tab-id'));
  if (tabAId === tabBId) throw new Error('Abas duplicadas reutilizaram a mesma identidade local.');
  const initialNames = await Promise.all([a, b].map((page) => page.evaluate(() => designer.store.state.doc.name)));
  if (initialNames[0] !== initialNames[1]) throw new Error(`As abas não abriram a mesma revisão inicial: ${initialNames.join(' / ')}`);
  const originalProjectId = await a.evaluate(() => designer.store.state.doc.projectId);
  const secondTabProjectId = await b.evaluate(() => designer.store.state.doc.projectId);
  if (!originalProjectId || secondTabProjectId !== originalProjectId) throw new Error('As abas não compartilharam a identidade do projeto canônico.');

  await setName(a, 'Versão da aba A');
  await waitSaved(a);
  const revisionA = await readRecord(a, 'current');

  await setName(b, 'Edição local da aba B');
  await b.waitForFunction(() => document.querySelector('.save-state')?.innerText.includes('Conflito em outra aba'));

  const persisted = await readRecord(a, 'current');
  const inMemoryB = await b.evaluate(() => designer.store.state.doc.name);
  const draftKey = await b.evaluate(() => `conflict:${sessionStorage.getItem('stylo:editor-tab-id')}`);
  const draft = await readRecord(b, draftKey);
  const assertions = {
    firstTabSavedRevision: Number(revisionA?.revision) > 0,
    secondTabDetectedStaleRevision: await b.locator('.save-state').getAttribute('data-state') === 'warn',
    newerSavedDocumentWasNotOverwritten: persisted?.doc?.name === 'Versão da aba A',
    conflictingEditWasPersistedSeparately: draft?.doc?.name === 'Edição local da aba B',
    conflictingEditRemainsOpen: inMemoryB === 'Edição local da aba B',
  };
  console.log(JSON.stringify({ assertions, persistedName: persisted?.doc?.name, persistedRevision: persisted?.revision, draftName: draft?.doc?.name, inMemoryB }, null, 2));
  if (Object.values(assertions).some((value) => value !== true)) throw new Error('A proteção de conflito entre abas não preservou os estados esperados.');

  await b.reload();
  await b.waitForFunction(() => !!window.designer?.store && designer.store.state.doc.name === 'Edição local da aba B');
  await b.waitForFunction(() => designer.store.ui.saveState === 'conflict');
  console.log('PASS rascunho conflitante é recuperado depois de recarregar a aba');

  // A pessoa dá um nome à cópia; o autosave passa a usar um registro próprio desta aba.
  await b.keyboard.press('Control+Shift+s');
  await b.waitForSelector('.proj-save input');
  await b.fill('.proj-save input', recoveryName);
  await b.click('.proj-save .btn.primary');
  try {
    await b.waitForFunction((file) => designer.store.ui.link?.file === file && document.querySelector('.save-state')?.dataset.state === 'saved', recoveryFile, { timeout: 8000 });
  } catch (error) {
    const diagnostic = await b.evaluate(() => ({ link: designer.store.ui.link, saveState: designer.store.ui.saveState, indicator: document.querySelector('.save-state')?.outerHTML, toast: document.querySelector('.toast')?.innerText, modal: document.querySelector('.modal')?.innerText }));
    throw new Error(`${error.message}\nEstado após salvar como: ${JSON.stringify(diagnostic)}`);
  }
  const currentAfterFork = await readRecord(b, 'current');
  const tabKey = await b.evaluate(() => `tab:${sessionStorage.getItem('stylo:editor-tab-id')}`);
  const isolatedCopy = await readRecord(b, tabKey);
  if (currentAfterFork?.doc?.name !== 'Versão da aba A' || isolatedCopy?.doc?.name !== 'Edição local da aba B') {
    throw new Error('Salvar como não separou a revisão desta aba do documento canônico.');
  }
  if (!isolatedCopy?.doc?.projectId || isolatedCopy.doc.projectId === originalProjectId) {
    throw new Error('Salvar como não atribuiu uma identidade própria à cópia.');
  }
  await b.reload();
  await b.waitForFunction(() => !!window.designer?.store && designer.store.state.doc.name === 'Edição local da aba B');
  await b.waitForFunction((file) => designer.store.ui.link?.file === file, recoveryFile);
  if (await b.evaluate(() => designer.store.state.doc.projectId) !== isolatedCopy.doc.projectId) throw new Error('A identidade da cópia mudou após recarregar.');
  if (await b.evaluate(() => designer.store.ui.saveState) === 'conflict') throw new Error('A cópia separada voltou como conflito depois de recarregar.');
  console.log('PASS salvar como separa a aba e a cópia conflituosa sobrevive ao recarregamento');

  // Cópias locais não pertencem ao ciclo de vida da aba: precisam continuar acessíveis depois de fechá-la.
  await b.close();
  b = await context.newPage();
  await b.goto(new URL('?editor', APP).href);
  await b.waitForFunction(() => !!window.designer?.store);
  await b.keyboard.press('Control+o');
  await b.waitForSelector('.proj-local');
  const localCopyRow = b.locator('.proj-local .proj-row').filter({ hasText: 'Edição local da aba B' });
  if (await localCopyRow.count() !== 1) {
    const diagnostic = await b.evaluate(async () => ({
      localProjects: await designer.storage?.listLocalProjects?.(),
      keys: await new Promise((resolve) => { const request = indexedDB.open('projeto-designer'); request.onsuccess = () => { const tx = request.result.transaction('kv', 'readonly'); const keys = tx.objectStore('kv').getAllKeys(); const values = tx.objectStore('kv').getAll(); tx.oncomplete = () => resolve(keys.result.map((key, i) => ({ key, name: values.result[i]?.doc?.name }))); }; }),
      section: document.querySelector('.proj-local')?.innerText,
    }));
    throw new Error(`A lista de projetos não mostrou a cópia da aba fechada. ${JSON.stringify(diagnostic)}`);
  }
  console.log('PASS a cópia salva na aba encerrada aparece na lista de projetos locais');
  await localCopyRow.getByRole('button', { name: 'Abrir' }).click();
  await b.getByRole('button', { name: 'Descartar e continuar' }).click();
  await b.waitForFunction(() => designer.store.state.doc.name === 'Edição local da aba B');
  if (await b.evaluate(() => designer.store.state.doc.projectId) !== isolatedCopy.doc.projectId) {
    throw new Error('Abrir a cópia local não preservou a identidade do projeto.');
  }
  console.log('PASS a cópia local pode ser aberta em outra aba depois de fechar a original');

  const activeDoc = await b.evaluate(() => structuredClone(designer.store.state.doc));
  const destinationId = 'destination-project-identity';
  const destinationDoc = { ...activeDoc, projectId: destinationId, name: 'Destino anterior' };
  const sourceId = 'source-project-identity';
  const sourceDoc = { ...activeDoc, projectId: sourceId, name: 'Origem para duplicar' };
  for (const [file, doc] of [['identidade-destino.json', destinationDoc], ['identidade-origem.json', sourceDoc]]) {
    const response = await b.evaluate(async ({ file: name, doc: value }) => fetch(`/api/projects/${name}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
    }).then((result) => ({ ok: result.ok, status: result.status })), { file, doc });
    if (!response.ok) throw new Error(`Não foi possível preparar ${file}: ${response.status}`);
  }
  await b.evaluate(() => fetch('/api/projects/identidade-origem.json/thumb', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ svg: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' }),
  }));
  const overwriteResult = await b.evaluate(() => designer.saving.saveAs('identidade-destino.json', { overwrite: true }));
  if (!overwriteResult || await b.evaluate(() => designer.store.state.doc.projectId) !== destinationId) {
    throw new Error('Salvar sobre outro projeto não preservou a identidade do destino.');
  }
  const duplicateName = await b.evaluate(() => designer.saving.duplicateFile('identidade-origem.json'));
  const duplicate = await b.evaluate(async (file) => (await fetch(`/api/projects/${file}`)).json(), duplicateName);
  if (!duplicate.projectId || duplicate.projectId === sourceId) throw new Error('Duplicar arquivo manteve a identidade da origem.');
  console.log('PASS substituir mantém a identidade do destino e duplicar cria outra identidade');
  console.log('ALL PASS');
} finally {
  await context.close();
  await browser.close();
  await fetch(api, {
    method: 'PUT', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder: originalConfig.folder, keepVersions: originalConfig.keepVersions }),
  }).catch(() => {});
  rmSync(isolatedProjects, { recursive: true, force: true });
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
}
