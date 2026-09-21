import { apiClient } from "./client";
import type { CustomerLoginRequest, CustomerProfileDto, EmployeeLoginRequest, EmployeeProfileDto, TokenResponseDto } from "../types/api";

export const authApi = {
  customerLogin: (body: CustomerLoginRequest) => apiClient.request<TokenResponseDto>("/api/auth/customers/login", { method: "POST", body }),
  employeeLogin: (body: EmployeeLoginRequest) => apiClient.request<TokenResponseDto>("/api/auth/login", { method: "POST", body }),
  employeeProfile: () => apiClient.request<EmployeeProfileDto>("/api/auth/me"),
  customerProfile: () => apiClient.request<CustomerProfileDto>("/api/auth/customers/me"),
  changePassword: (password: string) => apiClient.request<void>("/api/auth/me/password", { method: "POST", body: { password } }),
  logout: () => apiClient.logout(),
};
