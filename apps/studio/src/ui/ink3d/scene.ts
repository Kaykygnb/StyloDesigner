// Pilha de tintas em 3D (three.js): uma tela de exemplo "explodida" nas camadas que a formam.
// Cada camada é uma tinta de processo (ciano, magenta, amarelo) que se mistura com as de baixo:
// como tinta sobre papel no tema claro (multiplicar) e como luz no escuro (tela/screen).
// Ao abrir, as camadas caem uma a uma e se assentam; o ponteiro inclina a pilha; passar por cima
// afasta as camadas e mostra a tag HTML de cada uma (o desenho vira código).
// Este arquivo só é baixado quando a cena aparece (import dinâmico), para não pesar no resto do painel.
import {
  CanvasTexture, Color, CustomBlending, DoubleSide, Group, LinearFilter, Mesh, MeshBasicMaterial, NormalBlending,
  OneFactor, OneMinusDstAlphaFactor, OneMinusSrcAlphaFactor, OneMinusSrcColorFactor, PerspectiveCamera, PlaneGeometry,
  Scene, Shape, ShapeGeometry, SRGBColorSpace, SrcColorFactor, Sprite, SpriteMaterial, WebGLRenderer, type BufferGeometry, type Material, type Texture,
} from 'three';

export interface InkSceneOptions {
  /** quando true, as camadas entram caindo (só na primeira vez que a cena aparece na sessão) */
  intro: boolean;
}

export interface InkSceneHandle { dispose(): void }

type Palette = { dark: boolean; surface: Color; surface2: Color; border: Color; text: Color; text3: Color; c: Color; m: Color; y: Color; accent: Color; mono: string };

// Lê uma cor de variável CSS já resolvida pelo navegador (aceita hex, rgb() e color-mix()).
function cssColor(probe: HTMLElement, name: string, fallback: string): Color {
  probe.style.color = `var(${name}, ${fallback})`;
  const value = getComputedStyle(probe).color;
  const rgb = value.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const [r, g, b] = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
  }
  const srgb = value.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (srgb) return new Color().setRGB(+srgb[1], +srgb[2], +srgb[3], SRGBColorSpace);
  return new Color(fallback);
}

function readPalette(): Palette {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const dark = document.documentElement.dataset.theme !== 'light';
  const p: Palette = {
    dark,
    surface: cssColor(probe, '--surface', dark ? '#17181c' : '#fbfbfc'),
    surface2: cssColor(probe, '--surface-2', dark ? '#1d1f24' : '#f2f3f5'),
    border: cssColor(probe, '--border-strong', dark ? '#3a3d46' : '#c4c8cf'),
    text: cssColor(probe, '--text', dark ? '#e6e6e3' : '#16171b'),
    text3: cssColor(probe, '--text-3', dark ? '#7d7f88' : '#6f737c'),
    c: cssColor(probe, '--ink-c', '#00a3e0'),
    m: cssColor(probe, '--ink-m', '#e6007e'),
    y: cssColor(probe, '--ink-y', '#ffcc00'),
    accent: cssColor(probe, '--accent', '#4c8dff'),
    mono: getComputedStyle(document.documentElement).getPropertyValue('--mono').trim() || 'monospace',
  };
  probe.remove();
  return p;
}

function roundedRect(w: number, h: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** ShapeGeometry usa as coordenadas da forma como UV; aqui elas viram 0..1 para a textura cobrir a forma. */
function normalizeUv(geometry: BufferGeometry, w: number, h: number): BufferGeometry {
  const pos = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  uv.needsUpdate = true;
  return geometry;
}

// Mistura de tinta: no claro, multiplicar (sobre o fundo transparente vale a própria cor); no escuro, tela.
function inkMaterial(color: Color, dark: boolean): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ color, transparent: true, depthTest: false, depthWrite: false, side: DoubleSide, premultipliedAlpha: true });
  m.blending = CustomBlending;
  if (dark) { m.blendSrc = OneFactor; m.blendDst = OneMinusSrcColorFactor; }
  else { m.blendSrc = OneMinusDstAlphaFactor; m.blendDst = SrcColorFactor; }
  m.blendSrcAlpha = OneFactor;
  m.blendDstAlpha = OneMinusSrcAlphaFactor;
  return m;
}

