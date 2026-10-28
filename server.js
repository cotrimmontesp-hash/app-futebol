// Servidor do App Futebol: serve o front (pasta public) e um proxy com cache para a API pública da ESPN.
// Node 18+ (fetch nativo). A única dependência é web-push, e só entra se as chaves VAPID existirem.
const http = require('http');
const fs = require('fs');
const path = require('path');
const eventosPush = require('./push-eventos');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const ESPN = 'https://site.api.espn.com/apis';

const COMPETICOES = [
  { id: 'bra.1', nome: 'Brasileirão Série A', pais: 'Brasil', tipo: 'liga' },
  { id: 'bra.2', nome: 'Brasileirão Série B', pais: 'Brasil', tipo: 'liga' },
  { id: 'bra.copa_do_brazil', nome: 'Copa do Brasil', pais: 'Brasil', tipo: 'copa' },
  { id: 'conmebol.libertadores', nome: 'Copa Libertadores', pais: 'América do Sul', tipo: 'copa' },
  { id: 'conmebol.sudamericana', nome: 'Copa Sul-Americana', pais: 'América do Sul', tipo: 'copa' },
  { id: 'eng.1', nome: 'Premier League', pais: 'Inglaterra', tipo: 'liga' },
  { id: 'esp.1', nome: 'La Liga', pais: 'Espanha', tipo: 'liga' },
  { id: 'ita.1', nome: 'Serie A', pais: 'Itália', tipo: 'liga' },
  { id: 'ger.1', nome: 'Bundesliga', pais: 'Alemanha', tipo: 'liga' },
  { id: 'fra.1', nome: 'Ligue 1', pais: 'França', tipo: 'liga' },
  { id: 'uefa.champions', nome: 'Champions League', pais: 'Europa', tipo: 'copa' },
];
const IDS = new Set(COMPETICOES.map(c => c.id));

// Traduções das legendas da tabela (ESPN devolve em inglês)
const NOTAS = {
  'Relegated': 'Rebaixado', 'Relegation': 'Rebaixamento', 'Relegation playoff': 'Playoff de rebaixamento',
  'Champions League': 'Champions League', 'Champions League qualifying': 'Qualificatória da Champions',
  'Europa League': 'Europa League', 'Conference League qualifying': 'Qualificatória da Conference League',
  'Qualifies for Round of 16': 'Classificado às oitavas', 'Qualifies for round of 16': 'Classificado às oitavas',
  'Qualifies for KO Playoffs': 'Vai aos playoffs', 'Knockout phase playoffs - seeded': 'Playoffs (cabeça de chave)',
  'Knockout phase playoffs - unseeded': 'Playoffs (sem cabeça de chave)', 'Eliminated': 'Eliminado',
  'Qualifies for Sudamericana KO Playoffs': 'Vai aos playoffs da Sul-Americana',
  'Copa Libertadores': 'Libertadores', 'Copa Libertadores qualifying': 'Pré-Libertadores',
  'Copa Sudamericana': 'Sul-Americana', 'Copa Sudamericana qualifying': 'Sul-Americana',
};
const GRUPOS = s => s.replace(/^Group /, 'Grupo ');

