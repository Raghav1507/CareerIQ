/**
 * End-to-end smoke test for the CareerIQ platform.
 *
 * Runs against the LOCAL stack (Next :3000, FastAPI :8000, Supabase :54321):
 *   1. creates a throwaway user via the Supabase admin API
 *   2. signs in with the password grant and forges the @supabase/ssr cookie
 *   3. exercises every module: profile, skills, recommendations, skill gap,
 *      roadmap (+progress), job analyzer, resume upload/extract/confirm
 *   4. verifies the M1 formula independently against the database
 *   5. renders every authenticated page (status 200)
 *   6. deletes the user (cascades clean)
 *
 * Usage:  node scripts/smoke.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const RESUME_PATH = process.env.RESUME_PATH ?? "C:\\Users\\LENOVO\\AppData\\Local\\Temp\\opencode\\test-resume.pdf";

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    failures.push(`${name} ${detail}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = {
  ...readEnvFile(resolve(ROOT, ".env")),
  ...readEnvFile(resolve(ROOT, "apps/web/.env.local")),
};

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANON_KEY || !SERVICE_KEY) {
  console.error("missing Supabase keys in .env / apps/web/.env.local");
  process.exit(1);
}

const EMAIL = `smoke-${Date.now()}-test@example.com`;
const PASSWORD = "SmokeTest!2345";
let userId = null;

async function supa(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

/** Forges the sb-<ref>-auth-token cookie exactly as @supabase/ssr decodes it. */
function authCookie(session) {
  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  return `sb-${ref}-auth-token=${value}`;
}

