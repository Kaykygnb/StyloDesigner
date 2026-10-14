/**
 * Mapa do projeto para um agente (ferramenta get_project_map).
 *
 * O Stylo é a camada de interface e planejamento: a pessoa e o agente desenham juntos e, depois, um agente
 * constrói o produto de verdade usando o protótipo como base. Este resumo junta, em Markdown, o que esse
 * agente precisa saber antes de começar: telas, tamanhos, design system, estrutura com os textos reais,
 * navegação, decisões e pendências. Função pura: não grava nada e roda no Node e no navegador.
 */
import { walk, DEFAULT_BREAKPOINTS } from './model.js';
import type { Doc, LayerNode } from './types.ts';

export interface BriefNote { body?: string; text?: string; kind?: string; resolved?: boolean; author?: string; by?: string; layerId?: string | null }
export interface BriefOptions {
  /** Notas do projeto (decisões e comentários do servidor). */
  notes?: BriefNote[];
  /** Profundidade da estrutura de cada tela (1 a 8). */
  depth?: number;
  /** Endereço do MCP, para o passo "como continuar". */
  endpoint?: string;
}
export interface BriefStats { pages: number; screens: number; layers: number; texts: number; components: number; interactions: number; colors: number; textStyles: number; openComments: number; decisions: number }

const clip = (s: unknown, max = 120) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
};
const px = (n: unknown) => Math.round(Number(n) || 0);

/** Uma linha da estrutura: nome, tipo, tamanho, layout e o texto quando houver. */
function line(n: LayerNode): string {
  const bits: string[] = [`**${clip(n.name, 60) || n.type}**`];
  const kind = n.component ? 'componente' : n.instanceOf ? 'instância' : n.type;
  bits.push(`(${kind}${n.tag ? ` <${n.tag}>` : ''}, ${px(n.w)}×${px(n.h)})`);
  const L = n.layout;
  if (L && L.mode && L.mode !== 'none') bits.push(L.mode === 'grid' ? `grade ${L.cols} col.` : `${L.mode === 'row' ? 'linha' : 'coluna'}, gap ${px(L.gap)}`);
  if (n.type === 'text' && n.text) bits.push(`— “${clip(n.text, 100)}”`);
  if (n.href) bits.push(`→ ${clip(n.href, 60)}`);
  if (typeof n.note === 'string' && n.note.trim()) bits.push(`_nota: ${clip(n.note, 120)}_`);
  if (!n.visible) bits.push('(oculta)');
  return bits.join(' ');
}

function outline(nodes: LayerNode[], depth: number, indent = 0, out: string[] = []): string[] {
  for (const n of nodes) {
    out.push(`${'  '.repeat(indent)}- ${line(n)}`);
    if (n.children?.length) {
      if (depth > 1) outline(n.children, depth - 1, indent + 1, out);
      else out.push(`${'  '.repeat(indent + 1)}- … ${n.children.length} camada(s) dentro`);
    }
  }
  return out;
}