// Nome curto/inglês da ESPN -> nome usual no Brasil. Sem entrada, fica o nome original.
const TIMES = {
  'Bayern': 'Bayern de Munique', 'Bayern Munich': 'Bayern de Munique',
  'Atlético': 'Atlético de Madri', 'Atlético Madrid': 'Atlético de Madri', 'Atletico Madrid': 'Atlético de Madri',
  'Inter Milan': 'Inter de Milão', 'Internazionale': 'Inter de Milão',
  'Man Utd': 'Manchester United', 'Man City': 'Manchester City',
  'Paris Saint-Germain': 'PSG',
  'Spurs': 'Tottenham', 'Tottenham Hotspur': 'Tottenham',
  'C Palace': 'Crystal Palace', 'Nottm Forest': 'Nottingham Forest',
  'Dortmund': 'Borussia Dortmund', 'Gladbach': 'Borussia Mönchengladbach',
  'Leverkusen': 'Bayer Leverkusen', 'Frankfurt': 'Eintracht Frankfurt',
  'Cologne': 'Colônia', 'FC Cologne': 'Colônia',
  'Hamburg': 'Hamburgo', 'Hamburg SV': 'Hamburgo',
  'Bremen': 'Werder Bremen', 'Werder Bremen': 'Werder Bremen',
  'AS Roma': 'Roma', 'Verona': 'Hellas Verona', 'AC Milan': 'Milan',
  'Betis': 'Real Betis', 'Rayo': 'Rayo Vallecano', 'Celta Vigo': 'Celta de Vigo',
  'Valladolid': 'Real Valladolid', 'FC Porto': 'Porto',
  'Fenerbahce': 'Fenerbahçe', 'Dinamo Zagreb': 'Dínamo Zagreb',
  'Slavia Prague': 'Slavia Praga', 'Sparta': 'Sparta Praga', 'Sparta Prague': 'Sparta Praga',
  'Red Star': 'Estrela Vermelha', 'Red Star Belgrade': 'Estrela Vermelha',
  'S Bratislava': 'Slovan Bratislava', 'Bodo/Glimt': 'Bodø/Glimt',
  'Marseille': 'Olympique de Marselha', 'Wolves': 'Wolverhampton', 'Wolverhampton Wanderers': 'Wolverhampton',
  'Shakhtar': 'Shakhtar Donetsk', 'RB Salzburg': 'Red Bull Salzburg',
  'FK Qarabag': 'Qarabag', 'Union SG': 'Union Saint-Gilloise', 'Union St.-Gilloise': 'Union Saint-Gilloise',
  'LASK Linz': 'LASK', 'St. Étienne': 'Saint-Étienne', 'Le Havre AC': 'Le Havre',
  'Boca': 'Boca Juniors', 'Atl. Junior': 'Atlético Junior', 'Atl. Nacional': 'Atlético Nacional',
  'Ind. del Valle': 'Independiente del Valle', 'Ind. Medellín': 'Independiente Medellín',
  'Ind. Rivadavia': 'Independiente Rivadavia',
  'U de Chile': 'Universidad de Chile', 'U Católica': 'Universidad Católica',
  'U. Católica': 'Católica de Quito', 'Universidad Católica (Quito)': 'Católica de Quito',
  'Strongest': 'The Strongest', 'Colo Colo': 'Colo-Colo',
  'Argentinos': 'Argentinos Juniors', 'Def. y Jus.': 'Defensa y Justicia',
  'CI Petrolero': 'Independiente Petrolero',
  'C. Córdoba (SE)': 'Central Córdoba', 'Central Córdoba (Santiago del Estero)': 'Central Córdoba',
  'Dep. Iquique': 'Deportes Iquique', 'N Potosí': 'Nacional Potosí',
  'Bucaramanga': 'Atlético Bucaramanga', 'América Cali': 'América de Cali',
  'Santa Fe': 'Independiente Santa Fe', 'Alianza Atl': 'Alianza Atlético',
  'Coquimbo': 'Coquimbo Unido', 'Cuenca': 'Deportivo Cuenca',
  'Dep. Recoleta': 'Deportivo Recoleta', 'La Guaira': 'Deportivo La Guaira',
  'MC Torque': 'Montevideo City Torque', 'Puerto Cabello': 'Academia Puerto Cabello',
  'Riestra': 'Deportivo Riestra', 'Tolima': 'Deportes Tolima', 'Barracas': 'Barracas Central',
  'Bulo Bulo': 'San Antonio Bulo Bulo', 'Garcilaso': 'Deportivo Garcilaso',
  'Univ. de Vinto': 'Universitario de Vinto',
};
function nomeTime(team) {
  const bruto = team ? String(team.shortDisplayName || team.displayName || '').trim() : '';
  if (!bruto) return { time: '?' };
  const time = TIMES[bruto] || bruto;
  return time === bruto ? { time } : { time, origem: bruto };
}
function escudoUrl(team) {
  if (!team) return '';
  if (team.logo) return team.logo;
  const lista = Array.isArray(team.logos) ? team.logos : [];
  const logo = lista.find(l => l && l.href);
  return logo ? logo.href : '';
}
const POS = {
  G: 'GOL', CD: 'ZAG', 'CD-L': 'ZAG', 'CD-R': 'ZAG', LB: 'LE', RB: 'LD',
  CM: 'MC', 'CM-L': 'MC', 'CM-R': 'MC', LM: 'ME', RM: 'MD',
  AM: 'MEI', 'AM-L': 'MEI', 'AM-R': 'MEI',
  CF: 'ATA', 'CF-L': 'ATA', 'CF-R': 'ATA', F: 'ATA', SUB: '',
};
function jogadorEscalacao(p) {
  const ab = (p.position && p.position.abbreviation) || '';
  return {
    camisa: p.jersey || '',
    posicao: Object.prototype.hasOwnProperty.call(POS, ab) ? POS[ab] : ab,
    nome: (p.athlete && (p.athlete.displayName || p.athlete.shortName) || '').trim() || '?',
    lugar: p.formationPlace == null || p.formationPlace === '' ? '' : String(p.formationPlace),
    entrou: !!p.subbedIn,
    saiu: !!p.subbedOut,
  };
}
function timeEscalacao(r) {
  const players = Array.isArray(r.roster) ? r.roster : [];
  const titulares = players.filter(p => p.starter)
    .sort((a, b) => (Number(a.formationPlace) || 99) - (Number(b.formationPlace) || 99))
    .map(jogadorEscalacao);
  const reservas = players.filter(p => !p.starter).map(jogadorEscalacao);
  return {
    ...nomeTime(r.team),
    escudo: escudoUrl(r.team),
    formacao: r.formation || '',
    titulares, reservas,
    _ord: r.homeAway === 'home' ? 0 : r.homeAway === 'away' ? 1 : 2,
  };
}
const ESTATISTICAS_JOGO = [
  ['possessionPct', 'Posse de bola', true],
  ['totalShots', 'Finalizações', false],
  ['shotsOnTarget', 'Finalizações no gol', false],
  ['wonCorners', 'Escanteios', false],
  ['foulsCommitted', 'Faltas', false],
  ['offsides', 'Impedimentos', false],
  ['yellowCards', 'Cartões amarelos', false],
  ['redCards', 'Cartões vermelhos', false],
];
function textoStat(s, percentual) {
  if (!s || s.displayValue == null || String(s.displayValue).trim() === '') return null;
  const v = String(s.displayValue).trim();
  if (percentual && !v.includes('%')) return v + '%';
  return v;
}
function estatisticasJogo(box) {
  const teams = box && Array.isArray(box.teams) ? box.teams : [];
  const casa = teams.find(t => t && t.homeAway === 'home');
  const fora = teams.find(t => t && t.homeAway === 'away');
  if (!casa || !fora) return null;
  const achar = (time, nome) => (Array.isArray(time.statistics) ? time.statistics : []).find(x => x && x.name === nome);
  const linhas = [];
  for (const [nome, rotulo, percentual] of ESTATISTICAS_JOGO) {
    const a = textoStat(achar(casa, nome), percentual);
    const b = textoStat(achar(fora, nome), percentual);
    if (a == null && b == null) continue;
    linhas.push({ rotulo, casa: a == null ? '' : a, fora: b == null ? '' : b });
  }
  if (!linhas.length) return null;
  const lado = t => ({ ...nomeTime(t.team), escudo: escudoUrl(t.team) });
  return { casa: lado(casa), fora: lado(fora), linhas };
}
function estadoSumario(d) {
  const c = d && d.header && d.header.competitions && d.header.competitions[0];
  const st = c && c.status && c.status.type;
  return (st && st.state) || '';
}
function nomeAtletaLance(p) {
  const a = p && p.athlete;
  return (a && (a.displayName || a.shortName) || '').trim();
}
function minutoLance(clock) {
  return (clock && clock.displayValue) || '';
}
function segundosLance(minuto) {
  const m = String(minuto || '').match(/(\d+)\s*['’′](?:\s*\+\s*(\d+))?/);
  if (!m) return -1;
  return Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
}
function timeLance(team) {
  if (!team) return '';
  const n = nomeTime(team);
  if (n.origem) return n.time;
  const bruto = String(team.shortDisplayName || team.displayName || '');
  const alt = bruto.replace(/Saint Germain/g, 'Saint-Germain');
  if (alt !== bruto && TIMES[alt]) return TIMES[alt];
  return n.time && n.time !== '?' ? n.time : '';
}
function tipoLance(slug, rotulo) {
  if (slug === 'own-goal' || rotulo === 'Own Goal') return 'gol-contra';
  if (slug === 'penalty---scored' || rotulo === 'Penalty - Scored') return 'penalti';
  if (slug === 'penalty---missed' || slug === 'penalty---saved' || rotulo === 'Penalty - Missed' || rotulo === 'Penalty - Saved') return 'penalti-perdido';
  if (slug === 'yellow-card' || rotulo === 'Yellow Card') return 'amarelo';
  if (slug === 'red-card' || rotulo === 'Red Card') return 'vermelho';
  if (slug === 'substitution' || rotulo === 'Substitution') return 'substituicao';
  if (slug === 'goal' || slug.startsWith('goal---') || /^Goal\b/.test(rotulo)) return 'gol';
  return '';
}
function textoLance(k, tipo) {
  const time = timeLance(k.team);
  const deQuem = nome => nome ? `${nome}${time ? ` (${time})` : ''}` : (time || '');
  const jogador = nomeAtletaLance(k.participants && k.participants[0]);
  if (tipo === 'gol-contra') {
    const m = String(k.text || '').match(/Own Goal by .+?,\s*([^.]+)\./i);
    const clube = m ? timeLance({ displayName: m[1].trim() }) : '';
    const quem = jogador || (m && m[1].trim()) || '';
    return quem ? `Gol contra de ${quem}${clube ? ` (${clube})` : ''}` : 'Gol contra';
  }
  if (tipo === 'penalti') return jogador || time ? `Pênalti convertido por ${deQuem(jogador)}` : '';
  if (tipo === 'penalti-perdido') return jogador || time ? `Pênalti perdido por ${deQuem(jogador)}` : '';
  if (tipo === 'amarelo') return jogador || time ? `Cartão amarelo para ${deQuem(jogador)}` : '';
  if (tipo === 'vermelho') {
    const segundo = /^Second yellow/i.test(k.text || '');
    return jogador || time ? `${segundo ? 'Segundo amarelo' : 'Cartão vermelho'} para ${deQuem(jogador)}` : '';
  }
  if (tipo === 'substituicao') {
    let entra = nomeAtletaLance(k.participants && k.participants[0]);
    let sai = nomeAtletaLance(k.participants && k.participants[1]);
    const m = String(k.text || '').match(/\.\s*(.+?)\s+replaces\s+(.+?)(?:\s+because\b|\.|$)/i);
    if (m && (!entra || !sai)) { entra = entra || m[1].trim(); sai = sai || m[2].trim(); }
    if (!entra || !sai) return '';
    return `Sai ${sai}, entra ${entra}${time ? ` (${time})` : ''}`;
  }
  const assist = nomeAtletaLance(k.participants && k.participants[1]);
  const varReview = /\bVAR Review\b/i.test(k.text || '');
  if (!jogador && !time) return '';
  let texto = `Gol de ${deQuem(jogador)}`;
  if (assist) texto += `. Assistência de ${assist}`;
  if (varReview) texto += '. Confirmado pelo VAR';
  return texto;
}
function lanceVar(text, minuto, ordem) {
  const base = { minuto, tipo: 'var', sec: segundosLance(minuto), ordem };
  const anulado = text.match(/^GOAL OVERTURNED BY VAR:\s*(.+?)\s*\((.+?)\)/i);
  if (anulado) {
    const time = timeLance({ displayName: anulado[2].trim() });
    return { ...base, anulado: true, texto: `Gol anulado pelo VAR: ${anulado[1].trim()}${time ? ` (${time})` : ''}` };
  }
  if (!/^VAR Decision:/i.test(text)) return null;
  const resto = text.replace(/^VAR Decision:\s*/i, '').replace(/\.\s*$/, '').trim();
  let carta = resto.match(/^Card upgraded\s+(.+?)\s*\((.+?)\)$/i);
  if (carta) {
    const time = timeLance({ displayName: carta[2].trim() });
    return { ...base, texto: `Cartão alterado pelo VAR: ${carta[1].trim()}${time ? ` (${time})` : ''}` };
  }
  if (/^Card Changed/i.test(resto)) return { ...base, texto: 'Cartão alterado pelo VAR' };
  carta = resto.match(/^No card change\s+(.+?)\s*\((.+?)\)$/i);
  if (carta) {
    const time = timeLance({ displayName: carta[2].trim() });
    return { ...base, texto: `Cartão mantido pelo VAR: ${carta[1].trim()}${time ? ` (${time})` : ''}` };
  }
  if (/^No Goal\b/i.test(resto)) return { ...base, anulaGol: true, texto: 'Gol anulado pelo VAR' };
  const gol = resto.match(/^Goal\b.*\(([^)]+)\)\s*$/i);
  if (/^Goal\b/i.test(resto)) return { ...base, confirmaGol: true, jogador: gol ? gol[1].trim() : '', texto: gol ? `Gol confirmado pelo VAR: ${gol[1].trim()}` : 'Gol confirmado pelo VAR' };
  const semPen = resto.match(/^No Penalty\s+(.+)$/i);
  if (semPen) {
    const time = timeLance({ displayName: semPen[1].trim() });
    return { ...base, texto: `Pênalti anulado pelo VAR${time ? `: ${time}` : ''}` };
  }
  const pen = resto.match(/^Penalty\s+(.+)$/i);
  if (pen) {
    const time = timeLance({ displayName: pen[1].trim() });
    return { ...base, texto: `Pênalti marcado pelo VAR${time ? `: ${time}` : ''}` };
  }
  if (/^Other Decision Cancelled/i.test(resto)) return { ...base, texto: 'Decisão do VAR cancelada' };
  return { ...base, texto: 'Revisão do VAR' };
}
function lancesDoJogo(d) {
  const eventos = Array.isArray(d && d.keyEvents) ? d.keyEvents : [];
  const lances = [];
  eventos.forEach((k, index) => {
    if (!k || !k.type || k.shootout) return;
    const slug = k.type.type || '';
    const rotulo = k.type.text || '';
    const tipo = tipoLance(slug, rotulo);
    const minuto = minutoLance(k.clock);
    if (!tipo) {
      if ((slug === 'start-delay' || rotulo === 'Start Delay') && /\bVAR checking\b/i.test(k.text || '')) {
        lances.push({ minuto, tipo: 'var', texto: 'VAR em análise', sec: segundosLance(minuto), ordem: index, analise: true });
      }
      return;
    }
    const texto = textoLance(k, tipo);
    if (!texto) return;
    lances.push({
      minuto, tipo, texto, sec: segundosLance(minuto), ordem: index,
      jogador: nomeAtletaLance(k.participants && k.participants[0]),
      varReview: (tipo === 'gol' || tipo === 'penalti') && /\bVAR Review\b/i.test(k.text || ''),
    });
  });
  const comentarios = Array.isArray(d && d.commentary) ? d.commentary : [];
  const extras = [];
  comentarios.forEach(c => {
    const text = c && c.text || '';
    if (!/^VAR Decision:/i.test(text) && !/^GOAL OVERTURNED BY VAR:/i.test(text)) return;
    const minuto = minutoLance(c.time);
    const v = lanceVar(text, minuto, 100000 + (Number(c.sequence) || 0));
    if (!v) return;
    if (v.confirmaGol && lances.some(l => (l.tipo === 'gol' || l.tipo === 'penalti') && l.varReview && (!v.jogador || l.texto.includes(v.jogador)))) return;
    if (v.anulaGol && [...lances, ...extras].some(l => l.anulado && l.sec >= 0 && Math.abs(l.sec - v.sec) <= 180)) return;
    extras.push(v);
  });
  const todos = lances.concat(extras).filter(l => {
    if (!l.analise) return true;
    return !extras.some(o => o.tipo === 'var' && !o.analise && o.sec >= 0 && Math.abs(o.sec - l.sec) <= 180);
  });
  todos.sort((a, b) => (b.sec - a.sec) || (b.ordem - a.ordem));
  return todos.map(({ minuto, tipo, texto }) => ({ minuto, tipo, texto }));
}
async function escalacao(liga, eventId) {
  const url = `${ESPN}/site/v2/sports/soccer/${liga}/summary?event=${eventId}`;
  let d = await espn(url, 2 * 60e3);
  if (estadoSumario(d) === 'in') d = await espn(url, 30e3);
  const times = (Array.isArray(d.rosters) ? d.rosters : []).map(timeEscalacao)
    .sort((a, b) => a._ord - b._ord)
    .map(({ _ord, ...t }) => t);
  const extra = { estatisticas: estatisticasJogo(d.boxscore), aoVivo: estadoSumario(d) === 'in', lances: lancesDoJogo(d) };
  if (!times.some(t => t.titulares.length)) return { divulgada: false, ...extra };
  return { divulgada: true, times, ...extra };
}

const cache = new Map();
async function espn(url, ttlMs) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttlMs) return hit.data;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'app-futebol/1.0' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('ESPN HTTP ' + r.status);
    const data = await r.json();
    cache.set(url, { t: Date.now(), data });
    return data;
  } catch (e) {
    if (hit) return hit.data; // usa dado antigo se a ESPN falhar
    throw e;
  }
}

