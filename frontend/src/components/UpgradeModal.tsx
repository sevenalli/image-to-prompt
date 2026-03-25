import { Link } from 'react-router-dom'

interface UpgradeModalProps {
  onClose: () => void
}

export function UpgradeModal({ onClose }: UpgradeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl">🚀</div>
          <h2 className="text-2xl font-bold text-gray-900">You've used your free analyses</h2>
          <p className="text-gray-500">Create a free account for 10/month, or upgrade for more.</p>
        </div>

        <div className="space-y-3">
          <Link
            to="/app"
            onClick={onClose}
            className="block w-full rounded-xl bg-violet-600 px-6 py-3 text-center font-semibold text-white hover:bg-violet-700 transition-colors"
          >
            Get started free — 10/mo
          </Link>
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/settings"
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-3 text-center transition-colors hover:border-violet-300"
            >
              <p className="font-semibold text-gray-900">Pro</p>
              <p className="text-sm text-gray-500">$9/mo · 200/mo</p>
            </Link>
            <Link
              to="/settings"
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-3 text-center transition-colors hover:border-violet-300"
            >
              <p className="font-semibold text-gray-900">Studio</p>
              <p className="text-sm text-gray-500">$29/mo · Unlimited</p>
            </Link>
          </div>
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
