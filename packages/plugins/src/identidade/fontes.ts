// Pares de fontes curados (todas do Google Fonts, livres para uso comercial, todas disponíveis no Fontsource, então
// `add_font` as hospeda no projeto). Não é uma decisão por ninguém: é um ponto de partida com o clima de cada par.

export interface FontPair {
  id: string;
  /** Família dos títulos / do texto corrido (nome como no Google Fonts). */
  heading: string;
  body: string;
  /** ids do Fontsource, para add_font. */
  headingId: string;
  bodyId: string;
  /** Pesos que valem a pena baixar. */
  headingWeights: number[];
  bodyWeights: number[];
  moods: string[];
  /** Para que tipo de projeto costuma servir. */
  suits: string;
}

export const FONT_PAIRS: FontPair[] = [
  { id: 'editorial', heading: 'Playfair Display', body: 'Source Sans 3', headingId: 'playfair-display', bodyId: 'source-sans-3', headingWeights: [700], bodyWeights: [400, 600], moods: ['elegante', 'editorial', 'classico', 'sofisticado'], suits: 'revistas, blogs, restaurantes, marcas de moda' },
  { id: 'luxo', heading: 'Cormorant Garamond', body: 'Montserrat', headingId: 'cormorant-garamond', bodyId: 'montserrat', headingWeights: [500, 700], bodyWeights: [400, 500], moods: ['luxo', 'elegante', 'sofisticado', 'minimalista'], suits: 'joalheria, hotelaria, cosméticos, arquitetura' },
  { id: 'moderno', heading: 'Space Grotesk', body: 'Inter', headingId: 'space-grotesk', bodyId: 'inter', headingWeights: [500, 700], bodyWeights: [400, 500], moods: ['moderno', 'tecnologia', 'startup', 'ousado'], suits: 'SaaS, produtos digitais, portfólios de tecnologia' },
  { id: 'startup', heading: 'Manrope', body: 'Inter', headingId: 'manrope', bodyId: 'inter', headingWeights: [600, 800], bodyWeights: [400, 500], moods: ['moderno', 'limpo', 'startup', 'confiavel'], suits: 'landing pages de produto, fintechs, apps' },
  { id: 'amigavel', heading: 'Nunito', body: 'Nunito Sans', headingId: 'nunito', bodyId: 'nunito-sans', headingWeights: [700, 800], bodyWeights: [400, 600], moods: ['amigavel', 'acolhedor', 'suave', 'infantil'], suits: 'educação, saúde, comunidades, apps para família' },
  { id: 'ludico', heading: 'Fredoka', body: 'Nunito', headingId: 'fredoka', bodyId: 'nunito', headingWeights: [500, 600], bodyWeights: [400, 600], moods: ['ludico', 'divertido', 'infantil', 'amigavel'], suits: 'jogos, produtos infantis, eventos' },
  { id: 'classico', heading: 'Merriweather', body: 'Open Sans', headingId: 'merriweather', bodyId: 'open-sans', headingWeights: [700], bodyWeights: [400, 600], moods: ['classico', 'tradicional', 'confiavel', 'editorial'], suits: 'jornais, instituições, escritórios, documentação' },
  { id: 'jornalistico', heading: 'Lora', body: 'Montserrat', headingId: 'lora', bodyId: 'montserrat', headingWeights: [600, 700], bodyWeights: [400, 500], moods: ['editorial', 'jornalistico', 'classico', 'elegante'], suits: 'blogs, newsletters, sites de conteúdo' },
  { id: 'criativo', heading: 'Fraunces', body: 'Work Sans', headingId: 'fraunces', bodyId: 'work-sans', headingWeights: [600, 800], bodyWeights: [400, 500], moods: ['criativo', 'autoral', 'caloroso', 'ousado'], suits: 'estúdios, agências, portfólios, marcas autorais' },
  { id: 'corporativo', heading: 'IBM Plex Sans', body: 'IBM Plex Serif', headingId: 'ibm-plex-sans', bodyId: 'ibm-plex-serif', headingWeights: [600], bodyWeights: [400], moods: ['corporativo', 'serio', 'tecnico', 'confiavel'], suits: 'consultorias, B2B, documentação técnica, bancos' },
  { id: 'tecnico', heading: 'JetBrains Mono', body: 'Inter', headingId: 'jetbrains-mono', bodyId: 'inter', headingWeights: [700], bodyWeights: [400, 500], moods: ['tecnologia', 'tecnico', 'desenvolvedor', 'ousado'], suits: 'ferramentas para devs, documentação, hackathons' },
  { id: 'impacto', heading: 'Oswald', body: 'Roboto', headingId: 'oswald', bodyId: 'roboto', headingWeights: [600, 700], bodyWeights: [400, 500], moods: ['impacto', 'esportivo', 'forte', 'ousado'], suits: 'esportes, academias, eventos, campanhas' },
  { id: 'poster', heading: 'Bebas Neue', body: 'Lato', headingId: 'bebas-neue', bodyId: 'lato', headingWeights: [400], bodyWeights: [400, 700], moods: ['impacto', 'poster', 'forte', 'ousado'], suits: 'cartazes, shows, lançamentos, streetwear' },
  { id: 'minimalista', heading: 'DM Serif Display', body: 'DM Sans', headingId: 'dm-serif-display', bodyId: 'dm-sans', headingWeights: [400], bodyWeights: [400, 500], moods: ['minimalista', 'limpo', 'elegante', 'moderno'], suits: 'portfólios, marcas de design, lojas pequenas' },
  { id: 'brutalista', heading: 'Space Mono', body: 'Archivo', headingId: 'space-mono', bodyId: 'archivo', headingWeights: [700], bodyWeights: [400, 600], moods: ['brutalista', 'ousado', 'tecnico', 'criativo'], suits: 'arte, música, coletivos, sites experimentais' },
  { id: 'popular', heading: 'Poppins', body: 'Poppins', headingId: 'poppins', bodyId: 'poppins', headingWeights: [600, 700], bodyWeights: [400, 500], moods: ['moderno', 'amigavel', 'popular', 'limpo'], suits: 'varejo, apps de consumo, sites institucionais simples' },
];

/** Tira acento e põe em minúsculas, para "Clássico" achar "classico". */
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Pares que combinam com o clima pedido (qualquer palavra do texto que seja uma etiqueta ou apareça em "suits"). Sem clima: todos. */
export function pickPairs(mood?: string): FontPair[] {
  const words = plain(mood || '').split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  if (!words.length) return FONT_PAIRS;
  const score = (p: FontPair) => words.reduce((n, w) => n + (p.moods.some((m) => m.startsWith(w) || w.startsWith(m)) ? 2 : 0) + (plain(p.suits).includes(w) ? 1 : 0), 0);
  return FONT_PAIRS.map((p) => ({ p, s: score(p) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.p);
}
