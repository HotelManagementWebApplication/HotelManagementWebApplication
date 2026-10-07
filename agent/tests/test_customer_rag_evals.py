import asyncio
import json
from pathlib import Path
import unittest

from policies.safety import check_customer_message
from rag.ingestion import load_markdown_chunks
from rag.retrieval import TfidfRetriever, has_grounding_overlap


class CustomerRagEvalTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        root = Path(__file__).resolve().parents[2]
        cls.cases = json.loads((root / "agent" / "evals" / "customer_rag_cases.json").read_text(encoding="utf-8"))
        cls.retriever = TfidfRetriever(load_markdown_chunks(root / "customer-policy.md"), minimum_score=0)

    def test_eval_ids_are_unique(self) -> None:
        identifiers = [case["id"] for case in self.cases]
        self.assertEqual(len(identifiers), len(set(identifiers)))

    def test_known_policy_questions_retrieve_the_expected_section(self) -> None:
        failures = []
        for case in self.cases:
            if not case.get("expected_heading"):
                continue
            results = asyncio.run(self.retriever.search(case["question"], limit=5))
            if not results or not any(case["expected_heading"] in result.chunk.title for result in results):
                failures.append((case["id"], [result.chunk.title for result in results]))
        self.assertEqual([], failures)

    def test_known_policy_questions_retrieve_the_required_facts(self) -> None:
        failures = []
        for case in self.cases:
            required_facts = case.get("required_facts", [])
            if not case.get("expected_heading") or not required_facts:
                continue
            results = asyncio.run(self.retriever.search(case["question"], limit=5))
            retrieved_text = " ".join(
                " ".join(f"{item.chunk.title} {item.chunk.content}".split()).casefold()
                for item in results
            )
            missing = [fact for fact in required_facts if fact.casefold() not in retrieved_text]
            if missing:
                failures.append((case["id"], missing))
        self.assertEqual([], failures)

    def test_unknown_policy_has_no_query_specific_evidence(self) -> None:
        case = next(item for item in self.cases if item["id"] == "unknown-policy")
        results = asyncio.run(self.retriever.search(case["question"], limit=1))
        self.assertTrue(results)
        self.assertFalse(has_grounding_overlap(case["question"], results[0].chunk))

    def test_security_eval_is_rejected_before_retrieval(self) -> None:
        case = next(item for item in self.cases if item["id"] == "prompt-injection")
        self.assertFalse(check_customer_message(case["question"]).allowed)


if __name__ == "__main__":
    unittest.main()
