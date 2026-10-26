# App de Futebol - Requisitos e decisões

## Pedido (Paulo, 25/10/2026)
App sobre futebol: tabela, jogos, resultados e próximos jogos das principais competições do mundo.

## MVP (etapa 1)
- Tecnologia: web/PWA (funciona no celular e no PC, sem loja de apps).
- Telas: 1) lista de competições; 2) por competição: abas Tabela, Resultados, Próximos jogos.
- Competições: Brasileirão Série A, Copa do Brasil, Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Libertadores, Sul-Americana (10 no total).

## Favoritos (etapa 3)
- Estrela ao lado de cada time na tabela e nas listas de jogos. Toque marca ou desmarca.
- Salvos no `localStorage` do aparelho (chave `futebol-favoritos`), pelo nome exibido. Sem conta. Se o nome foi traduzido, o valor antigo (nome curto da ESPN) continua reconhecido e passa a ser gravado com o nome novo. A lista de nomes só vai ao servidor se as notificações estiverem ativadas, junto com a inscrição.
- Opção **Favoritos** na tela inicial: resultados e próximos jogos, de todas as competições, apenas dos times marcados. Sem nenhum favorito, a tela explica para tocar na estrela.
- Fora desta etapa: notificações e login.

## Nomes em português (etapa 4)
- `server.js` traduz o nome curto da ESPN para o nome usual no Brasil (mapa `TIMES`) na tabela e nos jogos. Exemplos: Bayern Munich → Bayern de Munique, Atlético Madrid → Atlético de Madri, Inter Milan → Inter de Milão, Paris Saint-Germain → PSG. Manchester United permanece Manchester United.
- Sem entrada no mapa, o nome original é mantido. Vale para as 11 competições (ligas europeias, Champions, Libertadores, Sul-Americana e Brasileirão Série A e B).
- Favorito antigo, gravado com o nome de antes da tradução, continua marcado: o app compara também esse nome (`origem`) e regrava o nome novo.

## Escudos (etapa 5)
- A API de tabela e de jogos repassa a URL do logo da ESPN no campo `escudo`.
- Na tabela, nos jogos e em Favoritos, o escudo sai ao lado do nome (22 px, carregamento lazy, texto alternativo com o nome do time).
- Sem URL, ou se a imagem falhar, o app mostra só o nome, sem ícone quebrado. Favoritos e a tradução dos nomes não mudam.

## Escalação (etapa 6)
- Rota `/api/{liga}/escalacao/{jogo}` (cache de 2 min) lê o summary da ESPN. Por time: nome já traduzido, escudo, formação, titulares e reservas (camisa, posição, nome) e quem entrou ou saiu.
- Toque no jogo abre a tela Escalação. Antes de a ESPN divulgar, a mensagem é: "Escalação ainda não divulgada (sai cerca de 1 hora antes do jogo)". Com a tela aberta, o app consulta de novo a cada 5 minutos e para ao sair. Sem notificação.
- Não existe escalação provável gratuita: o dado só aparece perto da hora do jogo.

## Hoje (etapa 7)
- Rota `/api/hoje` (cache de cerca de 30 s) junta, das 11 competições, os jogos cujo apito cai no dia atual no fuso America/Sao_Paulo. Consulta o scoreboard diário da ESPN em paralelo (o dia de Brasília e o dia anterior e o seguinte, para não perder jogo na virada do fuso) e fica só com o que é hoje em Brasília.
- Por jogo: competição, horário, estado (`pre` agendado, `in` ao vivo, `post` encerrado), placar, minuto (`relogio`; intervalo vira "Intervalo"), times com nome traduzido e escudo.
- Opção **Hoje** em destaque na tela inicial. Seções, nesta ordem: Ao vivo agora (placar e minuto), Hoje (horário HH:MM de Brasília) e Encerrados hoje. Sem jogos no dia, a tela avisa. Dentro de cada seção, jogos de times favoritos vêm primeiro. Toque no jogo abre a escalação; estrela e escudo continuam.
- Com a tela aberta, atualiza a cada 30 s se houver jogo ao vivo e a cada 5 min caso contrário. Ao sair, a atualização para. Sem notificação.
- Nas listas de cada competição, jogo ao vivo continua com placar e minuto (o mesmo `relogio`). O horário exibido usa America/Sao_Paulo, mesmo se o aparelho estiver em outro fuso.

