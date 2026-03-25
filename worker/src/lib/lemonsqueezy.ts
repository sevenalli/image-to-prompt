// Lemon Squeezy REST API wrapper (no SDK — uses native fetch)
// Docs: https://docs.lemonsqueezy.com/api

const LS_API = 'https://api.lemonsqueezy.com/v1'

export async function createCheckout(opts: {
  apiKey: string
  storeId: string
  variantId: string
  email?: string
  customData: Record<string, string>
  successUrl: string
  cancelUrl: string
}): Promise<string> {
  const res = await fetch(`${LS_API}/checkouts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.apiKey}`,
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_options: { embed: false },
          checkout_data: {
            email: opts.email,
            custom: opts.customData,
          },
          product_options: {
            redirect_url: opts.successUrl,
          },
        },
        relationships: {
          store: { data: { type: 'stores', id: opts.storeId } },
          variant: { data: { type: 'variants', id: opts.variantId } },
        },
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Lemon Squeezy checkout error: ${res.status} ${err}`)
  }

  const json = await res.json() as { data: { attributes: { url: string } } }
  return json.data.attributes.url
}

export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
  const computed = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return computed === signature
}

// Map Lemon Squeezy variant IDs to our tiers
// These are set via wrangler secrets: LS_PRO_VARIANT_ID, LS_STUDIO_VARIANT_ID
export function variantToTier(variantId: string, proId: string, studioId: string): 'pro' | 'studio' | null {
  if (variantId === proId) return 'pro'
  if (variantId === studioId) return 'studio'
  return null
}
