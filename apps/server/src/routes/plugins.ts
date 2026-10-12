import { Hono } from 'hono';
import { builtinPlugins } from '@stylo/plugins/index.ts';
import { providerStatuses, searchAssets } from '@stylo/plugins/assets/registry.ts';
import type { AssetServices } from '@stylo/plugins/assets/types.ts';
import type { Services } from '../context.js';
import type { Identity } from '../http/identity.js';
import { readObject } from '../http/guards.js';

/** Catálogo verificável usado pela aba Administração (não duplica ferramentas no painel de código). */
export function pluginRoutes(s: Services, id: Identity, assets: AssetServices) {
  const r = new Hono();
  r.get('/plugins/catalog', async (c) => {
    const user = await id.userOf(c);
    return c.json({
      plugins: builtinPlugins.map((p) => ({ id: p.id, name: p.name, description: p.description || '', category: p.category || 'utility', sourceUrl: p.sourceUrl || p.repository || null, version: p.version || '1.0.0', author: p.author || 'desconhecido', license: p.license || 'não informada', repository: p.repository || null, permissions: p.permissions || [], dependencies: p.dependencies || [], exportCompatibility: p.exportCompatibility || [], enabled: s.plugins.isEnabled(p.id), tools: (p.tools || []).map((t) => ({ name: t.def.name, description: t.def.description, write: !!t.def.write, needsProject: !!t.needsProject })) })),
      providers: await providerStatuses(user.id, assets),
      registration: { trustedCode: 'packages/plugins/src/<plugin>/index.ts + builtinPlugins', declarativeAssets: 'asset_source_add (sem código, com licença e URL informadas)' },
    });
  });
  r.get('/assets/search', async (c) => {
    if (!s.plugins.isEnabled('assets')) return c.json({ error: 'O plugin assets está desativado pelo administrador.' }, 409);
    const user = await id.userOf(c);
    const kind = c.req.query('kind') || 'icon';
    if (!['image', 'video', 'audio', 'model3d', 'lottie', 'font', 'icon'].includes(kind)) return c.json({ error: 'Tipo de asset inválido.' }, 400);
    const report = await searchAssets(user.id, { kind: kind as any, query: c.req.query('q') || '', page: Math.max(1, Number(c.req.query('page')) || 1), provider: c.req.query('provider') || undefined }, assets);
    return c.json(report);
  });
  r.put('/plugins/:id', async (c) => {
    await id.adminOf(c);
    const plugin = builtinPlugins.find((item) => item.id === c.req.param('id'));
    if (!plugin) return c.json({ error: 'Plugin não encontrado.' }, 404);
    const body = await readObject(c);
    if (typeof body.enabled !== 'boolean') return c.json({ error: 'enabled precisa ser booleano.' }, 400);
    try { s.plugins.setEnabled(plugin.id, body.enabled); } catch (error) { return c.json({ error: String(error instanceof Error ? error.message : error) }, 409); }
    await s.config.set({ ...s.config.get(), plugins: { enabled: s.plugins.enabledIds() } });
    return c.json({ id: plugin.id, enabled: s.plugins.isEnabled(plugin.id) });
  });
  r.get('/plugins/:id/diagnostics', async (c) => {
    await id.adminOf(c);
    const plugin = builtinPlugins.find((item) => item.id === c.req.param('id'));
    if (!plugin) return c.json({ error: 'Plugin não encontrado.' }, 404);
    const ids = new Set(builtinPlugins.map((item) => item.id));
    const allTools = builtinPlugins.flatMap((item) => (item.tools || []).map((tool) => ({ name: tool.def.name, pluginId: item.id })));
    const duplicateTools = [...new Set(allTools.map((tool) => tool.name).filter((name, index, list) => list.indexOf(name) !== index))];
    const missingDependencies = (plugin.dependencies || []).filter((dependency) => !ids.has(dependency));
    const invalidTools = (plugin.tools || []).filter((tool) => !tool.def.name || typeof tool.run !== 'function').map((tool) => tool.def.name || '(sem nome)');
    const checks = [
      { id: 'enabled', label: 'Plugin ativado', ok: s.plugins.isEnabled(plugin.id) },
      { id: 'dependencies', label: 'Dependências registradas', ok: missingDependencies.length === 0 },
      { id: 'tools', label: 'Ferramentas válidas', ok: invalidTools.length === 0 },
      { id: 'unique-tools', label: 'Nomes de ferramentas únicos', ok: duplicateTools.length === 0 },
    ];
    return c.json({ pluginId: plugin.id, ok: checks.every((check) => check.ok), checkedAt: new Date().toISOString(), checks, missingDependencies, invalidTools, duplicateTools });
  });
  r.get('/asset-sources', async (c) => {
    const user = await id.userOf(c);
    return c.json({ sources: await (assets as any).sources.list(user.id) });
  });
  r.post('/asset-sources', async (c) => {
    const user = await id.userOf(c);
    return c.json(await (assets as any).sources.add(user.id, await readObject(c)), 201);
  });
  r.delete('/asset-sources/:name', async (c) => {
    const user = await id.userOf(c);
    await (assets as any).sources.remove(user.id, c.req.param('name'));
    return c.json({ ok: true });
  });
  return r;
}
