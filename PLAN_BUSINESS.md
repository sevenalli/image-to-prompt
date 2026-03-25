# Image-to-Prompt SaaS — Business Layer Plan
## Marketing, Auth, Subscriptions & Payments

**Base system:** Worker at `worker/`, React SPA at `frontend/`, both live on Cloudflare edge.

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BROWSER  (React SPA — Cloudflare Pages)                                │
│                                                                          │
│  Route /          → Landing page (Hero, Demo, Pricing, FAQ, Footer)     │
│  Route /app       → Tool page (upload + quota badge)                    │
│  Route /history   → Pro+ analysis history                               │
│  Route /settings  → Billing portal + API key management (Studio)        │
│                                                                          │
│  <ClerkProvider> wraps the entire React tree                             │
│  useAuth().getToken() → JWT attached to every /api/* call               │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │  Authorization: Bearer <clerk_jwt>
                               │  X-API-Key: <key>  (Studio tier only)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  CLOUDFLARE WORKER                                                       │
│                                                                          │
│  Middleware stack (runs on every request):                               │
│    1. CORS preflight handler                                             │
│    2. Auth middleware → verifies Clerk JWT via JWKS or API key via D1   │
│    3. Usage middleware → checks D1 quota, returns 429 if exceeded       │
│                                                                          │
│  Routes:                                                                 │
│    POST /api/analyze          → Vision AI (existing, now gated)         │
│    GET  /api/usage            → Return tier + analyses_used + limit     │
│    POST /api/checkout         → Create Stripe Checkout Session          │
│    POST /api/webhooks/stripe  → Stripe webhook → sync D1                │
│    GET  /api/keys             → List API keys (Studio)                  │
│    POST /api/keys             → Generate new API key (Studio)           │
│    DELETE /api/keys/:id       → Revoke API key (Studio)                 │
└──────────────┬────────────────┬──────────────────┬───────────────────────┘
               │                │                  │
               ▼                ▼                  ▼
        Cloudflare D1      Clerk JWKS          Stripe API
        (users table,      (JWT verify)        (checkout,
         analyses table,                        webhooks,
         api_keys table)                        portal)
```

---

## 2. Pricing Tiers

| Tier | Price | Analyses/month | Features |
|---|---|---|---|
| **Starter** | Free | 10 | Basic prompts |
| **Pro** | $9/month | 200 | Detailed prompts, history (last 30 days) |
| **Studio** | $29/month | Unlimited | Everything + REST API access + bulk |

---

## 3. New Repository Structure

```
frontend/
└── src/
    ├── pages/
    │   ├── LandingPage.tsx       # Route /  — Hero, Demo, Pricing, FAQ, Footer
    │   ├── AppPage.tsx           # Route /app — tool (moved from App.tsx)
    │   ├── HistoryPage.tsx       # Route /history — Pro+ gated
    │   └── SettingsPage.tsx      # Route /settings — billing + API keys
    ├── components/
    │   ├── landing/
    │   │   ├── Hero.tsx
    │   │   ├── DemoEmbed.tsx     # Embedded live demo (unauthenticated allowed for 3 tries)
    │   │   ├── Features.tsx
    │   │   ├── PricingCard.tsx
    │   │   └── Faq.tsx
    │   ├── QuotaBadge.tsx        # Shows "X / Y analyses used this month"
    │   └── UpgradeModal.tsx      # Shown when quota hit
    ├── hooks/
    │   └── useUsage.ts           # Fetches GET /api/usage
    └── lib/
        └── api.ts                # Centralised fetch wrapper that attaches Clerk JWT

worker/
└── src/
    ├── middleware/
    │   ├── auth.ts               # Verify Clerk JWT (JWKS) or X-API-Key from D1
    │   └── usage.ts              # Check + increment D1 quota
    ├── handlers/
    │   ├── analyze.ts            # (existing — now called after middleware)
    │   ├── usage.ts              # GET /api/usage
    │   ├── checkout.ts           # POST /api/checkout
    │   ├── stripeWebhook.ts      # POST /api/webhooks/stripe
    │   └── apiKeys.ts            # GET/POST/DELETE /api/keys
    ├── lib/
    │   ├── d1.ts                 # D1 query helpers
    │   ├── stripe.ts             # Stripe client helper
    │   └── clerk.ts              # JWKS fetch + JWT verify
    ├── types.ts                  # Extended Env (+ D1, STRIPE_SECRET, CLERK_JWKS_URL)
    └── index.ts                  # Router (extended)

    schema.sql                    # D1 migration file
```

---

## 4. Database Schema

```sql
-- schema.sql  (run via: wrangler d1 execute image-to-prompt-db --file=schema.sql)

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,          -- Clerk user_id (e.g. user_2abc...)
  stripe_customer_id TEXT,                     -- Set after first checkout
  tier              TEXT NOT NULL DEFAULT 'starter',  -- 'starter' | 'pro' | 'studio'
  analyses_used     INTEGER NOT NULL DEFAULT 0,
  analyses_reset_at TEXT NOT NULL,             -- ISO date: first day of current month
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analyses (
  id            TEXT PRIMARY KEY,              -- nanoid
  user_id       TEXT NOT NULL REFERENCES users(id),
  prompt_length INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  id         TEXT PRIMARY KEY,                 -- nanoid
  user_id    TEXT NOT NULL REFERENCES users(id),
  key_hash   TEXT NOT NULL UNIQUE,             -- sha256 of the raw key
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used  TEXT
);

CREATE INDEX IF NOT EXISTS idx_analyses_user_created ON analyses(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
```

---

## 5. API Specification Additions

### GET `/api/usage`
**Auth required.** Returns current tier and quota.
```json
// 200
{
  "tier": "pro",
  "analysesUsed": 47,
  "analysesLimit": 200,
  "resetsAt": "2026-04-01T00:00:00Z"
}
```

### POST `/api/checkout`
**Auth required.** Creates a Stripe Checkout session.
```json
// Request
{ "priceId": "price_pro_monthly" }

// 200
{ "url": "https://checkout.stripe.com/pay/cs_..." }
```

### POST `/api/webhooks/stripe`
**No auth** (verified via Stripe-Signature header).
Handles events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
```json
// 200
{ "received": true }
```

### GET `/api/keys`
**Auth required, Studio tier only.**
```json
// 200
{
  "keys": [
    { "id": "abc", "name": "My script", "createdAt": "...", "lastUsed": "..." }
  ]
}
```

### POST `/api/keys`
```json
// Request
{ "name": "My script" }
// 201 — raw key only shown once
{ "id": "abc", "key": "sk_live_..." }
```

### DELETE `/api/keys/:id`
```json
// 204 No Content
```

---

## 6. Stripe Integration Flow

```
User clicks "Upgrade to Pro"
        │
        ▼
POST /api/checkout { priceId: "price_pro_monthly" }
        │
        ▼ Worker
1. Look up or create stripe_customer_id in D1 (users table)
2. Call stripe.checkout.sessions.create({
     customer: stripe_customer_id,
     line_items: [{ price: priceId, quantity: 1 }],
     mode: "subscription",
     success_url: "https://app.com/settings?upgraded=1",
     cancel_url:  "https://app.com/settings",
   })
3. Return { url: session.url }
        │
        ▼ Browser
4. window.location.href = url  →  Stripe hosted checkout
        │
        ▼ Stripe (async)
5. Stripe calls POST /api/webhooks/stripe
   Event: checkout.session.completed
        │
        ▼ Worker
6. Verify Stripe-Signature header
7. Extract customer_id + subscription metadata
8. UPDATE users SET tier = 'pro', analyses_used = 0, analyses_reset_at = ... WHERE stripe_customer_id = ...
9. Return { received: true }
```

**Billing Portal (for cancellation/upgrade):**
```
User clicks "Manage Billing"
        │
POST /api/checkout/portal  →  stripe.billingPortal.sessions.create()
        →  redirect to portal URL
```

---

## 7. Execution Roadmap

---

### Phase A — Landing Page (frontend only, no backend changes)

#### A1: Install React Router
- `cd frontend && npm install react-router-dom`
- Wrap `<App>` in `<BrowserRouter>` in `main.tsx`

#### A2: Restructure routing in `App.tsx`
- Define routes: `/` → `<LandingPage>`, `/app` → `<AppPage>`, `/history` → `<HistoryPage>`, `/settings` → `<SettingsPage>`
- Move existing tool UI (ImageDropzone, etc.) into `src/pages/AppPage.tsx`
- `App.tsx` becomes a pure router shell

#### A3: Implement `src/components/landing/Hero.tsx`
- Full-width section with gradient background
- H1: "Turn any image into a perfect AI prompt"
- Subheadline + two CTAs: "Try it free" (→ `/app`) and "See pricing" (smooth scroll)
- Use Tailwind for layout

#### A4: Implement `src/components/landing/DemoEmbed.tsx`
- Embed the `<ImageDropzone>` + `<PromptOutput>` flow inline on the landing page
- Hook into `useImageAnalyzer` — unauthenticated users get 3 free tries (stored in `localStorage`)
- After 3 tries, show `<UpgradeModal>` instead of result

#### A5: Implement `src/components/landing/Features.tsx`
- 3-column card grid: "Edge Fast" / "100% Private" / "AI-Powered"
- Each card: icon (SVG), title, 2-line description

#### A6: Implement `src/components/landing/PricingCard.tsx`
- Accept props: `tier, price, limit, features[], highlighted, ctaLabel, onCtaClick`
- Render 3 instances in a row: Starter ($0), Pro ($9), Studio ($29)
- Highlighted card (Pro) has violet border + "Most Popular" badge

#### A7: Implement `src/components/landing/Faq.tsx`
- Accordion component, 6 questions (What is this? / How accurate? / Is my image stored? / Can I cancel? / What counts as an analysis? / Do you support bulk?)
- Use Tailwind `details/summary` or a simple `useState` toggle per item

#### A8: Implement `src/pages/LandingPage.tsx`
- Compose: `<Hero>` → `<DemoEmbed>` → `<Features>` → pricing section → `<Faq>` → footer
- Footer: logo, copyright, links to Privacy/Terms (placeholder hrefs)

#### A9: Add `_redirects` file for Cloudflare Pages SPA routing
- Create `frontend/public/_redirects` with: `/* /index.html 200`
- This ensures React Router deep links work on page refresh

---

### Phase B — Clerk Authentication

#### B1: Create Clerk application
- Go to clerk.com, create new application, enable "Email" + "Google" sign-in
- Copy `VITE_CLERK_PUBLISHABLE_KEY` → `frontend/.env.local`
- Copy `CLERK_JWKS_URL` (e.g. `https://clerk.your-app.clerk.accounts.dev/.well-known/jwks.json`) → `worker/.dev.vars`

#### B2: Install Clerk React SDK
- `cd frontend && npm install @clerk/clerk-react`

#### B3: Wrap app in `<ClerkProvider>` in `main.tsx`
```tsx
import { ClerkProvider } from '@clerk/clerk-react'
<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
  <App />
</ClerkProvider>
```

#### B4: Add auth UI to header in `AppPage.tsx`
- Import `<SignInButton>`, `<SignedIn>`, `<SignedOut>`, `<UserButton>` from Clerk
- Show `<UserButton>` when signed in, `<SignInButton>` when not

#### B5: Update `src/lib/api.ts` — attach JWT to all API calls
```ts
import { useAuth } from '@clerk/clerk-react'

export function useApi() {
  const { getToken } = useAuth()
  return async function apiFetch(path: string, init?: RequestInit) {
    const token = await getToken()
    return fetch(path, {
      ...init,
      headers: { ...init?.headers, 'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    })
  }
}
```

#### B6: Update `useImageAnalyzer.ts` to use `useApi()`
- Replace raw `fetch` call with `apiFetch` from `useApi()`

#### B7: Implement `worker/src/lib/clerk.ts`
- Export `async function verifyClerkJwt(token: string, jwksUrl: string): Promise<string | null>`
- Fetch JWKS from `jwksUrl` (cache in memory for 5 min with a module-level `Map`)
- Use `crypto.subtle.importKey` + `crypto.subtle.verify` to verify RS256 signature
- Extract and return `sub` (Clerk user ID) or `null` on failure

#### B8: Implement `worker/src/middleware/auth.ts`
- Export `async function authMiddleware(request: Request, env: Env): Promise<string | null>`
- Check `Authorization: Bearer <token>` → call `verifyClerkJwt`
- Check `X-API-Key: <key>` → SHA-256 hash the key, look up in D1 `api_keys` table, update `last_used`
- Return the `user_id` string, or `null` if unauthenticated

#### B9: Update `worker/src/types.ts` — extend `Env`
```ts
export interface Env {
  AI: Ai
  DB: D1Database          // D1 binding
  CLERK_JWKS_URL: string  // secret
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
}
```

#### B10: Update `worker/wrangler.toml` — add D1 binding and secrets
```toml
[[d1_databases]]
binding = "DB"
database_name = "image-to-prompt-db"
database_id = "<run: wrangler d1 create image-to-prompt-db>"
```
- Add secrets via: `wrangler secret put CLERK_JWKS_URL` / `wrangler secret put STRIPE_SECRET_KEY` / `wrangler secret put STRIPE_WEBHOOK_SECRET`

---

### Phase C — D1 Schema + Usage Enforcement

#### C1: Create D1 database
- Run: `cd worker && npx wrangler d1 create image-to-prompt-db`
- Copy the `database_id` output into `wrangler.toml`

#### C2: Apply schema
- Create `worker/schema.sql` with the CREATE TABLE statements from Section 4 above
- Run: `npx wrangler d1 execute image-to-prompt-db --file=schema.sql`

#### C3: Implement `worker/src/lib/d1.ts`
- Export helpers:
  - `getOrCreateUser(db, userId): Promise<User>` — upserts a row in `users` (sets `analyses_reset_at` to first of current month)
  - `incrementUsage(db, userId): Promise<void>` — `UPDATE users SET analyses_used = analyses_used + 1`
  - `resetUsageIfNeeded(db, user): Promise<User>` — if `analyses_reset_at` is past, reset `analyses_used = 0` and update date
  - `getTierLimit(tier: string): number` — returns 10 / 200 / Infinity

#### C4: Implement `worker/src/middleware/usage.ts`
- Export `async function usageMiddleware(userId: string, env: Env): Promise<Response | null>`
- Call `getOrCreateUser` → `resetUsageIfNeeded`
- If `analyses_used >= getTierLimit(tier)` → return 429 JSON `{ error: 'QUOTA_EXCEEDED', tier, limit, used }`
- Otherwise return `null` (continue)

#### C5: Update `worker/src/index.ts` — wire middleware into `/api/analyze`
```ts
// For /api/analyze:
const userId = await authMiddleware(request, env)
// Allow unauthenticated users (counted via IP or not at all on free anonymous plan)
// If authenticated, run usage check
if (userId) {
  const block = await usageMiddleware(userId, env)
  if (block) return block
}
const response = await handleAnalyze(request, env)
// If successful and userId exists, increment usage + save to analyses table
if (userId && response.ok) {
  await incrementUsage(env.DB, userId)
}
return response
```

#### C6: Implement `worker/src/handlers/usage.ts` — `GET /api/usage`
- Auth required (return 401 if no userId)
- `getOrCreateUser` → `resetUsageIfNeeded`
- Return `{ tier, analysesUsed, analysesLimit, resetsAt }`

#### C7: Implement `src/hooks/useUsage.ts` in frontend
- Calls `GET /api/usage` with JWT
- Returns `{ tier, analysesUsed, analysesLimit, resetsAt, loading }`

#### C8: Implement `src/components/QuotaBadge.tsx`
- Uses `useUsage()` hook
- Renders: "47 / 200 analyses this month" with a progress bar
- Below 20% remaining: bar turns red
- Shows "Upgrade" link when on Starter tier

#### C9: Set up Cloudflare Cron Trigger for monthly reset
- Add to `wrangler.toml`:
  ```toml
  [triggers]
  crons = ["0 0 1 * *"]
  ```
- Add `scheduled` handler in `worker/src/index.ts`:
  ```ts
  async scheduled(_event, env) {
    await env.DB.prepare(
      "UPDATE users SET analyses_used = 0, analyses_reset_at = date('now', 'start of month', '+1 month')"
    ).run()
  }
  ```

---

### Phase D — Stripe Checkout + Webhook

#### D1: Create Stripe account and products
- Go to dashboard.stripe.com → Products → Create:
  - "Pro Plan" — $9.00/month recurring → note `price_id`
  - "Studio Plan" — $29.00/month recurring → note `price_id`
- Copy price IDs into `frontend/src/lib/stripePrices.ts` as constants

#### D2: Install Stripe npm package in worker
- `cd worker && npm install stripe`

#### D3: Implement `worker/src/lib/stripe.ts`
```ts
import Stripe from 'stripe'
export function getStripe(secretKey: string) {
  return new Stripe(secretKey, { apiVersion: '2024-06-20' })
}
```

#### D4: Implement `worker/src/handlers/checkout.ts`
- Auth required
- Parse `{ priceId }` from body; validate it's one of the two known price IDs
- `getOrCreateUser` to get `stripe_customer_id`
- If no `stripe_customer_id`, create Stripe customer with `stripe.customers.create({ email: clerkUser.email })`; save to D1
- Call `stripe.checkout.sessions.create(...)` with `success_url`, `cancel_url`, `customer`, `line_items`
- Return `{ url: session.url }`

#### D5: Implement `worker/src/handlers/stripeWebhook.ts`
- Parse raw body as `ArrayBuffer` (do NOT call `request.json()` — signature verification needs the raw bytes)
- Get `Stripe-Signature` header
- Call `stripe.webhooks.constructEventAsync(rawBody, sig, env.STRIPE_WEBHOOK_SECRET)`
- Handle events:
  - `checkout.session.completed` → `UPDATE users SET tier = ..., stripe_customer_id = ... WHERE ...`
  - `customer.subscription.updated` → update `tier` based on `price.id`
  - `customer.subscription.deleted` → `UPDATE users SET tier = 'starter'`
- Return `{ received: true }`

#### D6: Add Stripe routes to `worker/src/index.ts`
```ts
if (url.pathname === '/api/checkout') → handleCheckout
if (url.pathname === '/api/webhooks/stripe') → handleStripeWebhook (no auth middleware)
```

#### D7: Implement upgrade flow in frontend `src/pages/SettingsPage.tsx`
- Show current plan from `useUsage()`
- "Upgrade to Pro" / "Upgrade to Studio" buttons → `POST /api/checkout` → redirect to Stripe URL
- "Manage Billing" button → `POST /api/checkout/portal` → redirect to Stripe Customer Portal

#### D8: Register Stripe webhook in dashboard
- Go to Stripe Dashboard → Webhooks → Add endpoint
- URL: `https://image-to-prompt-worker.salah-halli-2018.workers.dev/api/webhooks/stripe`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Copy signing secret → `wrangler secret put STRIPE_WEBHOOK_SECRET`

---

### Phase E — Pro Features

#### E1: Implement analysis history saving in `analyze.ts`
- After successful inference, if `userId` exists and tier is `pro` or `studio`:
  ```ts
  await env.DB.prepare(
    'INSERT INTO analyses (id, user_id, prompt_length) VALUES (?, ?, ?)'
  ).bind(nanoid(), userId, promptText.length).run()
  ```

#### E2: Add `GET /api/history` endpoint
- Auth required, Pro+ only (return 403 for Starter)
- Query: `SELECT id, prompt_length, created_at FROM analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
- Return `{ analyses: [...] }`

#### E3: Implement `src/pages/HistoryPage.tsx`
- Calls `GET /api/history`
- Renders a table of past analyses with timestamp and prompt length
- Gated: redirects to `/settings` if tier is `starter`

#### E4: Implement API key management (`worker/src/handlers/apiKeys.ts`)
- `GET /api/keys` — query D1, return key list (no raw key values, only id/name/dates)
- `POST /api/keys` — generate `sk_live_<nanoid(32)>`, SHA-256 hash it, store hash in D1, return raw key once
- `DELETE /api/keys/:id` — delete row, confirm belongs to user

#### E5: Implement `src/pages/SettingsPage.tsx` — API key section (Studio only)
- List existing keys with revoke button
- "Generate new key" form with name input
- Show generated key in a one-time reveal modal with copy button

---

## 8. Environment Variables Summary

| Variable | Where | Value |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | `frontend/.env.local` | From Clerk dashboard |
| `VITE_STRIPE_PRO_PRICE_ID` | `frontend/.env.local` | Stripe price ID |
| `VITE_STRIPE_STUDIO_PRICE_ID` | `frontend/.env.local` | Stripe price ID |
| `CLERK_JWKS_URL` | Worker secret | From Clerk dashboard |
| `STRIPE_SECRET_KEY` | Worker secret | From Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | Worker secret | From Stripe webhook |

---

## 9. Key Constraints

| Concern | Decision |
|---|---|
| JWT verification | Done in Worker via `crypto.subtle` — no external auth service call per request after JWKS cache warm |
| Stripe raw body | Must read as `ArrayBuffer` before any other `.json()` call — Stripe sig validation requires raw bytes |
| D1 latency | D1 queries add ~5–10ms at edge; acceptable for all non-AI routes |
| Anonymous users | Landing demo allows 3 free uses tracked in `localStorage` — no D1 write until signup |
| Studio API key security | Only SHA-256 hash stored in D1 — raw key never persisted |
