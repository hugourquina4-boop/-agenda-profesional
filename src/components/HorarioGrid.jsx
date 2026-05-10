import { useState, useEffect, useRef, Fragment, useMemo } from 'react'

// ── Helpers (exported for use in parent components) ──────────────────────────

export function generateSlots(startHour = 7, endHour = 22, slotMinutes = 30) {
  const slots = []
  const count = ((endHour - startHour) * 60) / slotMinutes
  for (let i = 0; i < count; i++) {
    const mins = startHour * 60 + i * slotMinutes
    slots.push(`${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`)
  }
  return slots
}

export function rangeToSlots(inicio, fin, slotMinutes = 30) {
  if (!inicio || !fin) return []
  const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const slots = []
  for (let m = toMins(inicio); m < toMins(fin); m += slotMinutes) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  }
  return slots
}

export function slotsToRange(activeSlots, slotMinutes = 30) {
  if (!activeSlots?.length) return { hora_inicio: '09:00', hora_fin: '19:00' }
  const sorted = [...activeSlots].sort()
  const last = sorted[sorted.length - 1]
  const [lh, lm] = last.split(':').map(Number)
  const endMins = lh * 60 + lm + slotMinutes
  return {
    hora_inicio: sorted[0],
    hora_fin: `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`,
  }
}

export function slotsToFranjas(activeSlots, slotMinutes = 30) {
  if (!activeSlots?.length) return []
  const sorted = [...activeSlots].sort()
  const toMins = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m }
  const fromMins = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const franjas = []
  let start = sorted[0], prev = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    if (toMins(sorted[i]) - toMins(prev) > slotMinutes) {
      franjas.push({ inicio: start, fin: fromMins(toMins(prev) + slotMinutes) })
      start = sorted[i]
    }
    prev = sorted[i]
  }
  franjas.push({ inicio: start, fin: fromMins(toMins(prev) + slotMinutes) })
  return franjas
}

export function franjasToSlots(franjas, slotMinutes = 30) {
  return [...new Set(franjas.flatMap(f => rangeToSlots(f.inicio, f.fin, slotMinutes)))]
}

// ── Component ────────────────────────────────────────────────────────────────

export default function HorarioGrid({
  value = [],
  onChange,
  slotMinutes = 30,
  startHour = 7,
  endHour = 22,
  accentColor = '#f43f5e',
  readOnly = false,
}) {
  const allSlots = useMemo(
    () => generateSlots(startHour, endHour, slotMinutes),
    [startHour, endHour, slotMinutes]
  )

  const [active, setActive] = useState(() => new Set(value))

  // Sync from props when value changes externally (not during drag)
  const dragging = useRef(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!dragging.current) setActive(new Set(value))
  }, [[...value].sort().join(',')])

  const drag    = useRef({ on: false, mode: true })
  const pending = useRef(new Set())
  const containerRef = useRef(null)

  function applySlot(slot) {
    if (drag.current.mode) pending.current.add(slot)
    else pending.current.delete(slot)
  }

  function handlePointerDown(e, slot) {
    if (readOnly) return
    e.preventDefault()
    dragging.current  = true
    drag.current.on   = true
    drag.current.mode = !active.has(slot)
    pending.current   = new Set(active)
    applySlot(slot)
    setActive(new Set(pending.current))
    containerRef.current?.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e) {
    if (!drag.current.on) return
    const el   = document.elementFromPoint(e.clientX, e.clientY)
    const slot = el?.dataset?.slotId
    if (!slot) return
    const was    = pending.current.has(slot)
    const should = drag.current.mode
    if (was !== should) {
      applySlot(slot)
      setActive(new Set(pending.current))
    }
  }

  function handlePointerUp() {
    if (!drag.current.on) return
    drag.current.on = false
    dragging.current = false
    onChange?.(Array.from(pending.current).sort())
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        touchAction: 'none',
        userSelect: 'none',
        display: 'grid',
        gridTemplateColumns: '38px 1fr',
        rowGap: 1,
      }}
    >
      {allSlots.map(slot => {
        const isHour   = slot.endsWith(':00')
        const isActive = active.has(slot)
        return (
          <Fragment key={slot}>
            {/* Time label — visible only on hour boundaries */}
            <div style={{
              height: 26,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              paddingRight: 8,
              fontSize: 10, fontWeight: 600, color: 'var(--text-3)',
              pointerEvents: 'none',
              opacity: isHour ? 1 : 0,
            }}>
              {slot}
            </div>

            {/* Slot cell */}
            <div
              data-slot-id={slot}
              onPointerDown={e => handlePointerDown(e, slot)}
              style={{
                height: 26,
                borderRadius: 6,
                marginLeft: 2,
                background: isActive ? accentColor : 'rgba(128,128,128,0.07)',
                border: isActive
                  ? 'none'
                  : isHour
                    ? '1px solid rgba(128,128,128,0.18)'
                    : '1px solid transparent',
                cursor: readOnly ? 'default' : 'pointer',
                transition: 'background 0.12s, box-shadow 0.12s',
                boxShadow: isActive ? `0 1px 5px ${accentColor}40` : 'none',
              }}
            />
          </Fragment>
        )
      })}
    </div>
  )
}
