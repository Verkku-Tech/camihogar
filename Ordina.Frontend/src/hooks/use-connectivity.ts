// ponytail: reactive hook tracking server reachability and health status via ConnectivityManager
import { useState, useEffect } from 'react'
import { connectivityManager, type ConnectionStatus } from '@/lib/connectivity'

export function useConnectivity() {
  const [status, setStatus] = useState<ConnectionStatus>(() => connectivityManager.getStatus())
  const [isServerReachable, setIsServerReachable] = useState<boolean>(() => !connectivityManager.isServerUnreachable())

  useEffect(() => {
    const handleStatusChange = () => {
      const unreachable = connectivityManager.isServerUnreachable()
      setIsServerReachable(!unreachable)
      setStatus(connectivityManager.getStatus())
    }

    const unsubscribe = connectivityManager.subscribe(handleStatusChange)
    return () => {
      unsubscribe()
    }
  }, [])

  return {
    isServerReachable,
    isOffline: !isServerReachable,
    status
  }
}
