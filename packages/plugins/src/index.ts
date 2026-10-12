/** Os plugins que vêm com o Stylo. O servidor liga todos ao iniciar (apps/server/src/plugins.ts). */

import type { StyloPlugin } from '@stylo/core/plugin.ts';
import { identidade } from './identidade/index.ts';
import { assets } from './assets/index.ts';
import { acessibilidade } from './acessibilidade/index.ts';
import { tailwind } from './tailwind/index.ts';
import { seo } from './seo/index.ts';
import { qr } from './qr/index.ts';

export const builtinPlugins: StyloPlugin[] = [identidade, assets, acessibilidade, tailwind, seo, qr];
