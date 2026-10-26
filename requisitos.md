# App de Futebol - Requisitos e decisões

## Pedido (Paulo, 25/10/2026)
App sobre futebol: tabela, jogos, resultados e próximos jogos das principais competições do mundo.

## MVP (etapa 1)
- Tecnologia: web/PWA (funciona no celular e no PC, sem loja de apps).
- Telas: 1) lista de competições; 2) por competição: abas Tabela, Resultados, Próximos jogos.
- Competições iniciais: Brasileirão Série A, Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Libertadores, Sul-Americana (9 no total, pedido do Paulo).

## Fora do MVP (não fazer agora)
Notificações, favoritos, login, estatísticas de jogadores, Android/iOS nativo.

## Fonte de dados (decidido em 25/10/2026)
- **Escolhida: API pública não oficial da ESPN** (`site.api.espn.com`), **sem chave de API**.
  - Testada em 25/10/2026: cobre as 9 competições (tabela + jogos). Códigos: bra.1, eng.1, esp.1, ita.1, ger.1, fra.1, uefa.champions, conmebol.libertadores, conmebol.sudamericana.
  - Tabela: `/apis/v2/sports/soccer/{liga}/standings`. Jogos: `/apis/site/v2/sports/soccer/{liga}/scoreboard?dates=AAAAMM` (por mês; intervalo de datas AAAAMMDD-AAAAMMDD retornou erro 400 no teste).
- Descartadas: football-data.org (exige chave; pela documentação, o plano grátis não inclui Libertadores/Sul-Americana — não testado) e TheSportsDB (não testada a fundo, pois a ESPN já cobre tudo sem chave).
- Limitações: API não oficial e sem garantia (pode mudar/sair do ar sem aviso); nomes dos times em inglês/forma curta da ESPN; legendas da tabela traduzidas pelo app (as desconhecidas ficam em inglês); Libertadores/Sul-Americana mostram a tabela da fase de grupos (mata-mata aparece em Resultados/Próximos jogos). Resultados e próximos jogos cobrem ~2 meses para trás e para frente (até 60 jogos).

## Arquitetura
- `server.js`: Node 18+ sem dependências. Serve o front (`public/`) e faz proxy com cache para a ESPN (tabela 10 min; jogos do mês atual 2 min; outros meses 30 min). A ESPN libera CORS, mas o proxy reduz chamadas e entrega os dados já em português.
- `public/`: HTML/CSS/JS puro, `manifest.webmanifest`, `sw.js` (service worker: app abre offline e mostra os últimos dados vistos), ícones.
- Horários convertidos para America/Sao_Paulo no navegador; textos em pt-BR.
- Rotas da API: `/api/competicoes`, `/api/{liga}/tabela`, `/api/{liga}/jogos`.

## Andamento
- 25/10 21:35: Paulo confirmou MVP e pediu incluir Libertadores e Sul-Americana. Construção iniciada.
- 25/10 ~21:47: MVP pronto e testado na box (porta 3000). Teste: as 9 competições carregaram Tabela, Resultados e Próximos jogos (via curl e renderização com jsdom). Nenhuma falhou.

## Próximos passos (a decidir com Paulo)
- Publicar online (não publicado ainda; ver README.md para opções gratuitas).
- Teste visual no celular real (instalar na tela inicial).
- 25/10 21:35: Paulo confirmou MVP e pediu incluir Libertadores e Sul-Americana. Construção iniciada.
- 25/10 22:36: Paulo não tem GitHub. Próximo passo: ele cria conta (github.com/signup); depois conecto, subo o repo e guio Render (Web Service, start: node server.js, plano Free).
- 25/10 22:45: GitHub conectado (cotrimmontesp-hash, só leitura). Próximo: Paulo cria repo público app-futebol com README; depois CloudAgent envia o app; Render pode implantar a branch.
