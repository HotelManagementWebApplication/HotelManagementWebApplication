import { apiClient } from "./client";
import type { Approval, ApprovalStatus, CashHandover, CashHandoverRequest, DebtSettlement, DebtSettlementRequest, Expense, ExpenseRequest, InventoryMovement, InventoryMovementRequest, InventoryReport, Invoice, InvoiceAdjustmentRequest, LedgerEntry, LedgerQuery, Page, PartnerDebt, PartnerDebtRequest, Payment, PaymentCreateRequest, PaymentQuery, PriceChangeRequest, PriceHistory, Receipt, ReceiptQuery, Reconciliation, RestaurantBooking, Service, StockRequest } from "../types/kitchenAccounting";

const key = () => `KA-${(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9]/g, "").slice(0, 32)}`;
const query = (params: object) => { const value = Object.entries(params).filter(([, item]) => item !== undefined && item !== "").map(([name, item]) => [name, String(item)] as [string, string]); const text = new URLSearchParams(value).toString(); return text ? `?${text}` : ""; };
const requiredKey = (value: string) => {
  const normalized = value?.trim();
  if (!normalized || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,34}$/.test(normalized)) throw new Error("Mutation requires a valid Idempotency-Key");
  return normalized;
};
const headerMutation = <T>(path: string, body: unknown, idempotencyKey: string) => apiClient.request<T>(path, { method: "POST", body, idempotencyKey: requiredKey(idempotencyKey) });

