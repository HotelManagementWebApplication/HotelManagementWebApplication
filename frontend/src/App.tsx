import { useState, useEffect } from "react";
import type { RoleId } from "./types";
import LoginPage from "./pages/LoginPage";
import CustomerPortal from "./pages/CustomerPortal";
import StaffPortal from "./pages/StaffPortal";
import FrontDeskPMS from "./pages/FrontDeskPMS";
import HousekeepingStation from "./pages/HousekeepingStation";
import KitchenInventory from "./pages/KitchenInventory";
import MaintenanceStation from "./pages/MaintenanceStation";
import AccountingStation from "./pages/AccountingStation";
import ManagerDashboard from "./pages/ManagerDashboard";
import HRStation from "./pages/HRStation";
import AdminStation from "./pages/AdminStation";
import { authApi } from "./shared/api/auth";
import { customerApi } from "./shared/api/customer";
import { apiClient } from "./shared/api/client";

type View =
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

export const staffAccounts: Record<string, { employeeId: string; role: RoleId; view: View; label: string }> = {
  // Mã nhân viên thật trong CSDL
  "frontdesk": { employeeId: "FRONTDESK", role: "reception", view: "frontdesk", label: "Lễ tân" },
  "housekeep": { employeeId: "HOUSEKEEP", role: "housekeeping", view: "housekeeping", label: "Buồng phòng" },
  "technical": { employeeId: "TECHNICAL", role: "maintenance", view: "maintenance", label: "Kỹ thuật" },
  "accounting": { employeeId: "ACCOUNTING", role: "accounting", view: "accounting", label: "Kế toán" },
  "kitchen": { employeeId: "KITCHEN", role: "fnb", view: "kitchen", label: "Bếp & Minibar" },
  "manager": { employeeId: "MANAGER", role: "manager", view: "manager", label: "Quản lý" },
  "director": { employeeId: "DIRECTOR", role: "director", view: "manager", label: "Giám đốc" },
  "admin": { employeeId: "ADMIN", role: "admin", view: "admin", label: "Quản trị hệ thống" },
  "hr": { employeeId: "HR", role: "hr", view: "hr", label: "Nhân sự" },
  "staff": { employeeId: "STAFF", role: "staff", view: "staff", label: "Nhân viên" },
  // Email tương thích
  "frontdesk@hotel.com": { employeeId: "FRONTDESK", role: "reception", view: "frontdesk", label: "Lễ tân" },
  "housekeeping@hotel.com": { employeeId: "HOUSEKEEP", role: "housekeeping", view: "housekeeping", label: "Buồng phòng" },
  "technical@hotel.com": { employeeId: "TECHNICAL", role: "maintenance", view: "maintenance", label: "Kỹ thuật" },
  "accounting@hotel.com": { employeeId: "ACCOUNTING", role: "accounting", view: "accounting", label: "Kế toán" },
  "kitchen@hotel.com": { employeeId: "KITCHEN", role: "fnb", view: "kitchen", label: "Bếp & Minibar" },
  "manager@hotel.com": { employeeId: "MANAGER", role: "manager", view: "manager", label: "Quản lý" },
  "director@hotel.com": { employeeId: "DIRECTOR", role: "director", view: "manager", label: "Giám đốc" },
  "admin@hotel.com": { employeeId: "ADMIN", role: "admin", view: "admin", label: "Quản trị hệ thống" },
  "hr@hotel.com": { employeeId: "HR", role: "hr", view: "hr", label: "Nhân sự" },
  "staff@hotel.com": { employeeId: "STAFF", role: "staff", view: "staff", label: "Nhân viên" },
};

