/**
 * dom-polyfill.ts — O PEDAÇO DE DOM QUE O NÚCLEO PRECISA NO SERVIDOR
 * O núcleo lê SVG com o `DOMParser` do navegador (svgimport.js → insert_icon, build_layout com SVG). No servidor não há
 * navegador; o linkedom faz esse papel. Importe este arquivo uma vez, antes de usar o núcleo.
 */

import { DOMParser } from 'linkedom';

(globalThis as any).DOMParser ??= DOMParser;
