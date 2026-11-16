# Seavora
Plataforma educacional de planejamento financeiro. Abra index.html ou execute `python -m http.server 8000` nesta pasta e acesse localhost:8000. Chart.js e Lucide usam CDN. Os dados anteriores continuam na chave finflow_data_v1; exporte um backup antes de trocar de origem. O novo plano tem chave independente. Testes: `node tests/finance.cjs`. Projeções RDB usam CDI constante, dias de semana sem feriados e imposto por lote. Não constitui recomendação de investimento. Módulos antigos permanecem e precisam de revisão financeira e de segurança adicional. Logo original fornecido, recortado da imagem raster de baixa resolução. Não há backend.

## Fase 2
Identidade refinada, logo transparente, melhorias responsivas e Academia com 14 aulas em quatro trilhas, exercícios, favoritos, anotações e XP local. A academia utiliza uma chave própria (`seavora_academy_v1`), não incluída no backup financeiro legado. Fontes, ícones e gráficos ainda usam CDN. Não é uma plataforma de investimento real.

## Fase 3
Acesse Minhas finanças, Calendário financeiro e Minha carteira pelo menu. Testes: `node tests/finance.cjs` e `node tests/money.cjs`. A carteira é independente das caixinhas. Valores realizados e pendentes são separados.

## Fase 4
- Laboratório com cinco ferramentas e diagnóstico educativo.
- Seis novas aulas na academia (20 no total).
- Testes: node tests/advanced.cjs. Sem validação visual em navegador.

### Fase 5
Use Live Server ou `python -m http.server 8000` na pasta do projeto. A instalação PWA depende de HTTPS ou localhost e do navegador. Após o primeiro carregamento bem-sucedido, os recursos próprios podem ser usados offline; bibliotecas CDN não são incluídas no cache. A opção de ocultar valores principais é apenas visual, não criptografia. Os dados seguem locais; faça backup antes de trocar de origem ou navegador. O ambiente de execução bloqueou a navegação automatizada do Chromium; a interface e o PWA ainda precisam de validação real.

## Fase 6
Landing page pública em index.html, painel em app.html, links diretos e simulador demonstrativo. Ilustrações SVG locais e prévia fictícia. Sem cadastro ou integração bancária. O PWA abre o painel.
