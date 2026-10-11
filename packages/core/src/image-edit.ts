/** Edição de imagem no documento: arquivo novo, original preservada e histórico do chamador. Sem DOM. */
import { uid } from './model.js';

export interface ImageEditResult {
  dataUrl: string;
  w: number;
  h: number;
  bytes: number;
  removed?: number;
}
export interface ImageEditOptions {
  rotate?: number;
  flip_h?: boolean;
  flip_v?: boolean;
  crop?: { x?: number; y?: number; w?: number; h?: number };
  ratio?: string;
  remove_background?: boolean | { tolerance?: number; feather?: number };
  filter?: string;
  adjust?: Record<string, number>;
  max_width?: number;
  format?: 'png' | 'webp' | 'jpeg';
  quality?: number;
}
export interface ImageWriteOptions { commit?: boolean }
export interface ImageRestoreOptions extends ImageWriteOptions { beforeApply?: (() => unknown) | null }
export interface ImageOperations {
  editImageLocal: (source: string, options?: ImageEditOptions) => Promise<ImageEditResult>;
  applyImageToNode: (store: any, id: string, result: ImageEditResult, options?: ImageWriteOptions) => string;
  restoreOriginal: (store: any, id: string, options?: ImageRestoreOptions) => Promise<boolean>;
  /** Só existe quando um adaptador de geração foi explicitamente configurado. */
  generativeEdit?: (options: any) => Promise<ImageEditResult>;
}

export const hasOriginal = (node: any): boolean => !!(node?.fill?.origAssetId && node.fill.assetId === node.fill.editedAssetId);

export function applyImageToNode(store: any, id: string, { dataUrl, w, h }: ImageEditResult, { commit = true }: ImageWriteOptions = {}): string {
  const node = store.get(id);
  if (!node) throw new Error('A camada não existe mais. Leia get_document antes de editar.');
  const assetId = uid();
  store.addAsset(assetId, dataUrl);
  store.update(() => {
    if (!hasOriginal(node)) node.fill.origAssetId = node.fill.assetId;
    node.fill.assetId = assetId;
    node.fill.editedAssetId = assetId;
    node.fill.natW = w;
    node.fill.natH = h;
  }, { structural: false });
  if (commit) store.commit();
  return assetId;
}

/** O adaptador decodifica a original e confere o alvo antes de chamar esta escrita síncrona. */
export function restoreImageOriginal(store: any, id: string, { w, h }: { w: number; h: number }, { commit = true }: ImageWriteOptions = {}): void {
  const node = store.get(id);
  const original = hasOriginal(node) && node.fill.origAssetId;
  if (!original || !store.state.doc.assets[original]) throw new Error('A imagem original não está mais disponível. Confira a camada atual.');
  store.update(() => {
    node.fill.assetId = original;
    delete node.fill.origAssetId;
    delete node.fill.editedAssetId;
    node.fill.natW = w;
    node.fill.natH = h;
  }, { structural: false });
  if (commit) store.commit();
}
