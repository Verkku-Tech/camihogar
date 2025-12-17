// Service Worker mejorado para PWA Offline
const CACHE_NAME = "camihogar-v3"
const API_CACHE_NAME = "camihogar-api-v2"
const SYNC_QUEUE_NAME = "sync-requests"
const RUNTIME_CACHE = "camihogar-runtime-v3"

// Recursos críticos a precachear en instalación
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/offline.html",
]

// Endpoints del backend que están disponibles actualmente
const AVAILABLE_ENDPOINTS = [
  "/api/Auth",
  "/api/users",
  "/api/Users",
]

// Instalación
self.addEventListener("install", (event) => {
  console.log("📦 Service Worker instalando v3...")
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Algunos recursos no se pudieron cachear:", err)
      })
    })
  )
  self.skipWaiting() // Activar inmediatamente
})

// Activación
self.addEventListener("activate", (event) => {
  console.log("✅ Service Worker activo v3")
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => 
            name !== CACHE_NAME && 
            name !== API_CACHE_NAME && 
            name !== RUNTIME_CACHE
          )
          .map((name) => {
            console.log("🗑️ Eliminando cache antiguo:", name)
            return caches.delete(name)
          })
      )
    })
  )
  return self.clients.claim()
})

// Interceptar peticiones fetch
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar peticiones que no son GET
  if (request.method !== "GET") {
    return
  }

  // Ignorar peticiones a diferentes dominios (excepto APIs que manejamos)
  if (!url.origin.startsWith(self.location.origin) && !isApiRequest(request)) {
    return
  }

  // Peticiones API - manejar offline
  if (isApiRequest(request)) {
    event.respondWith(handleApiRequest(request))
    return
  }

  // Assets estáticos de Next.js - Cache First (siempre disponibles)
  if (isNextStaticAsset(request)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE))
    return
  }

  // Páginas HTML - Stale While Revalidate (muestra cache mientras actualiza)
  if (isHtmlRequest(request)) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  // Otros recursos estáticos - Cache First
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE))
    return
  }

  // Para otras peticiones, Network First con fallback
  event.respondWith(networkFirst(request))
})

// Detectar si es petición API
function isApiRequest(request) {
  const url = new URL(request.url)
  return (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("camihogar") ||
    url.hostname.includes("verkku.com")
  )
}

// Detectar assets estáticos de Next.js
function isNextStaticAsset(request) {
  const url = new URL(request.url)
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.match(/\/_next\/data\/.*\.json$/)
  )
}

// Detectar si es petición HTML
function isHtmlRequest(request) {
  const url = new URL(request.url)
  return (
    request.headers.get("accept")?.includes("text/html") ||
    url.pathname.endsWith("/") ||
    !url.pathname.includes(".")
  )
}

// Detectar si es recurso estático
function isStaticAsset(request) {
  const url = new URL(request.url)
  return (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/) ||
    url.pathname.startsWith("/static/")
  )
}

// Verificar si es un endpoint disponible en el backend
function isAvailableEndpoint(url) {
  return AVAILABLE_ENDPOINTS.some(path => url.pathname.startsWith(path))
}

