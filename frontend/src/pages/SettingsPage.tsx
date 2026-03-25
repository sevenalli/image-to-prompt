import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
import { useUsage } from '../hooks/useUsage'
import { useApi } from '../lib/api'

export function SettingsPage() {
  const { tier, analysesUsed, analysesLimit, loading } = useUsage()
  const apiFetch = useApi()
  const [upgrading, setUpgrading] = useState(false)
  const [keys, setKeys] = useState<{ id: string; name: string; createdAt: string }[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [keysLoaded, setKeysLoaded] = useState(false)

  async function upgrade(plan: 'pro' | 'studio') {
    setUpgrading(true)
    try {
      const res = await apiFetch('/api/checkout', { method: 'POST', body: JSON.stringify({ plan }) })
      const json = await res.json() as { url?: string; message?: string }
      if (json.url) window.location.href = json.url
      else alert(json.message ?? 'Checkout failed')
    } finally {
      setUpgrading(false)
    }
  }

  async function loadKeys() {
    const res = await apiFetch('/api/keys')
    const json = await res.json() as { keys: typeof keys }
    setKeys(json.keys)
    setKeysLoaded(true)
  }

  async function generateKey() {
    if (!newKeyName.trim()) return
    const res = await apiFetch('/api/keys', { method: 'POST', body: JSON.stringify({ name: newKeyName }) })
    const json = await res.json() as { id: string; key: string }
    setRevealedKey(json.key)
    setKeys((k) => [{ id: json.id, name: newKeyName, createdAt: new Date().toISOString() }, ...k])
    setNewKeyName('')
  }

  async function revokeKey(id: string) {
    await apiFetch(`/api/keys/${id}`, { method: 'DELETE' })
    setKeys((k) => k.filter((k) => k.id !== id))
  }

  const isUnlimited = analysesLimit === null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-xl">🖼️</span>
            <span className="font-bold text-gray-900">Image <span className="text-violet-600">→</span> Prompt</span>
          </Link>
          <div className="flex items-center gap-4">
            <nav className="flex gap-4 text-sm text-gray-500">
              <Link to="/app" className="hover:text-gray-900">Tool</Link>
              <Link to="/history" className="hover:text-gray-900">History</Link>
              <Link to="/settings" className="text-violet-600 font-medium">Settings</Link>
            </nav>
            <SignedIn><UserButton afterSignOutUrl="/" /></SignedIn>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 space-y-8">
        <SignedOut>
          <div className="text-center py-20 space-y-4">
            <p className="text-gray-500">Sign in to manage your account.</p>
            <SignInButton mode="modal">
              <button className="rounded-xl bg-violet-600 px-6 py-2.5 font-semibold text-white hover:bg-violet-700">Sign in</button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Current Plan */}
          <div className="rounded-2xl bg-white border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Current plan</h2>
            {loading ? (
              <p className="text-gray-400 text-sm">Loading…</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${
                      tier === 'studio' ? 'bg-indigo-100 text-indigo-700' :
                      tier === 'pro' ? 'bg-violet-100 text-violet-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{tier ?? 'starter'}</span>
                    <p className="text-sm text-gray-500 pt-2">
                      {isUnlimited ? `${analysesUsed} analyses used` : `${analysesUsed} / ${analysesLimit} analyses this month`}
                    </p>
                  </div>
                </div>

                {tier === 'starter' && (
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => upgrade('pro')}
                      disabled={upgrading}
                      className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                    >
                      Upgrade to Pro — $9/mo
                    </button>
                    <button
                      onClick={() => upgrade('studio')}
                      disabled={upgrading}
                      className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:border-violet-300 hover:text-violet-600 disabled:opacity-50 transition-colors"
                    >
                      Upgrade to Studio — $29/mo
                    </button>
                  </div>
                )}
                {tier === 'pro' && (
                  <button
                    onClick={() => upgrade('studio')}
                    disabled={upgrading}
                    className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:border-violet-300 hover:text-violet-600 disabled:opacity-50"
                  >
                    Upgrade to Studio — $29/mo
                  </button>
                )}
              </>
            )}
          </div>

          {/* API Keys (Studio only) */}
          {tier === 'studio' && (
            <div className="rounded-2xl bg-white border border-gray-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">API Keys</h2>
                {!keysLoaded && (
                  <button onClick={loadKeys} className="text-sm text-violet-600 hover:underline">Load keys</button>
                )}
              </div>

              {revealedKey && (
                <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-2">
                  <p className="text-sm font-medium text-green-800">Key generated — copy it now, it won't be shown again.</p>
                  <code className="block text-xs bg-green-100 rounded-lg px-3 py-2 break-all">{revealedKey}</code>
                  <button onClick={() => { navigator.clipboard.writeText(revealedKey); setRevealedKey(null) }}
                    className="text-sm text-green-700 font-medium hover:underline">Copy & dismiss</button>
                </div>
              )}

              {keysLoaded && (
                <div className="space-y-2">
                  {keys.map((k) => (
                    <div key={k.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium text-gray-900">{k.name}</p>
                        <p className="text-xs text-gray-400">Created {new Date(k.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button onClick={() => revokeKey(k.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Revoke</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Key name (e.g. My script)"
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <button
                  onClick={generateKey}
                  disabled={!newKeyName.trim()}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  Generate
                </button>
              </div>
            </div>
          )}
        </SignedIn>
      </main>
    </div>
  )
}
