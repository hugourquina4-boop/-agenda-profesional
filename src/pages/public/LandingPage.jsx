import { useState, useEffect } from 'react'

const GREEN  = '#16a34a'
const DARK   = '#1a1a1a'
const BG     = '#FAFAF8'
const TEXT2  = '#52525b'
const BORDER = 'rgba(0,0,0,0.08)'
const INDIGO = '#6366f1'
const BLUE   = '#2563eb'

// ─── SVG Icons (stroke, no emojis) ──────────────────────────────────────────

const sv = (d, extra = '') => ({ __html: d + extra })

function Ico({ size = 22, color = 'currentColor', children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

const ICalendar = ({ s = 22, c = 'currentColor' }) => <Ico size={s} color={c}>
  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
  <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
</Ico>

const IUsers = ({ s = 22, c = 'currentColor' }) => <Ico size={s} color={c}>
  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
  <circle cx="9" cy="7" r="4" />
  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
</Ico>

const IWallet = ({ s = 22, c = 'currentColor' }) => <Ico size={s} color={c}>
  <rect x="2" y="5" width="20" height="14" rx="2" />
  <path d="M16 12h2" /><line x1="2" y1="10" x2="22" y2="10" />
</Ico>

const IChart = ({ s = 22, c = 'currentColor' }) => <Ico size={s} color={c}>
  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
  <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
</Ico>

const IGlobe = ({ s = 22, c = 'currentColor' }) => <Ico size={s} color={c}>
  <circle cx="12" cy="12" r="10" />
  <line x1="2" y1="12" x2="22" y2="12" />
  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
</Ico>

const IMessage = ({ s = 22, c = 'currentColor' }) => <Ico size={s} color={c}>
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
</Ico>

const IBuilding = ({ s = 22, c = 'currentColor' }) => <Ico size={s} color={c}>
  <rect x="4" y="2" width="16" height="20" rx="1" />
  <path d="M9 22V12h6v10" />
  <rect x="8" y="6" width="2" height="2" /><rect x="14" y="6" width="2" height="2" />
  <rect x="8" y="11" width="2" height="2" /><rect x="14" y="11" width="2" height="2" />
</Ico>

const IBox = ({ s = 22, c = 'currentColor' }) => <Ico size={s} color={c}>
  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
  <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
</Ico>

const ICheck = ({ s = 15, c = GREEN }) => <Ico size={s} color={c}>
  <polyline points="20 6 9 17 4 12" strokeWidth="2.5" />
</Ico>

const IArrow = ({ s = 16, c = 'currentColor' }) => <Ico size={s} color={c}>
  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
</Ico>

// ─── Data ────────────────────────────────────────────────────────────────────

const FEATURES = [
  { Icon: ICalendar, color: INDIGO,  title: 'Agenda por profesional',   desc: 'Visualiza las citas de todo tu equipo en un solo calendario. Mueve turnos con arrastrar y soltar.' },
  { Icon: IGlobe,    color: BLUE,    title: 'Reservas en línea',         desc: 'Tus clientes agendan solos desde tu link público, a cualquier hora, sin llamadas ni mensajes.' },
  { Icon: IMessage,  color: '#16a34a', title: 'WhatsApp automático',    desc: 'El sistema confirma la cita y manda recordatorios 24 h y 1 h antes. Cero llamadas para confirmar.' },
  { Icon: IUsers,    color: '#7c3aed', title: 'Historial de clientes',  desc: 'Fotos del trabajo, notas de alergias, etiquetas VIP, puntos de fidelidad y registro de visitas.' },
  { Icon: IWallet,   color: '#0891b2', title: 'Caja y cobros',          desc: 'Registra ingresos, egresos y propinas. Cierre del día en PDF con firma para el cuadre.' },
  { Icon: IChart,    color: '#d97706', title: 'Informe gerencial',       desc: 'Ve cuánto ganaste, qué servicios venden más y qué días son los más ocupados del mes.' },
  { Icon: IBox,      color: '#be185d', title: 'Inventario y pedidos',   desc: 'Controla tus productos, recibe alerta cuando hay poco stock y genera órdenes de compra en PDF.' },
  { Icon: IBuilding, color: '#0f766e', title: 'Multi-sede',             desc: 'Varias sucursales, un solo panel. Filtra reportes y agenda por sede o ve todo consolidado.' },
]

// Columnas: starter | pro | ultra
const PLANES_HEAD = [
  { key: 'starter', label: 'Starter',  price: '$60.000',  color: INDIGO,  per: '/ mes', desc: 'Para empezar' },
  { key: 'pro',     label: 'Pro',      price: '$100.000', color: GREEN,   per: '/ mes', desc: 'El más popular', popular: true },
  { key: 'ultra',   label: 'Ultra',    price: '$140.000', color: BLUE,    per: '/ mes', desc: 'Equipos grandes' },
]

const TABLE_ROWS = [
  { group: 'Base incluida en todos los planes' },
  { label: 'Profesionales',              starter: '1',       pro: 'Hasta 5', ultra: 'Sin límite' },
  { label: 'Agenda y citas',             starter: true,  pro: true,  ultra: true  },
  { label: 'Portal de reservas online',  starter: true,  pro: true,  ultra: true  },
  { label: 'Gestión de clientes',        starter: true,  pro: true,  ultra: true  },
  { label: 'Caja, cobros y egresos',     starter: true,  pro: true,  ultra: true  },
  { label: 'Pagos en línea (Wompi/PSE)', starter: true,  pro: true,  ultra: true  },
  { group: 'Incluido desde plan Pro' },
  { label: 'WhatsApp automático',        starter: false, pro: true,  ultra: true  },
  { label: 'Analytics e informes P&L',   starter: false, pro: true,  ultra: true  },
  { label: 'Comisiones y planilla PDF',  starter: false, pro: true,  ultra: true  },
  { label: 'Inventario y proveedores',   starter: false, pro: true,  ultra: true  },
  { label: 'Programa de puntos',         starter: false, pro: true,  ultra: true  },
  { group: 'Solo plan Ultra' },
  { label: 'Múltiples sedes',            starter: false, pro: false, ultra: true  },
  { label: 'Bóveda de contraseñas',      starter: false, pro: false, ultra: true  },
  { label: 'Soporte prioritario',        starter: false, pro: false, ultra: true  },
]

const TESTIMONIALS = [
  { nombre: 'Carolina R.', negocio: 'Studio Belleza · Bogotá',    texto: 'Antes escribía todo en un cuaderno y siempre se me olvidaban clientes. Ahora el sistema manda el recordatorio solo y casi no tengo no-shows.' },
  { nombre: 'Andrés M.',   negocio: 'Barbería La Navaja · Medellín', texto: 'Lo que más me gustó fue el portal de reservas. Los clientes agendan solos un sábado a las 11 pm y el cupo ya aparece ocupado.' },
  { nombre: 'Juliana P.',  negocio: 'Salón Estilo · Cali',         texto: 'Las comisiones me tomaban horas. Ahora cierro la planilla de todo el equipo en 5 minutos y les mando el PDF por WhatsApp.' },
]

// ─── Componentes ─────────────────────────────────────────────────────────────

function Nav({ onCTA }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? 'rgba(250,250,248,0.96)' : 'transparent',
      backdropFilter: scrolled ? 'blur(14px)' : 'none',
      borderBottom: scrolled ? `1px solid ${BORDER}` : 'none',
      transition: 'all 0.25s',
      padding: '0 clamp(16px, 4vw, 40px)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 58,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 13, color: GREEN, letterSpacing: -0.5 }}>SP</span>
        </div>
        <span style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 17, color: DARK, letterSpacing: -0.5 }}>
          SALÓN <span style={{ color: GREEN }}>PRO</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <a href="/salon" style={{
          padding: '7px 15px', borderRadius: 9, fontSize: 13, fontWeight: 600,
          color: TEXT2, textDecoration: 'none',
        }}>
          Ingresar
        </a>
        <button onClick={onCTA} style={{
          padding: '8px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700,
          background: DARK, color: '#fff', border: 'none', cursor: 'pointer',
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
      padding: 'clamp(90px,12vw,120px) clamp(16px,4vw,40px) 64px',
      textAlign: 'center',
      background: `radial-gradient(ellipse 80% 50% at 50% -5%, ${GREEN}14 0%, transparent 70%), ${BG}`,
    }}>
      {/* Badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '5px 14px', borderRadius: 20,
        background: `${GREEN}14`, border: `1px solid ${GREEN}28`,
        color: GREEN, fontSize: 12, fontWeight: 700, marginBottom: 30, letterSpacing: 0.3,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, display: 'inline-block' }} />
        15 días gratis · Sin tarjeta de crédito
      </div>

      <h1 style={{
        fontFamily: 'Outfit', fontWeight: 900,
        fontSize: 'clamp(34px, 7.5vw, 66px)',
        color: DARK, lineHeight: 1.06, letterSpacing: -2,
        maxWidth: 740, margin: '0 0 22px',
      }}>
        El sistema que necesita<br />
        <span style={{ color: GREEN }}>tu salón o barbería.</span>
      </h1>

      <p style={{
        fontSize: 'clamp(15px, 2.2vw, 18px)', color: TEXT2,
        maxWidth: 500, lineHeight: 1.7, margin: '0 0 16px',
      }}>
        Reemplaza el cuaderno, los mensajes de WhatsApp y las hojas de Excel.
        Todo en una app que funciona desde el celular.
      </p>
      <p style={{ fontSize: 13, color: TEXT2, marginBottom: 40, opacity: 0.7 }}>
        Agenda · Reservas online · WhatsApp automático · Caja · Comisiones · Analytics
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 60 }}>
        <button onClick={onCTA} style={{
          padding: '14px 30px', borderRadius: 12, fontSize: 15, fontWeight: 800,
          background: GREEN, color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: `0 6px 22px ${GREEN}40`, fontFamily: 'Outfit',
          display: 'flex', alignItems: 'center', gap: 8,
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 10px 28px ${GREEN}50` }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 6px 22px ${GREEN}40` }}
        >
          Empezar gratis <IArrow s={15} c="#fff" />
        </button>
        <a href="/salon" style={{
          padding: '14px 30px', borderRadius: 12, fontSize: 15, fontWeight: 700,
          background: 'white', color: DARK, border: `1.5px solid ${BORDER}`,
          cursor: 'pointer', textDecoration: 'none',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        }}>
          Ver la app →
        </a>
      </div>

      {/* App card preview */}
      <div style={{
        maxWidth: 340, width: '100%', borderRadius: 22,
        background: 'white', border: `1px solid ${BORDER}`,
        boxShadow: '0 20px 70px rgba(0,0,0,0.11)',
        overflow: 'hidden',
        transform: 'perspective(900px) rotateX(3deg)',
      }}>
        <div style={{ background: DARK, padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 13, color: '#fff' }}>Hoy · 8 citas</span>
          <span style={{
            fontSize: 11, fontWeight: 700, background: `${GREEN}30`, color: GREEN,
            padding: '2px 8px', borderRadius: 5,
          }}>$420.000</span>
        </div>
        {[
          { hora: '10:00', nombre: 'María García',    svc: 'Corte + Tintura',    clr: INDIGO, est: 'Confirmada' },
          { hora: '11:30', nombre: 'Laura Rodríguez', svc: 'Manicure francesa',  clr: GREEN,  est: 'En curso' },
          { hora: '14:00', nombre: 'Ana Martínez',    svc: 'Peinado de novia',   clr: BLUE,   est: 'Pendiente' },
        ].map(c => (
          <div key={c.hora} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 14px', borderBottom: `1px solid ${BORDER}`,
          }}>
            <div style={{ width: 3, height: 34, borderRadius: 4, background: c.clr, flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: DARK }}>{c.nombre}</div>
              <div style={{ fontSize: 10, color: TEXT2 }}>{c.hora} · {c.svc}</div>
            </div>
            <div style={{
              fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 5,
              background: `${c.clr}16`, color: c.clr, whiteSpace: 'nowrap',
            }}>{c.est}</div>
          </div>
        ))}
        <div style={{ padding: '9px 14px', textAlign: 'center', fontSize: 11, color: TEXT2, background: BG }}>
          + 5 citas más hoy
        </div>
      </div>
    </section>
  )
}

