const CACHE = 'daybreak-v1';
const ASSETS = ['./', './index.html', './app.css', './app.js', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './fonts/inter-400.woff', './fonts/inter-500.woff', './fonts/inter-600.woff', './fonts/inter-700.woff',
  './fonts/poppins-500.woff', './fonts/poppins-700.woff'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const key = e.notification.data && e.notification.data.key;
  const markDone = e.action === 'done' && key;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    if (list.length) { const c = list[0]; if (markDone) c.postMessage({ type: 'done', key }); return c.focus(); }
    return self.clients.openWindow(markDone ? './?done=' + encodeURIComponent(key) : './');
  }));
});
