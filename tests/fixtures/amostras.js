/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  amostras.js — DOCUMENTOS DE TESTE (antigos exemplos "Landing" e "App mobile")
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Documento de demonstração carregado na primeira abertura. Mostra auto layout (flexbox), gradientes,
 *  sombras e blur. Também é a base das capturas de tela do README.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { createNode, makeDoc, defaultFill, defaultShadow, defaultStroke } from '../../src/model.js';
import { createInstance, makeComponent, syncInstances } from '../../src/components.js';

/** Atalho para criar uma camada de texto: o nome da camada é o início do próprio texto. */
const text = (t, props = {}) => createNode('text', { name: t.slice(0, 24), text: t, ...props });
/** Preenchimento de cor sólida com opacidade opcional. */
const solid = (color, opacity = 1) => ({ ...defaultFill(color), opacity });
/** Configuração de auto layout flex com valores-padrão do exemplo (cada chamada só diz o que muda). */
const flex = (mode, extra = {}) => ({
  mode, gap: 12, padding: [0, 0, 0, 0], justify: 'flex-start', align: 'flex-start', wrap: false, ...extra,
});

/**
 * Monta o projeto de EXEMPLO que aparece na primeira vez que o app abre (e em Arquivo → Carregar exemplo).
 * Serve de vitrine: 3 pranchas que usam auto layout em flexbox (linha e coluna), `fill`/`hug`, gradientes linear e
 * radial, sombras, blur, contorno translúcido, camada absoluta (orb) dentro de auto layout e efeito vidro
 * (backdrop-filter). Tudo é construído com createNode, o mesmo que o app usa.
 * @returns {object} um documento completo (ver model.js → makeDoc)
 */
