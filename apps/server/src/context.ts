/**
 * context.ts — OS SERVIÇOS DO SERVIDOR, JUNTOS NUM OBJETO (sem framework de injeção)
 * `main.ts` monta; as rotas e o MCP recebem só o que precisam deste objeto.
 */

import type { Db } from '@stylo/db/client.ts';
import type { ConfigStore } from './config.js';
import type { Auth, PublicUser } from './services/auth.js';
import type { Agents } from './services/agents.js';
import type { Operations } from './services/operations.js';
import type { Notes } from './services/notes.js';
import type { Sharing } from './services/sharing.js';
import type { Projects } from './services/projects.js';
import type { Renderer } from './services/renderer.js';
import type { Library } from './services/library.js';
import type { Secrets } from './services/secrets.js';
import type { Workspace } from './workspace/index.js';
import type { Events } from './events.js';

export type AuthMode = 'local' | 'accounts';

export interface Services {
  port: number;
  /** Raiz do repositório e pasta do código do servidor. */
  root: string;
  here: string;
  config: ConfigStore;
  /** Arquivo do perfil da conta local (modo local). */
  accountFile: string;
  db: Db;
  auth: Auth;
  agents: Agents;
  operations: Operations;
  notes: Notes;
  sharing: Sharing;
  projects: Projects;
  renderer: Renderer;
  library: Library;
  secrets: Secrets;
  workspace: Workspace;
  events: Events;
  /** 'local' = sem login (só esta máquina); 'accounts' = contas e senha. */
  authMode: AuthMode;
  /** Usuário técnico que age no lugar da pessoa no modo local. */
  localUser: PublicUser;
  presence: ReturnType<typeof import('./presence.js').createPresence>;
}
