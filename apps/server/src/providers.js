/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  agent/providers.js — DE ONDE VEM A IA DO ASSISTENTE (provedores prontos)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Todos estes provedores falam o mesmo "idioma" (a API Chat Completions da OpenAI, com ferramentas): por isso o
 *  Assistente funciona com qualquer um, trocando só o endereço, a chave e o nome do modelo. Escolher um provedor em
 *  Configurações só preenche esses campos; dá para usar qualquer outro compatível em "Outro".
 *
 *  Cada provedor guarda a SUA chave (trocar de OpenAI para NVIDIA e voltar não apaga nenhuma). As chaves ficam só
 *  no servidor local (designer.config.json) ou nas variáveis de ambiente indicadas em `envKey`.
 *  Só dados: o servidor e a tela de Configurações importam este mesmo arquivo.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

export const PROVIDERS = [
  {
    id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', envKey: 'OPENAI_API_KEY',
    keyHint: 'sk-...', keyUrl: 'platform.openai.com/api-keys',
    note: 'Uso cobrado pela OpenAI.',
  },
  {
    id: 'nvidia', name: 'NVIDIA NIM', baseUrl: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.3-70b-instruct', envKey: 'NVIDIA_API_KEY',
    keyHint: 'nvapi-...', keyUrl: 'build.nvidia.com (Get API Key)',
    note: 'Escolha um modelo que aceite ferramentas ("tool calling") no build.nvidia.com; use "Ver modelos" para a lista da sua conta.',
  },
  {
    id: 'ollama', name: 'Ollama (no seu PC)', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:7b', envKey: '',
    keyHint: '(sem chave)', keyUrl: 'ollama.com',
    note: 'De graça, roda no seu computador. Baixe um modelo com suporte a ferramentas (ex.: ollama pull qwen2.5:7b).',
  },
];

/** Provedor de um endereço (ou null = "Outro"). Compara sem a barra final. */
export const providerOf = (baseUrl) => {
  const u = String(baseUrl || '').replace(/\/+$/, '');
  return PROVIDERS.find((p) => p.baseUrl === u) || null;
};

/** O endereço é na própria máquina (Ollama, LM Studio)? Esses não precisam de chave. */
export const isLocalUrl = (baseUrl) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(String(baseUrl || ''));
