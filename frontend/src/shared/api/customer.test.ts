import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "./client";
import { customerApi } from "./customer";

afterEach(() => vi.restoreAllMocks());

describe("customer ownership contract", () => {
  it("posts the exact registration and booking payload, including idempotency key", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue({ id: 42 });
    const body = { rental_type: "PACKAGE" as const, rooms: [{ room_id: "R201", expected_check_in: "2031-01-10T14:00:00", expected_check_out: "2031-01-11T12:00:00" }], idempotency_key: "booking-1" };
    await customerApi.register({ phone: "0900000201", password: "customer-password", full_name: "Online Guest", identity_number: "ID0900000201" });
    await customerApi.createReservation(body);
    expect(request).toHaveBeenNthCalledWith(1, "/api/auth/customers/register", { method: "POST", body: { phone: "0900000201", password: "customer-password", full_name: "Online Guest", identity_number: "ID0900000201" } });
    expect(request).toHaveBeenNthCalledWith(2, "/api/customer/reservations", { method: "POST", body, idempotencyKey: "booking-1" });
  });

  it("keeps list/detail/payment calls under the authenticated customer namespace", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue([]);
    await customerApi.me();
    await customerApi.reservations();
    await customerApi.reservation(42);
    await customerApi.depositPayment(42);
    expect(request).toHaveBeenNthCalledWith(1, "/api/auth/customers/me");
    expect(request).toHaveBeenNthCalledWith(2, "/api/customer/reservations");
    expect(request).toHaveBeenNthCalledWith(3, "/api/customer/reservations/42");
    expect(request).toHaveBeenNthCalledWith(4, "/api/customer/reservations/42/deposit-payment");
  });

  it("surfaces ownership errors from the backend instead of manufacturing a result", async () => {
    vi.spyOn(apiClient, "request").mockRejectedValue(new ApiError(403, { code: "FORBIDDEN" }));
    await expect(customerApi.reservation(999)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("rejects invalid reservation IDs before making a request", async () => {
    const request = vi.spyOn(apiClient, "request");
    await expect(customerApi.reservation(0)).rejects.toThrow("reservation ID must be a positive integer");
    await expect(customerApi.depositPayment(Number.NaN)).rejects.toThrow("reservation ID must be a positive integer");
    expect(request).not.toHaveBeenCalled();
  });
});
