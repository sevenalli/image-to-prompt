import { Env } from '../types'
import { verifyWebhookSignature, variantToTier } from '../lib/lemonsqueezy'

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' }

export async function handleLsWebhook(request: Request, env: Env): Promise<Response> {
  const rawBody = await request.text()
  const signature = request.headers.get('X-Signature') ?? ''

  const valid = await verifyWebhookSignature(rawBody, signature, env.LS_WEBHOOK_SECRET)
  if (!valid) {
    return new Response('Invalid signature', { status: 401, headers: CORS_HEADERS })
  }

  let event: { meta: { event_name: string; custom_data?: Record<string, string> }; data: { attributes: Record<string, unknown> } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: CORS_HEADERS })
  }

  const eventName = event.meta.event_name
  const customData = event.meta.custom_data ?? {}
  const attrs = event.data.attributes
  const userId = customData.user_id as string | undefined

  if (!userId) {
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }

  try {
    if (eventName === 'order_created' || eventName === 'subscription_created') {
      const attrsAny = attrs as Record<string, unknown>
      const firstItem = attrsAny.first_subscription_item as Record<string, unknown> | undefined
      const variantId = String(attrsAny.variant_id ?? firstItem?.variant_id ?? '')
      const tier = variantToTier(variantId, env.LS_PRO_VARIANT_ID, env.LS_STUDIO_VARIANT_ID)
      const lsCustomerId = String(attrs.customer_id ?? '')
      const lsSubId = String(attrs.id ?? '')

      if (tier) {
        await env.DB.prepare(
          `UPDATE users SET tier = ?, ls_customer_id = ?, ls_subscription_id = ?, analyses_used = 0 WHERE id = ?`
        ).bind(tier, lsCustomerId, lsSubId, userId).run()
      }

    } else if (eventName === 'subscription_updated') {
      const variantId = String(attrs.variant_id ?? '')
      const tier = variantToTier(variantId, env.LS_PRO_VARIANT_ID, env.LS_STUDIO_VARIANT_ID)
      const status = String(attrs.status ?? '')
      // If subscription expired/cancelled, downgrade to starter
      if (status === 'expired' || status === 'cancelled') {
        await env.DB.prepare(`UPDATE users SET tier = 'starter' WHERE id = ?`).bind(userId).run()
      } else if (tier) {
        await env.DB.prepare(`UPDATE users SET tier = ? WHERE id = ?`).bind(tier, userId).run()
      }

    } else if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
      await env.DB.prepare(`UPDATE users SET tier = 'starter' WHERE id = ?`).bind(userId).run()
    }
  } catch (err) {
    console.error('Webhook DB error:', err)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}
