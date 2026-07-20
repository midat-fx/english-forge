import { useEffect, useState } from 'react'

export function useLocalToday(): Date {
  const [today, setToday] = useState(() => new Date())

  useEffect(() => {
    const refresh = () => setToday(new Date())
    const now = new Date()
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
    const timeout = window.setTimeout(refresh, nextMidnight.getTime() - now.getTime())
    const interval = window.setInterval(refresh, 5 * 60_000)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [today])

  return today
}
