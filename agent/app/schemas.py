from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8_000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4_000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)


class CitationDto(BaseModel):
    source: str
    title: str
    start_line: int
    end_line: int


class ChatResponse(BaseModel):
    answer: str
    mode: Literal["rag", "live_data", "clarification", "refusal"]
    citations: list[CitationDto] = Field(default_factory=list)
