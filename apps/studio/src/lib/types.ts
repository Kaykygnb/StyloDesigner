// Tipos do painel. O documento e as camadas vêm do núcleo (@stylo/core): o painel não define um modelo próprio.
import type { Doc, LayerNode, Page } from '@stylo/core/types.ts';

export type { Doc, LayerNode, Page };

/** O projeto aberto numa sessão, como o servidor devolve em GET /api/studio/doc. */
export interface Snapshot {
  file: string;
  id: string;
  role: string;
  pageId: string;
  doc: Doc;
}

export interface ProjectInfo {
  file: string;
  name?: string;
  modified: number;
  size: number;
  thumb: number;
}

export interface PublicUser { id: string; email: string; name: string; role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'COMMENTER' | 'VIEWER' | 'MEMBER'; color: string | null; suspended: boolean; mustChangePassword: boolean }

export interface AuthState { mode: 'local' | 'accounts'; hasAccounts: boolean; user: PublicUser | null }

export interface Presence {
  people: { id: string; name: string; color: string }[];
  agents: { id: string; name: string; color: string; active: boolean; lastTool: string | null; locks: string[] }[];
  activity: { at: number; who: string; color: string; text: string }[];
}

export interface DesignIssue {
  severity: 'erro' | 'aviso';
  type: string;
  layerId: string;
  layerName: string;
  where?: string;
  message: string;
  fix: string;
}

export type Device = 'desktop' | string;
