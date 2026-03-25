# Image-to-Prompt SaaS — Architecture & Execution Plan

## 1. Conceptual Architecture

### Overview

This system is a stateless, edge-native SaaS application. Every request is handled entirely at the Cloudflare edge — there is no origin server, no database, and no persistent session state. The AI inference also runs at the edge via Cloudflare Workers AI, meaning the image never leaves Cloudflare's infrastructure.

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENT (Browser)                                                   │
│  React + Vite SPA, served as static assets from Cloudflare Pages   │
│                                                                     │
│  1. User selects/drops an image file                                │
│  2. File is read into an ArrayBuffer via the FileReader Web API     │
│  3. ArrayBuffer is Base64-encoded client-side                       │
│  4. POST /api/analyze  { image: "<base64>", mimeType: "image/jpeg"} │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  HTTPS (same origin or CORS)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CLOUDFLARE WORKER  (Edge Runtime — V8 Isolate)                     │
│                                                                     │
│  5. Validate request: method, content-type, body size guard         │
│  6. Decode Base64 → Uint8Array (binary image bytes)                 │
│  7. Build AI prompt payload:                                        │
│       messages = [{ role: "user", content: [                        │
│         { type: "image", image: <Uint8Array> },                     │
│         { type: "text",  text: SYSTEM_PROMPT }                      │
│       ]}]                                                           │
│  8. Call env.AI.run("@cf/llava-1.5-7b-hf", payload)                │
│  9. Stream or await the model response                              │
│  10. Return JSON { prompt: "<generated text>" }                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  Workers AI binding (internal — no network hop)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CLOUDFLARE WORKERS AI  (Inference on Cloudflare GPU fleet)         │
│                                                                     │
│  Model: @cf/llava-1.5-7b-hf  (LLaVA 1.5 7B — vision-language)     │
│  Input:  image bytes + text instruction                             │
│  Output: text — a detailed reverse-engineered prompt                │
└─────────────────────────────────────────────────────────────────────┘
```

### Edge Computing Rationale

| Concern | Decision | Reason |
|---|---|---|
| No origin server | Cloudflare Workers only | Eliminates cold-start latency of traditional containers; V8 isolates spin up in < 5ms |
| Image payload handling | Base64 in JSON body (≤ 4 MB) | Workers have a 128 MB memory limit. Decoding Base64 → `Uint8Array` at the edge is O(n) and predictable. Files > 4 MB are rejected with a 413 before AI is invoked. |
| AI inference locality | `env.AI.run()` binding | Workers AI is an internal binding — zero network egress, no API key exposure in transit, billed per neuron second |
| Statelessness | No KV / D1 / R2 in v1 | Each request is fully self-contained. Enables horizontal scale to zero with no cold state |
| CORS | Worker sets headers explicitly | SPA and Worker can share a domain (Pages + Worker route) eliminating CORS entirely in production |

### Scalability Notes

- Cloudflare Workers scale automatically; there is no instance count to configure.
- The Workers AI free tier allows 10,000 neurons/day. The LLaVA model consumes roughly 300–600 neurons per image inference. Plan for quota exhaustion in paid tier for production.
- Image size is the primary cost driver. Consider a client-side resize step (canvas API) to cap images at 1024×1024 before upload, reducing inference time and cost.
- For future rate-limiting, a Cloudflare Worker with a Durable Object or Rate Limiting API can be added in front of `/api/analyze` without changing this architecture.

---

## 2. Repository Structure

```
image-to-prompt/
├── PLAN.md                        # This document
│
├── frontend/                      # React + Vite + Tailwind SPA
│   ├── index.html                 # Vite entry point
│   ├── vite.config.ts             # Vite config with proxy for local dev
│   ├── tailwind.config.ts         # Tailwind config (content paths)
│   ├── postcss.config.js          # PostCSS (required by Tailwind)
│   ├── tsconfig.json              # TypeScript config for frontend
│   ├── package.json               # Frontend deps (react, vite, tailwind)
│   └── src/
│       ├── main.tsx               # React DOM root mount
│       ├── App.tsx                # Root component (layout shell)
│       ├── index.css              # Tailwind directives (@base, @components, @utilities)
│       ├── components/
│       │   ├── ImageDropzone.tsx  # Drag-and-drop + click-to-upload zone
│       │   ├── PromptOutput.tsx   # Displays generated prompt + copy button
│       │   └── LoadingSpinner.tsx # Animated spinner shown during inference
│       ├── hooks/
│       │   └── useImageAnalyzer.ts # Encapsulates fetch logic + state machine
│       └── lib/
│           └── imageUtils.ts      # fileToBase64(), validateFileType(), resizeImage()
│
├── worker/                        # Cloudflare Worker
│   ├── wrangler.toml              # Worker config: name, route, AI binding
│   ├── package.json               # Worker deps (typescript, wrangler, @cloudflare/workers-types)
│   ├── tsconfig.json              # TypeScript config targeting worker runtime
│   └── src/
│       ├── index.ts               # Worker fetch handler (entry point)
│       ├── handlers/
│       │   └── analyze.ts         # POST /api/analyze — core logic
│       ├── lib/
│       │   ├── validation.ts      # Request guard functions (size, mime, method)
│       │   └── prompts.ts         # SYSTEM_PROMPT constant for the vision model
│       └── types.ts               # Shared TypeScript types (Env, AnalyzeRequest, AnalyzeResponse)
│
└── .gitignore
```

---

## 3. API Specification

### POST `/api/analyze`

#### Request

```
POST /api/analyze
Content-Type: application/json
```

```jsonc
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgAB...",  // full data URI or raw base64 string
  "mimeType": "image/jpeg"   // "image/jpeg" | "image/png" | "image/webp" | "image/gif"
}
```

**Constraints enforced by the Worker:**
- Total JSON body must be ≤ 5 MB (enforced via `Content-Length` header check or streaming byte count)
- `mimeType` must be one of the four accepted values
- `image` field must be a non-empty string

#### Response — Success (200)

```jsonc
{
  "success": true,
  "prompt": "A hyperrealistic photograph of a lone red telephone box standing on a foggy cobblestone street in London at dusk. Warm amber light spills from the booth's interior, contrasting with the cold blue-grey mist. Shot with a 35mm lens, shallow depth of field, bokeh background revealing blurred Victorian architecture. Cinematic color grading, high detail, 8k resolution."
}
```

#### Response — Validation Error (400)

```jsonc
{
  "success": false,
  "error": "INVALID_MIME_TYPE",
  "message": "Accepted formats: image/jpeg, image/png, image/webp, image/gif"
}
```

#### Response — Payload Too Large (413)

```jsonc
{
  "success": false,
  "error": "PAYLOAD_TOO_LARGE",
  "message": "Image must be under 4 MB after encoding."
}
```

#### Response — AI Inference Failure (502)

```jsonc
{
  "success": false,
  "error": "AI_INFERENCE_FAILED",
  "message": "The vision model failed to process this image."
}
```

#### Response — Method Not Allowed (405)

```jsonc
{
  "success": false,
  "error": "METHOD_NOT_ALLOWED",
  "message": "Only POST requests are accepted."
}
```

#### CORS Headers (present on all responses)

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

---

## 4. Execution Roadmap

Each step is atomic. Complete and verify each step before proceeding to the next.

---

### Phase 1 — Repository Bootstrap

#### Step 1: Create root directory and git repository
- Create the root directory `image-to-prompt/`
- Run `git init` inside it
- Create `.gitignore` with entries for: `node_modules/`, `dist/`, `.wrangler/`, `.env`, `*.local`

---

### Phase 2 — Frontend Scaffold

#### Step 2: Scaffold Vite + React + TypeScript app
- `cd frontend/`
- Run: `npm create vite@latest . -- --template react-ts`
- Verify `index.html`, `src/main.tsx`, `src/App.tsx` exist

#### Step 3: Install and configure Tailwind CSS
- Install: `npm install -D tailwindcss postcss autoprefixer`
- Run: `npx tailwindcss init -p` (generates `tailwind.config.js` and `postcss.config.js`)
- Rename config to `tailwind.config.ts`, set content paths:
  ```ts
  content: ["./index.html", "./src/**/*.{ts,tsx}"]
  ```
- Replace contents of `src/index.css` with the three Tailwind directives:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```
- Verify by running `npm run dev` — the default Vite page should render with no CSS errors

