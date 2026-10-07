"""Retrieval contracts plus deterministic and embedding-backed indexes."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import math
import re
from typing import Protocol, Sequence
import unicodedata

from .ingestion import MarkdownChunk
from .qdrant import ChunkStore


_WORD = re.compile(r"[^\W_]+", re.UNICODE)
_STOP_WORDS = frozenset(
    {
        "ai",
        "bao",
        "bị",
        "có",
        "của",
        "cho",
        "được",
        "gì",
        "khi",
        "không",
        "là",
        "một",
        "nào",
        "những",
        "phải",
        "thế",
        "thì",
        "tôi",
        "trong",
        "và",
        "vào",
        "sân",
        "riêng",
    }
)
_DOMAIN_WORDS = frozenset(
    {"booking", "dịch", "giá", "khách", "phòng", "sạn", "vụ", "xe", "miễn", "phí", "qua", "đêm"}
)


def _tokens(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFC", text).casefold()
    aliases = {"tiếng": "giờ"}
    return [
        aliases.get(token, token)
        for token in _WORD.findall(normalized)
        if len(token) > 1 and token not in _STOP_WORDS and token not in _DOMAIN_WORDS
    ]


def has_grounding_overlap(query: str, chunk: MarkdownChunk) -> bool:
    """Require evidence for at least one query-specific term.

    Common hotel-domain words alone are not evidence that a policy exists. This
    prevents an unknown subject such as parking from matching any paragraph
    that merely repeats "hotel" and "room".
    """

    specific_terms = set(_tokens(query)) - _DOMAIN_WORDS
    evidence_terms = set(_tokens(f"{chunk.title} {chunk.text}"))
    return bool(specific_terms & evidence_terms)


@dataclass(frozen=True, slots=True)
class SearchResult:
    chunk: MarkdownChunk
    score: float


class Retriever(Protocol):
    async def search(self, query: str, *, limit: int = 4) -> list[SearchResult]: ...


class EmbeddingProvider(Protocol):
    async def embed_documents(self, chunks: Sequence[MarkdownChunk]) -> list[list[float]]: ...

    async def embed_query(self, query: str) -> list[float]: ...


def _cosine(left: Sequence[float], right: Sequence[float]) -> float:
    if len(left) != len(right) or not left:
        raise ValueError("embedding dimensions must be equal and non-empty")
    numerator = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return numerator / (left_norm * right_norm)


class VectorRetriever:
    """Small in-memory cosine index suitable for the versioned rule corpus."""

    def __init__(
        self,
        chunks: Sequence[MarkdownChunk],
        vectors: Sequence[Sequence[float]],
        provider: EmbeddingProvider,
        *,
        minimum_score: float = 0.35,
    ) -> None:
        if len(chunks) != len(vectors):
            raise ValueError("each chunk must have exactly one embedding")
        if vectors and any(len(vector) != len(vectors[0]) for vector in vectors):
            raise ValueError("all embeddings must use the same dimension")
        self._chunks = list(chunks)
        self._vectors = [list(vector) for vector in vectors]
        self._provider = provider
        self._minimum_score = minimum_score

    @classmethod
    async def build(
        cls,
        chunks: Sequence[MarkdownChunk],
        provider: EmbeddingProvider,
        *,
        minimum_score: float = 0.35,
    ) -> "VectorRetriever":
        vectors = await provider.embed_documents(chunks) if chunks else []
        return cls(chunks, vectors, provider, minimum_score=minimum_score)

    async def search(self, query: str, *, limit: int = 4) -> list[SearchResult]:
        if not query.strip() or limit <= 0 or not self._chunks:
            return []
        query_vector = await self._provider.embed_query(query)
        ranked = sorted(
            (
                SearchResult(chunk, _cosine(query_vector, vector))
                for chunk, vector in zip(self._chunks, self._vectors, strict=True)
            ),
            key=lambda item: item.score,
            reverse=True,
        )
        return [item for item in ranked if item.score >= self._minimum_score][:limit]


class TfidfRetriever:
    """Deterministic lexical retriever for local tests and evaluation harnesses.

    Production wiring uses :class:`QdrantRetriever`; this class is never selected
    from settings and is not an outage fallback.
    """

    def __init__(self, chunks: Sequence[MarkdownChunk], *, minimum_score: float = 0.08) -> None:
        self._chunks = list(chunks)
        self._minimum_score = minimum_score
        documents = [Counter(_tokens(f"{chunk.title} {chunk.content}")) for chunk in chunks]
        document_frequency: Counter[str] = Counter()
        for document in documents:
            document_frequency.update(document.keys())
        count = max(len(documents), 1)
        self._idf = {term: math.log((count + 1) / (frequency + 1)) + 1 for term, frequency in document_frequency.items()}
        self._vectors = [self._tfidf(document) for document in documents]

    def _tfidf(self, counts: Counter[str]) -> dict[str, float]:
        total = sum(counts.values()) or 1
        return {term: (frequency / total) * self._idf.get(term, 1.0) for term, frequency in counts.items()}

    @staticmethod
    def _sparse_cosine(left: dict[str, float], right: dict[str, float]) -> float:
        numerator = sum(value * right.get(term, 0.0) for term, value in left.items())
        left_norm = math.sqrt(sum(value * value for value in left.values()))
        right_norm = math.sqrt(sum(value * value for value in right.values()))
        if left_norm == 0 or right_norm == 0:
            return 0.0
        return numerator / (left_norm * right_norm)

    async def search(self, query: str, *, limit: int = 4) -> list[SearchResult]:
        if not query.strip() or limit <= 0:
            return []
        query_vector = self._tfidf(Counter(_tokens(query)))
        query_terms = set(query_vector)
        ranked = sorted(
            (
                SearchResult(
                    chunk,
                    self._sparse_cosine(query_vector, vector)
                    + 0.02 * len(query_terms & set(_tokens(f"{chunk.title} {chunk.content}"))),
                )
                for chunk, vector in zip(self._chunks, self._vectors, strict=True)
            ),
            key=lambda item: item.score,
            reverse=True,
        )
        return [item for item in ranked if item.score >= self._minimum_score][:limit]


class QdrantRetriever:
    """Production retriever backed by the persistent cosine collection."""

    def __init__(
        self,
        store: ChunkStore,
        provider: EmbeddingProvider,
        *,
        minimum_score: float = 0.35,
    ) -> None:
        self._store = store
        self._provider = provider
        self._minimum_score = minimum_score

    async def search(self, query: str, *, limit: int = 4) -> list[SearchResult]:
        if not query.strip() or limit <= 0:
            return []
        query_vector = await self._provider.embed_query(query)
        found = await self._store.search(query_vector, limit=min(max(limit, 1), 5))
        results: list[SearchResult] = []
        for score, payload in found:
            if score < self._minimum_score:
                continue
            if payload.get("source") != "customer-policy.md":
                continue
            try:
                chunk = MarkdownChunk.from_payload(payload)
            except ValueError:
                continue
            results.append(SearchResult(chunk, score))
        return results[:5]