function Stats() {
  const items = [
    { n: '15+', label: 'Módulos incluidos' },
    { n: '15',  label: 'Días de prueba gratis' },
    { n: '5 min', label: 'Para empezar a usar' },
    { n: '100%', label: 'Desde el celular' },
  ]
  return (
    <section style={{ padding: '48px clamp(16px,4vw,40px)', background: 'white', borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, textAlign: 'center' }}>
        {items.map(s => (
          <div key={s.n} className="stat-item">
            <div style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 34, color: DARK, letterSpacing: -1 }}>{s.n}</div>
            <div style={{ fontSize: 12, color: TEXT2, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Features() {
  return (
    <section style={{ padding: 'clamp(60px,8vw,96px) clamp(16px,4vw,40px)', background: BG }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
            Funcionalidades
          </div>
          <h2 style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 'clamp(26px,4.5vw,42px)', color: DARK, letterSpacing: -1, margin: '0 0 12px' }}>
            Todo lo que necesitas, en un solo lugar
          </h2>
          <p style={{ fontSize: 15, color: TEXT2, maxWidth: 460, margin: '0 auto', lineHeight: 1.65 }}>
            Sin módulos de pago aparte. Sin configuraciones complicadas.
            Listo para usar desde el primer día.
          </p>
        </div>

        <div className="features-grid">
          {FEATURES.map(({ Icon, color, title, desc }) => (
            <div key={title} className="feature-card" style={{
              padding: '24px 22px', borderRadius: 16,
              background: 'white', border: `1px solid ${BORDER}`,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12, marginBottom: 14,
                background: `${color}14`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon s={22} c={color} />
              </div>
              <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 14, color: DARK, marginBottom: 6, lineHeight: 1.3 }}>{title}</div>
              <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pricing({ onCTA }) {
  function renderCell(val, colKey, popular) {
    if (val === true) return (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: popular ? `${GREEN}18` : '#f0fdf4',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ICheck s={13} c={GREEN} />
        </div>
      </div>
    )
    if (val === false) return (
      <div style={{ textAlign: 'center', color: '#d1d5db', fontSize: 16, fontWeight: 300 }}>—</div>
    )
    return (
      <div style={{
        textAlign: 'center', fontSize: 12, fontWeight: 700,
        color: popular ? GREEN : TEXT2,
      }}>{val}</div>
    )
  }

  return (
    <section style={{ padding: 'clamp(60px,8vw,96px) clamp(16px,4vw,40px)', background: 'white' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
            Precios
          </div>
          <h2 style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 'clamp(26px,4.5vw,42px)', color: DARK, letterSpacing: -1, margin: '0 0 10px' }}>
            Simple y transparente
          </h2>
          <p style={{ fontSize: 14, color: TEXT2 }}>En pesos colombianos · Sin contratos · Cancela cuando quieras</p>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: 18, border: `1px solid ${BORDER}`, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
            {/* Header */}
            <thead>
              <tr>
                <th style={{
                  padding: '20px 20px', textAlign: 'left',
                  background: BG, borderBottom: `1px solid ${BORDER}`,
                  fontFamily: 'Outfit', fontWeight: 700, fontSize: 12,
                  color: TEXT2, letterSpacing: 0.5, width: '36%',
                }}>
                  Funcionalidad
                </th>
                {PLANES_HEAD.map(p => (
                  <th key={p.key} style={{
                    padding: '20px 16px', textAlign: 'center',
                    background: p.popular ? `${GREEN}08` : BG,
                    borderBottom: `2px solid ${p.popular ? GREEN : BORDER}`,
                    borderLeft: `1px solid ${BORDER}`,
                    position: 'relative', width: '21%',
                  }}>
                    {p.popular && (
                      <div style={{
                        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                        background: GREEN, color: '#fff',
                        fontSize: 9, fontWeight: 800, padding: '2px 10px',
                        borderBottomLeftRadius: 7, borderBottomRightRadius: 7,
                        letterSpacing: 0.8, whiteSpace: 'nowrap',
                      }}>
                        MÁS POPULAR
                      </div>
                    )}
                    <div style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 16, color: p.color, marginBottom: 2 }}>
                      {p.label}
                    </div>
                    <div style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 22, color: DARK, lineHeight: 1, marginBottom: 2 }}>
                      {p.price}
                    </div>
                    <div style={{ fontSize: 10, color: TEXT2, marginBottom: 12 }}>{p.per} · IVA no incl.</div>
                    <button onClick={onCTA} style={{
                      width: '100%', padding: '9px 0', borderRadius: 9, border: 'none',
                      background: p.popular ? GREEN : `${p.color}14`,
                      color: p.popular ? '#fff' : p.color,
                      fontFamily: 'Outfit', fontWeight: 800, fontSize: 12, cursor: 'pointer',
                      boxShadow: p.popular ? `0 4px 14px ${GREEN}35` : 'none',
                    }}>
                      Probar gratis
                    </button>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Rows */}
            <tbody>
              {TABLE_ROWS.map((row, i) => {
                if (row.group) {
                  return (
                    <tr key={i}>
                      <td colSpan={4} style={{
                        padding: '10px 20px',
                        background: '#f8f9fa',
                        borderTop: i > 0 ? `1px solid ${BORDER}` : 'none',
                        borderBottom: `1px solid ${BORDER}`,
                        fontSize: 10, fontWeight: 800, color: TEXT2,
                        letterSpacing: 0.8, textTransform: 'uppercase',
                      }}>
                        {row.group}
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{
                      padding: '11px 20px',
                      fontSize: 13, color: DARK, fontWeight: 500,
                      borderTop: `1px solid ${BORDER}`,
                    }}>
                      {row.label}
                    </td>
                    {PLANES_HEAD.map(p => (
                      <td key={p.key} style={{
                        padding: '11px 16px',
                        borderTop: `1px solid ${BORDER}`,
                        borderLeft: `1px solid ${BORDER}`,
                        background: p.popular ? `${GREEN}05` : 'transparent',
                      }}>
                        {renderCell(row[p.key], p.key, p.popular)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>

            {/* Footer CTA */}
            <tfoot>
              <tr>
                <td style={{ padding: '18px 20px', background: BG, borderTop: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 11, color: TEXT2 }}>15 días gratis en todos los planes</div>
                </td>
                {PLANES_HEAD.map(p => (
                  <td key={p.key} style={{
                    padding: '18px 16px', textAlign: 'center',
                    background: p.popular ? `${GREEN}08` : BG,
                    borderTop: `1px solid ${BORDER}`, borderLeft: `1px solid ${BORDER}`,
                  }}>
                    <button onClick={onCTA} style={{
                      width: '100%', padding: '10px 0', borderRadius: 9, border: 'none',
                      background: p.popular ? GREEN : `${p.color}14`,
                      color: p.popular ? '#fff' : p.color,
                      fontFamily: 'Outfit', fontWeight: 800, fontSize: 12, cursor: 'pointer',
                    }}>
                      Empezar →
                    </button>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  )
}

function Testimonials() {
  return (
    <section style={{ padding: 'clamp(60px,8vw,96px) clamp(16px,4vw,40px)', background: BG }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
            Lo que dicen los salones
          </div>
          <h2 style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 'clamp(26px,4.5vw,40px)', color: DARK, letterSpacing: -1, margin: 0 }}>
            Resultados reales
          </h2>
        </div>

        <div className="testimonials-grid">
          {TESTIMONIALS.map(t => (
            <div key={t.nombre} style={{
              background: 'white', borderRadius: 18,
              border: `1px solid ${BORDER}`,
              padding: '26px 24px',
              display: 'flex', flexDirection: 'column', gap: 18,
            }}>
              {/* Stars */}
              <div style={{ display: 'flex', gap: 3 }}>
                {[1,2,3,4,5].map(i => (
                  <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                ))}
              </div>
              {/* Quote */}
              <p style={{ fontSize: 14, color: DARK, lineHeight: 1.7, margin: 0, flex: 1 }}>
                "{t.texto}"
              </p>
              {/* Author */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `${GREEN}18`, color: GREEN,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Outfit', fontWeight: 900, fontSize: 13, flexShrink: 0,
                }}>
                  {t.nombre.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>{t.nombre}</div>
                  <div style={{ fontSize: 11, color: TEXT2 }}>{t.negocio}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCTA({ onCTA }) {
  return (
    <section style={{
      padding: 'clamp(64px,8vw,96px) clamp(16px,4vw,40px)',
      background: DARK, textAlign: 'center',
    }}>
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 'clamp(28px,5vw,44px)', color: '#fff', letterSpacing: -1, margin: '0 0 16px' }}>
          Empieza hoy.{' '}
          <span style={{ color: GREEN }}>15 días gratis.</span>
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, lineHeight: 1.7, marginBottom: 36 }}>
          Sin tarjeta de crédito. Sin contratos. Si no te convence dentro de los 15 días, no te cobramos nada.
        </p>
        <button onClick={onCTA} style={{
          padding: '15px 38px', borderRadius: 13, fontSize: 15, fontWeight: 800,
          background: GREEN, color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: `0 8px 26px ${GREEN}45`, fontFamily: 'Outfit',
          display: 'inline-flex', alignItems: 'center', gap: 9,
          transition: 'transform 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = ''}
        >
          Crear mi cuenta gratis <IArrow s={16} c="#fff" />
        </button>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 18 }}>
          ¿Ya tienes cuenta?{' '}
          <a href="/salon" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'underline' }}>
            Iniciar sesión
          </a>
        </p>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer style={{ padding: '24px clamp(16px,4vw,40px)', background: '#111', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7, background: DARK,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <span style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 11, color: GREEN }}>SP</span>
          </div>
          <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 13, color: '#fff' }}>
            SALÓN <span style={{ color: GREEN }}>PRO</span>
          </span>
        </div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
          © 2026 Salón Pro · Gestión profesional para salones de belleza en Colombia
        </p>
        <div style={{ display: 'flex', gap: 16 }}>
          {[['Ingresar', '/salon'], ['Registrarse', '/salon-registro']].map(([t, h]) => (
            <a key={t} href={h} style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>{t}</a>
          ))}
        </div>
      </div>
    </footer>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const handleCTA = () => { window.location.href = '/salon-registro' }

  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', background: BG }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${BG}; }

        /* Features: 4 col desktop → 2 col tablet → 1 col mobile */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }
        @media (max-width: 900px) {
          .features-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 520px) {
          .features-grid { grid-template-columns: 1fr; }
        }

        /* Stats: 4 col → 2 col on mobile */
        @media (max-width: 520px) {
          .stat-item:nth-child(n+3) { border-top: 1px solid rgba(0,0,0,0.06); }
        }

        /* Testimonials: 3 col → 1 col */
        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 780px) {
          .testimonials-grid { grid-template-columns: 1fr; }
        }

        /* Stats 4→2 col */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 520px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }

        /* Smooth scroll */
        html { scroll-behavior: smooth; }
      `}</style>

      <Nav onCTA={handleCTA} />
      <Hero onCTA={handleCTA} />
      <Stats />
      <Features />
      <Pricing onCTA={handleCTA} />
      <Testimonials />
      <FinalCTA onCTA={handleCTA} />
      <Footer />
    </div>
  )
}
