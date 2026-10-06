// Documento de exemplo mostrando auto layout (flexbox), gradientes, sombras e blur.
import { createNode, makeDoc, defaultFill, defaultShadow, defaultStroke } from './model.js';

const text = (t, props = {}) => createNode('text', { name: t.slice(0, 24), text: t, ...props });
const solid = (color, opacity = 1) => ({ ...defaultFill(color), opacity });
const flex = (mode, extra = {}) => ({
  mode, gap: 12, padding: [0, 0, 0, 0], justify: 'flex-start', align: 'flex-start', wrap: false, ...extra,
});

export function buildSample() {
  const doc = makeDoc();
  doc.name = 'Exemplo — Landing';
  const page = doc.pages[0];

  // ------------------------------------------------------------ Hero (auto layout coluna)
  const hero = createNode('frame', {
    name: 'Hero', x: 0, y: 0, w: 720, h: 460,
    fill: { ...defaultFill(), type: 'linear', angle: 135, stops: [
      { color: '#1B1340', opacity: 1, pos: 0 }, { color: '#5B3DF5', opacity: 1, pos: 100 } ] },
    layout: flex('column', { gap: 20, padding: [56, 56, 56, 56], justify: 'center', align: 'flex-start' }),
  });

  const badge = createNode('frame', {
    name: 'Badge', w: 140, h: 30, sizeX: 'hug', sizeY: 'hug', radius: [99, 99, 99, 99],
    fill: solid('#FFFFFF', 0.14), stroke: { ...defaultStroke(), color: '#FFFFFF', opacity: 0.25 },
    layout: flex('row', { gap: 8, padding: [6, 14, 6, 14], align: 'center' }),
  });
  const dot = createNode('ellipse', { name: 'Dot', w: 8, h: 8, fill: solid('#4ADE80') });
  badge.children.push(dot, text('Novo • v0.1', { fontSize: 13, fontWeight: 600, fill: solid('#FFFFFF') }));

  const title = text('Desenhe interfaces\ncom CSS de verdade', {
    name: 'Título', fontSize: 52, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5,
    fill: solid('#FFFFFF'),
  });
  const sub = text('Auto layout é flexbox, sombras são box-shadow,\ne tudo vira código limpo.', {
    name: 'Subtítulo', fontSize: 18, lineHeight: 1.5, fill: solid('#FFFFFF', 0.72),
  });

  const buttons = createNode('frame', {
    name: 'Botões', w: 300, h: 48, sizeX: 'hug', sizeY: 'hug', fill: { ...defaultFill(), type: 'none' },
    layout: flex('row', { gap: 12 }),
  });
  const btn1 = createNode('frame', {
    name: 'Botão primário', sizeX: 'hug', sizeY: 'hug', radius: [12, 12, 12, 12], fill: solid('#FFFFFF'),
    shadows: [{ ...defaultShadow(), y: 10, blur: 30, color: '#0B0420', opacity: 0.4 }],
    layout: flex('row', { padding: [14, 24, 14, 24], justify: 'center', align: 'center' }),
  });
  btn1.children.push(text('Começar agora', { fontWeight: 700, fill: solid('#2B1B8F') }));
  const btn2 = createNode('frame', {
    name: 'Botão secundário', sizeX: 'hug', sizeY: 'hug', radius: [12, 12, 12, 12],
    fill: solid('#FFFFFF', 0.1), stroke: { ...defaultStroke(), color: '#FFFFFF', opacity: 0.3 },
    layout: flex('row', { padding: [14, 24, 14, 24], justify: 'center', align: 'center' }),
  });
  btn2.children.push(text('Ver exemplos', { fontWeight: 600, fill: solid('#FFFFFF') }));
  buttons.children.push(btn1, btn2);

  // decoração absoluta (ignora o auto layout)
  const orb = createNode('ellipse', {
    name: 'Orb', absolute: true, x: 470, y: 60, w: 280, h: 280,
    fill: { ...defaultFill(), type: 'radial', stops: [
      { color: '#FF7AD9', opacity: 0.9, pos: 0 }, { color: '#7C5CFF', opacity: 0, pos: 70 } ] },
    blur: 8,
  });
  hero.children.push(orb, badge, title, sub, buttons);

  // ------------------------------------------------------------ Cartões (auto layout linha)
  const cards = createNode('frame', {
    name: 'Cartões', x: 0, y: 520, w: 720, h: 200, fill: solid('#F4F3FF'),
    layout: flex('row', { gap: 16, padding: [24, 24, 24, 24] }),
  });
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
  const glass = createNode('frame', {
    name: 'Glass card', x: 800, y: 40, w: 300, h: 200, radius: [24, 24, 24, 24],
    fill: { ...defaultFill(), type: 'linear', angle: 160, stops: [
      { color: '#FF8A5B', opacity: 1, pos: 0 }, { color: '#FF3D81', opacity: 1, pos: 100 } ] },
    layout: flex('column', { padding: [24, 24, 24, 24], justify: 'flex-end' }),
  });
  const pane = createNode('frame', {
    name: 'Painel vidro', absolute: true, x: 24, y: 24, w: 252, h: 152, radius: [18, 18, 18, 18],
    fill: solid('#FFFFFF', 0.22), bgBlur: 18,
    stroke: { ...defaultStroke(), color: '#FFFFFF', opacity: 0.5 },
    shadows: [{ ...defaultShadow(), y: 12, blur: 32, opacity: 0.2 }],
  });
  glass.children.push(pane, text('backdrop-filter', {
    fontSize: 20, fontWeight: 700, fill: solid('#FFFFFF'),
  }));

  page.children.push(hero, cards, glass);
  return doc;
}
