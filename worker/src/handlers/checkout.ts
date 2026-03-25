import { Env } from '../types'
import { createCheckout } from '../lib/lemonsqueezy'
import { getOrCreateUser } from '../lib/d1'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
}

function jsonError(status: number, error: string, message: string): Response {
  return new Response(JSON.stringify({ success: false, error, message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

export async function handleCheckout(userId: string, request: Request, env: Env): Promise<Response> {
  let body: { plan?: string }
  try {
    body = await request.json()
  } catch {
    return jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON.')
  }

  const { plan } = body
  if (plan !== 'pro' && plan !== 'studio') {
    return jsonError(400, 'INVALID_PLAN', 'Plan must be "pro" or "studio".')
  }

  const variantId = plan === 'pro' ? env.LS_PRO_VARIANT_ID : env.LS_STUDIO_VARIANT_ID
  const user = await getOrCreateUser(env.DB, userId)
  const origin = request.headers.get('Origin') ?? 'https://image-to-prompt-17m.pages.dev'

  try {
    const url = await createCheckout({
      apiKey: env.LS_API_KEY,
      storeId: env.LS_STORE_ID,
      variantId,
      customData: {
        user_id: userId,
        plan,
        ...(user.ls_customer_id ? { customer_id: user.ls_customer_id } : {}),
      },
      successUrl: `${origin}/settings?upgraded=1`,
      cancelUrl: `${origin}/settings`,
    })

    return new Response(JSON.stringify({ success: true, url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(502, 'CHECKOUT_FAILED', msg)
  }
}
