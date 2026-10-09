import asyncio
from pathlib import Path
import unittest

from rag.ingestion import MarkdownChunk, load_markdown_chunks
from rag.retrieval import TfidfRetriever, VectorRetriever


class _FakeEmbeddingProvider:
    async def embed_documents(self, chunks):
        vocabulary = ("hủy", "cọc", "vip")
        texts = [f"{chunk.title}\n{chunk.text}" for chunk in chunks]
        return [[float(text.casefold().count(term)) for term in vocabulary] for text in texts]

    async def embed_query(self, query):
        vocabulary = ("hủy", "cọc", "vip")
        return [float(query.casefold().count(term)) for term in vocabulary]


class RetrievalTest(unittest.TestCase):
    def test_vector_retriever_returns_the_closest_chunk(self) -> None:
        chunks = [
            MarkdownChunk("customer-policy.md", ("Hủy phòng",), "Hủy sát giờ sẽ mất cọc.", 10, 10),
            MarkdownChunk("customer-policy.md", ("VIP",), "Hạng Gold được giảm giá.", 20, 20),
        ]

        async def scenario():
            retriever = await VectorRetriever.build(chunks, _FakeEmbeddingProvider(), minimum_score=0.1)
            return await retriever.search("Hủy phòng có mất cọc không?")

        results = asyncio.run(scenario())
        self.assertEqual("Hủy phòng", results[0].chunk.title)
        self.assertGreater(results[0].score, 0.9)

    def test_lexical_fallback_finds_canonical_cancellation_policy(self) -> None:
        policy_path = Path(__file__).resolve().parents[2] / "customer-policy.md"
        retriever = TfidfRetriever(load_markdown_chunks(policy_path))

        results = asyncio.run(retriever.search("Hủy đúng 48 giờ có mất tiền đặt cọc không?"))

        self.assertTrue(results)
        self.assertIn("4. Hủy phòng", results[0].chunk.title)

    def test_blank_query_returns_no_results(self) -> None:
        retriever = TfidfRetriever([])
        self.assertEqual([], asyncio.run(retriever.search("   ")))

    def test_vector_dimensions_are_validated(self) -> None:
        chunk = MarkdownChunk("customer-policy.md", ("Chính sách",), "Nội dung", 1, 1)
        with self.assertRaisesRegex(ValueError, "same dimension"):
            VectorRetriever([chunk, chunk], [[1.0], [1.0, 2.0]], _FakeEmbeddingProvider())


if __name__ == "__main__":
    unittest.main()
