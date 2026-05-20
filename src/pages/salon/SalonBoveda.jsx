import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

// ── Web Crypto AES-GCM ────────────────────────────────────────────────────────
const SALT = new TextEncoder().encode('salon-pro-boveda-v1')

async function derivarClave(claveMaestra) {
  const raw = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(claveMaestra), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100_000, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function toB64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))) }
function fromB64(s)  { return Uint8Array.from(atob(s), c => c.charCodeAt(0)) }

async function cifrar(texto, clave) {
  const iv  = crypto.getRandomValues(new Uint8Array(12))
  const enc = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    clave,
    new TextEncoder().encode(texto)
  )
  return { datos: toB64(enc), iv: toB64(iv) }
}

async function descifrar(datosB64, ivB64, clave) {
  try {
    const buf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(ivB64) },
      clave,
      fromB64(datosB64)
    )
    return new TextDecoder().decode(buf)
  } catch {
    return null
  }
}

// ── Helpers UI ────────────────────────────────────────────────────────────────
function Ico({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

function Toast({ msg, color = '#22c55e' }) {
  return (
    <div style={{
      position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
      background: color, color: '#fff', padding: '10px 20px', borderRadius: 12,
      fontSize: 13, fontWeight: 700, zIndex: 9999,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
    }}>{msg}</div>
  )
}

// ── Pantalla de clave maestra ─────────────────────────────────────────────────
function PantallaClave({ onDesbloquear }) {
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function submit(e) {
    e.preventDefault()
    if (clave.trim().length < 4) { setError('Mínimo 4 caracteres'); return }
    onDesbloquear(clave.trim())
  }

  return (
    <div style={{
      minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, margin: '0 auto 14px',
            background: 'linear-gradient(135deg,#f59e0b,#d97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 28px rgba(245,158,11,0.35)', fontSize: 28,
          }}>🔐</div>
          <h2 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 22, color: 'var(--text)', marginBottom: 6 }}>
            Bóveda de accesos
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Ingresa tu clave maestra para desbloquear.<br />
            <strong style={{ color: 'var(--text-2)' }}>Esta clave nunca se guarda en el servidor.</strong>
          </p>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            ref={inputRef}
            type="password"
            className="sp-input"
            placeholder="Clave maestra (mínimo 4 caracteres)"
            value={clave}
            onChange={e => { setClave(e.target.value); setError('') }}
          />
          {error && (
            <p style={{ fontSize: 12, color: '#f87171', textAlign: 'center' }}>{error}</p>
          )}
          <button type="submit" style={{
            padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#f59e0b,#d97706)',
            color: '#fff', fontFamily: 'Outfit', fontWeight: 700, fontSize: 15,
            boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
          }}>
            Desbloquear 🔓
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 16, lineHeight: 1.5 }}>
          Si olvidaste tu clave maestra, los datos cifrados no pueden recuperarse.<br />
          Crea una nueva bóveda con una clave diferente.
        </p>
      </div>
    </div>
  )
}

