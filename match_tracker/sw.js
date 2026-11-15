const CACHE_VERSION = "mt-cache-v2"
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json"
]

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", event => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== "GET") {
    return
  }

  if (url.origin !== self.location.origin) {
    return
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const cloned = response.clone()
          caches.open(CACHE_VERSION).then(cache => cache.put("./index.html", cloned))
          return response
        })
        .catch(() => caches.match("./index.html"))
    )
    return
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        return cached
      }

      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response
        }

        const cloned = response.clone()
        caches.open(CACHE_VERSION).then(cache => cache.put(request, cloned))
        return response
      })
    })
  )
})
