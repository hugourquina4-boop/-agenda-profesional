import { useState } from 'react'

const GREEN  = '#16a34a'
const DARK   = '#1a1a1a'
const BG     = '#FAFAF8'
const TEXT2  = '#52525b'
const BORDER = 'rgba(0,0,0,0.08)'
const INDIGO = '#6366f1'

const TRIAL_URL = '/salon-registro'

function ICheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function IArrow() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  )
}

const FEATURES = [
  'Agenda visual por profesional con drag & drop',
  'Portal de reservas online — tus clientes agendan solos',
  'WhatsApp automático: confirmaciones y recordatorios',
  'Historial completo de clientes con fotos y notas',
  'Caja, cobros y cierre del día en PDF',
  'Comisiones automáticas y planilla de profesionales',
  'Inventario y órdenes de compra a proveedores',
  'Informe gerencial P&L — ve tus ganancias reales',
  'Programa de puntos de fidelización',
  'Multi-sede desde un solo panel',
]

const PLANES = [
  { key: 'starter', label: 'Starter', price: '$60.000', color: INDIGO,  desc: '1 profesional — para empezar', features: ['Agenda y citas', 'Portal de reservas', 'Gestión de clientes', 'Caja y cobros', 'Pagos en línea'] },
  { key: 'pro',     label: 'Pro',     price: '$100.000', color: GREEN,   desc: 'Hasta 5 profesionales', popular: true, features: ['Todo lo de Starter', 'WhatsApp automático', 'Analytics P&L', 'Comisiones y planilla', 'Inventario y proveedores', 'Programa de puntos'] },
  { key: 'ultra',   label: 'Ultra',   price: '$140.000', color: '#0891b2', desc: 'Equipo grande, múltiples sedes', features: ['Todo lo de Pro', 'Profesionales ilimitados', 'Multi-sede', 'Bóveda de contraseñas', 'Soporte prioritario'] },
]

const FAQ = [
  { q: '¿Necesito instalar algo?', a: 'No. Funciona directamente desde el navegador de tu celular o computador. También puedes instalarlo como app en la pantalla de inicio.' },
  { q: '¿Cómo funciona el trial de 15 días?', a: 'Creas tu cuenta, configuras tu negocio y usas todas las funciones sin restricciones. No pedimos tarjeta de crédito.' },
  { q: '¿Y si quiero cancelar?', a: 'Es mes a mes. Cancelas cuando quieras sin penalidad ni trámites.' },
  { q: '¿El WhatsApp automático requiere algo especial?', a: 'Solo ingresas el número de WhatsApp del negocio en la configuración. El sistema manda mensajes directamente a tus clientes.' },
  { q: '¿Puedo importar mis clientes actuales?', a: 'Sí, con un archivo CSV sencillo. En menos de 5 minutos tienes todos tus clientes cargados.' },
  { q: '¿Cómo pago la suscripción?', a: 'Por Nequi, Bancolombia, PSE o tarjeta. En pesos colombianos, sin comisiones adicionales.' },
]

