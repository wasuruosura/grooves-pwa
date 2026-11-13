// Service worker: uloží soubory appky, aby šla spustit i bez sítě.
// Při každé změně souborů appky zvýšit VERZE, jinak telefon novou verzi nestáhne.

const VERZE = "grooves-v4";
const SOUBORY = [
  "./",
  "index.html",
  "style.css",
  "db.js",
  "sbirka.js",
  "app.js",
  "manifest.webmanifest",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

// Instalace: stáhnout všechny soubory do cache. Když jeden selže, instalace selže celá.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERZE)
      // cache: "reload" obejde HTTP cache prohlížeče, ať se uloží čerstvé soubory.
      .then((c) => c.addAll(SOUBORY.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

// Aktivace: smazat cache starších verzí a hned převzít otevřené stránky.
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((klice) => Promise.all(klice.filter((k) => k !== VERZE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Požadavky: nejdřív z cache, když tam nejsou, ze sítě.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request))
  );
});
