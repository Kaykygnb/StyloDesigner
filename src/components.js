/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  components.js — COMPONENTES (PRINCIPAL + INSTÂNCIAS) E ESTILOS COMPARTILHADOS   (módulo puro)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  COMO FUNCIONA UM COMPONENTE
 *    - O "principal" é uma camada marcada com `component: true`.
 *    - Uma "instância" é uma cópia dele que guarda `instanceOf` (id do principal) e `base`, uma FOTO de como a
 *      instância estava na última sincronização.
 *    - A cada commit comparamos a instância atual com `base`: o que for diferente é uma SOBRESCRITA do usuário
 *      (ex.: ele trocou o texto do botão). Aí reconstruímos a instância a partir do principal e reaplicamos as
 *      sobrescritas por cima.
 *    RESULTADO: mexeu no principal → todas as instâncias atualizam; mas o texto/cor que você personalizou
 *    numa instância continua lá.
 *
 *  ESTILOS COMPARTILHADOS
 *    Estilos de cor e de texto vivem em doc.styles. Camadas ligadas a um estilo copiam os valores dele a cada commit.
 *
 *  Testado em tests/features.test.js (sem navegador).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { applyConstraints, cloneDeep, uid, walk } from './model.js';

/**
 * Quais propriedades de uma camada FILHA podem ser sobrescritas dentro de uma instância (texto, cor, tamanho,
 * visibilidade...). Propriedades que não estão aqui (ex.: nome, id, constraints) sempre vêm do principal.
 */
export const OVERRIDE_PROPS = [
  'text', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textAlign',
  'textDecoration', 'fill', 'stroke', 'opacity', 'visible', 'radius', 'shadows', 'blur', 'bgBlur', 'blend',
  'x', 'y', 'w', 'h', 'sizeX', 'sizeY', 'rotation', 'flipX', 'flipY', 'clip', 'layout', 'points', 'vw', 'vh', 'closed',
  'textStyleId', 'minW', 'maxW', 'minH', 'maxH', 'aspect', 'wordSpacing', 'truncate', 'lines', 'margin', 'fx', 'states', 'transition', 'cursor', 'grow', 'overflow',
];
/**
 * Propriedades da RAIZ da instância que vêm do principal. `x` e `y` ficam de fora: cada instância tem a sua
 * própria posição no canvas. (O nome também é da instância.)
 */
const ROOT_KEYS = OVERRIDE_PROPS.filter((k) => k !== 'x' && k !== 'y' && k !== 'margin' && k !== 'grow').concat(['grids']); // margem e peso no flex são do lugar da instância, como x/y

/** Copia só as chaves pedidas (cópia profunda). Ex.: pick(no, ['fill','opacity']). */
const pick = (node, keys) => {
  const out = {};
  for (const k of keys) if (node[k] !== undefined) out[k] = cloneDeep(node[k]);
  return out;
};

/** Devolve só as chaves em que `cur` difere de `base`. É assim que detectamos o que o usuário SOBRESCREVEU. */
const diff = (cur, base) => {
  const out = {};
  for (const k of Object.keys(cur)) {
    if (JSON.stringify(cur[k]) !== JSON.stringify(base?.[k])) out[k] = cloneDeep(cur[k]);
  }
  return out;
};

/** Objeto sem nenhuma chave? */
const isEmpty = (o) => Object.keys(o).length === 0;

/** `id` está dentro de `root` (em qualquer profundidade)? Usado para detectar ciclo (instância dentro do próprio principal). */
function contains(root, id) {
  let found = false;
  walk(root.children || [], (n) => { if (n.id === id) found = true; });
  return found;
}

/** Mapa id → componente principal de todas as páginas (um componente pode ser usado em outra página). */
function collectMains(pages) {
  const mains = new Map();
  for (const page of pages) walk(page.children, (n) => { if (n.component) mains.set(n.id, n); });
  return mains;
}

/**
 * Atualiza UMA instância a partir do principal, preservando as sobrescritas do usuário. Passos:
 *   0. Descobre as sobrescritas: compara a instância atual com `inst.base` (a foto da última sincronização).
 *   1. Reconstrói os filhos como cópia do principal. Cada filho ganha id estável `<idDaInstancia>~<idOriginal>` e
 *      guarda `srcId` (o id no principal) — ids estáveis mantêm a seleção e o histórico funcionando.
 *   2. Reaplica as sobrescritas da raiz e as constraints se a instância foi redimensionada.
 *   3. Tira uma foto nova (`base`) do estado "puro do principal" e reaplica as sobrescritas dos filhos.
 * Se o principal sumiu (ou há ciclo), a instância vira uma camada comum.
 */
