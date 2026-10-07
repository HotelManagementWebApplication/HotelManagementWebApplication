import { apiClient } from "./client";
import type { CustomerLoginRequest, CustomerMe, CustomerRegistrationRequest, CustomerReservation, CustomerReservationCreateRequest, CustomerPaymentInstruction, CustomerStayChangeRequest, HotelServiceBooking, HotelServiceBookingRequest, VnpayCheckout, VnpayPaymentAttempt } from "../types/customer";
import type { TokenResponseDto } from "../types/api";

export const customerApi = {
  register: (body: CustomerRegistrationRequest) =>
    body.otp
      ? apiClient.request<unknown>("/api/auth/customers/register-with-otp", { method: "POST", body, skipAuth: true })
      : apiClient.request<unknown>("/api/auth/customers/register", { method: "POST", body, skipAuth: true }),
  registerWithOtp: (body: CustomerRegistrationRequest) =>
    apiClient.request<unknown>("/api/auth/customers/register-with-otp", { method: "POST", body, skipAuth: true }),
  login: (body: CustomerLoginRequest) => apiClient.request<TokenResponseDto>("/api/auth/customers/login", { method: "POST", body, skipAuth: true }),
  me: () => apiClient.request<CustomerMe>("/api/auth/customers/me"),
  reservations: () => apiClient.request<CustomerReservation[]>("/api/customer/reservations"),
  reservation: async (id: number) => {
    if (!Number.isSafeInteger(id) || id <= 0) throw new TypeError("reservation ID must be a positive integer");
    return apiClient.request<CustomerReservation>(`/api/customer/reservations/${id}`);
  },
  depositPayment: async (id: number) => {
    if (!Number.isSafeInteger(id) || id <= 0) throw new TypeError("reservation ID must be a positive integer");
    return apiClient.request<CustomerPaymentInstruction>(`/api/customer/reservations/${id}/deposit-payment`);
  },
  createReservation: (body: CustomerReservationCreateRequest) => apiClient.request<CustomerReservation>("/api/customer/reservations", { method: "POST", body, idempotencyKey: body.idempotency_key }),
  createVnpayCheckout: async (reservationId: number) => {
    if (!Number.isSafeInteger(reservationId) || reservationId <= 0) throw new TypeError("reservation ID must be a positive integer");
    return apiClient.request<VnpayCheckout>(`/api/customer/reservations/${reservationId}/vnpay-payments`, { method: "POST" });
  },
  latestVnpayPayment: async (reservationId: number) => {
    if (!Number.isSafeInteger(reservationId) || reservationId <= 0) throw new TypeError("reservation ID must be a positive integer");
    return apiClient.request<VnpayPaymentAttempt>(`/api/customer/reservations/${reservationId}/vnpay-payments/latest`);
  },
  cancelReservation: (id: number, reason: string, key: string) => apiClient.request<CustomerReservation>(`/api/customer/reservations/${id}/cancel`, { method: "POST", body: { reason }, idempotencyKey: key }),
  changeReservationStay: (id: number, body: CustomerStayChangeRequest, key: string) => apiClient.request<CustomerReservation>(`/api/customer/reservations/${id}/stay-change`, { method: "POST", body, idempotencyKey: key }),
  bookService: (body: HotelServiceBookingRequest, key: string) => apiClient.request<HotelServiceBooking>("/api/customer/service-bookings", { method: "POST", body, idempotencyKey: key }),
  serviceBookings: (reservationId: number) => apiClient.request<HotelServiceBooking[]>(`/api/customer/service-bookings?reservation_id=${reservationId}`),
  cancelServiceBooking: (id: number) => apiClient.request<HotelServiceBooking>(`/api/customer/service-bookings/${id}/cancel`, { method: "POST" }),
  changePassword: (password: string) => apiClient.request<void>("/api/auth/customers/password", { method: "POST", body: { password } }),
  updateProfile: (body: { full_name: string; identity_number: string; email?: string; address?: string; birth_year?: number }) =>
    apiClient.request<CustomerMe>("/api/auth/customers/me", { method: "PUT", body }),
};
