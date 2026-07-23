// ============================================
// SERVICE WORKER — MAISON PWA
// Versión: 2.0 (Auto-actualización)
// 
// ESTRATEGIAS:
// - HTML → Network First (siempre versión nueva)
// - JS/CSS → Network First (siempre versión nueva)  
// - Imágenes → Cache First (para rendimiento)
// - Fuentes → Cache First (rara vez cambian)
// - Supabase → Network Only (datos en tiempo real)
// ============================================

// ⭐ VERSIÓN: Cambia este número cuando hagas cambios importantes
// El timestamp se genera al deployar en Vercel
const APP_VERSION = 'v20250122-1000';
const CACHE_NAME = `maison-${APP_VERSION}`;
const CACHE_STATIC = `maison-static-${APP_VERSION}`;
const CACHE_IMAGES = `maison-images-${APP_VERSION}`;

// Solo cacheamos assets ESTÁTICOS al instalar (no HTML ni JS principales)
const STATIC_ASSETS = [
  '/iconos/icon-192.png',
  '/iconos/icon-512.png',
  '/manifest.json'
];

// Dominios que SIEMPRE van a la red (nunca cachear)
const NETWORK_ONLY_DOMAINS = [
  'supabase.co',
  'supabase.in'
];

// Dominios de fuentes (cachear agresivamente, rara vez cambian)
const FONT_DOMAINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// ============================================
// INSTALL — Cachear solo lo mínimo
// ============================================
self.addEventListener('install', event => {
  console.log(`[SW ${APP_VERSION}] Instalando...`);
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => {
        console.log(`[SW ${APP_VERSION}] Cacheando iconos y manifest`);
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log(`[SW ${APP_VERSION}] Instalación completa. Activando inmediatamente.`);
        return self.skipWaiting();
      })
      .catch(err => console.error('[SW] Error en instalación:', err))
  );
});

// ============================================
// ACTIVATE — Limpiar cachés viejos
// ============================================
self.addEventListener('activate', event => {
  console.log(`[SW ${APP_VERSION}] Activando y limpiando cachés viejos...`);
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names
          .filter(name => {
            // Borrar TODO caché que no sea de esta versión
            return name !== CACHE_NAME && 
                   name !== CACHE_STATIC && 
                   name !== CACHE_IMAGES;
          })
          .map(name => {
            console.log(`[SW] Eliminando caché viejo: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log(`[SW ${APP_VERSION}] Activo y controlando todas las pestañas`);
      return self.clients.claim();
    }).then(() => {
      // Notificar a todas las pestañas que hay una nueva versión
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ 
            type: 'SW_UPDATED', 
            version: APP_VERSION 
          });
        });
      });
    })
  );
});

// ============================================
// FETCH — Estrategias inteligentes
// ============================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Solo GET requests
  if (event.request.method !== 'GET') return;
  
  // NUNCA cachear Supabase (datos en tiempo real)
  const isNetworkOnly = NETWORK_ONLY_DOMAINS.some(domain =>
    url.hostname.includes(domain)
  );
  if (isNetworkOnly) return;
  
  // Fuentes → Cache First (agresivo, rara vez cambian)
  const isFont = FONT_DOMAINS.some(domain => url.hostname.includes(domain));
  if (isFont) {
    event.respondWith(cacheFirst(event.request, CACHE_STATIC));
    return;
  }
  
  // Imágenes → Cache First (para rendimiento)
  if (isImage(url.pathname) || url.hostname.includes('supabase.co')) {
    event.respondWith(cacheFirst(event.request, CACHE_IMAGES));
    return;
  }
  
  // HTML, JS, CSS → Network First SIEMPRE
  // Esto garantiza que los cambios se apliquen inmediatamente
  event.respondWith(networkFirst(event.request));
});

// ============================================
// Helpers
// ============================================
function isImage(pathname) {
  return (
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.ico')
  );
}

// ============================================
// Estrategia: CACHE FIRST
// Usa caché si existe, sino va a la red
// Ideal para: imágenes, fuentes (recursos estáticos)
// ============================================
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Recurso no disponible offline', { status: 503 });
  }
}

// ============================================
// Estrategia: NETWORK FIRST
// Siempre intenta red primero, cache como respaldo
// Ideal para: HTML, JS, CSS (para actualizaciones)
// ============================================
async function networkFirst(request) {
  try {
    // Intentar red primero con timeout de 5 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      // Guardar en caché para uso offline
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
    
  } catch (err) {
    // Si falla la red, usar caché
    console.log('[SW] Red no disponible, usando caché:', request.url);
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // Si es una navegación HTML, mostrar página offline
    if (request.mode === 'navigate' || request.destination === 'document') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
      
      return new Response(getOfflineHTML(), {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    
    return new Response('Sin conexión', { status: 503 });
  }
}

// ============================================
// Página offline elegante
// ============================================
function getOfflineHTML() {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sin conexión — MAISON</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Jost', -apple-system, BlinkMacSystemFont, sans-serif;
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
          background: linear-gradient(135deg, #c9a96e, #8f6b3f);
          color: #ffffff;
          border: none;
          border-radius: 8px;
          font-size: 0.8rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          cursor: pointer;
          font-weight: 600;
          transition: transform 0.2s;
        }
        button:hover { 
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">📡</div>
        <h1>Sin Conexión</h1>
        <p>No hay conexión a internet. Verifica tu red e intenta nuevamente.</p>
        <button onclick="location.reload()">Reintentar</button>
      </div>
    </body>
    </html>
  `;
}

// ============================================
// Escuchar mensajes desde la app
// ============================================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Recibido SKIP_WAITING, activando nueva versión');
    self.skipWaiting();
  }
  
  // Limpiar todos los cachés (útil para debugging)
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
      console.log('[SW] Todos los cachés limpiados');
    });
  }
});