function stat(e, nome) {
  const s = e.stats.find(x => x.name === nome);
  return s ? s.displayValue : '';
}

async function tabela(id) {
  let d;
  try {
    d = await espn(`${ESPN}/v2/sports/soccer/${id}/standings`, 10 * 60e3);
  } catch (e) {
    // Mata-mata sem classificação na ESPN (4xx) não deve virar erro na aba Tabela.
    if (/ESPN HTTP 4\d\d/.test(String(e && e.message))) return { temporada: '', grupos: [], semTabela: true };
    throw e;
  }
  const children = Array.isArray(d.children) ? d.children : [];
  const entradas = g => (g.standings && g.standings.entries) || [];
  if (!children.some(g => entradas(g).length)) return { temporada: '', grupos: [], semTabela: true };
  const grupos = children.filter(g => entradas(g).length).map(g => ({
    nome: (children.length > 1) ? GRUPOS(g.name) : '',
    linhas: entradas(g).map(e => ({
      pos: Number(stat(e, 'rank')) || null,
      ...nomeTime(e.team),
      escudo: escudoUrl(e.team),
      j: stat(e, 'gamesPlayed'), v: stat(e, 'wins'), e: stat(e, 'ties'), d: stat(e, 'losses'),
      gp: stat(e, 'pointsFor'), gc: stat(e, 'pointsAgainst'), sg: stat(e, 'pointDifferential'), pts: stat(e, 'points'),
      nota: e.note ? { cor: e.note.color, texto: NOTAS[e.note.description] || e.note.description } : null,
    })).sort((a, b) => (a.pos || 99) - (b.pos || 99)),
  }));
  const primeira = children.find(g => g.standings);
  const temporada = (primeira && primeira.standings.seasonDisplayName) || '';
  return { temporada, grupos };
}

