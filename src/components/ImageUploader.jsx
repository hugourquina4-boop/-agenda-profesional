import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

function Ico({ d, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const ICO_IMG    = 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
const ICO_UPLOAD = 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12'
const ICO_LINK   = 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1'
const ICO_TRASH  = 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'

/**
 * Props:
 *   value    — URL actual de la imagen (string)
 *   onChange — callback(newUrl: string)
 *   label    — texto del label (opcional)
 *   shape    — 'square' | 'circle'  (default: 'square')
 *   size     — tamaño del preview en px (default: 80)
 *   folder   — subcarpeta dentro del bucket (default: 'general')
 *   accent   — color del botón primario (default: '#f43f5e')
 */
export default function ImageUploader({
  value,
  onChange,
  label,
  shape   = 'square',
  size    = 80,
  folder  = 'general',
  accent  = '#f43f5e',
}) {
  const inputRef   = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState('')
  const [showUrl,   setShowUrl]   = useState(false)
  const [urlDraft,  setUrlDraft]  = useState('')

  const radius = shape === 'circle' ? '50%' : 14

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''                            // reset para poder subir el mismo archivo dos veces
    setError('')

    if (!file.type.startsWith('image/')) {
      setError('Solo se admiten imágenes (JPG, PNG, WEBP…)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo supera 5 MB')
      return
    }

    setUploading(true)
    const ext  = file.name.split('.').pop().toLowerCase() || 'jpg'
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('imagenes')
      .upload(path, file, { cacheControl:'3600', upsert:false })

    if (uploadErr) {
      setError(uploadErr.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('imagenes').getPublicUrl(path)
    onChange(data.publicUrl)
    setUploading(false)
  }

  function aplicarUrl() {
    const url = urlDraft.trim()
    if (!url) return
    onChange(url)
    setUrlDraft('')
    setShowUrl(false)
    setError('')
  }

  return (
    <div>
      {label && (
        <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700,
          letterSpacing:0.6, display:'block', marginBottom:8, textTransform:'uppercase' }}>
          {label}
        </label>
      )}

      <div style={{ display:'flex', alignItems:'flex-start', gap:16 }}>

        {/* ── Preview ── */}
        <div style={{
          width:size, height:size, borderRadius:radius, flexShrink:0,
          background:'var(--card)', border:'2px dashed var(--border)',
          display:'flex', alignItems:'center', justifyContent:'center',
          overflow:'hidden', position:'relative',
        }}>
          {value ? (
            <img src={value} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
              onError={e => { e.target.style.display = 'none' }} />
          ) : (
            <Ico d={ICO_IMG} size={28} />
          )}
          {uploading && (
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.55)',
              display:'flex', alignItems:'center', justifyContent:'center', borderRadius:radius }}>
              <div style={{
                width:22, height:22, border:'2px solid rgba(255,255,255,0.3)',
                borderTop:'2px solid #fff', borderRadius:'50%',
                animation:'spin 0.7s linear infinite',
              }} />
            </div>
          )}
        </div>

        {/* ── Controles ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>

          {/* Botón subir archivo — abre galería/cámara en móvil, explorador en desktop */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display:'none' }}
            onChange={handleFile}
          />
          <button
            type="button"
            onClick={() => { setError(''); inputRef.current?.click() }}
            disabled={uploading}
            style={{
              display:'flex', alignItems:'center', gap:8,
              padding:'11px 16px', borderRadius:12, cursor: uploading ? 'not-allowed' : 'pointer',
              background:`${accent}18`, border:`1px solid ${accent}40`, color:accent,
              fontWeight:700, fontSize:13, fontFamily:'Plus Jakarta Sans,sans-serif',
              opacity: uploading ? 0.6 : 1, whiteSpace:'nowrap',
            }}>
            <Ico d={ICO_UPLOAD} size={15} />
            {uploading ? 'Subiendo…' : 'Subir desde celular / PC'}
          </button>

          {/* Pegar URL */}
          {!showUrl ? (
            <button
              type="button"
              onClick={() => setShowUrl(true)}
              style={{ display:'flex', alignItems:'center', gap:6,
                padding:'9px 14px', borderRadius:10, cursor:'pointer',
                background:'transparent', border:'1px solid var(--border)', color:'var(--text-3)',
                fontSize:12, fontWeight:600 }}>
              <Ico d={ICO_LINK} size={13} />
              Pegar URL
            </button>
          ) : (
            <div style={{ display:'flex', gap:6 }}>
              <input
                className="sp-input"
                placeholder="https://…"
                value={urlDraft}
                autoFocus
                onChange={e => setUrlDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') aplicarUrl() }}
                style={{ fontSize:13, padding:'9px 12px', flex:1 }}
              />
              <button type="button" onClick={aplicarUrl}
                style={{ padding:'9px 14px', borderRadius:10, border:'none', cursor:'pointer',
                  background:accent, color:'#fff', fontWeight:700, fontSize:13, flexShrink:0 }}>
                OK
              </button>
              <button type="button" onClick={() => setShowUrl(false)}
                style={{ padding:'9px 10px', borderRadius:10, border:'1px solid var(--border)',
                  background:'transparent', color:'var(--text-3)', cursor:'pointer', fontSize:12 }}>
                ✕
              </button>
            </div>
          )}

          {/* Quitar imagen */}
          {value && !uploading && (
            <button type="button" onClick={() => { onChange(''); setError('') }}
              style={{ display:'flex', alignItems:'center', gap:6,
                padding:0, background:'none', border:'none', cursor:'pointer',
                color:'var(--text-3)', fontSize:12, fontWeight:500 }}>
              <Ico d={ICO_TRASH} size={13} />
              Quitar imagen
            </button>
          )}

          {/* Error */}
          {error && (
            <p style={{ fontSize:12, color:'#f87171', margin:0, lineHeight:1.4 }}>{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
