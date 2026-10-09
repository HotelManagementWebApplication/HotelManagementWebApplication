import { useEffect, useState } from "react";
import type { RoleId } from "../shared/types/domain";
import { apiClient } from "../shared/api/client";
import { authApi } from "../shared/api/auth";
import { classifyAccount, formatAuthError } from "../shared/utils/authValidation";
import { resolveEmployeeDestination, staffAccounts, type View } from "./navigation/staffAccounts";
import { ScreenRouter } from "./navigation/ScreenRouter";
import { useCustomerSession } from "./session/useCustomerSession";

export default function App() {
  const [view, setView] = useState<View>("customer");
  const [role, setRole] = useState<RoleId>("reception");
  const [customerAuthenticated, setCustomerAuthenticated] = useCustomerSession();
  const [employeeSessionRestored, setEmployeeSessionRestored] = useState(
    () => apiClient.store.getIdentity?.() !== "employee",
  );

  useEffect(() => {
    if (apiClient.store.getIdentity?.() !== "employee" || !apiClient.store.get()?.access_token) {
      setEmployeeSessionRestored(true);
      return;
    }

    let active = true;
    authApi.employeeProfile()
      .then(profile => {
        if (!active) return;
        const destination = resolveEmployeeDestination(profile.role);
        setRole(destination.role);
        setView(destination.view);
      })
      .catch(() => {
        if (!active) return;
        apiClient.store.clear();
        setView("login");
      })
      .finally(() => {
        if (active) setEmployeeSessionRestored(true);
      });

    return () => { active = false; };
  }, []);

  const login = async (identity: string, password: string): Promise<string | null> => {
    const trimmed = identity.trim();
    const normalized = trimmed.toLowerCase();
    if (!trimmed || !password) return "Vui lòng nhập đầy đủ thông tin đăng nhập.";

    const account = classifyAccount(trimmed);
    if (!account.valid) return "Tài khoản không hợp lệ";

    // Customer accounts support both the registered phone number and email.
    // Email used to fall through to employee login and always failed.
    if (account.type === "phone" || account.type === "email") {
      try {
        // Keep the existing `phone` request field for API compatibility;
        // the backend now accepts either phone or email in this field.
        const token = await authApi.customerLogin({ phone: trimmed, password });
        if (token?.access_token) {
          apiClient.store.set(token);
          apiClient.store.setIdentity?.("customer");
          setCustomerAuthenticated(true);
          setView("customer");
          return null;
        }
      } catch (backendError) {
        console.warn("Backend customer login failed:", backendError);
        return formatAuthError(backendError);
      }
      return "Sai tài khoản hoặc mật khẩu";
    }

    const staffAccount = staffAccounts[normalized];
    const employeeId = staffAccount?.employeeId ?? trimmed.toUpperCase();

    try {
      const token = await authApi.employeeLogin({ employee_id: employeeId, password });
      if (token?.access_token) {
        apiClient.store.set(token);
        apiClient.store.setIdentity?.("employee");
        let profile: Awaited<ReturnType<typeof authApi.employeeProfile>>;
        try {
          profile = await authApi.employeeProfile();
        } catch (profileError) {
          apiClient.store.clear();
          return formatAuthError(profileError);
        }
        if (profile.role) {
          const destination = resolveEmployeeDestination(profile.role);
          setRole(destination.role);
          setView(destination.view);
          return null;
        }
        apiClient.store.clear();
        return "Không xác định được vai trò nhân viên. Vui lòng thử lại.";
      }
    } catch (backendError) {
      console.warn("Backend employee login failed:", backendError);
      apiClient.store.clear();
      return formatAuthError(backendError);
    }

    return "Sai tài khoản hoặc mật khẩu";
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

  if (!employeeSessionRestored) {
    return (
      <main
        className="min-h-screen flex items-center justify-center bg-[#f8f7f4] text-[#8c6d37]"
        role="status"
        aria-live="polite"
      >
        Đang khôi phục phiên đăng nhập…
      </main>
    );
  }

  return (
    <ScreenRouter
      view={view}
      role={role}
      customerAuthenticated={customerAuthenticated}
      onLogin={login}
      onCustomerBack={() => setView("customer")}
      onOpenLogin={() => setView("login")}
      onLogout={logoutToCustomer}
    />
  );
}
