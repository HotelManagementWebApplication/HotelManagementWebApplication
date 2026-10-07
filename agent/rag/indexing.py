"""Delta indexing for the one allowed source: ``customer-policy.md``."""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from app.settings import Settings, get_settings
from providers.gemini import GeminiProvider

from .ingestion import MarkdownChunk, load_markdown_chunks
from .qdrant import ChunkStore, point_id, QdrantStore


@dataclass(frozen=True, slots=True)
class IndexSummary:
    added: int
    changed: int
    unchanged: int
    deleted: int


async def index_chunks(
    chunks: Sequence[MarkdownChunk],
    provider,
    store: ChunkStore,
) -> IndexSummary:
    """Upsert only new/changed chunks and delete chunks removed from the source."""

    await store.ensure_collection()
    existing = await store.existing_chunks()
    current = {chunk.id: chunk for chunk in chunks}
    changed = [chunk for chunk in chunks if existing.get(chunk.id) != chunk.content_hash]
    unchanged = sum(existing.get(chunk.id) == chunk.content_hash for chunk in chunks)
    removed_ids = sorted(set(existing) - set(current))
    vectors = await provider.embed_documents(changed) if changed else []
    if len(vectors) != len(changed):
        raise ValueError("embedding provider returned an unexpected vector count")
    await store.upsert([(point_id(chunk.id), vector, chunk) for chunk, vector in zip(changed, vectors, strict=True)])
    await store.delete([point_id(chunk_id) for chunk_id in removed_ids])
    return IndexSummary(
        added=sum(chunk.id not in existing for chunk in changed),
        changed=sum(chunk.id in existing for chunk in changed),
        unchanged=unchanged,
        deleted=len(removed_ids),
    )


async def index_customer_policy(
    policy_path: Path,
    provider,
    store: ChunkStore,
    *,
    target_tokens: int = 360,
    max_tokens: int = 450,
) -> IndexSummary:
    if policy_path.name != "customer-policy.md":
        raise ValueError("the customer index accepts only customer-policy.md")
    chunks = load_markdown_chunks(policy_path, target_tokens=target_tokens, max_tokens=max_tokens)
    return await index_chunks(chunks, provider, store)


async def _run(settings: Settings, policy_path: Path) -> IndexSummary:
    api_key = settings.gemini_api_key
    if api_key is None:
        raise ValueError("GEMINI_API_KEY is required when AI_PROVIDER=gemini")
    provider = GeminiProvider(
        api_key=api_key.get_secret_value(),
        generation_model=settings.gemini_generation_model,
        embedding_model=settings.gemini_embedding_model,
        embedding_dimensions=settings.gemini_embedding_dimensions,
    )
    store = QdrantStore(
        settings.qdrant_url,
        settings.qdrant_collection,
        settings.gemini_embedding_dimensions,
        api_key=settings.qdrant_api_key.get_secret_value() if settings.qdrant_api_key else None,
    )
    try:
        return await index_customer_policy(policy_path, provider, store)
    finally:
        await provider.close()
        await store.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Index customer-policy.md into Qdrant")
    parser.add_argument("--policy", type=Path, default=Path(__file__).resolve().parents[2] / "customer-policy.md")
    args = parser.parse_args()
    summary = asyncio.run(_run(get_settings(), args.policy))
    print(
        f"indexed customer-policy.md: added={summary.added} changed={summary.changed} "
        f"unchanged={summary.unchanged} deleted={summary.deleted}"
    )


if __name__ == "__main__":
    main()
