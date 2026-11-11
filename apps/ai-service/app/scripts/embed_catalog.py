"""Embed the skill catalogue and career roles with all-MiniLM-L6-v2 (384-d).

Run from apps/ai-service:
    node scripts/run.mjs -m app.scripts.embed_catalog           # NULL rows only
    node scripts/run.mjs -m app.scripts.embed_catalog --force   # re-encode all

Writes pgvector literals into skills.embedding / career_roles.embedding so the
web app can do cosine re-ranking (semantic_matches) behind the alias matcher.
"""

from __future__ import annotations

import argparse
import sys
import time

import psycopg
from sentence_transformers import SentenceTransformer

from app.core.config import settings


def _vec(values) -> str:  # type: ignore[no-untyped-def]
    return "[" + ",".join(f"{float(v):.7f}" for v in values) + "]"


def _encode(model: SentenceTransformer, texts: list[str]) -> list[str]:
    vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    dim = settings.embedding_dim
    out: list[str] = []
    for vec in vectors:
        if len(vec) != dim:
            raise RuntimeError(f"model produced {len(vec)}-d vectors, expected {dim}")
        out.append(_vec(vec))
    return out


def embed_catalog(force: bool = False) -> int:
    if not settings.database_configured:
        print("DATABASE_URL is not configured — cannot embed.", file=sys.stderr)
        return 1

    print(f"loading model {settings.embedding_model} (first run downloads ~90 MB) ...")
    model = SentenceTransformer(settings.embedding_model)
    updated = 0

    with psycopg.connect(settings.database_url) as conn:
        skill_filter = "" if force else "where embedding is null"
        skills = conn.execute(
            f"""
            select id, name, coalesce(description, '')
              from public.skills {skill_filter}
             order by name
            """
        ).fetchall()
        if skills:
            vecs = _encode(model, [f"{name}. {desc}".strip() for _, name, desc in skills])
            with conn.transaction():
                for (sid, _, _), vec in zip(skills, vecs, strict=True):
                    conn.execute(
                        "update public.skills set embedding = %s::vector where id = %s",
                        (vec, sid),
                    )
            updated += len(skills)
            print(f"skills: embedded {len(skills)}")

        role_filter = "" if force else "where embedding is null"
        roles = conn.execute(
            f"""
            select id, name, description
              from public.career_roles {role_filter}
             order by display_order
            """
        ).fetchall()
        if roles:
            vecs = _encode(model, [f"{name}. {desc}" for _, name, desc in roles])
            with conn.transaction():
                for (rid, _, _), vec in zip(roles, vecs, strict=True):
                    conn.execute(
                        "update public.career_roles set embedding = %s::vector where id = %s",
                        (vec, rid),
                    )
            updated += len(roles)
            print(f"career_roles: embedded {len(roles)}")

        remaining = conn.execute(
            """
            select
              (select count(1) from public.skills where embedding is null) as skills_null,
              (select count(1) from public.career_roles where embedding is null) as roles_null
            """
        ).fetchone()
        print(f"remaining NULL embeddings: skills={remaining[0]} roles={remaining[1]}")

    print(f"done — {updated} rows updated (dim={settings.embedding_dim})")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Embed skills and career roles with pgvector.")
    parser.add_argument("--force", action="store_true", help="re-encode every row, not only NULLs")
    args = parser.parse_args()
    started = time.time()
    code = embed_catalog(force=args.force)
    print(f"elapsed {time.time() - started:.1f}s")
    raise SystemExit(code)


if __name__ == "__main__":
    main()
