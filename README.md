# CareerIQ — AI Career Intelligence Platform

> **CSET400C Capstone · Bennett University**
> Upload a resume → get **explainable career-role recommendations, skill-gap analysis,
> a personalized learning roadmap and job-description matching** across ten official
> technical roles — with every score computed by a transparent formula, never by an LLM.

---

## What the project does

CareerIQ answers one question: **"Based on my actual skills, which career role should I
target next — and exactly what am I missing?"**

```
 PDF resume ──► PyMuPDF extraction ──► skill detection WITH evidence lines
                                              │
                              human review ───┘   (nothing enters your profile unreviewed)
                                              │
        profile skills ──► M1 scoring engine ─┴──► 10 ranked roles (deterministic)
                                              │
                    Gemini writes the prose ◄─┘   (scores NEVER come from the LLM)
                                              │
             skill gap ──► roadmap (8-24 weeks) ──► job-description matching
```

**Module flow (each one is a working product):**

| # | Module | What it does |
|---|---|---|
| 1 | **Auth & profile** | Supabase email/password, onboarding profile, searchable 79-skill picker, custom skills, alias resolution (`React JS` → `React.js`) |
| 2 | **Resume analysis** | PDF upload → magic-byte/size/page validation → SHA-256 de-duplication → private storage → **skill extraction with evidence lines** → review & confirm before import |
| 3 | **Recommendations** | M1 formula ranks all 10 roles, persisted with full evidence; Gemini explanation per rank (template fallback labelled in the UI) |
| 4 | **Skill gap** | Required/optional split with weights, prioritised advice, pgvector **semantic safety net** for custom skills (`≈` bridges, cosine ≥ 0.60) |
| 5 | **Roadmap** | Gap-driven weekly plan (8/12/16/24 weeks), progress tracking, curated learning-resource links |
| 6 | **Job analyzer** | Paste a JD → same matcher extracts skills → M1 scoring → closest official role → history |
| 7 | **Data pipelines** | Official **ESCO v1.2.0** codes imported via the EC API (exact-label rule, nothing fabricated) · **384-d embeddings** for skills & roles (pgvector) |

**The trust story (this is the capstone pitch):**

- **Scores are deterministic.** `score = (weighted matched / weighted required) × 100`
  (required = 2.0, optional = 1.0, weights from `role_skills`). Verified independently
  by the smoke test straight from the database.
- **The LLM only writes prose.** Gemini (`gemini-2.5-flash`, fallback configured) writes
  explanations from structured evidence. Kill the key and the whole app still works —
  templates take over and the UI **labels the explanation "Deterministic"**.
- **You stay in control.** Resume skills enter your profile only after you confirm them.
- **Nothing is fabricated.** ESCO codes are stored only when ESCO itself contains the
  exact label we looked up; unmatched skills stay honestly unmatched.
- **Hardened:** RLS on every table, rate limiting, audit logging, service-to-service
  `X-Internal-API-Key`, Zod validation, error envelopes.

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | **Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind CSS 4** · shadcn/ui · Recharts | Server components + streaming, type-safe API layer, accessible design system |
| **Web backend** | Next.js Route Handlers · `pg` pool · Zod · middleware (`proxy.ts`) | Session-auth routes, validation, uniform error envelope |
| **AI service** | **FastAPI** (Python 3.11+) · **PyMuPDF** · spaCy-style matcher · httpx | PDF text/section parsing, keyword & alias matching, JWT/JWKS verification |
| **LLM** | **Google Gemini** (`gemini-2.5-flash`, fallback `gemini-2.0-flash`) | Natural-language explanations only — advisory, never scoring |
| **Embeddings** | **sentence-transformers `all-MiniLM-L6-v2`** (384-d) | Local, offline vector encoding for semantic skill bridging |
| **Database** | **PostgreSQL 17 + pgvector** via **Supabase** (local CLI / hosted) | Relational seed catalogue + cosine similarity search in SQL |
| **Auth & storage** | Supabase Auth (email/password) + private Storage bucket (RLS) | Session cookies, per-user resume files |
| **Search data** | **ESCO v1.2.0** — official EC web-service API | Skill/occupation codes mapped into the M1 catalogue |
| **Quality** | ESLint · tsc · **vitest (30)** · **pytest (28)** · ruff · `next build` · **smoke E2E (62)** · load test · GitHub Actions CI | Gates run before every commit |
| **Tooling** | npm workspaces · concurrently · Docker (Supabase) | One `npm run dev` for web + AI together |

