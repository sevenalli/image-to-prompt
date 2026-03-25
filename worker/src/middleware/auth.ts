import { Env } from '../types'
import { verifyClerkJwt } from '../lib/clerk'

export async function authMiddleware(request: Request, env: Env): Promise<string | null> {
  // 1. Try Clerk JWT from Authorization header
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const userId = await verifyClerkJwt(token, env.CLERK_JWKS_URL)
    if (userId) return userId
  }

  // 2. Try API key from X-API-Key header (Studio tier)
  const apiKey = request.headers.get('X-API-Key')
  if (apiKey && env.DB) {
    const keyHash = await hashApiKey(apiKey)
    const row = await env.DB
      .prepare('SELECT user_id FROM api_keys WHERE key_hash = ?')
      .bind(keyHash)
      .first<{ user_id: string }>()
    if (row) {
      // Update last_used asynchronously
      env.DB.prepare('UPDATE api_keys SET last_used = datetime(\'now\') WHERE key_hash = ?')
        .bind(keyHash)
        .run()
        .catch(() => {})
      return row.user_id
    }
  }

  return null
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(key))
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