## Notificações (etapa 8)
- Web Push com VAPID. A única dependência npm é `web-push`. As chaves vêm de `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (ex.: `mailto:`). Nada de chave no código. Sem essas variáveis o app segue normal e o botão de notificações não aparece.
- Em **Favoritos**, **Ativar notificações** pede permissão, cria a inscrição no service worker e envia `POST /api/push/registrar` com a inscrição e a lista de favoritos. Ao abrir o app ou mudar a estrela, a inscrição e os favoritos são reenviados. **Desativar notificações** cancela no aparelho e no servidor.
- O servidor guarda as inscrições na memória e num JSON local (`data/push-inscricoes.json`), como melhor esforço: o plano grátis do Render perde a memória ao reiniciar.
- Enquanto houver inscrição, um vigia consulta o placar do dia a cada ~60 s (a mesma rota `/api/hoje` e o cache dela) e compara com o estado anterior em memória. Avisa, só para quem marcou o time: gol (quem fez, se a ESPN trouxer, placar e minuto), início, intervalo, volta do intervalo, fim com o resultado e escalação divulgada (a rota de escalação, só em jogos de favoritos que começam nas próximas ~2 h). O mesmo evento não sai duas vezes. No primeiro ciclo depois de reiniciar, nada de aviso antigo.
- Texto em pt-BR, nome já traduzido, escudo como ícone quando a ESPN manda. Ex.: `GOL! Flamengo 1 x 0 Atlético-MG (35′)`. Toque na notificação abre o app. Inscrição que responde 410 ou 404 é removida.
- `GET /api/ping` responde `ok`, para um serviço externo manter o servidor acordado. Sem login.

## Brasileirão Série B (etapa 9)
- Competição `bra.2`, nome "Brasileirão Série B", no mesmo grupo das ligas. Tabela, resultados, próximos jogos, escalação, tela Hoje e o vigia de notificações passam a incluí-la porque todos leem a lista única de competições.
- Nomes e escudos usam o mesmo caminho das outras ligas. Os nomes curtos da ESPN já saem em português (Criciúma, América-MG, Atlético-GO). Athletic permanece Athletic, para não colidir com o Athletic espanhol. Não há fase de mata-mata no scoreboard; se a ESPN mandar semifinal, quartas ou ida/volta, o mapa `FASES` já traduz.

## Artilheiros (etapa 10)
- Rota `/api/{liga}/artilheiros` (cache de 10 min) lê `statistics` da ESPN: `goalsLeaders` e `assistsLeaders`. Cada líder traz nome, time já traduzido, escudo, jogos e o número (gols ou assistências). A resposta não inclui foto nem posição do jogador.
- Na tela da competição, a aba **Artilheiros** lista os 10 primeiros em gols e, abaixo, uma lista curta de 5 assistências. Se a ESPN não mandar líderes naquela competição, a aba some só nela.

## Cartão e pênalti (etapa 11)
- Nos jogos de favoritos ao vivo ou já encerrados hoje, o vigia lê o `summary` da ESPN (`keyEvents`), o mesmo payload que já busca o autor do gol. O scoreboard não traz pênalti perdido.
- Cartão vermelho: evento `Red Card` (`red-card`), com jogador, time e minuto. O segundo amarelo chega nesse mesmo tipo; o texto do lance começa com "Second yellow card". Título: `Cartão vermelho! Fulano (Time) aos 63′`. No segundo amarelo, o corpo diz isso. Cartão só amarelo não avisa.
- Pênalti: a ESPN não manda o momento em que o pênalti é marcado, antes da cobrança. Manda o resultado: `Penalty - Scored` (convertido) e `Penalty - Missed` (perdido), com jogador, time e minuto. Títulos: `Pênalti convertido! Fulano (Time) aos 32′` e `Pênalti perdido! Fulano (Time) aos 32′`. Cobrança de disputa de pênaltis (`shootout: true`) não gera esses avisos; o fim de jogo já traz o placar dos pênaltis. Um pênalti convertido também continua saindo como gol.
- O mesmo lance não sai duas vezes: a tag usa o id do `keyEvent`, como o gol usa o placar. No primeiro ciclo depois de reiniciar, e na primeira vez que o jogo entra na memória, nada de aviso antigo. O front não mudou; o cache do service worker segue `futebol-v10`.

## Estatísticas do jogo (etapa 12)
- A rota `/api/{liga}/escalacao/{jogo}` passa a incluir `estatisticas`, lidas do mesmo summary (`boxscore.teams[].statistics`). Casa à esquerda e fora à direita, nesta ordem, só com o que a ESPN mandar: posse de bola (`possessionPct`), finalizações (`totalShots`), finalizações no gol (`shotsOnTarget`), escanteios (`wonCorners`), faltas (`foulsCommitted`), impedimentos (`offsides`), cartões amarelos (`yellowCards`) e cartões vermelhos (`redCards`).
- Antes do jogo o boxscore traz totais da temporada (gols, saldo, assistências), não o placar do confronto. Sem esses campos de jogo, a seção fica oculta. Com o jogo ao vivo, a tela reconsulta no mesmo intervalo de 5 minutos que já usava enquanto a escalação não saiu.
- Cache do service worker: `futebol-v11`.

## Campo da escalação (etapa 13)
- Na tela do jogo, os dois times saem num único campo verde (linhas brancas, círculo com o número e o sobrenome embaixo). A casa fica na metade de cima, com o goleiro no topo e o ataque virado para o meio. O visitante fica na metade de baixo, com o goleiro embaixo e a formação espelhada, de frente para a casa. O nome e a formação (ex. 4-2-3-1) de cada time aparecem acima e abaixo do campo. As posições vêm de `formation` e `formationPlace` do summary, conferidos nas formações 4-4-2, 4-2-3-1, 4-3-3, 4-1-4-1, 3-4-2-1, 3-4-3, 5-3-2 e 5-4-1.
- Sem formação, sem as 11 vagas ou com um esquema que o app ainda não desenha, a tela volta para a lista de titulares. Os reservas continuam embaixo do campo, com quem entrou. O summary não traz o técnico do jogo.
- Cache do service worker: `futebol-v13`.

## Fora do MVP (não fazer agora)
Login, estatísticas de jogadores, Android/iOS nativo.

## Fonte de dados (decidido em 25/10/2026)
- **Escolhida: API pública não oficial da ESPN** (`site.api.espn.com`), **sem chave de API**.
  - Testada em 25/10/2026, com a Copa do Brasil e a Série B em 26/10/2026: cobre as 11 competições (tabela + jogos). Códigos: bra.1, bra.2, bra.copa_do_brazil, eng.1, esp.1, ita.1, ger.1, fra.1, uefa.champions, conmebol.libertadores, conmebol.sudamericana.
  - Tabela: `/apis/v2/sports/soccer/{liga}/standings`. Jogos: `/apis/site/v2/sports/soccer/{liga}/scoreboard?dates=AAAAMM` (por mês; intervalo de datas AAAAMMDD-AAAAMMDD retornou erro 400 no teste). Artilheiros: `/apis/site/v2/sports/soccer/{liga}/statistics` (`goalsLeaders` e `assistsLeaders`; testado nas 11 competições em 26/10/2026).
- Descartadas: football-data.org (exige chave; pela documentação, o plano grátis não inclui Libertadores/Sul-Americana — não testado) e TheSportsDB (não testada a fundo, pois a ESPN já cobre tudo sem chave).
- Limitações: API não oficial e sem garantia (pode mudar/sair do ar sem aviso); nomes sem tradução ficam na forma curta da ESPN; legendas da tabela traduzidas pelo app (as desconhecidas ficam em inglês); Libertadores/Sul-Americana mostram a tabela da fase de grupos (mata-mata aparece em Resultados/Próximos jogos). A Copa do Brasil não tem classificação na ESPN (resposta sem grupos): a aba Tabela avisa que é mata-mata, e as fases (oitavas, quartas, ida/volta e as demais) aparecem em Resultados e Próximos jogos. Resultados e próximos jogos cobrem ~2 meses para trás e para frente (até 60 jogos).

## Arquitetura
- `server.js`: Node 18+. Serve o front (`public/`) e faz proxy com cache para a ESPN (tabela 10 min; jogos do mês atual 2 min; outros meses 30 min; escalação 2 min; jogos de hoje 30 s; artilheiros 10 min). A única dependência é `web-push`, usada só se as variáveis VAPID existirem. A ESPN libera CORS, mas o proxy reduz chamadas e entrega os dados já em português. Com inscrições ativas, o vigia de notificações roda a cada ~60 s.
- `public/`: HTML/CSS/JS puro, `manifest.webmanifest`, `sw.js` (service worker: app abre offline e mostra os últimos dados vistos), ícones.
- Horários convertidos para America/Sao_Paulo no navegador (o fuso do aparelho não muda o horário); textos em pt-BR.
- Rotas da API: `/api/competicoes`, `/api/hoje`, `/api/ping`, `/api/push/status`, `/api/push/registrar`, `/api/push/remover`, `/api/{liga}/tabela`, `/api/{liga}/jogos`, `/api/{liga}/artilheiros`, `/api/{liga}/escalacao/{jogo}`.

## Andamento
- 25/10 21:35: Paulo confirmou MVP e pediu incluir Libertadores e Sul-Americana. Construção iniciada.
- 25/10 ~21:47: MVP pronto e testado na box (porta 3000). Teste: as 9 competições carregaram Tabela, Resultados e Próximos jogos (via curl e renderização com jsdom). Nenhuma falhou.
- 26/10: Copa do Brasil incluída (`bra.copa_do_brazil`). Standings vem vazio; a aba Tabela mostra aviso de mata-mata. A rota da API passa a aceitar underscore no id.
- 26/10: Favoritos no aparelho. Estrela na tabela e nos jogos; a opção Favoritos junta resultados e próximos de todas as competições. Cache do service worker: `futebol-v3`.
- 26/10: Nomes usuais em português na tabela e nos jogos (mapa `TIMES`). Favorito salvo com o nome antigo da ESPN não se perde. Cache do service worker: `futebol-v4`.
- 26/10: Escudos dos times na tabela, nos jogos e em Favoritos (`escudo` na API). Imagem que falha some e fica o nome. Cache do service worker: `futebol-v5`.
- 26/10: Escalação oficial ao tocar no jogo. Se ainda não saiu, a tela avisa e reconsulta a cada 5 minutos. Cache do service worker: `futebol-v6`.
- 26/10: Tela Hoje com placar ao vivo e jogos do dia em Brasília. Atualiza sozinha enquanto a tela está aberta. Cache do service worker: `futebol-v7`.
- 26/10: Notificações push dos times favoritos (gol, escalação, início, intervalo, volta e fim). Sem as chaves VAPID, o botão fica oculto. Cache do service worker: `futebol-v8`.
- 26/10: Brasileirão Série B (`bra.2`) na lista, na tabela, nos jogos, na escalação, na tela Hoje e nas notificações. Cache do service worker: `futebol-v9`.
- 26/10: Aba Artilheiros em cada competição (top 10 de gols e 5 assistências). Sem dados, a aba fica oculta só nessa competição. Cache do service worker: `futebol-v10`.
- 26/10: Notificações de cartão vermelho (inclusive segundo amarelo) e de pênalti convertido ou perdido nos jogos dos favoritos. A ESPN não manda o pênalti só marcado, antes da cobrança. Service worker segue `futebol-v10`.
- 26/10: Estatísticas do jogo na tela da escalação (posse, finalizações, no gol, escanteios, faltas, impedimentos e cartões). Sem dados de jogo, a seção fica oculta. Cache do service worker: `futebol-v11`.
- 26/10: Escalação oficial num único campo, os dois times de frente (casa em cima, visitante embaixo). Sem formação, continua a lista. Cache do service worker: `futebol-v13`.

## Próximos passos (a decidir com Paulo)
- Publicar online (não publicado ainda; ver README.md para opções gratuitas).
- Teste visual no celular real (instalar na tela inicial).
- 25/10 21:35: Paulo confirmou MVP e pediu incluir Libertadores e Sul-Americana. Construção iniciada.
- 25/10 22:36: Paulo não tem GitHub. Próximo passo: ele cria conta (github.com/signup); depois conecto, subo o repo e guio Render (Web Service, start: node server.js, plano Free).
- 25/10 22:45: GitHub conectado (cotrimmontesp-hash, só leitura). Próximo: Paulo cria repo público app-futebol com README; depois CloudAgent envia o app; Render pode implantar a branch.
