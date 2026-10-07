import asyncio
from datetime import datetime
import unittest

import httpx

from tools.backend import BackendApiClient, BackendApiError


class BackendToolsTest(unittest.TestCase):
    def test_public_room_tool_calls_only_allowlisted_endpoint(self) -> None:
        seen = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen.append(request)
            return httpx.Response(200, json=[{"room_id": "P101", "daily_price": 1_000_000}])

        async def scenario():
            transport = httpx.MockTransport(handler)
            async with httpx.AsyncClient(transport=transport, base_url="http://backend") as client:
                return await BackendApiClient("http://backend", client=client).public_rooms(size=500)

        rooms = asyncio.run(scenario())
        self.assertEqual("P101", rooms[0]["room_id"])
        self.assertEqual("/api/public/rooms", seen[0].url.path)
        self.assertEqual("100", seen[0].url.params["size"])
        self.assertEqual("0", seen[0].url.params["page"])
        self.assertNotIn("authorization", seen[0].headers)

    def test_customer_tool_forwards_bearer_token(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual("Bearer customer-token", request.headers["authorization"])
            return httpx.Response(200, json=[])

        async def scenario():
            transport = httpx.MockTransport(handler)
            async with httpx.AsyncClient(transport=transport, base_url="http://backend") as client:
                return await BackendApiClient("http://backend", client=client).customer_reservations("customer-token")

        self.assertEqual([], asyncio.run(scenario()))

    def test_availability_uses_iso_local_datetime_endpoint_contract(self) -> None:
        seen = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen.append(request)
            return httpx.Response(200, json=[])

        async def scenario():
            transport = httpx.MockTransport(handler)
            async with httpx.AsyncClient(transport=transport, base_url="http://backend") as client:
                return await BackendApiClient("http://backend", client=client).room_availability(
                    datetime(2026, 10, 10, 14), datetime(2026, 10, 12, 12), room_type="RT005"
                )

        self.assertEqual([], asyncio.run(scenario()))
        self.assertEqual("/api/public/rooms/availability", seen[0].url.path)
        self.assertEqual("2026-10-10T14:00:00", seen[0].url.params["from"])
        self.assertEqual("2026-10-12T12:00:00", seen[0].url.params["to"])
        self.assertEqual("RT005", seen[0].url.params["type"])

    def test_customer_detail_and_deposit_use_customer_routes(self) -> None:
        seen = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen.append(request)
            return httpx.Response(200, json={"status": "CONFIRMED"})

        async def scenario():
            transport = httpx.MockTransport(handler)
            async with httpx.AsyncClient(transport=transport, base_url="http://backend") as client:
                api = BackendApiClient("http://backend", client=client)
                await api.customer_reservation(42, "customer-token")
                await api.deposit_payment(42, "customer-token")

        asyncio.run(scenario())
        self.assertEqual(
            [
                "/api/customer/reservations/42",
                "/api/customer/reservations/42/deposit-payment",
            ],
            [request.url.path for request in seen],
        )
        self.assertTrue(all(request.headers["authorization"] == "Bearer customer-token" for request in seen))

    def test_backend_error_does_not_leak_response_body(self) -> None:
        def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(500, json={"message": "SQL password=secret"})

        async def scenario():
            transport = httpx.MockTransport(handler)
            async with httpx.AsyncClient(transport=transport, base_url="http://backend") as client:
                await BackendApiClient("http://backend", client=client).public_services()

        with self.assertRaises(BackendApiError) as caught:
            asyncio.run(scenario())
        self.assertNotIn("secret", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
