import { Env } from './types'
import { handleAnalyze } from './handlers/analyze'
import { handleUsage } from './handlers/usage'
import { handleCheckout } from './handlers/checkout'
import { handlePolarWebhook } from './handlers/polarWebhook'
import { handleApiKeys } from './handlers/apiKeys'
import { handleHistory } from './handlers/history'
import { authMiddleware } from './middleware/auth'
import { usageMiddleware } from './middleware/usage'
import { incrementUsage, saveAnalysis } from './lib/d1'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
}

function jsonError(status: number, error: string, message: string): Response {
  return new Response(JSON.stringify({ success: false, error, message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    const path = url.pathname

    // ── Polar webhook — no auth, signature-verified internally
    if (path === '/api/webhooks/polar') {
      return handlePolarWebhook(request, env)
    }

    // ── Auth-required routes
    const userId = env.CLERK_JWKS_URL ? await authMiddleware(request, env) : null

    if (path === '/api/analyze') {
      if (request.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'Only POST.')

      // Run usage gate for authenticated users
      if (userId && env.DB) {
        const block = await usageMiddleware(userId, env)
        if (block) return block
      }

      const response = await handleAnalyze(request, env)

      // On success: increment usage + save to history
      if (userId && env.DB && response.ok) {
        const clone = response.clone()
        const json = await clone.json() as { success: boolean; prompt?: string }
        if (json.success && json.prompt) {
          await incrementUsage(env.DB, userId)
          await saveAnalysis(env.DB, userId, json.prompt.length)
        }
      }

      return response
    }

    if (path === '/api/usage') {
      if (!userId) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.')
      return handleUsage(userId, env)
    }

    if (path === '/api/checkout') {
      if (!userId) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.')
      if (request.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'Only POST.')
      return handleCheckout(userId, request, env)
    }

    if (path === '/api/history') {
      if (!userId) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.')
      return handleHistory(userId, env)
    }

    // API keys: /api/keys and /api/keys/:id
    const keysMatch = path.match(/^\/api\/keys\/?([^/]*)$/)
    if (keysMatch) {
      if (!userId) return jsonError(401, 'UNAUTHORIZED', 'Authentication required.')
      const keyId = keysMatch[1] || null
      return handleApiKeys(request.method, userId, keyId, request, env)
    }

    return new Response('Not Found', { status: 404 })
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    if (!env.DB) return
    await env.DB.prepare(
      `UPDATE users SET analyses_used = 0, analyses_reset_at = datetime('now', 'start of month', '+1 month')`
    ).run()
  },
}
