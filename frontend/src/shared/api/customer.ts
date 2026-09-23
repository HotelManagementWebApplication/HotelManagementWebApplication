import { apiClient } from "./client";
import type { CustomerLoginRequest, CustomerMe, CustomerRegistrationRequest, CustomerReservation, CustomerReservationCreateRequest, CustomerPaymentInstruction, HotelServiceBooking, HotelServiceBookingRequest } from "../types/customer";
import type { TokenResponseDto } from "../types/api";

export const customerApi = {
  register: (body: CustomerRegistrationRequest) =>
    body.otp
      ? apiClient.request<unknown>("/api/auth/customers/register-with-otp", { method: "POST", body })
      : apiClient.request<unknown>("/api/auth/customers/register", { method: "POST", body }),
  registerWithOtp: (body: CustomerRegistrationRequest) =>
    apiClient.request<unknown>("/api/auth/customers/register-with-otp", { method: "POST", body }),
  login: (body: CustomerLoginRequest) => apiClient.request<TokenResponseDto>("/api/auth/customers/login", { method: "POST", body }),
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
  cancelReservation: (id: number, reason: string, key: string) => apiClient.request<CustomerReservation>(`/api/customer/reservations/${id}/cancel`, { method: "POST", body: { reason }, idempotencyKey: key }),
  bookService: (body: HotelServiceBookingRequest, key: string) => apiClient.request<HotelServiceBooking>("/api/customer/service-bookings", { method: "POST", body, idempotencyKey: key }),
  serviceBookings: (reservationId: number) => apiClient.request<HotelServiceBooking[]>(`/api/customer/service-bookings?reservation_id=${reservationId}`),
  cancelServiceBooking: (id: number) => apiClient.request<HotelServiceBooking>(`/api/customer/service-bookings/${id}/cancel`, { method: "POST" }),
  changePassword: (password: string) => apiClient.request<void>("/api/auth/customers/password", { method: "POST", body: { password } }),
  updateProfile: (body: { full_name: string; identity_number: string; email?: string; address?: string; birth_year?: number }) =>
    apiClient.request<CustomerMe>("/api/auth/customers/me", { method: "PUT", body }),
};
