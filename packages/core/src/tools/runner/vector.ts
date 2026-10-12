/** Inspeção e edição estruturada de vetores, sem round-trip de SVG. */
import type { RunnerContext, ToolArgs, ToolHandlers } from './types.ts';
import { createNode, defaultFill, defaultStroke } from '../../model.js';

const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
function parametricPoints(kind: 'polygon' | 'star', w: number, h: number, sides: number, innerRatio: number) {
  const count = kind === 'star' ? sides * 2 : sides;
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    const radius = kind === 'star' && i % 2 ? innerRatio : 1;
    return { x: Math.round((w / 2 + (Math.cos(angle) * w * radius) / 2) * 100) / 100, y: Math.round((h / 2 + (Math.sin(angle) * h * radius) / 2) * 100) / 100, hin: null, hout: null };
  });
}
const point = (p: any, index: number) => ({
  index,
  x: p.x,
  y: p.y,
  ...(p.hin ? { hin: { x: p.hin.x, y: p.hin.y } } : {}),
  ...(p.hout ? { hout: { x: p.hout.x, y: p.hout.y } } : {}),
  ...(p.mode ? { mode: p.mode } : {}),
});

const lerp = (a: number, b: number, t: number) => Math.round((a + (b - a) * t) * 100) / 100;
const lerpPoint = (a: any, b: any, t: number) => {
  const mixHandle = (ha: any, hb: any) => {
    if (!ha && !hb) return null;
    const pa = ha || a, pb = hb || b;
    return { x: lerp(pa.x, pb.x, t), y: lerp(pa.y, pb.y, t) };
  };
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), hin: mixHandle(a.hin, b.hin), hout: mixHandle(a.hout, b.hout) };
};

function contoursOf(node: any) {
  return [{ points: node.points || [], closed: node.closed !== false }, ...(node.contours || [])].map((contour) => contour || { points: [], closed: true });
}

