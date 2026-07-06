/* sw.js — офлайн-кэш "оболочки" приложения.
   Данные (авто, расходы, фото) не кэшируются здесь — они уже офлайн, т.к. лежат в IndexedDB.
   Этот кэш нужен только для того, чтобы сами файлы приложения открывались без интернета. */

const CACHE_NAME = 'moy-transport-v2';

const APP_SHELL = [
  './',
  './index.html',
  './car.html',
  './style.css',
  './icons.js',
  './db.js',
  './storage.js',
  './script.js',
  './car.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Файлы приложения (свой origin) — кэш первым, обновляем в фоне.
  if (new URL(request.url).origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        const network = fetch(request)
          .then(response => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Внешние ресурсы (шрифты и т.п.) — просто пробуем сеть, без блокировки офлайна.
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
