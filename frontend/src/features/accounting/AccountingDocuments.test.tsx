import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InvoiceOperations from "./InvoiceOperations";
import CashHandoverPanel from "./CashHandoverPanel";
import { kitchenAccountingApi as api } from "../../shared/api/kitchenAccounting";
import type { Invoice, Receipt } from "../../shared/types/kitchenAccounting";

const invoice: Invoice = { id: 3, reservation_id: 7, issued_at: "2026-10-17T10:00:00", room_total: 20000000, service_total: 0, late_surcharge: 0, compensation: 0, extension_total: 0, adjustment_total: 0, discount: 0, deposit: 5000000, payable: 15000000, payment_method: "CASH", status: "CHUA_THANH_TOAN" };
const receipt: Receipt = { id: 4, invoice_id: 3, receipt_number: "PT-004", amount: 5000000, method: "CASH", issued_at: "2026-10-17T10:00:00", issued_by: "FRONTDESK" };
const mountInvoices = () => render(<InvoiceOperations onChanged={vi.fn()} onVatCreated={vi.fn()} refresh={0} search="" vatInvoices={[]} />);
beforeEach(() => {
  vi.spyOn(api, "invoices").mockResolvedValue({ items: [invoice], page: 0, size: 10, totalElements: 1, totalPages: 1 });
  vi.spyOn(api, "refundRequests").mockResolvedValue([]);
  vi.spyOn(api, "invoicePayments").mockResolvedValue([{ id: 1, invoice_id: 3, amount: 5000000, method: "CASH", type: "PAYMENT", status: "COMPLETED", reference: null, occurred_at: "2026-10-17T10:00:00", actor_id: "FRONTDESK" }]);
  vi.spyOn(api, "invoiceReceipts").mockResolvedValue([receipt]);
});
afterEach(() => vi.restoreAllMocks());

describe("Accounting uses existing financial records", () => {
  it("opens the saved receipt unchanged for reprinting without issuing a receipt or taking payment", async () => {
    const takePayment = vi.spyOn(api, "recordPayment");
    const issueReceipt = vi.spyOn(api, "issueReceipt");
    mountInvoices();
    fireEvent.click(await screen.findByRole("button", { name: "Xem / ghi nhận" }));
    fireEvent.click(await screen.findByRole("button", { name: "In phiếu thu PT-004" }));
    const preview = screen.getByRole("dialog", { name: "PHIẾU THU · PT-004" });
    expect(within(preview).getByText("FRONTDESK")).toBeTruthy();
    expect(within(preview).getByText("INV-3")).toBeTruthy();
    expect(within(preview).getByText(/5\.000\.000/)).toBeTruthy();
    expect(within(preview).queryByRole("textbox")).toBeNull();
    expect(within(preview).getByRole("button", { name: "In / Lưu PDF" })).toBeTruthy();
    fireEvent.click(within(preview).getByRole("button", { name: "Đóng" }));
    fireEvent.click(screen.getByRole("button", { name: "In phiếu thu PT-004" }));
    expect(within(screen.getByRole("dialog")).getByText("FRONTDESK")).toBeTruthy();
    expect(takePayment).not.toHaveBeenCalled();
    expect(issueReceipt).not.toHaveBeenCalled();
  });

  it("continues sending a normal payment above ten million to the existing payment API", async () => {
    const takePayment = vi.spyOn(api, "recordPayment").mockResolvedValue({ id: 2, invoice_id: 3, amount: 12000000, method: "CASH", type: "PAYMENT", status: "COMPLETED", reference: null, occurred_at: "2026-10-18T10:00:00", actor_id: "ACCOUNTING" });
    mountInvoices();
    fireEvent.click(await screen.findByRole("button", { name: "Xem / ghi nhận" }));
    await screen.findByRole("button", { name: "In phiếu thu PT-004" });
    fireEvent.click(screen.getByRole("button", { name: "Ghi nhận thu tiền" }));
    const dialog = screen.getByRole("dialog", { name: "Ghi nhận thu tiền" });
    fireEvent.change(within(dialog).getByLabelText("Số tiền (VND)"), { target: { value: "12000000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu nghiệp vụ" }));
    await waitFor(() => expect(takePayment).toHaveBeenCalledWith(3, { amount: 12000000, method: "CASH", type: "PAYMENT", reference: null }, expect.any(String)));
    expect(takePayment).toHaveBeenCalledOnce();
  });

  it("shows a failed payment-history request and blocks money actions until it can be reloaded", async () => {
    vi.mocked(api.invoicePayments).mockRejectedValue(new Error("Unavailable"));
    mountInvoices();
    fireEvent.click(await screen.findByRole("button", { name: "Xem / ghi nhận" }));
    await screen.findByRole("button", { name: "Tải lại giao dịch hóa đơn" });
    expect((screen.getByRole("button", { name: "Ghi nhận thu tiền" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Chưa tải được")).toBeTruthy();
  });

  it("prints a submitted handover with its recorded discrepancy without confirming or recounting it", () => {
    const confirm = vi.spyOn(api, "confirmCashHandover");
    render(<CashHandoverPanel date="2026-10-17" actor="ACCOUNTING" onSaved={vi.fn()} handovers={[{ id: 8, shift_code: "MORNING", from_actor: "FRONTDESK", to_actor: "ACCOUNTING", expected_amount: 100000, actual_amount: 90000, variance: -10000, handed_over_at: "2026-10-17T13:00:00", note: '<script>alert("x")</script>', denominations: [] }]} />);
    fireEvent.click(screen.getByRole("button", { name: "In biên bản BG-8" }));
    const preview = screen.getByRole("dialog");
    expect(within(preview).getByText("Chờ xác nhận")).toBeTruthy();
    expect(within(preview).getByText(/90\.000/)).toBeTruthy();
    expect(within(preview).getByText('<script>alert("x")</script>')).toBeTruthy();
    expect(preview.querySelector("script")).toBeNull();
    expect(within(preview).queryByRole("spinbutton")).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });
});
