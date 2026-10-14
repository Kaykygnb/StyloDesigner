# ADR 0001 — Monólito modular como unidade de implantação

## Status

Aceito para o estado atual; separação futura depende de evidência operacional.

## Contexto

Core, Studio, servidor, MCP, banco e plugins estão em workspaces do mesmo repositório, e o servidor compõe esses módulos em um processo. O Studio e o MCP precisam compartilhar o mesmo documento, undo, validação e locks.

## Decisão

Manter um monólito modular. Preservar seams internas e adapters injetáveis, sem distribuir o core ou o MCP prematuramente.

## Consequências

Ganha-se consistência local, menor latência e setup simples. Perde-se isolamento de escala e falha entre cargas. Renderer/imagem é o primeiro candidato a extração se profiling demonstrar necessidade.