function syncOne(inst, main) {
  if (!main || main === inst || contains(main, inst.id)) {
    // principal apagado (ou ciclo): a instância vira um nó comum
    delete inst.instanceOf;
    delete inst.base;
    return;
  }
  // overrides: { '': {raiz}, [srcId]: {props sobrescritas do filho} }
  const overrides = {};
  // Só dá para detectar sobrescritas se já houve uma sincronização anterior (existe `base`).
  if (inst.base) {
    const rootDiff = diff(pick(inst, ROOT_KEYS), inst.base['']);
    if (!isEmpty(rootDiff)) overrides[''] = rootDiff;
    walk(inst.children || [], (k) => {
      if (!k.srcId || !inst.base[k.srcId]) return;
      const d = diff(pick(k, OVERRIDE_PROPS), inst.base[k.srcId]);
      if (!isEmpty(d)) overrides[k.srcId] = d;
    });
  }

  // 1) filhos novos = cópia do principal, com ids estáveis e srcId
  const kids = cloneDeep(main.children || []);
  const rename = (list) => list.forEach((k) => {
    k.srcId = k.id;
    k.id = `${inst.id}~${k.id}`;
    delete k.component; delete k.instanceOf; delete k.base;
    if (k.children) rename(k.children);
  });
  rename(kids);
  // copia as propriedades da raiz do principal (menos x/y); o que o principal não tem é removido da instância
  for (const key of ROOT_KEYS) {
    if (main[key] === undefined) delete inst[key];
    else inst[key] = cloneDeep(main[key]);
  }
  inst.type = main.type;
  // tamanho da instância ANTES de reaplicar as sobrescritas (base para calcular as constraints)
  const mw = inst.w, mh = inst.h;
  const baseRoot = pick(inst, ROOT_KEYS);

  // 2) sobrescritas da raiz (ex.: usuário redimensionou a instância) e constraints dos filhos
  if (overrides['']) Object.assign(inst, cloneDeep(overrides['']));
  if (main.children) {
    inst.children = kids;
    applyConstraints(inst, mw, mh);
  }

  // 3) foto "pura" para a próxima comparação, e depois as sobrescritas dos filhos por cima
  const base = { '': baseRoot };
  // foto: o que o principal manda, por srcId
  walk(kids, (k) => { base[k.srcId] = pick(k, OVERRIDE_PROPS); });
  // reaplica o que o usuário tinha mudado em cada filho
  walk(kids, (k) => {
    if (overrides[k.srcId]) Object.assign(k, cloneDeep(overrides[k.srcId]));
  });
  inst.base = base;
}

/**
 * Sincroniza TODAS as instâncias de TODAS as páginas com seus principais. Chamada a cada commit do store, então
 * editar o componente principal atualiza as instâncias na hora, sem ninguém pedir.
 */
export function syncInstances(pages) {
  const mains = collectMains(pages);
  const instances = [];
  for (const page of pages) walk(page.children, (n) => { if (n.instanceOf) instances.push(n); });
  for (const inst of instances) syncOne(inst, mains.get(inst.instanceOf));
}

/**
 * Marca uma camada como COMPONENTE PRINCIPAL. Instâncias que estivessem dentro dela viram camadas comuns
 * (não suportamos componente dentro de componente, para evitar ciclos).
 */
export function makeComponent(node) {
  node.component = true;
  delete node.instanceOf;
  delete node.base;
  walk(node.children || [], (k) => {
    delete k.instanceOf; delete k.base; delete k.component;
  });
}

/**
 * Cria uma instância de `main` já preenchida (filhos copiados). Os filhos são montados por syncInstances,
 * por isso passamos uma "página falsa" contendo só a instância nova.
 * @param {object} main  componente principal
 * @param {object[]} pages  páginas do documento (para achar o principal)
 */
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

/** "Desanexar": a instância vira uma camada comum, sem ligação com o principal (os filhos mantêm a aparência atual). */
export function detachInstance(inst) {
  delete inst.instanceOf;
  delete inst.base;
  walk(inst.children || [], (k) => { delete k.srcId; });
}

// ------------------------------------------------------------------ estilos compartilhados
/** Campos de tipografia que um ESTILO DE TEXTO controla. */
const TEXT_STYLE_KEYS = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing'];

/** Extrai de uma camada de texto os campos de tipografia (para criar um estilo de texto a partir dela). */
export const textStyleFrom = (node) => pick(node, TEXT_STYLE_KEYS);

/**
 * Propaga os estilos compartilhados: toda camada ligada a um estilo (fill.styleId / textStyleId) recebe os valores
 * atuais dele. Se o estilo foi apagado, o vínculo é removido e a camada mantém os últimos valores.
 */
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
