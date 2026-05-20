import { useState, useEffect } from 'react'

export default function PWAInstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('pwa-dismissed') === '1'
  )

  useEffect(() => {
    const handler = e => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt || dismissed) return null

  async function instalar() {
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    setPrompt(null)
    if (outcome !== 'accepted') dismiss()
  }

  function dismiss() {
    setDismissed(true)
    sessionStorage.setItem('pwa-dismissed', '1')
  }

  return (
    <div style={{
      position:'fixed', bottom:'calc(80px + env(safe-area-inset-bottom))',
      left:16, right:16, zIndex:8800, borderRadius:22,
      padding:'16px 18px',
      background:'var(--card)', border:'1px solid var(--border)',
      boxShadow:'0 -2px 40px rgba(0,0,0,0.2)',
      display:'flex', alignItems:'center', gap:14,
      animation:'sp-toast-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
    }}>
      <img
        src="/logo192.png" alt="Salón Pro"
        style={{ width:50, height:50, borderRadius:15, flexShrink:0, objectFit:'contain' }}
      />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:800, fontSize:14, color:'var(--text)' }}>Instala Salón Pro</div>
        <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
          Acceso rápido desde tu pantalla de inicio
        </div>
      </div>
      <div style={{ display:'flex', gap:8, flexShrink:0 }}>
        <button onClick={instalar} style={{
          padding:'9px 15px', borderRadius:11, border:'none', cursor:'pointer',
          background:'var(--accent)', color:'#fff', fontWeight:700, fontSize:13,
          fontFamily:'inherit',
        }}>Instalar</button>
        <button onClick={dismiss} style={{
          width:34, height:34, borderRadius:10, border:'1px solid var(--border)',
          background:'transparent', color:'var(--text-3)', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
          fontFamily:'inherit',
        }}>✕</button>
      </div>
    </div>
  )
}
