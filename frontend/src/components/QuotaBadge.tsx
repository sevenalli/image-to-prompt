import { Link } from 'react-router-dom'
import { useUsage } from '../hooks/useUsage'

export function QuotaBadge() {
  const { tier, analysesUsed, analysesLimit, loading } = useUsage()

  if (loading || analysesUsed === undefined) return null

  const isUnlimited = analysesLimit === null
  const pct = isUnlimited ? 100 : Math.min((analysesUsed / (analysesLimit ?? 10)) * 100, 100)
  const nearLimit = !isUnlimited && pct >= 80

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {isUnlimited
            ? `${analysesUsed} analyses used this month`
            : `${analysesUsed} / ${analysesLimit} analyses this month`}
        </span>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
            tier === 'studio' ? 'bg-indigo-100 text-indigo-700' :
            tier === 'pro' ? 'bg-violet-100 text-violet-700' :
            'bg-gray-100 text-gray-600'
          }`}>{tier}</span>
          {tier === 'starter' && (
            <Link to="/settings" className="text-xs text-violet-600 font-medium hover:underline">Upgrade</Link>
          )}
        </div>
      </div>

      {!isUnlimited && (
        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${nearLimit ? 'bg-red-500' : 'bg-violet-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}
