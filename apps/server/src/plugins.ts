/**
 * plugins.ts — LIGA OS PLUGINS AO SERVIDOR
 *
 * Registra as ferramentas de cada plugin no núcleo (entram no tools/list do MCP e na validação por Zod) e guarda o
 * `run` de cada uma para o workspace chamar. `services` é o que os plugins podem usar do servidor.
 */

import { registerPluginTools } from '@stylo/core/tools/schema.js';
import type { PluginTool, StyloPlugin } from '@stylo/core/plugin.ts';

export function createPlugins({ plugins, enabled, services = {} }: { plugins: StyloPlugin[]; enabled?: string[]; services?: Record<string, any> }) {
  const tools = new Map<string, { pluginId: string; tool: PluginTool }>();
  const ids = new Set<string>();
  const byId = new Map(plugins.map((plugin) => [plugin.id, plugin]));
  const requested = new Set(enabled?.length ? enabled : plugins.map((plugin) => plugin.id));
  const active = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const plugin of plugins) {
      if (requested.has(plugin.id) && (plugin.dependencies ?? []).every((dependency) => active.has(dependency)) && !active.has(plugin.id)) {
        active.add(plugin.id);
        changed = true;
      }
    }
  }
  const dependenciesReady = (plugin: StyloPlugin) => (plugin.dependencies ?? []).filter((dependency) => !active.has(dependency));
  for (const plugin of plugins) {
    if (ids.has(plugin.id)) throw new Error(`Plugin repetido: ${plugin.id}.`);
    ids.add(plugin.id);
    registerPluginTools((plugin.tools ?? []).map((t) => t.def));
    for (const tool of plugin.tools ?? []) tools.set(tool.def.name, { pluginId: plugin.id, tool });
  }
  return {
    services,
    get: (name: string) => { const entry = tools.get(name); return entry && active.has(entry.pluginId) ? entry.tool : undefined; },
    list: () => plugins.map((p) => ({ id: p.id, name: p.name, description: p.description ?? '', enabled: active.has(p.id), tools: (p.tools ?? []).map((t) => t.def.name) })),
    isEnabled: (id: string) => active.has(id),
    setEnabled: (id: string, value: boolean) => {
      const plugin = byId.get(id);
      if (!plugin) throw new Error(`Plugin não encontrado: ${id}.`);
      if (value) {
        const missing = dependenciesReady(plugin);
        if (missing.length) throw new Error(`Não é possível ativar ${id}: dependências desativadas (${missing.join(', ')}).`);
        active.add(id);
      } else {
        const dependents = plugins.filter((item) => active.has(item.id) && (item.dependencies ?? []).includes(id)).map((item) => item.id);
        if (dependents.length) throw new Error(`Não é possível desativar ${id}: usado por ${dependents.join(', ')}.`);
        active.delete(id);
      }
    },
    enabledIds: () => [...active],
  };
}

export type Plugins = ReturnType<typeof createPlugins>;