export default function App() {
  const [view, setView] = useState<View>("customer");
  const [role, setRole] = useState<RoleId>("reception");
  const [customerAuthenticated, setCustomerAuthenticated] = useState<boolean>(() => {
    const token = apiClient.store.get()?.access_token;
    const identity = apiClient.store.getIdentity?.();
    return Boolean(token && identity === "customer");
  });

  useEffect(() => {
    const token = apiClient.store.get()?.access_token;
    const identity = apiClient.store.getIdentity?.();
    if (token && identity === "customer") {
      authApi
        .customerProfile()
        .then(() => setCustomerAuthenticated(true))
        .catch(() => {
          setCustomerAuthenticated(false);
          apiClient.store.clear();
        });
    }
  }, []);

  const login = async (identity: string, password: string): Promise<string | null> => {
    const trimmed = identity.trim();
    const normalized = trimmed.toLowerCase();
    if (!trimmed || !password) return "Vui lòng nhập đầy đủ thông tin đăng nhập.";

    // 1. Khách hàng: số điện thoại thật trong cơ sở dữ liệu
    const isPhone = /^(0|\+84)\d{8,11}$/.test(trimmed) || /^\d{9,11}$/.test(trimmed);
    if (isPhone) {
      try {
        const tokenRes = await authApi.customerLogin({ phone: trimmed, password });
        if (tokenRes?.access_token) {
          apiClient.store.set(tokenRes);
          apiClient.store.setIdentity?.("customer");
          setCustomerAuthenticated(true);
          setView("customer");
          return null;
        }
      } catch (backendError) {
        console.warn("Backend customer login failed:", backendError);
        return backendError instanceof Error ? backendError.message : "Số điện thoại hoặc mật khẩu không chính xác.";
      }
      return "Số điện thoại hoặc mật khẩu không chính xác.";
    }

    // 2. Nhân viên: Mã nhân viên (FRONTDESK, MANAGER, ADMIN...) hoặc email trong CSDL
    const account = staffAccounts[normalized];
    const employeeId = account?.employeeId ?? trimmed.toUpperCase();

    try {
      const tokenRes = await authApi.employeeLogin({ employee_id: employeeId, password });
      if (tokenRes?.access_token) {
        apiClient.store.set(tokenRes);
        apiClient.store.setIdentity?.("employee");
        try {
          const profile = await authApi.employeeProfile();
          if (profile?.role) {
            const roleMap: Record<string, { role: RoleId; view: View }> = {
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
            const mapped = roleMap[profile.role] ?? account ?? { role: "staff", view: "staff" };
            setRole(mapped.role);
            setView(mapped.view);
            return null;
          }
        } catch {
          // Profile call fallback
        }
        return null;
      }
    } catch (backendError) {
      console.warn("Backend employee login failed:", backendError);
      return backendError instanceof Error ? backendError.message : "Mã nhân viên hoặc mật khẩu không chính xác.";
    }

    return "Thông tin đăng nhập không chính xác.";
  };

  const logoutToCustomer = async () => {
    try {
      await authApi.logout();
    } catch {
      apiClient.store.clear();
    }
    setCustomerAuthenticated(false);
    setView("customer");
  };

  if (view === "login") return <LoginPage onLogin={login} onBack={() => setView("customer")} />;
  if (view === "frontdesk") return <FrontDeskPMS onBack={logoutToCustomer} />;
  if (view === "housekeeping") return <HousekeepingStation onBack={logoutToCustomer} />;
  if (view === "kitchen") return <KitchenInventory onBack={logoutToCustomer} />;
  if (view === "maintenance") return <MaintenanceStation onBack={logoutToCustomer} />;
  if (view === "accounting") return <AccountingStation onBack={logoutToCustomer} />;
  if (view === "manager") return <ManagerDashboard role={role === "director" ? "director" : "manager"} onBack={logoutToCustomer} />;
  if (view === "hr" || (view === "staff" && role === "hr")) return <HRStation onBack={logoutToCustomer} />;
  if (view === "admin" || (view === "staff" && role === "admin")) return <AdminStation onBack={logoutToCustomer} />;
  if (view === "staff") return <StaffPortal role={role} onBack={logoutToCustomer} />;
  return (
    <CustomerPortal
      onBack={() => setView("customer")}
      onLogin={() => setView("login")}
      onLogout={logoutToCustomer}
      isAuthenticated={customerAuthenticated}
    />
  );
}
