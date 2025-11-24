const CACHE_NAME = "camihogar-v1"
const urlsToCache = [
  "/",
  "/manifest.json",
  // Add other static assets here
]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)))
})

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request)
    }),
  )
})

// Background sync for offline data
self.addEventListener("sync", (event) => {
  if (event.tag === "background-sync") {
    event.waitUntil(syncData())
  }
})

async function syncData() {
  // Implement data synchronization logic here
  console.log("Syncing data...")
}
