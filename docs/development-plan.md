# CareerIQ — Development Plan

Methodology: the submitted **Milestone-1 proposal** defines scope; work is
delivered in build phases with a working product after every phase. Scores are
always deterministic (M1 formula); the LLM (Gemini only) explains evidence.

## Phase status

### ✅ Phase 1 — Foundation
- Monorepo (npm workspaces): `apps/web` (Next.js 16/React 19/TS/Tailwind 4),
  `apps/ai-service` (FastAPI), `scripts/`, `docs/`, `supabase/`.
- Supabase local stack +5 migrations (auth shim, schema, RLS, seed, storage).
- Seeded reference data: **10 career roles, 78 skills, 172 aliases, 168
  weighted role-skill links** (required 2.0 / optional 1.0).
- Design system, auth UI (login/register), proxy (Next 16 middleware rename),
  health probes (`/api/health` → Postgres + FastAPI).

### ✅ Phase 2 — Authentication & career profile
- Supabase email/password auth, session cookie verification on every route.
- Full profile editor: headline, summary, education rows, experience level,
  location, interests, career goals, target/preferred roles, searchable
  78-skill picker with proficiency, custom-skill fallback, alias resolution
  (`React JS` → `React.js`). Zod validation, optimistic chips, toasts.

### ✅ Phase 3 — Resume analysis
- PDF upload → magic-byte/size/page validation → SHA-256 dedupe → private
  Supabase Storage bucket (`resumes`, RLS by folder ownership).
- FastAPI extraction: **PyMuPDF** text + section parsing + alias matcher with
  evidence lines → reviewable JSON.
- User review step (tick/untick skills, import summary) before anything enters
  `user_skills`. Fully round-trip tested.

### ✅ Phase 4 — Recommendations
- M1 engine: `(weighted matched [2.0/1.0] / weighted required) × 100`,
  ranked across all 10 roles, persisted atomically with full evidence JSON.
- **Gemini** (`gemini-2.5-flash`, fallback `gemini-2.0-flash`) writes one
  explanation per rank via `POST /api/v1/explain`; deterministic templates take
  over when no key/failure — UI labels which one you got. Scores never come
  from the LLM.

### ✅ Phase 5 — Skill-gap analysis
- Live computation per role: required/optional split with ✓/✗, weights,
  `gap = 100 − match`, prioritised advice, save-to-history snapshots.

### ✅ Phase 6 — Learning roadmaps
- Plan generated from real gaps: required-first ordering, hours estimated by
  category, spread across 8/12/16/24-week horizons, weekly objectives.
- Per-item progress tracking (`roadmap_progress`), honest `409 NO_GAPS` when
  a role is already fully covered.

### ✅ Phase 7 — Job-description matching
- Paste JD → FastAPI extracts required skills with the same matcher → M1
  scoring (every JD skill = required 2.0) → closest official role (Jaccard on
  required sets) → stored with formula breakdown + explanation + history.

### ✅ Verification
- `ruff` + **28 pytest** (FastAPI incl. JWT/JWKS, catalogue matcher, embed endpoint).
- `tsc --noEmit`, `eslint`, **30 vitest** (M1 maths, normalisation, semantic bridges), `next build`.
- `scripts/smoke.mjs` — **62/62 E2E checks** (real user → every module →
  independent DB verification of the stored score → semantic-bridge
  provenance/threshold/M1 identity → cleanup).
- `scripts/load.mjs` — concurrent health/load check with p95 latency budget.

### ✅ Phase 8 — Data pipelines & AI depth
- **ESCO import** (`scripts/import-esco.mjs`): official ESCO v1.2.0 concepts via
  the EC search endpoint (the resource scheme endpoint only pages ~1000 rows),
  accepted only on EXACT normalised label equality against preferred/alternative
  labels (containment is used solely to select concepts for detail verification)
  — nothing fabricated; responses cached under `scripts/.cache` (spaces encoded
  as `+` because the EC edge answers 502 for some `%20` phrases). Result:
  **27/79 skills and 8/10 roles** carry official ESCO URIs; the rest honestly
  unmatched.
- **Embeddings**: `apps/ai-service/app/services/embedder.py` +
  `POST /api/v1/catalog/embed` fill `skills.embedding` / `career_roles.embedding`
  (all-MiniLM-L6-v2, 384-dim) via `npm run embed`; new user-added skills embed
  lazily through the same endpoint.
- **pgvector semantic safety net** (`lib/server/semantic.ts`): after the alias
  matcher, the user's *custom* skills are cosine-compared (≥ 0.60, calibrated:
  true equivalents 0.65–0.86, unrelated ≤ 0.44) against a role's missing
  skills; bridges move missing → matched in the same M1 evidence and are stored
  in `career_recommendations.semantic_matches` with full provenance
  (`via_skill_slug`, `role_skill_slug`, `similarity`, `weight`). Exact/alias
  matches always win; everything degrades gracefully without the AI service.
- **Learning resources**: 79 curated rows seeded and attached (max 3/skill) to
  roadmap items by `lib/server/roadmaps.ts`.
- Not delivered (deferred, not in the M1 proposal): LLM-authored roadmap
  objectives — roadmap generation stays deterministic with templated objectives.

### ⏳ Phase 9 — Hardening & delivery
- ✅ Rate limiting (`lib/server/rate-limit.ts`), audit logging
  (`lib/server/audit.ts` → `audit_logs`), CI (`.github/workflows/ci.yml`:
  lint/typecheck/test/build + ruff/pytest), load test (`scripts/load.mjs`).
- ⬜ Vercel (web) + Render/Fly (ai) + hosted Supabase deployment.
- ⬜ Accessibility pass and demo video for the capstone.

## Quality gates (run before every commit)

```bash
npm run lint && npm run typecheck && npm run test:web   # web
cd apps/ai-service && .venv/Scripts/python -m ruff check app tests
cd apps/ai-service && .venv/Scripts/python -m pytest    # ai
npm run build                                           # production build
node scripts/smoke.mjs                                  # E2E (stack must run)
```
