export type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "MOMO" | "OTHER";
export type PaymentTransactionType = "PAYMENT" | "REFUND";
export type PaymentTransactionStatus = "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type InvoiceStatus = "DA_THANH_TOAN" | "CHUA_THANH_TOAN" | "DU_KIEN";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "CONSUMED";
export type MovementType = "RECEIVE" | "ISSUE" | "WASTE" | "RETURN" | "ADJUST";

export interface Service {
  id: string; name: string; price: number; unit: string | null;
  category?: string | null; description?: string | null; image_url?: string | null;
  stock: number; safety_threshold: number; low_stock: boolean;
}
export interface RestaurantBooking { id: number; reservation_id: number; room_id: string; service_id: string; service_name: string; scheduled_at: string; quantity: number; free_quantity: number; unit_price: number; amount_due: number; meal_period: string | null; status: "CONFIRMED" | "USED" | "CANCELLED" | string; note: string | null; }
export interface StockRequest { quantity: number; }
export interface InventoryMovementRequest { service_id: string; type: MovementType; quantity: number; reason: string | null; }
export interface PriceChangeRequest { price: number; reason: string; }
export interface InvoiceAdjustmentRequest { delta: number; reason: string; }
export interface PriceHistory { id: number; service_id: string; price: number; changed_by: string; approval_id: number | null; effective_at: string | null; }
export interface InventoryMovement { id: number; service_id: string; type: MovementType; quantity: number; actor_id: string; occurred_at: string; reason: string | null; }
export interface InventoryReport { service_id: string; from: string | null; to: string | null; received: number; issued: number; wasted: number; returned: number; adjusted: number; net_change: number; }

export interface Approval { id: number; requester: string; action: string; target_id: string; payload: string; amount: number | null; reason: string; risk: string; status: ApprovalStatus; approver: string | null; decided_at: string | null; expires_at: string | null; consumed_at: string | null; requested_at: string; idempotency_key: string | null; }
export interface Page<T> { items: T[]; page: number; size: number; totalElements: number; totalPages: number; }

export interface Invoice { id: number; reservation_id: number; issued_at: string; room_total: number; service_total: number; late_surcharge: number; compensation: number; extension_total: number; adjustment_total: number; discount: number; deposit: number; payable: number; payment_method: PaymentMethod | null; status: InvoiceStatus; }
export interface Payment { id: number; invoice_id: number; amount: number; method: PaymentMethod; type: PaymentTransactionType; status: PaymentTransactionStatus; reference: string | null; occurred_at: string; actor_id: string; }
export interface Receipt { id: number; receipt_number: string; invoice_id: number; amount: number; method: PaymentMethod; issued_at: string; issued_by: string; }
export interface Expense { id: number; category: string; description: string; amount: number; paid_by: string; paid_at: string; status: string; }
export interface PartnerDebt { id: number; partner_name: string; reference_code: string; amount: number; settled_amount: number; status: string; recorded_at: string; }
export interface DebtSettlement { id: number; partner_debt_id: number; amount: number; settled_by: string; settled_at: string; note: string | null; }
export interface CashDenomination { denomination: number; quantity: number; }
export interface CashHandover { id: number; shift_code: string; from_actor: string; to_actor: string; expected_amount: number; actual_amount: number; variance: number; handed_over_at: string; note: string | null; denominations: CashDenomination[]; }
export interface CashHandoverRequest { shift_code: string; from_actor: string; to_actor: string; actual_amount: number; note: string | null; denominations?: CashDenomination[]; }
export interface ExpenseRequest { category: string; description: string; amount: number; }
export interface PartnerDebtRequest { partner_name: string; reference_code: string; amount: number; }
export interface DebtSettlementRequest { amount: number; note: string | null; }
export interface LedgerEntry { id: number; entry_type: string; source_type: string; source_id: string; direction: string; amount: number; actor_id: string; occurred_at: string; note: string | null; finalized: boolean; }
export interface Reconciliation { from_date: string | null; to_date: string | null; totals_by_method: Record<string, number>; total_payments: number; total_refunds: number; net_total: number; recognized_revenue: number; outstanding_partner_debt: number; cash_variance: number; }

export interface PaymentQuery { invoice_id?: number; method?: PaymentMethod; type?: PaymentTransactionType; status?: PaymentTransactionStatus; from?: string; to?: string; page?: number; size?: number; }
export interface ReceiptQuery { invoice_id?: number; method?: PaymentMethod; issued_by?: string; from?: string; to?: string; page?: number; size?: number; }
export interface PaymentCreateRequest { amount: number; method: PaymentMethod; type: PaymentTransactionType; reference?: string | null; }
export interface LedgerQuery { entry_type?: string; from?: string; to?: string; page?: number; size?: number; }
