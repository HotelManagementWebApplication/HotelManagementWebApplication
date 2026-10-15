import asyncio
import json
from pathlib import Path
import unittest

from agent.orchestrator import CustomerChatService


_CATALOG = [
    {"room_name": "501", "room_type_id": "RT001", "room_type_code": "STD", "room_type_name": "Phòng Classic Queen", "marketing_name": "Phòng Classic", "daily_price": 1_200_000},
    {"room_name": "502", "room_type_id": "RT002", "room_type_code": "STD", "room_type_name": "Phòng Classic Twin", "marketing_name": "Phòng Classic", "daily_price": 1_450_000},
    {"room_name": "503", "room_type_id": "RT003", "room_type_code": "SUP", "room_type_name": "Phòng Superior King", "marketing_name": "Phòng Superior", "daily_price": 1_800_000},
    {"room_name": "504", "room_type_id": "RT004", "room_type_code": "SUP", "room_type_name": "Phòng Superior Hai Giường Queen", "marketing_name": "Phòng Superior", "daily_price": 2_100_000},
    {"room_name": "903", "room_type_id": "RT005", "room_type_code": "DLX", "room_type_name": "Phòng Deluxe King", "marketing_name": "Phòng Deluxe", "daily_price": 2_600_000},
    {"room_name": "904", "room_type_id": "RT006", "room_type_code": "DLX", "room_type_name": "Phòng Deluxe Family", "marketing_name": "Phòng Deluxe", "daily_price": 3_200_000},
    {"room_name": "1104", "room_type_id": "RT007", "room_type_code": "SUT", "room_type_name": "Suite Hoàng Gia Residence", "marketing_name": "Suite Hoàng Gia", "daily_price": 4_500_000},
    {"room_name": "1304", "room_type_id": "RT008", "room_type_code": "SUT", "room_type_name": "Suite Hoàng Gia Executive", "marketing_name": "Suite Hoàng Gia", "daily_price": 5_800_000},
    {"room_name": "1704", "room_type_id": "RT009", "room_type_code": "VIP", "room_type_name": "Penthouse Tổng Thống", "marketing_name": "Penthouse Tổng Thống", "daily_price": 9_500_000},
]


class _CatalogBackend:
    def __init__(self) -> None:
        self.calls = 0
        self.sizes = []

    async def public_rooms(self, *, room_type=None, size=10):
        self.calls += 1
        self.sizes.append(size)
        return _CATALOG[:size]


class _NoRetrieval:
    async def search(self, *_args, **_kwargs):
        raise AssertionError("room catalog questions must use the backend, not RAG")


class CustomerAgentEvalTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        path = Path(__file__).resolve().parents[1] / "evals" / "customer_agent_cases.json"
        cls.cases = json.loads(path.read_text(encoding="utf-8"))

    def test_eval_ids_are_unique(self) -> None:
        ids = [case["id"] for case in self.cases]
        self.assertEqual(len(ids), len(set(ids)))

    def test_room_catalog_questions_keep_count_tier_and_price_intents_separate(self) -> None:
        for case in self.cases:
            with self.subTest(case=case["id"]):
                backend = _CatalogBackend()
                response = asyncio.run(CustomerChatService(_NoRetrieval(), backend).answer(case["question"]))

                self.assertEqual("live_data", response.mode)
                self.assertEqual(1, backend.calls)
                self.assertEqual([100], backend.sizes)
                for expected in case["must_include"]:
                    self.assertIn(expected, response.answer)
                for forbidden in case["must_not_include"]:
                    self.assertNotIn(forbidden, response.answer)


if __name__ == "__main__":
    unittest.main()