function mes(offset) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const FASES = { 'Semifinals': 'Semifinal', 'semifinals': 'Semifinal', 'Final': 'Final', 'Finals': 'Final', 'final': 'Final', 'finals': 'Final',
  'Quarterfinals': 'Quartas de final', 'quarterfinals': 'Quartas de final', 'Round of 16': 'Oitavas de final', 'round-of-16': 'Oitavas de final',
  '1st Leg': 'Ida', '2nd Leg': 'Volta', 'Knockout Round Playoffs': 'Playoffs', 'League Phase': 'Fase de liga',
  'First Round': 'Primeira fase', 'first-round': 'Primeira fase', 'Second Round': 'Segunda fase', 'second-round': 'Segunda fase',
  'Third Round': 'Terceira fase', 'third-round': 'Terceira fase', 'Fourth Round': 'Quarta fase', 'fourth-round': 'Quarta fase',
  'Fifth Round': 'Quinta fase', 'fifth-round': 'Quinta fase' };
function fase(c, temporada) {
  const partes = [];
  let titulo = c.series && c.series.title;
  if (!titulo && temporada && FASES[temporada.slug]) titulo = temporada.slug;
  if (titulo) partes.push(FASES[titulo] || titulo);
  if (c.leg && c.leg.displayValue) partes.push(FASES[c.leg.displayValue] || c.leg.displayValue);
  return partes.join(' · ');
}

