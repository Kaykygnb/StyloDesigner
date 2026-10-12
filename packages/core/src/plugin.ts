/**
 * plugin.ts — O CONTRATO DE PLUGIN DO STYLO
 *
 * Um plugin é um pacote que acrescenta capacidades sem mexer no núcleo: ferramentas MCP, provedores de assets,
 * exportadores, auxiliares de identidade visual. Cada plugin tem um `id` e uma lista de ferramentas; cada ferramenta tem
 * a definição (Zod, como as do núcleo: vira JSON Schema e validação) e o `run`.
 *
 *   definePlugin({ id: 'identidade', name: 'Identidade visual', tools: [ { def, run } ] })
 *
 * O servidor carrega os plugins EMBUTIDOS (apps/server/src/plugins.ts). Plugin com código é confiança total: só entra por
 * quem opera o servidor, nunca por upload de usuário. Quem quer acrescentar uma FONTE DE ASSETS sem programar usa a
 * configuração declarativa do plugin de assets.
 */

import type { ToolDef } from './tools/schema.ts';

/** Quem está chamando a ferramenta. */
export interface PluginActor {
  type: 'USER' | 'AGENT' | 'SYSTEM';
  userId: string;
  agentId?: string;
  name: string;
  scopes?: string[];
}

/** O projeto aberto na sessão (para ferramentas que precisam dele). */
export interface PluginProject {
  id: string;
  file: string;
  /** OWNER | EDITOR | VIEWER */
  role: string;
  /** store e comandos do núcleo: alterar SEMPRE por `store.update(...)`; o servidor faz o `commit` e a gravação. */
  store: any;
  commands: any;
}

/** O que o servidor entrega a uma ferramenta de plugin. */
export interface PluginContext {
  actor: PluginActor;
  /** Projeto aberto, ou null (só vem preenchido se a ferramenta declarou `needsProject`). */
  project: PluginProject | null;
  /** Serviços do servidor (baixar imagem com proteção SSRF, biblioteca da conta...). Vazio fora do servidor. */
  services: Record<string, any>;
  signal?: AbortSignal;
}

export interface PluginTool {
  /** Definição da ferramenta (use `defineTool` de @stylo/core/tools/schema.ts). */
  def: ToolDef;
  /** A ferramenta precisa de um projeto aberto na sessão (e do papel certo nele). */
  needsProject?: boolean;
  run: (args: any, ctx: PluginContext) => Promise<object> | object;
}

export interface StyloPlugin {
  id: string;
  name: string;
  description?: string;
  /** Categoria visível no catálogo administrativo; não altera o contrato das ferramentas. */
  category?: 'design' | 'quality' | 'asset-provider' | 'exporter' | 'integration' | 'utility';
  /** Página oficial do plugin/projeto, quando houver. */
  sourceUrl?: string;
  version?: string;
  author?: string;
  license?: string;
  repository?: string;
  permissions?: string[];
  dependencies?: string[];
  /** Formatos/artefatos que o plugin altera ou consegue gerar. */
  exportCompatibility?: string[];
  tools?: PluginTool[];
}

/** Confere o plugin (id e nomes de ferramenta válidos e sem repetição) e o devolve. */
export function definePlugin(plugin: StyloPlugin): StyloPlugin {
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(plugin.id)) throw new Error(`Id de plugin inválido: "${plugin.id}" (use minúsculas, números e hífen).`);
  const seen = new Set<string>();
  for (const tool of plugin.tools ?? []) {
    const name = tool.def.name;
    if (!/^[a-z][a-z0-9_]{2,60}$/.test(name)) throw new Error(`Plugin ${plugin.id}: nome de ferramenta inválido "${name}".`);
    if (seen.has(name)) throw new Error(`Plugin ${plugin.id}: ferramenta repetida "${name}".`);
    seen.add(name);
    if (tool.def.write && !tool.needsProject && !tool.def.noLock) throw new Error(`Plugin ${plugin.id}: "${name}" altera algo mas não declara projeto (needsProject) nem noLock.`);
  }
  return plugin;
}
