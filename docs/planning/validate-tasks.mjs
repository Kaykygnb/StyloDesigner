import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const tasksRoot = path.join(root, 'tasks');
const validStates = new Set(['Proposta', 'Pronta', 'Em andamento', 'Bloqueada', 'Em revisão', 'Em validação', 'Concluída', 'Cancelada']);
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.md') && entry.name !== '_TEMPLATE.md') files.push(full);
  }
}
walk(tasksRoot);
const errors = [];
const ids = new Map();
const docs = new Map();
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file).replaceAll(path.sep, '/');
  const id = text.match(/^#\s+(DOC-[A-Z0-9-]+)\s+—/m)?.[1];
  if (!id) errors.push(`${rel}: missing task ID`);
  else if (ids.has(id)) errors.push(`${rel}: duplicate ID ${id} (also ${ids.get(id)})`);
  else { ids.set(id, rel); docs.set(id, text); }
  const state = text.match(/^Estado:\s*(.+)$/m)?.[1]?.trim();
  if (!state || !validStates.has(state)) errors.push(`${rel}: invalid or missing Estado`);
  const owner = text.match(/^Responsável:\s*(.+)$/m)?.[1]?.trim();
  if (!owner || !/^\[[^\]]+\]$/.test(owner)) errors.push(`${rel}: Responsável must be bracketed`);
  const milestones = [...text.matchAll(/^###\s+#(\d+)\s+—/gm)].map((m) => Number(m[1]));
  if (!milestones.length || milestones.some((n, i) => n !== i + 1)) errors.push(`${rel}: milestones must be sequential from #1`);
  if (!/^##\s+Histórico de trabalho/m.test(text)) errors.push(`${rel}: missing work history`);
  if (state === 'Concluída' && !/Evidências:\s*(?!—\s*$).+/m.test(text)) errors.push(`${rel}: completed task needs evidence`);
  // Handoff obrigatório só para tarefas em voo (TASK-PROTOCOL §10); Proposta/Pronta/Concluída/Cancelada ficam livres.
  const handoffStates = new Set(['Em andamento', 'Bloqueada', 'Em revisão', 'Em validação']);
  if (handoffStates.has(state)) {
    const handoffBody = text.split(/^##\s+Handoff atual\s*$/m)[1]?.split(/^##\s/m)[0] ?? '';
    if (!handoffBody) errors.push(`${rel}: in-flight task (Estado: ${state}) needs a '## Handoff atual' section (TASK-PROTOCOL §10)`);
    else for (const field of ['Preparado por:', 'Destinatário:', 'Estado:', 'Última atualização:']) {
      if (!handoffBody.includes(field)) errors.push(`${rel}: handoff missing '${field}'`);
    }
  }
}
const backlog = fs.readFileSync(path.join(root, 'BACKLOG.md'), 'utf8');
for (const row of backlog.split('\n').filter((line) => /^\| DOC-/.test(line))) {
  const cols = row.split('|').map((x) => x.trim());
  const id = cols[1];
  const link = cols.at(-2)?.match(/\(([^)]+\.md)\)/)?.[1];
  if (!ids.has(id) && id !== 'ID') errors.push(`BACKLOG.md: unknown task ${id}`);
  if (link && !fs.existsSync(path.resolve(root, link))) errors.push(`BACKLOG.md: broken link ${link}`);
}
if (errors.length) { console.error(errors.map((e) => `- ${e}`).join('\n')); process.exitCode = 1; }
else console.log(`Task documentation valid: ${ids.size} unique tasks, ${files.length} files.`);
