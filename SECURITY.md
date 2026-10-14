# Segurança

O Stylo é um **alpha** feito para rodar no seu computador ou numa rede em que você confia. **Não o exponha diretamente na internet.**

## Como relatar uma vulnerabilidade

Não abra uma issue pública com detalhes. Use o relato privado do GitHub: aba **Security → Report a vulnerability** neste repositório. Se isso não estiver disponível, abra uma issue pública pedindo *apenas* um contato privado, sem descrever a falha.

Diga o que você fez, o que esperava e o que aconteceu. Responderemos assim que possível; é um projeto pequeno e ainda não há prazo garantido.

## O que está no escopo

- Execução de script a partir de conteúdo de projeto ou de agente (o canvas é um `iframe` sem scripts de propósito).
- Quebra de autenticação ou de papéis (OWNER/ADMIN/EDITOR/COMMENTER/VIEWER) e dos escopos dos tokens de agente.
- Vazamento de segredos (`designer.secret`, chaves de provedores) ou de arquivos de outras contas.

## Fora do escopo por enquanto

- Exposição pública da instância e ataques que dependem dela (hospedagem pública ainda não é um objetivo).
- Os dados do alpha são descartáveis; não guarde nada sensível neles.
