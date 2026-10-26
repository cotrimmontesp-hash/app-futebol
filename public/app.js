const $ = s => document.querySelector(s);
const TZ = 'America/Sao_Paulo';
const conteudo = $('#conteudo');
let competicoes = [];

const fmtData = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' });
const fmtDia = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CHAVE_FAV = 'futebol-favoritos';
function lerFavoritos() {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE_FAV) || '[]');
    return new Set((Array.isArray(lista) ? lista : []).filter(x => typeof x === 'string' && x));
  } catch { return new Set(); }
}
function salvarFavoritos() {
  try { localStorage.setItem(CHAVE_FAV, JSON.stringify([...favoritos])); } catch { /* aparelho sem espaço ou storage bloqueado */ }
}
let favoritos = lerFavoritos();
function botaoEstrela(nome) {
  const on = favoritos.has(nome);
  const acao = on ? `Remover ${nome} dos favoritos` : `Marcar ${nome} como favorito`;
  return `<button type="button" class="estrela${on ? ' ativa' : ''}" data-time="${esc(nome)}" aria-pressed="${on}" aria-label="${esc(acao)}">${on ? '★' : '☆'}</button>`;
}

async function api(caminho) {
  const r = await fetch('/api/' + caminho);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || 'Erro ' + r.status);
  return d;
}
const carregando = () => conteudo.innerHTML = '<p class="msg">Carregando…</p>';
const erro = e => conteudo.innerHTML = `<p class="msg erro">Não foi possível carregar os dados.<br><small>${esc(e.message)}</small><br><br><button onclick="rota()">Tentar de novo</button></p>`;

async function telaLista() {
  $('#titulo').textContent = '⚽ Futebol';
  $('#voltar').hidden = true; $('#abas').hidden = true;
  if (!competicoes.length) { carregando(); competicoes = await api('competicoes'); }
  const n = favoritos.size;
  const resumo = n === 0 ? 'Nenhum time marcado' : n === 1 ? [...favoritos][0] : n + ' times';
  const bloco = (t, l) => `<h2 class="secao">${t}</h2><ul class="lista">${l.map(c =>
    `<li><a href="#/c/${c.id}/tabela"><strong>${esc(c.nome)}</strong><span>${esc(c.pais)}</span></a></li>`).join('')}</ul>`;
  conteudo.innerHTML = `<ul class="lista"><li><a href="#/favoritos"><strong>★ Favoritos</strong><span>${esc(resumo)}</span></a></li></ul>`
    + bloco('Ligas nacionais', competicoes.filter(c => c.tipo === 'liga'))
    + bloco('Copas', competicoes.filter(c => c.tipo === 'copa'));
}

function htmlTabela(d) {
  if (d.semTabela || !d.grupos || !d.grupos.length || d.grupos.every(g => !g.linhas.length))
    return '<p class="msg">Esta competição é mata-mata e não tem tabela. Veja Resultados e Próximos jogos.</p>';
  const legendas = new Map();
  const grupos = d.grupos.map(g => {
    const linhas = g.linhas.map(l => {
      if (l.nota) legendas.set(l.nota.texto, l.nota.cor);
      return `<tr><td class="pos" style="border-left-color:${l.nota ? esc(l.nota.cor) : 'transparent'}">${l.pos ?? ''}</td>
        <td class="time">${botaoEstrela(l.time)}${l.escudo ? `<img class="escudo" loading="lazy" src="${esc(l.escudo)}" alt="">` : ''}${esc(l.time)}</td>
        <td class="pts">${esc(l.pts)}</td><td>${esc(l.j)}</td><td>${esc(l.v)}</td><td>${esc(l.e)}</td><td>${esc(l.d)}</td>
        <td class="col-opt">${esc(l.gp)}</td><td class="col-opt">${esc(l.gc)}</td><td>${esc(l.sg)}</td></tr>`;
    }).join('');
    return `${g.nome ? `<h2 class="secao">${esc(g.nome)}</h2>` : ''}<div class="card"><table>
      <thead><tr><th>#</th><th style="text-align:left">Time</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th>
      <th class="col-opt">GP</th><th class="col-opt">GC</th><th>SG</th></tr></thead><tbody>${linhas}</tbody></table></div>`;
  }).join('');
  const leg = [...legendas].map(([t, c]) => `<span><i style="background:${esc(c)}"></i>${esc(t)}</span>`).join('');
  const aviso = d.grupos.length > 1 ? '<p class="msg" style="padding:8px">Classificação da fase de grupos. Para o mata-mata, veja Resultados e Próximos jogos.</p>' : '';
  return aviso + grupos + (leg ? `<div class="card legenda">${leg}</div>` : '') + '<p class="msg" style="padding:4px">P = pontos · J = jogos · V/E/D = vitórias/empates/derrotas · SG = saldo de gols</p>';
}

