// Offline support and instant opening. On the live site, the copy kept from the last visit is shown straight away, and the latest
// version is fetched quietly in the background, ready for the next visit. With no kept copy (a first visit) it comes
// from the network; with no connection, the kept copy still works. Bump VERSION if the list of files changes.
const VERSION = "groundworks-2";
// A preview address (one of Vercel's test links for a change that isn't live yet) always shows the newest version:
// there, the network is tried first, and the kept copy is only for when there's no connection.
const PREVIEW = /-git-|-projects\.vercel\.app$/.test(location.hostname);
const FILES = ["./", "index.html", "icon.svg", "icon-192.png", "manifest.webmanifest"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const fresh = fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); return caches.open(VERSION).then(c => c.put(req, copy)).then(() => res); }
    return res;
  });
  e.waitUntil(fresh.catch(() => {})); // let the background update finish after the kept copy has been shown
  const kept = () => caches.match(req, { ignoreSearch: true });
  e.respondWith(PREVIEW ? fresh.catch(() => kept().then(hit => hit || caches.match("index.html")))
    : kept().then(hit => hit || fresh.catch(() => caches.match("index.html"))));
});