export function buildSample() {
  const doc = makeDoc();
  doc.name = 'Exemplo — Landing';
  const page = doc.pages[0];

  // ------------------------------------------------------------ Hero (auto layout coluna)
  // PRANCHA 1 — "Hero": frame em COLUNA com padding; o fundo é um gradiente linear de 135°
  const hero = createNode('frame', {
    name: 'Hero', x: 0, y: 0, w: 720, h: 460,
    fill: { ...defaultFill(), type: 'linear', angle: 135, stops: [
      { color: '#1B1340', opacity: 1, pos: 0 }, { color: '#5B3DF5', opacity: 1, pos: 100 } ] },
    layout: flex('column', { gap: 20, padding: [56, 56, 56, 56], justify: 'center', align: 'flex-start' }),
  });

  // Selo "Novo • v0.1": auto layout em LINHA que se ajusta ao conteúdo (hug), cantos totalmente redondos
  const badge = createNode('frame', {
    name: 'Badge', w: 140, h: 30, sizeX: 'hug', sizeY: 'hug', radius: [99, 99, 99, 99],
    fill: solid('#FFFFFF', 0.14), stroke: { ...defaultStroke(), color: '#FFFFFF', opacity: 0.25 },
    layout: flex('row', { gap: 8, padding: [6, 14, 6, 14], align: 'center' }),
  });
  const dot = createNode('ellipse', { name: 'Dot', w: 8, h: 8, fill: solid('#4ADE80') });
  badge.children.push(dot, text('Novo • v0.1', { fontSize: 13, fontWeight: 600, fill: solid('#FFFFFF') }));

  // Título e subtítulo: textos com fonte grande/peso 800 e espaçamento negativo entre letras
  const title = text('Desenhe interfaces\ncom CSS de verdade', {
    name: 'Título', fontSize: 52, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5,
    fill: solid('#FFFFFF'),
  });
  const sub = text('Auto layout é flexbox, sombras são box-shadow,\ne tudo vira código limpo.', {
    name: 'Subtítulo', fontSize: 18, lineHeight: 1.5, fill: solid('#FFFFFF', 0.72),
  });

  // Linha de botões (frame invisível em linha, gap 12) — cada botão é um frame com padding e texto centralizado
  const buttons = createNode('frame', {
    name: 'Botões', w: 300, h: 48, sizeX: 'hug', sizeY: 'hug', fill: { ...defaultFill(), type: 'none' },
    layout: flex('row', { gap: 12 }),
  });
  // botão primário: branco com sombra grande e suave (box-shadow)
  const btn1 = createNode('frame', {
    name: 'Botão primário', sizeX: 'hug', sizeY: 'hug', radius: [12, 12, 12, 12], fill: solid('#FFFFFF'),
    shadows: [{ ...defaultShadow(), y: 10, blur: 30, color: '#0B0420', opacity: 0.4 }],
    layout: flex('row', { padding: [14, 24, 14, 24], justify: 'center', align: 'center' }),
  });
  btn1.children.push(text('Começar agora', { fontWeight: 700, fill: solid('#2B1B8F') }));
  // botão secundário: translúcido com contorno claro
  const btn2 = createNode('frame', {
    name: 'Botão secundário', sizeX: 'hug', sizeY: 'hug', radius: [12, 12, 12, 12],
    fill: solid('#FFFFFF', 0.1), stroke: { ...defaultStroke(), color: '#FFFFFF', opacity: 0.3 },
    layout: flex('row', { padding: [14, 24, 14, 24], justify: 'center', align: 'center' }),
  });
  btn2.children.push(text('Ver exemplos', { fontWeight: 600, fill: solid('#FFFFFF') }));
  buttons.children.push(btn1, btn2);

  // decoração: elipse com gradiente radial e blur, marcada `absolute` para IGNORAR o auto layout do pai
  const orb = createNode('ellipse', {
    name: 'Orb', absolute: true, x: 470, y: 60, w: 280, h: 280,
    fill: { ...defaultFill(), type: 'radial', stops: [
      { color: '#FF7AD9', opacity: 0.9, pos: 0 }, { color: '#7C5CFF', opacity: 0, pos: 70 } ] },
    blur: 8,
  });
  hero.children.push(orb, badge, title, sub, buttons);

  // ------------------------------------------------------------ Cartões (auto layout linha)
  // PRANCHA 2 — "Cartões": 3 cartões lado a lado; cada um usa sizeX/sizeY 'fill' (flex: 1) para dividir o espaço igualmente
  const cards = createNode('frame', {
    name: 'Cartões', x: 0, y: 520, w: 720, h: 200, fill: solid('#F4F3FF'),
    layout: flex('row', { gap: 16, padding: [24, 24, 24, 24] }),
  });
  /** Fábrica de cartão: ícone (emoji) + título + descrição, em coluna, com sombra azulada. */
  const mk = (emoji, name, desc, color) => {
    const c = createNode('frame', {
      name: `Cartão ${name}`, sizeX: 'fill', sizeY: 'fill', radius: [16, 16, 16, 16], fill: solid('#FFFFFF'),
      shadows: [{ ...defaultShadow(), y: 6, blur: 20, color: '#2B1B8F', opacity: 0.1 }],
      layout: flex('column', { gap: 8, padding: [20, 20, 20, 20] }),
    });
    const ico = createNode('frame', {
      name: 'Ícone', w: 40, h: 40, radius: [12, 12, 12, 12], fill: solid(color, 0.15),
      layout: flex('row', { justify: 'center', align: 'center' }),
    });
    ico.children.push(text(emoji, { fontSize: 20 }));
    c.children.push(
      ico,
      text(name, { fontSize: 16, fontWeight: 700, fill: solid('#1B1340') }),
      text(desc, { fontSize: 13, lineHeight: 1.5, sizeX: 'fill', fill: solid('#1B1340', 0.6) }),
    );
    return c;
  };
  cards.children.push(
    mk('⚡', 'Rápido', 'Tudo roda local, sem login e sem build.', '#F59E0B'),
    mk('🎨', 'Bonito', 'Gradientes, sombras e blur como no CSS.', '#7C5CFF'),
    mk('</>', 'Código', 'Copie o CSS e o HTML de qualquer camada.', '#10B981'),
  );

  // ------------------------------------------------------------ Card glass solto
  // PRANCHA 3 — cartão degradê com um painel de "vidro": fundo translúcido + backdrop-filter: blur
  const glass = createNode('frame', {
    name: 'Glass card', x: 800, y: 40, w: 300, h: 200, radius: [24, 24, 24, 24],
    fill: { ...defaultFill(), type: 'linear', angle: 160, stops: [
      { color: '#FF8A5B', opacity: 1, pos: 0 }, { color: '#FF3D81', opacity: 1, pos: 100 } ] },
    layout: flex('column', { padding: [24, 24, 24, 24], justify: 'flex-end' }),
  });
  // o painel de vidro é absoluto (fora do fluxo) e desfoca o degradê que está atrás dele
  const pane = createNode('frame', {
    name: 'Painel vidro', absolute: true, x: 24, y: 24, w: 252, h: 152, radius: [18, 18, 18, 18],
    fill: solid('#FFFFFF', 0.22), bgBlur: 18,
    stroke: { ...defaultStroke(), color: '#FFFFFF', opacity: 0.5 },
    shadows: [{ ...defaultShadow(), y: 12, blur: 32, opacity: 0.2 }],
  });
  glass.children.push(pane, text('backdrop-filter', {
    fontSize: 20, fontWeight: 700, fill: solid('#FFFFFF'),
  }));

  // ordem = ordem z; a prancha do vidro fica por último (por cima)
  page.children.push(hero, cards, glass);
  return doc;
}

