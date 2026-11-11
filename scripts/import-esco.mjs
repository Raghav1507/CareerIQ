#!/usr/bin/env node
/**
 * CareerIQ ESCO importer — pulls official ESCO v1.2.0 concepts from the
 * European Commission web-service API and stores confident matches:
 *
 *   career_roles.esco_codes[]  <- occupation URIs (label match against the
 *                                 role name + M1-curated lookup candidates)
 *   skills.esco_code           <- skill URI (exact normalised label/alias match)
 *
 * How it queries (important): the ESCO resource endpoint only serves the first
 * ~1000 rows of a scheme, so the full classification cannot be paged. Both
 * skills and occupations are therefore resolved through ESCO's SEARCH endpoint
 * (official API, official dataset) and each promising concept is then verified
 * against its own preferred/alternative labels via the resource endpoint.
 * Nothing is fabricated: a code is stored only when ESCO itself contains the
 * exact label we look up (or a role candidate contained in an ESCO label).
 *
 * Normalisation is identical to the app's alias matcher:
 *   lowercase, strip everything except a-z0-9+#  ->  "React.js" = "React JS"
 *
 * Responses are cached under scripts/.cache (re-runs are fast and idempotent;
 * --refresh bypasses the cache).
 *
 * Usage:
 *   node scripts/import-esco.mjs --dry-run   fetch + match, print report, no writes
 *   node scripts/import-esco.mjs             fetch + match + write to Postgres
 *   node scripts/import-esco.mjs --refresh   bypass the local JSON cache
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CACHE_DIR = join(__dirname, '.cache');
const ESCO_VERSION = 'v1.2.0';
const API_ROOT = 'https://ec.europa.eu/esco/api';
const SEARCH_PAGE_SIZE = 25;
const DETAIL_TOP_N = 6;
const PACE_MS = 200;

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      if (process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* no env file */
  }
}
loadEnvFile(join(ROOT, '.env'));

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const REFRESH = args.has('--refresh');

/** Same normalisation as apps/web/src/lib/matching.ts + skill_aliases. */
function norm(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9+#]/g, '');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * M1-curated lookup candidates per role. These are only labels we ASK ESCO
 * about; a code is stored exclusively when ESCO itself contains the label.
 * (Mirrors the honesty rule used for the O*NET codes in the seed.)
 */
const ROLE_LOOKUP_CANDIDATES = {
  'full-stack-developer': ['Full Stack Developer', 'Full-stack developer', 'Full stack web developer'],
  'frontend-developer': ['Frontend Developer', 'Front-end Developer', 'Web Developer'],
  'backend-developer': ['Backend Developer', 'Back-end Developer'],
  'data-analyst': ['Data Analyst'],
  'data-scientist': ['Data Scientist'],
  'ml-engineer': ['Machine Learning Engineer', 'ML Engineer'],
  'ai-engineer': ['AI Engineer', 'Artificial Intelligence Engineer'],
  'devops-cloud-engineer': ['DevOps Engineer', 'Cloud Engineer', 'DevOps Cloud Engineer', 'Site Reliability Engineer'],
  'cybersecurity-analyst': ['Cybersecurity Analyst', 'Cyber Security Analyst', 'Security Analyst', 'Information Security Analyst'],
  'software-engineer': ['Software Engineer'],
};

// ---------------------------------------------------------------------------
// API helpers (cached, paced, retried — the EC endpoint throttles bursts)
// ---------------------------------------------------------------------------

async function getJson(url, tries = 5) {
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(60_000),
      });
      // 5xx/429 = EC throttling — worth waiting for; other 4xx will not fix themselves.
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        console.error(`[esco] ${res.status} ${url}`);
        if (!retryable) throw Object.assign(new Error(`HTTP ${res.status}`), { fatal: true });
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (err.fatal) throw err;
      console.error(`[esco] retry in ${2000 * (attempt + 1)}ms (${err.message})`);
      await sleep(2000 * (attempt + 1));
    }
  }
  throw lastErr;
}

async function cachedJson(cacheFile, url) {
  const file = join(CACHE_DIR, cacheFile);
  if (!REFRESH && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const body = await getJson(url);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(body));
  await sleep(PACE_MS);
  return body;
}

