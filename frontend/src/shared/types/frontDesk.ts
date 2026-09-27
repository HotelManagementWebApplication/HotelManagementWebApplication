export type ReservationStatus = "DRAFT" | "DEPOSIT_PAID" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
export type RentalType = "PACKAGE" | "HOURLY";
export type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER";
export type PaymentStatus = "DA_THANH_TOAN" | "CHUA_THANH_TOAN" | "DU_KIEN";
export type TransactionType = "PAYMENT" | "REFUND";
export type RoomCanonicalStatus = "available" | "reserved" | "occupied" | "cleaning" | "maintenance" | "out_of_service" | "returned" | "cancelled";

export interface Guest { id: number; full_name: string; birth_year: number | null; identity_number: string; phone: string; email: string | null; address: string | null; membership_tier: string; total_spend: number; late_cancellation_count: number; late_checkout_count: number; booking_blocked: boolean; }
export interface GuestCreate { full_name: string; birth_year?: number; identity_number: string; phone: string; email?: string; address?: string; }
export interface MembershipHistoryEntry { guest_id: number; from_tier: string; to_tier: string; reason: string; changed_at: string; }
export interface RoomLine { room_id: string; expected_check_in: string; expected_check_out: string; actual_check_in: string | null; actual_check_out: string | null; }
export interface Reservation { id: number; guest_id: number; employee_id: string; status: ReservationStatus; rental_type: RentalType; booking_source?: string; ota_gross_revenue?: number | null; ota_commission?: number | null; ota_net_revenue?: number | null; ota_reconciliation_status?: string; deposit: number; booked_at: string; actual_check_in: string | null; actual_check_out: string | null; rooms: RoomLine[]; cancellation_reason: string | null; cancellation_outcome: string | null; service_usages?: { service_id: string; service_name: string; used_on: string; quantity: number; unit_price: number; amount: number }[]; }
export interface Page<T> { items: T[]; page: number; size: number; total_elements: number; total_pages: number; }
export interface DashboardItem { reservation_id: number; guest_id: number; guest_name: string; guest_phone: string; status: ReservationStatus; check_in: string; check_out: string; room_ids: string[]; deposit_amount: number; deposit_payment_status: string; invoice_balance: number; }
export interface RoomSummary { room_id: string; name: string; status: string; room_type_id: string; room_type_name: string; floor: number; daily_price: number; bed_type: string | null; }
export interface Dashboard { business_date: string; arrivals: DashboardItem[]; departures: DashboardItem[]; current_stays: DashboardItem[]; upcoming_stays?: DashboardItem[]; unpaid_deposits: DashboardItem[]; invoice_balances: DashboardItem[]; rooms: RoomSummary[]; room_counts: Record<string, number>; incidents: { id: number; reservation_id: number; room_id: string; compensation: number }[]; page: number; size: number; total_elements: number; total_pages: number; }
export interface Invoice { id: number; reservation_id: number; issued_at: string; room_total: number; service_total: number; late_surcharge: number; compensation: number; extension_total: number; adjustment_total: number; discount: number; deposit: number; payable: number; payment_method: PaymentMethod | null; status: PaymentStatus; }
export interface Payment { id: number; invoice_id: number; amount: number; method: PaymentMethod; type: TransactionType; status: "COMPLETED" | "FAILED" | "VOIDED"; reference: string | null; occurred_at: string; actor_id: string; }
export interface Receipt { id: number; receipt_number: string; invoice_id: number; amount: number; method: PaymentMethod; issued_at: string; issued_by: string; }
export interface TimelineEvent { id: number; event_type?: string; action?: string; actor_id?: string; occurred_at?: string; created_at?: string; details?: string; }
export interface RoomTransfer { id: number; reservation_id: number; from_room_id: string; to_room_id: string; transferred_at: string; reason: string | null; }
export interface RoomTransferCreate { from_room_id: string; to_room_id: string; transferred_at?: string; reason?: string; }
export interface RoomAvailability { room_id: string; room_type_id: string; room_type_name: string; daily_price: number; floor: number; available: boolean; }

export interface ReservationCreate { guest_id: number; employee_id: string; deposit: number; rental_type: RentalType; booking_source?: string; rooms: { room_id: string; expected_check_in: string; expected_check_out: string; guest_count?: number }[]; idempotency_key?: string; }
export interface ReservationUpdate { rooms: ReservationCreate["rooms"]; deposit: number; }
export interface CheckInRequest { at?: string; }
export interface CheckOutRequest { at?: string; payment_method?: PaymentMethod; }
export interface PaymentCreate { amount: number; method: PaymentMethod; type: TransactionType; reference?: string; }
export interface ReceiptCreate { receipt_number: string; amount: number; method: PaymentMethod; }
export interface ServiceCatalogItem { id: string; name: string; price: number; unit: string | null; stock: number; active?: boolean; }
export interface HotelServiceBooking { id: number; reservation_id: number; room_id: string; service_id: string; service_name?: string; scheduled_at: string; quantity: number; free_quantity: number; unit_price: number; amount_due: number; meal_period: "LUNCH" | "DINNER" | null; status: "CONFIRMED" | "USED" | "CANCELLED"; note: string | null; }
export interface CashDenomination { denomination: number; quantity: number; }
export interface CashHandoverCreate { shift_code: string; from_actor: string; to_actor: string; actual_amount: number; note?: string | null; denominations?: CashDenomination[]; }
export interface CashHandover { id: number; shift_code: string; from_actor: string; to_actor: string; expected_amount: number; actual_amount: number; variance: number; handed_over_at: string; note: string | null; denominations: CashDenomination[]; }
export interface RoomEquipment { id: number; room_id: string; name: string; original_value: number; purchased_on: string; quantity: number; active: boolean; }
export interface EquipmentIncidentCreate { room_id: string; equipment_name: string; equipment_id?: number; quantity: number; severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; }
export interface EquipmentIncident { id: number; reservation_id?: number; room_id: string; equipment_name: string; compensation: number; severity?: string; handoff_status?: string; handoff_note?: string | null; }
