import { Env, UserRow } from '../types'
import { getOrCreateUser } from '../lib/d1'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
}

function jsonError(status: number, error: string, message: string): Response {
  return new Response(JSON.stringify({ success: false, error, message }), {
    status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

async function hashKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function handleApiKeys(method: string, userId: string, keyId: string | null, request: Request, env: Env): Promise<Response> {
  const user = await getOrCreateUser(env.DB, userId) as UserRow
  if (user.tier !== 'studio') {
    return jsonError(403, 'STUDIO_REQUIRED', 'API key management requires the Studio plan.')
  }

  // GET /api/keys
  if (method === 'GET') {
    const { results } = await env.DB
      .prepare('SELECT id, name, created_at, last_used FROM api_keys WHERE user_id = ? ORDER BY created_at DESC')
      .bind(userId)
      .all<{ id: string; name: string; created_at: string; last_used: string | null }>()
    return new Response(JSON.stringify({ keys: results }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }

  // POST /api/keys
  if (method === 'POST') {
    let body: { name?: string }
    try { body = await request.json() } catch { return jsonError(400, 'INVALID_JSON', 'Body must be JSON.') }
    if (!body.name?.trim()) return jsonError(400, 'MISSING_NAME', 'Key name is required.')

    // Generate: sk_live_<32 random hex chars>
    const raw = new Uint8Array(16)
    crypto.getRandomValues(raw)
    const key = 'sk_live_' + Array.from(raw).map((b) => b.toString(16).padStart(2, '0')).join('')
    const id = crypto.randomUUID()
    const hash = await hashKey(key)

    await env.DB
      .prepare('INSERT INTO api_keys (id, user_id, key_hash, name) VALUES (?, ?, ?, ?)')
      .bind(id, userId, hash, body.name.trim())
      .run()

    return new Response(JSON.stringify({ id, key }), {
      status: 201, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }

  // DELETE /api/keys/:id
  if (method === 'DELETE' && keyId) {
    const row = await env.DB
      .prepare('SELECT id FROM api_keys WHERE id = ? AND user_id = ?')
      .bind(keyId, userId)
      .first()
    if (!row) return jsonError(404, 'NOT_FOUND', 'API key not found.')
    await env.DB.prepare('DELETE FROM api_keys WHERE id = ?').bind(keyId).run()
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not supported.')
}