function relogioDe(status) {
  const st = (status && status.type) || {};
  const clock = String((status && status.displayClock) || '').trim();
  if (st.name === 'STATUS_HALFTIME') return 'Intervalo';
  if (clock) return clock;
  if (st.state === 'in') return String(st.shortDetail || st.detail || '').trim();
  return clock;
}
function jogo(ev) {
  const c = ev.competitions[0];
  const st = ev.status.type;
  const lado = h => {
    const t = c.competitors.find(x => x.homeAway === h) || {};
    return {
      ...nomeTime(t.team),
      escudo: escudoUrl(t.team),
      gols: t.score, penaltis: t.shootoutScore ?? null, venceu: !!t.winner,
    };
  };
  return {
    id: ev.id, data: ev.date, estado: st.state, // pre | in | post
    status: st.name, relogio: relogioDe(ev.status),
    casa: lado('home'), fora: lado('away'),
    estadio: c.venue ? c.venue.fullName : '', fase: fase(c, ev.season),
  };
}

const TZ_BR = 'America/Sao_Paulo';
const NAO_JOGADOS = ['STATUS_POSTPONED', 'STATUS_CANCELED', 'STATUS_ABANDONED'];
function ymdBrasilia(date) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: TZ_BR, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const p = tipo => partes.find(x => x.type === tipo).value;
  return `${p('year')}${p('month')}${p('day')}`;
}
function isoDeYmd(ymd) {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}
function diaBrasilia(date) {
  return isoDeYmd(ymdBrasilia(date));
}
function deslocarYmd(ymd, dias) {
  const dt = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8) + dias, 12));
  return `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, '0')}${String(dt.getUTCDate()).padStart(2, '0')}`;
}
function dataCalendarioValida(ano, mes, dia) {
  const dt = new Date(Date.UTC(ano, mes - 1, dia));
  return dt.getUTCFullYear() === ano && dt.getUTCMonth() === mes - 1 && dt.getUTCDate() === dia;
}
// `data` opcional de /api/hoje. Ausente = hoje. Janela inclusiva: 7 dias antes até 14 depois, em Brasília.
function interpretarDataConsulta(bruto) {
  if (bruto == null) return { ymd: null };
  const s = String(bruto).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/) || s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return { erro: 'Data inválida. Use uma data real no formato YYYY-MM-DD ou YYYYMMDD.' };
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (!dataCalendarioValida(ano, mes, dia)) {
    return { erro: 'Data inválida. Use uma data real no formato YYYY-MM-DD ou YYYYMMDD.' };
  }
  const ymd = m[1] + m[2] + m[3];
  const hojeYmd = ymdBrasilia(new Date());
  if (ymd < deslocarYmd(hojeYmd, -7) || ymd > deslocarYmd(hojeYmd, 14)) {
    return { erro: 'Data fora do intervalo permitido: de 7 dias antes a 14 dias depois de hoje (horário de Brasília).' };
  }
  return { ymd };
}
async function hoje(ymdPedido) {
  const hojeYmd = ymdPedido || ymdBrasilia(new Date());
  const alvo = ymdPedido ? isoDeYmd(ymdPedido) : diaBrasilia(new Date());
  const datas = [-1, 0, 1].map(d => deslocarYmd(hojeYmd, d));
  // O cache da ESPN é a URL; dates=YYYYMMDD muda a chave, então um dia não reaproveita o placar de outro.
  const tarefas = COMPETICOES.flatMap(c => datas.map(data => {
    const url = `${ESPN}/site/v2/sports/soccer/${c.id}/scoreboard?dates=${data}&limit=100`;
    return espn(url, 30e3).then(r => ({ c, events: (r && r.events) || [] })).catch(() => null);
  }));
  const res = await Promise.all(tarefas);
  if (res.every(r => r === null)) throw new Error('ESPN indisponível');
  const mapa = new Map();
  for (const r of res) {
    if (!r) continue;
    for (const ev of r.events) {
      if (!ev || !ev.date || !ev.status || !ev.status.type || !ev.competitions || !ev.competitions[0]) continue;
      if (diaBrasilia(new Date(ev.date)) !== alvo) continue;
      const j = jogo(ev);
      if (NAO_JOGADOS.includes(j.status) || !['pre', 'in', 'post'].includes(j.estado)) continue;
      mapa.set(String(ev.id), { ...j, liga: r.c.id, competicao: r.c.nome });
    }
  }
  const jogosLista = [...mapa.values()].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  return { jogos: jogosLista, atualizadoEm: new Date().toISOString(), data: alvo };
}

