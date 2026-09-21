import type { EmployeeRole } from "./api";

export type EmploymentStatus = "WORKING" | "ON_LEAVE" | "TERMINATED";
export type ShiftStatus = "ASSIGNED" | "STARTED" | "COMPLETED" | "CANCELLED";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "CONSUMED";

export interface EmployeeAdmin {
  employee_id: string;
  full_name: string;
  phone: string;
  address?: string | null;
  role: EmployeeRole;
  enabled: boolean;
  account_non_locked: boolean;
  failed_login_attempts: number;
  last_login_at?: string | null;
  last_failed_login_at?: string | null;
  employment_status: EmploymentStatus;
  leave_start?: string | null;
  leave_end?: string | null;
  email?: string | null;
  must_change_password?: boolean;
}

export interface EmployeeSession {
  id: number;
  employee_id: string;
  issued_at: string;
  expires_at: string;
  revoked_at?: string | null;
  family_id?: string | null;
}

export interface LoginEvent {
  id: number;
  employee_id: string;
  occurred_at: string;
  outcome: string;
}

export interface LoginHistoryPage {
  items: LoginEvent[];
  page: number;
  size: number;
  total_elements: number;
  total_pages: number;
}

export interface Shift {
  id: number;
  employee_id: string;
  shift_date: string;
  shift_code: string;
  starts_at: string;
  ends_at: string;
  status: ShiftStatus;
  created_by: string;
}

export interface ShiftInput {
  employee_id: string;
  shift_date: string;
  shift_code: string;
  starts_at: string;
  ends_at: string;
}

export interface ShiftUpdateInput {
  shift_date: string;
  shift_code: string;
  starts_at: string;
  ends_at: string;
}

export interface ShiftCoverage {
  shift_date: string;
  shift_code: string;
  minimum_staff: number;
  assigned_staff: number;
  shortage: number;
  understaffed: boolean;
}

export interface Approval {
  id: number;
  requester: string;
  action: string;
  target_id: string;
  payload: string;
  amount?: number | null;
  reason: string;
  risk: string;
  status: ApprovalStatus;
  approver?: string | null;
  decided_at?: string | null;
  expires_at: string;
  consumed_at?: string | null;
  requested_at: string;
  idempotency_key?: string | null;
}

export interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_data?: string | null;
  after_data?: string | null;
  reason?: string | null;
  correlation_key?: string | null;
  created_at: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total_elements: number;
  total_pages: number;
}

export type Collection<T> = T[] | Page<T>;
