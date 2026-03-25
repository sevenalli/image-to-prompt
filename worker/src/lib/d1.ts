import { D1Database } from '@cloudflare/workers-types'
import { UserRow } from '../types'

function firstOfNextMonth(): string {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + 1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export function getTierLimit(tier: string): number {
  if (tier === 'pro') return 200
  if (tier === 'studio') return Infinity
  return 10 // starter
}

export async function getOrCreateUser(db: D1Database, userId: string): Promise<UserRow> {
  const existing = await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first<UserRow>()
  if (existing) return existing

  const resetAt = firstOfNextMonth()
  await db
    .prepare('INSERT INTO users (id, tier, analyses_used, analyses_reset_at) VALUES (?, \'starter\', 0, ?)')
    .bind(userId, resetAt)
    .run()

  return {
    id: userId,
    ls_customer_id: null,
    ls_subscription_id: null,
    tier: 'starter',
    analyses_used: 0,
    analyses_reset_at: resetAt,
    created_at: new Date().toISOString(),
  }
}

export async function resetUsageIfNeeded(db: D1Database, user: UserRow): Promise<UserRow> {
  const now = new Date()
  const resetAt = new Date(user.analyses_reset_at)
  if (now < resetAt) return user

  const newResetAt = firstOfNextMonth()
  await db
    .prepare('UPDATE users SET analyses_used = 0, analyses_reset_at = ? WHERE id = ?')
    .bind(newResetAt, user.id)
    .run()

  return { ...user, analyses_used: 0, analyses_reset_at: newResetAt }
}

export async function incrementUsage(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare('UPDATE users SET analyses_used = analyses_used + 1 WHERE id = ?')
    .bind(userId)
    .run()
}

export async function saveAnalysis(db: D1Database, userId: string, promptLength: number): Promise<void> {
  const id = crypto.randomUUID()
  await db
    .prepare('INSERT INTO analyses (id, user_id, prompt_length) VALUES (?, ?, ?)')
    .bind(id, userId, promptLength)
    .run()
}