/** ESCO search endpoint -> concept list (className-filtered).
 *  Spaces are encoded as `+`, not `%20`: the EC edge stack answers 502 for
 *  some `%20`-encoded phrases (e.g. "Shell Scripting") while the same query
 *  with `+` returns 200 — `+` is valid space encoding in a query string. */
async function searchConcepts(kind, text) {
  const encoded = encodeURIComponent(text).replace(/%20/g, '+');
  const url =
    `${API_ROOT}/search?text=${encoded}&type=${kind}` +
    `&language=en&selectedVersion=${ESCO_VERSION}&limit=${SEARCH_PAGE_SIZE}&offset=0`;
  const body = await cachedJson(`esco-${ESCO_VERSION}-search-${kind}-${norm(text)}.json`, url);
  const className = kind === 'skill' ? 'Skill' : 'Occupation';
  const embedded = body._embedded ?? {};
  return Object.values(embedded)
    .flat()
    .filter((c) => c && c.className === className);
}

/** Full concept (adds alternativeLabel) for one URI. */
async function conceptDetail(kind, uri) {
  const id = String(uri).split('/').pop();
  const url =
    `${API_ROOT}/resource/${kind}?uri=${encodeURIComponent(uri)}` +
    `&language=en&selectedVersion=${ESCO_VERSION}`;
  const body = await cachedJson(`esco-${ESCO_VERSION}-detail-${kind}-${id}.json`, url);
  return body && body.uri ? body : null;
}