// Manejar peticiones API
async function handleApiRequest(request) {
  const url = new URL(request.url)
  
  // Solo interceptar endpoints que sabemos que existen
  if (!isAvailableEndpoint(url)) {
    // Si no es un endpoint del backend, intentar fetch normal
    try {
      return await fetch(request)
    } catch (error) {
      // Si falla, retornar respuesta offline
      return new Response(
        JSON.stringify({ offline: true, message: "Sin conexión" }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      )
    }
  }

  try {
    // Intentar red primero
    const response = await fetch(request.clone())
    
    // Si es exitosa, cachear respuesta GET
    if (response.ok && request.method === "GET") {
      const cache = await caches.open(API_CACHE_NAME)
      cache.put(request, response.clone())
    }
    
    return response
  } catch (error) {
    console.log("🔴 Sin conexión, buscando en cache o cola:", request.url)
    
    // Si es GET, buscar en cache
    if (request.method === "GET") {
      const cachedResponse = await caches.match(request)
      if (cachedResponse) {
        return cachedResponse
      }
    }
    
    // Si es POST/PUT/DELETE, agregar a cola de sincronización
    if (["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
      await addToSyncQueue(request)
      return new Response(
        JSON.stringify({ 
          success: true, 
          offline: true,
          message: "Solicitud guardada para sincronizar cuando vuelva la conexión" 
        }),
        {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }
      )
    }
    
    // Si no hay cache ni cola, retornar error offline
    return new Response(
      JSON.stringify({ 
        error: "Sin conexión y sin datos en cache",
        offline: true 
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}

// Agregar petición a cola de sincronización
async function addToSyncQueue(request) {
  try {
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.clone().text(),
      timestamp: Date.now(),
    }
    
    // Guardar en IndexedDB a través de postMessage
    const clients = await self.clients.matchAll()
    clients.forEach((client) => {
      client.postMessage({
        type: "ADD_TO_SYNC_QUEUE",
        data: requestData,
      })
    })
    
    // Registrar Background Sync
    if (self.registration.sync) {
      await self.registration.sync.register(SYNC_QUEUE_NAME)
      console.log("📝 Petición agregada a cola de sincronización")
    }
  } catch (error) {
    console.error("Error agregando a cola:", error)
  }
}

// Estrategia Cache First mejorada
async function cacheFirst(request, cacheName = CACHE_NAME) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    return cachedResponse
  }
  
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      // Solo cachear si la respuesta es exitosa y no es demasiado grande
      if (response.status === 200) {
        cache.put(request, response.clone()).catch(err => {
          console.warn("Error cacheando:", err)
        })
      }
    }
    return response
  } catch (error) {
    // Si es HTML y falla, retornar página offline
    if (request.headers.get("accept")?.includes("text/html")) {
      const offlinePage = await caches.match("/offline.html")
      if (offlinePage) {
        return offlinePage
      }
    }
    throw error
  }
}

// Nueva estrategia: Stale While Revalidate (para páginas HTML)
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cachedResponse = await cache.match(request)
  
  // Intentar actualizar en background
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone()).catch(err => {
        console.warn("Error actualizando cache:", err)
      })
    }
    return response
  }).catch(() => {
    // Si falla la red, no hacer nada (ya tenemos cache)
    return null
  })

  // Si hay cache, devolverlo inmediatamente
  if (cachedResponse) {
    // No esperar la actualización, devolver cache de inmediato
    fetchPromise.catch(() => {}) // Silenciar errores de actualización
    return cachedResponse
  }

  // Si no hay cache, esperar la respuesta de red
  try {
    const response = await fetchPromise
    if (response) {
      return response
    }
    throw new Error("No hay respuesta")
  } catch (error) {
    // Si falla, intentar página offline
    const offlinePage = await caches.match("/offline.html")
    if (offlinePage) {
      return offlinePage
    }
    throw error
  }
}

// Estrategia Network First con fallback a cache
async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE)
      cache.put(request, response.clone()).catch(err => {
        console.warn("Error cacheando:", err)
      })
    }
    return response
  } catch (error) {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Si es HTML y no hay cache, retornar offline
    if (request.headers.get("accept")?.includes("text/html")) {
      const offlinePage = await caches.match("/offline.html")
      if (offlinePage) {
        return offlinePage
      }
    }
    
    throw error
  }
}

// Background Sync - sincronizar cuando vuelva conexión
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_QUEUE_NAME) {
    console.log("🔄 Iniciando sincronización de cola...")
    event.waitUntil(syncPendingRequests())
  }
})

// Sincronizar peticiones pendientes
async function syncPendingRequests() {
  try {
    // Obtener peticiones pendientes desde IndexedDB
    const clients = await self.clients.matchAll()
    clients.forEach((client) => {
      client.postMessage({
        type: "SYNC_PENDING_REQUESTS",
      })
    })
  } catch (error) {
    console.error("Error en sincronización:", error)
  }
}

// Mensajes desde el cliente
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === "CACHE_URLS") {
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.addAll(event.data.urls).catch(err => {
          console.warn("Error cacheando URLs:", err)
        })
      })
    )
  }
})
