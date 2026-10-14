// A área de transferência do editor: guarda QUAIS camadas foram copiadas (o conteúdo é copiado pelo servidor ao colar, com paste_layers).
export interface Clip { ids: string[]; pageId: string | null; cut: boolean }

let clip: Clip | null = null;
let styleSource: string | null = null;

export const getClip = () => clip;
export const setClip = (c: Clip | null) => { clip = c; };
export const getStyleSource = () => styleSource;
export const setStyleSource = (id: string | null) => { styleSource = id; };
