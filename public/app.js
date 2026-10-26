const $ = s => document.querySelector(s);
const TZ = 'America/Sao_Paulo';
const conteudo = $('#conteudo');
let competicoes = [];
const cacheArt = new Map();
const pendArt = new Map();
const semArtilheiros = new Set();

const fmtData = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' });
const fmtDia = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
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
  sincronizarPush();
}
let favoritos = lerFavoritos();
let timerEscalacao = 0;
let timerHoje = 0;
let dadosHoje = null;
function pararEscalacao() {
  if (timerEscalacao) { clearInterval(timerEscalacao); timerEscalacao = 0; }
}
function pararHoje() {
  if (timerHoje) { clearInterval(timerHoje); timerHoje = 0; }
}
function ehFavorito(t) {
  return !!(t && (favoritos.has(t.time) || (t.origem && favoritos.has(t.origem))));
}
function migrarFavoritos(times) {
  let mudou = false;
  for (const t of times) {
    if (!t || !t.origem || !favoritos.has(t.origem)) continue;
    favoritos.delete(t.origem);
    favoritos.add(t.time);
    mudou = true;
  }
  if (mudou) salvarFavoritos();
}
function imgEscudo(url, nome) {
  if (!url) return '';
  return `<img class="escudo" loading="lazy" alt="${esc(nome)}" src="${esc(url)}" onerror="this.remove()">`;
}
function botaoEstrela(t) {
  const nome = t.time;
  const origem = t.origem || '';
  const on = ehFavorito(t);
  const acao = on ? `Remover ${nome} dos favoritos` : `Marcar ${nome} como favorito`;
  return `<button type="button" class="estrela${on ? ' ativa' : ''}" data-time="${esc(nome)}" data-origem="${esc(origem)}" aria-pressed="${on}" aria-label="${esc(acao)}">${on ? '★' : '☆'}</button>`;
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
  conteudo.innerHTML = `<ul class="lista destaque"><li><a href="#/hoje"><strong>Hoje</strong><span>Placares ao vivo e jogos de hoje</span></a></li></ul>`
    + `<ul class="lista"><li><a href="#/favoritos"><strong>★ Favoritos</strong><span>${esc(resumo)}</span></a></li></ul>`
    + bloco('Ligas nacionais', competicoes.filter(c => c.tipo === 'liga'))
    + bloco('Copas', competicoes.filter(c => c.tipo === 'copa'));
}

