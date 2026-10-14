/** Envio, inserção e edição de imagens, com proteção contra resultados antigos. */
import { uid } from '../../model.js';
import { imageInfo as sniffImage, parseImageDataUrl, fromBase64, toDataUrl } from '../../image-size.js';
import type { RunnerContext, ToolHandlers } from './types.ts';
import { summarize } from './presentation.ts';
/** Confere que uma operação assíncrona ainda aponta para o mesmo documento e a mesma imagem. */
export function assertCurrentImageTarget(store, id, doc, node, fill, source) {
  const current = store.get(id);
  if (store.state.doc !== doc || current !== node || JSON.stringify(current?.fill) !== fill || doc.assets[current?.fill?.assetId] !== source) {
    throw new Error('A imagem desta camada mudou enquanto a ferramenta aguardava; não apliquei o resultado antigo. Confira a imagem atual e tente de novo.');
  }
  return current;
}

const MAX_UPLOAD_BYTES = 16 * 1024 * 1024;
export function createImageTools(ctx: RunnerContext) {
  const { store, commands, need, fetchImage, imageOps } = ctx;
  /** Camada com preenchimento de imagem (ou erro claro). */
  const imageLayer = (id) => {
    const n = need(id);
    if (n.fill?.type !== 'image' || !store.state.doc.assets?.[n.fill.assetId]) throw new Error(`“${n.name}” não tem imagem (preenchimento de imagem). Use em uma camada com foto.`);
    return n;
  };
  /** Resumo da imagem gravada (tamanho e peso). */
  const imageInfo = (n) => {
    const url = store.state.doc.assets[n.fill.assetId] || '';
    return { w: n.fill.natW, h: n.fill.natH, kb: Math.round((url.length * 0.75) / 1024), format: (/^data:image\/(\w+)/.exec(url) || [])[1] };
  };
  /** Impede uma operação de imagem lenta de aplicar o resultado sobre uma imagem que a pessoa já trocou. */
  const imageTarget = (id) => {
    const doc = store.state.doc;
    const node = imageLayer(id);
    const fill = JSON.stringify(node.fill);
    const source = doc.assets[node.fill.assetId];
    return {
      node,
      source,
      assertCurrent() {
        return assertCurrentImageTarget(store, id, doc, node, fill, source);
      },
    };
  };

  const tools: ToolHandlers = {
    async add_asset({ name, data_url, data_base64, source_url, insert, parent_id, at }) {
      const given = [data_url, data_base64, source_url].filter(Boolean).length;
      if (given !== 1) throw new Error('Mande exatamente UM entre data_url, data_base64 e source_url.');
      let bytes;
      if (source_url) {
        if (!fetchImage) throw new Error('Baixar imagem por endereço não está disponível neste servidor. Mande data_base64.');
        bytes = (await fetchImage(String(source_url))).bytes;
      } else if (data_url) {
        const parsed = parseImageDataUrl(String(data_url));
        if (!parsed) throw new Error('data_url inválido: use "data:image/png;base64,...".');
        bytes = parsed.bytes;
      } else {
        const clean = String(data_base64).replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error('data_base64 inválido: precisa ser base64 puro.');
        bytes = fromBase64(clean);
      }
      if (bytes.length > MAX_UPLOAD_BYTES) throw new Error(`A imagem tem ${Math.round(bytes.length / 1048576)} MB; o limite é 16 MB.`);
      const info = sniffImage(bytes);
      if (!info) throw new Error('Isso não é uma imagem reconhecida (use PNG, JPEG, GIF, WebP ou SVG).');
      const dataUrl = toDataUrl(bytes, info.mime);
      const doc = store.state.doc;
      // mesma imagem já no projeto: reutiliza o id em vez de guardar de novo
      let assetId = Object.keys(doc.assets || {}).find((k) => doc.assets[k] === dataUrl);
      const reused = !!assetId;
      if (!assetId) { assetId = uid(); store.addAsset(assetId, dataUrl); }
      const out = { asset_id: assetId, reused, format: info.mime.replace('image/', '').replace('+xml', ''), width: info.width, height: info.height, kb: Math.max(1, Math.round(bytes.length / 1024)) };
      if (insert) {
        const node = await commands.insertImageAsset(assetId, at, { parentId: parent_id || null, name: name || undefined });
        return { ...out, created: summarize(node, 0), hint: 'A imagem foi enviada e já está numa camada nova.' };
      }
      return { ...out, hint: 'Imagem guardada no projeto. Use insert_asset com este asset_id para colocá-la numa camada (ou mande insert:true).' };
    },
    async insert_asset({ id, parent_id, index, at, name }) {
      const node = await commands.insertImageAsset(id, at, { parentId: parent_id || null, index, name });
      return { assetId: id, created: summarize(node, 0), hint: 'A camada reutiliza a imagem existente do projeto; não foi criado outro arquivo de imagem.' };
    },
    async edit_image(args) {
      if (!imageOps) throw new Error('edit_image mexe nos pixels e precisa de um navegador: não está disponível neste servidor.');
      const target = imageTarget(args.id);
      const n = target.node;
      const ia = imageOps;
      if (args.restore_original) {
        if (!(await ia.restoreOriginal(store, n.id, { commit: false, beforeApply: target.assertCurrent }))) throw new Error('Esta camada não tem imagem original guardada (ela ainda não foi editada pelo editor de imagem).');
        return { restored: true, image: imageInfo(n) };
      }
      const ops = ['rotate', 'flip_h', 'flip_v', 'crop', 'ratio', 'remove_background', 'filter', 'adjust', 'max_width', 'format'];
      if (!ops.some((k) => args[k] !== undefined && args[k] !== false && args[k] !== null)) throw new Error(`Diga o que mudar: ${ops.join(', ')} ou restore_original.`);
      const res = await ia.editImageLocal(target.source, {
        ...args, remove_background: args.remove_background ? { tolerance: args.background_tolerance ?? 28 } : false,
      });
      const current = target.assertCurrent();
      ia.applyImageToNode(store, current.id, res, { commit: false });
      return { image: imageInfo(current), ...(res.removed !== undefined ? { background_removed_pct: res.removed } : {}), hint: 'A original fica guardada: restore_original volta para ela.' };
    },
    async generate_image_edit({ id, mode, prompt, area, expand }) {
      if (!imageOps?.generativeEdit) throw new Error('A edição generativa não está disponível neste servidor. Use edit_image para os ajustes locais.');
      const target = imageTarget(id);
      const ia = imageOps;
      const res = await ia.generativeEdit!({ src: target.source, mode, prompt: String(prompt || '').trim(), area, expand });
      const current = target.assertCurrent();
      ia.applyImageToNode(store, current.id, res, { commit: false });
      return { image: imageInfo(current), hint: 'Confira com get_image. A original fica guardada (edit_image com restore_original volta para ela).' };
    }
  };
  return { tools, imageLayer };
}
