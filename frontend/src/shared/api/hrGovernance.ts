import { apiClient } from "./client";
import type { EmployeeRole } from "../types/api";
import type { Approval, AuditEntry, Collection, EmployeeAdmin, EmployeeSession, LoginHistoryPage, Shift, ShiftCoverage, ShiftInput, ShiftStatus, ShiftUpdateInput, EmploymentStatus } from "../types/hrGovernance";

const query = (params: Record<string, string | number | undefined>) => {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== "");
  const encoded = new URLSearchParams(entries.map(([name, value]) => [name, String(value)] as [string, string])).toString();
  return encoded ? `?${encoded}` : "";
};

export const hrGovernanceApi = {
  employees: (includeInactive = false) => apiClient.request<EmployeeAdmin[]>(`/api/auth/employees${query({ includeInactive: includeInactive ? "true" : undefined })}`),
  employee: (employeeId: string) => apiClient.request<EmployeeAdmin>(`/api/auth/employees/${encodeURIComponent(employeeId)}`),
  sessions: (employeeId: string) => apiClient.request<EmployeeSession[]>(`/api/auth/employees/${encodeURIComponent(employeeId)}/sessions`),
  loginHistory: (employeeId: string, page = 0, size = 20) => apiClient.request<LoginHistoryPage>(`/api/auth/employees/${encodeURIComponent(employeeId)}/login-history${query({ page, size })}`),
  revokeSession: (employeeId: string, sessionId: number) => apiClient.request<void>(`/api/auth/employees/${encodeURIComponent(employeeId)}/sessions/${sessionId}`, { method: "DELETE" }),
  setStatus: (employeeId: string, enabled: boolean) => apiClient.request<EmployeeAdmin>(`/api/auth/employees/${encodeURIComponent(employeeId)}/status`, { method: "PATCH", body: { enabled } }),
  setEmployment: (employeeId: string, status: EmploymentStatus, leaveStart?: string, leaveEnd?: string) => apiClient.request<EmployeeAdmin>(`/api/auth/employees/${encodeURIComponent(employeeId)}/employment`, { method: "PATCH", body: { status, leave_start: leaveStart || null, leave_end: leaveEnd || null } }),
  setRole: (employeeId: string, role: EmployeeRole) => apiClient.request<EmployeeAdmin>(`/api/auth/employees/${encodeURIComponent(employeeId)}/role`, { method: "PATCH", body: { role } }),
  resetPassword: (employeeId: string, password: string) => apiClient.request<void>(`/api/auth/employees/${encodeURIComponent(employeeId)}/password`, { method: "POST", body: { password } }),

  shifts: (params: { date?: string; to?: string; employeeId?: string } = {}) => apiClient.request<Shift[]>(`/api/hr/shifts${query(params)}`),
  coverage: (params: { date?: string; shiftCode: string; minimum_staff: number }) => apiClient.request<ShiftCoverage>(`/api/hr/shifts/coverage${query(params)}`),
  assignShift: (body: ShiftInput) => apiClient.request<Shift>("/api/hr/shifts", { method: "POST", body }),
  updateShift: (id: number, body: ShiftUpdateInput) => apiClient.request<Shift>(`/api/hr/shifts/${id}`, { method: "PUT", body }),
  setShiftStatus: (id: number, status: ShiftStatus) => apiClient.request<Shift>(`/api/hr/shifts/${id}/status`, { method: "PATCH", body: { status } }),

  approvals: (status = "PENDING") => apiClient.request<Collection<Approval>>(`/api/governance/approvals${query({ status })}`),
  approve: (id: number) => apiClient.request<Approval>(`/api/governance/approvals/${id}/approve`, { method: "POST" }),
  reject: (id: number) => apiClient.request<Approval>(`/api/governance/approvals/${id}/reject`, { method: "POST" }),
  audit: (params: { action?: string; entity_type?: string; entity_id?: string; correlation_key?: string; from?: string; to?: string; page?: number; size?: number } = {}) => apiClient.request<Collection<AuditEntry>>(`/api/governance/audit${query(params)}`),
};

export const rows = <T,>(value: Collection<T> | undefined): T[] => Array.isArray(value) ? value : value?.items ?? [];

