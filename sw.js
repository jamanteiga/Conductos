const CACHE_NAME = 'hvac-pro-v6'; // Versión actualizada para forzar refresco
const assets = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/controls/OrbitControls.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Instalación: guardar archivos en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

// Activación: borrar cachés antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

// Estrategia de carga: primero red, si falla, caché
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});