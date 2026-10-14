/** Edição local no servidor: codec isolado no Chromium e matemática pura de pixels do núcleo. */
import { FILTERS, normalizeAdj, isNeutral, renderPixels, autoBackground, maskCoverage } from '@stylo/core/imagefx.js';
import { parseImageDataUrl, toDataUrl } from '@stylo/core/image-size.ts';
import { applyImageToNode, hasOriginal, restoreImageOriginal } from '@stylo/core/image-edit.ts';
import type { ImageEditOptions, ImageEditResult, ImageOperations } from '@stylo/core/image-edit.ts';
import { prepareImage, readPixels, writePixels, encodeImage } from './image-codec.ts';
import type { Renderer } from './renderer.ts';

const MAX_BYTES = 16 * 1024 * 1024;
const MAX_PENDING = 4;

function imageError(error: any): Error {
  const message = String(error?.message || error).split('\n')[0].replace(/^page\.evaluate: (?:Error: )?/, '');
  return new Error(message);
}

function imageSource(source: string): { source: string; mime: string } {
  if (typeof source !== 'string' || !source.startsWith('data:')) throw new Error('A edição aceita apenas uma imagem já guardada no projeto. Use add_asset antes.');
  if (source.length > MAX_BYTES * 1.5) throw new Error('A imagem é grande demais para editar. Use um arquivo de até 16 MB.');
  const parsed = parseImageDataUrl(source);
  if (!parsed) throw new Error('Não consegui ler esta imagem. Envie PNG, JPEG, WebP, GIF ou SVG com add_asset.');
  if (parsed.bytes.length > MAX_BYTES) throw new Error('A imagem é grande demais para editar. Use um arquivo de até 16 MB.');
  const { width, height } = parsed.info;
  if (!(width > 0 && height > 0) || width > 8192 || height > 8192 || width * height > 16_000_000) throw new Error('A imagem excede 8192 pixels por lado ou 16 milhões de pixels. Reduza o arquivo antes de importar.');
  return { source: toDataUrl(parsed.bytes, parsed.info.mime), mime: parsed.info.mime };
}

export function createImageOperations(renderer: Pick<Renderer, 'withImagePage'>): ImageOperations {
  // Uma edição de pixels por vez para limitar memória; compartilha os slots do renderizador.
  let tail: Promise<unknown> = Promise.resolve();
  let pending = 0;
  const queued = <T>(task: () => Promise<T>): Promise<T> => {
    if (pending >= MAX_PENDING) return Promise.reject(new Error('Há várias edições de imagem em andamento. Aguarde a conclusão e tente novamente.'));
    pending++;
    const operation = tail.then(task, task).finally(() => { pending--; });
    tail = operation.catch(() => {});
    return operation;
  };

  const editImageLocal = (source: string, options: ImageEditOptions = {}): Promise<ImageEditResult> => queued(async () => {
    const image = imageSource(source);
    if (options.filter && !FILTERS.some((filter) => filter.id === options.filter)) throw new Error(`filter: use ${FILTERS.map((filter) => filter.id).join(', ')}.`);
    if (options.rotate && ![90, 180, 270, -90].includes(options.rotate)) throw new Error('rotate: use 90, 180, 270 ou -90.');
    const adj = options.adjust ? normalizeAdj(options.adjust) : null;
    return renderer.withImagePage(async (page) => {
      const { w, h } = await prepareImage(page, image.source, options);
      let removed: number | undefined;
      if (options.remove_background || (options.filter && options.filter !== 'none') || (adj && !isNeutral(adj))) {
        const pixels = await readPixels(page);
        let mask: Uint8Array | null = null;
        if (options.remove_background) {
          const config = typeof options.remove_background === 'object' ? options.remove_background : {};
          const background = autoBackground(pixels, w, h, { tolerance: Math.max(1, Math.min(80, config.tolerance ?? 28)), feather: config.feather ?? 1 });
          mask = background.mask;
          removed = Math.round(maskCoverage(mask) * 100);
        }
        const adjusted = renderPixels(pixels, w, h, { filter: options.filter, adj, mask } as any);
        await writePixels(page, adjusted, w, h);
      }
      // Fundo removido sempre sai em formato que suporta transparência.
      const format = options.remove_background ? 'png' : options.format || (image.mime === 'image/png' || image.mime === 'image/svg+xml' ? 'png' : image.mime === 'image/webp' ? 'webp' : 'jpeg');
      const encoded = await encodeImage(page, { format, quality: Math.max(0.3, Math.min(1, Number(options.quality) || 0.9)), max_width: options.max_width });
      return { ...encoded, ...(removed === undefined ? {} : { removed }) };
    }).catch((error) => { throw imageError(error); });
  });

  return {
    editImageLocal,
    applyImageToNode,
    async restoreOriginal(store, id, { commit = true, beforeApply = null } = {}) {
      const node = store.get(id);
      const original = hasOriginal(node) && node.fill.origAssetId;
      const source = original && store.state.doc.assets[original];
      if (!source) return false;
      const image = imageSource(source);
      const dimensions = await queued(() => renderer.withImagePage((page) => prepareImage(page, image.source))).catch((error) => { throw imageError(error); });
      beforeApply?.();
      restoreImageOriginal(store, id, dimensions, { commit });
      return true;
    },
  };
}
