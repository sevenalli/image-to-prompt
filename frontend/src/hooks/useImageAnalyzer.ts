import { useState } from 'react'
import { resizeImageToDataUri } from '../lib/imageUtils'
import { useApi } from '../lib/api'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface UseImageAnalyzerReturn {
  status: Status
  prompt: string | null
  errorMessage: string | null
  analyze: (file: File) => Promise<void>
  reset: () => void
}

export function useImageAnalyzer(): UseImageAnalyzerReturn {
  const [status, setStatus] = useState<Status>('idle')
  const [prompt, setPrompt] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const apiFetch = useApi()

  async function analyze(file: File): Promise<void> {
    setStatus('loading')
    setPrompt(null)
    setErrorMessage(null)

    try {
      const dataUri = await resizeImageToDataUri(file, 1024)
      const mimeType = dataUri.split(';')[0].replace('data:', '')

      const response = await apiFetch('/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ image: dataUri, mimeType }),
      })

      const json = await response.json()

      if (!response.ok || !json.success) {
        if (response.status === 429) {
          throw new Error('Monthly quota reached. Upgrade your plan for more analyses.')
        }
        throw new Error(json.message ?? `Request failed with status ${response.status}`)
      }

      setPrompt(json.prompt)
      setStatus('success')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setStatus('error')
    }
  }

  function reset() {
    setStatus('idle')
    setPrompt(null)
    setErrorMessage(null)
  }

  return { status, prompt, errorMessage, analyze, reset }
}
