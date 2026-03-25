import { useState } from 'react'
import { useImageAnalyzer } from '../../hooks/useImageAnalyzer'
import { ImageDropzone } from '../ImageDropzone'
import { LoadingSpinner } from '../LoadingSpinner'
import { PromptOutput } from '../PromptOutput'
import { UpgradeModal } from '../UpgradeModal'

const FREE_TRIES_KEY = 'itp_free_tries'
const MAX_FREE_TRIES = 3

function getFreeTries(): number {
  return parseInt(localStorage.getItem(FREE_TRIES_KEY) ?? '0', 10)
}
function incrementFreeTries() {
  localStorage.setItem(FREE_TRIES_KEY, String(getFreeTries() + 1))
}

export function DemoEmbed() {
  const { status, prompt, errorMessage, analyze, reset } = useImageAnalyzer()
  const [showUpgrade, setShowUpgrade] = useState(false)

  function handleFile(file: File) {
    if (getFreeTries() >= MAX_FREE_TRIES) {
      setShowUpgrade(true)
      return
    }
    incrementFreeTries()
    reset()
    analyze(file)
  }

  return (
    <section className="bg-gray-50 py-20 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-gray-900">Try it right now</h2>
          <p className="text-gray-500">No sign-up needed for your first 3 analyses.</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-200 space-y-6">
          <ImageDropzone
            onFileSelected={handleFile}
            disabled={status === 'loading'}
          />
          {status === 'loading' && <LoadingSpinner />}
          {status === 'success' && prompt && <PromptOutput prompt={prompt} />}
          {status === 'error' && errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span className="font-semibold">Error: </span>{errorMessage}
            </div>
          )}
        </div>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </section>
  )
}
