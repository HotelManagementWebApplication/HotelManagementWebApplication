import type { RoleId } from "../../shared/types/domain";
import type { View } from "./staffAccounts";
import LoginPage from "../../features/auth/LoginPage";
import CustomerPortal from "../../features/customer/CustomerPortal";
import FrontDeskPMS from "../../features/front-desk/FrontDeskPMS";
import HousekeepingStation from "../../features/housekeeping/HousekeepingStation";
import KitchenInventory from "../../features/kitchen-inventory/KitchenInventory";
import MaintenanceStation from "../../features/maintenance/MaintenanceStation";
import AccountingStation from "../../features/accounting/AccountingStation";
import ManagerDashboard from "../../features/management/ManagerDashboard";
import HRStation from "../../features/hr/HRStation";
import AdminStation from "../../features/admin/AdminStation";
import StaffPortal from "../../features/staff-portal/StaffPortal";

interface ScreenRouterProps {
  view: View;
  role: RoleId;
  customerAuthenticated: boolean;
  onLogin: (identity: string, password: string) => Promise<string | null>;
  onCustomerBack: () => void;
  onOpenLogin: () => void;
  onLogout: () => Promise<void>;
}

export function ScreenRouter({
  view,
  role,
  customerAuthenticated,
  onLogin,
  onCustomerBack,
  onOpenLogin,
  onLogout,
}: ScreenRouterProps) {
  if (view === "login") return <LoginPage onLogin={onLogin} onBack={onCustomerBack} />;
  if (view === "frontdesk") return <FrontDeskPMS onBack={onLogout} />;
  if (view === "housekeeping") return <HousekeepingStation onBack={onLogout} />;
  if (view === "kitchen") return <KitchenInventory onBack={onLogout} />;
  if (view === "maintenance") return <MaintenanceStation onBack={onLogout} />;
  if (view === "accounting") return <AccountingStation onBack={onLogout} />;
  if (view === "manager") return <ManagerDashboard role={role === "director" ? "director" : "manager"} onBack={onLogout} />;
  if (view === "hr" || (view === "staff" && role === "hr")) return <HRStation onBack={onLogout} />;
  if (view === "admin" || (view === "staff" && role === "admin")) return <AdminStation onBack={onLogout} />;
  if (view === "staff") return <StaffPortal role={role} onBack={onLogout} />;

  return (
    <CustomerPortal
      onBack={onCustomerBack}
      onLogin={onOpenLogin}
      onLogout={onLogout}
      isAuthenticated={customerAuthenticated}
    />
  );
}