/** Monta o resumo em Markdown e alguns números do projeto. */
export function projectBrief(doc: Doc, opts: BriefOptions = {}): { markdown: string; stats: BriefStats } {
  const depth = Math.max(1, Math.min(8, Number(opts.depth) || 4));
  const byId = new Map<string, LayerNode>();
  const pageOf = new Map<string, string>();
  const components: LayerNode[] = [];
  const flows: string[] = [];
  let layers = 0, texts = 0, interactions = 0;
  for (const page of doc.pages) {
    walk(page.children, (n: LayerNode) => {
      layers++;
      byId.set(n.id, n);
      pageOf.set(n.id, page.name);
      if (n.type === 'text') texts++;
      if (n.component) components.push(n);
    });
  }
  for (const page of doc.pages) {
    walk(page.children, (n: LayerNode) => {
      for (const it of n.interactions || []) {
        interactions++;
        const target = it.target ? byId.get(it.target) : null;
        const to = it.action === 'navigate' ? `vai para “${target?.name ?? it.target}”` : it.action === 'back' ? 'volta' : it.action === 'url' ? `abre ${clip(it.target, 60)}` : `${it.action}${it.target ? ` ${it.target}` : ''}`;
        flows.push(`- ${page.name} › “${clip(n.name, 50)}” — ao ${it.trigger || 'clicar'}, ${to}${it.transition ? ` (${it.transition})` : ''}`);
      }
    });
  }

  const styles = doc.styles || ({} as Doc['styles']);
  const colors = styles.colors || [];
  const textStyles = styles.texts || [];
  const vars = styles.vars || [];
  const comments = ((doc.comments || []) as any[]).filter((c) => !c.resolved);
  const notes = opts.notes || [];
  const decisions = notes.filter((n) => n.kind === 'DECISION' || n.kind === 'decision');
  const otherNotes = notes.filter((n) => !decisions.includes(n) && !n.resolved);
  const screens = doc.pages.reduce((s, p) => s + p.children.length, 0);
  const breakpoints = (doc.breakpoints?.length ? doc.breakpoints : DEFAULT_BREAKPOINTS) as { name: string; max: number }[];

  const md: string[] = [];
  md.push(`# ${doc.name || 'Projeto sem nome'}`);
  md.push('');
  md.push('Resumo gerado pelo Stylo. Este projeto é um protótipo (HTML/CSS) combinado entre a pessoa e o agente: use-o como base visual e de estrutura para construir o produto real. Os textos, tamanhos e cores abaixo são os do protótipo.');
  const about = doc.brief || {};
  const aboutLines = [
    about.summary && `- **O que é:** ${clip(about.summary, 400)}`,
    about.audience && `- **Para quem:** ${clip(about.audience, 300)}`,
    about.goals && `- **Metas:** ${clip(about.goals, 300)}`,
    Array.isArray(about.tone) && about.tone.length && `- **Tom:** ${about.tone.join(', ')}`,
    Array.isArray(about.values) && about.values.length && `- **Valores:** ${about.values.join(', ')}`,
    about.avoid && `- **Evitar:** ${clip(about.avoid, 300)}`,
    about.notes && `- **Observações:** ${clip(about.notes, 400)}`,
  ].filter(Boolean) as string[];
  if (aboutLines.length) md.push('', '## Sobre o projeto', '', ...aboutLines);
  md.push('', `**Em números:** ${doc.pages.length} página(s), ${screens} tela(s)/quadro(s), ${layers} camadas, ${components.length} componente(s), ${interactions} interação(ões).`);

  md.push('', '## Telas');
  for (const page of doc.pages) {
    md.push('', `### ${page.name}`);
    if (!page.children.length) { md.push('_Página vazia._'); continue; }
    for (const top of page.children) md.push(`- **${clip(top.name, 60)}** — ${px(top.w)}×${px(top.h)}${top.note ? ` — _${clip(top.note, 140)}_` : ''}`);
  }

  md.push('', '## Tamanhos de tela (breakpoints)');
  for (const b of breakpoints) md.push(`- ${b.name}: até ${b.max}px`);

  md.push('', '## Design system');
  if (colors.length) {
    md.push('', '**Cores**');
    for (const c of colors) md.push(`- ${c.name}: \`${c.color ?? '?'}\``);
  }
  if (textStyles.length) {
    md.push('', '**Estilos de texto**');
    for (const t of textStyles) md.push(`- ${t.name}: ${[t.fontFamily, t.fontSize && `${t.fontSize}px`, t.fontWeight, t.lineHeight && `altura ${t.lineHeight}`].filter(Boolean).join(', ') || '—'}`);
  }
  if (vars.length) {
    md.push('', '**Medidas (variáveis)**');
    for (const v of vars) md.push(`- ${v.name}: ${v.value}`);
  }
  if (components.length) {
    md.push('', '**Componentes**');
    for (const c of components) md.push(`- ${clip(c.name, 60)} (${px(c.w)}×${px(c.h)}, na página ${pageOf.get(c.id)})`);
  }
  if (!colors.length && !textStyles.length && !vars.length && !components.length) md.push('_Nenhum estilo ou componente salvo ainda. Extraia as cores e fontes direto das telas._');

  md.push('', '## Estrutura');
  for (const page of doc.pages) {
    if (!page.children.length) continue;
    md.push('', `### ${page.name}`, '', ...outline(page.children, depth));
  }

  md.push('', '## Navegação e interações');
  md.push(...(flows.length ? flows.slice(0, 80) : ['_Nenhuma interação definida. A navegação entre telas ainda precisa ser combinada._']));
  if (flows.length > 80) md.push(`- … e mais ${flows.length - 80}`);

  md.push('', '## Decisões e pendências');
  if (decisions.length) {
    md.push('', '**Decisões**');
    for (const d of decisions) md.push(`- ${d.resolved ? '~~' : ''}${clip(d.body ?? d.text, 240)}${d.resolved ? '~~' : ''}${(d.by ?? d.author) ? ` (${d.by ?? d.author})` : ''}`);
  }
  const open = [
    ...comments.map((c) => `- ${clip(c.text, 240)}${c.nodeId && byId.get(c.nodeId) ? ` — em “${clip(byId.get(c.nodeId)!.name, 40)}”` : ''}${c.author ? ` (${c.author})` : ''}`),
    ...otherNotes.map((n) => `- ${clip(n.body ?? n.text, 240)}${(n.by ?? n.author) ? ` (${n.by ?? n.author})` : ''}`),
  ];
  if (open.length) md.push('', '**Em aberto**', ...open);
  if (!decisions.length && !open.length) md.push('_Nada registrado. Use `add_note` para guardar as decisões tomadas na conversa._');

  md.push('', '## Como continuar');
  md.push(`- Conecte-se ao MCP do Stylo${opts.endpoint ? ` em ${opts.endpoint}` : ''} e abra este projeto.`);
  md.push('- `get_document` e `get_code` trazem a estrutura e o HTML/CSS de cada tela; `get_project_css` e `export_tokens` trazem os tokens.');
  md.push('- `inspect_layout` mostra medidas reais; `list_notes` traz as decisões completas.');
  md.push('- Mantenha textos, hierarquia e espaçamentos do protótipo; o que não estiver definido aqui deve ser perguntado à pessoa.');

  const stats: BriefStats = { pages: doc.pages.length, screens, layers, texts, components: components.length, interactions, colors: colors.length, textStyles: textStyles.length, openComments: comments.length, decisions: decisions.length };
  return { markdown: md.join('\n') + '\n', stats };
}
