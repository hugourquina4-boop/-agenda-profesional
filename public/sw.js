const CACHE = 'salon-pro-v3'
const PRECACHE = ['/', '/salon', '/favicon.svg']

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {}))
  )
})

self.addEventListener('activate', e => {
  // Delete all old cache versions on every new deploy
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)

  // Never intercept Supabase, external APIs, or hash-based JS/CSS bundles.
  // Hash-based assets (/assets/*.js, /assets/*.css) change on every build.
  // Caching them risks serving stale chunks after a new deploy, which causes
  // "Failed to fetch dynamically imported module" errors in lazy-loaded React routes.
  if (
    url.host.includes('supabase') ||
    url.host.includes('googleapis') ||
    url.pathname.startsWith('/assets/')
  ) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request))
  )
})
