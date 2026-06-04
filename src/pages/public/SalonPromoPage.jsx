import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('es-CO').format(n ?? 0)

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function SalonPromoPage() {
  const { slug } = useParams()
  const [tenant,    setTenant]    = useState(null)
  const [servicios, setServicios] = useState([])
  const [paquetes,  setPaquetes]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  useEffect(() => {
    async function cargar() {
      const { data: t, error: te } = await supabase.from('tenants')
        .select('id, nombre, slug, ciudad, color_primario, instagram, telefono, pagina_web, logo_url, descripcion')
        .eq('slug', slug).eq('activo', true).single()

      if (te || !t) { setError('Negocio no encontrado'); setLoading(false); return }
      setTenant(t)

      const [{ data: s }, { data: p }] = await Promise.all([
        supabase.from('servicios')
          .select('id, nombre, precio_base, precio_oferta, duracion_min, categoria')
          .eq('tenant_id', t.id).eq('activo', true)
          .order('categoria', { ascending: true })
          .order('nombre', { ascending: true }),
        supabase.from('paquetes_salon')
          .select('id, nombre, descripcion, precio_especial, porcentaje_off')
          .eq('tenant_id', t.id).eq('visible_portal', true)
          .order('created_at', { ascending: false }),
      ])
      setServicios(s || [])
      setPaquetes(p || [])
      setLoading(false)
    }
    cargar()
  }, [slug])

  if (loading) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'#fafaf8' }}>
      <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid #e4e4e7',
        borderTopColor:'#16a34a', animation:'spin 0.7s linear infinite' }} />
    </div>
  )

  if (error) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center',
      flexDirection:'column', gap:12, background:'#fafaf8', color:'#71717a', fontFamily:'system-ui' }}>
      <span style={{ fontSize:40 }}>🔍</span>
      <p style={{ fontSize:16 }}>{error}</p>
    </div>
  )

  const col = tenant.color_primario || '#16a34a'
  const cats = [...new Set(servicios.map(s => s.categoria).filter(Boolean))]
  const sinCat = servicios.filter(s => !s.categoria)
  const enOferta = servicios.filter(s => s.precio_oferta && s.precio_oferta < s.precio_base)

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif", background:'#fafaf8',
      minHeight:'100dvh', color:'#1a1825' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        a { color: inherit; text-decoration: none; }
      `}</style>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${col}18, ${col}05)`,
        borderBottom: `1px solid ${col}20` }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px 32px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.nombre}
                style={{ width:68, height:68, borderRadius:16, objectFit:'cover',
                  boxShadow:`0 4px 16px ${col}30` }} />
            ) : (
              <div style={{ width:68, height:68, borderRadius:16, background:`${col}22`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:28, fontWeight:800, color: col }}>
                {tenant.nombre?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <h1 style={{ fontSize:22, fontWeight:800, lineHeight:1.2 }}>{tenant.nombre}</h1>
              {tenant.ciudad && (
                <p style={{ fontSize:13, color:'#71717a', marginTop:3 }}>📍 {tenant.ciudad}</p>
              )}
            </div>
          </div>

          {tenant.descripcion && (
            <p style={{ fontSize:14, color:'#52525b', lineHeight:1.6, marginBottom:20 }}>
              {tenant.descripcion}
            </p>
          )}

          {/* Social links */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {tenant.telefono && (
              <a href={`https://wa.me/57${tenant.telefono.replace(/\D/g,'')}`}
                target="_blank" rel="noopener"
                style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px',
                  borderRadius:100, background:'#22c55e', color:'#fff',
                  fontWeight:700, fontSize:13 }}>
                <span>💬</span> WhatsApp
              </a>
            )}
            {tenant.instagram && (
              <a href={`https://instagram.com/${tenant.instagram.replace('@','')}`}
                target="_blank" rel="noopener"
                style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px',
                  borderRadius:100, background:'#e1306c', color:'#fff',
                  fontWeight:700, fontSize:13 }}>
                <span>📷</span> Instagram
              </a>
            )}
            {tenant.pagina_web && (
              <a href={tenant.pagina_web} target="_blank" rel="noopener"
                style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px',
                  borderRadius:100, background:'#f4f4f5', color:'#3f3f46',
                  fontWeight:700, fontSize:13 }}>
                <span>🌐</span> Web
              </a>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:640, margin:'0 auto', padding:'28px 24px 80px' }}>

        {/* Oferta destacada */}
        {enOferta.length > 0 && (
          <section style={{ marginBottom:32 }}>
            <h2 style={{ fontSize:16, fontWeight:800, marginBottom:14, display:'flex',
              alignItems:'center', gap:8 }}>
              <span style={{ background:`${col}18`, color:col, padding:'2px 10px',
                borderRadius:100, fontSize:12 }}>🔥 EN OFERTA</span>
            </h2>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {enOferta.map(s => (
                <div key={s.id} style={{ padding:'16px 18px', borderRadius:14,
                  background:`${col}08`, border:`2px solid ${col}30`,
                  display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15 }}>{s.nombre}</div>
                    {s.duracion_min > 0 && (
                      <div style={{ fontSize:12, color:'#71717a', marginTop:2 }}>⏱ {s.duracion_min} min</div>
                    )}
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:11, color:'#71717a', textDecoration:'line-through' }}>
                      ${fmt(s.precio_base)}
                    </div>
                    <div style={{ fontSize:19, fontWeight:800, color:col }}>
                      ${fmt(s.precio_oferta)}
                    </div>
                    <div style={{ fontSize:11, fontWeight:700, background:`${col}20`, color:col,
                      borderRadius:6, padding:'1px 6px', display:'inline-block', marginTop:2 }}>
                      {Math.round((1 - s.precio_oferta / s.precio_base) * 100)}% OFF
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Paquetes */}
        {paquetes.length > 0 && (
          <section style={{ marginBottom:32 }}>
            <h2 style={{ fontSize:16, fontWeight:800, marginBottom:14 }}>🎟 Paquetes especiales</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {paquetes.map(p => (
                <div key={p.id} style={{ padding:'16px 18px', borderRadius:14,
                  background:'#fff', border:'1px solid #e4e4e7',
                  display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15 }}>{p.nombre}</div>
                    {p.descripcion && (
                      <div style={{ fontSize:12, color:'#71717a', marginTop:2 }}>{p.descripcion}</div>
                    )}
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:19, fontWeight:800, color:col }}>
                      ${fmt(p.precio_especial)}
                    </div>
                    {p.porcentaje_off > 0 && (
                      <div style={{ fontSize:11, fontWeight:700, background:'#fef9c3', color:'#92400e',
                        borderRadius:6, padding:'1px 6px', display:'inline-block', marginTop:2 }}>
                        {p.porcentaje_off}% OFF
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Servicios por categoría */}
        {servicios.length > 0 && (
          <section style={{ marginBottom:32 }}>
            <h2 style={{ fontSize:16, fontWeight:800, marginBottom:14 }}>✂️ Servicios</h2>

            {cats.map(cat => (
              <div key={cat} style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', letterSpacing:1,
                  textTransform:'uppercase', marginBottom:8 }}>{cat}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:1,
                  borderRadius:14, overflow:'hidden', border:'1px solid #e4e4e7' }}>
                  {servicios.filter(s => s.categoria === cat).map((s, i, arr) => (
                    <div key={s.id} style={{ padding:'13px 16px', background:'#fff',
                      borderBottom: i < arr.length-1 ? '1px solid #f4f4f5' : 'none',
                      display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontWeight:600, fontSize:14 }}>{s.nombre}</div>
                        {s.duracion_min > 0 && (
                          <div style={{ fontSize:11, color:'#a1a1aa' }}>⏱ {s.duracion_min} min</div>
                        )}
                      </div>
                      <div style={{ fontWeight:700, fontSize:15, color:col, flexShrink:0 }}>
                        ${fmt(s.precio_base)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {sinCat.length > 0 && (
              <div style={{ borderRadius:14, overflow:'hidden', border:'1px solid #e4e4e7' }}>
                {sinCat.map((s, i) => (
                  <div key={s.id} style={{ padding:'13px 16px', background:'#fff',
                    borderBottom: i < sinCat.length-1 ? '1px solid #f4f4f5' : 'none',
                    display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:14 }}>{s.nombre}</div>
                      {s.duracion_min > 0 && (
                        <div style={{ fontSize:11, color:'#a1a1aa' }}>⏱ {s.duracion_min} min</div>
                      )}
                    </div>
                    <div style={{ fontWeight:700, fontSize:15, color:col, flexShrink:0 }}>
                      ${fmt(s.precio_base)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* CTA reservar */}
        <Link to={`/reservar/${slug}`}
          style={{ display:'block', textAlign:'center', padding:'16px 24px', borderRadius:16,
            background:`linear-gradient(135deg, ${col}, ${col}cc)`,
            color:'#fff', fontWeight:800, fontSize:16,
            boxShadow:`0 6px 24px ${col}40`, textDecoration:'none' }}>
          📅 Reservar cita ahora
        </Link>

        <p style={{ fontSize:11, color:'#a1a1aa', textAlign:'center', marginTop:20 }}>
          {tenant.nombre} — página de promoción actualizada automáticamente
        </p>
      </div>
    </div>
  )
}
