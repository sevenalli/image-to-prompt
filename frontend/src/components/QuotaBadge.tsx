import { Link } from 'react-router-dom'
import { useUsage } from '../hooks/useUsage'

export function QuotaBadge() {
  const { tier, analysesUsed, analysesLimit, resetsAt, loading } = useUsage()

  if (loading || analysesUsed === undefined) return null

  const isUnlimited = analysesLimit === null
  const pct = isUnlimited ? 100 : Math.min((analysesUsed / (analysesLimit ?? 10)) * 100, 100)
  const nearLimit = !isUnlimited && pct >= 80
  const resetDate = resetsAt ? new Date(resetsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 flex items-center gap-1.5">
          {nearLimit && (
            <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          )}
          {isUnlimited
            ? `${analysesUsed} analyses used this month`
            : `${analysesUsed} / ${analysesLimit} analyses this month`}
        </span>
        <div className="flex items-center gap-2">
          {resetDate && !isUnlimited && (
            <span className="text-xs text-gray-400">Resets {resetDate}</span>
          )}
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
        <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${nearLimit ? 'bg-red-500' : 'bg-violet-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}
