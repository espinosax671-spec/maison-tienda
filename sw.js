// ============================================
// SERVICE WORKER — Casa Admin PWA
// Versión: 1.0
// ============================================

const CACHE_NAME = 'casa-admin-v1';
const CACHE_STATIC = 'casa-static-v1';

// Archivos a cachear al instalar
const STATIC_ASSETS = [
  '/administrador.html',
  '/css/admin.css',
  '/js/supabase-client.js',
  '/js/admin.js',
  '/iconos/icon-192.png',
  '/iconos/icon-512.png',
  '/manifest.json'
];

// Dominios que SIEMPRE van a la red (nunca cache)
const NETWORK_ONLY_DOMAINS = [
  'supabase.co',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// ============================================
// INSTALL — Cachear archivos estáticos
// ============================================
self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => {
        console.log('[SW] Cacheando archivos estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Instalación completa');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Error en instalación:', err);
      })
  );
});

// ============================================
// ACTIVATE — Limpiar caches viejos
// ============================================
self.addEventListener('activate', event => {
  console.log('[SW] Activando Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== CACHE_STATIC)
            .map(name => {
              console.log('[SW] Eliminando cache viejo:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activación completa');
        return self.clients.claim();
      })
  );
});

// ============================================
// FETCH — Estrategia por tipo de recurso
// ============================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Solo manejar GET
  if (event.request.method !== 'GET') return;

  // Dominios de red siempre van directo
  const isNetworkOnly = NETWORK_ONLY_DOMAINS.some(domain => 
    url.hostname.includes(domain)
  );
  
  if (isNetworkOnly) {
    return;
  }

  // Archivos estáticos: Cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // HTML y páginas: Network first
  event.respondWith(networkFirst(event.request));
});

// ============================================
// HELPERS
// ============================================

function isStaticAsset(pathname) {
  return (
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.json')
  );
}

// Cache first — CSS, JS, imágenes
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.error('[SW] Error de red:', err);
    return new Response('Recurso no disponible offline', { status: 503 });
  }
}

// Network first — HTML y páginas
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.log('[SW] Sin red, buscando en cache:', request.url);
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // Fallback a administrador.html
    const fallback = await caches.match('/administrador.html');
    if (fallback) return fallback;

    // Página offline por defecto
    return new Response(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sin conexión — Casa Admin</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Montserrat', -apple-system, sans-serif;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2a2010 100%);
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 24px;
          }
          .container { max-width: 360px; }
          .icon { font-size: 4rem; margin-bottom: 24px; }
          h1 {
            font-size: 1.8rem;
            font-weight: 300;
            letter-spacing: 0.2em;
            color: #c9a96e;
            margin-bottom: 12px;
          }
          p {
            color: #999;
            font-size: 0.9rem;
            line-height: 1.6;
            margin-bottom: 28px;
          }
          button {
            padding: 14px 36px;
            background: #c9a96e;
            color: #0a0a0a;
            border: none;
            border-radius: 8px;
            font-size: 0.8rem;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s;
          }
          button:hover { 
            background: #e8d5b0;
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">📡</div>
          <h1>Sin Conexión</h1>
          <p>No hay conexión a internet. Por favor verifica tu red e intenta nuevamente.</p>
          <button onclick="location.reload()">Reintentar</button>
        </div>
      </body>
      </html>
    `, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

// ============================================
// MENSAJES DESDE LA APP
// ============================================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
    console.log('[SW] Cache limpiado manualmente');
  }
});
