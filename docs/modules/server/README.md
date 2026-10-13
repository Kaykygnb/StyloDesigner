# Server

O servidor compõe o processo: HTTP, autenticação, projetos, workspace, persistência, presença, renderer, biblioteca e entrega do Studio.

## Controla

Identidade, autorização, ciclo de vida do workspace, gravação, versões, blobs, rede e adapters externos.

## Não deve fazer

Não deve duplicar regras do modelo ou implementar uma segunda versão de ferramentas.

## Verificação

Testes HTTP, banco, contas, assets, presença, projetos e renderização.

`tests/backups.test.ts` confere snapshots de arquivos, datas UTC e ordenação da listagem, cópia de segurança e restauração pendente no próximo boot, em pastas temporárias exclusivas. O adapter de banco simula apenas `CHECKPOINT`; esses testes não comprovam integridade de restore PGlite/PostgreSQL real (DOC-DB-001).
