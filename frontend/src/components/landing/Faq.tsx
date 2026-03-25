import { useState } from 'react'

const faqs = [
  {
    q: 'What exactly does this do?',
    a: 'You upload an image and our AI vision model reverse-engineers a detailed text prompt that describes it — covering subject, style, lighting, color palette, mood, and camera details. You can paste that prompt into any AI image generator to recreate a similar image.',
  },
  {
    q: 'How accurate are the generated prompts?',
    a: 'Very accurate for photographs, digital art, and illustrations. The LLaVA 1.5 vision model understands composition and style deeply. Results may vary for abstract or highly stylised artwork.',
  },
  {
    q: 'Is my image stored anywhere?',
    a: 'No. Images are processed in memory at the Cloudflare edge and immediately discarded. We never write your image to any database or file storage.',
  },
  {
    q: 'What counts as one analysis?',
    a: 'Each successful image submission that returns a prompt counts as one analysis. Failed or errored requests do not count against your quota.',
  },
  {
    q: 'Can I cancel my subscription anytime?',
    a: 'Yes. You can cancel or downgrade at any time from the Settings page. Your access continues until the end of the current billing period.',
  },
  {
    q: 'Do you support bulk processing?',
    a: 'Studio plan users get REST API access and can programmatically submit images in sequence. A dedicated bulk-upload UI is on the roadmap.',
  },
]

export function Faq() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="bg-white py-20 px-4">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-gray-900">Frequently asked questions</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left font-medium text-gray-900 hover:bg-gray-50 transition-colors"
              >
                {faq.q}
                <svg
                  className={`h-5 w-5 text-gray-400 flex-shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {open === i && (
                <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
