from __future__ import annotations

from contextlib import asynccontextmanager
import json
from pathlib import Path

from fastapi import FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from agent.orchestrator import CustomerChatService
from app.schemas import ChatRequest, ChatResponse
from app.settings import Settings, get_settings
from providers.gemini import GeminiProvider
from rag.qdrant import QdrantStore
from rag.retrieval import QdrantRetriever
from tools.backend import BackendApiClient


def _bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    clean_token = token.strip()
    valid_token = clean_token and all(character.isalnum() or character in "._~+/-=" for character in clean_token)
    return clean_token if scheme.casefold() == "bearer" and valid_token else None


def create_app(
    *,
    settings: Settings | None = None,
    chat_service: CustomerChatService | None = None,
) -> FastAPI:
    resolved_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        backend: BackendApiClient | None = None
        gemini: GeminiProvider | None = None
        qdrant: QdrantStore | None = None
        try:
            if chat_service is not None:
                application.state.chat_service = chat_service
            else:
                policy_path = Path(__file__).resolve().parents[2] / "customer-policy.md"
                if policy_path.name != "customer-policy.md":
                    raise RuntimeError("customer policy source is not configured")
                api_key = resolved_settings.gemini_api_key
                if api_key is None:
                    raise RuntimeError("GEMINI_API_KEY is required when AI_PROVIDER=gemini")
                gemini = GeminiProvider(
                    api_key=api_key.get_secret_value(),
                    generation_model=resolved_settings.gemini_generation_model,
                    embedding_model=resolved_settings.gemini_embedding_model,
                    embedding_dimensions=resolved_settings.gemini_embedding_dimensions,
                )
                qdrant = QdrantStore(
                    resolved_settings.qdrant_url,
                    resolved_settings.qdrant_collection,
                    resolved_settings.gemini_embedding_dimensions,
                    api_key=resolved_settings.qdrant_api_key.get_secret_value() if resolved_settings.qdrant_api_key else None,
                )
                await qdrant.ensure_collection()
                retriever = QdrantRetriever(qdrant, gemini)
                backend = BackendApiClient(resolved_settings.backend_api_base_url)
                application.state.chat_service = CustomerChatService(retriever, backend, gemini)
            yield
        finally:
            if backend is not None:
                await backend.close()
            if gemini is not None:
                await gemini.close()
            if qdrant is not None:
                await qdrant.close()

    application = FastAPI(title="Web Hotel MIS Customer Agent", version="0.2.0", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.agent_cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @application.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "hotel-mis-agent", "provider": resolved_settings.ai_provider}

    @application.post("/agent-api/chat", response_model=ChatResponse)
    async def chat(
        payload: ChatRequest,
        request: Request,
        authorization: str | None = Header(default=None),
    ) -> ChatResponse:
        service: CustomerChatService = request.app.state.chat_service
        history = [(turn.role, turn.content) for turn in payload.history]
        return await service.answer(
            payload.message,
            access_token=_bearer_token(authorization),
            history=history,
        )

    @application.post("/agent-api/chat/stream")
    async def chat_stream(
        payload: ChatRequest,
        request: Request,
        authorization: str | None = Header(default=None),
    ) -> StreamingResponse:
        service: CustomerChatService = request.app.state.chat_service
        history = [(turn.role, turn.content) for turn in payload.history]
        async def events():
            async for event in service.stream_answer(
                payload.message,
                access_token=_bearer_token(authorization),
                history=history,
            ):
                yield f"event: {event['event']}\ndata: {json.dumps(event['data'], ensure_ascii=False)}\n\n"

        return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-store"})

    return application


app = create_app()
