import { apiClient } from "./client";
import type { EmployeeRole } from "../types/api";

export type PersonnelDetails = {
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | "UNDISCLOSED" | null;
  birth_date: string | null;
  identity_number: string | null;
  hire_date: string | null;
  contract_type: "PROBATION" | "PERMANENT" | "FIXED_TERM" | "SEASONAL" | null;
};
export type PersonnelProfile = {
  employee_id: string; role: EmployeeRole; employment_status: "WORKING" | "ON_LEAVE" | "TERMINATED";
  enabled: boolean; details: PersonnelDetails; version: number; updated_at: string | null; updated_by: string | null;
};
export type OnboardingStatus = "DRAFT" | "PENDING" | "NEEDS_REVISION" | "REJECTED" | "APPROVED";
export type OnboardingRequest = {
  id: string; details: PersonnelDetails; proposed_role: EmployeeRole; reason: string;
  status: OnboardingStatus; requester: string; reviewer: string | null; decision_reason: string | null;
  employee_id: string | null; version: number; created_at: string; submitted_at: string | null;
  decided_at: string | null; can_edit: boolean; can_review: boolean;
};
export type OnboardingDecision = "APPROVE" | "REQUEST_REVISION" | "REJECT";
export const personnelApi = {
  profiles: () => apiClient.request<PersonnelProfile[]>("/api/hr/personnel/profiles"),
  profile: (id: string) => apiClient.request<PersonnelProfile>(`/api/hr/personnel/profiles/${encodeURIComponent(id)}`),
  update: (id: string, body: { details: PersonnelDetails; version: number; reason: string }, key: string) => apiClient.request<PersonnelProfile>(`/api/hr/personnel/profiles/${encodeURIComponent(id)}`, { method: "PUT", body, idempotencyKey: key }),
  requests: () => apiClient.request<OnboardingRequest[]>("/api/hr/personnel/onboarding"),
  save: (id: string, body: { details: PersonnelDetails; proposed_role: EmployeeRole; reason: string; version: number }, key: string) => apiClient.request<OnboardingRequest>(`/api/hr/personnel/onboarding/${id}`, { method: "PUT", body, idempotencyKey: key }),
  submit: (id: string, version: number, key: string) => apiClient.request<OnboardingRequest>(`/api/hr/personnel/onboarding/${id}/submit`, { method: "POST", body: { version }, idempotencyKey: key }),
  review: (id: string, body: { decision: OnboardingDecision; reason: string; version: number }, key: string) => apiClient.request<{ request: OnboardingRequest; temporary_password: string | null }>(`/api/hr/personnel/onboarding/${id}/review`, { method: "POST", body, idempotencyKey: key }),
};
