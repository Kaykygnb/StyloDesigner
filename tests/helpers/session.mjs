/** Abre a conta mestre numa instalação vazia e devolve o cookie da sessão. */
export async function setupSession(base, account = {}) {
  const response = await fetch(`${base}/api/auth/setup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'owner', name: 'Dono', password: 'senha-owner-segura', email: '', ...account }),
  });
  const text = await response.text();
  if (response.status !== 201) throw new Error(`setup falhou (${response.status}): ${text}`);
  const cookie = (response.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie.startsWith('stylo_session=')) throw new Error('setup não devolveu a sessão');
  return { cookie, user: JSON.parse(text) };
}

/** Cria um agente já ativo. O token aparece só nesta resposta. */
export async function createAgent(base, cookie, name = 'Agente de teste') {
  const response = await fetch(`${base}/api/agents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name }),
  });
  const text = await response.text();
  if (response.status !== 201) throw new Error(`agente falhou (${response.status}): ${text}`);
  return JSON.parse(text);
}

/** Libera um projeto da conta para o agente. Sem isto, open_project recusa. */
export async function grantProject(base, cookie, agentId, file) {
  const response = await fetch(`${base}/api/agents/${agentId}/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ file }),
  });
  if (!response.ok) throw new Error(`liberar projeto falhou (${response.status}): ${await response.text()}`);
  return response.json();
}
