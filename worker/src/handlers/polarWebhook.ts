import { Env } from '../types'
import { verifyWebhookSignature, productToTier } from '../lib/polar'

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' }

export async function handlePolarWebhook(request: Request, env: Env): Promise<Response> {
  const rawBody = await request.text()

  const webhookId = request.headers.get('webhook-id') ?? ''
  const webhookTimestamp = request.headers.get('webhook-timestamp') ?? ''
  const webhookSignature = request.headers.get('webhook-signature') ?? ''

  const valid = await verifyWebhookSignature(
    rawBody,
    webhookId,
    webhookTimestamp,
    webhookSignature,
    env.POLAR_WEBHOOK_SECRET,
  )
  if (!valid) {
    return new Response('Invalid signature', { status: 401, headers: CORS_HEADERS })
  }

  let event: { type: string; data: Record<string, unknown> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: CORS_HEADERS })
  }

  const { type, data } = event
  const metadata = (data.metadata ?? {}) as Record<string, string>
  const userId = metadata.user_id as string | undefined

  if (!userId) {
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }

  try {
    if (type === 'subscription.created') {
      const priceId = String(data.price_id ?? '')
      const tier = productToTier(priceId, env.POLAR_PRO_PRODUCT_ID, env.POLAR_STUDIO_PRODUCT_ID)
      const polarCustomerId = String((data.user as Record<string, unknown>)?.id ?? '')
      const polarSubId = String(data.id ?? '')

      if (tier) {
        await env.DB.prepare(
          `UPDATE users SET tier = ?, polar_customer_id = ?, polar_subscription_id = ?, analyses_used = 0 WHERE id = ?`
        ).bind(tier, polarCustomerId, polarSubId, userId).run()
      }

    } else if (type === 'subscription.updated') {
      const priceId = String(data.price_id ?? '')
      const status = String(data.status ?? '')
      const tier = productToTier(priceId, env.POLAR_PRO_PRODUCT_ID, env.POLAR_STUDIO_PRODUCT_ID)

      if (status === 'canceled' || status === 'revoked') {
        await env.DB.prepare(`UPDATE users SET tier = 'starter' WHERE id = ?`).bind(userId).run()
      } else if (tier) {
        await env.DB.prepare(`UPDATE users SET tier = ? WHERE id = ?`).bind(tier, userId).run()
      }

    } else if (type === 'subscription.canceled' || type === 'subscription.revoked') {
      await env.DB.prepare(`UPDATE users SET tier = 'starter' WHERE id = ?`).bind(userId).run()
    }
  } catch (err) {
    console.error('Webhook DB error:', err)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}
