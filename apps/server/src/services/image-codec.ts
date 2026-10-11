import { clampCrop, cropForRatio, fitWidth } from '@stylo/core/imagefx.js';

type Geometry = {
  rotate?: number; flip_h?: boolean; flip_v?: boolean;
  crop?: { x?: number; y?: number; w?: number; h?: number }; ratio?: string;
};

/** Decodifica somente dados locais; a página isolada pertence ao chamador. */
export async function prepareImage(page: any, source: string, ops: Geometry = {}): Promise<{ w: number; h: number }> {
  if (!/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/.test(source)) {
    throw new Error('A imagem deve ser um data URL de PNG, JPEG, WebP, GIF ou SVG. Importe o arquivo novamente.');
  }
  const rotate = Number(ops.rotate ?? 0);
  if (!Number.isFinite(rotate) || rotate % 90) throw new Error('Para girar a imagem, use um múltiplo de 90 graus.');
  const angle = ((rotate % 360) + 360) % 360;
  const ratios: Record<string, number> = { '1:1': 1, '4:3': 4 / 3, '16:9': 16 / 9, '3:2': 3 / 2 };
  if (ops.ratio && !ratios[ops.ratio]) throw new Error('Para ratio, use 1:1, 4:3, 16:9 ou 3:2.');
  const dims = await page.evaluate(async (src: string) => {
    const image = new Image();
    image.src = src;
    try { await image.decode(); } catch { throw new Error('Não foi possível abrir a imagem. Importe um PNG, JPEG ou WebP válido.'); }
    const w = image.naturalWidth, h = image.naturalHeight;
    if (!w || !h || w > 8192 || h > 8192 || w * h > 16_000_000) {
      throw new Error('A imagem excede 8192 pixels por lado ou 16 milhões de pixels. Reduza o arquivo antes de importar.');
    }
    (globalThis as any).__styloDecodedImage = image;
    return { w, h };
  }, source);
  const w = angle % 180 ? dims.h : dims.w, h = angle % 180 ? dims.w : dims.h;
  let crop: { x: number; y: number; w: number; h: number } | null = null;
  if (ops.ratio) crop = clampCrop(cropForRatio(w, h, ratios[ops.ratio]), w, h, null, Math.min(8, w, h));
  else if (ops.crop) {
    for (const value of Object.values(ops.crop)) {
      if (value !== undefined && !Number.isFinite(value)) throw new Error('O recorte precisa de coordenadas e tamanhos numéricos.');
    }
    crop = clampCrop({ x: ops.crop.x ?? 0, y: ops.crop.y ?? 0, w: ops.crop.w ?? w, h: ops.crop.h ?? h }, w, h, null, Math.min(8, w, h));
  }
  return page.evaluate(({ angle, flipH, flipV, crop, w, h }: any) => {
    const image = (globalThis as any).__styloDecodedImage as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    // Flips are applied in rotated coordinates, matching rotate → horizontal → vertical.
    ctx.translate(w / 2, h / 2);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.rotate(angle * Math.PI / 180);
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    let result = canvas;
    if (crop) {
      result = document.createElement('canvas');
      result.width = crop.w; result.height = crop.h;
      result.getContext('2d')!.drawImage(canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
    }
    delete (globalThis as any).__styloDecodedImage;
    (globalThis as any).__styloImage = result;
    return { w: result.width, h: result.height };
  }, { angle, flipH: !!ops.flip_h, flipV: !!ops.flip_v, crop, w, h });
}

export async function readPixels(page: any): Promise<Uint8ClampedArray> {
  const base64 = await page.evaluate(() => {
    const canvas = (globalThis as any).__styloImage as HTMLCanvasElement;
    if (!canvas) throw new Error('Abra uma imagem antes de aplicar os ajustes.');
    if (canvas.width * canvas.height > 4_000_000) {
      throw new Error('Para aplicar filtros, primeiro use max_width para reduzir a largura a 2000 pixels ou recorte até no máximo 4 milhões de pixels.');
    }
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    const chunks: string[] = [];
    for (let i = 0; i < pixels.length; i += 32768) chunks.push(String.fromCharCode(...pixels.subarray(i, i + 32768)));
    return btoa(chunks.join(''));
  });
  return new Uint8ClampedArray(Buffer.from(base64, 'base64'));
}

export async function writePixels(page: any, pixels: Uint8ClampedArray, w: number, h: number): Promise<void> {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w * h > 4_000_000 || pixels.length !== w * h * 4) {
    throw new Error('Os pixels não correspondem ao tamanho da imagem. Reduza ou recorte a imagem e tente novamente.');
  }
  const base64 = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength).toString('base64');
  await page.evaluate(({ base64, w, h }: any) => {
    const raw = atob(base64);
    const data = new Uint8ClampedArray(raw.length);
    for (let i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d')!.putImageData(new ImageData(data, w, h), 0, 0);
    (globalThis as any).__styloImage = canvas;
  }, { base64, w, h });
}

export async function encodeImage(page: any, options: { format: 'png' | 'webp' | 'jpeg'; quality: number; max_width?: number }): Promise<{ dataUrl: string; w: number; h: number; bytes: number }> {
  if (!['png', 'webp', 'jpeg'].includes(options.format)) throw new Error('Para exportar a imagem, use png, webp ou jpeg.');
  if (!Number.isFinite(options.quality) || options.quality < 0 || options.quality > 1) throw new Error('Use quality entre 0 e 1.');
  if (options.max_width !== undefined && (!Number.isFinite(options.max_width) || options.max_width < 1)) throw new Error('Use max_width com uma largura de pelo menos 1 pixel.');
  const dims = await page.evaluate(() => {
    const canvas = (globalThis as any).__styloImage as HTMLCanvasElement;
    if (!canvas) throw new Error('Abra uma imagem antes de exportar.');
    return { w: canvas.width, h: canvas.height };
  });
  const size = fitWidth(dims.w, dims.h, options.max_width);
  const encoded = await page.evaluate(async ({ size, format, quality }: any) => {
    let canvas = (globalThis as any).__styloImage as HTMLCanvasElement;
    // Object methods survive tsx serialization without an external __name helper.
    const helpers = { resize(input: HTMLCanvasElement, w: number, h: number) {
      const output = document.createElement('canvas');
      output.width = w; output.height = h;
      const ctx = output.getContext('2d')!;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(input, 0, 0, w, h);
      return output;
    } };
    while (canvas.width / 2 > size.w) canvas = helpers.resize(canvas, Math.max(1, Math.floor(canvas.width / 2)), Math.max(1, Math.floor(canvas.height / 2)));
    if (canvas.width !== size.w || canvas.height !== size.h) canvas = helpers.resize(canvas, size.w, size.h);
    // Keep resized state available so a caller can reduce before reading pixels.
    (globalThis as any).__styloImage = canvas;
    if (format === 'jpeg') {
      const opaque = document.createElement('canvas');
      opaque.width = canvas.width; opaque.height = canvas.height;
      const ctx = opaque.getContext('2d')!;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, opaque.width, opaque.height);
      ctx.drawImage(canvas, 0, 0); canvas = opaque;
    }
    const dataUrl = canvas.toDataURL(`image/${format}`, quality);
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const bytes = Math.floor(base64.length * 3 / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
    if (bytes > 16 * 1024 * 1024) throw new Error('A imagem exportada excede 16 MiB. Reduza max_width ou use WebP/JPEG com quality menor.');
    return { dataUrl, w: canvas.width, h: canvas.height, bytes };
  }, { size, format: options.format, quality: options.quality });
  return encoded;
}
