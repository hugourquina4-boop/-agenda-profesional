import { useState, useEffect } from 'react'

const GREEN  = '#16a34a'
const DARK   = '#1a1a1a'
const BG     = '#FAFAF8'
const TEXT2  = '#52525b'
const BORDER = 'rgba(0,0,0,0.08)'

const PLANES = [
  {
    key: 'starter', label: 'Starter', precio: '$60.000',
    color: '#6366f1', desc: 'Para empezar',
    features: ['1 profesional','Agenda ilimitada','Portal de reservas','Clientes + historial','Caja básica'],
    noIncluye: ['Analytics avanzado','Múltiples sedes','Comisiones'],
  },
  {
    key: 'pro', label: 'Pro', precio: '$100.000',
    color: GREEN, desc: 'El más popular', popular: true,
    features: ['Hasta 5 profesionales','Todo Starter','Analytics avanzado','Comisiones + planilla','Inventario + proveedores','WhatsApp automático'],
    noIncluye: ['Múltiples sedes'],
  },
  {
    key: 'ultra', label: 'Ultra', precio: '$140.000',
    color: '#f43f5e', desc: 'Para equipos grandes',
    features: ['Profesionales ilimitados','Todo Pro','Múltiples sedes','Bóveda de contraseñas','Soporte prioritario','API + integraciones'],
    noIncluye: [],
  },
]

const FEATURES = [
  { icon: '📅', title: 'Agenda inteligente', desc: 'Vista mes, semana, día y timeline horizontal. Arrastra citas, detecta solapamientos, bloquea franjas.' },
  { icon: '👥', title: 'Gestión de clientes', desc: 'Historial completo, fotos, etiquetas VIP, programa de puntos, notas de alergias y cumpleaños.' },
  { icon: '💰', title: 'Caja y cobros', desc: 'Registra cobros, egresos y propinas. PDF de cuadre diario. Gráficos de ingresos vs egresos.' },
  { icon: '📊', title: 'Analytics gerencial', desc: 'P&L completo, top servicios, heatmap de días, retención de clientes y comparativa mensual.' },
  { icon: '🌐', title: 'Portal de reservas', desc: 'Tus clientes reservan solos desde el link público. Pago en línea con Wompi/PSE opcional.' },
  { icon: '💬', title: 'WhatsApp automático', desc: 'Confirmaciones, recordatorios 24h y 1h antes, cumpleaños y resumen diario al dueño.' },
  { icon: '🏪', title: 'Multi-sede', desc: 'Maneja varias sucursales desde un solo panel. Filtra agenda, profesionales y reportes por sede.' },
  { icon: '📦', title: 'Inventario', desc: 'Control de stock, alertas de mínimo, historial de movimientos, pedidos a proveedores.' },
]

function Nav({ onCTA }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? 'rgba(250,250,248,0.95)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? `1px solid ${BORDER}` : 'none',
      transition: 'all 0.3s',
      padding: '0 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 60,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="/logo192.png" alt="Salón Pro" style={{ width: 32, height: 32, borderRadius: 8 }} />
        <span style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 18, color: DARK, letterSpacing: -0.5 }}>
          SALÓN <span style={{ color: GREEN }}>PRO</span>
        </span>
      </div>
      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <a href="/salon" style={{
          padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
          color: TEXT2, textDecoration: 'none', background: 'transparent',
        }}>
          Ingresar
        </a>
        <button onClick={onCTA} style={{
          padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
          background: GREEN, color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: `0 4px 14px ${GREEN}40`,
        }}>
          Prueba gratis
        </button>
      </div>
    </nav>
  )
}

