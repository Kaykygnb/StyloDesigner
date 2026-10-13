// Impede catálogo/dispatch e artefatos de documentação divergirem silenciosamente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildInventory, renderInventory } from '../scripts/inventario-ferramentas.mjs';

test('inventário: artefatos completos e determinísticos acompanham o catálogo/handlers atuais', () => {
  const data = buildInventory();
  assert.equal(readFileSync(new URL('../docs/testing/TOOL-INVENTORY.json', import.meta.url), 'utf8'), JSON.stringify(data, null, 2) + '\n', 'rode npm run docs:inventario para atualizar o contrato');
  assert.equal(readFileSync(new URL('../docs/testing/TOOL-INVENTORY.md', import.meta.url), 'utf8'), renderInventory(data));
  assert.equal(new Set(data.tools.map((r) => r.name)).size, data.counts.total);
  assert.ok(data.tools.every((r) => r.inputSchema.type === 'object' && r.handler.path));
});

test('inventário: workspace vence runner e composição resolve handler sobrescrito', () => {
  const rows = buildInventory().tools;
  assert.equal(rows.find((r) => r.name === 'new_project').handler.path, 'apps/server/src/workspace/index.ts');
  assert.equal(rows.find((r) => r.name === 'create_component').handler.path, 'packages/core/src/tools/runner/layers.ts');
  assert.equal(rows.find((r) => r.name === 'audit_svg').write, false);
  assert.equal(rows.find((r) => r.name === 'audit_svg').handler.path, 'packages/core/src/tools/runner/layout.ts');
  assert.equal(rows.find((r) => r.name === 'export_zip').scope, 'export');
  assert.ok(rows.filter((r) => r.testReferences.length).every((r) => r.testStatus.includes('não auditada')), 'menção não vira cobertura comportamental');
});