function htmlTabela(d) {
  if (d.semTabela || !d.grupos || !d.grupos.length || d.grupos.every(g => !g.linhas.length))
    return '<p class="msg">Esta competição é mata-mata e não tem tabela. Veja Resultados e Próximos jogos.</p>';
  const legendas = new Map();
  migrarFavoritos(d.grupos.flatMap(g => g.linhas));
  const grupos = d.grupos.map(g => {
    const linhas = g.linhas.map(l => {
      if (l.nota) legendas.set(l.nota.texto, l.nota.cor);
      return `<tr><td class="pos" style="border-left-color:${l.nota ? esc(l.nota.cor) : 'transparent'}">${l.pos ?? ''}</td>
        <td class="time">${botaoEstrela(l)}${imgEscudo(l.escudo, l.time)}${esc(l.time)}</td>
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

function htmlJogos(lista, tipo, liga, opcoes) {
  if (!lista.length) return `<p class="msg">${tipo === 'proximos' ? 'Nenhum jogo marcado nos próximos 2 meses.' : 'Nenhum resultado nos últimos 2 meses.'}</p>`;
  const semDia = !!(opcoes && opcoes.semDia);
  migrarFavoritos(lista.flatMap(j => [j.casa, j.fora]));
  let html = '', diaAtual = '';
  for (const j of lista) {
    const dt = new Date(j.data);
    const dia = fmtDia.format(dt);
    if (semDia) { if (!diaAtual) html += '<div class="card">'; diaAtual = dia; }
    else if (dia !== diaAtual) { if (diaAtual) html += '</div>'; html += `<h2 class="secao">${esc(dia)}</h2><div class="card">`; diaAtual = dia; }
    const lado = (t, cls) => {
      const nome = `<span>${esc(t.time)}</span>`;
      const marca = botaoEstrela(t);
      const brasao = imgEscudo(t.escudo, t.time);
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
    const ligaId = j.liga || liga || '';
    html += `<div class="jogo" role="link" tabindex="0" data-liga="${esc(ligaId)}" data-id="${esc(j.id)}">${lado(j.casa, 'casa')}<div class="placar">${meio}</div>${lado(j.fora, 'fora')}${info ? `<div class="info">${esc(info)}</div>` : ''}</div>`;
  }
  return html + '</div>';
}

function htmlArtilheiros(d) {
  const bloco = (titulo, lista, campo, coluna) => {
    if (!lista.length) return '';
    const linhas = lista.map((l, i) => `<tr><td class="pos">${i + 1}</td>
      <td class="artilheiro"><strong>${esc(l.nome)}</strong><span>${imgEscudo(l.escudo, l.time)}${esc(l.time)}</span></td>
      <td>${l.jogos ?? ''}</td><td class="pts">${l[campo] ?? ''}</td></tr>`).join('');
    return `<h2 class="secao">${titulo}</h2><div class="card"><table>
      <thead><tr><th>#</th><th style="text-align:left">Jogador</th><th>J</th><th>${coluna}</th></tr></thead>
      <tbody>${linhas}</tbody></table></div>`;
  };
  return bloco('Gols', d.gols || [], 'gols', 'Gols') + bloco('Assistências', d.assistencias || [], 'assistencias', 'A');
}
function dadosArtilheiros(id) {
  if (cacheArt.has(id)) return Promise.resolve(cacheArt.get(id));
  if (pendArt.has(id)) return pendArt.get(id);
  const p = api(`${id}/artilheiros`).then(d => {
    cacheArt.set(id, d);
    if (!(d.gols && d.gols.length) && !(d.assistencias && d.assistencias.length)) semArtilheiros.add(id);
    return d;
  }).finally(() => pendArt.delete(id));
  pendArt.set(id, p);
  return p;
}
function prepararAbaArtilheiros(id) {
  const link = document.querySelector('#abas a[data-aba="artilheiros"]');
  if (!link) return;
  link.hidden = semArtilheiros.has(id);
  if (cacheArt.has(id) || semArtilheiros.has(id)) return;
  dadosArtilheiros(id).then(() => {
    if (location.hash.startsWith(`#/c/${id}/`)) link.hidden = semArtilheiros.has(id);
  }).catch(() => {});
}
async function telaCompeticao(id, aba) {
  if (!competicoes.length) competicoes = await api('competicoes');
  const c = competicoes.find(x => x.id === id);
  if (!c) { location.hash = '#/'; return; }
  $('#titulo').textContent = c.nome;
  $('#voltar').hidden = false; $('#abas').hidden = false;
  document.querySelectorAll('#abas a').forEach(a => { a.href = `#/c/${id}/${a.dataset.aba}`; a.classList.toggle('ativa', a.dataset.aba === aba); });
  prepararAbaArtilheiros(id);
  carregando();
  if (aba === 'artilheiros') {
    const d = await dadosArtilheiros(id);
    const link = document.querySelector('#abas a[data-aba="artilheiros"]');
    if (semArtilheiros.has(id)) {
      if (link) link.hidden = true;
      location.hash = `#/c/${id}/tabela`;
      return;
    }
    conteudo.innerHTML = htmlArtilheiros(d);
  } else if (aba === 'tabela') conteudo.innerHTML = htmlTabela(await api(`${id}/tabela`));
  else { const d = await api(`${id}/jogos`); conteudo.innerHTML = htmlJogos(aba === 'resultados' ? d.resultados : d.proximos, aba, id); }
}

function htmlListaEscalacao(lista, titulo) {
  if (!lista.length) return '';
  const linhas = lista.map(p => {
    const marca = p.saiu ? '<span class="saiu-tag">saiu</span>' : p.entrou ? '<span class="subiu">entrou</span>' : '';
    return `<div class="jogador"><span class="num">${esc(p.camisa)}</span><span class="pos">${esc(p.posicao)}</span><span class="nome">${esc(p.nome)}</span>${marca}</div>`;
  }).join('');
  return `<h3 class="secao">${titulo}</h3>${linhas}`;
}
function htmlEstatisticas(e) {
  if (!e || !e.linhas || !e.linhas.length) return '';
  const lado = t => `<span class="lado-stat">${imgEscudo(t && t.escudo, t && t.time)}<span>${esc(t && t.time)}</span></span>`;
  const linhas = e.linhas.map(l => `<div class="stat"><b>${esc(l.casa)}</b><span>${esc(l.rotulo)}</span><b>${esc(l.fora)}</b></div>`).join('');
  return `<section class="card stats"><h3 class="secao">Estatísticas</h3><div class="stat cabeca">${lado(e.casa)}<span></span>${lado(e.fora)}</div>${linhas}</section>`;
}
const LINHAS_CAMPO = {
  '4-4-2': [[3, 6, 5, 2], [11, 8, 4, 7], [9, 10]],
  '4-2-3-1': [[3, 6, 5, 2], [4, 8], [11, 10, 7], [9]],
  '4-3-3': [[3, 6, 5, 2], [8, 4, 7], [11, 9, 10]],
  '4-1-4-1': [[3, 6, 5, 2], [4], [11, 10, 8, 7], [9]],
  '3-4-2-1': [[4, 5, 6], [3, 8, 7, 2], [11, 10], [9]],
  '3-4-3': [[4, 5, 6], [3, 8, 7, 2], [11, 9, 10]],
  '5-3-2': [[3, 4, 5, 6, 2], [11, 8, 7], [9, 10]],
  '5-4-1': [[3, 4, 5, 6, 2], [11, 10, 8, 7], [9]],
};
function xsCampo(n) {
  if (n <= 1) return [50];
  const pad = n >= 5 ? 10 : 16;
  return Array.from({ length: n }, (_, i) => pad + (100 - 2 * pad) * i / (n - 1));
}
function sobrenome(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] || '';
  const particula = new Set(['da', 'de', 'do', 'dos', 'das', 'di', 'del', 'della', 'van', 'von', 'le', 'la']);
  let i = partes.length - 1;
  while (i > 0 && particula.has(partes[i - 1].toLowerCase().replace(/\.$/, ''))) i--;
  return partes.slice(i).join(' ');
}
function posicoesCampo(formacao, titulares) {
  const linhas = LINHAS_CAMPO[String(formacao || '').trim()];
  if (!linhas || !titulares || titulares.length !== 11) return null;
  const porLugar = new Map(titulares.map(p => [String(p.lugar || ''), p]));
  if (porLugar.size !== 11 || !porLugar.get('1')) return null;
  const pontos = [{ ...porLugar.get('1'), x: 50, y: 84 }];
  const n = linhas.length;
  let ok = true;
  linhas.forEach((linha, i) => {
    const y = 68 - (68 - 18) * (n === 1 ? 1 : i / (n - 1));
    const xs = xsCampo(linha.length);
    linha.forEach((lugar, j) => {
      const p = porLugar.get(String(lugar));
      if (!p) { ok = false; return; }
      pontos.push({ ...p, x: xs[j], y });
    });
  });
  return ok && pontos.length === 11 ? pontos : null;
}
function svgCampo() {
  return `<svg viewBox="0 0 68 105" preserveAspectRatio="none" aria-hidden="true">
    <rect x="3" y="3" width="62" height="99" fill="none" stroke="#fff" stroke-width="0.6"/>
    <line x1="3" y1="52.5" x2="65" y2="52.5" stroke="#fff" stroke-width="0.6"/>
    <circle cx="34" cy="52.5" r="9.15" fill="none" stroke="#fff" stroke-width="0.5"/>
    <circle cx="34" cy="52.5" r="0.7" fill="#fff"/>
    <rect x="13.84" y="3" width="40.32" height="16.5" fill="none" stroke="#fff" stroke-width="0.5"/>
    <rect x="13.84" y="85.5" width="40.32" height="16.5" fill="none" stroke="#fff" stroke-width="0.5"/>
    <rect x="24.84" y="3" width="18.32" height="5.5" fill="none" stroke="#fff" stroke-width="0.5"/>
    <rect x="24.84" y="96.5" width="18.32" height="5.5" fill="none" stroke="#fff" stroke-width="0.5"/>
    <circle cx="34" cy="14" r="0.55" fill="#fff"/>
    <circle cx="34" cy="91" r="0.55" fill="#fff"/>
  </svg>`;
}
function htmlCampo(pontos) {
  const atletas = pontos.map(p => {
    const marca = p.saiu ? '<i class="saiu-tag">saiu</i>' : '';
    return `<div class="atleta" style="left:${p.x}%;top:${p.y}%"><span class="circulo">${esc(p.camisa)}</span><span class="sobrenome">${esc(sobrenome(p.nome))}</span>${marca}</div>`;
  }).join('');
  return `<div class="campo">${svgCampo()}${atletas}</div>`;
}
function htmlTimeEscalacao(t, i, painel) {
  const pontos = posicoesCampo(t.formacao, t.titulares);
  const cabeca = `<div class="escala-time">${botaoEstrela(t)}${imgEscudo(t.escudo, t.time)}<strong>${esc(t.time)}</strong>${t.formacao ? `<span class="formacao">${esc(t.formacao)}</span>` : ''}</div>`;
  const attr = painel ? ` data-painel="${i}"${i ? ' hidden' : ''}` : '';
  if (!pontos) return `<section class="card"${attr}>${cabeca}${htmlListaEscalacao(t.titulares, 'Titulares')}${htmlListaEscalacao(t.reservas, 'Reservas')}</section>`;
  return `<section class="card"${attr}>${cabeca}${htmlCampo(pontos)}${htmlListaEscalacao(t.reservas, 'Reservas')}</section>`;
}
function htmlEscalacao(d) {
  const stats = htmlEstatisticas(d.estatisticas);
  if (!d.divulgada) return stats + '<p class="msg">Escalação ainda não divulgada (sai cerca de 1 hora antes do jogo).</p>';
  migrarFavoritos(d.times || []);
  const times = d.times || [];
  const ambos = times.length > 1 && times.every(t => posicoesCampo(t.formacao, t.titulares));
  const seletor = ambos ? `<div class="seletor"><button type="button" data-campo="0" class="ativa">Casa</button><button type="button" data-campo="1">Fora</button></div>` : '';
  const cards = times.map((t, i) => htmlTimeEscalacao(t, i, ambos)).join('');
  return stats + seletor + `<div class="escala">${cards}</div>`;
}
async function telaEscalacao(liga, eventId) {
  const hash = `#/c/${liga}/escalacao/${eventId}`;
  $('#titulo').textContent = 'Escalação';
  $('#voltar').hidden = false; $('#abas').hidden = true;
  const carregar = async (silencioso) => {
    if (location.hash !== hash) return;
    try {
      const d = await api(`${liga}/escalacao/${eventId}`);
      if (location.hash !== hash) return;
      const temStats = d.estatisticas && d.estatisticas.linhas && d.estatisticas.linhas.length;
      if (!(silencioso && !d.divulgada && !temStats && conteudo.querySelector('.msg'))) conteudo.innerHTML = htmlEscalacao(d);
      pararEscalacao();
      if (!d.divulgada || d.aoVivo) timerEscalacao = setInterval(() => carregar(true), 5 * 60 * 1000);
    } catch (e) {
      if (location.hash !== hash) return;
      if (!silencioso) erro(e);
    }
  };
  await carregar(false);
}

function ordenarHoje(lista) {
  return [...lista].sort((a, b) => {
    const fa = ehFavorito(a.casa) || ehFavorito(a.fora) ? 0 : 1;
    const fb = ehFavorito(b.casa) || ehFavorito(b.fora) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return String(a.data).localeCompare(String(b.data));
  });
}
function desenharHoje(d) {
  const jogos = (d && d.jogos) || [];
  migrarFavoritos(jogos.flatMap(j => [j.casa, j.fora]));
  const aoVivo = ordenarHoje(jogos.filter(j => j.estado === 'in'));
  const doDia = ordenarHoje(jogos.filter(j => j.estado === 'pre'));
  const fim = ordenarHoje(jogos.filter(j => j.estado === 'post'));
  if (!aoVivo.length && !doDia.length && !fim.length) {
    conteudo.innerHTML = '<p class="msg">Nenhum jogo hoje.</p>';
    return;
  }
  const bloco = (titulo, lista) => lista.length ? `<h2 class="secao">${titulo}</h2>${htmlJogos(lista, 'resultados', '', { semDia: true })}` : '';
  conteudo.innerHTML = bloco('Ao vivo agora', aoVivo) + bloco('Hoje', doDia) + bloco('Encerrados hoje', fim);
}
async function telaHoje() {
  const hash = '#/hoje';
  $('#titulo').textContent = 'Hoje';
  $('#voltar').hidden = false; $('#abas').hidden = true;
  const carregar = async (silencioso) => {
    if (location.hash !== hash) return;
    try {
      const d = await api('hoje');
      if (location.hash !== hash) return;
      dadosHoje = d;
      desenharHoje(d);
      pararHoje();
      const vivo = (d.jogos || []).some(j => j.estado === 'in');
      timerHoje = setInterval(() => carregar(true), vivo ? 30 * 1000 : 5 * 60 * 1000);
    } catch (e) {
      if (location.hash !== hash) return;
      if (!silencioso) erro(e);
    }
  };
  carregando();
  await carregar(false);
}

let pushStatus = null;
function chavePush(base64) {
  const pad = '='.repeat((4 - base64.length % 4) % 4);
  const s = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
async function lerPushStatus() {
  if (pushStatus) return pushStatus;
  try { pushStatus = await api('push/status'); }
  catch { pushStatus = { ativo: false }; }
  return pushStatus;
}
async function sincronizarPush() {
  try {
    const st = await lerPushStatus();
    if (!st.ativo || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub || Notification.permission !== 'granted') return;
    await fetch('/api/push/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inscricao: sub.toJSON(), favoritos: [...favoritos] }),
    });
  } catch { /* sem rede ou push indisponível */ }
}
async function barraPush() {
  const st = await lerPushStatus();
  if (!st.ativo || !window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return '';
  let inscrito = false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    inscrito = !!(sub && Notification.permission === 'granted');
  } catch { return ''; }
  const rotulo = inscrito ? 'Desativar notificações' : 'Ativar notificações';
  const cls = inscrito ? ' class="secundario"' : '';
  return `<p class="push-barra"><button type="button" id="btn-push" data-push="${inscrito ? 'on' : 'off'}"${cls}>${rotulo}</button><small id="push-aviso">Só avisamos jogos dos times com estrela.</small></p>`;
}
async function alternarPush(btn) {
  const aviso = document.getElementById('push-aviso');
  const dizer = t => { if (aviso) aviso.textContent = t; };
  try {
    const reg = await navigator.serviceWorker.ready;
    if (btn.dataset.push === 'on') {
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub && sub.endpoint;
      if (sub) await sub.unsubscribe();
      if (endpoint) await fetch('/api/push/remover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint }) });
      if (location.hash === '#/favoritos') rota();
      return;
    }
    const st = await lerPushStatus();
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { dizer('O navegador bloqueou as notificações.'); return; }
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chavePush(st.chavePublica) });
    const r = await fetch('/api/push/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inscricao: sub.toJSON(), favoritos: [...favoritos] }),
    });
    if (!r.ok) { dizer('Não foi possível ativar agora.'); return; }
    if (location.hash === '#/favoritos') rota();
  } catch { dizer('Não foi possível ativar as notificações neste navegador.'); }
}