function Hero({ onCTA }) {
  return (
    <section style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '100px 24px 60px', textAlign: 'center',
      background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${GREEN}12 0%, transparent 70%), ${BG}`,
    }}>
      {/* Badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 14px', borderRadius: 20,
        background: `${GREEN}15`, border: `1px solid ${GREEN}30`,
        color: GREEN, fontSize: 12, fontWeight: 700, marginBottom: 28,
        letterSpacing: 0.5,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, animation: 'pulse 2s infinite' }} />
        14 días gratis · Sin tarjeta de crédito
      </div>

      {/* Headline */}
      <h1 style={{
        fontFamily: 'Outfit', fontWeight: 900, fontSize: 'clamp(36px, 8vw, 68px)',
        color: DARK, lineHeight: 1.05, letterSpacing: -2,
        maxWidth: 780, margin: '0 0 20px',
      }}>
        Tu salón, bajo control.<br />
        <span style={{ color: GREEN }}>Desde el celular.</span>
      </h1>

      <p style={{
        fontSize: 'clamp(15px, 2.5vw, 19px)', color: TEXT2,
        maxWidth: 520, lineHeight: 1.65, margin: '0 0 40px',
        fontFamily: 'Plus Jakarta Sans',
      }}>
        Agenda citas, gestiona tu equipo, controla la caja y fideliza clientes.
        Todo en una sola app, sin complicaciones.
      </p>

      {/* CTAs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 56 }}>
        <button onClick={onCTA} style={{
          padding: '15px 32px', borderRadius: 14, fontSize: 15, fontWeight: 800,
          background: GREEN, color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: `0 8px 24px ${GREEN}45`, fontFamily: 'Outfit',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 30px ${GREEN}55` }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 8px 24px ${GREEN}45` }}
        >
          Empezar gratis →
        </button>
        <a href="/salon" style={{
          padding: '15px 32px', borderRadius: 14, fontSize: 15, fontWeight: 700,
          background: 'white', color: DARK, border: `1.5px solid ${BORDER}`,
          cursor: 'pointer', textDecoration: 'none', fontFamily: 'Outfit',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          Ver demo
        </a>
      </div>

      {/* App preview card */}
      <div style={{
        maxWidth: 360, width: '100%', borderRadius: 24,
        background: 'white', border: `1px solid ${BORDER}`,
        boxShadow: '0 24px 80px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        transform: 'perspective(1000px) rotateX(4deg)',
      }}>
        {/* Fake status bar */}
        <div style={{ background: '#1a1a1a', padding: '10px 20px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, opacity: 0.8 }}>9:41</span>
          <span style={{ color: '#fff', fontSize: 11, opacity: 0.6 }}>●●●</span>
        </div>
        {/* App header */}
        <div style={{ background: '#1a1a1a', padding: '12px 20px 16px' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Lunes 19 de mayo</div>
          <div style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 800, color: '#fff' }}>Buenos días 👋</div>
        </div>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: 12, background: '#f4f4f2' }}>
          {[['8', 'Citas hoy'], ['$420K', 'Ingresos'], ['3', 'Equipo']].map(([v, l]) => (
            <div key={l} style={{ background: 'white', borderRadius: 12, padding: '10px 8px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 18, color: DARK }}>{v}</div>
              <div style={{ fontSize: 9, color: TEXT2, fontWeight: 600 }}>{l}</div>
            </div>
          ))}
        </div>
        {/* Cita preview */}
        {[
          { hora: '10:00am', nombre: 'María García', svc: 'Corte + tintura', clr: '#6366f1', est: 'Confirmada' },
          { hora: '11:30am', nombre: 'Laura Rodríguez', svc: 'Manicure francesa', clr: GREEN, est: 'Pendiente' },
          { hora: '2:00pm',  nombre: 'Ana Martínez', svc: 'Peinado novia', clr: '#f43f5e', est: 'Confirmada' },
        ].map(c => (
          <div key={c.hora} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            borderBottom: `1px solid ${BORDER}`,
            background: `linear-gradient(90deg, ${c.clr}08 0%, transparent 100%)`,
          }}>
            <div style={{ width: 3, height: 36, borderRadius: 4, background: c.clr, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: DARK }}>{c.nombre}</div>
              <div style={{ fontSize: 10, color: TEXT2 }}>{c.hora} · {c.svc}</div>
            </div>
            <div style={{
              fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 6,
              background: `${c.clr}18`, color: c.clr,
            }}>{c.est}</div>
          </div>
        ))}
        <div style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, color: TEXT2, background: '#f4f4f2' }}>
          y 5 citas más hoy...
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section style={{ padding: '80px 24px', background: 'white' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Todo incluido
          </div>
          <h2 style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 'clamp(28px,5vw,44px)', color: DARK, letterSpacing: -1, margin: '0 0 14px' }}>
            Una app. Todo lo que necesitas.
          </h2>
          <p style={{ fontSize: 16, color: TEXT2, maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
            Sin módulos de pago extra. Sin sorpresas. Cada plan incluye el acceso completo a las funciones de su nivel.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{
              padding: '22px 20px', borderRadius: 16,
              background: BG, border: `1px solid ${BORDER}`,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
            >
              <div style={{ fontSize: 26, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 15, color: DARK, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.55 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pricing({ onCTA }) {
  return (
    <section style={{ padding: '80px 24px', background: BG }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Precios
          </div>
          <h2 style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 'clamp(28px,5vw,44px)', color: DARK, letterSpacing: -1, margin: '0 0 10px' }}>
            Simple y transparente
          </h2>
          <p style={{ fontSize: 15, color: TEXT2 }}>Precios en pesos colombianos · mes a mes · cancela cuando quieras</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, alignItems: 'start' }}>
          {PLANES.map(p => (
            <div key={p.key} style={{
              borderRadius: 20, overflow: 'hidden',
              border: p.popular ? `2px solid ${p.color}` : `1.5px solid ${BORDER}`,
              background: 'white',
              boxShadow: p.popular ? `0 12px 40px ${p.color}20` : '0 2px 12px rgba(0,0,0,0.05)',
              position: 'relative',
            }}>
              {p.popular && (
                <div style={{
                  position: 'absolute', top: 0, right: 0,
                  background: p.color, color: '#fff',
                  fontSize: 10, fontWeight: 800, padding: '4px 12px',
                  borderBottomLeftRadius: 10, letterSpacing: 0.5,
                }}>
                  MÁS POPULAR
                </div>
              )}
              <div style={{ padding: '24px 22px 0' }}>
                <div style={{
                  display: 'inline-block', padding: '4px 10px', borderRadius: 8,
                  background: `${p.color}18`, color: p.color,
                  fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 10,
                }}>
                  {p.label.toUpperCase()}
                </div>
                <div style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 34, color: DARK, lineHeight: 1 }}>
                  {p.precio}
                </div>
                <div style={{ fontSize: 12, color: TEXT2, marginBottom: 20 }}>/mes · IVA no incluido</div>
              </div>
              <div style={{ padding: '0 22px 22px' }}>
                {p.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <span style={{ color: p.color, fontWeight: 800, fontSize: 14, flexShrink: 0, lineHeight: 1.4 }}>✓</span>
                    <span style={{ fontSize: 13, color: DARK, lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
                {p.noIncluye.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8, opacity: 0.4 }}>
                    <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1.4 }}>—</span>
                    <span style={{ fontSize: 13, color: DARK, lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
                <button onClick={onCTA} style={{
                  width: '100%', marginTop: 18,
                  padding: '12px 0', borderRadius: 12, border: 'none',
                  background: p.popular ? p.color : `${p.color}15`,
                  color: p.popular ? '#fff' : p.color,
                  fontFamily: 'Outfit', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                  boxShadow: p.popular ? `0 6px 20px ${p.color}40` : 'none',
                  transition: 'opacity 0.15s',
                }}>
                  Empezar gratis 14 días
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SocialProof() {
  const stats = [
    { n: '15+', label: 'Módulos incluidos' },
    { n: '14', label: 'Días de prueba gratis' },
    { n: '5min', label: 'Para configurar' },
    { n: '100%', label: 'En tu celular' },
  ]
  return (
    <section style={{ padding: '60px 24px', background: 'white', borderTop: `1px solid ${BORDER}` }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: 24, textAlign: 'center' }}>
        {stats.map(s => (
          <div key={s.n}>
            <div style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 38, color: DARK, letterSpacing: -1 }}>{s.n}</div>
            <div style={{ fontSize: 13, color: TEXT2, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function FinalCTA({ onCTA }) {
  return (
    <section style={{
      padding: '80px 24px',
      background: `linear-gradient(135deg, ${DARK} 0%, #2d3748 100%)`,
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 'clamp(28px,5vw,44px)', color: '#fff', letterSpacing: -1, margin: '0 0 16px' }}>
          Empieza hoy.<br />
          <span style={{ color: GREEN }}>Gratis por 14 días.</span>
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 1.65, marginBottom: 36 }}>
          Sin tarjeta de crédito. Sin contratos. Si no te convence, no cobras nada.
        </p>
        <button onClick={onCTA} style={{
          padding: '16px 40px', borderRadius: 14, fontSize: 16, fontWeight: 800,
          background: GREEN, color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: `0 8px 28px ${GREEN}50`, fontFamily: 'Outfit',
          transition: 'transform 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = ''}
        >
          Crear mi cuenta gratis →
        </button>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 16 }}>
          Ya tienes cuenta? <a href="/salon" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'underline' }}>Iniciar sesión</a>
        </p>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer style={{ padding: '28px 24px', background: DARK, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
        <img src="/logo192.png" alt="Salón Pro" style={{ width: 24, height: 24, borderRadius: 6 }} />
        <span style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 14, color: '#fff' }}>
          SALÓN <span style={{ color: GREEN }}>PRO</span>
        </span>
      </div>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
        © 2026 Salón Pro · Gestión profesional para salones de belleza
      </p>
    </footer>
  )
}

export default function LandingPage() {
  const handleCTA = () => { window.location.href = '/salon-registro' }

  return (
    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', background: BG }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${BG}; }
      `}</style>
      <Nav onCTA={handleCTA} />
      <Hero onCTA={handleCTA} />
      <SocialProof />
      <Features />
      <Pricing onCTA={handleCTA} />
      <FinalCTA onCTA={handleCTA} />
      <Footer />
    </div>
  )
}