#### Step 4: Configure Vite dev proxy
- In `vite.config.ts`, add a `server.proxy` rule:
  ```ts
  proxy: {
    '/api': {
      target: 'http://localhost:8787',
      changeOrigin: true
    }
  }
  ```
- This routes `/api/*` calls from the Vite dev server to the local Wrangler dev server

#### Step 5: Implement `src/lib/imageUtils.ts`
- Export `fileToBase64(file: File): Promise<string>` — reads file with `FileReader`, returns a full data URI string
- Export `validateFileType(file: File): boolean` — checks `file.type` against the allowed MIME list
- Export `resizeImageToDataUri(file: File, maxDimension: number): Promise<string>` — draws the image onto a `<canvas>` element capped at `maxDimension` px on the longest side, exports as JPEG at 0.85 quality via `canvas.toDataURL('image/jpeg', 0.85)`

#### Step 6: Implement `src/hooks/useImageAnalyzer.ts`
- Define a state machine with states: `idle | loading | success | error`
- Export a custom hook `useImageAnalyzer()` that returns:
  - `status`: current state string
  - `prompt`: string | null (the AI-generated result)
  - `errorMessage`: string | null
  - `analyze(file: File): Promise<void>` — the trigger function
- Inside `analyze()`:
  1. Set status to `loading`
  2. Call `resizeImageToDataUri(file, 1024)` to get a data URI
  3. Extract `mimeType` from the data URI prefix (e.g., `data:image/jpeg;base64,...` → `image/jpeg`)
  4. `POST /api/analyze` with `Content-Type: application/json` and body `{ image, mimeType }`
  5. On success: set `prompt` and status to `success`
  6. On failure: parse error JSON, set `errorMessage` and status to `error`

