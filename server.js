// Servidor do App Futebol: serve o front (pasta public) e um proxy com cache para a API pública da ESPN.
// Sem dependências: requer Node 18+ (usa fetch nativo).
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const ESPN = 'https://site.api.espn.com/apis';

const COMPETICOES = [
  { id: 'bra.1', nome: 'Brasileirão Série A', pais: 'Brasil', tipo: 'liga' },
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
      escudo: e.team.logos && e.team.logos[0] ? e.team.logos[0].href : '',
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

function jogo(ev) {
  const c = ev.competitions[0];
  const st = ev.status.type;
  const lado = h => {
    const t = c.competitors.find(x => x.homeAway === h) || {};
    return {
      ...nomeTime(t.team),
      escudo: t.team ? t.team.logo : '',
      gols: t.score, penaltis: t.shootoutScore ?? null, venceu: !!t.winner,
    };
  };
  return {
    id: ev.id, data: ev.date, estado: st.state, // pre | in | post
    status: st.name, relogio: ev.status.displayClock,
    casa: lado('home'), fora: lado('away'),
    estadio: c.venue ? c.venue.fullName : '', fase: fase(c, ev.season),
  };
}

async function jogos(id) {
  const meses = [-2, -1, 0, 1, 2].map(mes);
  const urls = meses.map(m => `${ESPN}/site/v2/sports/soccer/${id}/scoreboard?dates=${m}&limit=400`);
  const res = await Promise.all(urls.map((u, i) => espn(u, meses[i] === mes(0) ? 2 * 60e3 : 30 * 60e3).catch(() => null)));
  if (res.every(r => r === null)) throw new Error('ESPN indisponível');
  const mapa = new Map();
  res.forEach(r => (r && r.events || []).forEach(ev => mapa.set(ev.id, jogo(ev))));
  const todos = [...mapa.values()];
  const naoJogados = ['STATUS_POSTPONED', 'STATUS_CANCELED', 'STATUS_ABANDONED'];
  const resultados = todos.filter(j => j.estado === 'post' || j.estado === 'in')
    .sort((a, b) => b.data.localeCompare(a.data)).slice(0, 60);
  const proximos = todos.filter(j => j.estado === 'pre' && !naoJogados.includes(j.status))
    .sort((a, b) => a.data.localeCompare(b.data)).slice(0, 60);
  return { resultados, proximos, atualizadoEm: new Date().toISOString() };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  try {
    if (p === '/api/competicoes') return json(res, 200, COMPETICOES);
    const m = p.match(/^\/api\/([a-z0-9._]+)\/(tabela|jogos)$/);
    if (m) {
      if (!IDS.has(m[1])) return json(res, 404, { erro: 'Competição não encontrada' });
      return json(res, 200, m[2] === 'tabela' ? await tabela(m[1]) : await jogos(m[1]));
    }
    if (p.startsWith('/api/')) return json(res, 404, { erro: 'Não encontrado' });
    let file = path.normalize(path.join(PUBLIC, p === '/' ? 'index.html' : p));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': p === '/sw.js' ? 'no-cache' : 'public, max-age=300' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    json(res, 502, { erro: 'Falha ao buscar dados da fonte (ESPN): ' + e.message });
  }
}).listen(PORT, () => console.log(`App Futebol rodando em http://localhost:${PORT}`));
