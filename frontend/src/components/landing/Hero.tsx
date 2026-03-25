import { Link } from 'react-router-dom'

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white pt-20 pb-24 px-4">
      {/* Background gradient blobs */}
      <div className="absolute -top-40 -right-32 w-[600px] h-[600px] rounded-full bg-violet-100 opacity-50 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-indigo-100 opacity-40 blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-4xl text-center space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-200 px-4 py-1.5 text-sm text-violet-700 font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
          </span>
          Powered by Cloudflare Workers AI
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight">
          Turn any image into a{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">
            perfect AI prompt
          </span>
        </h1>

        <p className="mx-auto max-w-2xl text-xl text-gray-500 leading-relaxed">
          Upload a photo, artwork, or screenshot and get a detailed, copyable text prompt that recreates it — instantly, at the edge.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/app"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-200 hover:bg-violet-700 transition-colors"
          >
            Try it free
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <a
            href="#pricing"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 hover:border-violet-300 hover:text-violet-600 transition-colors"
          >
            See pricing
          </a>
        </div>

        <p className="text-sm text-gray-400">No credit card required · 10 free analyses/month</p>
      </div>
    </section>
  )
}