function flatMaterial(color: Color, opacity = 1): MeshBasicMaterial {
  return new MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest: false, depthWrite: false, side: DoubleSide, blending: NormalBlending });
}

function canvasTexture(width: number, height: number, draw: (g: CanvasRenderingContext2D) => void): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

const css = (c: Color) => `#${c.getHexString(SRGBColorSpace)}`;

// O papel: superfície com grade de pontos e marcas de registro nos cantos.
function paperTexture(p: Palette, w: number, h: number): CanvasTexture {
  const W = 1024, H = Math.round((W * h) / w);
  return canvasTexture(W, H, (g) => {
    g.fillStyle = css(p.surface); g.fillRect(0, 0, W, H);
    g.fillStyle = css(p.text3); g.globalAlpha = p.dark ? 0.32 : 0.38;
    for (let x = 28; x < W; x += 28) for (let y = 28; y < H; y += 28) { g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 0.9; g.strokeStyle = css(p.text3); g.lineWidth = 2.4;
    for (const [cx, cy] of [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]]) {
      g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(cx - 18, cy); g.lineTo(cx + 18, cy); g.moveTo(cx, cy - 18); g.lineTo(cx, cy + 18); g.stroke();
    }
  });
}

// Etiqueta com a tag HTML da camada (sempre de frente para a câmera).
function tagSprite(label: string, p: Palette): Sprite {
  const W = 320, H = 80;
  const texture = canvasTexture(W, H, (g) => {
    g.fillStyle = css(p.surface); g.strokeStyle = css(p.border); g.lineWidth = 3;
    g.beginPath(); g.roundRect(4, 8, W - 8, H - 16, 12); g.fill(); g.stroke();
    g.fillStyle = css(p.text); g.font = `600 34px ${p.mono}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, W / 2, H / 2 + 1);
  });
  const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
  sprite.scale.set(1.45, 1.45 * (H / W), 1);
  sprite.renderOrder = 100;
  return sprite;
}

interface Layer { group: Group; z: number; v: number; delay: number; tag?: Sprite }

export function createInkScene(container: HTMLElement, options: InkSceneOptions): InkSceneHandle {
  // falha aqui (sem WebGL) sobe para quem chamou, que mostra a versão em CSS
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = 'ink3d-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(22, 1, 0.1, 100);
  camera.position.set(0, 0, 12);

  // pivô: inclinação fixa (a "prova" deitada) + inclinação pelo ponteiro
  const pivot = new Group();
  const stack = new Group();
  stack.rotation.set(-0.9, 0, 0.52);
  pivot.add(stack);
  scene.add(pivot);

  const disposables: Array<BufferGeometry | Material | Texture> = [];
  const keep = <T extends BufferGeometry | Material | Texture>(x: T): T => { disposables.push(x); return x; };
  let layers: Layer[] = [];
  let shadow: Mesh | null = null;

  const PW = 4.4, PH = 3;
  const build = () => {
    for (const d of disposables.splice(0)) d.dispose();
    stack.clear();
    const p = readPalette();
    const add = (geometry: BufferGeometry, material: Material, x: number, y: number, parent: Group, order: number) => {
      const mesh = new Mesh(keep(geometry), keep(material));
      mesh.position.set(x, y, 0);
      mesh.renderOrder = order;
      parent.add(mesh);
      return mesh;
    };
    const layer = (index: number, tag?: [string, number, number]) => {
      const group = new Group();
      stack.add(group);
      const previous = layers[index];
      const l: Layer = { group, z: previous?.z ?? 0, v: previous?.v ?? 0, delay: index * 0.09 };
      if (tag) {
        l.tag = tagSprite(tag[0], p);
        keep(l.tag.material); keep((l.tag.material as SpriteMaterial).map!);
        l.tag.position.set(tag[1], tag[2], 0.02);
        group.add(l.tag);
      }
      return l;
    };

    // sombra suave embaixo da pilha
    const shadowTex = keep(canvasTexture(256, 256, (g) => {
      const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, `rgba(0,0,0,${p.dark ? 0.55 : 0.22})`); grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    }));
    shadow = new Mesh(keep(new PlaneGeometry(PW * 1.5, PH * 1.6)), keep(new MeshBasicMaterial({ map: shadowTex, transparent: true, depthTest: false, depthWrite: false })));
    shadow.position.z = -0.35; shadow.renderOrder = -1;
    stack.add(shadow);

    const next: Layer[] = [];
    // 0 · papel
    const paper = layer(0);
    const paperMat = new MeshBasicMaterial({ map: keep(paperTexture(p, PW, PH)), depthTest: false, depthWrite: false, side: DoubleSide });
    add(normalizeUv(new ShapeGeometry(roundedRect(PW, PH, 0.22), 6), PW, PH), paperMat, 0, 0, paper.group, 0);
    const edge = new Mesh(keep(new ShapeGeometry(roundedRect(PW + 0.04, PH + 0.04, 0.24), 6)), keep(flatMaterial(p.border)));
    edge.position.z = -0.002; edge.renderOrder = -0.5; paper.group.add(edge);
    next.push(paper);
    // 1 · ciano: a imagem
    const c = layer(1, ['<img>', -1.75, 1.15]);
    add(new ShapeGeometry(roundedRect(2.35, 1.75, 0.16), 6), inkMaterial(p.c, p.dark), -0.72, 0.28, c.group, 1);
    next.push(c);
    // 2 · magenta: o círculo
    const m = layer(2, ['<svg>', 1.12, 1.35]);
    const circle = new Shape(); circle.absarc(0, 0, 0.64, 0, Math.PI * 2, false);
    add(new ShapeGeometry(circle, 48), inkMaterial(p.m, p.dark), 1.12, 0.52, m.group, 2);
    next.push(m);
    // 3 · amarelo: o botão
    const y = layer(3, ['<button>', -0.9, -0.62]);
    add(new ShapeGeometry(roundedRect(1.7, 0.46, 0.14), 6), inkMaterial(p.y, p.dark), -0.95, -1.02, y.group, 3);
    next.push(y);
    // 4 · preto: o texto (três linhas)
    const k = layer(4, ['<h1>', 1.2, -0.08]);
    [[1.68, 0.92, 0.95], [1.34, 0.6, 0.5], [1.5, 0.76, 0.5]].forEach(([w, x, o], i) => {
      add(new ShapeGeometry(roundedRect(w, 0.12, 0.06), 4), flatMaterial(p.text, o), x + (1.68 - w) / 2 - 0.1, -0.42 - i * 0.22, k.group, 4);
    });
    next.push(k);
    // 5 · seleção em volta do círculo, com alças
    const sel = layer(5);
    const ring = roundedRect(1.48, 1.48, 0.03);
    const hole = new Shape(); hole.moveTo(-0.715, -0.715); hole.lineTo(-0.715, 0.715); hole.lineTo(0.715, 0.715); hole.lineTo(0.715, -0.715); hole.lineTo(-0.715, -0.715);
    ring.holes.push(hole);
    add(new ShapeGeometry(ring, 2), flatMaterial(p.accent), 1.12, 0.52, sel.group, 5);
    for (const [hx, hy] of [[-0.74, -0.74], [0.74, -0.74], [-0.74, 0.74], [0.74, 0.74]]) {
      add(new PlaneGeometry(0.17, 0.17), flatMaterial(p.accent), 1.12 + hx, 0.52 + hy, sel.group, 6);
      add(new PlaneGeometry(0.11, 0.11), flatMaterial(p.surface), 1.12 + hx, 0.52 + hy, sel.group, 7);
    }
    next.push(sel);
    layers = next;
  };
  build();

  // ---------------------------------------------------------------- movimento
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
  const fine = window.matchMedia('(pointer: fine)').matches;
  let explode = 0, explodeTarget = 0;
  let tiltX = 0, tiltY = 0, tiltXT = 0, tiltYT = 0;
  const start = performance.now();
  let introUntil = options.intro && !reduced() ? start + 1600 : 0;
  if (introUntil) layers.forEach((l, i) => { l.z = 4.5 + i * 1.2; l.v = 0; });

  const onMove = (e: PointerEvent) => {
    const px = e.clientX / window.innerWidth - 0.5;
    const py = e.clientY / window.innerHeight - 0.5;
    tiltYT = px * 0.42; tiltXT = py * 0.22;
    wake();
  };
  const onEnter = () => { explodeTarget = 1; wake(); };
  const onLeave = () => { explodeTarget = 0; wake(); };
  const onTap = () => { if (!fine) { explodeTarget = explodeTarget ? 0 : 1; wake(); } };
  if (fine) window.addEventListener('pointermove', onMove, { passive: true });
  container.addEventListener('pointerenter', onEnter);
  container.addEventListener('pointerleave', onLeave);
  container.addEventListener('click', onTap);

  // ---------------------------------------------------------------- tamanho
  // distância da câmera para caber uma altura e uma largura (em unidades da cena) na área
  const half = Math.tan((camera.fov * Math.PI) / 360);
  const fitZ = (height: number, width: number) => Math.max(height / (2 * half), width / (2 * half * camera.aspect));
  let fit = { rest: 12, open: 15 };
  const resize = () => {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // a pilha cabe na largura e na altura, seja a área larga ou estreita
    fit = { rest: fitZ(3.4, 5.8), open: fitZ(5.6, 6.3) };
    camera.updateProjectionMatrix();
    wake();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // ---------------------------------------------------------------- tema e destaque
  const mo = new MutationObserver(() => { build(); wake(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });

  // ---------------------------------------------------------------- laço (pausa fora da tela e com a aba escondida)
  let raf = 0, visible = true, last = performance.now(), idleSince = performance.now();
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); });
  io.observe(container);
  const onVisibility = () => { if (!document.hidden) wake(); };
  document.addEventListener('visibilitychange', onVisibility);

  function wake() { idleSince = performance.now(); if (!raf) raf = requestAnimationFrame(frame); }

  function frame(now: number) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const still = reduced();
    const t = (now - start) / 1000;

    explode += (explodeTarget - explode) * (still ? 1 : 1 - Math.exp(-dt * 7));
    tiltX += (tiltXT - tiltX) * (still ? 1 : 1 - Math.exp(-dt * 5));
    tiltY += (tiltYT - tiltY) * (still ? 1 : 1 - Math.exp(-dt * 5));
    if (still) { tiltX = 0; tiltY = 0; }
    pivot.rotation.x = tiltX;
    pivot.rotation.y = tiltY + (still ? 0 : Math.sin(t * 0.35) * 0.04);

    const breathe = still ? 0 : (Math.sin(t * 1.1) * 0.5 + 0.5) * 0.05;
    const gap = 0.12 + breathe + explode * 0.55;
    // afastadas, as camadas sobem na tela: a câmera recua um pouco e a pilha desce para tudo continuar à vista
    camera.position.z = fit.rest + (fit.open - fit.rest) * explode;
    pivot.position.y = -gap * (layers.length - 1) * 0.36;
    let moving = false;
    layers.forEach((l, i) => {
      const target = i * gap;
      if (still) { l.z = target; l.v = 0; }
      else if (now - start > l.delay * 1000) {
        // mola: as camadas caem e se assentam com um pequeno quique
        const k = 120, c = 15;
        l.v += (-(l.z - target) * k - l.v * c) * dt;
        l.z += l.v * dt;
      }
      if (Math.abs(l.z - target) > 0.002 || Math.abs(l.v) > 0.002) moving = true;
      l.group.position.z = l.z;
      if (l.tag) (l.tag.material as SpriteMaterial).opacity = Math.max(0, Math.min(1, explode * 1.4 - 0.25 - Math.max(0, l.z - target) * 0.5));
    });
    if (shadow) shadow.scale.setScalar(1 + explode * 0.12);

    renderer.render(scene, camera);

    // enquanto algo se mexe: 60 qps. Parado: só "respira" a 30 qps e, depois de um tempo sem ponteiro, dorme (não gasta nada).
    const settling = moving || Math.abs(explode - explodeTarget) > 0.002 || Math.abs(tiltX - tiltXT) > 0.0005 || Math.abs(tiltY - tiltYT) > 0.0005 || now < introUntil;
    if (settling) raf = requestAnimationFrame(frame);
    else if (!still && now - idleSince < 12000) raf = requestAnimationFrame(() => { raf = requestAnimationFrame(frame); });
  }
  resize();
  wake();

  return {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect(); mo.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerenter', onEnter);
      container.removeEventListener('pointerleave', onLeave);
      container.removeEventListener('click', onTap);
      for (const d of disposables.splice(0)) d.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
