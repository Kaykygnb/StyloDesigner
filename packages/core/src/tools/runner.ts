import { toolByName, validateToolArgs } from './schema.js';
import type { RunnerDependencies, ToolHandlers, RunOptions, ToolArgs } from './runner/types.ts';
import { createRunnerContext } from './runner/context.ts';
import { createReadTools } from './runner/read.ts';
import { createInspectionTools } from './runner/inspection.ts';
import { createExportTools } from './runner/export.ts';
import { createLayoutTools, checkSpec } from './runner/layout.ts';
import { createLayersTools } from './runner/layers.ts';
import { createStylesTools } from './runner/styles.ts';
import { createProjectsTools } from './runner/projects.ts';
import { createImageTools } from './runner/images.ts';
import { describeCall } from './runner/presentation.ts';
export { PROPS, applyProps } from './runner/properties.ts';
export { summarize, describeCall } from './runner/presentation.ts';
export { assertCurrentImageTarget } from './runner/images.ts';

/** Executor das ferramentas: validação, permissão, histórico e proteção de alterações concorrentes. */
export function createRunner({ store, commands, approve, saving = null, folder = null, renderImage = null, auditLayout = null, fetchImage = null, imageOps = null, vendor = null }: RunnerDependencies) {
  const ctx = createRunnerContext({ store, commands, approve, saving, folder, renderImage, auditLayout, fetchImage, imageOps, vendor });
  const { need, targetList } = ctx;
  const { tools: imageTools, imageLayer } = createImageTools(ctx);
  const READ: ToolHandlers = { ...createReadTools(ctx), ...createInspectionTools(ctx), ...createExportTools(ctx) };
  const WRITE: ToolHandlers = { ...createLayoutTools(ctx), ...createLayersTools(ctx), ...createStylesTools(ctx), ...createProjectsTools(ctx), ...imageTools };
  /**
   * Roda uma ferramenta e devolve o resultado (objeto JSON). Nunca lança: erros voltam como { error }.
   * @param {string} tool
   * @param {object} args
   * @param {string} [client]  quem pediu ('Assistente', 'Claude Code'...), aparece na janela de permissão
   */
  async function run(tool: string, args: ToolArgs = {}, client = 'Assistente', { external = false, admin = false, signal }: RunOptions = {}): Promise<ToolArgs> {
    // O atributo admin é legado; preserve a verificação mesmo sem ferramentas atuais que o declarem.
    const def: (NonNullable<ReturnType<typeof toolByName>> & { admin?: boolean }) | null = toolByName(tool);
    if (!def) return { error: `Ferramenta desconhecida: ${tool}.` };
    // confere os argumentos contra o Zod da ferramenta: a IA recebe uma mensagem clara e corrige
    const invalid = validateToolArgs(tool, args);
    if (invalid) return { error: invalid };
    try {
      if (signal?.aborted) throw new Error('A operação foi cancelada pelo cliente MCP.');
      // arquivos de projeto: programas externos (MCP) só com o "Acesso de administrador" ligado
      if (def.admin && external && !admin) throw new Error('Esta ferramenta mexe nos arquivos de projeto e precisa do "Acesso de administrador" (Configurações → Assistente de IA e MCP).');
      if (!def.write) return await READ[tool](args || {});
      // alteração: confere o pedido ANTES de perguntar (não adianta pedir permissão para algo que vai falhar)
      if (tool === 'update_layer' || tool === 'move_layer') need(args?.id);
      if (tool === 'delete_layers') (args?.ids || []).forEach(need);
      if (tool === 'set_project_css' && typeof args?.css !== 'string') throw new Error('css precisa ser uma string com a folha completa do projeto.');
      if (tool === 'build_layout') checkSpec(args?.tree);
      if (tool === 'build_layout' || tool === 'insert_icon') targetList(args?.parent_id);
      if (tool === 'edit_image' && !imageOps) throw new Error('edit_image não está disponível neste servidor. Configure o serviço de edição com Chromium.');
      if (tool === 'generate_image_edit' && !imageOps?.generativeEdit) throw new Error('A edição generativa não está disponível pelo MCP neste servidor. Use edit_image para recortar, girar ou ajustar a foto sem IA externa.');
      if (tool === 'edit_image' || tool === 'generate_image_edit') imageLayer(args?.id);
      if (tool === 'generate_image_edit') {
        if (!String(args?.prompt || '').trim()) throw new Error('prompt: diga o que a IA de imagem deve fazer.');
        // sem modelo de imagem configurado: avisa ANTES de pedir permissão
        const cfg = await fetch('/api/imageai/config').then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (!cfg) throw new Error('A edição generativa precisa do servidor (npm start).');
        if (!cfg.available) throw new Error(cfg.reason);
      }
      const summary = describeCall(tool, args || {}, store);
      // administrador: o programa externo age sem perguntar (a pessoa ligou isso de propósito em Configurações)
      const ok = admin || (approve ? await approve({ client, tool, args, summary, signal }) : false);
      if (signal?.aborted) throw new Error('A operação foi cancelada pelo cliente MCP.');
      if (!ok) return { refused: true, message: 'A pessoa recusou esta alteração. Pergunte o que ela prefere.' };
      const beforeRevision = store.docRevision?.();
      const before = JSON.stringify(store.state.doc);
      try {
        const out = await WRITE[tool](args || {}, client);
        if (!['undo', 'redo', 'open_project', 'new_project', 'save_project'].includes(tool)) store.commit();
        return { ok: true, ...out, ...(admin ? { _summary: summary } : {}) };
      } catch (err: any) {
        // Não restaure uma foto global se alguém editou enquanto esta ferramenta aguardava rede/disco.
        // Isso apagava alterações humanas ou de outro agente feitas em partes não relacionadas do documento.
        const changedWhileRunning = beforeRevision !== undefined && store.docRevision?.() !== beforeRevision;
        if (changedWhileRunning) {
          throw new Error(`${err?.message || String(err)} O documento mudou enquanto a ferramenta rodava; mantive o estado atual para preservar trabalho. Confira o resultado e use Ctrl+Z se necessário.`);
        }
        if (!['undo', 'redo', 'open_project', 'new_project'].includes(tool) && JSON.stringify(store.state.doc) !== before) {
          restoreDoc(before);
        }
        throw err;
      }
    } catch (err: any) {
      return { error: err.message || String(err) };
    }
  }
  /** Restaura uma alteração parcial que falhou, sem criar passo no histórico (só sem mudanças concorrentes). */
  function restoreDoc(json) {
    const saved = JSON.parse(json);
    store.update(() => { Object.assign(store.state.doc, saved); }, { structural: true });
    store.emit('doc');
  }

  return { run };
}
