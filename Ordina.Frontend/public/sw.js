// Service Worker — plantilla. prebuild genera public/sw.js con APP_VERSION real.
const APP_VERSION = "20260622-181922-fd1624f"
const CACHE_NAME = `camihogar-static-${APP_VERSION}`
const API_CACHE_NAME = `camihogar-api-${APP_VERSION}`
const RUNTIME_CACHE = `camihogar-runtime-${APP_VERSION}`
const SYNC_QUEUE_NAME = "sync-requests"

const STATIC_ASSETS = ["/offline.html", "/manifest.json"]

const AVAILABLE_ENDPOINTS = ["/api/Auth", "/api/users", "/api/Users"]

function isCurrentVersionCache(name) {
  return (
    name === CACHE_NAME ||
    name === API_CACHE_NAME ||
    name === RUNTIME_CACHE
  )
}

self.addEventListener("install", (event) => {
  console.log(`Service Worker instalando ${APP_VERSION}...`)
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Algunos recursos no se pudieron cachear:", err)
      })
    }),
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  console.log(`Service Worker activo ${APP_VERSION}`)
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (isCurrentVersionCache(name)) return Promise.resolve()
          if (name.startsWith("camihogar-")) {
            console.log("Eliminando cache antigua:", name)
            return caches.delete(name)
          }
          return Promise.resolve()
        }),
      )
    }),
  )
  return self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== "GET") return

  if (!url.origin.startsWith(self.location.origin) && !isApiRequest(request)) {
    return
  }

  // Next.js versiona por hash: no interceptar chunks estáticos
  if (isNextStaticAsset(request)) {
    return
  }

  if (isApiRequest(request)) {
    event.respondWith(handleApiRequest(request))
    return
  }

  if (isNextDataRequest(request)) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE))
    return
  }

  if (isHtmlRequest(request)) {
    event.respondWith(networkFirstHtml(request))
    return
  }

  if (isStaticAsset(request)) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE))
    return
  }

  event.respondWith(networkFirst(request, RUNTIME_CACHE))
})

function isApiRequest(request) {
  const url = new URL(request.url)
  return (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("camihogar") ||
    url.hostname.includes("verkku.com")
  )
}

function isNextStaticAsset(request) {
  const url = new URL(request.url)
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image")
  )
}

function isNextDataRequest(request) {
  const url = new URL(request.url)
  return Boolean(url.pathname.match(/\/_next\/data\/.*\.json$/))
}

function isHtmlRequest(request) {
  const url = new URL(request.url)
  return (
    request.headers.get("accept")?.includes("text/html") ||
    url.pathname.endsWith("/") ||
    !url.pathname.includes(".")
  )
}

function isStaticAsset(request) {
  const url = new URL(request.url)
  return (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/) ||
    url.pathname.startsWith("/static/")
  )
}

function isAvailableEndpoint(url) {
  return AVAILABLE_ENDPOINTS.some((path) => url.pathname.startsWith(path))
}

async function handleApiRequest(request) {
  const url = new URL(request.url)

  if (!isAvailableEndpoint(url)) {
    try {
      return await fetch(request)
    } catch {
      return new Response(
        JSON.stringify({ offline: true, message: "Sin conexión" }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      )
    }
  }

  try {
    const response = await fetch(request.clone())
    if (response.ok && request.method === "GET") {
      const cache = await caches.open(API_CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    if (request.method === "GET") {
      const cachedResponse = await caches.match(request)
      if (cachedResponse) return cachedResponse
    }

    if (["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
      await addToSyncQueue(request)
      return new Response(
        JSON.stringify({
          success: true,
          offline: true,
          message: "Operación guardada para sincronizar",
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      )
    }

    return new Response(
      JSON.stringify({ error: "Sin conexión y sin datos en cache", offline: true }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    )
  }
}

async function addToSyncQueue(request) {
  try {
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.clone().text(),
      timestamp: Date.now(),
    }

    const clients = await self.clients.matchAll()
    clients.forEach((client) => {
      client.postMessage({ type: "ADD_TO_SYNC_QUEUE", data: requestData })
    })

    if (self.registration.sync) {
      await self.registration.sync.register(SYNC_QUEUE_NAME)
    }
  } catch (error) {
    console.error("Error agregando a cola:", error)
  }
}

async function networkFirstHtml(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE)
      cache.put(request, response.clone()).catch(() => {})
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached

    const offlinePage = await caches.match("/offline.html")
    if (offlinePage) return offlinePage

    throw new Error("Sin conexión")
  }
}

async function networkFirst(request, cacheName = RUNTIME_CACHE) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone()).catch(() => {})
    }
    return response
  } catch {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) return cachedResponse

    if (request.headers.get("accept")?.includes("text/html")) {
      const offlinePage = await caches.match("/offline.html")
      if (offlinePage) return offlinePage
    }

    throw new Error("Sin conexión")
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_QUEUE_NAME) {
    event.waitUntil(syncPendingRequests())
  }
})

async function syncPendingRequests() {
  const clients = await self.clients.matchAll()
  clients.forEach((client) => {
    client.postMessage({ type: "SYNC_PENDING_REQUESTS" })
  })
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
  }

  if (event.data?.type === "CACHE_URLS") {
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.addAll(event.data.urls).catch(() => {})
      }),
    )
  }
})
