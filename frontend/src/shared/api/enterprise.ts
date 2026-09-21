import { apiClient } from "./client";
import type { AttendanceInput, AttendanceRecord, LeaveRequest, LeaveRequestInput, OtaReconciliation, StockItem, StockMovementInput, TechnicalAsset, TechnicalAssetInput, VatInvoice, VatInvoiceRequest } from "../types/enterprise";

export const enterpriseApi = {
  ota: () => apiClient.request<OtaReconciliation[]>("/api/finance/ota-reconciliation"),
  updateOtaStatus: (reservationId: number, status: string) => apiClient.request<OtaReconciliation>(`/api/finance/ota-reconciliation/${reservationId}`, { method: "PATCH", body: { status } }),
  vatInvoices: () => apiClient.request<VatInvoice[]>("/api/finance/vat-invoices"),
  createVat: (body: VatInvoiceRequest) => apiClient.request<VatInvoice>("/api/finance/vat-invoices", { method: "POST", body }),
  vatXml: async (id: number) => {
    const token = apiClient.store.get()?.access_token;
    const response = await fetch(`${apiClient.baseUrl}/api/finance/vat-invoices/${id}/xml`, { headers: { Accept: "application/xml", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    if (!response.ok) throw new Error(`Không thể xuất XML VAT (${response.status})`);
    return response.text();
  },
  attendance: (date?: string) => apiClient.request<AttendanceRecord[]>(`/api/hr/attendance${date ? `?date=${encodeURIComponent(date)}` : ""}`),
  importAttendance: (records: AttendanceInput[]) => apiClient.request<AttendanceRecord[]>("/api/hr/attendance/import", { method: "POST", body: { records } }),
  leaves: (status?: string) => apiClient.request<LeaveRequest[]>(`/api/hr/leave-requests${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  createLeave: (body: LeaveRequestInput) => apiClient.request<LeaveRequest>("/api/hr/leave-requests", { method: "POST", body }),
  approveLeave: (id: number) => apiClient.request<LeaveRequest>(`/api/hr/leave-requests/${id}/approve`, { method: "POST" }),
  rejectLeave: (id: number) => apiClient.request<LeaveRequest>(`/api/hr/leave-requests/${id}/reject`, { method: "POST" }),
  linen: () => apiClient.request<StockItem[]>("/api/operations/linen"),
  moveLinen: (body: StockMovementInput) => apiClient.request<StockItem>("/api/operations/linen/movements", { method: "POST", body }),
  assets: () => apiClient.request<TechnicalAsset[]>("/api/operations/assets"),
  createAsset: (body: TechnicalAssetInput) => apiClient.request<TechnicalAsset>("/api/operations/assets", { method: "POST", body }),
  updateAssetStatus: (id: string, status: string) => apiClient.request<TechnicalAsset>(`/api/operations/assets/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status } }),
  autoProvisionEmployee: (body: { full_name: string; role: string; phone: string; email: string; address?: string }) => apiClient.request<{ employee_id: string; full_name: string; role: string; phone: string; email: string; temporary_password: string; must_change_password: boolean }>("/api/auth/employees/auto-provision", { method: "POST", body }),
  changeOwnPassword: (password: string) => apiClient.request<void>("/api/auth/me/password", { method: "POST", body: { password } }),
};
