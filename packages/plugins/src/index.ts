/** Os plugins que vêm com o Stylo. O servidor liga todos ao iniciar (apps/server/src/plugins.ts). */

import type { StyloPlugin } from '@stylo/core/plugin.ts';
import { identidade } from './identidade/index.ts';

export const builtinPlugins: StyloPlugin[] = [identidade];