// ── Modal agregar / editar entrada ────────────────────────────────────────────
function ModalEntrada({ entrada, onGuardar, onCerrar, guardando }) {
  const [nombre,  setNombre]  = useState(entrada?.nombre  || '')
  const [usuario, setUsuario] = useState(entrada?.usuario || '')
  const [clave,   setClave]   = useState(entrada?.clave   || '')
  const [url,     setUrl]     = useState(entrada?.url     || '')
  const [nota,    setNota]    = useState(entrada?.nota    || '')
  const [verClave, setVerClave] = useState(false)

  function genClave() {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%'
    let p = ''
    for (let i = 0; i < 16; i++) p += chars[Math.floor(Math.random() * chars.length)]
    setClave(p)
    setVerClave(true)
  }

  function submit(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    onGuardar({ nombre: nombre.trim(), usuario: usuario.trim(), clave, url: url.trim(), nota: nota.trim() })
  }

  return (
    <>
      <div className="sp-sheet-overlay" onClick={onCerrar} />
      <div className="sp-sheet">
        <div className="sp-sheet-handle" />
        <p className="sp-sheet-title">{entrada ? 'Editar acceso' : 'Nuevo acceso'}</p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 4px 24px' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>NOMBRE *</label>
            <input className="sp-input" placeholder="ej. Instagram del salón" value={nombre}
              onChange={e => setNombre(e.target.value)} required autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>USUARIO / EMAIL</label>
            <input className="sp-input" placeholder="usuario@ejemplo.com" value={usuario}
              onChange={e => setUsuario(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>CONTRASEÑA</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="sp-input" type={verClave ? 'text' : 'password'}
                placeholder="••••••••" value={clave}
                onChange={e => setClave(e.target.value)}
                style={{ flex: 1 }} />
              <button type="button" onClick={() => setVerClave(v => !v)} style={{
                padding: '0 12px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text-3)', cursor: 'pointer', flexShrink: 0,
              }}>{verClave ? '🙈' : '👁'}</button>
              <button type="button" onClick={genClave} style={{
                padding: '0 12px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--accent)', fontWeight: 700,
                fontSize: 11, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
              }}>Generar</button>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>URL / APP</label>
            <input className="sp-input" placeholder="https://instagram.com" value={url}
              onChange={e => setUrl(e.target.value)} type="url" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>NOTA</label>
            <textarea className="sp-input" placeholder="Notas adicionales…" value={nota}
              onChange={e => setNota(e.target.value)} rows={2}
              style={{ resize: 'none', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onCerrar} style={{
              flex: 1, padding: '12px', borderRadius: 12, cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', fontWeight: 600,
            }}>Cancelar</button>
            <button type="submit" disabled={guardando} style={{
              flex: 2, padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontWeight: 700,
              opacity: guardando ? 0.7 : 1,
            }}>{guardando ? 'Cifrando…' : entrada ? 'Guardar cambios' : 'Agregar acceso'}</button>
          </div>
        </form>
      </div>
    </>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function SalonBoveda() {
  const { tenant, user } = useTenant()

  const [claveMaestra,  setClaveMaestra]  = useState('')
  const [claveObj,      setClaveObj]      = useState(null)   // CryptoKey derivada
  const [entradas,      setEntradas]      = useState([])     // [{id, nombre, usuario, clave, url, nota}]
  const [rawEntradas,   setRawEntradas]   = useState([])     // filas de Supabase sin descifrar
  const [loading,       setLoading]       = useState(false)
  const [modal,         setModal]         = useState(null)   // null | 'nuevo' | {entrada}
  const [guardando,     setGuardando]     = useState(false)
  const [buscar,        setBuscar]        = useState('')
  const [revelar,       setRevelar]       = useState({})     // {id: bool}
  const [toast,         setToast]         = useState(null)
  const [clipTimer,     setClipTimer]     = useState({})     // {id: segundos}
  const clipIntervals = useRef({})

  const showToast = (msg, color) => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 2800)
  }

  // Desbloquear: derivar CryptoKey y cargar entradas
  async function desbloquear(clave) {
    setLoading(true)
    try {
      const ck = await derivarClave(clave)
      setClaveMaestra(clave)
      setClaveObj(ck)
      await cargarEntradas(ck)
    } catch {
      showToast('Error al desbloquear', '#f87171')
    }
    setLoading(false)
  }

  const cargarEntradas = useCallback(async (ck) => {
    if (!user?.id) return
    const { data } = await supabase
      .from('boveda_accesos')
      .select('id, nombre_enc, datos_enc, iv, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setRawEntradas(data || [])

    // Descifrar cada entrada
    const descifradas = []
    for (const row of (data || [])) {
      const nombreTexto = await descifrar(row.nombre_enc, row.iv, ck)
      const datosTexto  = await descifrar(row.datos_enc,  row.iv, ck)
      if (nombreTexto === null) {
        // Clave incorrecta
        setClaveMaestra(''); setClaveObj(null)
        showToast('Clave incorrecta — las entradas no se pudieron descifrar', '#f87171')
        setEntradas([])
        return
      }
      let datos = {}
      try { datos = JSON.parse(datosTexto) } catch {}
      descifradas.push({ id: row.id, nombre: nombreTexto, ...datos })
    }
    setEntradas(descifradas)
  }, [user?.id])

  async function guardarEntrada(datos) {
    if (!claveObj || !tenant?.id || !user?.id) return
    setGuardando(true)
    try {
      const payload = JSON.stringify({
        usuario: datos.usuario, clave: datos.clave, url: datos.url, nota: datos.nota,
      })
      const { datos: datosEnc, iv } = await cifrar(payload, claveObj)
      const { datos: nombreEnc }    = await cifrar(datos.nombre, claveObj)

      if (modal?.id) {
        // Actualizar
        await supabase.from('boveda_accesos').update({
          nombre_enc: nombreEnc, datos_enc: datosEnc, iv, updated_at: new Date().toISOString(),
        }).eq('id', modal.id)
        showToast('Acceso actualizado ✓')
      } else {
        // Crear
        await supabase.from('boveda_accesos').insert({
          tenant_id: tenant.id, user_id: user.id,
          nombre_enc: nombreEnc, datos_enc: datosEnc, iv,
        })
        showToast('Acceso guardado ✓')
      }
      setModal(null)
      await cargarEntradas(claveObj)
    } catch (e) {
      showToast('Error al cifrar: ' + e.message, '#f87171')
    }
    setGuardando(false)
  }

  async function eliminarEntrada(id) {
    if (!confirm('¿Eliminar este acceso? No se puede deshacer.')) return
    await supabase.from('boveda_accesos').delete().eq('id', id)
    setEntradas(prev => prev.filter(e => e.id !== id))
    showToast('Acceso eliminado')
  }

  function copiarAlPortapapeles(id, valor, tipo) {
    if (!valor) return
    navigator.clipboard.writeText(valor).then(() => {
      showToast(`${tipo} copiado — se borrará en 30s`, '#f59e0b')
      // Cuenta regresiva
      let seg = 30
      setClipTimer(prev => ({ ...prev, [id]: seg }))
      clearInterval(clipIntervals.current[id])
      clipIntervals.current[id] = setInterval(() => {
        seg--
        if (seg <= 0) {
          clearInterval(clipIntervals.current[id])
          navigator.clipboard.writeText('').catch(() => {})
          setClipTimer(prev => { const n = { ...prev }; delete n[id]; return n })
        } else {
          setClipTimer(prev => ({ ...prev, [id]: seg }))
        }
      }, 1000)
    })
  }

  const entradasFiltradas = entradas.filter(e =>
    !buscar || e.nombre?.toLowerCase().includes(buscar.toLowerCase()) ||
    e.usuario?.toLowerCase().includes(buscar.toLowerCase()) ||
    e.url?.toLowerCase().includes(buscar.toLowerCase())
  )

  // ── Sin desbloquear ───────────────────────────────────────────────────────
  if (!claveObj) {
    return (
      <div style={{ padding: '0 16px' }}>
        {toast && <Toast msg={toast.msg} color={toast.color} />}
        {loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <div className="sp-spinner" />
            </div>
          : <PantallaClave onDesbloquear={desbloquear} />
        }
      </div>
    )
  }

  // ── Bóveda desbloqueada ───────────────────────────────────────────────────
  return (
    <div style={{ padding: '0 16px 16px' }}>
      {toast && <Toast msg={toast.msg} color={toast.color} />}

      {modal && (
        <ModalEntrada
          entrada={modal === 'nuevo' ? null : modal}
          onGuardar={guardarEntrada}
          onCerrar={() => setModal(null)}
          guardando={guardando}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingTop: 4 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: 'linear-gradient(135deg,#f59e0b,#d97706)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>🔐</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 18, color: 'var(--text)', margin: 0 }}>
            Bóveda de accesos
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, marginTop: 1 }}>
            {entradas.length} entrada{entradas.length !== 1 ? 's' : ''} · cifrado AES-256
          </p>
        </div>
        <button onClick={() => { setClaveMaestra(''); setClaveObj(null); setEntradas([]) }}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg)', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer' }}
          title="Bloquear bóveda">
          🔒
        </button>
        <button onClick={() => setModal('nuevo')} style={{
          padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#f59e0b,#d97706)',
          color: '#fff', fontWeight: 700, fontSize: 13,
          boxShadow: '0 4px 14px rgba(245,158,11,0.35)',
        }}>+ Nuevo</button>
      </div>

      {/* Buscador */}
      {entradas.length > 2 && (
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 14 }}>🔍</span>
          <input className="sp-input" value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar por nombre, usuario o URL…"
            style={{ paddingLeft: 34 }} />
        </div>
      )}

      {/* Lista */}
      {entradasFiltradas.length === 0 ? (
        <div className="sp-empty" style={{ paddingTop: 40 }}>
          <span className="sp-empty-icon">🔑</span>
          <p className="sp-empty-title">{buscar ? 'Sin resultados' : 'Bóveda vacía'}</p>
          <p className="sp-empty-sub">{buscar ? 'Prueba otra búsqueda' : 'Agrega tu primer acceso con + Nuevo'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entradasFiltradas.map(e => {
            const visible = revelar[e.id]
            const timer   = clipTimer[e.id]
            return (
              <div key={e.id} style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '14px 16px',
              }}>
                {/* Nombre + acciones */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: 'rgba(245,158,11,0.15)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 800, color: '#f59e0b',
                  }}>
                    {e.url ? '🌐' : e.nombre[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.nombre}
                    </div>
                    {e.url && (
                      <a href={e.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {e.url}
                      </a>
                    )}
                  </div>
                  <button onClick={() => setModal(e)} style={{
                    padding: '5px 8px', borderRadius: 7, border: '1px solid var(--border)',
                    background: 'var(--bg)', color: 'var(--text-3)', cursor: 'pointer', fontSize: 13,
                  }}>✏️</button>
                  <button onClick={() => eliminarEntrada(e.id)} style={{
                    padding: '5px 8px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.25)',
                    background: 'rgba(239,68,68,0.06)', color: '#f87171', cursor: 'pointer', fontSize: 13,
                  }}>🗑</button>
                </div>

                {/* Campos */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {e.usuario && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', width: 64, flexShrink: 0 }}>Usuario</span>
                      <span style={{ fontSize: 13, color: 'var(--text-2)', flex: 1, fontFamily: 'monospace',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.usuario}</span>
                      <button onClick={() => copiarAlPortapapeles(e.id + '_u', e.usuario, 'Usuario')}
                        style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)',
                          background: 'var(--bg)', color: 'var(--text-3)', fontSize: 11, cursor: 'pointer' }}>
                        Copiar
                      </button>
                    </div>
                  )}

                  {e.clave && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', width: 64, flexShrink: 0 }}>Clave</span>
                      <span style={{ fontSize: 13, color: 'var(--text-2)', flex: 1, fontFamily: 'monospace',
                        letterSpacing: visible ? 0 : 3 }}>
                        {visible ? e.clave : '••••••••'}
                      </span>
                      <button onClick={() => setRevelar(prev => ({ ...prev, [e.id]: !prev[e.id] }))}
                        style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)',
                          background: 'var(--bg)', color: 'var(--text-3)', fontSize: 11, cursor: 'pointer' }}>
                        {visible ? '🙈' : '👁'}
                      </button>
                      <button onClick={() => copiarAlPortapapeles(e.id + '_c', e.clave, 'Clave')}
                        style={{ padding: '3px 8px', borderRadius: 6,
                          border: `1px solid ${timer ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
                          background: timer ? 'rgba(245,158,11,0.08)' : 'var(--bg)',
                          color: timer ? '#f59e0b' : 'var(--text-3)', fontSize: 11, cursor: 'pointer',
                          minWidth: 52, textAlign: 'center' }}>
                        {timer ? `${timer}s` : 'Copiar'}
                      </button>
                    </div>
                  )}

                  {e.nota && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', width: 64, flexShrink: 0, paddingTop: 2 }}>Nota</span>
                      <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>{e.nota}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
