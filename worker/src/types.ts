export interface Env {
  AI: Ai
  DB: D1Database
  CLERK_JWKS_URL: string
  POLAR_ACCESS_TOKEN: string      // Polar.sh API access token
  POLAR_PRO_PRODUCT_ID: string    // Price ID for Pro plan
  POLAR_STUDIO_PRODUCT_ID: string // Price ID for Studio plan
  POLAR_WEBHOOK_SECRET: string    // Polar webhook signing secret (base64)
}

export interface AnalyzeRequest {
  image: string
  mimeType: string
}

export interface AnalyzeResponse {
  success: true
  prompt: string
}

export interface ErrorResponse {
  success: false
  error: string
  message: string
}

export interface UserRow {
  id: string
  polar_customer_id: string | null
  polar_subscription_id: string | null
  tier: 'starter' | 'pro' | 'studio'
  analyses_used: number
  analyses_reset_at: string
  created_at: string
}
