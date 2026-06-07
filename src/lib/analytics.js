// Analytics ligero para Salón Pro — Google Analytics 4 (GA4) + Meta Pixel.
// Los IDs son PÚBLICOS por diseño (van en el HTML del cliente), así que viven
// en variables de entorno con prefijo VITE_ y nunca son secretos:
//   VITE_GA_ID         → "G-XXXXXXXXXX"   (GA4 Measurement ID)
//   VITE_META_PIXEL_ID → "1234567890"     (Meta/Facebook Pixel ID)
// Si no están configuradas, todo es no-op: la app funciona igual sin trackear.

const GA_ID    = import.meta.env.VITE_GA_ID || ''
const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || ''

let iniciado = false

export function initAnalytics() {
  if (iniciado || typeof window === 'undefined') return
  iniciado = true

  // ── Google Analytics 4 ──────────────────────────────────────────────
  if (GA_ID) {
    const s = document.createElement('script')
    s.async = true
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
    document.head.appendChild(s)
    window.dataLayer = window.dataLayer || []
    window.gtag = function () { window.dataLayer.push(arguments) }
    window.gtag('js', new Date())
    window.gtag('config', GA_ID)
  }

  // ── Meta Pixel ──────────────────────────────────────────────────────
  if (PIXEL_ID) {
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
      }
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'
      n.queue = []; t = b.createElement(e); t.async = !0
      t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
    /* eslint-enable */
    window.fbq('init', PIXEL_ID)
    window.fbq('track', 'PageView')
  }
}

// Evento de página (SPA: llamar en cambios de ruta si se desea)
export function trackPageView(path) {
  if (GA_ID && window.gtag) window.gtag('event', 'page_view', { page_path: path })
  if (PIXEL_ID && window.fbq) window.fbq('track', 'PageView')
}

// Conversión genérica
export function trackEvent(nombre, params = {}) {
  if (GA_ID && window.gtag) window.gtag('event', nombre, params)
  if (PIXEL_ID && window.fbq) window.fbq('trackCustom', nombre, params)
}

// Conversión de alta de trial — el evento de negocio que más importa
export function trackTrialSignup(meta = {}) {
  if (GA_ID && window.gtag) window.gtag('event', 'sign_up', { method: 'salon-registro', ...meta })
  if (PIXEL_ID && window.fbq) window.fbq('track', 'CompleteRegistration', meta)
}