function labelsOf(concept) {
  const out = [];
  const pref = concept.preferredLabel?.en;
  if (pref) out.push({ label: pref, kind: 'preferred' });
  for (const alt of concept.alternativeLabel?.en ?? []) out.push({ label: alt, kind: 'alternative' });
  return out;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** Unique, norm-deduped query labels for a skill (name first, then aliases). */
function skillQueries(name, aliases) {
  const queries = [];
  const seen = new Set();
  for (const candidate of [name, ...(aliases ?? [])]) {
    const n = norm(candidate);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    queries.push(candidate);
  }
  return queries;
}

/**
 * Match one catalogue skill against ESCO:
 *   pass A — search results' preferred labels (cheap, exact norm equality)
 *   pass B — top concepts fetched in full so alternativeLabel counts too
 * Stops at the first preferred-label hit; an alternative-label hit is kept
 * unless a preferred one shows up later.
 */
async function matchSkill(s) {
  const candidates = skillQueries(s.name, s.aliases);
  const candNorms = new Map(); // norm -> raw candidate
  for (const c of candidates) candNorms.set(norm(c), c);

  const seen = new Map(); // uri -> search-result concept
  let hit = null;
  let hitVia = null;

  for (const query of candidates) {
    for (const concept of await searchConcepts('skill', query)) {
      if (!seen.has(concept.uri)) seen.set(concept.uri, concept);
    }
    for (const concept of seen.values()) {
      const pref = concept.preferredLabel?.en;
      const n = pref ? norm(pref) : '';
      if (n && candNorms.has(n)) {
        hit = { uri: concept.uri, title: concept.title, kind: 'preferred' };
        hitVia = candNorms.get(n);
        break;
      }
    }
    if (hit) break;
  }

  if (!hit) {
    let checked = 0;
    for (const concept of seen.values()) {
      if (checked >= DETAIL_TOP_N) break;
      checked++;
      const detail = await conceptDetail('skill', concept.uri);
      if (!detail) continue;
      for (const { label, kind } of labelsOf(detail)) {
        const n = norm(label);
        if (candNorms.has(n)) {
          hit = { uri: detail.uri, title: detail.title, kind };
          hitVia = candNorms.get(n);
          break;
        }
      }
      if (hit && hit.kind === 'preferred') break;
    }
  }

  return { uri: hit?.uri ?? null, title: hit?.title ?? null, via: hitVia };
}

/** Labels ESCO returns for every role candidate query (preferred first). */
async function searchRoleLabels(roleRows) {
  const queries = [];
  const seenQuery = new Set();
  for (const r of roleRows) {
    for (const candidate of [r.name, ...(ROLE_LOOKUP_CANDIDATES[r.slug] ?? [])]) {
      const n = norm(candidate);
      if (!n || seenQuery.has(n)) continue;
      seenQuery.add(n);
      queries.push(candidate);
    }
  }

  const labels = [];
  const seenLabel = new Set();
  for (const query of queries) {
    for (const concept of await searchConcepts('occupation', query)) {
      for (const { label } of labelsOf(concept)) {
        const n = norm(label);
        if (!n) continue;
        const key = `${concept.uri}|${n}`;
        if (seenLabel.has(key)) continue;
        seenLabel.add(key);
        labels.push({ norm: n, label, uri: concept.uri, title: concept.title });
      }
    }
  }
  return labels;
}

/** Full concepts (with alternativeLabel) for a role's queries — fallback pass. */
async function detailLabelsForRole(r) {
  const queries = skillQueries(r.name, ROLE_LOOKUP_CANDIDATES[r.slug] ?? []);
  const labels = [];
  const seenLabel = new Set();
  const seenUri = new Set();
  for (const query of queries) {
    for (const concept of (await searchConcepts('occupation', query)).slice(0, 5)) {
      if (seenUri.has(concept.uri)) continue;
      seenUri.add(concept.uri);
      const detail = await conceptDetail('occupation', concept.uri);
      if (!detail) continue;
      for (const { label } of labelsOf(detail)) {
        const n = norm(label);
        if (!n) continue;
        const key = `${detail.uri}|${n}`;
        if (seenLabel.has(key)) continue;
        seenLabel.add(key);
        labels.push({ norm: n, label, uri: detail.uri, title: detail.title });
      }
    }
  }
  return labels;
}

/**
 * A role code is accepted only when ESCO contains the EXACT normalised label
 * we look up (preferred or alternative) — substring hits like
 * "satellite software engineer" ⊇ "software engineer" or "CRM data analyst" ⊇
 * "data analyst" are noise, not equivalents.
 *
 * Containment is still used once, as a *candidate selector*: concepts whose
 * labels contain a role candidate get their full detail fetched, and only an
 * exact label inside that detail is ever accepted (recovers good hits such as
 * "cloud DevOps engineer" ⟷ DevOps Engineer when ESCO's alt label matches).
 */
async function containedDetailLabels(roleRows, occupationLabels) {
  const candNorms = new Map(); // norm -> raw candidate (all roles)
  for (const r of roleRows) {
    for (const candidate of [r.name, ...(ROLE_LOOKUP_CANDIDATES[r.slug] ?? [])]) {
      const n = norm(candidate);
      if (n) candNorms.set(n, candidate);
    }
  }
  const need = new Set(); // URIs whose labels contain a candidate but never equal one
  const exactNorms = new Set(candNorms.keys());
  for (const l of occupationLabels) {
    if (exactNorms.has(l.norm)) continue;
    for (const c of candNorms.keys()) {
      if (l.norm.includes(c)) {
        need.add(l.uri);
        break;
      }
    }
  }
  const extra = [];
  for (const uri of need) {
    const detail = await conceptDetail('occupation', uri);
    if (!detail) continue;
    for (const { label } of labelsOf(detail)) {
      const n = norm(label);
      if (!n || !exactNorms.has(n)) continue;
      extra.push({ norm: n, label, uri: detail.uri, title: detail.title });
    }
  }
  if (extra.length) console.log(`[esco] containment-verified labels: ${extra.length}`);
  return extra;
}

/** Exact normalised label equality only (see containedDetailLabels). */
function matchRoles(roleRows, occupationLabels) {
  return roleRows.map((r) => {
    const candidates = [r.name, ...(ROLE_LOOKUP_CANDIDATES[r.slug] ?? [])];
    const candNorms = candidates.map((c) => ({ raw: c, n: norm(c) })).filter((c) => c.n);
    const hits = new Map(); // uri -> {uri,title,via}
    for (const oc of occupationLabels) {
      for (const c of candNorms) {
        if (oc.norm === c.n) {
          if (!hits.has(oc.uri)) hits.set(oc.uri, { uri: oc.uri, title: oc.title, via: c.raw });
          break;
        }
      }
    }
    return {
      id: r.id,
      slug: r.slug,
      current: r.esco_codes ?? [],
      hits: [...hits.values()],
    };
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[esco] DATABASE_URL is not set (copy .env.example to .env).');
    process.exit(1);
  }

  // The resource scheme endpoint stopped paging beyond ~1000 rows — drop any
  // stale partial dump from older versions of this script.
  rmSync(join(CACHE_DIR, `esco-${ESCO_VERSION}-skills.json`), { force: true });
  rmSync(join(CACHE_DIR, `esco-${ESCO_VERSION}-occupations.json`), { force: true });

  // ---- read catalogue from Postgres ------------------------------------
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const skillRows = (
      await client.query(
        `select s.id, s.slug, s.name, s.esco_code,
                coalesce(json_agg(a.alias) filter (where a.id is not null), '[]') as aliases
           from public.skills s
           left join public.skill_aliases a on a.skill_id = s.id
          group by s.id, s.slug, s.name, s.esco_code
          order by s.slug`
      )
    ).rows;
    const roleRows = (
      await client.query(
        `select id, slug, name, esco_codes from public.career_roles order by display_order`
      )
    ).rows;

    // ---- skills: exact normalised label/alias match via ESCO search ------
    console.log(`[esco] matching ${skillRows.length} skills against ESCO search …`);
    const skillMatches = [];
    let done = 0;
    for (const s of skillRows) {
      const hit = await matchSkill(s);
      skillMatches.push({
        id: s.id,
        slug: s.slug,
        current: s.esco_code,
        ...hit,
      });
      done++;
      if (done % 20 === 0) console.log(`[esco] skills ${done}/${skillRows.length}`);
    }

    // ---- roles: candidate labels via ESCO search (+ detail fallback) -----
    let occupationLabels = await searchRoleLabels(roleRows);
    console.log(`[esco] occupation labels from search: ${occupationLabels.length}`);
    occupationLabels = occupationLabels.concat(await containedDetailLabels(roleRows, occupationLabels));
    let roleMatches = matchRoles(roleRows, occupationLabels);

    const emptyRoles = roleMatches.filter((m) => m.hits.length === 0);
    if (emptyRoles.length) {
      console.log(`[esco] detail fallback for ${emptyRoles.length} role(s) without hits …`);
      for (const empty of emptyRoles) {
        const row = roleRows.find((r) => r.id === empty.id);
        const extra = await detailLabelsForRole(row);
        occupationLabels = occupationLabels.concat(extra);
      }
      occupationLabels = occupationLabels.concat(await containedDetailLabels(roleRows, occupationLabels));
      roleMatches = matchRoles(roleRows, occupationLabels);
    }

    // ---- report ---------------------------------------------------------
    console.log('\n=== skill matches ===');
    let skillHit = 0;
    for (const m of skillMatches) {
      if (m.uri) {
        skillHit++;
        console.log(`  ${m.slug.padEnd(24)} <- "${m.via}" => ${m.title} (${m.uri})`);
      }
    }
    console.log(`skills matched: ${skillHit}/${skillRows.length}`);

    console.log('\n=== role matches ===');
    let roleHit = 0;
    for (const m of roleMatches) {
      if (m.hits.length) {
        roleHit++;
        console.log(`  ${m.slug}:`);
        for (const h of m.hits) console.log(`    <- "${h.via}" => ${h.title} (${h.uri})`);
      } else {
        console.log(`  ${m.slug}: (no ESCO label match)`);
      }
    }
    console.log(`roles matched: ${roleHit}/${roleRows.length}`);

    if (DRY_RUN) {
      console.log('\n[esco] dry run — no rows written.');
      return;
    }

    // ---- write ----------------------------------------------------------
    let skillsWritten = 0;
    for (const m of skillMatches) {
      if (m.uri !== m.current) {
        await client.query('update public.skills set esco_code = $1 where id = $2', [m.uri, m.id]);
        skillsWritten++;
      }
    }
    let rolesWritten = 0;
    for (const m of roleMatches) {
      const uris = m.hits.map((h) => h.uri);
      const same =
        uris.length === m.current.length && uris.every((u, i) => u === m.current[i]);
      if (!same) {
        await client.query('update public.career_roles set esco_codes = $1::text[], updated_at = now() where id = $2', [
          uris,
          m.id,
        ]);
        rolesWritten++;
      }
    }
    console.log(`\n[esco] written: ${skillsWritten} skill codes, ${rolesWritten} role code arrays`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[esco] error:', err.message);
  process.exit(1);
});
