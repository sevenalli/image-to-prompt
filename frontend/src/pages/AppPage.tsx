import { Link } from 'react-router-dom'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
import { useImageAnalyzer } from '../hooks/useImageAnalyzer'
import { ImageDropzone } from '../components/ImageDropzone'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PromptOutput } from '../components/PromptOutput'
import { QuotaBadge } from '../components/QuotaBadge'

export function AppPage() {
  const { status, prompt, errorMessage, analyze, reset } = useImageAnalyzer()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-xl">🖼️</span>
            <span className="font-bold text-gray-900">Image <span className="text-violet-600">→</span> Prompt</span>
          </Link>
          <div className="flex items-center gap-3">
            <SignedIn>
              <Link to="/history" className="hidden sm:block text-sm text-gray-500 hover:text-gray-900 transition-colors">History</Link>
              <Link to="/settings" className="hidden sm:block text-sm text-gray-500 hover:text-gray-900 transition-colors">Settings</Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Reverse-engineer any image into a prompt</h1>
          <p className="text-gray-500">Upload an image and get a detailed text prompt you can use to recreate it.</p>
        </div>

        <SignedIn>
          <QuotaBadge />
        </SignedIn>

        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-200 space-y-6">
          <ImageDropzone
            onFileSelected={(file) => { reset(); analyze(file) }}
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
      </main>
    </div>
  )
}
