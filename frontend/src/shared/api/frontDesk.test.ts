import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import { frontDeskApi, newPaymentIdempotencyKey } from "./frontDesk";

describe("front desk API contract", () => {
  const request = vi.spyOn(apiClient, "request");
  beforeEach(() => { request.mockReset(); request.mockResolvedValue({}); });

  it("uses exact dashboard, guest and reservation read paths", async () => {
    await frontDeskApi.dashboard({ date: "2026-09-18", status: "CONFIRMED", page: 1, size: 20 });
    await frontDeskApi.guests("An");
    await frontDeskApi.guest(7);
    await frontDeskApi.reservations({ guest_id: 7, page: 1 });
    await frontDeskApi.reservation(9);
    expect(request.mock.calls.map(call => call[0])).toEqual([
      "/api/front-desk/dashboard?date=2026-09-18&status=CONFIRMED&page=1&size=20", "/api/guests?q=An", "/api/guests/7", "/api/reservations?guest_id=7&page=1", "/api/reservations/9",
    ]);
  });

  it("does not add an empty query string to unfiltered reads", async () => {
    await frontDeskApi.dashboard();
    await frontDeskApi.reservations();
    expect(request.mock.calls.map(call => call[0])).toEqual(["/api/front-desk/dashboard", "/api/reservations"]);
  });

  it("generates a fresh header key for each retry-safe reservation mutation", async () => {
    await frontDeskApi.createReservation({ guest_id: 1, employee_id: "E1", deposit: 0, rental_type: "PACKAGE", rooms: [] });
    await frontDeskApi.confirm(1);
    await frontDeskApi.transfer(1, { from_room_id: "101", to_room_id: "102" });
    const options = request.mock.calls.map(call => call[1] as { idempotencyKey?: string; method?: string; body?: unknown });
    expect(options.every(option => option.idempotencyKey)).toBe(true);
    expect(new Set(options.map(option => option.idempotencyKey)).size).toBe(3);
  });

  it("uses the Idempotency-Key header and keeps retry payload free of the key", async () => {
    await frontDeskApi.recordPayment(4, { amount: 125000, method: "CASH", type: "REFUND" }, "refund-1");
    expect(request).toHaveBeenCalledWith("/api/invoices/4/payments", { method: "POST", body: { amount: 125000, method: "CASH", type: "REFUND" }, idempotencyKey: "refund-1" });
  });

  it("reuses the caller key when the same payment is retried", async () => {
    const body = { amount: 125000, method: "CASH" as const, type: "PAYMENT" as const };
    await frontDeskApi.recordPayment(4, body, "double-click-key");
    await frontDeskApi.recordPayment(4, body, "double-click-key");
    expect(request.mock.calls.map(call => call[1])).toEqual([
      expect.objectContaining({ idempotencyKey: "double-click-key", body }),
      expect.objectContaining({ idempotencyKey: "double-click-key", body }),
    ]);
  });

  it("rejects a missing payment key before issuing a request", async () => {
    await expect(frontDeskApi.recordPayment(4, { amount: 125000, method: "CASH", type: "PAYMENT" }, "")).rejects.toThrow("Idempotency-Key");
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects payment keys outside the backend format before issuing a request", async () => {
    await expect(frontDeskApi.recordPayment(4, { amount: 125000, method: "CASH", type: "PAYMENT" }, "bad key")).rejects.toThrow("valid Idempotency-Key");
    await expect(frontDeskApi.recordPayment(4, { amount: 125000, method: "CASH", type: "PAYMENT" }, "a".repeat(36))).rejects.toThrow("valid Idempotency-Key");
    expect(request).not.toHaveBeenCalled();
  });

  it("uses the required receipt body and Idempotency-Key header contract", async () => {
    await frontDeskApi.issueReceipt(4, { receipt_number: "R-1", amount: 125000, method: "CASH" }, "receipt-key");
    expect(request).toHaveBeenCalledWith("/api/invoices/4/receipts", { method: "POST", body: { receipt_number: "R-1", amount: 125000, method: "CASH" }, idempotencyKey: "receipt-key" });
  });

  it("keeps payment body keys within the backend's 35-character limit", () => {
    expect(newPaymentIdempotencyKey()).toMatch(/^FD-[a-zA-Z0-9]{32}$/);
    expect(newPaymentIdempotencyKey()).toHaveLength(35);
  });

  it("covers lifecycle, service, billing, receipt and timeline endpoint paths", async () => {
    await frontDeskApi.cancel(2, "guest request"); await frontDeskApi.noShow(2); await frontDeskApi.checkIn(2); await frontDeskApi.checkOut(2, { at: "2026-09-20T11:30:00" }); await frontDeskApi.addService(2, { service_id: "BREAKFAST", quantity: 1 }); await frontDeskApi.services(); await frontDeskApi.roomEquipment("R101"); await frontDeskApi.invoice(2); await frontDeskApi.payments(8); await frontDeskApi.receipts(8); await frontDeskApi.issueReceipt(8, { receipt_number: "R-1", amount: 100, method: "CASH" }); await frontDeskApi.timeline(2);
    expect(request.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining(["/api/reservations/2/cancel", "/api/reservations/2/no-show", "/api/reservations/2/check-in", "/api/reservations/2/check-out", "/api/reservations/2/services", "/api/services", "/api/rooms/R101/equipment", "/api/invoices/reservation/2", "/api/invoices/8/payments", "/api/invoices/8/receipts", "/api/reservations/2/timeline"]));
  });

  it("sends only the dedicated cash handover payload with a stable caller key", async () => {
    const body = { shift_code: "FD-2026-09-19", from_actor: "FD01", to_actor: "FD02", actual_amount: 950000, note: "counted" };
    await frontDeskApi.cashHandover(body, "FD-handover-1");
    expect(request).toHaveBeenCalledWith("/api/finance/cash-handovers", { method: "POST", body, idempotencyKey: "FD-handover-1" });
  });

  it("reads only the signed-in receptionist's handover history", async () => {
    await frontDeskApi.myCashHandovers({ page: 1, size: 8 });
    expect(request).toHaveBeenCalledWith("/api/finance/cash-handovers/mine?page=1&size=8");
  });

  it("checks room availability for the remaining stay before transfer", async () => {
    await frontDeskApi.roomAvailability("2026-09-23T10:00:00", "2026-09-26T12:00:00");
    expect(request).toHaveBeenCalledWith("/api/rooms/availability?from=2026-09-23T10%3A00%3A00&to=2026-09-26T12%3A00%3A00");
  });

  it("reuses a caller-provided key for retryable front desk mutations", async () => {
    await frontDeskApi.addService(2, { service_id: "MINIBAR", quantity: 2 }, "FD-service-1");
    await frontDeskApi.transfer(2, { from_room_id: "101", to_room_id: "102" }, "FD-transfer-1");
    expect(request.mock.calls.map(call => call[1])).toEqual([
      expect.objectContaining({ idempotencyKey: "FD-service-1" }),
      expect.objectContaining({ idempotencyKey: "FD-transfer-1" }),
    ]);
  });

  it("loads booked services and confirms actual use through reservation-scoped endpoints", async () => {
    await frontDeskApi.serviceBookings(6);
    await frontDeskApi.useServiceBooking(6, 12);
    expect(request.mock.calls.map(call => call[0])).toEqual([
      "/api/reservations/6/service-bookings",
      "/api/reservations/6/service-bookings/12/use",
    ]);
  });
});