export default function PropuestaPage() {
  const [openFaq, setOpenFaq] = useState(null)

  const goTrial = () => { window.location.href = TRIAL_URL }

  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', background: BG, minHeight: '100dvh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${BG}; }
        .prop-plan-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 740px) {
          .prop-plan-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        background: DARK, padding: '16px clamp(16px,4vw,40px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, background: '#252525',
            border: `1px solid ${GREEN}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 13, color: GREEN }}>SP</span>
          </div>
          <span style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 17, color: '#fff', letterSpacing: -0.5 }}>
            SALÓN <span style={{ color: GREEN }}>PRO</span>
          </span>
        </div>
        <button onClick={goTrial} style={{
          padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 800,
          background: GREEN, color: '#fff', border: 'none', cursor: 'pointer',
          fontFamily: 'Outfit', boxShadow: `0 4px 14px ${GREEN}40`,
        }}>
          Probar gratis
        </button>
      </header>

      {/* ── Hero ── */}
      <section style={{
        padding: 'clamp(52px,8vw,80px) clamp(16px,4vw,40px)',
        textAlign: 'center',
        background: `radial-gradient(ellipse 70% 40% at 50% 0%, ${GREEN}12 0%, transparent 70%), ${BG}`,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '5px 14px', borderRadius: 20,
          background: `${GREEN}14`, border: `1px solid ${GREEN}28`,
          color: GREEN, fontSize: 12, fontWeight: 700, marginBottom: 24, letterSpacing: 0.3,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, display: 'inline-block' }} />
          15 días gratis · Sin tarjeta de crédito
        </div>

        <h1 style={{
          fontFamily: 'Outfit', fontWeight: 900,
          fontSize: 'clamp(30px, 6vw, 54px)',
          color: DARK, lineHeight: 1.1, letterSpacing: -1.5,
          maxWidth: 620, margin: '0 auto 20px',
        }}>
          El sistema de gestión para tu<br />
          <span style={{ color: GREEN }}>peluquería o salón.</span>
        </h1>

        <p style={{
          fontSize: 'clamp(14px, 2vw, 16px)', color: TEXT2,
          maxWidth: 480, lineHeight: 1.75, margin: '0 auto 36px',
        }}>
          Agenda por profesional, reservas online, WhatsApp automático, caja, comisiones y analytics — todo desde el celular, en pesos colombianos.
        </p>

        <button onClick={goTrial} style={{
          padding: '14px 34px', borderRadius: 12, fontSize: 15, fontWeight: 800,
          background: GREEN, color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: `0 6px 22px ${GREEN}40`, fontFamily: 'Outfit',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          Empezar mi trial gratis <IArrow />
        </button>

        <p style={{ fontSize: 12, color: TEXT2, marginTop: 14, opacity: 0.7 }}>
          Sin instalar nada · Configuras en 30 minutos
        </p>
      </section>

      {/* ── Funcionalidades ── */}
      <section style={{ padding: 'clamp(40px,6vw,64px) clamp(16px,4vw,40px)', background: 'white', borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center', marginBottom: 28 }}>
            Incluido en todos los planes
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px 24px' }}>
            {FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  background: `${GREEN}14`, border: `1px solid ${GREEN}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                }}>
                  <ICheck />
                </div>
                <span style={{ fontSize: 13, color: DARK, lineHeight: 1.5 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Planes ── */}
      <section style={{ padding: 'clamp(48px,7vw,72px) clamp(16px,4vw,40px)', background: BG }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: 'Outfit', fontWeight: 900,
            fontSize: 'clamp(24px,4vw,36px)', color: DARK, letterSpacing: -1,
            textAlign: 'center', marginBottom: 8,
          }}>
            Elige tu plan
          </h2>
          <p style={{ textAlign: 'center', fontSize: 13, color: TEXT2, marginBottom: 36 }}>
            En pesos colombianos · Sin contratos · Cancela cuando quieras
          </p>

          <div className="prop-plan-grid">
            {PLANES.map(p => (
              <div key={p.key} style={{
                borderRadius: 20, padding: '28px 22px',
                background: p.popular ? DARK : 'white',
                border: p.popular ? `2px solid ${GREEN}` : `1px solid ${BORDER}`,
                boxShadow: p.popular ? `0 12px 36px ${GREEN}22` : '0 2px 12px rgba(0,0,0,0.05)',
                display: 'flex', flexDirection: 'column', gap: 0,
                position: 'relative',
              }}>
                {p.popular && (
                  <div style={{
                    position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                    background: GREEN, color: '#fff',
                    fontSize: 9, fontWeight: 800, padding: '3px 14px',
                    borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
                    letterSpacing: 0.8,
                  }}>
                    MÁS POPULAR
                  </div>
                )}
                <div style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 16, color: p.color, marginBottom: 4, marginTop: p.popular ? 12 : 0 }}>
                  {p.label}
                </div>
                <div style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 28, color: p.popular ? '#fff' : DARK, letterSpacing: -1, lineHeight: 1 }}>
                  {p.price}
                </div>
                <div style={{ fontSize: 11, color: p.popular ? 'rgba(255,255,255,0.45)' : TEXT2, marginTop: 4, marginBottom: 20 }}>
                  /mes · IVA no incl. · {p.desc}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 24, flex: 1 }}>
                  {p.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                        background: p.popular ? `${GREEN}30` : `${GREEN}14`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <ICheck />
                      </div>
                      <span style={{ fontSize: 12, color: p.popular ? 'rgba(255,255,255,0.8)' : DARK }}>{f}</span>
                    </div>
                  ))}
                </div>
                <button onClick={goTrial} style={{
                  width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
                  background: p.popular ? GREEN : `${p.color}14`,
                  color: p.popular ? '#fff' : p.color,
                  fontFamily: 'Outfit', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  boxShadow: p.popular ? `0 4px 14px ${GREEN}40` : 'none',
                }}>
                  Probar 15 días gratis
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section style={{ padding: 'clamp(40px,6vw,64px) clamp(16px,4vw,40px)', background: 'white', borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: 'Outfit', fontWeight: 900,
            fontSize: 'clamp(22px,3.5vw,32px)', color: DARK, letterSpacing: -0.8,
            textAlign: 'center', marginBottom: 36,
          }}>
            Listo en 30 minutos
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { n: '1', t: 'Crea tu cuenta', d: 'Regístrate con tu email. Sin instalar nada, sin tarjeta.' },
              { n: '2', t: 'Configura tu negocio', d: 'Agrega tu equipo, servicios y horarios en 5 pasos guiados.' },
              { n: '3', t: 'Comparte tu link de reservas', d: 'Tus clientes agendan solos. El sistema confirma y manda recordatorios por WhatsApp.' },
            ].map((s, i, arr) => (
              <div key={s.n} style={{ display: 'flex', gap: 16, paddingBottom: i < arr.length - 1 ? 24 : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: GREEN, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Outfit', fontWeight: 900, fontSize: 14,
                  }}>
                    {s.n}
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ width: 1, flex: 1, background: `${GREEN}25`, marginTop: 6 }} />
                  )}
                </div>
                <div style={{ paddingTop: 6, paddingBottom: i < arr.length - 1 ? 8 : 0 }}>
                  <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 15, color: DARK, marginBottom: 4 }}>{s.t}</div>
                  <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.6 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: 'clamp(40px,6vw,64px) clamp(16px,4vw,40px)', background: BG, borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: 'Outfit', fontWeight: 900,
            fontSize: 'clamp(22px,3.5vw,32px)', color: DARK, letterSpacing: -0.8,
            textAlign: 'center', marginBottom: 32,
          }}>
            Preguntas frecuentes
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FAQ.map((f, i) => (
              <div key={i} style={{
                background: 'white', borderRadius: 12,
                border: `1px solid ${openFaq === i ? GREEN + '40' : BORDER}`,
                overflow: 'hidden', transition: 'border-color 0.2s',
              }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '14px 18px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: DARK, lineHeight: 1.4 }}>{f.q}</span>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: `${GREEN}14`, color: GREEN,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, transition: 'transform 0.2s',
                    transform: openFaq === i ? 'rotate(45deg)' : 'none',
                  }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 18px 16px', fontSize: 13, color: TEXT2, lineHeight: 1.7 }}>
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section style={{
        padding: 'clamp(52px,7vw,72px) clamp(16px,4vw,40px)',
        background: DARK, textAlign: 'center',
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: 'Outfit', fontWeight: 900,
            fontSize: 'clamp(26px,4.5vw,38px)', color: '#fff', letterSpacing: -1, marginBottom: 14,
          }}>
            Empieza hoy.{' '}
            <span style={{ color: GREEN }}>15 días gratis.</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
            Sin tarjeta · Sin contratos · Cancela cuando quieras.
          </p>
          <button onClick={goTrial} style={{
            padding: '15px 38px', borderRadius: 12, fontSize: 15, fontWeight: 800,
            background: GREEN, color: '#fff', border: 'none', cursor: 'pointer',
            boxShadow: `0 8px 26px ${GREEN}45`, fontFamily: 'Outfit',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            Crear mi cuenta gratis <IArrow />
          </button>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 16 }}>
            ¿Ya tienes cuenta?{' '}
            <a href="/salon" style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'underline' }}>Iniciar sesión</a>
          </p>
        </div>
      </section>

      <footer style={{ padding: '20px clamp(16px,4vw,40px)', background: '#111', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', margin: 0 }}>
          © 2026 Salón Pro · Gestión profesional para salones en Colombia
        </p>
      </footer>
    </div>
  )
}