export const kitchenAccountingApi = {
  services: () => apiClient.request<Service[]>("/api/services"),
  restaurantBookings: (params: { date?: string; status?: string } = {}) => apiClient.request<RestaurantBooking[]>(`/api/operations/restaurant/service-bookings${query(params)}`),
  markRestaurantBookingUsed: (id: number) => apiClient.request<RestaurantBooking>(`/api/operations/restaurant/service-bookings/${id}/use`, { method: "POST" }),
  lowStock: () => apiClient.request<Service[]>("/api/services/low-stock"),
  inventoryMovements: (serviceId: string) => apiClient.request<InventoryMovement[]>(`/api/services/${encodeURIComponent(serviceId)}/inventory-movements`),
  inventoryReport: (serviceId: string, params: { from?: string; to?: string } = {}) => apiClient.request<InventoryReport>(`/api/services/${encodeURIComponent(serviceId)}/inventory-movements/inventory-report${query(params)}`),
  priceHistory: (serviceId: string) => apiClient.request<PriceHistory[]>(`/api/services/${encodeURIComponent(serviceId)}/price-history`),
  restock: (serviceId: string, body: StockRequest, idempotencyKey: string) => headerMutation<Service>(`/api/services/${encodeURIComponent(serviceId)}/stock`, body, idempotencyKey),
  recordInventoryMovement: (body: InventoryMovementRequest, idempotencyKey: string) => headerMutation<InventoryMovement>(`/api/services/${encodeURIComponent(body.service_id)}/inventory-movements`, body, idempotencyKey),
  submitPrice: (serviceId: string, body: PriceChangeRequest, idempotencyKey: string) => headerMutation<Approval>(`/api/services/${encodeURIComponent(serviceId)}/price/submit`, body, idempotencyKey),
  activatePrice: (serviceId: string, body: PriceChangeRequest, idempotencyKey: string) => headerMutation<Service>(`/api/services/${encodeURIComponent(serviceId)}/price/activate`, body, idempotencyKey),
  approvals: (status: ApprovalStatus = "PENDING") => apiClient.request<Approval[] | Page<Approval>>(`/api/governance/approvals${query({ status })}`),
  approve: (id: number, idempotencyKey: string) => headerMutation<Approval>(`/api/governance/approvals/${id}/approve`, undefined, idempotencyKey),
  reject: (id: number, idempotencyKey: string) => headerMutation<Approval>(`/api/governance/approvals/${id}/reject`, undefined, idempotencyKey),
  invoices: (params: { status?: string; reservation_id?: number; from?: string; to?: string; page?: number; size?: number } = {}) => apiClient.request<Page<Invoice>>(`/api/invoices${query(params)}`),
  payments: (params: PaymentQuery = {}) => apiClient.request<Page<Payment>>(`/api/finance/payments${query(params)}`),
  invoicePayments: (invoiceId: number) => apiClient.request<Payment[] | Page<Payment>>(`/api/invoices/${invoiceId}/payments`),
  receipts: (params: ReceiptQuery = {}) => apiClient.request<Page<Receipt>>(`/api/finance/receipts${query(params)}`),
  invoiceReceipts: (invoiceId: number) => apiClient.request<Receipt[] | Page<Receipt>>(`/api/invoices/${invoiceId}/receipts`),
  recordPayment: (invoiceId: number, body: PaymentCreateRequest, idempotencyKey: string) => headerMutation<Payment>(`/api/invoices/${invoiceId}/payments`, body, idempotencyKey),
  adjustInvoice: (invoiceId: number, body: InvoiceAdjustmentRequest, idempotencyKey: string) => headerMutation<Invoice>(`/api/invoices/${invoiceId}/adjust`, body, idempotencyKey),
  expenses: () => apiClient.request<Expense[]>("/api/finance/expenses"),
  partnerDebts: () => apiClient.request<PartnerDebt[]>("/api/finance/partner-debts"),
  settlements: (id: number) => apiClient.request<DebtSettlement[]>(`/api/finance/partner-debts/${id}/settlements`),
  cashHandovers: () => apiClient.request<CashHandover[]>("/api/finance/cash-handovers"),
  recordCashHandover: (body: CashHandoverRequest, idempotencyKey: string) => headerMutation<CashHandover>("/api/finance/cash-handovers", body, idempotencyKey),
  ota: () => apiClient.request<import("../types/enterprise").OtaReconciliation[]>("/api/finance/ota-reconciliation"),
  vatInvoices: () => apiClient.request<import("../types/enterprise").VatInvoice[]>("/api/finance/vat-invoices"),
  recordExpense: (body: ExpenseRequest, idempotencyKey: string) => headerMutation<Expense>("/api/finance/expenses", body, idempotencyKey),
  recordPartnerDebt: (body: PartnerDebtRequest, idempotencyKey: string) => headerMutation<PartnerDebt>("/api/finance/partner-debts", body, idempotencyKey),
  settlePartnerDebt: (id: number, body: DebtSettlementRequest, idempotencyKey: string) => headerMutation<PartnerDebt>(`/api/finance/partner-debts/${id}/settle`, body, idempotencyKey),
  ledger: (params: LedgerQuery = {}) => apiClient.request<Page<LedgerEntry>>(`/api/finance/ledger${query(params)}`),
  reconciliation: (params: { from?: string; to?: string } = {}) => apiClient.request<Reconciliation>(`/api/finance/reconciliation${query(params)}`),
  issueReceipt: (invoiceId: number, body: { receipt_number: string; amount: number; method: Receipt["method"] }, idempotencyKey: string) => headerMutation<Receipt>(`/api/invoices/${invoiceId}/receipts`, body, idempotencyKey),
};

export const hasPermission = (permissions: string[] | undefined, permission: string) => Boolean(permissions?.includes(permission));
export const canApprove = (approval: Pick<Approval, "status" | "requester">, permissions: string[] | undefined, actorId: string | undefined) => approval.status === "PENDING" && Boolean(actorId) && approval.requester !== actorId && hasPermission(permissions, "APPROVAL_APPROVE");
export const canActivatePrice = (approval: Pick<Approval, "status" | "requester" | "action" | "target_id">, serviceId: string, permissions: string[] | undefined, actorId: string | undefined) => approval.status === "APPROVED" && approval.action === "SERVICE_PRICE_CHANGE" && approval.target_id === serviceId && Boolean(actorId) && approval.requester !== actorId && hasPermission(permissions, "SERVICE_PRICE_ACTIVATE");
export const toRows = <T>(value: T[] | Page<T> | undefined): T[] => Array.isArray(value) ? value : value?.items ?? [];
export const newPaymentIdempotencyKey = key;
export const newKitchenIdempotencyKey = key;
