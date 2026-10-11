/** Contratos do executor. Store e comandos ainda são legados em JavaScript. */
import type { LayerNode, Doc } from '../../types.ts';
import type { ImageOperations } from '../../image-edit.ts';

export type ToolArgs = Record<string, any>;
export type ToolHandlers = Record<string, (args: ToolArgs, client?: string) => any>;
export interface RunOptions { external?: boolean; admin?: boolean; signal?: AbortSignal }

export interface RunnerDependencies {
  store: any;
  commands: any;
  approve?: (request: { client: string; tool: string; args: ToolArgs; summary: string; signal?: AbortSignal }) => boolean | Promise<boolean>;
  saving?: any;
  folder?: any;
  renderImage?: ((node: LayerNode, doc: Doc, scale: number, options?: { width: number }) => Promise<string>) | null;
  auditLayout?: ((roots: LayerNode[], doc: Doc, widths: { rootId: string; label: string; width: number }[]) => Promise<any[]>) | null;
  fetchImage?: ((url: string) => Promise<{ bytes: Uint8Array }>) | null;
  imageOps?: ImageOperations | null;
  vendor?: ((name: string) => Uint8Array | null) | null;
}

export interface PropertyContext {
  setLayoutMode?: (node: any, mode: any) => void;
  colorStyle?: (id: string) => any;
  effectStyle?: (id: string) => any;
  gradientStyle?: (id: string) => any;
}

export interface RunnerContext extends RunnerDependencies, PropertyContext {
  need: (id: string) => any;
  targetList: (parentId?: string) => any[];
  insertAt: (list: any[], node: any, index?: number) => any;
  placeBeside: (node: any) => void;
}
