# App de Futebol - Requisitos e decisões

## Pedido (Paulo, 25/10/2026)
App sobre futebol: tabela, jogos, resultados e próximos jogos das principais competições do mundo.

## MVP (etapa 1)
- Tecnologia: web/PWA (funciona no celular e no PC, sem loja de apps).
- Telas: 1) lista de competições; 2) por competição: abas Tabela, Resultados, Próximos jogos.
- Competições: Brasileirão Série A, Copa do Brasil, Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Libertadores, Sul-Americana (10 no total).

## Favoritos (etapa 3)
- Estrela ao lado de cada time na tabela e nas listas de jogos. Toque marca ou desmarca.
- Salvos só no `localStorage` do aparelho (chave `futebol-favoritos`), pelo nome curto do time. Sem conta e sem gravar no servidor.
- Opção **Favoritos** na tela inicial: resultados e próximos jogos, de todas as competições, apenas dos times marcados. Sem nenhum favorito, a tela explica para tocar na estrela.
- Fora desta etapa: notificações e login.

## Fora do MVP (não fazer agora)
Notificações, login, estatísticas de jogadores, Android/iOS nativo.

## Fonte de dados (decidido em 25/10/2026)
- **Escolhida: API pública não oficial da ESPN** (`site.api.espn.com`), **sem chave de API**.
  - Testada em 25/10/2026 e com a Copa do Brasil em 26/10/2026: cobre as 10 competições (tabela + jogos). Códigos: bra.1, bra.copa_do_brazil, eng.1, esp.1, ita.1, ger.1, fra.1, uefa.champions, conmebol.libertadores, conmebol.sudamericana.
  - Tabela: `/apis/v2/sports/soccer/{liga}/standings`. Jogos: `/apis/site/v2/sports/soccer/{liga}/scoreboard?dates=AAAAMM` (por mês; intervalo de datas AAAAMMDD-AAAAMMDD retornou erro 400 no teste).
- Descartadas: football-data.org (exige chave; pela documentação, o plano grátis não inclui Libertadores/Sul-Americana — não testado) e TheSportsDB (não testada a fundo, pois a ESPN já cobre tudo sem chave).
- Limitações: API não oficial e sem garantia (pode mudar/sair do ar sem aviso); nomes dos times em inglês/forma curta da ESPN; legendas da tabela traduzidas pelo app (as desconhecidas ficam em inglês); Libertadores/Sul-Americana mostram a tabela da fase de grupos (mata-mata aparece em Resultados/Próximos jogos). A Copa do Brasil não tem classificação na ESPN (resposta sem grupos): a aba Tabela avisa que é mata-mata, e as fases (oitavas, quartas, ida/volta e as demais) aparecem em Resultados e Próximos jogos. Resultados e próximos jogos cobrem ~2 meses para trás e para frente (até 60 jogos).

## Arquitetura
- `server.js`: Node 18+ sem dependências. Serve o front (`public/`) e faz proxy com cache para a ESPN (tabela 10 min; jogos do mês atual 2 min; outros meses 30 min). A ESPN libera CORS, mas o proxy reduz chamadas e entrega os dados já em português.
- `public/`: HTML/CSS/JS puro, `manifest.webmanifest`, `sw.js` (service worker: app abre offline e mostra os últimos dados vistos), ícones.
- Horários convertidos para America/Sao_Paulo no navegador; textos em pt-BR.
- Rotas da API: `/api/competicoes`, `/api/{liga}/tabela`, `/api/{liga}/jogos`.

## Andamento
- 25/10 21:35: Paulo confirmou MVP e pediu incluir Libertadores e Sul-Americana. Construção iniciada.
- 25/10 ~21:47: MVP pronto e testado na box (porta 3000). Teste: as 9 competições carregaram Tabela, Resultados e Próximos jogos (via curl e renderização com jsdom). Nenhuma falhou.
- 26/10: Copa do Brasil incluída (`bra.copa_do_brazil`). Standings vem vazio; a aba Tabela mostra aviso de mata-mata. A rota da API passa a aceitar underscore no id.
- 26/10: Favoritos no aparelho. Estrela na tabela e nos jogos; a opção Favoritos junta resultados e próximos de todas as competições. Cache do service worker: `futebol-v3`.

## Próximos passos (a decidir com Paulo)
- Publicar online (não publicado ainda; ver README.md para opções gratuitas).
- Teste visual no celular real (instalar na tela inicial).
- 25/10 21:35: Paulo confirmou MVP e pediu incluir Libertadores e Sul-Americana. Construção iniciada.
- 25/10 22:36: Paulo não tem GitHub. Próximo passo: ele cria conta (github.com/signup); depois conecto, subo o repo e guio Render (Web Service, start: node server.js, plano Free).
- 25/10 22:45: GitHub conectado (cotrimmontesp-hash, só leitura). Próximo: Paulo cria repo público app-futebol com README; depois CloudAgent envia o app; Render pode implantar a branch.
