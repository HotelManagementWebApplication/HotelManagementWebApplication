import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "./client";
import { customerApi } from "./customer";

afterEach(() => vi.restoreAllMocks());

describe("customer ownership contract", () => {
  it("posts the exact registration and booking payload, including idempotency key", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue({ id: 42 });
    const body = { rental_type: "PACKAGE" as const, rooms: [{ room_id: "R201", expected_check_in: "2031-01-10T14:00:00", expected_check_out: "2031-01-11T12:00:00" }], idempotency_key: "booking-1", payment_method: "VNPAY" as const };
    await customerApi.register({ phone: "0900000201", password: "customer-password", full_name: "Online Guest", identity_number: "ID0900000201" });
    await customerApi.createReservation(body);
    expect(request).toHaveBeenNthCalledWith(1, "/api/auth/customers/register", { method: "POST", body: { phone: "0900000201", password: "customer-password", full_name: "Online Guest", identity_number: "ID0900000201" }, skipAuth: true });
    expect(request).toHaveBeenNthCalledWith(2, "/api/customer/reservations", { method: "POST", body, idempotencyKey: "booking-1" });
  });

  it("keeps list/detail/payment calls under the authenticated customer namespace", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue([]);
    await customerApi.me();
    await customerApi.reservations();
    await customerApi.reservation(42);
    await customerApi.depositPayment(42);
    await customerApi.cancelReservation(42, "Đổi kế hoạch", "customer-cancel-42");
    const change = { type: "EXTEND" as const, new_check_in: "2031-01-11T12:00:00", new_check_out: "2031-01-13T12:00:00" };
    await customerApi.changeReservationStay(42, change, "customer-change-42");
    expect(request).toHaveBeenNthCalledWith(1, "/api/auth/customers/me");
    expect(request).toHaveBeenNthCalledWith(2, "/api/customer/reservations");
    expect(request).toHaveBeenNthCalledWith(3, "/api/customer/reservations/42", undefined);
    expect(request).toHaveBeenNthCalledWith(4, "/api/customer/reservations/42/deposit-payment");
    expect(request).toHaveBeenNthCalledWith(5, "/api/customer/reservations/42/cancel", { method: "POST", body: { reason: "Đổi kế hoạch" }, idempotencyKey: "customer-cancel-42" });
    expect(request).toHaveBeenNthCalledWith(6, "/api/customer/reservations/42/stay-change", { method: "POST", body: change, idempotencyKey: "customer-change-42" });
  });

  it("routes hotel service booking, listing and cancellation through the customer's booking", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue({ id: 12 });
    const body = { reservation_id: 6, room_id: "R1001", service_id: "MAMREST", scheduled_at: "2031-01-10T18:30:00", quantity: 2, meal_period: "DINNER" as const };
    await customerApi.bookService(body, "service-dinner-1");
    await customerApi.serviceBookings(6);
    await customerApi.cancelServiceBooking(12);
    expect(request).toHaveBeenNthCalledWith(1, "/api/customer/service-bookings", { method: "POST", body, idempotencyKey: "service-dinner-1" });
    expect(request).toHaveBeenNthCalledWith(2, "/api/customer/service-bookings?reservation_id=6");
    expect(request).toHaveBeenNthCalledWith(3, "/api/customer/service-bookings/12/cancel", { method: "POST" });
  });

  it("surfaces ownership errors from the backend instead of manufacturing a result", async () => {
    vi.spyOn(apiClient, "request").mockRejectedValue(new ApiError(403, { code: "FORBIDDEN" }));
    await expect(customerApi.reservation(999)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("forwards cancellation signals for payment-result reads",async()=>{
    const request=vi.spyOn(apiClient,"request").mockResolvedValue({});
    const controller=new AbortController();
    await customerApi.reservation(42,controller.signal);
    await customerApi.latestVnpayPayment(42,controller.signal);
    expect(request).toHaveBeenNthCalledWith(1,"/api/customer/reservations/42",{signal:controller.signal});
    expect(request).toHaveBeenNthCalledWith(2,"/api/customer/reservations/42/vnpay-payments/latest",{signal:controller.signal});
  });

  it("rejects invalid reservation IDs before making a request", async () => {
    const request = vi.spyOn(apiClient, "request");
    await expect(customerApi.reservation(0)).rejects.toThrow("reservation ID must be a positive integer");
    await expect(customerApi.depositPayment(Number.NaN)).rejects.toThrow("reservation ID must be a positive integer");
    expect(request).not.toHaveBeenCalled();
  });
});
