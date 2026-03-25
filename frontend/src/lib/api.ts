import { useAuth } from '@clerk/clerk-react'

const BASE = import.meta.env.VITE_API_URL ?? ''

export function useApi() {
  const { getToken, isSignedIn } = useAuth()

  return async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string>),
    }
    if (isSignedIn) {
      const token = await getToken()
      if (token) headers['Authorization'] = `Bearer ${token}`
    }
    return fetch(`${BASE}${path}`, { ...init, headers })
  }
}
