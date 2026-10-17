"""Minimal Gemini REST adapter for grounded generation and RAG embeddings."""

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
import json
from typing import Any

import httpx

from agent.generation import AnswerGenerator, GenerationError, grounded_system_prompt, grounded_user_prompt
from rag.ingestion import MarkdownChunk


class GeminiApiError(GenerationError):
    """A deliberately non-sensitive Gemini API failure."""


class GeminiProvider(AnswerGenerator):
    def __init__(
        self,
        *,
        api_key: str,
        generation_model: str = "gemini-3.5-flash-lite",
        embedding_model: str = "gemini-embedding-2",
        embedding_dimensions: int = 768,
        base_url: str = "https://generativelanguage.googleapis.com/v1beta",
        timeout_seconds: float = 30.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if not api_key.strip():
            raise ValueError("GEMINI_API_KEY is required when AI_PROVIDER=gemini")
        self._generation_model = generation_model
        self._embedding_model = embedding_model
        self._embedding_dimensions = embedding_dimensions
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            timeout=timeout_seconds,
            transport=transport,
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            response = await self._client.post(path, json=payload)
            response.raise_for_status()
            data = response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise GeminiApiError("Gemini API hiện không phản hồi hợp lệ. Vui lòng thử lại sau.") from error
        if not isinstance(data, dict):
            raise GeminiApiError("Gemini API trả về dữ liệu không hợp lệ.")
        return data

    async def _embed(self, texts: Sequence[str], *, task_type: str) -> list[list[float]]:
        if not texts:
            return []
        vectors: list[list[float]] = []
        for offset in range(0, len(texts), 100):
            batch = texts[offset : offset + 100]
            requests = [
                {
                    "model": f"models/{self._embedding_model}",
                    "content": {"parts": [{"text": text}]},
                    "taskType": task_type,
                    "outputDimensionality": self._embedding_dimensions,
                }
                for text in batch
            ]
            data = await self._post(f"/models/{self._embedding_model}:batchEmbedContents", {"requests": requests})
            embeddings = data.get("embeddings")
            if not isinstance(embeddings, list) or len(embeddings) != len(batch):
                raise GeminiApiError("Gemini API trả về số lượng embedding không hợp lệ.")
            for embedding in embeddings:
                values = embedding.get("values") if isinstance(embedding, dict) else None
                if not isinstance(values, list) or not values:
                    raise GeminiApiError("Gemini API trả về embedding không hợp lệ.")
                try:
                    vector = [float(value) for value in values]
                except (TypeError, ValueError) as error:
                    raise GeminiApiError("Gemini API trả về embedding không hợp lệ.") from error
                vectors.append(vector)
        return vectors

    async def embed_documents(self, chunks: Sequence[MarkdownChunk]) -> list[list[float]]:
        texts = [
            f"task: question answering | title: {chunk.title} | text: {chunk.text}"
            for chunk in chunks
        ]
        return await self._embed(texts, task_type="RETRIEVAL_DOCUMENT")

    async def embed_query(self, query: str) -> list[float]:
        vectors = await self._embed([f"task: question answering | query: {query}"], task_type="RETRIEVAL_QUERY")
        return vectors[0]

    async def generate(
        self,
        question: str,
        chunks: Sequence[MarkdownChunk],
        *,
        live_data=(),
        history=(),
    ) -> str:
        data = await self._post(
            f"/models/{self._generation_model}:generateContent",
            self._generation_payload(question, chunks, live_data, history),
        )
        candidates = data.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            raise GeminiApiError("Gemini không tạo được câu trả lời an toàn.")
        content = candidates[0].get("content", {}) if isinstance(candidates[0], dict) else {}
        parts = content.get("parts", []) if isinstance(content, dict) else []
        answer = "".join(
            part.get("text", "")
            for part in parts
            if isinstance(part, dict) and isinstance(part.get("text"), str)
        ).strip()
        if not answer:
            raise GeminiApiError("Gemini không tạo được câu trả lời an toàn.")
        return answer

    def _generation_payload(self, question: str, chunks: Sequence[MarkdownChunk], live_data, history=()) -> dict[str, Any]:
        return {
            "systemInstruction": {"parts": [{"text": grounded_system_prompt()}]},
            "contents": [{"role": "user", "parts": [{"text": grounded_user_prompt(question, chunks, live_data, history)}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 700},
        }

    async def stream_generate(
        self,
        question: str,
        chunks: Sequence[MarkdownChunk],
        *,
        live_data=(),
        history=(),
    ) -> AsyncIterator[str]:
        """Yield Gemini's actual streamed text parts as they arrive."""

        try:
            async with self._client.stream(
                "POST",
                f"/models/{self._generation_model}:streamGenerateContent?alt=sse",
                json=self._generation_payload(question, chunks, live_data, history),
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if not raw or raw == "[DONE]":
                        continue
                    try:
                        data = json.loads(raw)
                    except (TypeError, ValueError) as error:
                        raise GeminiApiError("Gemini trả về dữ liệu streaming không hợp lệ.") from error
                    candidates = data.get("candidates") if isinstance(data, dict) else None
                    if not isinstance(candidates, list) or not candidates:
                        continue
                    candidate = candidates[0] if isinstance(candidates[0], dict) else {}
                    content = candidate.get("content", {})
                    parts = content.get("parts", []) if isinstance(content, dict) else []
                    for part in parts:
                        text = part.get("text") if isinstance(part, dict) else None
                        if isinstance(text, str) and text:
                            yield text
        except (httpx.HTTPError, ValueError) as error:
            raise GeminiApiError("Gemini API hiện không phản hồi streaming hợp lệ. Vui lòng thử lại sau.") from error
