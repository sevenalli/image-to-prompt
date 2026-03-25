import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { validateFileType } from '../lib/imageUtils'

interface ImageDropzoneProps {
  onFileSelected: (file: File) => void
  disabled?: boolean
}

export function ImageDropzone({ onFileSelected, disabled }: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  function handleFile(file: File) {
    if (!validateFileType(file)) {
      setFileError('Unsupported file type. Supported: JPEG, PNG, WebP, GIF.')
      return
    }
    const MAX_SIZE = 4 * 1024 * 1024 // 4 MB
    if (file.size > MAX_SIZE) {
      setFileError(`Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 4 MB.`)
      return
    }
    setFileError(null)
    setPreview(URL.createObjectURL(file))
    onFileSelected(file)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(true)
  }

  function onDragLeave() {
    setDragOver(false)
  }

  function onClick() {
    if (!disabled) inputRef.current?.click()
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          'relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-colors select-none',
          dragOver
            ? 'border-violet-500 bg-violet-50'
            : 'border-gray-300 hover:border-violet-400 hover:bg-gray-50',
          disabled ? 'opacity-50 pointer-events-none' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={onInputChange}
          disabled={disabled}
        />

        {preview ? (
          <img
            src={preview}
            alt="Preview"
            className="max-h-64 max-w-full rounded-xl object-contain shadow"
          />
        ) : (
          <>
            <svg
              className="h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="text-sm text-gray-500 text-center">
              <span className="font-semibold text-violet-600">Click to upload</span> or drag and drop
              <br />
              <span className="text-xs">JPEG, PNG, WebP, GIF — max 4 MB</span>
            </p>
          </>
        )}
      </div>

      {fileError && (
        <p className="text-sm text-red-500 text-center">{fileError}</p>
      )}
    </div>
  )
}
