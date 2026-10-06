# Testes de navegador (opcionais)

Testam o app de verdade: desenhar, arrastar, redimensionar, caneta, componentes, protótipo etc.
Precisam do Playwright (não faz parte do projeto, instale só se quiser rodar):

```bash
npm i -D playwright && npx playwright install chromium
npm start                      # em outro terminal
node tests/e2e/basico.mjs      # cada arquivo imprime PASS/FAIL e "ALL PASS" no final
```

Variáveis: `APP_URL` (padrão http://localhost:5173/) e `CHROMIUM_PATH` (se já tiver um Chromium).
