interface JwksKey {
  kty: string
  kid: string
  n: string
  e: string
  alg: string
  use: string
}

interface JwksResponse {
  keys: JwksKey[]
}

// Module-level JWKS cache: kid → CryptoKey, expires at timestamp
const jwksCache = new Map<string, { key: CryptoKey; expiresAt: number }>()
let jwksCacheTime = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function base64UrlToUint8Array(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    b64.length + (4 - (b64.length % 4)) % 4, '='
  )
  const binary = atob(padded)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

async function fetchJwks(jwksUrl: string): Promise<void> {
  const now = Date.now()
  if (now < jwksCacheTime + CACHE_TTL_MS) return

  const res = await fetch(jwksUrl)
  if (!res.ok) throw new Error('Failed to fetch JWKS')
  const data: JwksResponse = await res.json()

  jwksCache.clear()
  for (const jwk of data.keys) {
    if (jwk.kty !== 'RSA' || jwk.alg !== 'RS256') continue
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: jwk.alg, use: jwk.use },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    jwksCache.set(jwk.kid, { key, expiresAt: now + CACHE_TTL_MS })
  }
  jwksCacheTime = now
}

function parseJwtParts(token: string): { header: Record<string, string>; payload: Record<string, unknown>; signature: Uint8Array; signingInput: string } | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')))
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    const signature = base64UrlToUint8Array(parts[2])
    const signingInput = `${parts[0]}.${parts[1]}`
    return { header, payload, signature, signingInput }
  } catch {
    return null
  }
}

export async function verifyClerkJwt(token: string, jwksUrl: string): Promise<string | null> {
  try {
    await fetchJwks(jwksUrl)
    const parsed = parseJwtParts(token)
    if (!parsed) return null

    const { header, payload, signature, signingInput } = parsed
    const cached = jwksCache.get(header.kid as string)
    if (!cached) return null

    const encoder = new TextEncoder()
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cached.key,
      signature,
      encoder.encode(signingInput),
    )
    if (!valid) return null

    // Check expiry
    const exp = payload.exp as number | undefined
    if (exp && Date.now() / 1000 > exp) return null

    return (payload.sub as string) ?? null
  } catch {
    return null
  }
}
