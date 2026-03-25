import { Env } from '../types'
import { SYSTEM_PROMPT } from '../lib/prompts'
import { validateMimeType, validateBodySize } from '../lib/validation'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function jsonError(status: number, error: string, message: string): Response {
  return new Response(JSON.stringify({ success: false, error, message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

export async function handleAnalyze(request: Request, env: Env): Promise<Response> {
  // Guard: body size via Content-Length header
  if (!validateBodySize(request.headers.get('content-length'))) {
    return jsonError(413, 'PAYLOAD_TOO_LARGE', 'Image must be under 4 MB after encoding.')
  }

  // Parse JSON body
  let body: { image?: unknown; mimeType?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON.')
  }

  const { image, mimeType } = body

  // Validate fields
  if (typeof image !== 'string' || image.length === 0 || typeof mimeType !== 'string' || mimeType.length === 0) {
    return jsonError(400, 'MISSING_FIELDS', 'Both "image" (base64) and "mimeType" fields are required.')
  }

  if (!validateMimeType(mimeType)) {
    return jsonError(400, 'INVALID_MIME_TYPE', 'Accepted formats: image/jpeg, image/png, image/webp, image/gif')
  }

  // Ensure the image has a proper data URI prefix for the model's image_url field.
  // If the client sent raw base64 (no prefix), reconstruct it.
  const dataUri = image.startsWith('data:')
    ? image
    : `data:${mimeType};base64,${image}`

  // Validate the base64 portion is decodable before hitting the AI
  try {
    atob(dataUri.replace(/^data:[^;]+;base64,/, '').slice(0, 64))
  } catch {
    return jsonError(400, 'INVALID_IMAGE_DATA', 'The image field could not be decoded as Base64.')
  }

  // Decode data URI → number[] for @cf/llava-hf/llava-1.5-7b-hf
  // Schema: { image: number[], prompt: string, max_tokens?: number }
  // Output: { description: string }
  const base64Only = dataUri.replace(/^data:[^;]+;base64,/, '')
  const imageBytes = Array.from(Uint8Array.from(atob(base64Only), (c) => c.charCodeAt(0)))

  // The model key is not in workers-types AiModels map so we cast to any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ai = env.AI as any
  let result: { response?: string; description?: string }
  try {
    result = await ai.run('@cf/llava-hf/llava-1.5-7b-hf', {
      image: imageBytes,
      prompt: SYSTEM_PROMPT,
      max_tokens: 512,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Workers AI error:', msg)
    return jsonError(502, 'AI_INFERENCE_FAILED', msg)
  }

  const promptText = (result.description ?? result.response ?? '').trim()

  if (!promptText) {
    return jsonError(502, 'AI_EMPTY_RESPONSE', 'The vision model returned an empty response.')
  }

  return new Response(JSON.stringify({ success: true, prompt: promptText }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}
