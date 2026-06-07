import { createContext, useContext, useState, useCallback, useRef } from 'react'

const Ctx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const toast = useCallback((msg, type = 'success') => {
    const id = ++idRef.current
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  return <Ctx.Provider value={{ toasts, toast }}>{children}</Ctx.Provider>
}

export const useToast = () => {
  const ctx = useContext(Ctx)
  return {
    ...ctx,
    success: (msg) => ctx.toast(msg, 'success'),
    error:   (msg) => ctx.toast(msg, 'error'),
    info:    (msg) => ctx.toast(msg, 'info'),
  }
}
