/**
 * plugins.ts — LIGA OS PLUGINS AO SERVIDOR
 *
 * Registra as ferramentas de cada plugin no núcleo (entram no tools/list do MCP e na validação por Zod) e guarda o
 * `run` de cada uma para o workspace chamar. `services` é o que os plugins podem usar do servidor.
 */

import { registerPluginTools } from '@stylo/core/tools/schema.js';
import type { PluginTool, StyloPlugin } from '@stylo/core/plugin.ts';

export function createPlugins({ plugins, services = {} }: { plugins: StyloPlugin[]; services?: Record<string, any> }) {
  const tools = new Map<string, PluginTool>();
  const ids = new Set<string>();
  for (const plugin of plugins) {
    if (ids.has(plugin.id)) throw new Error(`Plugin repetido: ${plugin.id}.`);
    ids.add(plugin.id);
    registerPluginTools((plugin.tools ?? []).map((t) => t.def));
    for (const tool of plugin.tools ?? []) tools.set(tool.def.name, tool);
  }
  return {
    services,
    get: (name: string) => tools.get(name),
    list: () => plugins.map((p) => ({ id: p.id, name: p.name, description: p.description ?? '', tools: (p.tools ?? []).map((t) => t.def.name) })),
  };
}

export type Plugins = ReturnType<typeof createPlugins>;
