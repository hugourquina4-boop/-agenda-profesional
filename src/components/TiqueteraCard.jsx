/**
 * TiqueteraCard — Punch card de lealtad visual.
 * Props:
 *   progreso   {number}  visitas en el ciclo actual (0..meta)
 *   meta       {number}  visitas necesarias para el premio
 *   premio     {string}  descripción del premio
 *   canjeados  {number}  premios ya obtenidos
 *   listo      {boolean} ciclo completo, listo para canjear
 *   color      {string}  color primario del negocio
 *   compact    {boolean} versión reducida (portal/banner)
 *   onCanjear  {fn}      callback para marcar canje (solo owner)
 *   canjeando  {boolean} estado de carga del canje
 */
export default function TiqueteraCard({
  progreso = 0,
  meta = 10,
  premio = 'Servicio gratis',
  canjeados = 0,
  listo = false,
  color = '#f43f5e',
  compact = false,
  onCanjear,
  canjeando = false,
}) {
  const pct    = meta > 0 ? Math.min(100, Math.round(progreso / meta * 100)) : 0
  const faltan = Math.max(0, meta - progreso)

  // Paleta por pct
  const barColor = listo ? '#22c55e' : pct >= 70 ? color : pct >= 40 ? color : color

  // Slots para el grid de sellos
  const slots = Array.from({ length: meta }, (_, i) => i < progreso)

  if (compact) {
    return (
      <div style={{
        padding: '14px 16px', borderRadius: 16,
        background: listo
          ? 'linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.05))'
          : `linear-gradient(135deg,${color}14,${color}04)`,
        border: `1px solid ${listo ? 'rgba(34,197,94,0.4)' : `${color}30`}`,
        boxShadow: listo ? '0 4px 20px rgba(34,197,94,0.15)' : `0 4px 20px ${color}12`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: listo ? 'rgba(34,197,94,0.2)' : `${color}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            {listo ? '🎁' : '✂️'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', letterSpacing: 0.3 }}>
              {listo ? '¡Premio listo!' : 'Tu tiquetera'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
              {listo
                ? `Reclama: ${premio}`
                : `${faltan} ${faltan === 1 ? 'visita' : 'visitas'} para ${premio}`
              }
            </div>
          </div>
          <div style={{
            fontSize: 13, fontWeight: 900,
            color: listo ? '#22c55e' : color,
          }}>
            {progreso}/{meta}
          </div>
        </div>
        <StampRow slots={slots} color={listo ? '#22c55e' : color} compact />
      </div>
    )
  }

  return (
    <div style={{
      borderRadius: 20,
      background: listo
        ? 'linear-gradient(135deg,rgba(34,197,94,0.12),rgba(34,197,94,0.04))'
        : `linear-gradient(135deg,${color}10,${color}04)`,
      border: `1.5px solid ${listo ? 'rgba(34,197,94,0.35)' : `${color}28`}`,
      boxShadow: listo
        ? '0 8px 32px rgba(34,197,94,0.18)'
        : `0 8px 32px ${color}14`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 20px 14px',
        borderBottom: `1px solid ${listo ? 'rgba(34,197,94,0.15)' : `${color}15`}`,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: listo ? 'rgba(34,197,94,0.18)' : `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24,
          boxShadow: listo ? '0 4px 16px rgba(34,197,94,0.2)' : `0 4px 16px ${color}20`,
        }}>
          {listo ? '🎁' : '✂️'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 16,
            color: 'var(--text)', marginBottom: 3,
          }}>
            {listo ? '¡Premio desbloqueado!' : 'Tiquetera de visitas'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
            {listo
              ? `Reclama tu premio: ${premio}`
              : `Completa ${meta} visitas y gana: ${premio}`
            }
          </div>
        </div>
        {canjeados > 0 && (
          <div style={{
            padding: '4px 10px', borderRadius: 20, flexShrink: 0,
            background: 'rgba(99,102,241,0.12)', color: '#818cf8',
            fontSize: 11, fontWeight: 700,
          }}>
            {canjeados} {canjeados === 1 ? 'premio' : 'premios'}
          </div>
        )}
      </div>

      {/* Grid de sellos */}
      <div style={{ padding: '20px 20px 16px' }}>
        <StampRow slots={slots} color={listo ? '#22c55e' : color} />

        {/* Barra de progreso */}
        <div style={{ marginTop: 16 }}>
          <div style={{
            height: 8, borderRadius: 99, background: 'var(--border)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${pct}%`,
              background: listo
                ? 'linear-gradient(90deg,#22c55e,#4ade80)'
                : `linear-gradient(90deg,${color},${color}bb)`,
              transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)',
              boxShadow: listo ? '0 2px 8px rgba(34,197,94,0.4)' : `0 2px 8px ${color}50`,
            }} />
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 8,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>
              {progreso} de {meta} visitas
            </span>
            <span style={{
              fontSize: 13, fontWeight: 900,
              color: listo ? '#22c55e' : color,
            }}>
              {listo ? '¡Listo! 🎉' : `${faltan} ${faltan === 1 ? 'visita' : 'visitas'} más`}
            </span>
          </div>
        </div>

        {/* Botón canjear (solo para owner) */}
        {listo && onCanjear && (
          <button
            onClick={onCanjear}
            disabled={canjeando}
            style={{
              marginTop: 16, width: '100%', padding: '13px',
              borderRadius: 14, border: 'none', cursor: canjeando ? 'default' : 'pointer',
              background: 'linear-gradient(135deg,#22c55e,#16a34a)',
              color: '#fff', fontWeight: 800, fontSize: 14,
              opacity: canjeando ? 0.7 : 1,
              boxShadow: '0 4px 16px rgba(34,197,94,0.35)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            {canjeando ? 'Registrando…' : '🎁 Marcar premio como canjeado'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Subcomponente: grid de sellos ─────────────────────────────── */
function StampRow({ slots, color, compact = false }) {
  const size   = compact ? 22 : 38
  const radius = compact ? 7  : 11
  const gap    = compact ? 4  : 6

  // Máximo 10 por fila; si hay más, wrap
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap,
      justifyContent: slots.length <= 10 ? 'space-between' : 'flex-start',
    }}>
      {slots.map((filled, i) => {
        const isLast = i === slots.length - 1
        if (isLast && !compact) {
          // Último slot siempre es el trofeo
          return (
            <div key={i} style={{
              width: size, height: size, borderRadius: radius, flexShrink: 0,
              background: filled
                ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                : 'var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: compact ? 11 : 18,
              boxShadow: filled ? '0 4px 12px rgba(245,158,11,0.45)' : 'none',
              transition: 'all 0.3s',
            }}>
              🏆
            </div>
          )
        }
        return (
          <div key={i} style={{
            width: size, height: size, borderRadius: radius, flexShrink: 0,
            background: filled ? color : 'var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: filled ? `0 3px 10px ${color}45` : 'none',
            transition: 'all 0.3s',
            position: 'relative',
          }}>
            {filled && (
              <svg width={compact ? 10 : 16} height={compact ? 10 : 16}
                viewBox="0 0 24 24" fill="none"
                stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
            {!filled && !compact && (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', opacity: 0.5 }}>
                {i + 1}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
