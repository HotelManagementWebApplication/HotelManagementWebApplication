import type { CustomerProfileDto } from "./api";

export type RentalType = "HOURLY" | "PACKAGE";
export type ReservationStatus = "DRAFT" | "DEPOSIT_PAID" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
export type DepositPaymentStatus = "NOT_REQUIRED" | "PENDING" | "PAID" | "EXPIRED";
export type CustomerPaymentMethod = "VNPAY" | "PAY_AT_HOTEL";
export type VnpayPaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "EXPIRED" | "CANCELLED";

export interface CustomerRegistrationRequest { phone: string; password: string; full_name: string; identity_number: string; email?: string; otp?: string; }
export interface CustomerLoginRequest { phone: string; password: string; }
export interface CustomerRoomStay {
  room_id: string;
  room_name?: string;
  room_type_name?: string;
  unit_price?: number;
  total_price?: number;
  expected_check_in: string;
  expected_check_out: string;
  guest_count?: number;
}
export interface CustomerReservationCreateRequest { rental_type: RentalType; booking_source?: string; rooms: CustomerRoomStay[]; idempotency_key: string; payment_method: CustomerPaymentMethod; confirmation_email?: string; }
export interface CustomerPaymentInstruction { payment_code: string; amount: number; status: DepositPaymentStatus; expires_at: string; instruction: string; }
export interface VnpayCheckout {
  attempt_id: number;
  reservation_id: number;
  transaction_reference: string;
  amount: number;
  status: VnpayPaymentStatus;
  expires_at: string;
  payment_url: string;
}
export interface VnpayPaymentAttempt {
  attempt_id: number;
  reservation_id: number;
  transaction_reference: string;
  amount: number;
  status: VnpayPaymentStatus;
  expires_at: string;
  response_code?: string | null;
}
export interface CustomerReservation {
  id: number;
  status: ReservationStatus;
  rental_type: RentalType;
  booking_source?: string;
  deposit_amount: number;
  total_amount?: number;
  booked_at: string;
  rooms: CustomerRoomStay[];
  deposit_payment: CustomerPaymentInstruction;
  cancellation_reason?: string | null;
  cancellation_outcome?: "REFUND" | "RETAIN" | "FORFEIT" | null;
  services?: HotelServiceBooking[];
}
export interface HotelServiceBookingRequest { reservation_id: number; room_id: string; service_id: string; scheduled_at: string; quantity: number; meal_period?: "LUNCH" | "DINNER"; note?: string; }
export interface HotelServiceBooking {
  id: number;
  reservation_id: number;
  room_id: string;
  service_id: string;
  service_name?: string;
  scheduled_at: string;
  quantity: number;
  free_quantity: number;
  unit_price: number;
  amount_due: number;
  meal_period: "LUNCH" | "DINNER" | null;
  status: "CONFIRMED" | "USED" | "CANCELLED";
  note: string | null;
}

export type CustomerMe = CustomerProfileDto;
