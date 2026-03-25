// Polar.sh REST API wrapper (no SDK — uses native fetch)
// Docs: https://docs.polar.sh/api

const POLAR_API = 'https://api.polar.sh/v1'

export async function createCheckout(opts: {
  accessToken: string
  productPriceId: string
  email?: string
  metadata: Record<string, string>
  successUrl: string
}): Promise<string> {
  const res = await fetch(`${POLAR_API}/checkouts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_price_id: opts.productPriceId,
      success_url: opts.successUrl,
      customer_email: opts.email,
      metadata: opts.metadata,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Polar checkout error: ${res.status} ${err}`)
  }

  const json = await res.json() as { url: string }
  return json.url
}

// Polar uses the Standard Webhooks spec:
// https://www.standardwebhooks.com/
// Signed content: "{webhook-id}.{webhook-timestamp}.{rawBody}"
// Secret is base64-encoded; signature header: "v1,<base64-hmac-sha256>"
export async function verifyWebhookSignature(
  rawBody: string,
  webhookId: string,
  webhookTimestamp: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder()

  // Strip Polar's prefix (polar_whs_<base64>) before decoding
  const rawSecret = secret.startsWith('polar_whs_') ? secret.slice('polar_whs_'.length) : secret
  const secretBytes = Uint8Array.from(atob(rawSecret), (c) => c.charCodeAt(0))

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(signedContent))
  const computed = btoa(String.fromCharCode(...new Uint8Array(mac)))

  // Header may contain multiple comma-separated signatures: "v1,<sig1> v1,<sig2>"
  const signatures = signatureHeader.split(' ')
  return signatures.some((sig) => {
    const [, value] = sig.split(',')
    return value === computed
  })
}

// Map Polar product price IDs to our tiers
// Set via wrangler secrets: POLAR_PRO_PRODUCT_ID, POLAR_STUDIO_PRODUCT_ID
export function productToTier(priceId: string, proId: string, studioId: string): 'pro' | 'studio' | null {
  if (priceId === proId) return 'pro'
  if (priceId === studioId) return 'studio'
  return null
}
