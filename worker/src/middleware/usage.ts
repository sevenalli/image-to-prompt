import { Env } from '../types'
import { getOrCreateUser, resetUsageIfNeeded, getTierLimit } from '../lib/d1'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
}

export async function usageMiddleware(userId: string, env: Env): Promise<Response | null> {
  const user = await getOrCreateUser(env.DB, userId)
  const fresh = await resetUsageIfNeeded(env.DB, user)
  const limit = getTierLimit(fresh.tier)

  if (fresh.analyses_used >= limit) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'QUOTA_EXCEEDED',
        message: `You've used all ${limit} analyses for this month. Upgrade your plan for more.`,
        tier: fresh.tier,
        limit,
        used: fresh.analyses_used,
      }),
      { status: 429, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    )
  }

  return null
}
