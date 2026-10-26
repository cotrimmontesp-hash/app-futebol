# App Futebol (MVP)

Tabela, resultados e próximos jogos de 11 competições (Brasileirão Série A e Série B, Copa do Brasil, Libertadores, Sul-Americana, Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League). Funciona como app no celular (PWA).

A estrela ao lado do time marca um favorito neste aparelho. Em **Favoritos**, na tela inicial, aparecem os resultados e os próximos jogos desses times em todas as competições.

Os nomes usuais saem em português (Bayern de Munique, Atlético de Madri, Inter de Milão, PSG). Manchester United e os demais sem tradução ficam como a ESPN envia. Um favorito salvo com o nome antigo continua valendo.

O escudo do time, quando a ESPN envia, aparece ao lado do nome na tabela, nos jogos e em Favoritos. Se não houver imagem ou ela falhar, fica só o nome.

Toque num jogo para ver a escalação oficial. Se ainda não saiu, o app avisa e consulta de novo a cada 5 minutos enquanto essa tela estiver aberta.

**Hoje**, em destaque na tela inicial, lista os jogos do dia no horário de Brasília: ao vivo (placar e minuto), os que ainda vão começar e os já encerrados. Com essa tela aberta, o placar atualiza sozinho.

## Notificações no celular
No Android, com o app instalado pelo Chrome, abra **Favoritos** e toque em **Ativar notificações**. O aviso só sai para os times marcados com a estrela: gol, escalação divulgada, começo, intervalo, volta do intervalo e fim de jogo.

Sem estas variáveis o app funciona igual e o botão não aparece:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (ex.: `mailto:voce@email.com`)

Gere o par de chaves com:

```
npx web-push generate-vapid-keys
```

No Render, coloque as três em Environment e use Build command `npm install` (a única dependência é `web-push`). O plano grátis dorme: um serviço externo pode chamar `GET /api/ping` (responde `ok`) para manter o servidor acordado. As inscrições ficam na memória e num arquivo JSON local; ao abrir o app de novo, o aparelho reenvia a inscrição e os favoritos. O primeiro ciclo depois de um reinício não repete aviso antigo.

## Rodar no computador
Precisa do Node.js 18 ou mais novo (https://nodejs.org).
```
cd app-futebol
node server.js          # ou: npm start
```
Abra http://localhost:3000. Para usar outra porta: `PORT=8080 node server.js`.

## Instalar no celular
Com o app publicado (endereço https), abra no Chrome (Android) ou Safari (iPhone) e use "Adicionar à tela inicial".

## Publicar de graça (opções; nada foi publicado ainda)
- **Render.com** (mais simples): suba esta pasta num repositório do GitHub → New → Web Service → Build command: `npm install` / Start command: `node server.js` → plano Free. Obs.: no plano grátis o servidor "dorme" sem uso e o primeiro acesso demora ~1 min. Para as notificações, veja as variáveis VAPID acima e `GET /api/ping`.
- Alternativas parecidas: Railway, Fly.io, Koyeb.

## Fonte dos dados
API pública não oficial da ESPN (sem chave). Pode mudar sem aviso. Detalhes em `requisitos.md`.
