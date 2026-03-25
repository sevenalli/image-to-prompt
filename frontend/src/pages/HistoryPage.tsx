import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
import { useUsage } from '../hooks/useUsage'
import { useApi } from '../lib/api'

interface Analysis {
  id: string
  prompt_length: number
  prompt_text: string | null
  created_at: string
}

export function HistoryPage() {
  const { tier, loading: usageLoading } = useUsage()
  const apiFetch = useApi()
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (usageLoading) return
    if (tier === 'starter') return
    setLoading(true)
    apiFetch('/api/history')
      .then((r) => r.json())
      .then((d: { analyses: Analysis[] }) => setAnalyses(d.analyses ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tier, usageLoading])

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

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

          {/* Starter users: show upgrade prompt instead of silent redirect */}
          {!usageLoading && tier === 'starter' && (
            <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center space-y-4">
              <div className="text-4xl">📋</div>
              <h2 className="text-lg font-bold text-gray-900">Analysis history is a Pro feature</h2>
              <p className="text-gray-500 text-sm">Upgrade to Pro or Studio to save and revisit all your generated prompts.</p>
              <Link
                to="/settings"
                className="inline-block rounded-xl bg-violet-600 px-6 py-2.5 font-semibold text-white hover:bg-violet-700 transition-colors"
              >
                Upgrade to Pro — $9/mo
              </Link>
            </div>
          )}

          {tier && tier !== 'starter' && (
            <>
              {loading && <p className="text-gray-400 text-sm">Loading...</p>}

              {!loading && analyses.length === 0 && (
                <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center space-y-3">
                  <div className="text-4xl">🖼️</div>
                  <p className="text-gray-500">No analyses yet. <Link to="/app" className="text-violet-600 hover:underline">Upload an image to get started.</Link></p>
                </div>
              )}

              {!loading && analyses.length > 0 && (
                <div className="space-y-3">
                  {analyses.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-xl bg-white border border-gray-200 overflow-hidden transition-shadow hover:shadow-sm"
                    >
                      <button
                        onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600">{new Date(a.created_at).toLocaleString()}</span>
                          <span className="text-xs text-gray-400">{a.prompt_length} chars</span>
                        </div>
                        <svg
                          className={`h-4 w-4 text-gray-400 transition-transform ${expandedId === a.id ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>

                      {expandedId === a.id && (
                        <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                          {a.prompt_text ? (
                            <>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{a.prompt_text}</p>
                              <button
                                onClick={() => handleCopy(a.prompt_text!, a.id)}
                                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
                              >
                                {copiedId === a.id ? 'Copied!' : 'Copy prompt'}
                              </button>
                            </>
                          ) : (
                            <p className="text-sm text-gray-400 italic">Prompt text not available for older analyses.</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </SignedIn>
      </main>
    </div>
  )
}