async function api(path, { method = "GET", cookie, body, form } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${APP_URL}${path}`, {
    method,
    headers,
    body: form ? form : body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* html page */
  }
  return { status: res.status, body: json };
}

async function main() {
  console.log(`\n=== CareerIQ E2E smoke · ${new Date().toISOString()} ===`);
  console.log(`app=${APP_URL} supabase=${SUPABASE_URL}\n`);

  // ---- 0. health --------------------------------------------------------
  console.log("[0] health");
  const health = await api("/api/health");
  check("GET /api/health", health.status === 200 && health.body?.db?.ok && health.body?.ai?.ok);

  const noAuth = await api("/api/profile", { method: "POST", body: {} });
  check("POST /api/profile unauthenticated → 401", noAuth.status === 401);

  // ---- 1. create user + session ----------------------------------------
  console.log("[1] auth");
  const create = await supa("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  check("admin create user", create.status === 200 || create.status === 201, `status ${create.status}`);
  userId = create.body?.id ?? null;

  const token = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json());
  check("password grant", Boolean(token.access_token), token.error ?? "");
  const session = {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_in: token.expires_in ?? 3600,
    expires_at: Math.floor(Date.now() / 1000) + (token.expires_in ?? 3600),
    token_type: token.token_type ?? "bearer",
    user: token.user,
  };
  const cookie = authCookie(session);

  // profile pages render for the signed-in user
  for (const page of ["/dashboard", "/onboarding", "/recommendations", "/resume", "/skill-gap", "/roadmap", "/job-analyzer", "/roles", "/settings"]) {
    const res = await fetch(`${APP_URL}${page}`, { headers: { Cookie: cookie }, redirect: "manual" });
    check(`page ${page} → 200`, res.status === 200, `status ${res.status}`);
  }
  const anonPage = await fetch(`${APP_URL}/dashboard`, { redirect: "manual" });
  check("page /dashboard anonymous → redirect", anonPage.status === 307 || anonPage.status === 308 || anonPage.status === 302, `status ${anonPage.status}`);

  // ---- 2. profile -------------------------------------------------------
  console.log("[2] profile");
  const profile = await api("/api/profile", {
    method: "POST",
    cookie,
    body: {
      headline: "Full-stack developer in progress",
      summary: "Smoke-test summary.",
      education: [{ degree: "B.Tech", field: "CSE", institution: "Test University", start: "2021", end: "2025" }],
      interests: ["web development", "cloud"],
      career_goals: ["SDE-1 role"],
      experience_level: "entry",
      years_experience: 1,
      location: "Noida",
      preferred_roles: ["frontend-developer"],
      target_role_slug: "frontend-developer",
    },
  });
  check("POST /api/profile", profile.status === 200, JSON.stringify(profile.body?.error ?? {}).slice(0, 140));
  check("profile saved headline", profile.body?.profile?.headline === "Full-stack developer in progress");
  check("onboarding incomplete without skills", profile.body?.onboarding_complete === false);

  // ---- 3. skills --------------------------------------------------------
  console.log("[3] skills");
  const addedSkills = [];
  for (const name of ["React.js", "Docker", "SQL", "Node.js", "TypeScript"]) {
    const res = await api("/api/profile/skills", { method: "POST", cookie, body: { name, proficiency: "advanced" } });
    check(`add skill ${name}`, res.status === 200 && res.body?.skill?.slug, JSON.stringify(res.body?.error ?? {}).slice(0, 120));
    if (res.body?.skill) addedSkills.push(res.body.skill);
  }
  const custom = await api("/api/profile/skills", { method: "POST", cookie, body: { name: "Bun Runtime", proficiency: "beginner" } });
  check("add custom skill (not in catalogue)", custom.status === 200 && custom.body?.skill?.slug === "bunruntime");

  const del = await api(`/api/profile/skills?skill_id=${custom.body.skill.id}`, { method: "DELETE", cookie });
  check("delete custom skill", del.status === 200 && del.body?.ok === true);

  const profile2 = await api("/api/profile", {
    method: "POST",
    cookie,
    body: {
      headline: "Full-stack developer in progress",
      interests: ["web development"],
      career_goals: ["SDE-1 role"],
      experience_level: "entry",
      years_experience: 1,
      education: [],
      preferred_roles: [],
      target_role_slug: "frontend-developer",
    },
  });
  check("onboarding complete after skills + goals", profile2.body?.onboarding_complete === true);

  // alias normalisation: React JS must map to the same skill as React.js
  const alias = await api("/api/profile/skills", { method: "POST", cookie, body: { name: "React JS" } });
  check("alias React JS → same skill as React.js", alias.status === 200 && alias.body?.skill?.slug === addedSkills[0]?.slug);

  // ---- 4. recommendations (M1) ------------------------------------------
  console.log("[4] recommendations");
  // A skill no role lists — it may only influence scores through the pgvector
  // semantic safety net (Server Side JavaScript → javascript/nodejs, cosine ≥ 0.6).
  const semanticSkill = await api("/api/profile/skills", {
    method: "POST",
    cookie,
    body: { name: "Server Side JavaScript", proficiency: "beginner" },
  });
  check(
    "add custom skill for semantic bridge",
    semanticSkill.status === 200 && semanticSkill.body?.skill?.slug === "serversidejavascript",
    JSON.stringify(semanticSkill.body?.error ?? {}).slice(0, 120)
  );
  const gen = await api("/api/recommendations", { method: "POST", cookie });
  check("POST /api/recommendations", gen.status === 200, JSON.stringify(gen.body?.error ?? {}).slice(0, 200));
  check("all 10 roles ranked", gen.body?.count === 10, `count=${gen.body?.count}`);
  check("top score is a number ≥ 0", typeof gen.body?.top?.[0]?.score === "number", JSON.stringify(gen.body?.top?.[0] ?? {}));

  const list = await api("/api/recommendations", { cookie });
  const rows = list.body?.recommendations ?? [];
  check("stored recommendation set size", rows.length === 10, `rows=${rows.length}`);
  if (rows.length) {
    const scores = rows.map((r) => Number(r.match_score));
    const sorted = [...scores].sort((a, b) => b - a);
    check("ranked descending", JSON.stringify(scores) === JSON.stringify(sorted));
    check("scores within [0,100]", scores.every((s) => s >= 0 && s <= 100));
    // independent M1 verification for rank 1
    const top = rows[0];
    const expected = top.weighted_required > 0 ? (Number(top.weighted_matched) / Number(top.weighted_required)) * 100 : 0;
    check(
      "M1 formula holds for rank 1",
      Math.abs(Number(top.match_score) - expected) < 0.011,
      `stored=${top.match_score} expected=${expected.toFixed(2)}`
    );
    check("evidence lists present", Array.isArray(top.missing_required) || typeof top.missing_required === "object");
    check("explanation present", typeof top.explanation === "string" && top.explanation.length > 30);
    var topRoleSlug = top.slug;

    // semantic safety net: the custom skill above must bridge to missing role skills
    const bridgedRows = rows.filter((r) => Array.isArray(r.semantic_matches) && r.semantic_matches.length > 0);
    check("semantic bridges present", bridgedRows.length > 0, `roles=${bridgedRows.length}`);
    const bridge = bridgedRows[0]?.semantic_matches?.[0];
    check(
      "bridge provenance + threshold",
      Boolean(bridge?.via_skill_slug && bridge?.role_skill_slug && Number(bridge?.similarity) >= 0.6),
      JSON.stringify(bridge ?? {})
    );
    const bridgedEvidence = [
      ...(bridgedRows[0]?.matched_required ?? []),
      ...(bridgedRows[0]?.matched_optional ?? []),
    ].filter((s) => s.via);
    check(
      "bridged skill in matched list with via",
      bridgedEvidence.length > 0,
      bridgedEvidence.map((s) => `${s.slug}<- ${s.via?.slug}`).join(",")
    );
    if (bridgedRows.length) {
      const br = bridgedRows[0];
      const brExpected = br.weighted_required > 0 ? (Number(br.weighted_matched) / Number(br.weighted_required)) * 100 : 0;
      check(
        "M1 identity holds on a bridged row",
        Math.abs(Number(br.match_score) - brExpected) < 0.011,
        `stored=${br.match_score} expected=${brExpected.toFixed(2)}`
      );
    }
  }

  // ---- 5. skill gap -----------------------------------------------------
  console.log("[5] skill gap");
  const gap = await api("/api/skill-gap", { method: "POST", cookie, body: { role_slug: topRoleSlug ?? "frontend-developer" } });
  check("POST /api/skill-gap", gap.status === 200, JSON.stringify(gap.body?.error ?? {}).slice(0, 160));
  check("gap score within [0,100]", typeof gap.body?.gap_score === "number" && gap.body.gap_score >= 0 && gap.body.gap_score <= 100);
  check("gap advice present", typeof gap.body?.advice === "string" && gap.body.advice.length > 20);

  // ---- 6. roadmap -------------------------------------------------------
  console.log("[6] roadmap");
  const rm = await api("/api/roadmaps", {
    method: "POST",
    cookie,
    body: { role_slug: topRoleSlug ?? "frontend-developer", horizon_weeks: 12 },
  });
  check("POST /api/roadmaps", rm.status === 201, JSON.stringify(rm.body?.error ?? {}).slice(0, 200));
  const plan = rm.body?.roadmap?.plan ?? [];
  check("plan has weeks", Array.isArray(plan) && plan.length > 0, `weeks=${plan.length}`);
  const firstItem = plan[0]?.items?.[0];
  if (firstItem) {
    const prog = await api("/api/roadmaps/progress", {
      method: "POST",
      cookie,
      body: {
        roadmap_id: rm.body.roadmap.id,
        item_key: firstItem.key,
        status: "completed",
        skill_slug: firstItem.skill_slug,
      },
    });
    check("roadmap progress saved", prog.status === 200 && prog.body?.ok === true);
  }

  // ---- 7. job analyzer --------------------------------------------------
  console.log("[7] job analyzer");
  const jd = `We are hiring a Frontend Engineer. Requirements: strong React.js and TypeScript,
Node.js or Next.js experience, PostgreSQL database design, Docker containers, GraphQL APIs,
testing with Jest, CI/CD pipelines, AWS cloud deployment, excellent communication skills.
You will build dashboards, own features end to end and collaborate with design.`;
  const job = await api("/api/job-analyzer", { method: "POST", cookie, body: { title: "Frontend Engineer", company: "Acme", text: jd } });
  check("POST /api/job-analyzer", job.status === 201, JSON.stringify(job.body?.error ?? {}).slice(0, 200));
  const r = job.body?.result;
  check("job skills extracted", (r?.skillsFound ?? 0) >= 4, `skills=${r?.skillsFound}`);
  check("matched skills > 0", (r?.matched?.length ?? 0) > 0, `matched=${r?.matched?.length}`);
  check("score within (0,100)", r && r.score > 0 && r.score <= 100, `score=${r?.score}`);
  check("job explanation present", typeof r?.explanation === "string" && r.explanation.length > 20);

  const short = await api("/api/job-analyzer", { method: "POST", cookie, body: { text: "too short" } });
  check("short JD rejected → 422", short.status === 422);

  // ---- 8. resume upload → extract → confirm -----------------------------
  console.log("[8] resume");
  if (existsSync(RESUME_PATH)) {
    const bytes = readFileSync(RESUME_PATH);
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "application/pdf" }), "test-resume.pdf");
    const up = await api("/api/resumes", { method: "POST", cookie, form });
    check("POST /api/resumes (upload+extract)", up.status === 201, JSON.stringify(up.body?.error ?? {}).slice(0, 220));
    const skills = up.body?.analysis?.parsed?.skills ?? [];
    check("skills extracted from PDF", skills.length >= 3, `skills=${skills.map((s) => s.slug).join(",").slice(0, 100)}`);
    check("page count captured", typeof up.body?.resume?.page_count === "number");

    if (up.body?.resume?.id && skills.length) {
      const confirm = await api(`/api/resumes/${up.body.resume.id}/confirm`, {
        method: "POST",
        cookie,
        body: { skillSlugs: skills.map((s) => s.slug), importSummary: true },
      });
      check("POST confirm", confirm.status === 200, JSON.stringify(confirm.body?.error ?? {}).slice(0, 200));
      check("skills imported", (confirm.body?.added ?? 0) > 0, `added=${confirm.body?.added} total=${confirm.body?.totalSkills}`);

      const dupForm = new FormData();
      dupForm.append("file", new Blob([bytes], { type: "application/pdf" }), "test-resume.pdf");
      const dup = await api("/api/resumes", { method: "POST", cookie, form: dupForm });
      check("duplicate upload detected", dup.status === 200 && dup.body?.duplicate === true);

      const delResume = await api(`/api/resumes/${up.body.resume.id}`, { method: "DELETE", cookie });
      check("DELETE resume", delResume.status === 200 && delResume.body?.ok === true);
    }
  } else {
    check("resume fixture exists", false, `missing ${RESUME_PATH}`);
  }

  // ---- 9. explain endpoint (Gemini graceful fallback) --------------------
  console.log("[9] ai explain endpoint");
  const explainRes = await fetch("http://127.0.0.1:8000/api/v1/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Internal-API-Key": env.INTERNAL_API_KEY ?? "" },
    body: JSON.stringify({
      kind: "recommendations",
      evidence: {
        entries: [
          { rank: 1, role: "Frontend Developer", score: 82.5, matched_required: ["reactjs"], missing_required: ["graphql"] },
        ],
      },
    }),
  }).then((x) => x.json());
  check(
    "explain responds with provider shape",
    explainRes && ("explanations" in explainRes) && ("model_used" in explainRes),
    `reason=${explainRes?.reason ?? explainRes?.model_used ?? "unknown"}`
  );
  check(
    "gemini produced explanations",
    Array.isArray(explainRes?.explanations) && explainRes.explanations.length === 1 && explainRes.explanations[0].length > 20,
    `model=${explainRes?.model_used ?? "none"}`
  );

  // ---- cleanup ----------------------------------------------------------
  console.log("[cleanup]");
  if (userId) {
    const del = await supa(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
    check("delete smoke user", del.status === 200 || del.status === 204, `status ${del.status}`);
  }

  console.log(`\n=== result: ${passed} passed, ${failed} failed ===`);
  if (failed) {
    console.log(failures.map((f) => ` - ${f}`).join("\n"));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("smoke crashed:", err);
  process.exitCode = 1;
});
