import { Env } from '../types'
import { getOrCreateUser } from '../lib/d1'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
}

export async function handleHistory(userId: string, env: Env): Promise<Response> {
  const user = await getOrCreateUser(env.DB, userId)
  if (user.tier === 'starter') {
    return new Response(
      JSON.stringify({ success: false, error: 'PRO_REQUIRED', message: 'Analysis history requires the Pro or Studio plan.' }),
      { status: 403, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    )
  }

  const { results } = await env.DB
    .prepare('SELECT id, prompt_length, created_at FROM analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .bind(userId)
    .all<{ id: string; prompt_length: number; created_at: string }>()

  return new Response(JSON.stringify({ analyses: results }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}