#### Step 7: Implement `src/components/ImageDropzone.tsx`
- Accept prop `onFileSelected: (file: File) => void`
- Render a styled `<div>` with dashed border using Tailwind classes
- Attach `onDragOver`, `onDrop`, and `onClick` handlers
- `onDrop`: call `e.preventDefault()`, extract `e.dataTransfer.files[0]`, validate with `validateFileType`, call `onFileSelected`
- `onClick`: programmatically click a hidden `<input type="file" accept="image/*" />`
- Show a preview `<img>` tag with `URL.createObjectURL(file)` when a file has been selected (track with local `useState`)

#### Step 8: Implement `src/components/LoadingSpinner.tsx`
- Render an animated SVG or a Tailwind `animate-spin` div
- No props needed

#### Step 9: Implement `src/components/PromptOutput.tsx`
- Accept props: `prompt: string`
- Render the prompt text inside a styled `<textarea>` (read-only) with a monospace font
- Render a "Copy to Clipboard" `<button>` that calls `navigator.clipboard.writeText(prompt)` and briefly shows "Copied!" text via local state

#### Step 10: Implement `src/App.tsx`
- Import and use `useImageAnalyzer` hook
- Layout:
  - Header bar with app title "Image → Prompt"
  - `<ImageDropzone>` always visible; on file selection, call `analyze(file)`
  - Conditionally render `<LoadingSpinner>` when status === `loading`
  - Conditionally render `<PromptOutput>` when status === `success`
  - Conditionally render a red error banner when status === `error`
- Use Tailwind for a centered, single-column layout with max-width `max-w-2xl mx-auto`

---

### Phase 3 — Cloudflare Worker Scaffold

#### Step 11: Initialize Wrangler project
- `cd worker/`
- Create `package.json` manually (do not use `wrangler init` interactively):
  ```json
  {
    "name": "image-to-prompt-worker",
    "version": "1.0.0",
    "private": true,
    "scripts": {
      "dev": "wrangler dev",
      "deploy": "wrangler deploy"
    }
  }
  ```
- Install: `npm install -D wrangler typescript @cloudflare/workers-types`

#### Step 12: Create `worker/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ESNext"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

#### Step 13: Create `worker/wrangler.toml`
```toml
name = "image-to-prompt-worker"
main = "src/index.ts"
compatibility_date = "2024-09-23"

[ai]
binding = "AI"
```
- The `[ai]` block creates the `env.AI` binding that exposes Workers AI inference methods.

---

### Phase 4 — Worker Implementation

