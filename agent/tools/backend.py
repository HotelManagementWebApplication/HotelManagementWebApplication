"""Read-only backend API tools available to the customer assistant."""

from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx


class BackendApiError(RuntimeError):
    """A safe error raised when the business API cannot satisfy a tool call."""

    def __init__(self, message: str, *, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


class BackendApiClient:
    """Allow-listed HTTP client; it never connects to SQL Server directly."""

    def __init__(self, base_url: str, *, client: httpx.AsyncClient | None = None) -> None:
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=10.0)

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def _get(
        self,
        path: str,
        *,
        params: dict[str, str | int] | None = None,
        access_token: str | None = None,
    ) -> Any:
        headers = {"Authorization": f"Bearer {access_token}"} if access_token else {}
        try:
            response = await self._client.get(path, params=params, headers=headers)
        except (httpx.RequestError, ValueError) as error:
            raise BackendApiError("Không thể kết nối dịch vụ khách sạn.") from error

        if response.status_code == 401:
            raise BackendApiError("Phiên đăng nhập đã hết hạn hoặc không hợp lệ.", status_code=401)
        if response.status_code == 403:
            raise BackendApiError("Bạn không có quyền xem dữ liệu này.", status_code=403)
        if not response.is_success:
            raise BackendApiError("Dịch vụ khách sạn tạm thời không thể xử lý yêu cầu.", status_code=response.status_code)
        try:
            return response.json()
        except ValueError as error:
            raise BackendApiError("Dịch vụ khách sạn trả về dữ liệu không hợp lệ.") from error

    async def public_rooms(self, *, room_type: str | None = None, size: int = 10) -> list[dict[str, Any]]:
        params: dict[str, str | int] = {"page": 0, "size": min(max(size, 1), 100)}
        if room_type:
            params["type"] = room_type
        result = await self._get("/api/public/rooms", params=params)
        return result if isinstance(result, list) else []

    async def room_availability(
        self,
        start: datetime,
        end: datetime,
        *,
        room_type: str | None = None,
        size: int = 10,
    ) -> list[dict[str, Any]]:
        if end <= start:
            raise ValueError("Ngày trả phòng phải sau ngày nhận phòng.")
        params: dict[str, str | int] = {
            "from": start.isoformat(timespec="seconds"),
            "to": end.isoformat(timespec="seconds"),
            "page": 0,
            "size": min(max(size, 1), 100),
        }
        if room_type:
            params["type"] = room_type
        result = await self._get("/api/public/rooms/availability", params=params)
        return result if isinstance(result, list) else []

    async def public_services(self, *, size: int = 20) -> list[dict[str, Any]]:
        result = await self._get("/api/public/services", params={"page": 0, "size": min(max(size, 1), 100)})
        return result if isinstance(result, list) else []

    async def customer_reservations(self, access_token: str) -> list[dict[str, Any]]:
        if not access_token.strip():
            raise ValueError("Phiên khách hàng là bắt buộc.")
        result = await self._get("/api/customer/reservations", access_token=access_token)
        return result if isinstance(result, list) else []

    async def customer_reservation(self, reservation_id: int, access_token: str) -> dict[str, Any]:
        if reservation_id <= 0:
            raise ValueError("Mã đặt phòng phải là số nguyên dương.")
        if not access_token.strip():
            raise ValueError("Phiên khách hàng là bắt buộc.")
        result = await self._get(f"/api/customer/reservations/{reservation_id}", access_token=access_token)
        return result if isinstance(result, dict) else {}

    async def deposit_payment(self, reservation_id: int, access_token: str) -> dict[str, Any]:
        if reservation_id <= 0:
            raise ValueError("Mã đặt phòng phải là số nguyên dương.")
        if not access_token.strip():
            raise ValueError("Phiên khách hàng là bắt buộc.")
        result = await self._get(
            f"/api/customer/reservations/{reservation_id}/deposit-payment",
            access_token=access_token,
        )
        return result if isinstance(result, dict) else {}
