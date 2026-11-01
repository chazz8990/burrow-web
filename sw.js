/* v0.26.27: offline cache for the phone / home-screen (PWA) build. Only registered on an https:// page (see touch.js),
   never in the desktop app or on a LAN http:// address. Same-site game files only: the co-op signalling server,
   /ws, /save and /mp/* are never cached. The cache name carries the game version, so a new version replaces it. */
const VER = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'burrow-' + VER;
const FILES = ['./', 'index.html', 'style.css', 'touch.css', 'notes.js', 'game.js', 'net.js', 'touch.js', 'cloud.js', 'peerjs.min.js',
  'favicon.png', 'burrow_icon_256.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('burrow-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin) return;
  if (/\/(ws|save)$|\/mp\//.test(u.pathname)) return;
  if (r.mode === 'navigate') {   /* the page: network first so a new version shows up, the cached copy when offline */
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put('index.html', cp)); return res; })
      .catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => hit || fetch(r)));
});