#### Step 14: Define `worker/src/types.ts`
```ts
export interface Env {
  AI: Ai;
}

export interface AnalyzeRequest {
  image: string;    // base64 data URI or raw base64
  mimeType: string;
}

export interface AnalyzeResponse {
  success: true;
  prompt: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
}
```

#### Step 15: Implement `worker/src/lib/prompts.ts`
- Export a constant `SYSTEM_PROMPT`:
```ts
export const SYSTEM_PROMPT = `You are an expert AI image analyst and prompt engineer.
Analyze the provided image in exhaustive detail and reverse-engineer a text prompt that would recreate it.

Your output must be a single paragraph prompt string covering:
- Subject and composition (what is the main subject, how is it framed)
- Art style (photorealistic, oil painting, digital art, anime, etc.)
- Lighting (golden hour, studio lighting, neon, natural diffused, etc.)
- Color palette (dominant colors, contrast, saturation)
- Mood and atmosphere (cinematic, serene, dramatic, etc.)
- Technical camera details if photographic (lens focal length, depth of field, film grain, etc.)
- Any notable textures, materials, or fine details

Output ONLY the prompt text. No preamble, no explanation, no labels.`;
```

#### Step 16: Implement `worker/src/lib/validation.ts`
- Export `ALLOWED_MIME_TYPES: readonly string[]` = `['image/jpeg', 'image/png', 'image/webp', 'image/gif']`
- Export `MAX_BODY_BYTES: number` = `5 * 1024 * 1024` (5 MB)
- Export `validateMethod(request: Request): boolean` — returns true only for `POST` and `OPTIONS`
- Export `validateMimeType(mimeType: string): boolean` — checks against `ALLOWED_MIME_TYPES`
- Export `validateBodySize(contentLength: string | null): boolean` — parses header, returns false if > `MAX_BODY_BYTES`

