import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
import { useUsage } from '../hooks/useUsage'
import { useApi } from '../lib/api'

interface Analysis {
  id: string
  prompt_length: number
  created_at: string
}

export function HistoryPage() {
  const { tier, loading: usageLoading } = useUsage()
  const apiFetch = useApi()
  const navigate = useNavigate()
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (usageLoading) return
    if (tier === 'starter') { navigate('/settings'); return }
    setLoading(true)
    apiFetch('/api/history')
      .then((r) => r.json())
      .then((d: { analyses: Analysis[] }) => setAnalyses(d.analyses ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tier, usageLoading])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80">
            <span className="text-xl">🖼️</span>
            <span className="font-bold text-gray-900">Image <span className="text-violet-600">→</span> Prompt</span>
          </Link>
          <div className="flex items-center gap-4">
            <nav className="flex gap-4 text-sm text-gray-500">
              <Link to="/app" className="hover:text-gray-900">Tool</Link>
              <Link to="/history" className="text-violet-600 font-medium">History</Link>
              <Link to="/settings" className="hover:text-gray-900">Settings</Link>
            </nav>
            <SignedIn><UserButton afterSignOutUrl="/" /></SignedIn>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
        <SignedOut>
          <div className="text-center py-20 space-y-4">
            <p className="text-gray-500">Sign in to view your history.</p>
            <SignInButton mode="modal">
              <button className="rounded-xl bg-violet-600 px-6 py-2.5 font-semibold text-white hover:bg-violet-700">Sign in</button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          <h1 className="text-2xl font-bold text-gray-900">Analysis History</h1>

          {loading && <p className="text-gray-400 text-sm">Loading…</p>}

          {!loading && analyses.length === 0 && (
            <div className="text-center py-16 space-y-3">
              <p className="text-gray-500">No analyses yet. <Link to="/app" className="text-violet-600 hover:underline">Upload an image to get started.</Link></p>
            </div>
          )}

          {!loading && analyses.length > 0 && (
            <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Prompt length</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {analyses.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600">{new Date(a.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-500">{a.prompt_length} chars</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SignedIn>
      </main>
    </div>
  )
}
