import { useToast } from '../context/ToastContext'

const STYLES = {
  success: { bg:'rgba(34,197,94,0.13)',  border:'rgba(34,197,94,0.35)',  icon:'✓', color:'#4ade80' },
  error:   { bg:'rgba(239,68,68,0.13)',  border:'rgba(239,68,68,0.35)',  icon:'✕', color:'#f87171' },
  info:    { bg:'rgba(99,102,241,0.13)', border:'rgba(99,102,241,0.35)', icon:'ℹ', color:'#818cf8' },
  warn:    { bg:'rgba(245,158,11,0.13)', border:'rgba(245,158,11,0.35)', icon:'!', color:'#fbbf24' },
}

export default function Toaster() {
  const ctx = useToast()
  if (!ctx?.toasts?.length) return null
  return (
    <div style={{
      position:'fixed', bottom:'calc(84px + env(safe-area-inset-bottom))',
      left:'50%', transform:'translateX(-50%)', zIndex:99999,
      display:'flex', flexDirection:'column-reverse', gap:8, alignItems:'center',
      pointerEvents:'none',
    }}>
      {ctx.toasts.map(t => {
        const s = STYLES[t.type] || STYLES.success
        return (
          <div key={t.id} style={{
            padding:'10px 18px', borderRadius:14, fontSize:13, fontWeight:600,
            background:s.bg, border:`1px solid ${s.border}`, color:s.color,
            display:'flex', alignItems:'center', gap:8,
            backdropFilter:'blur(12px)', whiteSpace:'nowrap',
            animation:'sp-toast-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
            boxShadow:'0 4px 24px rgba(0,0,0,0.22)',
          }}>
            <span style={{ fontSize:15, fontWeight:900, lineHeight:1 }}>{s.icon}</span>
            {t.msg}
          </div>
        )
      })}
    </div>
  )
}