function htmlJogos(lista, tipo) {
  if (!lista.length) return `<p class="msg">${tipo === 'proximos' ? 'Nenhum jogo marcado nos próximos 2 meses.' : 'Nenhum resultado nos últimos 2 meses.'}</p>`;
  let html = '', diaAtual = '';
  for (const j of lista) {
    const dt = new Date(j.data);
    const dia = fmtDia.format(dt);
    if (dia !== diaAtual) { if (diaAtual) html += '</div>'; html += `<h2 class="secao">${esc(dia)}</h2><div class="card">`; diaAtual = dia; }
    const lado = (t, cls) => {
      const nome = `<span>${esc(t.time)}</span>`;
      const marca = botaoEstrela(t.time);
      const brasao = t.escudo ? `<img class="escudo" loading="lazy" src="${esc(t.escudo)}" alt="">` : '';
      const miolo = cls === 'casa' ? `${brasao}${nome}${marca}` : `${marca}${nome}${brasao}`;
      return `<div class="lado ${cls} ${t.venceu ? 'venceu' : ''}">${miolo}</div>`;
    };
    let meio;
    if (j.estado === 'pre') meio = `<span class="hora">${fmtHora.format(dt)}</span>`;
    else {
      const pen = j.casa.penaltis != null ? `<small>pên. ${j.casa.penaltis}–${j.fora.penaltis}</small>` : '';
      const vivo = j.estado === 'in' ? `<small class="aovivo">AO VIVO ${esc(j.relogio)}</small>` : '';
      meio = `${esc(j.casa.gols)} – ${esc(j.fora.gols)}${pen}${vivo}`;
    }
    const info = [j.competicao, j.fase, j.estadio].filter(Boolean).join(' · ');
    html += `<div class="jogo">${lado(j.casa, 'casa')}<div class="placar">${meio}</div>${lado(j.fora, 'fora')}${info ? `<div class="info">${esc(info)}</div>` : ''}</div>`;
  }
  return html + '</div>';
}

async function telaCompeticao(id, aba) {
  if (!competicoes.length) competicoes = await api('competicoes');
  const c = competicoes.find(x => x.id === id);
  if (!c) { location.hash = '#/'; return; }
  $('#titulo').textContent = c.nome;
  $('#voltar').hidden = false; $('#abas').hidden = false;
  document.querySelectorAll('#abas a').forEach(a => { a.href = `#/c/${id}/${a.dataset.aba}`; a.classList.toggle('ativa', a.dataset.aba === aba); });
  carregando();
  if (aba === 'tabela') conteudo.innerHTML = htmlTabela(await api(`${id}/tabela`));
  else { const d = await api(`${id}/jogos`); conteudo.innerHTML = htmlJogos(aba === 'resultados' ? d.resultados : d.proximos, aba); }
}

async function telaFavoritos() {
  $('#titulo').textContent = 'Favoritos';
  $('#voltar').hidden = false; $('#abas').hidden = true;
  if (!favoritos.size) {
    conteudo.innerHTML = '<p class="msg">Nenhum time favorito ainda. Toque na estrela ao lado de um time na tabela ou nos jogos.</p>';
    return;
  }
  carregando();
  if (!competicoes.length) competicoes = await api('competicoes');
  const listas = await Promise.all(competicoes.map(async c => {
    try { return { c, d: await api(`${c.id}/jogos`) }; }
    catch { return { c, d: null }; }
  }));
  if (listas.every(x => !x.d)) throw new Error('Não foi possível carregar os jogos');
  const ehFav = j => favoritos.has(j.casa.time) || favoritos.has(j.fora.time);
  const resultados = [], proximos = [];
  for (const { c, d } of listas) {
    if (!d) continue;
    for (const j of d.resultados) if (ehFav(j)) resultados.push({ ...j, competicao: c.nome });
    for (const j of d.proximos) if (ehFav(j)) proximos.push({ ...j, competicao: c.nome });
  }
  resultados.sort((a, b) => b.data.localeCompare(a.data));
  proximos.sort((a, b) => a.data.localeCompare(b.data));
  if (!resultados.length && !proximos.length) {
    conteudo.innerHTML = '<p class="msg">Nenhum jogo dos seus times nos últimos e próximos 2 meses.</p>';
    return;
  }
  const bloco = (titulo, lista, tipo) => `<h2 class="secao">${titulo}</h2>${htmlJogos(lista, tipo)}`;
  conteudo.innerHTML = bloco('Resultados', resultados, 'resultados') + bloco('Próximos jogos', proximos, 'proximos');
}

async function rota() {
  const m = location.hash.match(/^#\/c\/([a-z0-9._]+)\/(tabela|resultados|proximos)$/);
  try {
    if (location.hash === '#/favoritos') await telaFavoritos();
    else if (m) await telaCompeticao(m[1], m[2]);
    else await telaLista();
    window.scrollTo(0, 0);
  } catch (e) { erro(e); }
}
conteudo.addEventListener('click', e => {
  const b = e.target.closest('.estrela');
  if (!b) return;
  e.preventDefault();
  const nome = b.dataset.time;
  if (!nome) return;
  if (favoritos.has(nome)) favoritos.delete(nome); else favoritos.add(nome);
  salvarFavoritos();
  if (location.hash === '#/favoritos') { rota(); return; }
  document.querySelectorAll('.estrela').forEach(el => {
    if (el.dataset.time !== nome) return;
    const on = favoritos.has(nome);
    el.classList.toggle('ativa', on);
    el.setAttribute('aria-pressed', String(on));
    el.setAttribute('aria-label', on ? `Remover ${nome} dos favoritos` : `Marcar ${nome} como favorito`);
    el.textContent = on ? '★' : '☆';
  });
});
$('#voltar').onclick = () => { location.hash = '#/'; };
window.addEventListener('hashchange', rota);
rota();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