async function telaFavoritos() {
  $('#titulo').textContent = 'Favoritos';
  $('#voltar').hidden = false; $('#abas').hidden = true;
  const barra = await barraPush();
  if (!favoritos.size) {
    conteudo.innerHTML = barra + '<p class="msg">Nenhum time favorito ainda. Toque na estrela ao lado de um time na tabela ou nos jogos.</p>';
    return;
  }
  carregando();
  if (!competicoes.length) competicoes = await api('competicoes');
  const listas = await Promise.all(competicoes.map(async c => {
    try { return { c, d: await api(`${c.id}/jogos`) }; }
    catch { return { c, d: null }; }
  }));
  if (listas.every(x => !x.d)) throw new Error('Não foi possível carregar os jogos');
  migrarFavoritos(listas.flatMap(x => x.d ? [...x.d.resultados, ...x.d.proximos].flatMap(j => [j.casa, j.fora]) : []));
  const ehFav = j => ehFavorito(j.casa) || ehFavorito(j.fora);
  const resultados = [], proximos = [];
  for (const { c, d } of listas) {
    if (!d) continue;
    for (const j of d.resultados) if (ehFav(j)) resultados.push({ ...j, competicao: c.nome, liga: c.id });
    for (const j of d.proximos) if (ehFav(j)) proximos.push({ ...j, competicao: c.nome, liga: c.id });
  }
  resultados.sort((a, b) => b.data.localeCompare(a.data));
  proximos.sort((a, b) => a.data.localeCompare(b.data));
  if (!resultados.length && !proximos.length) {
    conteudo.innerHTML = barra + '<p class="msg">Nenhum jogo dos seus times nos últimos e próximos 2 meses.</p>';
    return;
  }
  const bloco = (titulo, lista, tipo) => `<h2 class="secao">${titulo}</h2>${htmlJogos(lista, tipo)}`;
  conteudo.innerHTML = barra + bloco('Resultados', resultados, 'resultados') + bloco('Próximos jogos', proximos, 'proximos');
}

