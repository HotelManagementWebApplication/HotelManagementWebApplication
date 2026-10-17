import asyncio
import json
import unittest

import httpx

from providers.gemini import GeminiApiError, GeminiProvider
from rag.ingestion import MarkdownChunk
from app.settings import Settings


class GeminiProviderTest(unittest.TestCase):
    def test_settings_defaults_match_embedding_payload(self) -> None:
        captured_payloads: list[dict] = []

        def handler(request: httpx.Request) -> httpx.Response:
            payload = json.loads(request.content)
            captured_payloads.append(payload)
            return httpx.Response(200, json={"embeddings": [{"values": [0.1, 0.2]}]})

        settings = Settings(
            _env_file=None,
            ai_provider="gemini",
            gemini_api_key="test-key",
        )
        self.assertEqual("gemini-3.5-flash-lite", settings.gemini_generation_model)
        self.assertEqual("gemini-embedding-2", settings.gemini_embedding_model)
        self.assertEqual(768, settings.gemini_embedding_dimensions)

        provider = GeminiProvider(
            api_key=settings.gemini_api_key.get_secret_value(),
            generation_model=settings.gemini_generation_model,
            embedding_model=settings.gemini_embedding_model,
            embedding_dimensions=settings.gemini_embedding_dimensions,
            transport=httpx.MockTransport(handler),
        )

        async def scenario() -> None:
            try:
                await provider.embed_documents(
                    [MarkdownChunk("customer-policy.md", ("Parking",), "Parking is available.", 1, 1)]
                )
            finally:
                await provider.close()

        asyncio.run(scenario())

        request = captured_payloads[0]["requests"][0]
        self.assertEqual("models/gemini-embedding-2", request["model"])
        self.assertEqual(settings.gemini_embedding_dimensions, request["outputDimensionality"])
        self.assertEqual("RETRIEVAL_DOCUMENT", request["taskType"])

    def test_asymmetric_embedding_payloads_and_vectors(self) -> None:
        requests: list[dict] = []

        def handler(request: httpx.Request) -> httpx.Response:
            payload = json.loads(request.content)
            requests.append(payload)
            vectors = [{"values": [1.0, float(index + 1)]} for index, _ in enumerate(payload["requests"])]
            return httpx.Response(200, json={"embeddings": vectors})

        provider = GeminiProvider(api_key="secret", embedding_dimensions=768, transport=httpx.MockTransport(handler))
        chunks = [
            MarkdownChunk("customer-policy.md", ("Hủy phòng",), "Hủy trước 48 giờ.", 1, 1),
            MarkdownChunk("customer-policy.md", ("Nhận phòng",), "Nhận phòng lúc 14:00.", 2, 2),
        ]

        async def scenario():
            documents = await provider.embed_documents(chunks)
            query = await provider.embed_query("Khi nào được hủy?")
            await provider.close()
            return documents, query

        documents, query = asyncio.run(scenario())

        self.assertEqual([[1.0, 1.0], [1.0, 2.0]], documents)
        self.assertEqual([1.0, 1.0], query)
        document_text = requests[0]["requests"][0]["content"]["parts"][0]["text"]
        query_text = requests[1]["requests"][0]["content"]["parts"][0]["text"]
        self.assertTrue(document_text.startswith("task: question answering | title:"))
        self.assertTrue(query_text.startswith("task: question answering | query:"))
        self.assertEqual(768, requests[0]["requests"][0]["outputDimensionality"])
        self.assertEqual("RETRIEVAL_DOCUMENT", requests[0]["requests"][0]["taskType"])
        self.assertEqual("RETRIEVAL_QUERY", requests[1]["requests"][0]["taskType"])

    def test_grounded_generation_uses_system_instruction_and_history(self) -> None:
        captured: dict = {}
        captured_paths: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            captured_paths.append(request.url.path)
            captured.update(json.loads(request.content))
            self.assertEqual("secret", request.headers["x-goog-api-key"])
            return httpx.Response(
                200,
                json={"candidates": [{"content": {"parts": [{"text": "Bạn được hủy trước 48 giờ."}]}}]},
            )

        provider = GeminiProvider(api_key="secret", transport=httpx.MockTransport(handler))
        chunk = MarkdownChunk("customer-policy.md", ("Hủy phòng",), "Hủy trước 48 giờ.", 10, 10)

        async def scenario():
            result = await provider.generate(
                "Tôi hủy lúc nào?",
                [chunk],
                live_data=[{"status": "CONFIRMED"}],
                history=[("user", "Tôi đã đặt phòng."), ("assistant", "Bạn cần hỗ trợ gì?")],
            )
            await provider.close()
            return result

        answer = asyncio.run(scenario())

        self.assertEqual("Bạn được hủy trước 48 giờ.", answer)
        self.assertEqual("/v1beta/models/gemini-3.5-flash-lite:generateContent", captured_paths[0])
        self.assertIn("INSUFFICIENT_CONTEXT", captured["systemInstruction"]["parts"][0]["text"])
        self.assertIn("customer-policy.md:10", captured["contents"][-1]["parts"][0]["text"])
        self.assertIn('"status":"CONFIRMED"', captured["contents"][-1]["parts"][0]["text"])
        self.assertIn("Tôi đã đặt phòng.", captured["contents"][-1]["parts"][0]["text"])

    def test_generation_forwards_actual_stream_parts(self) -> None:
        def handler(_request: httpx.Request) -> httpx.Response:
            body = (
                'data: {"candidates":[{"content":{"parts":[{"text":"Xin "}]}}]}\n\n'
                'data: {"candidates":[{"content":{"parts":[{"text":"chào"}]}}]}\n\n'
            )
            return httpx.Response(200, text=body)

        provider = GeminiProvider(api_key="secret", transport=httpx.MockTransport(handler))
        chunk = MarkdownChunk("customer-policy.md", ("Chào",), "Xin chào.", 1, 1)

        async def scenario():
            values = []
            async for token in provider.stream_generate("Chào", [chunk]):
                values.append(token)
            await provider.close()
            return values

        self.assertEqual(["Xin ", "chào"], asyncio.run(scenario()))

    def test_generation_forwards_gemini_sse_shape_incrementally(self) -> None:
        captured_paths: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            captured_paths.append(request.url.path)
            frames = [
                {
                    "responseId": "response-1",
                    "modelVersion": "gemini-3.5-flash-lite",
                    "candidates": [
                        {
                            "index": 0,
                            "content": {
                                "parts": [{"text": "Xin ", "thoughtSignature": "sig"}],
                                "role": "model",
                            },
                        }
                    ],
                },
                {
                    "responseId": "response-1",
                    "modelVersion": "gemini-3.5-flash-lite",
                    "candidates": [
                        {
                            "index": 0,
                            "content": {"parts": [{"text": "chào"}], "role": "model"},
                            "finishReason": "STOP",
                        }
                    ],
                    "usageMetadata": {"candidatesTokenCount": 2},
                },
            ]
            body = "".join(f"data: {json.dumps(frame, ensure_ascii=False)}\n\n" for frame in frames)
            return httpx.Response(200, text=body, headers={"content-type": "text/event-stream"})

        provider = GeminiProvider(api_key="secret", transport=httpx.MockTransport(handler))

        async def scenario():
            values = []
            async for token in provider.stream_generate(
                "Chào",
                [MarkdownChunk("customer-policy.md", ("Chào",), "Xin chào.", 1, 1)],
            ):
                values.append(token)
            await provider.close()
            return values

        self.assertEqual(["Xin ", "chào"], asyncio.run(scenario()))
        self.assertEqual("/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent", captured_paths[0])

    def test_api_failure_does_not_leak_key_or_response_body(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(401, text="server leaked secret: super-private")

        provider = GeminiProvider(api_key="api-key-value", transport=httpx.MockTransport(handler))

        async def scenario():
            try:
                await provider.embed_query("test")
            finally:
                await provider.close()

        with self.assertRaises(GeminiApiError) as raised:
            asyncio.run(scenario())
        message = str(raised.exception)
        self.assertNotIn("api-key-value", message)
        self.assertNotIn("super-private", message)


if __name__ == "__main__":
    unittest.main()
