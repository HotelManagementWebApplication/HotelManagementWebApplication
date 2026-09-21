import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import { canActivatePrice, canApprove, kitchenAccountingApi } from "./kitchenAccounting";

describe("kitchen/accounting API contract", () => {
  const request = vi.spyOn(apiClient, "request");
  beforeEach(() => { request.mockReset(); request.mockResolvedValue([]); });

  it("uses the audited endpoint paths and snake_case query names", async () => {
    await kitchenAccountingApi.services(); await kitchenAccountingApi.lowStock();
    await kitchenAccountingApi.inventoryMovements("mini bar"); await kitchenAccountingApi.inventoryReport("mini bar", { from: "2026-09-01", to: "2026-09-18" });
    await kitchenAccountingApi.priceHistory("mini bar"); await kitchenAccountingApi.invoices({ reservation_id: 7 });
    await kitchenAccountingApi.payments({ invoice_id: 4, page: 2 }); await kitchenAccountingApi.receipts({ issued_by: "e1" });
    await kitchenAccountingApi.expenses(); await kitchenAccountingApi.partnerDebts(); await kitchenAccountingApi.settlements(3); await kitchenAccountingApi.ledger({ entry_type: "PAYMENT" }); await kitchenAccountingApi.reconciliation({ from: "2026-09-01" });
    expect(request.mock.calls.map(call => call[0])).toEqual([
      "/api/services", "/api/services/low-stock", "/api/services/mini%20bar/inventory-movements", "/api/services/mini%20bar/inventory-movements/inventory-report?from=2026-09-01&to=2026-09-18", "/api/services/mini%20bar/price-history", "/api/invoices?reservation_id=7", "/api/finance/payments?invoice_id=4&page=2", "/api/finance/receipts?issued_by=e1", "/api/finance/expenses", "/api/finance/partner-debts", "/api/finance/partner-debts/3/settlements", "/api/finance/ledger?entry_type=PAYMENT", "/api/finance/reconciliation?from=2026-09-01",
    ]);
  });

  it("transports exact snake_case bodies and caller idempotency headers", async () => {
    await kitchenAccountingApi.restock("S1", { quantity: 5 }, "stock-1"); await kitchenAccountingApi.recordInventoryMovement({ service_id: "S1", type: "ISSUE", quantity: 2, reason: "Bán minibar" }, "movement-1"); await kitchenAccountingApi.submitPrice("S1", { price: 120000, reason: "Mùa cao điểm" }, "price-submit-1"); await kitchenAccountingApi.activatePrice("S1", { price: 120000, reason: "Mùa cao điểm" }, "price-activate-1"); await kitchenAccountingApi.issueReceipt(9, { receipt_number: "R-9", amount: 120000, method: "CASH" }, "receipt-1");
    for (const [path, options] of request.mock.calls) expect(options).toEqual(expect.objectContaining({ method: "POST", idempotencyKey: expect.any(String) }));
    expect(request.mock.calls[0][1]).toEqual(expect.objectContaining({ body: { quantity: 5 } }));
    expect(request.mock.calls[1][0]).toBe("/api/services/S1/inventory-movements");
    expect(request.mock.calls[1][1]).toEqual(expect.objectContaining({ body: { service_id: "S1", type: "ISSUE", quantity: 2, reason: "Bán minibar" } }));
    expect(request.mock.calls[2][1]).toEqual(expect.objectContaining({ body: { price: 120000, reason: "Mùa cao điểm" } }));
    expect(request.mock.calls[3][0]).toBe("/api/services/S1/price/activate");
    expect(request.mock.calls[3][1]).toEqual(expect.objectContaining({ body: { price: 120000, reason: "Mùa cao điểm" } }));
    expect(request.mock.calls[4][1]).toEqual(expect.objectContaining({ body: { receipt_number: "R-9", amount: 120000, method: "CASH" } }));
  });

  it("uses idempotent approval decisions and reads the contract-backed cash handover route", async () => {
    await kitchenAccountingApi.approve(12, "approval-approve-1");
    await kitchenAccountingApi.reject(13, "approval-reject-1");
    await kitchenAccountingApi.cashHandovers();
    expect(request.mock.calls[0]).toEqual(["/api/governance/approvals/12/approve", expect.objectContaining({ method: "POST", idempotencyKey: "approval-approve-1" })]);
    expect(request.mock.calls[1]).toEqual(["/api/governance/approvals/13/reject", expect.objectContaining({ method: "POST", idempotencyKey: "approval-reject-1" })]);
    expect(request.mock.calls[2][0]).toBe("/api/finance/cash-handovers");
  });

  it("uses the current idempotent finance mutation controllers", async () => {
    await kitchenAccountingApi.recordCashHandover({ shift_code: "S-1", from_actor: "e1", to_actor: "e2", actual_amount: 500000, note: "Bàn giao đủ" }, "cash-1");
    await kitchenAccountingApi.recordExpense({ category: "SUPPLIES", description: "Mua nước", amount: 120000 }, "expense-1");
    await kitchenAccountingApi.recordPartnerDebt({ partner_name: "Nhà cung cấp A", reference_code: "PO-1", amount: 900000 }, "debt-1");
    await kitchenAccountingApi.settlePartnerDebt(7, { amount: 300000, note: "Thanh toán đợt 1" }, "settle-1");
    expect(request.mock.calls).toEqual([
      ["/api/finance/cash-handovers", expect.objectContaining({ method: "POST", body: { shift_code: "S-1", from_actor: "e1", to_actor: "e2", actual_amount: 500000, note: "Bàn giao đủ" }, idempotencyKey: "cash-1" })],
      ["/api/finance/expenses", expect.objectContaining({ method: "POST", body: { category: "SUPPLIES", description: "Mua nước", amount: 120000 }, idempotencyKey: "expense-1" })],
      ["/api/finance/partner-debts", expect.objectContaining({ method: "POST", body: { partner_name: "Nhà cung cấp A", reference_code: "PO-1", amount: 900000 }, idempotencyKey: "debt-1" })],
      ["/api/finance/partner-debts/7/settle", expect.objectContaining({ method: "POST", body: { amount: 300000, note: "Thanh toán đợt 1" }, idempotencyKey: "settle-1" })],
    ]);
  });

  it("rejects missing or malformed idempotency keys before a mutation request", async () => {
    expect(() => kitchenAccountingApi.recordInventoryMovement({ service_id: "S1", type: "ADJUST", quantity: -1, reason: "Kiểm kê" }, "")).toThrow("Idempotency-Key");
    expect(() => kitchenAccountingApi.issueReceipt(9, { receipt_number: "R-9", amount: 120000, method: "CASH" }, "bad key")).toThrow("Idempotency-Key");
    expect(request).not.toHaveBeenCalled();
  });

  it("uses the Idempotency-Key header and keeps payment idempotency out of JSON", async () => {
    await kitchenAccountingApi.recordPayment(9, { amount: 120000, method: "CASH", type: "PAYMENT", reference: null }, "payment-9-1");
    await kitchenAccountingApi.adjustInvoice(9, { delta: -1000, reason: "Điều chỉnh minibar" }, "adjust-9-1");
    expect(request).toHaveBeenCalledWith("/api/invoices/9/payments", expect.objectContaining({ method: "POST", body: { amount: 120000, method: "CASH", type: "PAYMENT", reference: null }, idempotencyKey: "payment-9-1" }));
    expect(request).toHaveBeenCalledWith("/api/invoices/9/adjust", expect.objectContaining({ method: "POST", body: { delta: -1000, reason: "Điều chỉnh minibar" }, idempotencyKey: "adjust-9-1" }));
  });

  it("keeps requester and canonical status guards in the client contract", () => {
    expect(canApprove({ status: "PENDING", requester: "e1" }, ["APPROVAL_APPROVE"], "e1")).toBe(false);
    expect(canApprove({ status: "APPROVED", requester: "e2" }, ["APPROVAL_APPROVE"], "e1")).toBe(false);
    expect(canApprove({ status: "PENDING", requester: "e2" }, ["APPROVAL_APPROVE"], "e1")).toBe(true);
    expect(canApprove({ status: "PENDING", requester: "e2" }, [], "e1")).toBe(false);
    expect(canApprove({ status: "PENDING", requester: "e2" }, ["APPROVAL_APPROVE"], undefined)).toBe(false);
    expect(canActivatePrice({ status: "APPROVED", action: "SERVICE_PRICE_CHANGE", target_id: "S1", requester: "e1" }, "S1", ["SERVICE_PRICE_ACTIVATE"], "e2")).toBe(true);
    expect(canActivatePrice({ status: "PENDING", action: "SERVICE_PRICE_CHANGE", target_id: "S1", requester: "e1" }, "S1", ["SERVICE_PRICE_ACTIVATE"], "e2")).toBe(false);
    expect(canActivatePrice({ status: "APPROVED", action: "SERVICE_PRICE_CHANGE", target_id: "S1", requester: "e2" }, "S1", ["SERVICE_PRICE_ACTIVATE"], "e2")).toBe(false);
  });
});
