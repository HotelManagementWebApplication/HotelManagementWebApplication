"""Natural-language routing for grounded customer assistance."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time
import json
import re
from typing import Any, AsyncIterator, Mapping, Sequence

from agent.generation import ABSTAIN_TOKEN, AnswerGenerator, GenerationError
from app.schemas import ChatResponse, CitationDto
from policies.safety import check_customer_message
from rag.qdrant import QdrantError
from rag.retrieval import Retriever, SearchResult, has_grounding_overlap
from tools.backend import BackendApiClient, BackendApiError


_DATE_TIME = re.compile(
    r"(?<!\d)(?:(?P<iso_date>20\d{2}-\d{2}-\d{2})(?:[T ](?P<iso_time>\d{1,2}:\d{2}(?::\d{2})?))?"
    r"|(?P<local_date>\d{1,2}/\d{1,2}/20\d{2})(?:[T ](?P<local_time>\d{1,2}:\d{2}(?::\d{2})?))?)(?!\d)"
)
_RESERVATION_ID = re.compile(r"(?:booking|reservation|đặt\s*phòng|mã)\s*#?\s*(\d+)", re.IGNORECASE)
_UNKNOWN = "Mình chưa tìm thấy thông tin này trong quy định đã được khách sạn phê duyệt. Bạn vui lòng liên hệ lễ tân để được xác nhận."
_CITATION_IN_ANSWER = re.compile(r"customer-policy\.md:\d+(?:-\d+)?", re.IGNORECASE)
_MONEY_IN_ANSWER = re.compile(r"\b\d[\d. ]*\s*(?:vnd|vnđ|đ)\b", re.IGNORECASE)
_STREAM_BOUNDARY = re.compile(r".*?(?:[.!?](?=\s|$)|\n+)", re.DOTALL)

_AVAILABILITY_TERMS = ("phòng trống", "còn phòng", "phòng còn", "khả dụng", "đặt được", "available", "availability")
_ROOM_TERMS = ("phòng", "hạng phòng", "loại phòng", "room")
_ROOM_LIVE_TERMS = (
    "giá", "danh sách", "loại", "hạng", "diện tích", "giường", "view", "tiện nghi", "đang có", "hiện tại", "phòng nào",
    "bao nhiêu phòng", "mấy phòng", "tổng số phòng", "tổng cộng bao nhiêu phòng",
)
_SERVICE_TERMS = ("dịch vụ", "spa", "nhà hàng", "gym", "limousine", "đưa đón", "giặt ủi", "tiện ích")
_SERVICE_LIVE_TERMS = ("giá", "danh sách", "đang có", "hiện có", "hoạt động", "còn nhận", "đơn giá", "đặt", "những", "nào", "liệt kê", "danh mục")
_PRIVATE_TERMS = ("của tôi", "của mình", "booking #", "reservation #", "mã booking", "đơn đặt của", "booking tôi", "reservation tôi", "đơn đặt")
_MUTATION_TERMS = ("hủy booking", "hủy đặt phòng", "đổi ngày booking", "thêm ngày booking", "hủy giúp", "hủy hộ", "đổi ngày giúp", "thêm ngày giúp", "thanh toán giúp", "pay for me", "cancel for me")
_POLICY_TERMS = (
    "chính sách", "quy định", "điều kiện", "hủy", "hoàn", "cọc", "nhận phòng", "trả phòng", "check-in", "check in",
    "check-out", "check out", "trẻ", "vip", "hút thuốc", "thú cưng", "wifi", "bãi xe", "đỗ xe", "giờ yên tĩnh",
    "nhà hàng", "bữa sáng", "hồ bơi", "phòng họp", "hóa đơn", "hành lý", "xe lăn", "sân bay", "đồ thất lạc",
)

# The public controller forwards ``type`` to RoomRepository.search, whose
# contract compares it with RoomType.id. These are the current public catalog
# IDs for the named room groups; the user-facing names/codes are not accepted
# by that endpoint.
_ROOM_TYPE_FILTERS = (
    (("standard", "std"), "Standard", "RT001"),
    (("superior", "sup"), "Superior", "RT003"),
    (("deluxe", "dlx"), "Deluxe", "RT005"),
    (("suite", "sut"), "Suite", "RT007"),
    (("vip", "biệt thự", "biet thu"), "VIP", "RT009"),
)


def _money(value: Any) -> str:
    try:
        return f"{float(value):,.0f} VND".replace(",", ".")
    except (TypeError, ValueError):
        return "chưa công bố"


def _parse_datetime_values(message: str) -> list[datetime]:
    values: list[datetime] = []
    for index, match in enumerate(_DATE_TIME.finditer(message)):
        iso_date = match.group("iso_date")
        local_date = match.group("local_date")
        date_value = iso_date or local_date
        time_value = match.group("iso_time") or match.group("local_time")
        try:
            parsed_date = (
                datetime.strptime(date_value, "%Y-%m-%d").date()
                if iso_date
                else datetime.strptime(date_value, "%d/%m/%Y").date()
            )
            parsed_time = time.fromisoformat(time_value) if time_value else time(14, 0) if index == 0 else time(12, 0)
        except (TypeError, ValueError) as error:
            raise ValueError("Ngày giờ không hợp lệ; vui lòng dùng DD/MM/YYYY hoặc YYYY-MM-DDTHH:MM.") from error
        values.append(datetime.combine(parsed_date, parsed_time))
    return values


def _requested_room_type(message: str) -> tuple[str | None, str | None]:
    normalized = message.casefold()
    for aliases, display_name, backend_id in _ROOM_TYPE_FILTERS:
        if any(re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", normalized) for alias in aliases):
            return display_name, backend_id
    return None, None


def _citation(results: Sequence[SearchResult]) -> list[CitationDto]:
    return [
        CitationDto(
            source=result.chunk.source,
            title=result.chunk.title,
            start_line=result.chunk.start_line,
            end_line=result.chunk.end_line,
        )
        for result in results[:5]
    ]


def _live_data(items: Sequence[Mapping[str, object]]) -> list[dict[str, object]]:
    return [dict(item) for item in items]


@dataclass(frozen=True, slots=True)
class _Plan:
    response: ChatResponse
    chunks: tuple[Any, ...] = ()
    live_data: tuple[Mapping[str, object], ...] = ()
    should_generate: bool = False


class CustomerChatService:
    def __init__(
        self,
        retriever: Retriever,
        backend: BackendApiClient,
        generator: AnswerGenerator | None = None,
    ) -> None:
        self._retriever = retriever
        self._backend = backend
        self._generator = generator

    async def answer(
        self,
        message: str,
        *,
        access_token: str | None = None,
        history: list[tuple[str, str]] | None = None,
    ) -> ChatResponse:
        safe_history = self._bounded_history(history)
        plan = await self._plan(message, access_token=access_token)
        if not plan.should_generate or self._generator is None:
            return plan.response
        try:
            answer = await self._generator.generate(
                message,
                plan.chunks,
                live_data=plan.live_data,
                history=safe_history,
            )
        except GenerationError as error:
            return ChatResponse(answer=str(error), mode="clarification")
        if answer.strip() == ABSTAIN_TOKEN:
            return ChatResponse(answer=_UNKNOWN, mode=plan.response.mode)
        if not self._answer_is_grounded(answer, plan):
            return ChatResponse(answer=_UNKNOWN, mode=plan.response.mode)
        return plan.response.model_copy(update={"answer": answer.strip()})

    async def stream_answer(
        self,
        message: str,
        *,
        access_token: str | None = None,
        history: list[tuple[str, str]] | None = None,
    ) -> AsyncIterator[dict[str, object]]:
        """Yield metadata and provider chunks without post-hoc response slicing."""

        safe_history = self._bounded_history(history)
        plan = await self._plan(message, access_token=access_token)
        metadata = plan.response.model_dump(exclude={"answer"})
        yield {"event": "metadata", "data": metadata}
        if not plan.should_generate or self._generator is None:
            if plan.response.answer:
                yield {"event": "token", "data": {"text": plan.response.answer}}
            yield {"event": "done", "data": {}}
            return
        stream_method = getattr(self._generator, "stream_generate", None)
        if stream_method is None:
            try:
                answer = await self._generator.generate(
                    message,
                    plan.chunks,
                    live_data=plan.live_data,
                    history=safe_history,
                )
            except GenerationError as error:
                yield {"event": "error", "data": {"message": str(error)}}
                return
            if answer.strip() != ABSTAIN_TOKEN:
                yield {"event": "token", "data": {"text": answer.strip()}}
            yield {"event": "done", "data": {}}
            return

        emitted = False
        candidate = ""
        pending = ""
        validated = ""
        try:
            async for token in stream_method(
                message,
                plan.chunks,
                live_data=plan.live_data,
                history=safe_history,
            ):
                candidate += token
                if ABSTAIN_TOKEN.startswith(candidate.strip()) and len(candidate.strip()) <= len(ABSTAIN_TOKEN):
                    continue
                pending += token
                complete = _STREAM_BOUNDARY.findall(pending)
                if complete:
                    ready = "".join(complete)
                    pending = pending[len(ready):]
                    if not self._answer_is_grounded(validated + ready, plan):
                        yield {"event": "error", "data": {"message": _UNKNOWN}}
                        return
                    validated += ready
                    emitted = True
                    yield {"event": "token", "data": {"text": ready}}
        except GenerationError as error:
            yield {"event": "error", "data": {"message": str(error)}}
            return
        if candidate.strip() == ABSTAIN_TOKEN:
            yield {"event": "token", "data": {"text": _UNKNOWN}}
        elif pending:
            if not self._answer_is_grounded(validated + pending, plan):
                yield {"event": "error", "data": {"message": _UNKNOWN}}
                return
            emitted = True
            yield {"event": "token", "data": {"text": pending}}
        elif not emitted:
            yield {"event": "error", "data": {"message": "Gemini không tạo được câu trả lời an toàn."}}
            return
        yield {"event": "done", "data": {}}

    @staticmethod
    def _bounded_history(history: list[tuple[str, str]] | None) -> tuple[tuple[str, str], ...]:
        if not history:
            return ()
        return tuple(
            (role, content.strip()[:2_000])
            for role, content in history[-10:]
            if role in {"user", "assistant"} and content.strip()
        )

    async def _plan(self, message: str, *, access_token: str | None) -> _Plan:
        safety = check_customer_message(message)
        if not safety.allowed:
            return _Plan(ChatResponse(answer=safety.reason or "Yêu cầu không được phép.", mode="refusal"))

        normalized = message.casefold()
        wants_availability = self._asks_availability(normalized)
        wants_rooms = self._asks_live_rooms(normalized) and not wants_availability
        wants_room_types = wants_rooms and self._asks_room_types(normalized)
        wants_room_count = wants_rooms and not wants_room_types and self._asks_room_count(normalized)
        wants_services = self._asks_live_services(normalized)
        wants_private = self._asks_private_reservation(normalized)
        requested_room_type, room_type_filter = _requested_room_type(message)
        wants_policy = (
            (self._asks_policy(normalized) and not wants_private)
            or "chính sách" in normalized
            or "quy định" in normalized
            or not any((wants_availability, wants_rooms, wants_services, wants_private))
        )

        if wants_private and not access_token:
            if self._asks_mutation(normalized):
                return _Plan(ChatResponse(answer="Bạn hãy dùng chức năng tương ứng trên website để hủy, đổi ngày, thêm ngày hoặc thanh toán; chatbot chỉ hướng dẫn và không thực hiện thao tác thay bạn.", mode="clarification"))
            return _Plan(
                ChatResponse(
                    answer="Bạn cần đăng nhập tài khoản khách hàng để mình xem booking hoặc thanh toán của chính bạn.",
                    mode="clarification",
                )
            )
        if wants_private and self._asks_mutation(normalized):
            return _Plan(ChatResponse(answer="Bạn hãy dùng chức năng tương ứng trên website để hủy, đổi ngày, thêm ngày hoặc thanh toán; chatbot chỉ hướng dẫn và không thực hiện thao tác thay bạn.", mode="clarification"))
        if wants_private and any(term in normalized for term in ("cọc", "tiền đặt", "thanh toán")) and not _RESERVATION_ID.search(message):
            return _Plan(ChatResponse(answer="Bạn hãy cung cấp mã booking để mình tra trạng thái hoặc hướng dẫn tiền cọc của đúng đơn thuộc tài khoản bạn.", mode="clarification"))

        live_answers: list[str] = []
        live_records: list[Mapping[str, object]] = []
        try:
            if wants_availability:
                values = _parse_datetime_values(message)
                if len(values) < 2:
                    return _Plan(ChatResponse(answer="Bạn hãy cho mình đủ ngày giờ nhận và trả theo dạng DD/MM/YYYY hoặc YYYY-MM-DDTHH:MM để kiểm tra phòng trống.", mode="clarification"))
                start, end = values[:2]
                rooms = await self._backend.room_availability(start, end, room_type=room_type_filter)
                available = [room for room in rooms if room.get("available", True)]
                live_records.extend(_live_data(available))
                live_answers.append(self._format_availability(available, start, end, requested_room_type))
            if wants_rooms:
                rooms = await self._backend.public_rooms(
                    room_type=room_type_filter,
                    size=100 if wants_room_types or wants_room_count else 10,
                )
                live_records.extend(_live_data(rooms))
                if wants_room_types:
                    live_answers.append(self._format_room_types(rooms))
                elif wants_room_count:
                    live_answers.append(self._format_room_count(rooms))
                else:
                    live_answers.append(self._format_rooms(rooms))
            if wants_services:
                services = await self._backend.public_services()
                live_records.extend(_live_data(services))
                live_answers.append(self._format_services(services))
            if wants_private:
                private_answer, private_records = await self._private_data(message, access_token)
                if private_answer is not None:
                    live_answers.append(private_answer)
                live_records.extend(private_records)
        except (BackendApiError, ValueError) as error:
            return _Plan(ChatResponse(answer=str(error), mode="clarification"))

        results: list[SearchResult] = []
        if wants_policy:
            try:
                results = await self._retriever.search(message, limit=4)
            except (GenerationError, QdrantError) as error:
                return _Plan(ChatResponse(answer=str(error), mode="clarification"))
        sufficient = self._evidence_sufficient(message, results)
        if wants_policy and not sufficient:
            if live_answers:
                return _Plan(ChatResponse(answer="\n\n".join(live_answers) + "\n\n" + _UNKNOWN, mode="live_data"))
            return _Plan(ChatResponse(answer=_UNKNOWN, mode="rag"))

        if not live_answers and not wants_policy:
            return _Plan(ChatResponse(answer="Mình chưa nhận diện được thông tin cần tra cứu. Bạn hãy nói rõ phòng, dịch vụ, ngày lưu trú hoặc booking.", mode="clarification"))
        if not wants_policy:
            return _Plan(ChatResponse(answer="\n\n".join(live_answers), mode="live_data"))

        citations = _citation(results)
        deterministic = "\n\n".join(live_answers + [f"Theo quy định của khách sạn:\n\n{results[0].chunk.content}"])
        return _Plan(
            ChatResponse(answer=deterministic, mode="rag", citations=citations),
            chunks=tuple(result.chunk for result in results),
            live_data=tuple(live_records),
            should_generate=self._generator is not None,
        )

    @staticmethod
    def _asks_policy(message: str) -> bool:
        return any(term in message for term in _POLICY_TERMS)

    @staticmethod
    def _asks_private_reservation(message: str) -> bool:
        if any(term in message for term in _PRIVATE_TERMS):
            return True
        return bool(_RESERVATION_ID.search(message)) and any(term in message for term in ("booking", "đặt phòng", "cọc", "thanh toán"))

    @staticmethod
    def _asks_mutation(message: str) -> bool:
        return any(term in message for term in _MUTATION_TERMS)

    @staticmethod
    def _asks_availability(message: str) -> bool:
        return (
            any(term in message for term in _AVAILABILITY_TERMS)
            or ("phòng" in message and any(term in message for term in ("còn", "trống", "khả dụng", "đặt được")))
            or len(list(_DATE_TIME.finditer(message))) >= 2
            or (bool(_DATE_TIME.search(message)) and "phòng" in message and any(term in message for term in _ROOM_LIVE_TERMS))
        )

    @staticmethod
    def _asks_live_services(message: str) -> bool:
        if not any(term in message for term in _SERVICE_TERMS):
            return False
        explicit_live = ("giá", "danh sách", "hiện có", "đơn giá", "còn nhận", "đang hoạt động", "đặt dịch vụ", "danh mục", "liệt kê")
        return any(term in message for term in explicit_live) or ("có" in message and any(term in message for term in ("những", "nào", "gì")))

    @staticmethod
    def _asks_live_rooms(message: str) -> bool:
        return any(term in message for term in _ROOM_TERMS) and any(term in message for term in _ROOM_LIVE_TERMS) and not any(term in message for term in _AVAILABILITY_TERMS)

    @staticmethod
    def _asks_room_types(message: str) -> bool:
        has_room_term = any(term in message for term in _ROOM_TERMS)
        asks_type = any(term in message for term in ("loại phòng", "hạng phòng", "room type"))
        asks_type_indirectly = has_room_term and any(
            term in message for term in ("loại nào", "mấy loại", "những loại", "các loại", "mấy hạng", "những hạng", "các hạng")
        )
        return asks_type or asks_type_indirectly

    @staticmethod
    def _asks_room_count(message: str) -> bool:
        return any(
            term in message
            for term in ("bao nhiêu phòng", "mấy phòng", "tổng số phòng", "tổng cộng bao nhiêu phòng")
        )

    @staticmethod
    def _evidence_sufficient(message: str, results: Sequence[SearchResult]) -> bool:
        if not results:
            return False
        best = results[0]
        return best.score >= 0.12 and has_grounding_overlap(message, best.chunk)

    @staticmethod
    def _answer_is_grounded(answer: str, plan: _Plan) -> bool:
        if any(term in answer.casefold() for term in ("rule.md", "spring.mail", "api key", "system prompt", "mật khẩu smtp")):
            return False
        approved_citations = {f"{chunk.source}:{chunk.start_line}-{chunk.end_line}" for chunk in plan.chunks}
        for citation in _CITATION_IN_ANSWER.findall(answer):
            if not any(citation.casefold() == item.casefold() or citation.casefold().startswith(item.casefold().split("-")[0]) for item in approved_citations):
                return False
        approved_text = " ".join(chunk.content for chunk in plan.chunks) + " " + json.dumps(list(plan.live_data), ensure_ascii=False)
        approved_numbers = {
            re.sub(r"\D", "", item)
            for item in re.findall(r"\d[\d.]*", approved_text)
            if len(re.sub(r"\D", "", item)) >= 3
        }
        for money in _MONEY_IN_ANSWER.findall(answer):
            if re.sub(r"\D", "", money) not in approved_numbers:
                return False
        return True

    @staticmethod
    def _format_availability(
        rooms: Sequence[Mapping[str, object]],
        start: datetime,
        end: datetime,
        requested_room_type: str | None = None,
    ) -> str:
        room_label = requested_room_type or next(
            (str(room.get("room_type_name")) for room in rooms if room.get("room_type_name")),
            "phòng",
        )
        date_range = f"{start:%d/%m/%Y %H:%M} đến {end:%d/%m/%Y %H:%M}"
        if not rooms:
            return f"Không tìm thấy phòng {room_label} còn trống từ {date_range}."

        def prices(field: str) -> str:
            values = []
            for room in rooms:
                formatted = _money(room.get(field))
                if formatted != "chưa công bố" and formatted not in values:
                    values.append(formatted)
            return ", ".join(values) if values else "chưa công bố"

        answer = (
            f"{room_label}: {len(rooms)} phòng còn trống từ {date_range}. "
            f"Giá theo ngày: {prices('daily_price')}/ngày; "
            f"giá theo giờ: {prices('hourly_price')}/giờ."
        )
        names = []
        for room in rooms[:5]:
            name = room.get("room_name") or room.get("room_id")
            if isinstance(name, str) and name and name not in names:
                names.append(name)
        return f"{answer} Một số phòng: {', '.join(names)}." if names else answer

    @staticmethod
    def _format_rooms(rooms: Sequence[Mapping[str, object]]) -> str:
        if not rooms:
            return "Hiện chưa có phòng nào được công bố."
        lines = ["Các phòng đang được công bố:"]
        for room in rooms[:8]:
            name = room.get("room_name") or room.get("room_id") or "Phòng"
            room_type = room.get("room_type_name") or ""
            lines.append(f"- {name} {f'({room_type})' if room_type else ''}: {_money(room.get('daily_price'))}/đêm")
        return "\n".join(lines)

    @staticmethod
    def _format_room_types(rooms: Sequence[Mapping[str, object]]) -> str:
        room_groups: dict[str, list[Mapping[str, object]]] = {}
        for room in rooms:
            room_type_id = room.get("room_type_id")
            room_type_name = room.get("room_type_name")
            room_type_code = room.get("room_type_code")
            key = room_type_code or room_type_id or room_type_name
            if key is not None:
                room_groups.setdefault(str(key), []).append(room)

        if not room_groups:
            return "Hiện chưa có loại phòng nào được công bố."

        lines = [f"Khách sạn hiện công bố {len(room_groups)} hạng phòng chính:"]
        for code_key, group in room_groups.items():
            room = group[0]
            code = room.get("room_type_code") or code_key
            name = str(room.get("marketing_name") or room.get("room_type_name") or "Hạng phòng")
            if "·" in name:
                name = name.split("·", 1)[0].strip()
            if code and str(code).casefold() not in name.casefold():
                name += f" ({code})"
            variants = {
                str(item.get("room_type_id") or item.get("room_type_name"))
                for item in group
                if item.get("room_type_id") or item.get("room_type_name")
            }
            suffix = f" — {len(variants)} cấu hình phòng" if len(variants) > 1 else ""
            lines.append(f"- {name}{suffix}")
        return "\n".join(lines)

    @staticmethod
    def _format_room_count(rooms: Sequence[Mapping[str, object]]) -> str:
        if not rooms:
            return "Hiện chưa có phòng nào được công bố."
        groups = {
            str(room.get("room_type_code") or room.get("room_type_id") or room.get("room_type_name"))
            for room in rooms
            if room.get("room_type_code") or room.get("room_type_id") or room.get("room_type_name")
        }
        group_text = f" thuộc {len(groups)} hạng phòng chính" if groups else ""
        return f"Khách sạn hiện công bố {len(rooms)} phòng vật lý{group_text}."

    @staticmethod
    def _format_services(services: Sequence[Mapping[str, object]]) -> str:
        if not services:
            return "Hiện chưa có dịch vụ nào được công bố."
        lines = ["Các dịch vụ đang hoạt động:"]
        for service in services[:10]:
            name = service.get("name") or service.get("service_name") or "Dịch vụ"
            lines.append(f"- {name}: {_money(service.get('price'))}")
        return "\n".join(lines)

    async def _private_data(self, message: str, access_token: str | None) -> tuple[str | None, list[Mapping[str, object]]]:
        match = _RESERVATION_ID.search(message)
        asks_deposit = any(term in message for term in ("cọc", "tiền đặt", "thanh toán"))
        if asks_deposit and not match:
            return "Bạn hãy cung cấp mã booking để mình tra trạng thái hoặc hướng dẫn tiền cọc của đúng đơn thuộc tài khoản bạn.", []
        if match:
            reservation_id = int(match.group(1))
            reservation = await self._backend.customer_reservation(reservation_id, access_token)
            records: list[Mapping[str, object]] = [reservation]
            code = reservation.get("code") or reservation.get("reservation_code") or reservation_id
            status = reservation.get("status") or "chưa xác định"
            answer = f"Booking {code} hiện có trạng thái: {status}."
            if asks_deposit:
                payment = await self._backend.deposit_payment(reservation_id, access_token)
                records.append(payment)
                payment_status = payment.get("status") or "chưa xác định"
                amount = _money(payment.get("amount"))
                answer += f" Tiền cọc: {amount}; trạng thái thanh toán: {payment_status}. Bạn thực hiện thanh toán trên website, mình không thanh toán thay."
            return answer, records
        reservations = await self._backend.customer_reservations(access_token)
        if not reservations:
            return "Tài khoản của bạn hiện chưa có booking.", []
        records = list(reservations)
        lines = ["Các booking thuộc tài khoản của bạn:"]
        for reservation in reservations[:10]:
            code = reservation.get("code") or reservation.get("reservation_code") or reservation.get("id")
            line = f"- {code}: {reservation.get('status', 'chưa xác định')}"
            if asks_deposit:
                line += f"; tiền cọc {_money(reservation.get('deposit_amount'))}"
            lines.append(line)
        return "\n".join(lines), records
