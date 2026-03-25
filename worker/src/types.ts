export interface Env {
  AI: Ai
  DB: D1Database
  CLERK_JWKS_URL: string
  LS_API_KEY: string          // Lemon Squeezy API key
  LS_STORE_ID: string         // Lemon Squeezy store ID
  LS_PRO_VARIANT_ID: string   // Variant ID for Pro plan
  LS_STUDIO_VARIANT_ID: string // Variant ID for Studio plan
  LS_WEBHOOK_SECRET: string   // Lemon Squeezy webhook signing secret
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
  ls_customer_id: string | null
  ls_subscription_id: string | null
  tier: 'starter' | 'pro' | 'studio'
  analyses_used: number
  analyses_reset_at: string
  created_at: string
}
