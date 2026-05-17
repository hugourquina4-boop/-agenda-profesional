import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

function Ico({ d, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const TEMPLATES = [
  {
    id: 'reactivar',
    titulo: 'Te extrañamos',
    emoji: '💐',
    texto: 'Hola {{nombre}}! Te extrañamos en {{negocio}} 🌸 Hace un tiempo no te vemos. ¿Qué tal si agendamos una cita esta semana? Escríbenos y te buscamos el mejor horario.',
  },
  {
    id: 'cumple',
    titulo: 'Cumpleaños',
    emoji: '🎂',
    texto: '¡Feliz cumpleaños {{nombre}}! 🎉 En {{negocio}} celebramos contigo. Por tu día especial tienes un descuento exclusivo en tu próxima visita. ¡Te esperamos!',
  },
  {
    id: 'promo',
    titulo: 'Promoción especial',
    emoji: '✨',
    texto: 'Hola {{nombre}}! En {{negocio}} tenemos una promoción especial esta semana. ¡Aprovecha nuestras ofertas y agenda tu cita ahora! 💅',
  },
  {
    id: 'recordatorio',
    titulo: 'Recordatorio de cita',
    emoji: '📅',
    texto: 'Hola {{nombre}}! Te recordamos que tienes una cita en {{negocio}}. Si necesitas cambiar el horario, escríbenos con tiempo. ¡Te esperamos! 😊',
  },
  {
    id: 'nuevo_servicio',
    titulo: 'Nuevo servicio',
    emoji: '🆕',
    texto: 'Hola {{nombre}}! 🎊 En {{negocio}} acabamos de lanzar un nuevo servicio que te va a encantar. ¡Contáctanos y cuéntanos qué te parece!',
  },
  {
    id: 'gracias',
    titulo: 'Gracias por tu visita',
    emoji: '🙏',
    texto: 'Hola {{nombre}}! Gracias por visitarnos en {{negocio}} 💖 Fue un placer atenderte. ¡Esperamos verte pronto! Si tienes un momento, nos encantaría conocer tu opinión.',
  },
]

const FILTROS = [
  { key: 'todos',       label: 'Todos'         },
  { key: 'mayorista',   label: 'Mayorista'     },
  { key: 'cumple',      label: 'Cumpleaños'    },
  { key: 'sin_visita',  label: 'Sin visita 30d' },
]

function formatFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function hoy() {
  return new Date().toISOString().split('T')[0]
}

function isCumpleProximo(fechaNac) {
  if (!fechaNac) return false
  const hoyDate = new Date()
  const [, mesNac, diaNac] = fechaNac.split('-').map(Number)
  const proxCumple = new Date(hoyDate.getFullYear(), mesNac - 1, diaNac)
  if (proxCumple < hoyDate) proxCumple.setFullYear(hoyDate.getFullYear() + 1)
  const diff = (proxCumple - hoyDate) / (1000 * 60 * 60 * 24)
  return diff <= 30
}

function sinVisita30d(ultimaVisita) {
  if (!ultimaVisita) return true
  const diff = (new Date() - new Date(ultimaVisita)) / (1000 * 60 * 60 * 24)
  return diff >= 30
}

export default function SalonMensajeria() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [clientes,   setClientes]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [filtro,     setFiltro]     = useState('todos')
  const [buscar,     setBuscar]     = useState('')
  const [sheetOpen,  setSheetOpen]  = useState(false)
  const [clienteSel, setClienteSel] = useState(null)
  const [enviados,   setEnviados]   = useState({})

  const cargar = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('clientes_agenda')
      .select('id, nombre, telefono, fecha_nacimiento, tipo_precio, notas')
      .eq('tenant_id', tenant.id)
      .eq('activo', true)
      .order('nombre')
    setClientes(data || [])
    setLoading(false)
  }, [tenant?.id])

  useEffect(() => { cargar() }, [cargar])

  const clientesFiltrados = clientes.filter(c => {
    const telefono = c.telefono?.replace(/\D/g, '') || ''
    if (!telefono) return false
    if (buscar && !c.nombre.toLowerCase().includes(buscar.toLowerCase())) return false
    if (filtro === 'mayorista')  return c.tipo_precio === 'mayorista'
    if (filtro === 'cumple')     return isCumpleProximo(c.fecha_nacimiento)
    if (filtro === 'sin_visita') return sinVisita30d(c.ultima_visita)
    return true
  })

  function abrirSheet(cliente) {
    setClienteSel(cliente)
    setSheetOpen(true)
  }

  function enviarWA(template) {
    if (!clienteSel) return
    const texto = template.texto
      .replace(/{{nombre}}/g, clienteSel.nombre.split(' ')[0])
      .replace(/{{negocio}}/g, tenant?.nombre || 'el salón')
    const tel = clienteSel.telefono.replace(/\D/g, '')
    const num = tel.startsWith('57') ? tel : `57${tel}`
    const url = `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
    window.open(url, '_blank', 'noopener')
    setEnviados(e => ({ ...e, [clienteSel.id]: true }))
    setSheetOpen(false)
  }

  return (
    <div className="sp-page" style={{ padding: '0 0 20px' }}>

      {/* Header */}
      <div style={{ padding: '20px 16px 12px' }}>
        <h2 style={{
          fontFamily: 'Outfit', fontWeight: 800, fontSize: 22,
          color: 'var(--text)', margin: 0, letterSpacing: '-0.3px',
        }}>
          Mensajería
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>
          Envía mensajes WA a tus clientes
        </p>
      </div>

      {/* Buscador */}
      <div style={{ padding: '0 16px 10px' }}>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-3)', pointerEvents: 'none',
          }}>
            <Ico d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" size={16} />
          </span>
          <input
            className="sp-input"
            placeholder="Buscar cliente…"
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
      </div>

      {/* Filtros */}
      <div style={{
        display: 'flex', gap: 8, padding: '0 16px 14px',
        overflowX: 'auto', overflowY: 'clip', scrollbarWidth: 'none',
      }}>
        {FILTROS.map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            style={{
              flexShrink: 0, padding: '7px 14px', borderRadius: 20,
              border: `1.5px solid ${filtro === f.key ? col : 'var(--border)'}`,
              background: filtro === f.key ? `${col}18` : 'var(--card)',
              color: filtro === f.key ? col : 'var(--text-2)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ padding: '0 16px 14px' }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? 's' : ''} con teléfono
          {Object.keys(enviados).length > 0 && (
            <span style={{ marginLeft: 8, color: col, fontWeight: 600 }}>
              · {Object.keys(enviados).length} mensaje{Object.keys(enviados).length !== 1 ? 's' : ''} enviado{Object.keys(enviados).length !== 1 ? 's' : ''}
            </span>
          )}
        </span>
      </div>

      {/* Lista clientes */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div className="sp-spinner" />
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '40px 24px',
          color: 'var(--text-3)', fontSize: 14,
        }}>
          {buscar ? 'No hay clientes que coincidan.' : 'No hay clientes con teléfono en este filtro.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 16px' }}>
          {clientesFiltrados.map(c => {
            const yaEnviado = enviados[c.id]
            return (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 14,
                background: 'var(--card)', border: '1px solid var(--border)',
                marginBottom: 6,
              }}>
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: `${col}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Outfit', fontWeight: 800, fontSize: 16, color: col,
                }}>
                  {c.nombre[0].toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700, fontSize: 14, color: 'var(--text)',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {c.nombre}
                    {c.tipo_precio === 'mayorista' && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 5px',
                        borderRadius: 4, background: `${col}20`, color: col,
                        letterSpacing: 0.5,
                      }}>MAYOR</span>
                    )}
                    {isCumpleProximo(c.fecha_nacimiento) && (
                      <span style={{ fontSize: 13 }}>🎂</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>
                    {c.telefono}
                  </div>
                </div>

                {/* Botón WA */}
                <button
                  onClick={() => abrirSheet(c)}
                  style={{
                    flexShrink: 0, width: 40, height: 40, borderRadius: 11,
                    background: yaEnviado ? 'rgba(34,197,94,0.12)' : `${col}18`,
                    border: `1.5px solid ${yaEnviado ? 'rgba(34,197,94,0.3)' : `${col}40`}`,
                    color: yaEnviado ? '#22c55e' : col,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  title="Enviar mensaje WA"
                >
                  <Ico d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" size={18} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Sheet plantillas */}
      {sheetOpen && clienteSel && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setSheetOpen(false)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title" style={{ marginBottom: 4 }}>
              Mensaje para {clienteSel.nombre.split(' ')[0]}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 16px' }}>
              Elige una plantilla para enviar por WhatsApp
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => enviarWA(t)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    padding: '14px 16px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                    background: 'rgba(128,128,128,0.06)',
                    border: '1px solid rgba(128,128,128,0.12)',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = col + '60'
                    e.currentTarget.style.background = col + '10'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(128,128,128,0.12)'
                    e.currentTarget.style.background = 'rgba(128,128,128,0.06)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{t.emoji}</span>
                    <span style={{
                      fontWeight: 700, fontSize: 14, color: 'var(--text)',
                    }}>
                      {t.titulo}
                    </span>
                  </div>
                  <p style={{
                    margin: 0, fontSize: 12, color: 'var(--text-3)',
                    lineHeight: 1.5,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {t.texto
                      .replace(/{{nombre}}/g, clienteSel.nombre.split(' ')[0])
                      .replace(/{{negocio}}/g, tenant?.nombre || 'el salón')}
                  </p>
                </button>
              ))}
            </div>

            <button
              onClick={() => setSheetOpen(false)}
              style={{
                marginTop: 14, width: '100%', padding: '13px',
                borderRadius: 14, background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-3)', fontWeight: 600, fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
