# Política de segurança

## Versões que recebem correção
Só a versão mais recente (a branch `main` e a última versão publicada). Projetos antigos podem ser abertos na versão nova: o formato do arquivo é versionado e ganha migração.

## Como relatar uma vulnerabilidade
**Não abra uma issue pública.** Use o relato privado do GitHub: aba **Security → Report a vulnerability** deste repositório. Inclua: o que acontece, os passos para reproduzir (um arquivo `.json` de projeto ou um pedido HTTP serve de prova) e a versão. Relatos de risco alto têm prioridade sobre qualquer funcionalidade nova.

## O que o Stylo protege (e como)
O Stylo roda no seu computador. O servidor (`node server.js`) escuta **apenas em `127.0.0.1`** e foi desenhado para esse uso, sem conta nem senha:

- só aceita pedidos cujo `Host` é desta máquina e cuja `Origin` é a própria página (mesma porta): outra página, mesmo em outra porta de `localhost`, não consegue ler nem alterar seus projetos nem a configuração;
- o corpo de cada pedido tem limite por rota (1 MB padrão; 200 MB só para gravar um projeto);
- nomes de projeto são validados (sem `..`, sem barras, sem nomes reservados do Windows) e a pasta de projetos não pode ser a raiz do disco nem uma pasta do sistema;
- a configuração (com as chaves de API) é gravada de forma atômica, com permissão só do dono, e as chaves nunca voltam ao navegador;
- **um projeto `.json` de terceiros é tratado como entrada não confiável**: é validado ao abrir e todo valor de camada que vira CSS ou SVG passa por filtros (sem escapar do `<style>`, sem recurso externo, só imagens embutidas). O **CSS da página** é código escrito à mão e pode carregar fontes e imagens de fora: ao abrir, o Stylo avisa quais endereços ele vai acessar;
- o HTML escrito à mão é sanitizado (sem `<script>`, sem atributos `on*`, `iframe` só com `https`; trate o conteúdo de um `iframe` como código de terceiros);
- o servidor MCP (`/mcp`) pede permissão a cada alteração, a menos que você ligue o "Acesso de administrador".

## O que NÃO é suportado
- **Expor o servidor à rede** (proxy, túnel, `0.0.0.0`): não há autenticação por desenho. Se você fizer isso, qualquer pessoa com acesso à porta controla seus projetos.
- Abrir arquivos `.json` não confiáveis **em outra ferramenta** que os interprete: a validação é do Stylo.
- Executar JavaScript arbitrário: o export é HTML/CSS estático e remove scripts.

## Boas práticas para quem usa
Guarde as chaves de API só em Configurações (ficam no servidor, não no projeto), mantenha o Node atualizado e revise o que um agente de IA vai alterar antes de dar "Permitir tudo".
