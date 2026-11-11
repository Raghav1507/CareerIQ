/**
 * pgvector semantic safety net (Phase 8) — sits BEHIND the alias matcher.
 *
 * The alias matcher resolves everything it can (React.js = React JS = ReactJS).
 * What it cannot resolve are user-added custom skills ("Bun Runtime", "Svelte"),
 * which are catalogue rows no role ever lists. This module embeds those skills
 * with the AI service and finds cosine bridges (≥ 0.60) from them to a role's
 * missing skills — the bridge then counts as coverage in the M1 evidence,
 * recorded with full provenance in career_recommendations.semantic_matches.
 *
 * Threshold calibration (all-MiniLM-L6-v2, measured against the seed
 * catalogue): true equivalents score 0.65–0.86 (e.g. "Google Cloud Platform"
 * → gcp 0.86, "Server Side JavaScript" → nodejs 0.72) while unrelated pairs
 * stay ≤ 0.44 — 0.60 keeps a wide precision margin.
 *
 * Everything here is best-effort: if the AI service or the embeddings are
 * unavailable, recommendations simply run without semantic bridges.
 */

import { query } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

export const SEMANTIC_SIMILARITY_THRESHOLD = 0.6;

type EmbedRow = { id: string; name: string };

/** Persist pgvector embeddings for user-added skills that lack one. */
export async function ensureCustomSkillEmbeddings(userId: string): Promise<void> {
  try {
    const rows = await query<EmbedRow>(
      `select s.id, s.name
         from public.user_skills us
         join public.skills s on s.id = us.skill_id
        where us.user_id = $1 and s.source = 'user' and s.embedding is null
        order by s.name
        limit 64`,
      [userId]
    );
    if (rows.length === 0) return;

    const env = getServerEnv();
    const res = await fetch(`${env.AI_SERVICE_URL}/api/v1/catalog/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-API-Key": env.INTERNAL_API_KEY,
      },
      body: JSON.stringify({ texts: rows.map((r) => r.name) }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { embeddings?: number[][] };
    const vectors = data.embeddings;
    if (!Array.isArray(vectors) || vectors.length !== rows.length) return;

    for (let i = 0; i < rows.length; i++) {
      const literal = `[${vectors[i].map((v) => Number(v).toFixed(7)).join(",")}]`;
      await query(`update public.skills set embedding = $1::vector where id = $2`, [
        literal,
        rows[i].id,
      ]);
    }
  } catch {
    /* semantic net is optional — never block scoring */
  }
}

export type RowSemanticBridge = {
  role_slug: string;
  role_skill_slug: string;
  role_skill_name: string;
  weight: string;
  is_required: boolean;
  via_skill_slug: string;
  via_skill_name: string;
  similarity: string;
};

/**
 * Best cosine bridge per missing role skill (user-added skill → role skill).
 * Filters out role skills the user already owns exactly.
 */
export async function computeSemanticBridges(
  userId: string,
  roleSlug?: string | null
): Promise<RowSemanticBridge[]> {
  try {
    return await query<RowSemanticBridge>(
      `with owned as (
         select s.slug, s.name, s.embedding
           from public.user_skills us
           join public.skills s on s.id = us.skill_id
          where us.user_id = $1 and s.source = 'user' and s.embedding is not null
       ),
       targets as (
         select r.slug as role_slug, s.slug, s.name, rs.weight, rs.is_required, s.embedding
           from public.career_roles r
           join public.role_skills rs on rs.role_id = r.id
           join public.skills s on s.id = rs.skill_id
          where r.is_active
            and s.embedding is not null
            and ($2::text is null or r.slug = $2)
            and not exists (
              select 1 from public.user_skills us2
               where us2.user_id = $1 and us2.skill_id = s.id
            )
       )
       select distinct on (t.role_slug, t.slug)
              t.role_slug,
              t.slug as role_skill_slug,
              t.name as role_skill_name,
              t.weight,
              t.is_required,
              o.slug as via_skill_slug,
              o.name as via_skill_name,
              round((1 - (t.embedding <=> o.embedding))::numeric, 4)::text as similarity
         from targets t
         join owned o on true
        where 1 - (t.embedding <=> o.embedding) >= $3::float8
        order by t.role_slug, t.slug, (1 - (t.embedding <=> o.embedding)) desc`,
      [userId, roleSlug ?? null, SEMANTIC_SIMILARITY_THRESHOLD]
    );
  } catch {
    return [];
  }
}
