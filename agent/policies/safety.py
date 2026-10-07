"""Deterministic first-line controls for the public customer assistant."""

from __future__ import annotations

from dataclasses import dataclass


_SECRET_REQUESTS = (
    "api key",
    "apikey",
    "gemini key",
    "gemini_api_key",
    "mật khẩu smtp",
    "password smtp",
    "spring.mail.password",
    "jwt secret",
    "vnpay_hash_secret",
    "rule.md",
    "customer-policy.md nội bộ",
    "credential",
)
_INSTRUCTION_OVERRIDE = (
    "bỏ qua hướng dẫn",
    "bỏ qua quy định",
    "ignore previous",
    "ignore all previous",
    "system prompt",
    "developer message",
    "developer prompt",
    "reveal your instructions",
    "show me the prompt",
    "in ra hướng dẫn hệ thống",
)
_INTERNAL_DATA = (
    "dữ liệu khách khác",
    "booking của khách khác",
    "thông tin nhân viên",
    "quy trình nội bộ",
    "thông tin bí mật",
)


@dataclass(frozen=True, slots=True)
class SafetyDecision:
    allowed: bool
    reason: str | None = None


def check_customer_message(message: str) -> SafetyDecision:
    normalized = message.casefold()
    if any(value in normalized for value in _SECRET_REQUESTS):
        return SafetyDecision(False, "Mình không thể cung cấp thông tin bí mật hoặc thông tin xác thực.")
    if any(value in normalized for value in _INSTRUCTION_OVERRIDE):
        return SafetyDecision(False, "Mình không thể làm theo yêu cầu thay đổi hoặc bỏ qua quy tắc an toàn.")
    if any(value in normalized for value in _INTERNAL_DATA):
        return SafetyDecision(False, "Mình chỉ có thể hỗ trợ dữ liệu công khai hoặc dữ liệu thuộc tài khoản của bạn.")
    return SafetyDecision(True)
