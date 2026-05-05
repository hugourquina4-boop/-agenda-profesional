import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

const PERIODOS = [
  { key: 'hoy',   label: 'Hoy',       dias: 0 },
  { key: 'd7',    label: '7 días',    dias: 7 },
  { key: 'd30',   label: '30 días',   dias: 30 },
  { key: 'mes',   label: 'Este mes',  dias: -1 },
]

function fmt(n) {
  return Number(n || 0).toLocaleString('es-CO')
}
function hhmm(d) {
  return new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}
function fechaCorta(d) {
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

export default function Ingresos() {
  const { tenant }         = useTenant()
  const [periodo, setPeriodo]   = useState('d30')
  const [citas,   setCitas]     = useState([])
  const [loading, setLoading]   = useState(true)

  const col = tenant?.color_primario || '#3b82f6'

  useEffect(() => { if (tenant?.id) cargar() }, [tenant, periodo])

  async function cargar() {
    setLoading(true)
    const { desde } = getRango(periodo)
    const { data } = await supabase
      .from('citas')
      .select(`id, fecha_inicio, precio_cobrado, estado,
               cliente:clientes_agenda(nombre),
               profesional:profesionales(id, nombre, color),
               servicio:servicios(nombre)`)
      .eq('tenant_id', tenant.id)
      .eq('estado', 'completada')
      .gte('fecha_inicio', desde)
      .order('fecha_inicio', { ascending: false })
    setCitas(data || [])
    setLoading(false)
  }

  // ── Calcular métricas ────────────────────────────────────────────────────
  const total       = citas.reduce((s, c) => s + (Number(c.precio_cobrado) || 0), 0)
  const count       = citas.length
  const ticketProm  = count ? Math.round(total / count) : 0

  // Agrupados por profesional
  const porProf = Object.values(
    citas.reduce((acc, c) => {
      const id  = c.profesional?.id || 'otros'
      const nom = c.profesional?.nombre || 'Sin asignar'
      const colP= c.profesional?.color  || '#94a3b8'
      if (!acc[id]) acc[id] = { id, nombre: nom, color: colP, total: 0, count: 0 }
      acc[id].total += Number(c.precio_cobrado) || 0
      acc[id].count += 1
      return acc
    }, {})
  ).sort((a, b) => b.total - a.total)

  // Agrupados por servicio
  const porSvc = Object.values(
    citas.reduce((acc, c) => {
      const nom = c.servicio?.nombre || 'Otro'
      if (!acc[nom]) acc[nom] = { nombre: nom, total: 0, count: 0 }
      acc[nom].total += Number(c.precio_cobrado) || 0
      acc[nom].count += 1
      return acc
    }, {})
  ).sort((a, b) => b.total - a.total).slice(0, 6)

  const maxProf = porProf[0]?.total || 1
  const maxSvc  = porSvc[0]?.total  || 1

  const per = PERIODOS.find(p => p.key === periodo) || PERIODOS[2]

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ingresos</h1>
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
          {PERIODOS.map(p => (
            <button key={p.key} onClick={() => setPeriodo(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodo === p.key
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: col, borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <KpiCard label="Total" value={`$${fmt(total)}`} sub="COP" col={col} main />
            <KpiCard label="Citas" value={count} sub="completadas" col={col} />
            <KpiCard label="Ticket" value={`$${fmt(ticketProm)}`} sub="promedio" col={col} />
          </div>

          {/* Por profesional */}
          {porProf.length > 0 && (
            <Section title="Por profesional">
              <div className="space-y-3">
                {porProf.map(p => (
                  <div key={p.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}aa)` }}>
                      {p.nombre[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.nombre}</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white ml-2 flex-shrink-0">
                          ${fmt(p.total)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.round((p.total / maxProf) * 100)}%`, backgroundColor: p.color }} />
                      </div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{p.count} citas</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Por servicio */}
          {porSvc.length > 0 && (
            <Section title="Por servicio">
              <div className="space-y-2.5">
                {porSvc.map((s, i) => (
                  <div key={s.nombre} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-300 dark:text-slate-600 w-4 flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700 dark:text-slate-300 truncate">{s.nombre}</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white ml-2 flex-shrink-0">
                          ${fmt(s.total)}
                        </span>
                      </div>
                      <div className="w-full h-1 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.round((s.total / maxSvc) * 100)}%`, backgroundColor: col }} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-slate-500 w-10 text-right flex-shrink-0">
                      {s.count}x
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Lista reciente */}
          {citas.length > 0 && (
            <Section title={`Citas completadas — ${citas.length}`}>
              <div className="space-y-2">
                {citas.slice(0, 15).map(c => (
                  <div key={c.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 dark:border-slate-800 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: c.profesional?.color || col }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.cliente?.nombre}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        {c.servicio?.nombre} · {c.profesional?.nombre}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {c.precio_cobrado > 0 ? `$${fmt(c.precio_cobrado)}` : '—'}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        {fechaCorta(c.fecha_inicio)} {hhmm(c.fecha_inicio)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {citas.length === 0 && (
            <div className="text-center py-20">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-gray-400 dark:text-slate-500 text-sm">
                Sin citas completadas en {per.label.toLowerCase()}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, col, main }) {
  return (
    <div className={`rounded-2xl border p-4 ${main ? 'border-transparent' : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}
      style={main ? { background: `linear-gradient(135deg, ${col}18, ${col}08)`, borderColor: `${col}30` } : undefined}>
      <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 leading-none ${main ? '' : 'text-gray-900 dark:text-white'}`}
        style={main ? { color: col } : undefined}>
        {value}
      </p>
      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 mb-4">
      <h2 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  )
}

function getRango(periodo) {
  const ahora = new Date()
  if (periodo === 'hoy') {
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
    return { desde: hoy.toISOString() }
  }
  if (periodo === 'mes') {
    const ini = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    return { desde: ini.toISOString() }
  }
  const dias = PERIODOS.find(p => p.key === periodo)?.dias || 30
  const ini  = new Date(ahora.getTime() - dias * 86400000)
  return { desde: ini.toISOString() }
}
