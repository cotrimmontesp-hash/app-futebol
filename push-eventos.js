// Compara o placar de um ciclo com o anterior e monta o texto das notificações.
// Não fala com a ESPN nem com o serviço de push: o servidor chama estas funções.

function gols(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function chaveJogo(j) {
  return `${j.liga}:${j.id}`;
}

function timeFavorito(time, nomes) {
  if (!time || !nomes) return false;
  const tem = typeof nomes.has === 'function' ? n => nomes.has(n) : n => nomes.includes(n);
  return !!(time.time && tem(time.time)) || !!(time.origem && tem(time.origem));
}

function jogoDoFavorito(jogo, nomes) {
  return timeFavorito(jogo.casa, nomes) || timeFavorito(jogo.fora, nomes);
}

function snapshotJogo(j) {
  const intervalo = j.status === 'STATUS_HALFTIME' || j.relogio === 'Intervalo';
  return {
    estado: j.estado,
    intervalo,
    golsCasa: gols(j.casa && j.casa.gols),
    golsFora: gols(j.fora && j.fora.gols),
    escalacao: false,
  };
}

function formatarMinuto(relogio) {
  const r = String(relogio || '').trim();
  if (!r || r === "0'" || r === '0′' || r === 'Intervalo') return '';
  return r.replace(/['’′]/g, '′');
}

function nomeTimeLado(team) {
  return (team && (team.shortDisplayName || team.displayName || team.time)) || '';
}

function ladoDoTime(team, jogo, nomeDe) {
  const nome = nomeDe ? nomeDe(team) : { time: nomeTimeLado(team) };
  const bate = (lado) => lado && (nome.time === lado.time || (nome.origem && nome.origem === lado.origem) || nome.time === lado.origem);
  if (bate(jogo.casa)) return 'casa';
  if (bate(jogo.fora)) return 'fora';
  return '';
}

function autorDoGol(detalhes, jogo, prevCasa, prevFora, nomeDe) {
  const plays = (Array.isArray(detalhes) ? detalhes : []).filter(d => d && d.scoringPlay);
  if (!plays.length) return { autor: '', contra: false, minuto: '' };
  const deltaCasa = gols(jogo.casa && jogo.casa.gols) - gols(prevCasa);
  const deltaFora = gols(jogo.fora && jogo.fora.gols) - gols(prevFora);
  const quer = deltaCasa > 0 && deltaFora <= 0 ? 'casa' : deltaFora > 0 && deltaCasa <= 0 ? 'fora' : '';
  const doLado = quer ? plays.filter(p => ladoDoTime(p.team, jogo, nomeDe) === quer) : plays;
  const play = (doLado.length ? doLado : plays)[doLado.length ? doLado.length - 1 : plays.length - 1];
  const atleta = play.participants && play.participants[0] && play.participants[0].athlete;
  const autor = (atleta && (atleta.displayName || atleta.shortName)) || '';
  const minuto = (play.clock && play.clock.displayValue) || '';
  return { autor, contra: !!play.ownGoal, minuto };
}

function diffJogo(prev, jogo) {
  if (!prev) return [];
  const eventos = [];
  const k = chaveJogo(jogo);
  const agoraIntervalo = jogo.status === 'STATUS_HALFTIME' || jogo.relogio === 'Intervalo';
  const casa = gols(jogo.casa && jogo.casa.gols);
  const fora = gols(jogo.fora && jogo.fora.gols);
  const deltaCasa = casa - prev.golsCasa;
  const deltaFora = fora - prev.golsFora;
  if (prev.estado === 'pre' && jogo.estado === 'in' && !agoraIntervalo) {
    eventos.push({ tipo: 'inicio', tag: `${k}:inicio`, jogo });
  }
  if (deltaCasa + deltaFora > 0 && (jogo.estado === 'in' || jogo.estado === 'post')) {
    const ladoGol = deltaCasa > 0 && deltaFora <= 0 ? 'casa' : deltaFora > 0 && deltaCasa <= 0 ? 'fora' : '';
    eventos.push({
      tipo: 'gol', tag: `${k}:gol:${casa}-${fora}`, jogo, ladoGol,
      prevCasa: prev.golsCasa, prevFora: prev.golsFora,
    });
  }
  if (!prev.intervalo && agoraIntervalo && jogo.estado === 'in') {
    eventos.push({ tipo: 'intervalo', tag: `${k}:intervalo`, jogo });
  }
  if (prev.intervalo && !agoraIntervalo && jogo.estado === 'in') {
    eventos.push({ tipo: 'volta', tag: `${k}:volta`, jogo });
  }
  if (prev.estado !== 'post' && jogo.estado === 'post') {
    eventos.push({ tipo: 'fim', tag: `${k}:fim`, jogo });
  }
  return eventos;
}

function iconePara(jogo, nomes, ladoGol) {
  const favCasa = timeFavorito(jogo.casa, nomes);
  const favFora = timeFavorito(jogo.fora, nomes);
  const escudo = lado => (jogo[lado] && jogo[lado].escudo) || '';
  if (ladoGol === 'casa' && escudo('casa')) return escudo('casa');
  if (ladoGol === 'fora' && escudo('fora')) return escudo('fora');
  if (favCasa && !favFora && escudo('casa')) return escudo('casa');
  if (favFora && !favCasa && escudo('fora')) return escudo('fora');
  if (favCasa && escudo('casa')) return escudo('casa');
  if (favFora && escudo('fora')) return escudo('fora');
  return escudo('casa') || escudo('fora');
}

function textoPlacar(j) {
  return `${j.casa.time} ${gols(j.casa.gols)} x ${gols(j.fora.gols)} ${j.fora.time}`;
}

function textoConfronto(j) {
  return `${j.casa.time} x ${j.fora.time}`;
}

function textoNotificacao(ev, nomes) {
  const j = ev.jogo;
  const minuto = formatarMinuto(ev.minuto || j.relogio);
  const icon = iconePara(j, nomes, ev.ladoGol);
  const url = `/#/c/${j.liga}/escalacao/${j.id}`;
  const competicao = j.competicao || '';
  let title = '';
  let body = competicao;
  if (ev.tipo === 'gol') {
    title = `GOL! ${textoPlacar(j)}${minuto ? ` (${minuto})` : ''}`;
    if (ev.autor) body = ev.contra ? `Gol contra de ${ev.autor}` : `Gol de ${ev.autor}`;
    if (ev.autor && competicao) body += ` · ${competicao}`;
  } else if (ev.tipo === 'inicio') {
    title = `Começou! ${textoConfronto(j)}`;
  } else if (ev.tipo === 'intervalo') {
    title = `Intervalo. ${textoPlacar(j)}`;
  } else if (ev.tipo === 'volta') {
    title = `Voltou do intervalo. ${textoPlacar(j)}`;
  } else if (ev.tipo === 'fim') {
    const pen = j.casa.penaltis != null && j.fora.penaltis != null ? ` (pênaltis ${j.casa.penaltis} x ${j.fora.penaltis})` : '';
    title = `Fim de jogo. ${textoPlacar(j)}${pen}`;
  } else if (ev.tipo === 'escalacao') {
    title = `Escalação divulgada: ${textoConfronto(j)}`;
  }
  return { title, body, icon, url, tag: ev.tag };
}

function avaliarCiclo(memoria, jogos, escalacoes) {
  const mem = memoria && memoria.iniciado ? memoria : { iniciado: false, jogos: {}, avisados: {} };
  const primeiro = !mem.iniciado;
  const avisados = { ...mem.avisados };
  const proximos = { ...mem.jogos };
  const eventos = [];
  const mapaEsc = escalacoes || {};
  for (const j of jogos) {
    const k = chaveJogo(j);
    const prev = mem.jogos[k];
    const snap = snapshotJogo(j);
    if (mapaEsc[k]) snap.escalacao = true;
    else if (prev && prev.escalacao) snap.escalacao = true;
    proximos[k] = snap;
    if (primeiro || !prev) continue;
    for (const ev of diffJogo(prev, j)) {
      if (avisados[ev.tag]) continue;
      avisados[ev.tag] = true;
      eventos.push(ev);
    }
    if (snap.escalacao && !prev.escalacao) {
      const tag = `${k}:escalacao`;
      if (!avisados[tag]) {
        avisados[tag] = true;
        eventos.push({ tipo: 'escalacao', tag, jogo: j });
      }
    }
  }
  return { memoria: { iniciado: true, jogos: proximos, avisados }, eventos };
}

function dentroDasProximasHoras(jogo, agoraMs, horas) {
  const t = new Date(jogo.data).getTime();
  if (!Number.isFinite(t)) return false;
  return jogo.estado === 'pre' && t >= agoraMs && t <= agoraMs + horas * 60 * 60 * 1000;
}

module.exports = {
  gols, chaveJogo, timeFavorito, jogoDoFavorito, snapshotJogo, formatarMinuto,
  autorDoGol, diffJogo, textoNotificacao, avaliarCiclo, dentroDasProximasHoras, iconePara,
};