async function rota() {
  pararEscalacao();
  pararHoje();
  const escM = location.hash.match(/^#\/c\/([a-z0-9._]+)\/escalacao\/(\d+)$/);
  const m = location.hash.match(/^#\/c\/([a-z0-9._]+)\/(tabela|resultados|proximos|artilheiros)$/);
  try {
    if (location.hash === '#/hoje') await telaHoje();
    else if (location.hash === '#/favoritos') await telaFavoritos();
    else if (escM) await telaEscalacao(escM[1], escM[2]);
    else if (m) await telaCompeticao(m[1], m[2]);
    else await telaLista();
    window.scrollTo(0, 0);
  } catch (e) { erro(e); }
}
conteudo.addEventListener('click', e => {
  const campoBtn = e.target.closest('[data-campo]');
  if (campoBtn) {
    const id = campoBtn.dataset.campo;
    document.querySelectorAll('[data-campo]').forEach(b => b.classList.toggle('ativa', b === campoBtn));
    document.querySelectorAll('[data-painel]').forEach(p => { p.hidden = p.dataset.painel !== id; });
    return;
  }
  const pushBtn = e.target.closest('#btn-push');
  if (pushBtn) { e.preventDefault(); alternarPush(pushBtn); return; }
  const b = e.target.closest('.estrela');
  if (b) {
    e.preventDefault();
    e.stopPropagation();
    const nome = b.dataset.time;
    const origem = b.dataset.origem;
    if (!nome) return;
    if (favoritos.has(nome) || (origem && favoritos.has(origem))) {
      favoritos.delete(nome);
      if (origem) favoritos.delete(origem);
    } else favoritos.add(nome);
    salvarFavoritos();
    if (location.hash === '#/favoritos') { rota(); return; }
    if (location.hash === '#/hoje' && dadosHoje) { desenharHoje(dadosHoje); return; }
    document.querySelectorAll('.estrela').forEach(el => {
      if (el.dataset.time !== nome) return;
      const on = favoritos.has(nome);
      el.classList.toggle('ativa', on);
      el.setAttribute('aria-pressed', String(on));
      el.setAttribute('aria-label', on ? `Remover ${nome} dos favoritos` : `Marcar ${nome} como favorito`);
      el.textContent = on ? '★' : '☆';
    });
    return;
  }
  const jogoEl = e.target.closest('.jogo[data-id]');
  if (jogoEl && jogoEl.dataset.liga) location.hash = `#/c/${jogoEl.dataset.liga}/escalacao/${jogoEl.dataset.id}`;
});
$('#voltar').onclick = () => {
  if (/^#\/c\/[a-z0-9._]+\/escalacao\/\d+$/.test(location.hash)) history.back();
  else location.hash = '#/';
};
window.addEventListener('hashchange', rota);
rota();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').then(() => sincronizarPush()).catch(() => {});
