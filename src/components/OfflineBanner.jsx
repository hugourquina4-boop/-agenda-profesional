import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOnline = () => setIsOffline(false)
    const goOffline = () => setIsOffline(true)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 bg-red-950/95 backdrop-blur-md border border-red-500/50 text-red-200 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce z-[9999]">
      <div className="p-2 bg-red-900/50 rounded-lg text-red-400">
        <WifiOff size={20} />
      </div>
      <div>
        <h4 className="font-bold text-sm text-white">Modo sin conexión</h4>
        <p className="text-xs text-red-300">
          Estás viendo una versión local. Los cambios se sincronizarán cuando vuelva el internet.
        </p>
      </div>
    </div>
  )
}
