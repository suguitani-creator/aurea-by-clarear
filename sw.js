const CACHE_NAME = "aurea-v6";

const urlsToCache = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/firebase.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// INSTALAÇÃO
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// ATIVAÇÃO (limpa caches antigos)
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// FETCH (requisições)
self.addEventListener("fetch", event => {

  // 🔒 Só trata requisições GET
  if (event.request.method !== "GET") return;

  // 🌐 Ignora requisições externas (Firebase, APIs, etc.)
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {

        // ✅ Se estiver no cache, retorna direto
        if (cachedResponse) {
          return cachedResponse;
        }

        // 🌐 Senão, busca na rede
        return fetch(event.request)
          .then(networkResponse => {

            // ⚠️ Só cacheia se for resposta válida
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // 💾 Salva no cache
            return caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          });
      })
      .catch(() => {
        // 📡 Fallback offline
        return new Response("Sem conexão com a internet", {
          status: 503,
          statusText: "Offline"
        });
      })
  );
});