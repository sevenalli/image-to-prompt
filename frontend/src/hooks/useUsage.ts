import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useApi } from '../lib/api'

interface UsageData {
  tier: 'starter' | 'pro' | 'studio'
  analysesUsed: number
  analysesLimit: number | null
  resetsAt: string
}

interface UseUsageReturn extends Partial<UsageData> {
  loading: boolean
}

export function useUsage(): UseUsageReturn {
  const { isSignedIn } = useAuth()
  const apiFetch = useApi()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<UsageData | null>(null)

  useEffect(() => {
    if (!isSignedIn) return
    setLoading(true)
    apiFetch('/api/usage')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isSignedIn])

  return { loading, ...data ?? {} }
}
