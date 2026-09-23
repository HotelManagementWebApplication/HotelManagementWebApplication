import { apiClient } from "./client";
import type { CustomerLoginRequest, CustomerProfileDto, EmployeeLoginRequest, EmployeeProfileDto, TokenResponseDto } from "../types/api";

export const authApi = {
  customerLogin: (body: CustomerLoginRequest) => apiClient.request<TokenResponseDto>("/api/auth/customers/login", { method: "POST", body }),
  employeeLogin: (body: EmployeeLoginRequest) => apiClient.request<TokenResponseDto>("/api/auth/login", { method: "POST", body }),
  employeeProfile: () => apiClient.request<EmployeeProfileDto>("/api/auth/me"),
  customerProfile: () => apiClient.request<CustomerProfileDto>("/api/auth/customers/me"),
  changePassword: (password: string) => apiClient.request<void>("/api/auth/me/password", { method: "POST", body: { password } }),
  logout: () => apiClient.logout(),
  sendRegistrationOtp: (email: string) =>
    apiClient.request<{ message: string; devOtp?: string }>("/api/auth/otp/send-register", {
      method: "POST",
      body: { email },
    }),
  sendForgotOtp: (email: string) =>
    apiClient.request<{ message: string; devOtp?: string }>("/api/auth/otp/send-forgot-password", {
      method: "POST",
      body: { email },
    }),
  resetPasswordWithOtp: (body: { email: string; otp: string; new_password: string }) =>
    apiClient.request<void>("/api/auth/customers/reset-password-otp", {
      method: "POST",
      body,
    }),
};
