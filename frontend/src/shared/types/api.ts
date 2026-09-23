/** Exact employee roles exposed by the backend EmployeeRole enum. */
export const EMPLOYEE_ROLES = [
  "MANAGER", "FRONT_DESK", "HOUSEKEEPING", "TECHNICAL", "KITCHEN",
  "ACCOUNTING", "DIRECTOR", "ADMIN", "HR", "STAFF",
] as const;
export type EmployeeRole = typeof EMPLOYEE_ROLES[number];

export type AuthIdentity = "customer" | "employee";
/** Exact permission authorities exposed by the backend Permission enum. */
export const PERMISSION_CODES = [
  "EMPLOYEE_READ", "EMPLOYEE_PROVISION", "EMPLOYEE_PASSWORD_RESET", "SHIFT_READ", "SHIFT_WRITE",
  "ROOM_READ", "ROOM_WRITE", "ROOM_CATALOG_WRITE", "ROOM_ADMIN_READ", "ROOM_ADMIN_WRITE", "EQUIPMENT_READ", "EQUIPMENT_WRITE",
  "GUEST_READ", "GUEST_WRITE",
  "RESERVATION_READ", "RESERVATION_CREATE", "RESERVATION_WRITE", "RESERVATION_CHECKOUT", "RESERVATION_SERVICE_WRITE", "RESTAURANT_ORDER_READ", "RESTAURANT_ORDER_WRITE",
  "INCIDENT_WRITE", "FRONT_DESK_DASHBOARD", "HOUSEKEEPING_TASK_READ", "HOUSEKEEPING_TASK_WRITE", "HOUSEKEEPING_TASK_ASSIGN",
  "INCIDENT_HANDOFF", "TECHNICAL_WORK_ORDER_READ", "TECHNICAL_WORK_ORDER_WRITE", "TECHNICAL_WORK_ORDER_ACCEPT", "TECHNICAL_WORK_ORDER_RELEASE",
  "BILLING_READ", "BILLING_WRITE", "PAYMENT_WRITE", "SERVICE_READ", "SERVICE_WRITE", "INVENTORY_READ", "INVENTORY_WRITE",
  "SERVICE_PRICE_REQUEST", "SERVICE_PRICE_ACTIVATE", "NOTIFICATION_READ", "NOTIFICATION_WRITE", "MAINTENANCE_READ", "MAINTENANCE_WRITE",
  "CASH_HANDOVER_WRITE", "FINANCE_READ", "FINANCE_WRITE", "APPROVAL_REQUEST", "APPROVAL_APPROVE", "AUDIT_READ",
] as const;
export type PermissionCode = typeof PERMISSION_CODES[number];
export interface EmployeeLoginRequest { employee_id: string; password: string; }
export interface CustomerLoginRequest { phone: string; password: string; }
export interface TokenResponseDto { access_token: string; refresh_token: string; token_type: string; expires_in: number; refresh_expires_in: number; }
export interface RefreshRequestDto { refresh_token: string; }
export interface LogoutRequestDto { refresh_token?: string; }

export interface EmployeeProfileDto { employee_id: string; full_name: string; role: EmployeeRole; permissions: PermissionCode[]; }
export interface CustomerAccountDto { id: number; guest_id: number; phone: string; enabled: boolean; account_non_locked: boolean; }
export interface CustomerGuestDto {
  id: number; full_name: string; birth_year?: number; identity_number: string; phone: string; email?: string; address?: string;
  membership_tier: string; total_spend: number; late_cancellation_count: number; late_checkout_count: number; booking_blocked: boolean;
}
export interface CustomerProfileDto { account: CustomerAccountDto; guest: CustomerGuestDto; }
export interface SessionDto {
  identity: AuthIdentity;
  customer?: CustomerProfileDto;
  employee?: EmployeeProfileDto;
  employee_profile_status?: "verified" | "blocked";
  employee_profile_error?: string;
}
export interface ApiErrorDto {
  timestamp?: string;
  status?: number;
  code?: string;
  message?: string;
  details?: string[];
}
