import asyncio
import json
from pathlib import Path
import unittest

import httpx

from rag.indexing import index_chunks, index_customer_policy
from rag.ingestion import MarkdownChunk
from rag.qdrant import QdrantStore, point_id
from rag.retrieval import QdrantRetriever


class _FakeEmbedder:
    def __init__(self):
        self.calls = []

    async def embed_documents(self, chunks):
        self.calls.append([chunk.id for chunk in chunks])
        return [[float(index + 1), 1.0] for index, _ in enumerate(chunks)]

    async def embed_query(self, query):
        return [1.0, 1.0]


class _FakeStore:
    def __init__(self, existing=None):
        self.existing = dict(existing or {})
        self.upserted = []
        self.deleted = []
        self.ensure_calls = 0

    async def ensure_collection(self):
        self.ensure_calls += 1

    async def existing_chunks(self):
        return dict(self.existing)

    async def upsert(self, points):
        self.upserted.extend(points)
        for _, _, chunk in points:
            self.existing[chunk.id] = chunk.content_hash

    async def delete(self, point_ids):
        self.deleted.extend(point_ids)

    async def search(self, vector, *, limit):
        return []


def _chunk(content, *, identifier="a" * 32, line=1):
    return MarkdownChunk("customer-policy.md", ("Chính sách",), content, line, line, id=identifier)


class IndexingTest(unittest.TestCase):
    def test_indexer_rejects_internal_rule_source(self) -> None:
        with self.assertRaisesRegex(ValueError, "only customer-policy.md"):
            asyncio.run(index_customer_policy(Path("rule.md"), _FakeEmbedder(), _FakeStore()))

    def test_delta_index_embeds_new_and_changed_only_then_deletes_removed(self) -> None:
        first = _chunk("Phòng theo giờ tối thiểu 3 giờ.", identifier="a" * 32)
        second = _chunk("Nhận phòng tiêu chuẩn lúc 14:00.", identifier="b" * 32, line=2)
        store = _FakeStore()
        provider = _FakeEmbedder()

        first_summary = asyncio.run(index_chunks([first, second], provider, store))
        second_summary = asyncio.run(index_chunks([first, second], provider, store))
        changed = _chunk("Nhận phòng tiêu chuẩn lúc 15:00.", identifier="b" * 32, line=2)
        third_summary = asyncio.run(index_chunks([changed], provider, store))

        self.assertEqual((2, 0, 0, 0), (first_summary.added, first_summary.changed, first_summary.unchanged, first_summary.deleted))
        self.assertEqual((0, 0, 2, 0), (second_summary.added, second_summary.changed, second_summary.unchanged, second_summary.deleted))
        self.assertEqual((0, 1, 0, 1), (third_summary.added, third_summary.changed, third_summary.unchanged, third_summary.deleted))
        self.assertEqual([[first.id, second.id], [changed.id]], provider.calls)
        self.assertEqual([point_id(first.id)], store.deleted)

    def test_restart_preserves_unchanged_hashes_without_reembedding(self) -> None:
        chunk = _chunk("Wifi miễn phí trong phòng.")
        first_store = _FakeStore()
        asyncio.run(index_chunks([chunk], _FakeEmbedder(), first_store))
        provider = _FakeEmbedder()
        second_store = _FakeStore(first_store.existing)

        summary = asyncio.run(index_chunks([chunk], provider, second_store))

        self.assertEqual(1, summary.unchanged)
        self.assertEqual([], provider.calls)
        self.assertEqual([], second_store.upserted)

    def test_qdrant_client_creates_cosine_collection_and_persists_payload(self) -> None:
        requests = []

        def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            if request.method == "GET":
                return httpx.Response(404, json={"status": "error"})
            return httpx.Response(200, json={"status": "ok", "result": {}})

        chunk = _chunk("Nội dung.")
        async def scenario():
            transport = httpx.MockTransport(handler)
            async with httpx.AsyncClient(transport=transport, base_url="http://qdrant") as client:
                store = QdrantStore("http://qdrant", "customer_policy", 2, client=client)
                await store.ensure_collection()
                await store.upsert([(point_id(chunk.id), [0.1, 0.9], chunk)])
                await store.delete([point_id(chunk.id)])

        asyncio.run(scenario())
        self.assertEqual(["GET", "PUT", "PUT", "POST"], [request.method for request in requests])
        collection = json.loads(requests[1].content)
        self.assertEqual({"size": 2, "distance": "Cosine"}, collection["vectors"])
        stored = json.loads(requests[2].content)["points"][0]
        self.assertEqual(chunk.id, stored["payload"]["chunk_id"])
        self.assertEqual("customer-policy.md", stored["payload"]["source"])

    def test_qdrant_retrieval_rehydrates_citations_from_payload(self) -> None:
        chunk = _chunk("Mất cọc khi hủy sát giờ.", line=40)

        class Store:
            async def search(self, vector, *, limit):
                internal = dict(chunk.to_payload())
                internal["source"] = "rule.md"
                return [(0.99, internal), (0.91, chunk.to_payload())]

        class Provider:
            async def embed_query(self, query):
                return [1.0]

        results = asyncio.run(QdrantRetriever(Store(), Provider(), minimum_score=0.5).search("hủy cọc"))
        self.assertEqual(chunk.id, results[0].chunk.id)
        self.assertEqual("customer-policy.md", results[0].chunk.source)
        self.assertEqual(40, results[0].chunk.start_line)

    def test_qdrant_query_uses_cosine_vector_search_payload(self) -> None:
        seen = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen.append(request)
            return httpx.Response(200, json={"status": "ok", "result": {"points": [{"score": 0.8, "payload": {"chunk_id": "a" * 32, "content_hash": "h", "source": "customer-policy.md", "heading_path": [], "content": "Nội dung", "block_type": "paragraph", "start_line": 1, "end_line": 1, "token_count": 1}}]}})

        async def scenario():
            transport = httpx.MockTransport(handler)
            async with httpx.AsyncClient(transport=transport, base_url="http://qdrant") as client:
                return await QdrantStore("http://qdrant", "customer_policy", 2, client=client).search([0.2, 0.8], limit=3)

        found = asyncio.run(scenario())
        self.assertEqual("/collections/customer_policy/points/query", seen[0].url.path)
        self.assertEqual({"query": [0.2, 0.8], "limit": 3, "with_payload": True}, json.loads(seen[0].content))
        self.assertEqual(0.8, found[0][0])


if __name__ == "__main__":
    unittest.main()