function numeroEstatistica(lista, nome) {
  const s = (Array.isArray(lista) ? lista : []).find(x => x && x.name === nome);
  const n = s ? Number(s.value) : NaN;
  return Number.isFinite(n) ? n : null;
}
function numeroNoTexto(texto, re) {
  const m = String(texto || '').match(re);
  return m ? Number(m[1]) : null;
}
function liderEstatistica(L) {
  const a = (L && L.athlete) || {};
  const stats = a.statistics;
  const jogos = numeroNoTexto(L.displayValue, /Matches:\s*(\d+)/) ?? numeroEstatistica(stats, 'appearances');
  const gols = numeroNoTexto(L.displayValue, /Goals:\s*(\d+)/) ?? numeroEstatistica(stats, 'totalGoals');
  const assistencias = numeroNoTexto(L.displayValue, /Assists:\s*(\d+)/) ?? numeroEstatistica(stats, 'goalAssists');
  return {
    nome: String(a.displayName || a.shortName || '').trim() || '?',
    ...nomeTime(a.team),
    escudo: escudoUrl(a.team),
    jogos, gols, assistencias,
  };
}
async function artilheiros(id) {
  let d;
  try {
    d = await espn(`${ESPN}/site/v2/sports/soccer/${id}/statistics`, 10 * 60e3);
  } catch (e) {
    if (/ESPN HTTP 4\d\d/.test(String(e && e.message))) return { gols: [], assistencias: [] };
    throw e;
  }
  const stats = Array.isArray(d.stats) ? d.stats : [];
  const leaders = nome => {
    const bloco = stats.find(s => s && s.name === nome);
    return Array.isArray(bloco && bloco.leaders) ? bloco.leaders : [];
  };
  const lista = (nome, n) => leaders(nome).slice(0, n).map(liderEstatistica).filter(x => x.nome !== '?');
  return { gols: lista('goalsLeaders', 10), assistencias: lista('assistsLeaders', 5) };
}

async function jogos(id) {
  const meses = [-2, -1, 0, 1, 2].map(mes);
  const urls = meses.map(m => `${ESPN}/site/v2/sports/soccer/${id}/scoreboard?dates=${m}&limit=400`);
  const res = await Promise.all(urls.map((u, i) => espn(u, meses[i] === mes(0) ? 2 * 60e3 : 30 * 60e3).catch(() => null)));
  if (res.every(r => r === null)) throw new Error('ESPN indisponível');
  const mapa = new Map();
  res.forEach(r => (r && r.events || []).forEach(ev => mapa.set(ev.id, jogo(ev))));
  const todos = [...mapa.values()];
  const resultados = todos.filter(j => j.estado === 'post' || j.estado === 'in')
    .sort((a, b) => b.data.localeCompare(a.data)).slice(0, 60);
  const proximos = todos.filter(j => j.estado === 'pre' && !NAO_JOGADOS.includes(j.status))
    .sort((a, b) => a.data.localeCompare(b.data)).slice(0, 60);
  return { resultados, proximos, atualizadoEm: new Date().toISOString() };
}

const ARQUIVO_PUSH = process.env.PUSH_ARQUIVO || path.join(__dirname, 'data', 'push-inscricoes.json');
const VIGIA_MS = 60 * 1000;
let webpush = null;
let pushAtivo = false;
let inscricoes = [];
let memoriaPush = null;
let timerPush = null;
let cicloOcupado = false;

