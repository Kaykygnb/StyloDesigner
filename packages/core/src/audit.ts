// AUDITORIA DO DESIGN (check_design): problemas que um agente não vê olhando só o JSON — contraste fraco, texto
// minúsculo, imagem sem texto alternativo e (com navegador) conteúdo que vaza da tela em algum breakpoint.
// Aqui ficam as regras puras; a medida de vazamento vem do renderizador e entra por `overflowIssues`.
import { contrast } from './color.js';

export interface Issue {
  severity: 'erro' | 'aviso';
  type: 'contraste' | 'texto-pequeno' | 'sem-alt' | 'vazamento';
  layerId: string;
  layerName: string;
  where?: string;
  message: string;
  fix: string;
}

/** Um item do relatório de vazamento do navegador: a camada, em que largura e quantos px passaram. */
export interface Overflow { nodeId: string; label: string; width: number; right: number; left: number }

const MAX_ISSUES = 60;

/** Cor sólida de fundo efetiva de uma camada, subindo pelos pais; null se há imagem/gradiente no caminho (não dá para saber). */
function backgroundOf(chain: any[]): string | null {
  for (let i = chain.length - 1; i >= 0; i--) {
    const f = chain[i].fill;
    if (!f || f.type === 'none') continue;
    if (f.type === 'solid' && (f.opacity ?? 1) >= 0.95) return f.color;
    if (f.type === 'solid') continue; // translúcido: o fundo de trás também conta
    return null; // gradiente ou imagem
  }
  return '#FFFFFF'; // o body exportado é branco
}

/** Regras que não precisam de navegador. `roots` são as telas a conferir. */
export function auditStatic(roots: any[]): Issue[] {
  const out: Issue[] = [];
  const walk = (node: any, chain: any[]) => {
    if (node.visible === false) return;
    const here = [...chain, node];
    if (node.type === 'text') {
      const size = Number(node.fontSize) || 16;
      const f = node.fill;
      if (size < 12) out.push({ severity: 'aviso', type: 'texto-pequeno', layerId: node.id, layerName: node.name, message: `“${node.name}” tem ${size}px: abaixo de 12px é difícil de ler.`, fix: 'Aumente fontSize para 14 ou mais (16 no corpo do texto).' });
      if (f?.type === 'solid') {
        const bg = backgroundOf(chain);
        if (bg) {
          const ratio = contrast(f.color, bg);
          const large = size >= 24 || (size >= 18.66 && Number(node.fontWeight) >= 700);
          const need = large ? 3 : 4.5;
          if (ratio < need) {
            out.push({
              severity: 'erro', type: 'contraste', layerId: node.id, layerName: node.name,
              message: `“${node.name}”: contraste ${ratio.toFixed(2)}:1 entre ${String(f.color).toUpperCase()} e o fundo ${bg.toUpperCase()}; o mínimo para ${large ? 'texto grande' : 'texto normal'} é ${need}:1.`,
              fix: 'Escureça o texto ou clareie o fundo (color_text_on sugere a melhor cor; color_contrast confere).',
            });
          }
        }
      }
    } else if (node.fill?.type === 'image' && !(node.children || []).length && !String(node.alt || '').trim()) {
      out.push({ severity: 'aviso', type: 'sem-alt', layerId: node.id, layerName: node.name, message: `“${node.name}” é uma imagem sem descrição.`, fix: 'Defina alt com o que a imagem mostra (update_layer {"alt": "..."}), ou "" se for só decorativa.' });
    }
    for (const c of node.children || []) walk(c, here);
  };
  for (const r of roots) walk(r, []);
  return out;
}

/** Transforma o relatório de vazamento do navegador em avisos com a causa mais provável e o conserto. */
export function overflowIssues(items: Overflow[], find: (id: string) => any): Issue[] {
  return items.flatMap((o) => {
    const node = find(o.nodeId);
    if (!node) return [];
    const over = Math.max(o.right - o.width, -o.left);
    const side = o.right - o.width > 0 ? 'direita' : 'esquerda';
    const base = { severity: 'erro' as const, type: 'vazamento' as const, layerId: node.id, layerName: node.name, where: o.label };
    if (node.type === 'text') {
      return [{ ...base, message: `“${node.name}” passa ${Math.round(over)}px da tela pela ${side} (${o.label}): o texto não quebra linha.`, fix: 'Use sizeX:"fill" no texto (numa coluna) para ele quebrar linha; se ele precisa ser "hug", limite com maxW.' }];
    }
    if (node.sizeX === 'fixed' || node.sizeX == null) {
      return [{ ...base, message: `“${node.name}” tem largura fixa (${Math.round(node.w)}px) e passa ${Math.round(over)}px da tela (${o.label}).`, fix: 'Neste breakpoint use set_responsive com sizeX:"fill" (ou um w menor); para a tela inteira, ative fluid:true.' }];
    }
    return [{ ...base, message: `“${node.name}” passa ${Math.round(over)}px da tela pela ${side} (${o.label}); algo dentro dele é mais largo que a tela.`, fix: 'Procure os filhos de largura fixa ou texto que não quebra e ajuste com set_responsive neste breakpoint.' }];
  });
}

/** Junta, ordena (erros primeiro) e limita o relatório. */
export function auditReport(issues: Issue[]) {
  const sorted = [...issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'erro' ? -1 : 1));
  return {
    errors: issues.filter((i) => i.severity === 'erro').length,
    warnings: issues.filter((i) => i.severity === 'aviso').length,
    issues: sorted.slice(0, MAX_ISSUES),
    truncated: sorted.length > MAX_ISSUES,
  };
}
