import { Env } from '../types'
import { getOrCreateUser, resetUsageIfNeeded, getTierLimit } from '../lib/d1'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
}

export async function handleUsage(userId: string, env: Env): Promise<Response> {
  const user = await getOrCreateUser(env.DB, userId)
  const fresh = await resetUsageIfNeeded(env.DB, user)
  const limit = getTierLimit(fresh.tier)

  return new Response(
    JSON.stringify({
      tier: fresh.tier,
      analysesUsed: fresh.analyses_used,
      analysesLimit: limit === Infinity ? null : limit,
      resetsAt: fresh.analyses_reset_at,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
  )
}
