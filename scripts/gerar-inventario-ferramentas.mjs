import { readFileSync, writeFileSync } from 'node:fs';
import { buildInventory, renderInventory } from './inventario-ferramentas.mjs';
const data = buildInventory();
const outputs = { 'TOOL-INVENTORY.json': JSON.stringify(data, null, 2) + '\n', 'TOOL-INVENTORY.md': renderInventory(data) };
for (const [name, content] of Object.entries(outputs)) {
  const path = new URL(`../docs/testing/${name}`, import.meta.url);
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== content) throw new Error(`Inventário desatualizado: ${name}. Rode npm run docs:inventario.`);
  } else writeFileSync(path, content);
}
console.log(`Inventário válido: ${data.counts.total} ferramentas, ${data.counts.core} núcleo, ${data.counts.plugins} plugins.`);
