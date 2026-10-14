# Visão

O Stylo deve permitir que uma pessoa e um agente de IA editem o mesmo documento visual sem caminhos de mutação divergentes. O valor central é transformar decisões de design em HTML/CSS verificável e exportável, mantendo inspeção, segurança, histórico e colaboração próximos da operação que alterou o documento.

## Não objetivos atuais

- Não é uma plataforma de hospedagem pública.
- Não é um conjunto de microserviços distribuídos.
- Não deve depender de automação de cliques para que agentes operem o documento.
- Não deve tratar o MCP como implementação das regras de domínio.

## Visão atualizada (diretriz do proprietário, 2026-10-14)

Texto de referência: [ADR 0002, rodada 2](../architecture/adr/0002-self-hosted-administration.md) e [EVOLUCAO.md](../architecture/EVOLUCAO.md).

O Stylo quer ser uma ferramenta **open source** de design visual, prototipação e criação de interfaces, integrada a fluxos reais de desenvolvimento e a agentes externos pelo FeatMCP. Não é só um editor de formas nem cópia superficial do Figma. Atende de uma pessoa sozinha a equipes e organizações com instalação própria.

Princípios: intuitivo para iniciantes; produtivo para profissionais; modular e extensível; local-first, sem dependência obrigatória de serviço externo; compatível com automação por IA; fiel ao representar design e interação; evolução progressiva sem sacrificar estabilidade. Arquitetura base: o painel e o MCP usam as **mesmas ferramentas do core**.

Regras de identidade (aprovadas): toda instalação exige conta (inclusive uso individual), com OWNER principal; mesma fundação para uso pessoal e empresarial; projetos do espaço organizacional pertencem à organização.

Governança: o proprietário decide visão e prioridades; agentes investigam e podem contestar sugestões técnicas com justificativa; decisões humanas aprovadas só mudam por nova deliberação; nenhuma reescrita completa do editor sem plano revisado e autorização explícita.

Trabalho organizado em horizontes **A** (beta atual), **B** (incremental) e **C** (estrutural), ver [ROADMAP](../planning/ROADMAP.md). São ordem de planejamento, não cronograma aprovado.

Atenção: "Não objetivos atuais" acima continuam válidos para hospedagem pública e microserviços; JavaScript do usuário, 3D editável, React Native, slides/PPTX e remake visual amplo são **objetivos de produto** do proprietário, ainda **sem implementação** e sujeitos às decisões listadas em EVOLUCAO.md §7.