/**
 * Segundo projeto de exemplo: um app de carteira digital (mobile). Demonstra o que o primeiro exemplo não mostra:
 *  - CSS GRID (as 4 "ações rápidas" estão numa grade de 4 colunas)
 *  - COMPONENTES: o botão "Ação" é um componente principal; as 4 ações são INSTÂNCIAS com texto/ícone sobrescritos
 *  - PROTÓTIPO: tocar em "Enviar" navega para a tela de sucesso, e o botão dela volta para o início
 *  - flexbox com `fill`/`hug`, gradientes, sombras e estilo de lista
 * Três pranchas lado a lado: Home, Sucesso e a prancha "Componentes" (onde mora o principal).
 * @returns {object} documento completo
 */
export function buildSampleApp() {
  const doc = makeDoc();
  doc.name = 'Exemplo — App mobile';
  const page = doc.pages[0];
  const ink = '#1B1340';
  const violet = '#7C5CFF';

  // ------------------------------------------------------------ componente principal "Ação" (ícone + rótulo)
  const actionMain = createNode('frame', {
    name: 'Ação', x: 24, y: 56, w: 80, h: 90, sizeX: 'hug', sizeY: 'hug', clip: false,
    fill: { ...defaultFill(), type: 'none' },
    layout: flex('column', { gap: 8, align: 'center' }),
  });
  const actionIcon = createNode('frame', {
    name: 'Ícone', w: 56, h: 56, radius: [18, 18, 18, 18], fill: solid(violet, 0.12),
    layout: flex('row', { justify: 'center', align: 'center' }),
  });
  actionIcon.children.push(text('💸', { name: 'Emoji', fontSize: 24 }));
  actionMain.children.push(actionIcon, text('Enviar', { name: 'Rótulo', fontSize: 12, fontWeight: 600, fill: solid(ink) }));
  makeComponent(actionMain);

  const library = createNode('frame', {
    name: 'Componentes', x: 940, y: 0, w: 128, h: 200, fill: solid('#FFFFFF'), radius: [24, 24, 24, 24],
  });
  library.children.push(actionMain);
  actionMain.x = 24; actionMain.y = 40;

  // ------------------------------------------------------------ tela 1: Home
  const home = createNode('frame', {
    name: 'Home', x: 0, y: 0, w: 390, h: 800, fill: solid('#F5F4FB'), radius: [32, 32, 32, 32],
    layout: flex('column', { gap: 20, padding: [32, 20, 24, 20] }),
  });

  const header = createNode('frame', {
    name: 'Cabeçalho', sizeX: 'fill', sizeY: 'hug', fill: { ...defaultFill(), type: 'none' },
    layout: flex('row', { gap: 12, justify: 'space-between', align: 'center' }),
  });
  const hello = createNode('frame', {
    name: 'Saudação', sizeX: 'hug', sizeY: 'hug', fill: { ...defaultFill(), type: 'none' }, layout: flex('column', { gap: 2 }),
  });
  hello.children.push(
    text('Olá, Kayky 👋', { name: 'Olá', fontSize: 14, fill: solid(ink, 0.6) }),
    text('Sua carteira', { name: 'Título', fontSize: 24, fontWeight: 800, letterSpacing: -0.5, fill: solid(ink) }),
  );
  const avatar = createNode('ellipse', {
    name: 'Avatar', w: 44, h: 44,
    fill: { ...defaultFill(), type: 'linear', angle: 135, stops: [{ color: '#FF8A5B', opacity: 1, pos: 0 }, { color: '#FF3D81', opacity: 1, pos: 100 }] },
    shadows: [{ ...defaultShadow(), y: 6, blur: 14, color: '#FF3D81', opacity: 0.35 }],
  });
  header.children.push(hello, avatar);

  const balance = createNode('frame', {
    name: 'Cartão de saldo', sizeX: 'fill', sizeY: 'hug', radius: [24, 24, 24, 24],
    fill: { ...defaultFill(), type: 'linear', angle: 135, stops: [{ color: violet, opacity: 1, pos: 0 }, { color: '#FF5CA8', opacity: 1, pos: 100 }] },
    shadows: [{ ...defaultShadow(), y: 16, blur: 36, color: violet, opacity: 0.4 }],
    layout: flex('column', { gap: 8, padding: [22, 22, 22, 22] }),
  });
  const chip = createNode('frame', {
    name: 'Variação', sizeX: 'hug', sizeY: 'hug', radius: [99, 99, 99, 99], fill: solid('#FFFFFF', 0.2),
    layout: flex('row', { padding: [5, 12, 5, 12] }),
  });
  chip.children.push(text('▲ 2,4% este mês', { name: 'Texto variação', fontSize: 12, fontWeight: 600, fill: solid('#FFFFFF') }));
  balance.children.push(
    text('Saldo disponível', { name: 'Rótulo saldo', fontSize: 13, fill: solid('#FFFFFF', 0.8) }),
    text('R$ 12.480,90', { name: 'Valor', fontSize: 34, fontWeight: 800, letterSpacing: -1, fill: solid('#FFFFFF') }),
    chip,
  );

  const quick = createNode('frame', {
    name: 'Ações rápidas', sizeX: 'fill', sizeY: 'hug', fill: { ...defaultFill(), type: 'none' },
    layout: { ...flex('grid', { gap: 12, justify: 'center', align: 'flex-start' }), cols: 4, rows: 0, colGap: 8, rowGap: 8 },
  });
  const actions = [['💸', 'Enviar'], ['📥', 'Receber'], ['🧾', 'Pagar'], ['💳', 'Cartões']];
  const instances = actions.map(([emoji, label], i) => {
    const inst = createInstance(actionMain, [{ children: [actionMain] }]);
    inst.name = `Ação ${label}`;
    inst.x = 0; inst.y = 0;
    // sobrescritas: troca o emoji e o rótulo de cada instância (o resto continua vindo do principal)
    const icon = inst.children[0].children[0];
    const lab = inst.children[1];
    icon.text = emoji; lab.text = label;
    if (i === 0) inst.interactions = [{ trigger: 'click', action: 'navigate', target: '', transition: 'slide-left' }];
    return inst;
  });
  quick.children.push(...instances);

  const activity = createNode('frame', {
    name: 'Atividade', sizeX: 'fill', sizeY: 'hug', fill: { ...defaultFill(), type: 'none' }, layout: flex('column', { gap: 10 }),
  });
  const row = (emoji, name, when, value, color) => {
    const r = createNode('frame', {
      name: `Lançamento ${name}`, sizeX: 'fill', sizeY: 'hug', radius: [16, 16, 16, 16], fill: solid('#FFFFFF'),
      shadows: [{ ...defaultShadow(), y: 4, blur: 16, color: '#2B1B8F', opacity: 0.08 }],
      layout: flex('row', { gap: 12, padding: [12, 14, 12, 14], align: 'center' }),
    });
    const ico = createNode('frame', {
      name: 'Ícone', w: 40, h: 40, radius: [12, 12, 12, 12], fill: solid(color, 0.14),
      layout: flex('row', { justify: 'center', align: 'center' }),
    });
    ico.children.push(text(emoji, { name: 'Emoji', fontSize: 18 }));
    const info = createNode('frame', {
      name: 'Info', sizeX: 'fill', sizeY: 'hug', fill: { ...defaultFill(), type: 'none' }, layout: flex('column', { gap: 2 }),
    });
    info.children.push(
      text(name, { name: 'Nome', fontSize: 14, fontWeight: 700, fill: solid(ink) }),
      text(when, { name: 'Data', fontSize: 12, fill: solid(ink, 0.5) }),
    );
    r.children.push(ico, info, text(value, { name: 'Valor', fontSize: 14, fontWeight: 700, fill: solid(value.startsWith('+') ? '#0E9F6E' : ink) }));
    return r;
  };
  activity.children.push(
    row('🛒', 'Mercado Bom Preço', 'Hoje, 09:41', '− R$ 186,40', '#F59E0B'),
    row('💼', 'Salário', 'Ontem', '+ R$ 8.200,00', '#10B981'),
    row('🍕', 'Pizzaria Napoli', 'Ter, 20:15', '− R$ 74,90', '#EF4444'),
  );
  home.children.push(
    header, balance,
    text('Ações rápidas', { name: 'Título ações', fontSize: 16, fontWeight: 700, fill: solid(ink) }),
    quick,
    text('Atividade recente', { name: 'Título atividade', fontSize: 16, fontWeight: 700, fill: solid(ink) }),
    activity,
  );

  // ------------------------------------------------------------ tela 2: Sucesso
  const done = createNode('frame', {
    name: 'Sucesso', x: 470, y: 0, w: 390, h: 800, radius: [32, 32, 32, 32],
    fill: { ...defaultFill(), type: 'linear', angle: 160, stops: [{ color: '#1B1340', opacity: 1, pos: 0 }, { color: '#5B3DF5', opacity: 1, pos: 100 }] },
    layout: flex('column', { gap: 14, padding: [40, 28, 40, 28], justify: 'center', align: 'center' }),
  });
  const check = createNode('ellipse', {
    name: 'Selo', w: 112, h: 112,
    fill: { ...defaultFill(), type: 'radial', stops: [{ color: '#7CFFC4', opacity: 1, pos: 0 }, { color: '#10B981', opacity: 1, pos: 100 }] },
    shadows: [{ ...defaultShadow(), y: 14, blur: 40, color: '#10B981', opacity: 0.5 }],
  });
  const back = createNode('frame', {
    name: 'Botão voltar', sizeX: 'fill', sizeY: 'hug', radius: [16, 16, 16, 16], fill: solid('#FFFFFF'),
    layout: flex('row', { padding: [16, 20, 16, 20], justify: 'center' }),
    interactions: [{ trigger: 'click', action: 'navigate', target: home.id, transition: 'slide-right' }],
  });
  back.children.push(text('Voltar ao início', { name: 'Texto botão', fontSize: 15, fontWeight: 700, fill: solid('#2B1B8F') }));
  done.children.push(
    check,
    text('Enviado!', { name: 'Título', fontSize: 32, fontWeight: 800, letterSpacing: -1, fill: solid('#FFFFFF') }),
    text('R$ 250,00 enviados para Ana Souza', { name: 'Descrição', fontSize: 15, fill: solid('#FFFFFF', 0.75), textAlign: 'center' }),
    back,
  );
  // o botão "Enviar" da Home leva para a tela de sucesso
  instances[0].interactions[0].target = done.id;

  // ESTILOS compartilhados: 3 de cor e 2 de texto. Camadas ligadas a eles seguem qualquer mudança no estilo (aba Recursos).
  doc.styles.colors = [
    { id: 'st-tinta', name: 'Tinta', color: ink, opacity: 1 },
    { id: 'st-roxo', name: 'Roxo da marca', color: violet, opacity: 1 },
    { id: 'st-rosa', name: 'Rosa de destaque', color: '#FF5CA8', opacity: 1 },
  ];
  doc.styles.texts = [
    { id: 'tx-titulo', name: 'Título grande', fontFamily: 'Inter', fontSize: 24, fontWeight: 800, fontStyle: 'normal', lineHeight: 1.4, letterSpacing: -0.5 },
    { id: 'tx-secao', name: 'Título de seção', fontFamily: 'Inter', fontSize: 16, fontWeight: 700, fontStyle: 'normal', lineHeight: 1.4, letterSpacing: 0 },
  ];
  const link = (n, kind, id) => { if (kind === 'text') n.textStyleId = id; else n.fill.styleId = id; };
  link(hello.children[1], 'text', 'tx-titulo');
  link(hello.children[1], 'color', 'st-tinta');
  home.children.filter((c) => c.type === 'text' && c.fontSize === 16).forEach((t) => { link(t, 'text', 'tx-secao'); link(t, 'color', 'st-tinta'); });

  page.children.push(home, done, library);
  syncInstances(doc.pages);
  return doc;
}
