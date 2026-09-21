import { apiClient } from "./client";
import type { CustomerLoginRequest, CustomerMe, CustomerRegistrationRequest, CustomerReservation, CustomerReservationCreateRequest, CustomerPaymentInstruction, CustomerVoucher, CustomerVoucherRequest } from "../types/customer";
import type { TokenResponseDto } from "../types/api";

export const customerApi = {
  register: (body: CustomerRegistrationRequest) => apiClient.request<unknown>("/api/auth/customers/register", { method: "POST", body }),
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
  issueVoucher: (body: CustomerVoucherRequest) => apiClient.request<CustomerVoucher>("/api/customer/vouchers", { method: "POST", body }),
  changePassword: (password: string) => apiClient.request<void>("/api/auth/customers/password", { method: "POST", body: { password } }),
  updateProfile: (body: { full_name: string; identity_number: string; email?: string; address?: string; birth_year?: number }) =>
    apiClient.request<CustomerMe>("/api/auth/customers/me", { method: "PUT", body }),
};
