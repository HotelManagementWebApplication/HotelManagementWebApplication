"""Structural, deterministic chunking for the customer policy corpus."""

from __future__ import annotations

from dataclasses import dataclass, field
from hashlib import sha256
from pathlib import Path
import re
from typing import Iterable, Sequence


_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
_BULLET = re.compile(r"^\s*(?:[-+*]|\d+[.)])\s+")
_TABLE_ROW = re.compile(r"^\s*\|.*\|\s*$")
_TOKEN = re.compile(r"\w+|[^\w\s]", re.UNICODE)
_SENTENCE_END = re.compile(r"(?<=[.!?。！？])(?:\s+|$)")

DEFAULT_TARGET_TOKENS = 360
DEFAULT_MAX_TOKENS = 450


def _token_count(text: str) -> int:
    return len(_TOKEN.findall(text))


def _stable_digest(*parts: object) -> str:
    canonical = "\x1f".join(str(part) for part in parts)
    return sha256(canonical.encode("utf-8")).hexdigest()


@dataclass(frozen=True, slots=True)
class MarkdownChunk:
    """A citable policy passage and its stable indexing metadata."""

    source: str
    heading_path: tuple[str, ...]
    content: str
    start_line: int
    end_line: int
    block_type: str = "paragraph"
    id: str = ""
    content_hash: str = ""
    token_count: int = 0
    citation_data: tuple[tuple[str, str], ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        clean_content = self.content.strip()
        if not clean_content:
            raise ValueError("chunk content must not be empty")
        object.__setattr__(self, "content", clean_content)
        if not self.id:
            object.__setattr__(
                self,
                "id",
                _stable_digest(self.source, " > ".join(self.heading_path), self.block_type, clean_content[:120])[:32],
            )
        if not self.content_hash:
            object.__setattr__(self, "content_hash", sha256(clean_content.encode("utf-8")).hexdigest())
        if not self.token_count:
            object.__setattr__(self, "token_count", _token_count(clean_content))
        if not self.citation_data:
            object.__setattr__(
                self,
                "citation_data",
                (("source", self.source), ("heading", self.title), ("lines", f"{self.start_line}-{self.end_line}")),
            )

    @property
    def text(self) -> str:
        return self.content

    @property
    def title(self) -> str:
        return " > ".join(self.heading_path) if self.heading_path else self.source

    @property
    def citation(self) -> str:
        return f"{self.source}:{self.start_line}-{self.end_line} ({self.title})"

    def to_payload(self) -> dict[str, object]:
        return {
            "chunk_id": self.id,
            "source": self.source,
            "heading_path": list(self.heading_path),
            "content": self.content,
            "block_type": self.block_type,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "content_hash": self.content_hash,
            "token_count": self.token_count,
            "citation": self.citation,
            "citation_data": dict(self.citation_data),
        }

    @classmethod
    def from_payload(cls, payload: dict[str, object]) -> "MarkdownChunk":
        heading_path = payload.get("heading_path", [])
        if not isinstance(heading_path, list) or not all(isinstance(item, str) for item in heading_path):
            raise ValueError("Qdrant chunk heading_path is invalid")
        required = ("source", "content", "block_type", "chunk_id", "content_hash")
        if any(not isinstance(payload.get(key), str) for key in required):
            raise ValueError("Qdrant chunk metadata is incomplete")
        start_line = payload.get("start_line")
        end_line = payload.get("end_line")
        token_count = payload.get("token_count")
        if not all(isinstance(value, int) for value in (start_line, end_line, token_count)):
            raise ValueError("Qdrant chunk line metadata is invalid")
        chunk = cls(
            source=payload["source"],
            heading_path=tuple(heading_path),
            content=payload["content"],
            start_line=start_line,
            end_line=end_line,
            block_type=payload["block_type"],
            id=payload["chunk_id"],
            content_hash=payload["content_hash"],
            token_count=token_count,
        )
        if chunk.content_hash != sha256(chunk.content.encode("utf-8")).hexdigest() or chunk.token_count != _token_count(chunk.content):
            raise ValueError("Qdrant chunk content metadata does not match content")
        return chunk


@dataclass(frozen=True, slots=True)
class _Block:
    heading_path: tuple[str, ...]
    lines: tuple[str, ...]
    start_line: int
    end_line: int
    block_type: str
    key: str

    @property
    def content(self) -> str:
        return "\n".join(line.rstrip() for line in self.lines).strip()

    @property
    def token_count(self) -> int:
        return _token_count(self.content)


def _is_table(lines: Sequence[str]) -> bool:
    return len(lines) >= 2 and all(_TABLE_ROW.match(line) for line in lines)


def _block_type(lines: Sequence[str], heading_path: tuple[str, ...]) -> str:
    if _is_table(lines):
        return "table"
    if lines and _BULLET.match(lines[0]):
        return "bullet"
    if heading_path and heading_path[-1].endswith("?"):
        return "faq"
    return "paragraph"


def _blocks(markdown: str, line_numbers: list[int] | None = None) -> Iterable[_Block]:
    lines = markdown.splitlines()
    if line_numbers is not None and len(line_numbers) != len(lines):
        raise ValueError("line_numbers must match the number of Markdown lines")

    headings: dict[int, str] = {}
    occurrences: dict[tuple[tuple[str, ...], str, str], int] = {}
    current: list[str] = []
    current_numbers: list[int] = []
    current_type: str | None = None

    def stable_block_key(path: tuple[str, ...], block_type: str, anchor: str) -> str:
        identity = (path, block_type, anchor)
        occurrence = occurrences.get(identity, 0)
        occurrences[identity] = occurrence + 1
        return _stable_digest(path, block_type, anchor, occurrence)

    def flush() -> _Block | None:
        nonlocal current, current_numbers, current_type
        if not current:
            return None
        path = tuple(headings[level] for level in sorted(headings))
        content = "\n".join(line.rstrip() for line in current).strip()
        block = (
            _Block(
                path,
                tuple(current),
                current_numbers[0],
                current_numbers[-1],
                _block_type(current, path) if current_type != "faq" else "faq",
                stable_block_key(path, "faq" if current_type == "faq" else _block_type(current, path), content[:120]),
            )
            if content
            else None
        )
        current = []
        current_numbers = []
        current_type = None
        return block

    def emit() -> Iterable[_Block]:
        block = flush()
        if block:
            yield block

    index = 0
    while index < len(lines):
        line = lines[index]
        number = line_numbers[index] if line_numbers is not None else index + 1
        heading = _HEADING.match(line)
        if heading:
            yield from emit()
            level = len(heading.group(1))
            for existing_level in [value for value in headings if value >= level]:
                del headings[existing_level]
            headings[level] = heading.group(2).strip()
            if headings[level].endswith("?"):
                current = [headings[level]]
                current_numbers = [number]
                current_type = "faq"
            index += 1
            continue
        if not line.strip():
            if current_type == "faq":
                index += 1
                continue
            yield from emit()
            index += 1
            continue

        if current_type == "faq":
            current.append(line)
            current_numbers.append(number)
            index += 1
            continue

        if _TABLE_ROW.match(line) and index + 1 < len(lines) and _TABLE_ROW.match(lines[index + 1]):
            yield from emit()
            table_lines: list[str] = []
            table_numbers: list[int] = []
            while index < len(lines) and _TABLE_ROW.match(lines[index]):
                table_lines.append(lines[index])
                table_numbers.append(line_numbers[index] if line_numbers is not None else index + 1)
                index += 1
            path = tuple(headings[level] for level in sorted(headings))
            yield _Block(path, tuple(table_lines), table_numbers[0], table_numbers[-1], "table", stable_block_key(path, "table", table_lines[0]))
            continue

        if _BULLET.match(line):
            yield from emit()
            bullet_lines = [line]
            bullet_numbers = [number]
            index += 1
            while index < len(lines):
                continuation = lines[index]
                if not continuation.strip() or _HEADING.match(continuation) or _BULLET.match(continuation):
                    break
                bullet_lines.append(continuation)
                bullet_numbers.append(line_numbers[index] if line_numbers is not None else index + 1)
                index += 1
            path = tuple(headings[level] for level in sorted(headings))
            yield _Block(path, tuple(bullet_lines), bullet_numbers[0], bullet_numbers[-1], "bullet", stable_block_key(path, "bullet", bullet_lines[0].strip()))
            continue

        if current_type is None:
            current_type = "paragraph"
        current.append(line)
        current_numbers.append(number)
        index += 1

    yield from emit()


def _sentence_blocks(block: _Block, max_tokens: int) -> list[_Block]:
    if block.block_type != "paragraph" or block.token_count <= max_tokens:
        return [block]
    text = block.content
    pieces: list[str] = []
    start = 0
    for match in re.finditer(r"(?<=[.!?。！？])(?:\s+|$)", text):
        pieces.append(text[start : match.end()].strip())
        start = match.end()
    if start < len(text):
        pieces.append(text[start:].strip())
    if len(pieces) <= 1:
        return [block]
    result: list[_Block] = []
    for piece in pieces:
        lines = tuple(piece.splitlines())
        result.append(_Block(block.heading_path, lines, block.start_line, block.end_line, block.block_type, _stable_digest(block.key, piece[:120])))
    return result


def _table_groups(block: _Block, max_tokens: int) -> list[_Block]:
    lines = list(block.lines)
    if block.block_type != "table" or len(lines) <= 2 or _token_count(block.content) <= max_tokens:
        return [block]
    header = lines[:2]
    rows = lines[2:]
    groups: list[_Block] = []
    current = header.copy()
    current_numbers = [block.start_line, min(block.start_line + 1, block.end_line)]
    group_index = 0
    for row_index, row in enumerate(rows, start=2):
        proposed = current + [row]
        if len(current) > 2 and _token_count("\n".join(proposed)) > max_tokens:
            groups.append(_Block(block.heading_path, tuple(current), current_numbers[0], current_numbers[-1], "table", _stable_digest(block.key, group_index, current[2])))
            group_index += 1
            current = header.copy()
            current_numbers = [block.start_line, min(block.start_line + 1, block.end_line)]
        current.append(row)
        current_numbers.append(block.start_line + row_index)
    if len(current) > 2:
        groups.append(_Block(block.heading_path, tuple(current), current_numbers[0], current_numbers[-1], "table", _stable_digest(block.key, group_index, current[2])))
    return groups or [block]


def _split_blocks(blocks: Iterable[_Block], max_tokens: int) -> Iterable[_Block]:
    for block in blocks:
        for sentence_block in _sentence_blocks(block, max_tokens):
            yield from _table_groups(sentence_block, max_tokens)


def parse_markdown(
    markdown: str,
    *,
    source: str,
    target_tokens: int = DEFAULT_TARGET_TOKENS,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    max_chars: int | None = None,
    line_numbers: list[int] | None = None,
) -> list[MarkdownChunk]:
    """Parse policy structures and pack adjacent blocks into target-sized chunks."""

    if target_tokens <= 0 or max_tokens <= 0 or target_tokens > max_tokens:
        raise ValueError("target_tokens and max_tokens must be positive with target_tokens <= max_tokens")
    if max_chars is not None and max_chars <= 0:
        raise ValueError("max_chars must be positive")

    chunks: list[MarkdownChunk] = []
    current: list[_Block] = []

    def flush() -> None:
        nonlocal current
        if not current:
            return
        content = "\n\n".join(block.content for block in current)
        path = current[0].heading_path
        block_types = {block.block_type for block in current}
        block_type = next(iter(block_types)) if len(block_types) == 1 else "mixed"
        stable_key = "|".join(block.key for block in current)
        chunks.append(
            MarkdownChunk(
                source=source,
                heading_path=path,
                content=content,
                start_line=current[0].start_line,
                end_line=current[-1].end_line,
                block_type=block_type,
                id=_stable_digest(source, path, stable_key)[:32],
            )
        )
        current = []

    for block in _split_blocks(_blocks(markdown, line_numbers), max_tokens):
        if current and current[0].heading_path != block.heading_path:
            flush()
        combined = "\n\n".join(item.content for item in [*current, block])
        if current and (_token_count(combined) > target_tokens or (max_chars is not None and len(combined) > max_chars)):
            flush()
        current.append(block)
    flush()
    return chunks


def load_markdown_chunks(
    path: Path,
    *,
    target_tokens: int = DEFAULT_TARGET_TOKENS,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    max_chars: int | None = None,
) -> list[MarkdownChunk]:
    markdown = path.read_text(encoding="utf-8")
    return parse_markdown(
        markdown,
        source=path.name,
        target_tokens=target_tokens,
        max_tokens=max_tokens,
        max_chars=max_chars,
    )
