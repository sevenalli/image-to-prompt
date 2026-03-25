import { Link } from 'react-router-dom'

interface PricingCardProps {
  name: string
  price: string
  period?: string
  limit: string
  features: string[]
  highlighted?: boolean
  ctaLabel: string
  ctaHref: string
}

export function PricingCard({ name, price, period, limit, features, highlighted, ctaLabel, ctaHref }: PricingCardProps) {
  const isExternal = ctaHref.startsWith('http')

  return (
    <div className={[
      'relative flex flex-col rounded-2xl p-8 space-y-6 border transition-all',
      highlighted
        ? 'border-violet-500 bg-gray-900 shadow-xl shadow-violet-500/10 scale-105'
        : 'border-gray-800 bg-gray-900 hover:border-gray-700',
    ].join(' ')}>
      {highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-violet-600 px-4 py-1 text-xs font-bold text-white uppercase tracking-wider">
            Most Popular
          </span>
        </div>
      )}

      <div className="space-y-1">
        <h3 className="text-lg font-bold text-white">{name}</h3>
        <div className="flex items-end gap-1">
          <span className="text-4xl font-extrabold text-white">{price}</span>
          {period && <span className="text-gray-400 mb-1">/{period}</span>}
        </div>
        <p className="text-sm text-gray-400">{limit}</p>
      </div>

      <ul className="space-y-2.5 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {f}
          </li>
        ))}
      </ul>

      {isExternal ? (
        <a
          href={ctaHref}
          target="_blank"
          rel="noopener noreferrer"
          className={[
            'block w-full rounded-xl px-6 py-3 text-center font-semibold transition-colors',
            highlighted
              ? 'bg-violet-600 text-white hover:bg-violet-500'
              : 'border border-gray-700 text-gray-300 hover:border-violet-500/50 hover:text-white',
          ].join(' ')}
        >
          {ctaLabel}
        </a>
      ) : (
        <Link
          to={ctaHref}
          className={[
            'block w-full rounded-xl px-6 py-3 text-center font-semibold transition-colors',
            highlighted
              ? 'bg-violet-600 text-white hover:bg-violet-500'
              : 'border border-gray-700 text-gray-300 hover:border-violet-500/50 hover:text-white',
          ].join(' ')}
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  )
}
