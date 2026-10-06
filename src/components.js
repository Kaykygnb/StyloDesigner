// Componentes (principal + instâncias) e estilos compartilhados. Funções puras, testáveis no Node.
//
// Como funciona: uma instância guarda `instanceOf` (id do componente principal) e `base`, uma foto do que
// veio do principal na última sincronização. A cada commit comparamos a instância atual com `base`:
// o que for diferente é uma "sobrescrita" do usuário. Depois reconstruímos a instância a partir do principal
// e reaplicamos as sobrescritas. Resultado: mudar o principal atualiza todas as instâncias, sem perder
// textos, cores etc. que você mudou numa instância.
import { applyConstraints, cloneDeep, uid, walk } from './model.js';

/** Propriedades de camadas filhas que podem ser sobrescritas numa instância. */
export const OVERRIDE_PROPS = [
  'text', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textAlign',
  'textDecoration', 'fill', 'stroke', 'opacity', 'visible', 'radius', 'shadows', 'blur', 'bgBlur', 'blend',
  'x', 'y', 'w', 'h', 'sizeX', 'sizeY', 'rotation', 'flipX', 'flipY', 'clip', 'layout', 'points', 'vw', 'vh', 'closed',
  'textStyleId',
];
/** Propriedades da raiz da instância que vêm do principal (posição, nome etc. são da própria instância). */
const ROOT_KEYS = OVERRIDE_PROPS.filter((k) => k !== 'x' && k !== 'y').concat(['grids']);

const pick = (node, keys) => {
  const out = {};
  for (const k of keys) if (node[k] !== undefined) out[k] = cloneDeep(node[k]);
  return out;
};

const diff = (cur, base) => {
  const out = {};
  for (const k of Object.keys(cur)) {
    if (JSON.stringify(cur[k]) !== JSON.stringify(base?.[k])) out[k] = cloneDeep(cur[k]);
  }
  return out;
};

const isEmpty = (o) => Object.keys(o).length === 0;

function contains(root, id) {
  let found = false;
  walk(root.children || [], (n) => { if (n.id === id) found = true; });
  return found;
}

function collectMains(pages) {
  const mains = new Map();
  for (const page of pages) walk(page.children, (n) => { if (n.component) mains.set(n.id, n); });
  return mains;
}

function syncOne(inst, main) {
  if (!main || main === inst || contains(main, inst.id)) {
    // principal apagado (ou ciclo): a instância vira um nó comum
    delete inst.instanceOf;
    delete inst.base;
    return;
  }
  const overrides = {};
  if (inst.base) {
    const rootDiff = diff(pick(inst, ROOT_KEYS), inst.base['']);
    if (!isEmpty(rootDiff)) overrides[''] = rootDiff;
    walk(inst.children || [], (k) => {
      if (!k.srcId || !inst.base[k.srcId]) return;
      const d = diff(pick(k, OVERRIDE_PROPS), inst.base[k.srcId]);
      if (!isEmpty(d)) overrides[k.srcId] = d;
    });
  }

  // 1) raiz: copia do principal
  const kids = cloneDeep(main.children || []);
  const rename = (list) => list.forEach((k) => {
    k.srcId = k.id;
    k.id = `${inst.id}~${k.id}`;
    delete k.component; delete k.instanceOf; delete k.base;
    if (k.children) rename(k.children);
  });
  rename(kids);
  for (const key of ROOT_KEYS) {
    if (main[key] === undefined) delete inst[key];
    else inst[key] = cloneDeep(main[key]);
  }
  inst.type = main.type;
  const mw = inst.w, mh = inst.h;
  const baseRoot = pick(inst, ROOT_KEYS);

  // 2) sobrescritas da raiz (ex.: instância redimensionada) e constraints dos filhos
  if (overrides['']) Object.assign(inst, cloneDeep(overrides['']));
  if (main.children) {
    inst.children = kids;
    applyConstraints(inst, mw, mh);
  }

  // 3) foto base (puro do principal, já com constraints) e sobrescritas dos filhos
  const base = { '': baseRoot };
  walk(kids, (k) => { base[k.srcId] = pick(k, OVERRIDE_PROPS); });
  walk(kids, (k) => {
    if (overrides[k.srcId]) Object.assign(k, cloneDeep(overrides[k.srcId]));
  });
  inst.base = base;
}

/** Sincroniza todas as instâncias de todas as páginas com seus componentes principais. */
export function syncInstances(pages) {
  const mains = collectMains(pages);
  const instances = [];
  for (const page of pages) walk(page.children, (n) => { if (n.instanceOf) instances.push(n); });
  for (const inst of instances) syncOne(inst, mains.get(inst.instanceOf));
}

/** Transforma um nó em componente principal (instâncias aninhadas dentro dele viram nós comuns). */
export function makeComponent(node) {
  node.component = true;
  delete node.instanceOf;
  delete node.base;
  walk(node.children || [], (k) => {
    delete k.instanceOf; delete k.base; delete k.component;
  });
}

/** Cria uma instância (já sincronizada) de um componente principal. */
export function createInstance(main, pages) {
  const inst = cloneDeep(main);
  delete inst.component;
  inst.id = uid();
  inst.instanceOf = main.id;
  inst.children = [];
  if (main.type === 'frame' || main.type === 'group') inst.children = [];
  else delete inst.children;
  syncInstances(pages.concat([{ children: [inst] }]));
  return inst;
}

export function detachInstance(inst) {
  delete inst.instanceOf;
  delete inst.base;
  walk(inst.children || [], (k) => { delete k.srcId; });
}

// ------------------------------------------------------------------ estilos compartilhados
const TEXT_STYLE_KEYS = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing'];

export const textStyleFrom = (node) => pick(node, TEXT_STYLE_KEYS);

/** Copia cor/tipografia dos estilos compartilhados para as camadas que os usam. */
export function syncStyles(doc) {
  const styles = doc.styles;
  for (const page of doc.pages) {
    walk(page.children, (n) => {
      if (n.fill?.styleId) {
        const st = styles?.colors?.find((c) => c.id === n.fill.styleId);
        if (!st) delete n.fill.styleId;
        else if (n.fill.type === 'solid') { n.fill.color = st.color; n.fill.opacity = st.opacity; }
      }
      if (n.textStyleId) {
        const st = styles?.texts?.find((t) => t.id === n.textStyleId);
        if (!st) delete n.textStyleId;
        else Object.assign(n, pick(st, TEXT_STYLE_KEYS));
      }
    });
  }
}