function prepararPush() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) return false;
  try {
    webpush = require('web-push');
    webpush.setVapidDetails(subject, pub, priv);
    return true;
  } catch (e) {
    console.error('Notificações desligadas:', e.message);
    webpush = null;
    return false;
  }
}

function carregarInscricoes() {
  try {
    const d = JSON.parse(fs.readFileSync(ARQUIVO_PUSH, 'utf8'));
    inscricoes = (Array.isArray(d.inscricoes) ? d.inscricoes : []).filter(i => i && i.inscricao && i.inscricao.endpoint);
  } catch { inscricoes = []; }
}

function salvarInscricoes() {
  try {
    fs.mkdirSync(path.dirname(ARQUIVO_PUSH), { recursive: true });
    const tmp = ARQUIVO_PUSH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ inscricoes }, null, 2));
    fs.renameSync(tmp, ARQUIVO_PUSH);
  } catch (e) {
    console.error('Não foi possível gravar as inscrições:', e.message);
  }
}

function normalizarFavoritos(lista) {
  if (!Array.isArray(lista)) return [];
  return [...new Set(lista.filter(x => typeof x === 'string').map(s => s.trim()).filter(Boolean))].slice(0, 80);
}

function inscricaoValida(s) {
  return !!(s && typeof s.endpoint === 'string' && s.endpoint.startsWith('https://')
    && s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string');
}

function statusPush() {
  return pushAtivo
    ? { ativo: true, chavePublica: process.env.VAPID_PUBLIC_KEY }
    : { ativo: false };
}

function registrarInscricao(body) {
  if (!pushAtivo) return { code: 503, corpo: { erro: 'Notificações indisponíveis' } };
  const bruta = body && (body.inscricao || body.subscription);
  if (!inscricaoValida(bruta)) return { code: 400, corpo: { erro: 'Inscrição inválida' } };
  const favoritos = normalizarFavoritos(body.favoritos);
  const item = { inscricao: { endpoint: bruta.endpoint, keys: { p256dh: bruta.keys.p256dh, auth: bruta.keys.auth } }, favoritos, atualizadoEm: new Date().toISOString() };
  const i = inscricoes.findIndex(x => x.inscricao.endpoint === item.inscricao.endpoint);
  if (i >= 0) inscricoes[i] = item;
  else inscricoes.push(item);
  salvarInscricoes();
  agendarVigia();
  return { code: 200, corpo: { ok: true } };
}

function removerInscricao(body) {
  const endpoint = body && (body.endpoint || (body.inscricao && body.inscricao.endpoint));
  if (!endpoint) return { code: 400, corpo: { erro: 'Inscrição inválida' } };
  const antes = inscricoes.length;
  inscricoes = inscricoes.filter(x => x.inscricao.endpoint !== endpoint);
  if (inscricoes.length !== antes) salvarInscricoes();
  if (!inscricoes.length) pararVigia();
  return { code: 200, corpo: { ok: true } };
}

function removerEndpoint(endpoint) {
  const antes = inscricoes.length;
  inscricoes = inscricoes.filter(x => x.inscricao.endpoint !== endpoint);
  if (inscricoes.length !== antes) salvarInscricoes();
  if (!inscricoes.length) pararVigia();
}

function pararVigia() {
  if (timerPush) { clearInterval(timerPush); timerPush = null; }
  memoriaPush = null;
}

function agendarVigia() {
  if (!pushAtivo || !inscricoes.length || timerPush) return;
  vigiar().catch(e => console.error('vigia', e.message));
  timerPush = setInterval(() => vigiar().catch(e => console.error('vigia', e.message)), VIGIA_MS);
  if (timerPush.unref) timerPush.unref();
}

async function checarEscalacoes(jogos) {
  const agora = Date.now();
  const mapa = {};
  await Promise.all(jogos.map(async j => {
    if (!eventosPush.dentroDasProximasHoras(j, agora, 2)) return;
    const k = eventosPush.chaveJogo(j);
    if (memoriaPush && memoriaPush.jogos && memoriaPush.jogos[k] && memoriaPush.jogos[k].escalacao) {
      mapa[k] = true;
      return;
    }
    try {
      const d = await escalacao(j.liga, j.id);
      mapa[k] = !!d.divulgada;
    } catch { /* tenta de novo no próximo ciclo */ }
  }));
  return mapa;
}

function competidoresDoSumario(d) {
  const comps = d && d.header && d.header.competitions;
  const c = Array.isArray(comps) ? comps[0] : null;
  return (c && c.competitors) || [];
}

async function buscarIncidentes(jogos) {
  const mem = (memoriaPush && memoriaPush.jogos) || {};
  const mapa = {};
  await Promise.all(jogos.map(async j => {
    if (!j || (j.estado !== 'in' && j.estado !== 'post')) return;
    const k = eventosPush.chaveJogo(j);
    const prev = mem[k];
    if (j.estado === 'post' && prev && prev.estado === 'post' && Array.isArray(prev.incidentes)) return;
    try {
      const d = await espn(`${ESPN}/site/v2/sports/soccer/${j.liga}/summary?event=${j.id}`, 60e3);
      const lidos = eventosPush.lerIncidentes(d && d.keyEvents);
      mapa[k] = eventosPush.completarIncidentes(lidos, j, competidoresDoSumario(d), nomeTime);
    } catch { /* sem lista neste ciclo: não apaga o que já vimos */ }
  }));
  return mapa;
}

async function buscarAutor(ev) {
  const j = ev.jogo;
  try {
    const d = await espn(`${ESPN}/site/v2/sports/soccer/${j.liga}/summary?event=${j.id}`, 2 * 60e3);
    const detalhes = d.header && d.header.competitions && d.header.competitions[0] && d.header.competitions[0].details;
    const achado = eventosPush.autorDoGol(detalhes, j, ev.prevCasa, ev.prevFora, nomeTime);
    if (achado.autor) ev.autor = achado.autor;
    if (achado.contra) ev.contra = true;
    if (achado.minuto) ev.minuto = achado.minuto;
  } catch { /* segue sem o nome de quem fez o gol */ }
}

async function despachar(eventos) {
  for (const ev of eventos) {
    if (ev.tipo === 'gol') await buscarAutor(ev);
    for (const ins of [...inscricoes]) {
      if (!eventosPush.jogoDoFavorito(ev.jogo, ins.favoritos)) continue;
      const payload = eventosPush.textoNotificacao(ev, ins.favoritos);
      try {
        await webpush.sendNotification(ins.inscricao, JSON.stringify(payload), { TTL: 60 * 60 });
      } catch (err) {
        const code = err && err.statusCode;
        if (!tratarFalhaPush(ins.inscricao.endpoint, code)) console.error('push envio', code || (err && err.message));
      }
    }
  }
}

function tratarFalhaPush(endpoint, statusCode) {
  if (statusCode === 404 || statusCode === 410) {
    removerEndpoint(endpoint);
    return true;
  }
  return false;
}

async function vigiar() {
  if (cicloOcupado || !pushAtivo || !webpush || !inscricoes.length) return;
  cicloOcupado = true;
  try {
    const { jogos } = await hoje();
    const nomes = new Set(inscricoes.flatMap(i => i.favoritos));
    const relevantes = (jogos || []).filter(j => eventosPush.jogoDoFavorito(j, nomes));
    const escalacoes = await checarEscalacoes(relevantes);
    const incidentes = await buscarIncidentes(relevantes);
    const primeiro = !memoriaPush || !memoriaPush.iniciado;
    const resultado = eventosPush.avaliarCiclo(memoriaPush, relevantes, escalacoes, incidentes);
    memoriaPush = resultado.memoria;
    if (primeiro) return;
    if (resultado.eventos.length) await despachar(resultado.eventos);
  } catch (e) {
    console.error('vigia', e.message);
  } finally {
    cicloOcupado = false;
  }
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const pedacos = [];
    let n = 0;
    req.on('data', c => {
      n += c.length;
      if (n > 64 * 1024) { reject(new Error('corpo grande')); req.destroy(); return; }
      pedacos.push(c);
    });
    req.on('end', () => {
      const texto = Buffer.concat(pedacos).toString('utf8');
      if (!texto) return resolve({});
      try { resolve(JSON.parse(texto)); }
      catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

async function tratar(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  try {
    if (req.method === 'GET' && p === '/api/ping') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('ok');
      return;
    }
    if (req.method === 'GET' && p === '/api/push/status') return json(res, 200, statusPush());
    if (req.method === 'POST' && (p === '/api/push/registrar' || p === '/api/push/remover')) {
      const body = await lerCorpo(req);
      const r = p.endsWith('/remover') ? removerInscricao(body) : registrarInscricao(body);
      return json(res, r.code, r.corpo);
    }
    if (p === '/api/competicoes') return json(res, 200, COMPETICOES);
    if (p === '/api/hoje') {
      const consulta = interpretarDataConsulta(url.searchParams.get('data'));
      if (consulta.erro) return json(res, 400, { erro: consulta.erro });
      return json(res, 200, await hoje(consulta.ymd));
    }
    const m = p.match(/^\/api\/([a-z0-9._]+)\/(tabela|jogos|artilheiros)$/);
    if (m) {
      if (!IDS.has(m[1])) return json(res, 404, { erro: 'Competição não encontrada' });
      const corpo = m[2] === 'tabela' ? await tabela(m[1]) : m[2] === 'jogos' ? await jogos(m[1]) : await artilheiros(m[1]);
      return json(res, 200, corpo);
    }
    const escRoute = p.match(/^\/api\/([a-z0-9._]+)\/escalacao\/(\d+)$/);
    if (escRoute) {
      if (!IDS.has(escRoute[1])) return json(res, 404, { erro: 'Competição não encontrada' });
      return json(res, 200, await escalacao(escRoute[1], escRoute[2]));
    }
    if (p.startsWith('/api/')) return json(res, 404, { erro: 'Não encontrado' });
    let file = path.normalize(path.join(PUBLIC, p === '/' ? 'index.html' : p));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': p === '/sw.js' ? 'no-cache' : 'public, max-age=300' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (msg === 'JSON inválido' || msg === 'corpo grande') return json(res, 400, { erro: 'Inscrição inválida' });
    json(res, 502, { erro: 'Falha ao buscar dados da fonte (ESPN): ' + msg });
  }
}

function ouvir(porta = PORT) {
  const server = http.createServer((req, res) => tratar(req, res));
  server.listen(porta, () => console.log(`App Futebol rodando em http://localhost:${porta}`));
  if (pushAtivo && inscricoes.length) agendarVigia();
  return server;
}

pushAtivo = prepararPush();
carregarInscricoes();
if (require.main === module) {
  ouvir();
  console.log(pushAtivo ? 'Notificações ativas' : 'Notificações desligadas (faltam variáveis VAPID)');
}

module.exports = { tratar, ouvir, tratarFalhaPush, eventosPush };
