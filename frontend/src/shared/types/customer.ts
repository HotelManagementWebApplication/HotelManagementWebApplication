import type { CustomerProfileDto } from "./api";

export type RentalType = "HOURLY" | "PACKAGE";
export type ReservationStatus = "DRAFT" | "DEPOSIT_PAID" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
export type DepositPaymentStatus = "NOT_REQUIRED" | "PENDING" | "PAID" | "EXPIRED";

export interface CustomerRegistrationRequest { phone: string; password: string; full_name: string; identity_number: string; }
export interface CustomerLoginRequest { phone: string; password: string; }
export interface CustomerRoomStay { room_id: string; expected_check_in: string; expected_check_out: string; }
export interface CustomerReservationCreateRequest { rental_type: RentalType; booking_source?: string; rooms: CustomerRoomStay[]; idempotency_key: string; }
export interface CustomerPaymentInstruction { payment_code: string; amount: number; status: DepositPaymentStatus; expires_at: string; instruction: string; }
export interface CustomerReservation { id: number; status: ReservationStatus; rental_type: RentalType; booking_source?: string; deposit_amount: number; booked_at: string; rooms: CustomerRoomStay[]; deposit_payment: CustomerPaymentInstruction; }
export interface CustomerVoucher { voucher_code: string; space_name: string; zone: string; floor: number; access_policy: string; membership_tier: string; visit_at: string; status: string; }
export interface CustomerVoucherRequest { space_id: string; visit_at: string; reservation_id?: number; }

export type CustomerMe = CustomerProfileDto;
