# CareerIQ — API Contracts

Two surfaces:

1. **Web API** — Next.js Route Handlers under `/api/*` (browser-facing, session auth).
2. **AI service** — FastAPI on `:8000` (service-to-service only, `X-Internal-API-Key`).

Errors always use one envelope:

```json
{ "error": { "code": "INVALID_PROFILE", "message": "…", "details": {} } }
```

Authentication for web routes: Supabase session cookie (`sb-…-auth-token`)
verified via `requireUser()`; unauthenticated → `401`.

---

## Web API (`apps/web/src/app/api`)

| Method | Path | Body → Response |
|---|---|---|
| GET | `/api/health` | `{ status, db:{ok,latencyMs,version}, ai:{ok,version,latencyMs} }` |
| POST | `/api/profile` | `{headline, summary, education[], interests[], career_goals[], experience_level, years_experience, location, preferred_roles[], target_role_slug}` → `{profile, onboarding_complete}` |
| POST | `/api/profile/skills` | `{skill_id} \| {name, proficiency}` → `{skill{id,slug,name,category,proficiency}}` (resolves aliases; creates user-added skill when absent) |
| DELETE | `/api/profile/skills?skill_id=` | → `{ok}` |
| POST | `/api/resumes` | multipart `file` (PDF ≤10 MB) → `{duplicate, resume, analysis}` — stores in private bucket, runs AI extraction |
| GET | `/api/resumes` | → `{resumes[]}` with latest analysis |
| POST | `/api/resumes/:id/confirm` | `{skillSlugs[], importSummary}` → `{added, skipped, totalSkills}` |
| DELETE | `/api/resumes/:id` | → `{ok}` |
| POST | `/api/recommendations` | → `{count, top[{rank,role,score}]}` — computes M1 for all 10 roles, replaces the stored set, optional Gemini explanations |
| GET | `/api/recommendations` | → `{recommendations[]}` (latest computed set; each row carries the full M1 evidence incl. `semantic_matches[]`) |
| POST | `/api/skill-gap` | `{role_slug}` → `{role, gap_score, advice, matched_required, missing_required}` (also persists a snapshot) |
| POST | `/api/roadmaps` | `{role_slug, horizon_weeks}` → `201 {roadmap, skillCount}` — `409 NO_GAPS` when every skill is already covered |
| POST | `/api/roadmaps/progress` | `{roadmap_id, item_key, status, skill_slug?}` → `{ok}` |
| POST | `/api/job-analyzer` | `{text ≥80 chars, title?, company?}` → `201 {result{score, matched[], missing[], closestRole, explanation, skillsFound, warning}}` |

## AI service (`apps/ai-service`, FastAPI)

All endpoints except `/health*` require `X-Internal-API-Key` (`401` otherwise).

| Method | Path | Request → Response |
|---|---|---|
| GET | `/health` | `{status:"ok", service, version, environment, time}` |
| GET | `/health/ready` | readiness incl. dependency versions (PyMuPDF, spaCy, sentence-transformers, psycopg…) |
| POST | `/api/v1/resume/extract` | multipart `file` → `{page_count, model_used, raw_text_excerpt, parsed{summary, skills[{slug,name,category,confidence,evidence}], education[], experience[], certifications[]}}` · errors: `NOT_A_PDF`, `PDF_TOO_LARGE`, `PDF_TOO_MANY_PAGES`, `PDF_NO_TEXT` |
| POST | `/api/v1/jobs/skills` | `{text, title?, company?}` → `{skills[…], model_used}` |
| POST | `/api/v1/explain` | `{kind: "recommendations"\|"job_match", evidence}` → `{explanation(s), model_used, provider, reason?}` — Gemini (`gemini-2.5-flash`, fallback `gemini-2.0-flash`); `llm_not_configured` when no key; caller falls back to deterministic templates |
| POST | `/api/v1/catalog/embed` | `{texts: string[] (1–64, each ≤200 chars)}` → `{embeddings: number[][] (384-dim)}` · `503 EMBEDDING_UNAVAILABLE` when the model cannot load — callers treat that as "no semantic matching this request" |

### Shared normalisation rule (both stacks)

```
lowercase → strip everything except a-z0-9 + #     ("React.js" = "React JS" = "ReactJS")
```

Implemented in `apps/web/src/lib/utils.ts::normalizeSkillName` and
`apps/ai-service/app/services/catalog.py::normalize_skill_name`, with
word-bounded regex matching (`go` never matches inside `algorithms`).

### Scoring rules

- **Roles**: M1 formula, weights from `role_skills` (2.0 / 1.0).
- **Jobs**: every extracted JD skill counts as required (2.0) →
  `score = matched / job_skills × 100`.
- **Gaps**: `gap_score = 100 − match_score`.
- **Semantic safety net**: after exact/alias matching, a user's *custom* skills
  may bridge to a role's missing skills when pgvector cosine similarity ≥ 0.60.
  A bridge only moves missing → matched inside the same evidence (weights and
  formula unchanged) and is recorded in `career_recommendations.semantic_matches`
  as `{via_skill_slug, via_skill_name, role_skill_slug, similarity, weight,
  is_required}`; the UI labels bridged skills with `≈`. If embeddings or the AI
  service are unavailable the run simply has no bridges.
- The LLM receives structured evidence and returns prose only; if it fails or
  is unavailable, templates in `lib/server/explanations.ts` are used and the UI
  labels the explanation "Deterministic".
