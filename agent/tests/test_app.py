import unittest

from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas import ChatResponse
from app.settings import Settings


class _FakeChatService:
    def __init__(self):
        self.token = None

    async def answer(self, message: str, *, access_token: str | None = None, history=None):
        self.token = access_token
        return ChatResponse(answer=f"Đã nhận: {message}", mode="rag")

    async def stream_answer(self, message: str, *, access_token: str | None = None, history=None):
        self.token = access_token
        yield {"event": "metadata", "data": {"mode": "rag", "citations": []}}
        yield {"event": "token", "data": {"text": "A" * 200}}
        yield {"event": "done", "data": {}}


class AgentAppTest(unittest.TestCase):
    def setUp(self) -> None:
        self.service = _FakeChatService()
        settings = Settings(agent_cors_origins=["http://localhost:5173"])
        self.client_context = TestClient(create_app(settings=settings, chat_service=self.service))
        self.client = self.client_context.__enter__()

    def tearDown(self) -> None:
        self.client_context.__exit__(None, None, None)

    def test_health(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(200, response.status_code)
        self.assertEqual("hotel-mis-agent", response.json()["service"])

    def test_chat_forwards_only_bearer_token(self) -> None:
        response = self.client.post(
            "/agent-api/chat",
            headers={"Authorization": "Bearer customer-token"},
            json={"message": "Xin chào", "history": []},
        )
        self.assertEqual(200, response.status_code)
        self.assertEqual("customer-token", self.service.token)

    def test_chat_rejects_non_bearer_or_malformed_authorization(self) -> None:
        response = self.client.post(
            "/agent-api/chat",
            headers={"Authorization": "Basic customer-token"},
            json={"message": "Xin chào", "history": []},
        )
        self.assertEqual(200, response.status_code)
        self.assertIsNone(self.service.token)

    def test_chat_validates_message_length(self) -> None:
        response = self.client.post("/agent-api/chat", json={"message": "", "history": []})
        self.assertEqual(422, response.status_code)

    def test_stream_has_metadata_tokens_and_done_event(self) -> None:
        response = self.client.post("/agent-api/chat/stream", json={"message": "Xin chào"})
        self.assertEqual(200, response.status_code)
        self.assertIn("event: metadata", response.text)
        self.assertIn("event: token", response.text)
        self.assertIn("event: done", response.text)
        self.assertIn("A" * 200, response.text)


if __name__ == "__main__":
    unittest.main()
