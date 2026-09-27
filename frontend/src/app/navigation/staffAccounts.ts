import type { RoleId } from "../../shared/types/domain";

export type View =
  | "login"
  | "customer"
  | "frontdesk"
  | "housekeeping"
  | "kitchen"
  | "maintenance"
  | "accounting"
  | "manager"
  | "staff"
  | "hr"
  | "admin";

export interface StaffAccount {
  employeeId: string;
  role: RoleId;
  view: View;
  label: string;
}

export const staffAccounts: Record<string, StaffAccount> = {
  // Employee IDs accepted by the login form.
  frontdesk: { employeeId: "FRONTDESK", role: "reception", view: "frontdesk", label: "Lễ tân" },
  housekeep: { employeeId: "HOUSEKEEP", role: "housekeeping", view: "housekeeping", label: "Buồng phòng" },
  technical: { employeeId: "TECHNICAL", role: "maintenance", view: "maintenance", label: "Kỹ thuật" },
  accounting: { employeeId: "ACCOUNTING", role: "accounting", view: "accounting", label: "Kế toán" },
  kitchen: { employeeId: "KITCHEN", role: "fnb", view: "kitchen", label: "Bếp & Nhà hàng" },
  manager: { employeeId: "MANAGER", role: "manager", view: "manager", label: "Quản lý" },
  director: { employeeId: "DIRECTOR", role: "director", view: "manager", label: "Giám đốc" },
  admin: { employeeId: "ADMIN", role: "admin", view: "admin", label: "Quản trị hệ thống" },
  hr: { employeeId: "HR", role: "hr", view: "hr", label: "Nhân sự" },
  staff: { employeeId: "STAFF", role: "staff", view: "staff", label: "Nhân viên" },
  // Email aliases retained for existing login credentials.
  "frontdesk@hotel.com": { employeeId: "FRONTDESK", role: "reception", view: "frontdesk", label: "Lễ tân" },
  "housekeeping@hotel.com": { employeeId: "HOUSEKEEP", role: "housekeeping", view: "housekeeping", label: "Buồng phòng" },
  "technical@hotel.com": { employeeId: "TECHNICAL", role: "maintenance", view: "maintenance", label: "Kỹ thuật" },
  "accounting@hotel.com": { employeeId: "ACCOUNTING", role: "accounting", view: "accounting", label: "Kế toán" },
  "kitchen@hotel.com": { employeeId: "KITCHEN", role: "fnb", view: "kitchen", label: "Bếp & Nhà hàng" },
  "manager@hotel.com": { employeeId: "MANAGER", role: "manager", view: "manager", label: "Quản lý" },
  "director@hotel.com": { employeeId: "DIRECTOR", role: "director", view: "manager", label: "Giám đốc" },
  "admin@hotel.com": { employeeId: "ADMIN", role: "admin", view: "admin", label: "Quản trị hệ thống" },
  "hr@hotel.com": { employeeId: "HR", role: "hr", view: "hr", label: "Nhân sự" },
  "staff@hotel.com": { employeeId: "STAFF", role: "staff", view: "staff", label: "Nhân viên" },
};

const employeeRoleDestinations: Record<string, Pick<StaffAccount, "role" | "view">> = {
  FRONT_DESK: { role: "reception", view: "frontdesk" },
  HOUSEKEEPING: { role: "housekeeping", view: "housekeeping" },
  TECHNICAL: { role: "maintenance", view: "maintenance" },
  KITCHEN: { role: "fnb", view: "kitchen" },
  ACCOUNTING: { role: "accounting", view: "accounting" },
  MANAGER: { role: "manager", view: "manager" },
  DIRECTOR: { role: "director", view: "manager" },
  ADMIN: { role: "admin", view: "admin" },
  HR: { role: "hr", view: "hr" },
  STAFF: { role: "staff", view: "staff" },
};

export function resolveEmployeeDestination(role: string, fallback?: StaffAccount): Pick<StaffAccount, "role" | "view"> {
  if (employeeRoleDestinations[role]) return employeeRoleDestinations[role];
  if (fallback) return { role: fallback.role, view: fallback.view };
  return { role: "staff", view: "staff" };
}