#### Step 17: Implement `worker/src/handlers/analyze.ts`
- Import `Env`, `AnalyzeRequest`, `AnalyzeResponse`, `ErrorResponse` from `../types`
- Import `SYSTEM_PROMPT` from `../lib/prompts`
- Import validation helpers from `../lib/validation`
- Export `async function handleAnalyze(request: Request, env: Env): Promise<Response>`
- Implementation steps inside the function:
  1. Check `validateBodySize(request.headers.get('content-length'))` → 413 if invalid
  2. Parse JSON body with `try/catch` → 400 `INVALID_JSON` if it throws
  3. Destructure `{ image, mimeType }` from body; check both are non-empty strings → 400 `MISSING_FIELDS`
  4. Check `validateMimeType(mimeType)` → 400 `INVALID_MIME_TYPE`
  5. Strip data URI prefix if present: `const base64 = image.replace(/^data:[^;]+;base64,/, '')`
  6. Decode Base64 → binary: `const imageBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))`
  7. Build the AI input:
     ```ts
     const aiInput = {
       messages: [
         {
           role: "user",
           content: [
             { type: "image", image: Array.from(imageBytes) },
             { type: "text", text: SYSTEM_PROMPT }
           ]
         }
       ]
     };
     ```
  8. Call `const result = await env.AI.run("@cf/llava-1.5-7b-hf", aiInput)` wrapped in `try/catch` → 502 `AI_INFERENCE_FAILED` on throw
  9. Extract `result.response` (the model's text output); trim whitespace
  10. Return `Response` with JSON `{ success: true, prompt: result.response.trim() }` and status 200
- All error responses must include the CORS headers defined in Step 18

#### Step 18: Implement `worker/src/index.ts`
- Define CORS headers constant:
  ```ts
  const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  ```
- Export default object with `fetch` handler:
  ```ts
  export default {
    async fetch(request: Request, env: Env): Promise<Response> {
      // Handle OPTIONS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      // Route
      const url = new URL(request.url);
      if (url.pathname === '/api/analyze') {
        if (request.method !== 'POST') {
          return jsonError(405, 'METHOD_NOT_ALLOWED', 'Only POST requests are accepted.');
        }
        const response = await handleAnalyze(request, env);
        // Inject CORS headers into every response from the handler
        CORS_HEADERS_ENTRIES.forEach(([k, v]) => response.headers.set(k, v));
        return response;
      }
      return new Response('Not Found', { status: 404 });
    }
  };
  ```
- Implement a small helper `jsonError(status, error, message)` that returns a `Response` with `Content-Type: application/json` and CORS headers

---

### Phase 5 — Integration & Local Testing

#### Step 19: Verify Worker runs locally
- `cd worker/ && npm run dev`
- Wrangler dev server should start on `http://localhost:8787`
- Use `curl` to POST a small test payload:
  ```bash
  curl -X POST http://localhost:8787/api/analyze \
    -H "Content-Type: application/json" \
    -d '{"image":"<small-valid-base64>","mimeType":"image/jpeg"}'
  ```
- Confirm 200 response with `prompt` field OR a well-formed error JSON (AI may not work in local dev without `--remote` flag — see note below)
- **Note:** Workers AI bindings require `wrangler dev --remote` to execute real inference. Local dev without `--remote` will throw a binding error — this is expected. Verify error handling returns the correct 502 shape.

#### Step 20: Verify Frontend runs locally with proxy
- Ensure the Worker is running with `wrangler dev --remote` in one terminal
- In a second terminal: `cd frontend/ && npm run dev`
- Open browser to `http://localhost:5173`
- Upload a real image; confirm the spinner appears, then a prompt is returned
- Verify the copy button works

#### Step 21: End-to-end validation checklist
- [ ] Drop a JPEG — prompt is generated
- [ ] Drop a PNG — prompt is generated
- [ ] Drop a non-image file (e.g., `.pdf`) — dropzone rejects it client-side before any fetch
- [ ] Upload an image > 4 MB — Worker returns 413 response; UI shows error banner
- [ ] Send a request with an unsupported mime type via `curl` — Worker returns 400 with `INVALID_MIME_TYPE`
- [ ] Confirm OPTIONS preflight returns 204 with correct CORS headers

---

### Phase 6 — Production Deployment

#### Step 22: Deploy the Worker to Cloudflare
- Ensure you are authenticated: `wrangler login`
- `cd worker/ && npm run deploy`
- Note the deployed Worker URL (e.g., `https://image-to-prompt-worker.<account>.workers.dev`)

#### Step 23: Update frontend API base URL for production
- In `src/hooks/useImageAnalyzer.ts`, the fetch target `/api/analyze` is a relative path
- For production builds, if the SPA is deployed to Cloudflare Pages on the same zone and the Worker is bound as a route (e.g., `yourdomain.com/api/*`), the relative URL works unchanged
- If deploying to separate subdomains, replace the relative path with the full Worker URL via a Vite environment variable:
  - Create `frontend/.env.production` with `VITE_API_URL=https://image-to-prompt-worker.<account>.workers.dev`
  - In the hook, use: `` const API_URL = `${import.meta.env.VITE_API_URL ?? ''}/api/analyze` ``

#### Step 24: Deploy the frontend to Cloudflare Pages
- `cd frontend/ && npm run build` — outputs to `frontend/dist/`
- Deploy via CLI: `npx wrangler pages deploy dist --project-name image-to-prompt`
- Or connect the GitHub repository to Cloudflare Pages dashboard with build command `npm run build` and output directory `dist`
- Confirm the Pages URL loads and makes successful requests to the Worker

#### Step 25: (Optional) Bind Worker to Pages via custom domain
- In the Cloudflare Dashboard, add a Worker Route on your custom domain: `yourdomain.com/api/*` → `image-to-prompt-worker`
- Update the Pages project custom domain to `yourdomain.com`
- The relative `/api/analyze` URL in the frontend now resolves correctly with zero CORS configuration needed

---

## Appendix: Key Constraints Summary

| Constraint | Value | Enforcement Location |
|---|---|---|
| Max upload size | 4 MB (raw image) / ~5.4 MB base64 | Worker: body size check |
| Max JSON body | 5 MB | Worker: Content-Length header |
| Allowed MIME types | jpeg, png, webp, gif | Worker: validation.ts |
| Client-side resize | Max 1024px longest side | Frontend: imageUtils.ts |
| AI model | `@cf/llava-1.5-7b-hf` | Worker: analyze.ts |
| Worker memory | 128 MB hard limit | Architecture: base64 decode is ~1.33× file size |
| Workers AI quota (free) | 10,000 neurons/day | Cloudflare Dashboard |
| Worker CPU time limit | 30 seconds (default) | Inference typically < 10s |
