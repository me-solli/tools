self.addEventListener("install", e => {
  e.waitUntil(
    caches.open("mt-cache").then(cache => {
      return cache.addAll([
        "/",
        "/index.html"
      ])
    })
  )
})