export function createVectorTools(ctx: RunnerContext): ToolHandlers {
  const { store, need, commands, targetList, insertAt } = ctx;
  return {
    audit_vector({ id, includeInvisible = true, maxIssues = 100 }: ToolArgs = {}) {
      const roots = id ? [need(id)] : store.page().children;
      const paths: any[] = [];
      const visit = (node: any) => {
        if (node.type === 'path') paths.push(node);
        for (const child of node.children || []) visit(child);
      };
      roots.forEach(visit);
      if (id && paths.length === 0) throw new Error('audit_vector só aceita uma camada path ou uma camada que contenha vetores.');
      const issues: any[] = [];
      const add = (node: any, code: string, severity: 'error' | 'warning', message: string, fix: string) => {
        if (issues.length < Math.max(1, Math.min(500, Number(maxIssues) || 100))) issues.push({ id: node.id, name: node.name, code, severity, message, fix });
      };
      for (const node of paths) {
        const invisible = node.visible === false || node.opacity === 0 || node.w <= 0 || node.h <= 0;
        if (invisible && !includeInvisible) continue;
        const contours = contoursOf(node);
        const points = contours.flatMap((contour) => contour.points || []);
        if (!points.length) add(node, 'empty_path', 'error', 'O vetor não tem nós.', 'Adicione pelo menos dois nós ou remova a camada.');
        else if (points.length === 1) add(node, 'single_point', 'error', 'O vetor tem apenas um nó e não produz uma geometria útil.', 'Adicione um segundo nó ou remova a camada.');
        if (!finite(node.vw) || !finite(node.vh) || node.vw <= 0 || node.vh <= 0) add(node, 'invalid_viewbox', 'error', 'O viewBox do vetor é inválido.', 'Defina vw e vh positivos antes de exportar.');
        for (const [contourIndex, contour] of contours.entries()) {
          const seen = new Set<string>();
          for (const [nodeIndex, p] of (contour.points || []).entries()) {
            if (!finite(p.x) || !finite(p.y)) add(node, 'invalid_point', 'error', `O nó ${nodeIndex} do contorno ${contourIndex} tem coordenada inválida.`, 'Edite o nó com edit_vector_node usando números finitos.');
            const key = `${p.x},${p.y}`;
            if (seen.has(key)) add(node, 'duplicate_point', 'warning', `O contorno ${contourIndex} repete o ponto ${nodeIndex}.`, 'Remova o nó duplicado ou mova-o se a repetição for intencional.');
            seen.add(key);
            for (const handle of ['hin', 'hout']) if (p[handle] && (!finite(p[handle].x) || !finite(p[handle].y))) add(node, 'invalid_handle', 'error', `A alça ${handle} do nó ${nodeIndex} é inválida.`, 'Remova ou reposicione a alça com edit_vector_node.');
          }
          if (contour.points?.length >= 2 && contour.points.every((p: any) => p.x === contour.points[0].x && p.y === contour.points[0].y)) add(node, 'zero_area_contour', 'warning', `O contorno ${contourIndex} tem área geométrica zero.`, 'Mova um nó, remova o contorno ou use-o apenas como marcador.');
          if (contour.points?.length >= 2 && contour.closed === false && node.fill?.type !== 'none') add(node, 'open_filled_path', 'warning', `O contorno ${contourIndex} está aberto mas tem preenchimento.`, 'Feche o caminho ou use fill none para evitar uma área implícita inesperada.');
        }
        if (node.boolean && (!Array.isArray(node.boolean.sources) || !node.boolean.sources.length)) add(node, 'broken_boolean', 'error', 'A operação booleana não tem fontes preservadas.', 'Recrie a operação a partir das formas originais.');
        if (node.pathEffect && (node.pathEffect.kind !== 'round-corners' || !finite(node.pathEffect.radius) || node.pathEffect.radius <= 0)) add(node, 'invalid_path_effect', 'error', 'O efeito de caminho tem configuração inválida.', 'Remova o efeito ou use set_path_effect com kind round-corners e radius positivo.');
        if (invisible) add(node, 'invisible_vector', 'warning', 'O vetor não aparece no canvas por visibilidade, opacidade ou tamanho.', 'Verifique visible, opacity, w e h antes de exportar.');
        if (node.blur > 24 || node.bgBlur > 24) add(node, 'heavy_filter', 'warning', 'O vetor usa um blur alto e pode pesar no canvas/exportação.', 'Reduza o blur ou aplique o efeito somente onde for necessário.');
      }
      return { count: paths.length, issueCount: issues.length, errors: issues.filter((issue) => issue.severity === 'error').length, warnings: issues.filter((issue) => issue.severity === 'warning').length, issues, truncated: issues.length >= Math.max(1, Math.min(500, Number(maxIssues) || 100)) };
    },
    inspect_vector({ id, contour_index, node_index, max_points = 500, maxBytes = 16384 }: ToolArgs) {
      const node = need(id);
      if (node.type !== 'path') throw new Error('inspect_vector só aceita camadas type "path".');
      const contours = contoursOf(node);
      const chosen = contour_index === undefined ? contours.map((_, index) => index) : [contour_index];
      if (chosen.some((index) => !Number.isInteger(index) || index < 0 || index >= contours.length)) throw new Error(`contour_index precisa estar entre 0 e ${contours.length - 1}.`);
      const limit = Math.max(1, Math.min(500, Number(max_points) || 500));
      const result = {
        id: node.id, name: node.name, type: node.type, w: node.w, h: node.h, vw: node.vw, vh: node.vh,
        fillRule: node.fillRule || 'nonzero',
        pathEffect: node.pathEffect ? { kind: node.pathEffect.kind, radius: node.pathEffect.radius } : null,
        ...(node.vectorNetwork ? {
          vectorNetwork: {
            nodeCount: Array.isArray(node.vectorNetwork.nodes) ? node.vectorNetwork.nodes.length : 0,
            segmentCount: Array.isArray(node.vectorNetwork.segments) ? node.vectorNetwork.segments.length : 0,
            nodes: (node.vectorNetwork.nodes || []).slice(0, limit).map((item: any) => ({ id: item.id, x: item.x, y: item.y })),
            segments: (node.vectorNetwork.segments || []).slice(0, limit).map((item: any) => ({
              id: item.id, from: item.from, to: item.to, kind: item.kind,
              ...(item.houtFrom ? { houtFrom: { x: item.houtFrom.x, y: item.houtFrom.y } } : {}),
              ...(item.hinTo ? { hinTo: { x: item.hinTo.x, y: item.hinTo.y } } : {}),
            })),
            truncated: (node.vectorNetwork.nodes || []).length > limit || (node.vectorNetwork.segments || []).length > limit,
          },
        } : {}),
        contours: chosen.map((index) => {
          const contour = contours[index];
          const all = contour.points.map(point);
          const points = node_index === undefined ? all.slice(0, limit) : all.filter((p) => p.index === node_index);
          return { index, closed: contour.closed !== false, count: all.length, points, truncated: points.length < all.length && node_index === undefined };
        }),
      };
      let json = JSON.stringify(result);
      if (new TextEncoder().encode(json).length <= maxBytes) return result;
      // O orçamento é uma proteção contra caminhos enormes; nunca corta JSON no meio.
      const compact = { ...result, contours: result.contours.map((contour) => ({ ...contour, points: contour.points.slice(0, 1), truncated: true })) };
      json = JSON.stringify(compact);
      if (new TextEncoder().encode(json).length > maxBytes) throw new Error('O vetor excede maxBytes mesmo em formato compacto. Aumente maxBytes ou peça um contour_index/node_index específico.');
      return compact;
    },
    create_vector_network({ name, nodes, segments, parent_id, index, fill = 'none', stroke }: ToolArgs) {
      if (!Array.isArray(nodes) || nodes.length < 2 || nodes.length > 200) throw new Error('nodes precisa ter entre 2 e 200 junções.');
      if (!Array.isArray(segments) || segments.length < 1 || segments.length > 400) throw new Error('segments precisa ter entre 1 e 400 segmentos.');
      const ids = new Set<string>();
      const junctions = nodes.map((n: any, i: number) => {
        const id = String(n?.id || `j${i + 1}`);
        if (ids.has(id)) throw new Error(`A junção “${id}” aparece mais de uma vez.`);
        if (!finite(n?.x) || !finite(n?.y)) throw new Error(`A junção “${id}” precisa de x e y finitos.`);
        ids.add(id);
        return { id, x: Number(n.x), y: Number(n.y) };
      });
      const byId = new Map(junctions.map((n) => [n.id, n]));
      const cleanPoint = (p: any, label: string) => {
        if (!finite(p?.x) || !finite(p?.y)) throw new Error(`${label} precisa ser {x, y} finitos.`);
        return { x: Number(p.x), y: Number(p.y) };
      };
      const rawSegments = segments.map((s: any, i: number) => {
        const from = byId.get(String(s?.from)), to = byId.get(String(s?.to));
        if (!from || !to || from.id === to.id) throw new Error(`O segmento ${i} referencia junções inválidas ou iguais.`);
        const out: any = { id: String(s?.id || `s${i + 1}`), from: from.id, to: to.id, kind: s?.kind === 'cubic' ? 'cubic' : 'line' };
        if (s?.hout_from !== undefined) out.houtFrom = cleanPoint(s.hout_from, `hout_from do segmento ${i}`);
        if (s?.hin_to !== undefined) out.hinTo = cleanPoint(s.hin_to, `hin_to do segmento ${i}`);
        if (out.kind === 'cubic' && (!out.houtFrom || !out.hinTo)) throw new Error(`O segmento cúbico ${i} precisa de hout_from e hin_to.`);
        return out;
      });
      const all = junctions.flatMap((n) => [{ x: n.x, y: n.y }, ...rawSegments.flatMap((s: any) => [s.houtFrom, s.hinTo].filter(Boolean))]);
      const x0 = Math.min(...all.map((p) => p.x)), y0 = Math.min(...all.map((p) => p.y));
      const x1 = Math.max(...all.map((p) => p.x)), y1 = Math.max(...all.map((p) => p.y));
      const local = (p: any) => ({ x: Math.round((p.x - x0) * 100) / 100, y: Math.round((p.y - y0) * 100) / 100 });
      const contourFor = (s: any) => {
        const a = byId.get(s.from), b = byId.get(s.to);
        return {
          closed: false,
          points: [
            { ...local(a), hin: null, hout: s.houtFrom ? local(s.houtFrom) : null },
            { ...local(b), hin: s.hinTo ? local(s.hinTo) : null, hout: null },
          ],
        };
      };
      const [main, ...rest] = rawSegments.map(contourFor);
      const node = createNode('path', {
        name: String(name || 'Rede vetorial').trim() || 'Rede vetorial', x: x0, y: y0,
        w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0), vw: Math.max(1, x1 - x0), vh: Math.max(1, y1 - y0),
        points: main.points, closed: false, ...(rest.length ? { contours: rest } : {}),
        fill: typeof fill === 'string' ? (fill.toLowerCase() === 'none' ? { ...defaultFill(), type: 'none' } : defaultFill(fill)) : fill,
        stroke: stroke ? { ...defaultStroke(), ...stroke } : null,
        vectorNetwork: { nodes: junctions, segments: rawSegments },
      });
      const list = targetList(parent_id);
      store.update(() => insertAt(list, node, index), { structural: true });
      store.setSelection([node.id]);
      return { created: { id: node.id, name: node.name }, junctionCount: junctions.length, segmentCount: rawSegments.length, contours: rawSegments.length };
    },
    edit_vector_node({ id, contour_index = 0, node_index, point: position, hin, hout, mode }: ToolArgs) {
      const node = need(id);
      if (node.type !== 'path') throw new Error('edit_vector_node só aceita camadas type "path".');
      if (!Number.isInteger(node_index)) throw new Error('node_index precisa ser um inteiro.');
      if (position && (!finite(position.x) && !finite(position.y))) throw new Error('point precisa trazer x ou y como número.');
      if (hin !== undefined && hin !== null && (!finite(hin.x) || !finite(hin.y))) throw new Error('hin precisa ser {x, y} ou null.');
      if (hout !== undefined && hout !== null && (!finite(hout.x) || !finite(hout.y))) throw new Error('hout precisa ser {x, y} ou null.');
      if (mode !== undefined && mode !== null && !['corner', 'smooth', 'symmetric', 'free'].includes(mode)) throw new Error('mode precisa ser corner, smooth, symmetric ou free.');
      const out = commands.editPathNode(id, contour_index, node_index, { point: position, hin, hout, mode });
      if (out?.error) throw new Error(out.error);
      return { id, contourIndex: contour_index, nodeIndex: node_index, changed: true };
    },
    edit_vector_shape({ id, sides, inner_ratio }: ToolArgs) {
      const node = need(id);
      if (node.type !== 'path' || !node.shape || !['polygon', 'star'].includes(node.shape.kind)) throw new Error('edit_vector_shape só aceita um polígono ou estrela paramétrico.');
      const nextSides = sides === undefined ? node.shape.sides : sides;
      const nextRatio = inner_ratio === undefined ? node.shape.innerRatio : inner_ratio;
      if (!Number.isInteger(nextSides) || nextSides < 3 || nextSides > 24) throw new Error('sides precisa ser um inteiro entre 3 e 24.');
      if (!finite(nextRatio) || nextRatio <= 0 || nextRatio > 1) throw new Error('inner_ratio precisa estar entre 0 e 1.');
      const w = Number(node.vw ?? node.w), h = Number(node.vh ?? node.h);
      if (!finite(w) || !finite(h) || w <= 0 || h <= 0) throw new Error('O vetor tem viewBox inválido para regenerar a forma.');
      store.update(() => {
        node.shape = { kind: node.shape.kind, sides: nextSides, innerRatio: nextRatio };
        node.points = parametricPoints(node.shape.kind, w, h, nextSides, nextRatio);
        node.closed = true;
      });
      store.setSelection([node.id]);
      return { id, shape: node.shape, pointCount: node.points.length };
    },
    set_path_effect({ id, kind = 'round-corners', radius }: ToolArgs) {
      const node = need(id);
      if (node.type !== 'path') throw new Error('set_path_effect só aceita camadas type "path".');
      if (kind !== 'round-corners' && kind !== 'none') throw new Error('kind precisa ser round-corners ou none.');
      if (kind === 'round-corners' && (!finite(radius) || radius <= 0 || radius > 100000)) throw new Error('radius precisa ser um número maior que zero e menor que 100000.');
      store.update(() => { node.pathEffect = kind === 'none' ? null : { kind, radius: Math.round(radius * 100) / 100 }; });
      store.setSelection([node.id]);
      return { id, pathEffect: node.pathEffect };
    },
    interpolate_vectors({ from_id, to_id, t = 0.5, name }: ToolArgs) {
      const from = need(from_id), to = need(to_id);
      if (from.type !== 'path' || to.type !== 'path') throw new Error('interpolate_vectors só aceita duas camadas path.');
      if (from.id === to.id) throw new Error('Escolha duas camadas diferentes para interpolar.');
      if (store.parentOf(from.id) !== store.parentOf(to.id)) throw new Error('As duas formas precisam estar no mesmo pai.');
      if (!finite(t) || t < 0 || t > 1) throw new Error('t precisa estar entre 0 e 1.');
      const a = contoursOf(from), b = contoursOf(to);
      if (a.length !== b.length || a.some((c, i) => c.closed !== b[i].closed || c.points.length !== b[i].points.length)) throw new Error('As formas precisam ter a mesma quantidade de contornos, nós e fechamento.');
      if (from.vw !== to.vw || from.vh !== to.vh) throw new Error('As formas precisam ter o mesmo viewBox para interpolar sem deformação.');
      const contours = a.map((c, i) => ({ closed: c.closed !== false, points: c.points.map((p, j) => lerpPoint(p, b[i].points[j], t)) }));
      const [main, ...rest] = contours;
      const node = createNode('path', {
        name: name?.trim() || `Interpolação ${from.name || from.id} → ${to.name || to.id}`,
        x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), w: lerp(from.w, to.w, t), h: lerp(from.h, to.h, t),
        vw: from.vw, vh: from.vh, points: main.points, closed: main.closed,
        ...(rest.length ? { contours: rest } : {}),
        fill: JSON.parse(JSON.stringify(from.fill)), stroke: from.stroke ? JSON.parse(JSON.stringify(from.stroke)) : null,
      });
      const list = store.listOf(from.id);
      const at = Math.max(list.indexOf(from), list.indexOf(to)) + 1;
      store.update(() => list.splice(at, 0, node), { structural: true });
      store.setSelection([node.id]);
      return { created: { id: node.id, name: node.name }, from: from.id, to: to.id, t, pointCount: main.points.length, contourCount: contours.length };
    },
    reverse_vector({ id, contour_index }: ToolArgs) {
      const node = need(id);
      if (node.type !== 'path') throw new Error('reverse_vector só aceita camadas type "path".');
      if (contour_index !== undefined && (!Number.isInteger(contour_index) || contour_index < 0)) throw new Error('contour_index precisa ser um inteiro não negativo.');
      const out = commands.reversePath(id, contour_index);
      if (out?.error) throw new Error(out.error);
      return out;
    },
    split_vector_contour({ id, contour_index = 0, node_index }: ToolArgs) {
      const node = need(id);
      if (node.type !== 'path') throw new Error('split_vector_contour só aceita camadas type "path".');
      if (!Number.isInteger(contour_index) || contour_index < 0) throw new Error('contour_index precisa ser um inteiro não negativo.');
      if (!Number.isInteger(node_index) || node_index < 1) throw new Error('node_index precisa ser um inteiro maior que zero.');
      const out = commands.splitPathContour(id, contour_index, node_index);
      if (out?.error) throw new Error(out.error);
      return out;
    },
    join_vector_contours({ id }: ToolArgs) {
      const node = need(id);
      if (node.type !== 'path') throw new Error('join_vector_contours só aceita camadas type "path".');
      const out = commands.joinPathContours(id);
      if (out?.error) throw new Error(out.error);
      return out;
    },
    simplify_vector({ id, contour_index, tolerance = 1 }: ToolArgs) {
      const node = need(id);
      if (node.type !== 'path') throw new Error('simplify_vector só aceita camadas type "path".');
      if (contour_index !== undefined && (!Number.isInteger(contour_index) || contour_index < 0)) throw new Error('contour_index precisa ser um inteiro não negativo.');
      if (!finite(tolerance) || tolerance <= 0 || tolerance > 10000) throw new Error('tolerance precisa ser um número entre 0 e 10000.');
      const out = commands.simplifyPath(id, contour_index, tolerance);
      if (out?.error) throw new Error(out.error);
      return out;
    },
    stroke_to_path({ id, tolerance = 0.5 }: ToolArgs) {
      const node = need(id);
      if (node.type !== 'path') throw new Error('stroke_to_path só aceita camadas type "path".');
      if (!finite(tolerance) || tolerance <= 0 || tolerance > 100) throw new Error('tolerance precisa ser um número entre 0 e 100.');
      const out = commands.strokeToPath(id, tolerance);
      if (out?.error) throw new Error(out.error);
      return out;
    },
    offset_path({ id, distance, contour_index, tolerance = 0.5 }: ToolArgs) {
      const node = need(id);
      if (node.type !== 'path') throw new Error('offset_path só aceita camadas type "path".');
      if (!finite(distance) || distance === 0 || Math.abs(distance) > 100000) throw new Error('distance precisa ser finito, diferente de zero e estar entre -100000 e 100000.');
      if (contour_index !== undefined && (!Number.isInteger(contour_index) || contour_index < 0)) throw new Error('contour_index precisa ser um inteiro não negativo.');
      const out = commands.offsetPath(id, distance, contour_index, tolerance);
      if (out?.error) throw new Error(out.error);
      return out;
    },
  };
}
