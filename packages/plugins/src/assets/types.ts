/**
 * assets/types.ts — O CONTRATO DE UM PROVEDOR DE ASSETS
 *
 * Um provedor sabe BUSCAR (fotos, vídeos, áudio, 3D, ícones, fontes...) numa fonte externa e devolve resultados
 * normalizados, SEMPRE com licença e crédito. Quem baixa e guarda é a biblioteca da conta; quem decide o que usar é o
 * agente (ou a pessoa). Provedores novos (embutidos ou cadastrados pela pessoa, de forma declarativa) seguem este formato.
 */

export type AssetKindTool = 'image' | 'video' | 'audio' | 'model3d' | 'lottie' | 'font' | 'icon';

export interface License {
  name: string;
  url?: string;
  /** Pode ser usado em projeto comercial? Provedores só devolvem o que pode. */
  commercial: boolean;
  /** required = o crédito é obrigatório; optional = recomendado; none = dispensado. */
  attribution: 'required' | 'optional' | 'none';
}

export interface AssetResult {
  /** "provedor:id" — a referência que `library_save` usa. */
  ref: string;
  provider: string;
  kind: AssetKindTool;
  title: string;
  preview_url?: string;
  page_url?: string;
  author?: string;
  author_url?: string;
  width?: number;
  height?: number;
  /** segundos */
  duration?: number;
  license: License;
  /** Texto de crédito pronto (vai para o arquivo de créditos do site exportado). */
  credit: string;
  /** O arquivo para baixar. Fontes não têm (use `add_font`). */
  download?: { url: string; mime?: string; size?: number };
  /** Dados extras do tipo (fontes: pesos, estilos, subconjuntos, categoria...). */
  extra?: Record<string, unknown>;
}

export interface SearchParams {
  kind: AssetKindTool;
  query: string;
  page: number;
  orientation?: 'landscape' | 'portrait' | 'square';
  /** só fontes: sans-serif, serif, display, handwriting, monospace */
  category?: string;
}

export interface SearchOutcome { results: AssetResult[]; hasMore: boolean }

/** O que o servidor entrega aos provedores. */
export interface ProviderEnv {
  /** Chave de API do dono da conta (conta → configuração do servidor → variável de ambiente), se houver. */
  key: string | null;
  /** fetch com limite de tempo, para APIs de host fixo. */
  getJson: (url: string, init?: { headers?: Record<string, string> }) => Promise<any>;
}

export interface AssetProvider {
  id: string;
  name: string;
  kinds: AssetKindTool[];
  /** Precisa de chave de API? Quando sim, onde pegar. */
  needsKey?: { label: string; signupUrl: string; envVar: string };
  /** Resumo da licença dos resultados. */
  licenseSummary: string;
  /** `true` quando a API não foi conferida na documentação oficial (a resposta pode precisar de ajuste). */
  unverified?: boolean;
  /** Quanto tempo o resultado de uma busca pode ser reaproveitado (o Pixabay exige 24 h). */
  cacheMs?: number;
  search(params: SearchParams, env: ProviderEnv): Promise<SearchOutcome>;
}

/** O que a biblioteca da conta oferece às ferramentas (o servidor injeta). */
export interface LibraryLike {
  add(userId: string, input: any): Promise<{ asset: any; existed: boolean }>;
  list(userId: string, opts?: any): Promise<any[]>;
  get(userId: string, id: string): Promise<any>;
  bytes(userId: string, id: string): Promise<{ asset: any; data: Uint8Array }>;
  remove(userId: string, id: string): Promise<any>;
  usage(userId: string): Promise<{ count: number; bytes: number; quotaBytes: number }>;
}

/** Serviços do servidor usados pelo plugin de assets. */
export interface AssetServices {
  library: LibraryLike;
  /** Chave do provedor para esta conta (ou null). */
  keyFor(userId: string, providerId: string): Promise<string | null>;
  /** Baixa um arquivo https público, protegido contra SSRF. */
  fetchRemoteFile(url: string, opts: { maxBytes: number; accept?: string; headers?: Record<string, string> }): Promise<{ bytes: Uint8Array; contentType: string }>;
  /** Fontes de assets cadastradas pela conta (declarativas). */
  customSources?(userId: string): Promise<CustomSource[]>;
  /** fetch para as APIs dos provedores (host fixo); injetável nos testes. */
  fetch?: typeof fetch;
}

/** Fonte cadastrada pela pessoa, sem código: onde buscar e como ler a resposta. */
export interface CustomSource {
  id: string;
  name: string;
  /** Endereço de busca com {consulta}, {pagina} (obrigatório ter {consulta}). Só https. */
  searchUrl: string;
  kinds: AssetKindTool[];
  headers?: Record<string, string>;
  /** Caminho (a.b.c) até a lista de resultados na resposta JSON. */
  resultsPath: string;
  /** Caminhos, dentro de cada item, até os campos. */
  fields: { id: string; title: string; preview?: string; download: string; author?: string; page?: string; license?: string };
  license: License;
}