---

## Quick start — Windows

**Prereqs:** [Node ≥ 20](https://nodejs.org), [Python 3.11+](https://python.org),
**Docker Desktop** (must be *running*), Git.

```powershell
git clone https://github.com/Raghav1507/CareerIQ.git
cd CareerIQ
npm install

Copy-Item .env.example .env
Copy-Item apps\ai-service\.env.example apps\ai-service\.env
Copy-Item apps\web\.env.example apps\web\.env.local

npx supabase start              # prints URL + keys -> paste them into the env files (see below)
npm run db:migrate              # schema + seed: 10 roles, 78 skills, 173 aliases, 168 links

cd apps\ai-service
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
cd ..\..

npm run dev                     # web http://localhost:3000 · ai http://127.0.0.1:8000
```

## Quick start — macOS (or Linux)

**Prereqs:** `brew install node python@3.11 git` + **Docker Desktop** (running).

```bash
git clone https://github.com/Raghav1507/CareerIQ.git
cd CareerIQ
npm install

cp .env.example .env
cp apps/ai-service/.env.example apps/ai-service/.env
cp apps/web/.env.example apps/web/.env.local

npx supabase start              # prints URL + keys -> paste them into the env files
npm run db:migrate

cd apps/ai-service
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd ../..

npm run dev
```

**Day-2 restart (either OS):** `npx supabase start` → `npm run dev`. Nothing else —
data persists in Docker.

**Optional Phase-8 data** (first time only, network; responses cached under
`scripts/.cache/`):

```bash
node scripts/import-esco.mjs      # official ESCO codes
npm run embed                     # fills skills/roles embeddings (~90 MB model, once)
```

---

## Environment files & API keys (`.env` setup)

Real secrets live **only** in `.env` files — they are **git-ignored** and never committed.
Copy the templates, then fill in the blanks:

| File | Purpose |
|---|---|
| `.env` (project root) | DB URL, Supabase URL, app URL, AI service URL, shared internal key |
| `apps/ai-service/.env` | **Gemini key**, internal key (must match root), DB URL, limits |
| `apps/web/.env.local` | Supabase **anon key** + **service-role key** (server-only) |

### Step 1 — Supabase keys (auto, from local stack)

```powershell
npx supabase start        # Windows — prints API URL, anon key, service_role key
```
Paste the printed values into `.env` → `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
*Hosted instead:* Supabase Dashboard → **Project Settings → API**.

### Step 2 — Gemini API key (the only external AI key)

1. Get a free key at **[Google AI Studio](https://aistudio.google.com/apikey)**.
2. Open **`apps/ai-service/.env`** and set:

```ini
LLM_PROVIDER=gemini
GEMINI_API_KEY=YOUR_GEMINI_KEY_PASTED_HERE        # <- the only key you must paste
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODEL=gemini-2.0-flash
```

3. Restart the services (Ctrl+C → `npm run dev`).

> **Quota exhausted / no key?** Everything still works: extraction, scoring, gaps,
> roadmaps and JD matching are 100 % local. Only the explanation text switches to
> built-in templates, and the UI labels it **"Deterministic"**.

### Step 3 — the shared internal key (one random string, both files)

Generate any long random value and put the **same value** in **both** files:

```ini
# .env  (root)
INTERNAL_API_KEY=some-long-random-secret-at-least-16-chars

# apps/ai-service/.env
INTERNAL_API_KEY=some-long-random-secret-at-least-16-chars
```

This authenticates Next.js → FastAPI (`X-Internal-API-Key`); mismatched values → 401s.

### What you do NOT need

- **ESCO API** — free public EC endpoint, no key, cached.
- **Embeddings** — local model, offline after first run.
- **Resume extraction** — local PyMuPDF, no cloud call.

---

## Commands & quality gates

| Command | What it does |
|---|---|
| `npm run dev` | Next.js + FastAPI together (concurrently) |
| `npm run lint` / `npm run typecheck` | ESLint + `tsc --noEmit` |
| `npm run test` | vitest **30** + pytest **28** |
| `npm run build` | production build |
| `npm run db:migrate` / `db:reset` | apply / reset SQL migrations + seed |
| `npm run embed` | pgvector embeddings for NULL rows |
| `node scripts/import-esco.mjs` | official ESCO codes (`--dry-run`, `--refresh`) |
| `node scripts/smoke.mjs` | **62-check E2E smoke** (stack must run) |
| `node scripts/load.mjs` | load test — prints throughput + p95 budget |
| `cd apps/ai-service && .venv/Scripts/python -m ruff check app tests` | Python lint (macOS: `.venv/bin/python`) |

---

## The M1 formula (and where it lives)

```
Career Match Score = ( weighted matched / weighted required ) × 100
                     required = 2.0   optional = 1.0   (weights from role_skills)
```

- Implemented once in `apps/web/src/lib/matching.ts`, unit-tested, and
  **re-verified against the database** by the smoke test.
- Normalisation (both stacks): `lowercase, strip everything except a-z0-9+#`
  → `React.js = React JS = ReactJS`; word-bounded (`go` never matches `algorithms`).
- Semantic safety net: custom skills may bridge missing role skills at
  pgvector cosine ≥ 0.60 — recorded in `career_recommendations.semantic_matches`
  with full provenance; weights and formula stay untouched.

---

## Verified status

| Gate | Result |
|---|---|
| `eslint` / `tsc --noEmit` / `next build` | ✅ clean |
| vitest (M1 maths, normalisation, semantic bridges) | ✅ 30/30 |
| pytest (JWT/JWKS, matcher, embed endpoint, health) + ruff | ✅ 28/28 · clean |
| Local DB | ✅ 10 roles (8 ESCO-coded) · 79 skills (27 ESCO-coded) · 173 aliases · 168 weighted links · 89 embeddings · 79 learning resources |
| `node scripts/smoke.mjs` | ✅ **62/62** — auth → resume upload/extract/confirm/dedupe → 10-role ranking with independent DB score check → semantic bridges → gap → roadmap → JD match → Gemini explain → cleanup |
| `node scripts/load.mjs` | ✅ 513/513 requests · p95 270 ms |
| CI | ✅ `.github/workflows/ci.yml` runs lint/type/test/build + ruff/pytest on push |

---

## Project layout

```
├── apps/
│   ├── web/                  # Next.js 16 App Router
│   │   └── src/
│   │       ├── app/          # pages: dashboard, onboarding, resume, recommendations,
│   │       │                 #        skill-gap, roadmap, job-analyzer, roles, settings
│   │       │                 #        + Route Handlers under app/api/*
│   │       ├── components/   # ui/* (shadcn) · feature/* · resume/* · charts/*
│   │       ├── lib/          # db pool · matching.ts (M1) · api
│   │       │   └── server/   # engines: recommendations · gap · roadmaps · jobs
│   │       │                 #         semantic (pgvector) · explain · audit · rate-limit
│   │       └── proxy.ts      # Next 16 auth middleware
│   └── ai-service/           # FastAPI
│       ├── app/api/routes/   # health · resume extract · job skills · explain · catalog embed
│       ├── app/services/     # catalog (alias matcher) · resume_extract · llm · embedder
│       └── tests/            # pytest (28)
├── supabase/                 # migrations (schema, RLS, seed, audit, resources, phase-8)
├── scripts/                  # migrate · import-esco · smoke (E2E) · load
├── docs/                     # architecture · database-erd · api-contracts ·
│                             # design-system · development-plan
└── .github/workflows/ci.yml  # GitHub Actions quality gates
```

---

## Deployment (free tiers, ~1 month online)

**Vercel (web) → Render (FastAPI) → Supabase hosted (DB + Auth + Storage)** — all free
tiers are enough for a demo.

1. **Supabase cloud**: create project → run `npm run db:migrate` with its pooler URL →
   `node scripts/import-esco.mjs` + `npm run embed` against it.
2. **Vercel**: import this repo → Root Directory `apps/web` → set env vars
   (`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `AI_SERVICE_URL`, `INTERNAL_API_KEY`, `NEXT_PUBLIC_APP_URL`) → deploy.
3. **Render**: New Web Service → Root `apps/ai-service` →
   build `pip install -r requirements.txt` → start
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT` → same `INTERNAL_API_KEY`,
   `GEMINI_API_KEY`, `DATABASE_URL`, and `CORS_ORIGINS` = your Vercel URL.
4. Verify: `APP_URL=https://<your-app>.vercel.app node scripts/smoke.mjs` → 62/62.

---

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — components, trust boundaries, data flow
- [`docs/database-erd.md`](docs/database-erd.md) — ERD, tables, RLS
- [`docs/api-contracts.md`](docs/api-contracts.md) — every endpoint
- [`docs/design-system.md`](docs/design-system.md) — tokens, components, patterns
- [`docs/development-plan.md`](docs/development-plan.md) — phase status (1–9)
