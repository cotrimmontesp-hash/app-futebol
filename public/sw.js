// Service worker: guarda a "casca" do app para abrir offline; dados da API = rede primeiro, cache como reserva.
const VERSAO = 'futebol-v8';
const CASCA = ['/', '/index.html', '/style.css', '/app.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSAO).then(c => c.addAll(CASCA))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // escudos etc. vão direto à rede
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then(c => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('/index.html'))));
});
self.addEventListener('push', event => {
  let dados = {};
  try { dados = event.data ? event.data.json() : {}; } catch { dados = {}; }
  const opcoes = {
    body: dados.body || '',
    icon: dados.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: dados.url || '/' },
  };
  if (dados.tag) opcoes.tag = dados.tag;
  event.waitUntil(self.registration.showNotification(dados.title || 'Futebol', opcoes));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const lista = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const cliente of lista) {
      if (new URL(cliente.url).origin !== self.location.origin) continue;
      if ('navigate' in cliente) { try { await cliente.navigate(destino); } catch { /* a janela segue aberta */ } }
      return cliente.focus();
    }
    if (self.clients.openWindow) await self.clients.openWindow(destino);
  })());
});
