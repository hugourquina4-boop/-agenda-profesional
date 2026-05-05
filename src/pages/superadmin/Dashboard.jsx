import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const PRECIO_PLAN = { free: 0, basico: 49000, profesional: 49000, pro: 99000, premium: 99000, enterprise: 199000 }
const PLAN_CFG = {
  free:        { label:'Free',       color:'#94a3b8', bg:'rgba(148,163,184,0.1)'  },
  basico:      { label:'Básico',     color:'#3b82f6', bg:'rgba(59,130,246,0.1)'   },
  profesional: { label:'Profesional',color:'#3b82f6', bg:'rgba(59,130,246,0.1)'   },
  pro:         { label:'Pro',        color:'#8b5cf6', bg:'rgba(139,92,246,0.1)'   },
  premium:     { label:'Premium',    color:'#8b5cf6', bg:'rgba(139,92,246,0.1)'   },
  enterprise:  { label:'Enterprise', color:'#f59e0b', bg:'rgba(245,158,11,0.1)'   },
}
const ESTADO_COLOR = {
  activa:    'text-emerald-600 dark:text-emerald-400',
  trial:     'text-blue-600 dark:text-blue-400',
  vencida:   'text-red-500',
  suspendida:'text-yellow-600',
  cancelada: 'text-gray-400',
}

function fmtCOP(n) {
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n/1_000)}K`
  return `$${n}`
}

function KPI({ label, value, sub, color = 'text-gray-900 dark:text-white', accent }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-800">
      {accent && <div className="w-7 h-1 rounded-full mb-3" style={{ background: accent }} />}
      <p className="text-gray-400 dark:text-slate-500 text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-black mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export default function SuperadminDashboard() {
  const [negocios, setNegocios] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.rpc('get_superadmin_negocios')
    setNegocios(data || [])
    setLoading(false)
  }

  const activos   = negocios.filter(n => n.activo)
  const enTrial   = negocios.filter(n => n.suscripcion_estado === 'trial')
  const conAlerta = negocios.filter(n => n.alerta_pago)
  const citas30d  = negocios.reduce((s, n) => s + (Number(n.citas_30d) || 0), 0)

  // MRR: solo tenants activos con suscripción activa
  const mrr = activos
    .filter(n => n.suscripcion_estado === 'activa')
    .reduce((s, n) => s + (PRECIO_PLAN[n.plan] || 0), 0)

  // Distribución por plan (activos)
  const porPlan = {}
  activos.forEach(n => {
    const p = n.plan || 'free'
    porPlan[p] = (porPlan[p] || 0) + 1
  })

  // Nuevos este mes
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0,0,0,0)
  const nuevosMes = negocios.filter(n => n.registrado_en && new Date(n.registrado_en) >= inicioMes).length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-400 dark:text-slate-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>
        <button onClick={cargar}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700
                     text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          Actualizar
        </button>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Negocios activos"  value={activos.length}    sub={`${negocios.length} registrados`}     accent="#3b82f6" />
        <KPI label="MRR estimado"      value={fmtCOP(mrr)}       sub="suscripciones activas"                accent="#22c55e" color="text-emerald-600 dark:text-emerald-400" />
        <KPI label="En trial"          value={enTrial.length}    sub={`${nuevosMes} nuevo${nuevosMes!==1?'s':''} este mes`} accent="#8b5cf6" color="text-blue-600 dark:text-blue-400" />
        <KPI label="Citas últimos 30d" value={citas30d}          sub="todos los negocios"                   accent="#f59e0b" />
      </div>

      {/* Alertas de pago */}
      {conAlerta.length > 0 && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-3">
            ⚠ {conAlerta.length} negocio{conAlerta.length!==1?'s':''} con alerta de pago
          </h2>
          <div className="space-y-2">
            {conAlerta.map(n => (
              <div key={n.id} className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{n.nombre}</span>
                  <span className="text-xs text-gray-400 dark:text-slate-500 ml-2">/{n.slug}</span>
                </div>
                <span className="text-xs text-red-500 dark:text-red-400 font-medium capitalize">
                  {n.suscripcion_estado || 'sin suscripción'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Distribución por plan */}
      {Object.keys(porPlan).length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5">
          <h2 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-4">
            Distribución por plan — negocios activos
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['free','basico','pro','enterprise'].map(plan => {
              const cfg = PLAN_CFG[plan] || PLAN_CFG.free
              const cnt = porPlan[plan] || 0
              const precio = PRECIO_PLAN[plan] || 0
              return (
                <div key={plan} style={{ background: cfg.bg, borderColor: cfg.color + '40' }}
                  className="rounded-xl border p-4">
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: cfg.color }}>
                    {cfg.label}
                  </p>
                  <p className="text-2xl font-black" style={{ color: cfg.color }}>{cnt}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                    {precio > 0 ? `${fmtCOP(precio)}/mes` : 'Gratis'}
                  </p>
                  {cnt > 0 && precio > 0 && (
                    <p className="text-xs font-semibold mt-1" style={{ color: cfg.color }}>
                      {fmtCOP(cnt * precio)}/mes
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabla de negocios */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Todos los negocios
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : negocios.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-slate-500 text-sm">
            Aún no hay negocios registrados
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800">
                  {['Negocio','Plan','Suscripción','Actividad 30d','Registrado'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800/60">
                {negocios.map(n => {
                  const planCfg = PLAN_CFG[n.plan] || PLAN_CFG.free
                  return (
                    <tr key={n.id}
                      className={`hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors ${n.alerta_pago ? 'bg-red-50/50 dark:bg-red-500/5' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: n.activo ? '#22c55e' : '#ef4444' }} />
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{n.nombre}</p>
                            <p className="text-gray-400 dark:text-slate-500 text-xs">
                              /{n.slug}
                              {n.alerta_pago && <span className="ml-1 text-red-500">⚠</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold"
                          style={{ background: planCfg.bg, color: planCfg.color }}>
                          {planCfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`font-medium capitalize text-xs ${ESTADO_COLOR[n.suscripcion_estado] || 'text-gray-400'}`}>
                          {n.suscripcion_estado || 'Sin plan'}
                        </span>
                        {n.susc_vencimiento && (
                          <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">
                            vence {new Date(n.susc_vencimiento).toLocaleDateString('es-CO')}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-800 dark:text-slate-200">{n.citas_30d || 0} citas</p>
                        {n.owner_nombre && (
                          <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">{n.owner_nombre}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-gray-400 dark:text-slate-500 text-xs">
                        {n.registrado_en ? new Date(n.registrado_en).toLocaleDateString('es-CO') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
