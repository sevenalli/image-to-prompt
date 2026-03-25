import { Link } from 'react-router-dom'
import { Hero } from '../components/landing/Hero'
import { DemoEmbed } from '../components/landing/DemoEmbed'
import { Features } from '../components/landing/Features'
import { PricingCard } from '../components/landing/PricingCard'
import { Faq } from '../components/landing/Faq'

// Polar checkout URLs — optionally set these to direct Polar checkout links
// polar.sh → Products → Checkout Links → copy link
// If not set, upgrade buttons redirect to /app where users can upgrade from Settings
const POLAR_PRO_URL = import.meta.env.VITE_POLAR_PRO_URL ?? '/app'
const POLAR_STUDIO_URL = import.meta.env.VITE_POLAR_STUDIO_URL ?? '/app'

const plans = [
  {
    name: 'Starter',
    price: '$0',
    limit: '10 analyses / month',
    features: [
      'Detailed AI-generated prompts',
      'JPEG, PNG, WebP, GIF support',
      'Client-side image resize',
      'Copy to clipboard',
    ],
    ctaLabel: 'Get started free',
    ctaHref: '/app',
  },
  {
    name: 'Pro',
    price: '$9',
    period: 'mo',
    limit: '200 analyses / month',
    features: [
      'Everything in Starter',
      '200 analyses per month',
      'Analysis history (30 days)',
      'Priority inference queue',
    ],
    highlighted: true,
    ctaLabel: 'Upgrade to Pro',
    ctaHref: POLAR_PRO_URL,
  },
  {
    name: 'Studio',
    price: '$29',
    period: 'mo',
    limit: 'Unlimited analyses',
    features: [
      'Everything in Pro',
      'Unlimited analyses',
      'REST API access',
      'API key management',
      'Bulk processing support',
    ],
    ctaLabel: 'Upgrade to Studio',
    ctaHref: POLAR_STUDIO_URL,
  },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Nav */}
      <nav className="sticky top-0 z-20 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl">🖼️</span>
            <span className="font-bold text-white">Image <span className="text-violet-400">→</span> Prompt</span>
          </Link>
          <div className="flex items-center gap-4">
            <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
            <Link
              to="/app"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
            >
              Try free
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <Hero />
        <DemoEmbed />
        <Features />

        {/* Pricing */}
        <section id="pricing" className="bg-gray-900/50 py-20 px-4">
          <div className="mx-auto max-w-5xl space-y-12">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold text-white">Simple, transparent pricing</h2>
              <p className="text-gray-400">Start free. Upgrade when you need more.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {plans.map((plan) => (
                <PricingCard key={plan.name} {...plan} />
              ))}
            </div>

            <p className="text-center text-sm text-gray-500">
              Payments securely handled by{' '}
              <a href="https://polar.sh" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">
                Polar
              </a>
              {' '}· Cancel anytime · VAT handled automatically
            </p>
          </div>
        </section>

        <Faq />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-950 py-10 px-4">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span>🖼️</span>
            <span className="font-semibold text-gray-300">Image → Prompt</span>
          </div>
          <p>© {new Date().getFullYear()} Image-to-Prompt. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/app" className="hover:text-gray-300 transition-colors">App</Link>
            <a href="#pricing" className="hover:text-gray-300 transition-colors">Pricing</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
