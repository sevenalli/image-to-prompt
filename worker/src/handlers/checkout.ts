import { Env } from '../types'
import { createCheckout } from '../lib/polar'
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

  const productPriceId = plan === 'pro' ? env.POLAR_PRO_PRODUCT_ID : env.POLAR_STUDIO_PRODUCT_ID
  const user = await getOrCreateUser(env.DB, userId)
  const origin = request.headers.get('Origin') ?? 'https://image-to-prompt-17m.pages.dev'

  try {
    const url = await createCheckout({
      accessToken: env.POLAR_ACCESS_TOKEN,
      productPriceId,
      metadata: {
        user_id: userId,
        plan,
        ...(user.polar_customer_id ? { customer_id: user.polar_customer_id } : {}),
      },
      successUrl: `${origin}/settings?upgraded=1`,
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
