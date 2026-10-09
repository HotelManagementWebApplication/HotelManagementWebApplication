"""Minimal Qdrant REST client used by the customer-policy index."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Protocol
import uuid

import httpx

from .ingestion import MarkdownChunk


class QdrantError(RuntimeError):
    """Safe Qdrant failure without response bodies or credentials."""


class ChunkStore(Protocol):
    async def ensure_collection(self) -> None: ...
    async def existing_chunks(self) -> dict[str, str]: ...
    async def upsert(self, points: Sequence[tuple[str, Sequence[float], MarkdownChunk]]) -> None: ...
    async def delete(self, point_ids: Sequence[str]) -> None: ...
    async def search(self, vector: Sequence[float], *, limit: int) -> list[tuple[float, dict[str, object]]]: ...


def point_id(chunk_id: str) -> str:
    """Map our stable SHA identifier to Qdrant's UUID point identifier."""

    try:
        return str(uuid.UUID(hex=chunk_id[:32].ljust(32, "0")))
    except ValueError as error:
        raise ValueError("chunk id must be a hexadecimal stable identifier") from error


class QdrantStore:
    def __init__(
        self,
        url: str,
        collection: str,
        vector_size: int,
        *,
        api_key: str | None = None,
        timeout_seconds: float = 15.0,
        transport: httpx.AsyncBaseTransport | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        if not url.strip() or not collection.strip():
            raise ValueError("Qdrant URL and collection are required")
        if vector_size <= 0:
            raise ValueError("Qdrant vector size must be positive")
        self._owns_client = client is None
        headers = {"api-key": api_key} if api_key else {}
        self._client = client or httpx.AsyncClient(
            base_url=url.rstrip("/"),
            headers=headers,
            timeout=timeout_seconds,
            transport=transport,
        )
        self._collection = collection
        self._vector_size = vector_size

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        try:
            response = await self._client.request(method, path, **kwargs)
            response.raise_for_status()
            data = response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise QdrantError("Qdrant hiện không phản hồi hợp lệ.") from error
        if not isinstance(data, dict) or data.get("status") not in (None, "ok"):
            raise QdrantError("Qdrant trả về dữ liệu không hợp lệ.")
        return data

    async def ensure_collection(self) -> None:
        try:
            response = await self._client.get(f"/collections/{self._collection}")
        except httpx.RequestError as error:
            raise QdrantError("Không thể kết nối kho tìm kiếm chính sách.") from error
        if response.status_code == 404:
            await self._request(
                "PUT",
                f"/collections/{self._collection}",
                json={"vectors": {"size": self._vector_size, "distance": "Cosine"}},
            )
            return
        if not response.is_success:
            raise QdrantError("Kho tìm kiếm chính sách tạm thời không thể xử lý yêu cầu.")
        try:
            data = response.json()
        except ValueError as error:
            raise QdrantError("Kho tìm kiếm chính sách trả về dữ liệu không hợp lệ.") from error
        config = data.get("result", {}).get("config", {}) if isinstance(data, dict) else {}
        params = config.get("params", {}).get("vectors", {}) if isinstance(config, dict) else {}
        size = params.get("size") if isinstance(params, dict) else None
        distance = params.get("distance") if isinstance(params, dict) else None
        if size != self._vector_size or str(distance).casefold() != "cosine":
            raise QdrantError("Qdrant collection không khớp vector cosine đã cấu hình.")

    async def existing_chunks(self) -> dict[str, str]:
        chunks: dict[str, str] = {}
        offset: Any = None
        while True:
            body: dict[str, Any] = {
                "limit": 256,
                "with_payload": ["chunk_id", "content_hash"],
                "with_vector": False,
            }
            if offset is not None:
                body["offset"] = offset
            data = await self._request("POST", f"/collections/{self._collection}/points/scroll", json=body)
            result = data.get("result", {})
            points = result.get("points", []) if isinstance(result, dict) else []
            for item in points:
                payload = item.get("payload", {}) if isinstance(item, dict) else {}
                chunk_id = payload.get("chunk_id")
                content_hash = payload.get("content_hash")
                if isinstance(chunk_id, str) and isinstance(content_hash, str):
                    chunks[chunk_id] = content_hash
            next_offset = result.get("next_page_offset") if isinstance(result, dict) else None
            if next_offset is None:
                return chunks
            offset = next_offset

    async def upsert(self, points: Sequence[tuple[str, Sequence[float], MarkdownChunk]]) -> None:
        if not points:
            return
        payload = {
            "points": [
                {"id": qdrant_id, "vector": list(vector), "payload": chunk.to_payload()}
                for qdrant_id, vector, chunk in points
            ]
        }
        await self._request("PUT", f"/collections/{self._collection}/points", json=payload)

    async def delete(self, point_ids: Sequence[str]) -> None:
        if not point_ids:
            return
        await self._request(
            "POST",
            f"/collections/{self._collection}/points/delete",
            json={"points": list(point_ids), "wait": True},
        )

    async def search(self, vector: Sequence[float], *, limit: int) -> list[tuple[float, dict[str, object]]]:
        if limit <= 0:
            return []
        data = await self._request(
            "POST",
            f"/collections/{self._collection}/points/query",
            json={"query": list(vector), "limit": limit, "with_payload": True},
        )
        result = data.get("result", [])
        if isinstance(result, dict):
            result = result.get("points", [])
        if not isinstance(result, list):
            raise QdrantError("Qdrant trả về kết quả tìm kiếm không hợp lệ.")
        found: list[tuple[float, dict[str, object]]] = []
        for item in result:
            if not isinstance(item, dict) or not isinstance(item.get("payload"), dict):
                continue
            score = item.get("score")
            if isinstance(score, (int, float)):
                found.append((float(score), item["payload"]))
        return found
