import { useEffect, useState, useMemo } from "react";
import { hrGovernanceApi, rows as apiRows } from "../shared/api/hrGovernance";
import { enterpriseApi } from "../shared/api/enterprise";
import { frontDeskApi } from "../shared/api/frontDesk";
import { authApi } from "../shared/api/auth";
import { EmployeeProfileDropdown } from "../components/common/EmployeeProfileDropdown";
import type { AuditEntry, EmployeeAdmin } from "../shared/types/hrGovernance";
import type { ServiceCatalogItem } from "../shared/types/frontDesk";
import type { EmployeeProfileDto } from "../shared/types/api";
import {
  LayoutDashboard,
  Users,
  Shield,
  FileText,
  Settings,
  Search,
  Bell,
  Calendar,
  Clock,
  Wifi,
  ShieldCheck,
  Server,
  Filter,
  Plus,
  Edit2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Key,
  Database,
  HardDrive,
  Cpu,
  Activity,
  LogOut,
  RefreshCw,
  Download,
  X,
  Check,
  Eye,
  Sliders,
  Terminal,
  Layers,
  Globe,
  Radio,
  Zap,
  Power
} from "lucide-react";

/* ══════════════════════════════════════════════════════════
   TYPES & INTERFACES
══════════════════════════════════════════════════════════ */
type AdminTab = "dashboard" | "accounts" | "roles" | "audit" | "settings";
type AccountSubTab = "list" | "roles" | "groups";

interface AccountItem {
  id: string;
  name: string;
  avatar: string;
  email: string;
  department: string;
  roleCode: "FRONT_DESK" | "MANAGER" | "HOUSEKEEPING" | "FNB_STAFF" | "ENGINEERING" | "HR" | "SALES" | "ACCOUNTING" | "TECHNICAL" | "DIRECTOR" | "STAFF" | "ADMIN";
  status: "Active" | "Locked";
  lastLogin: string;
  ip: string;
}

interface ActivityLogItem {
  id: string;
  time: string;
  email: string;
  action: string;
  ip?: string;
  badge: "Đăng nhập" | "Cập nhật" | "Hệ thống" | "Cảnh báo" | "Tạo mới";
  badgeColor: string;
}

interface ServiceStatusItem {
  name: string;
  statusText: string;
  isOnline: boolean;
}

interface RolePermissionItem {
  id: string;
  name: string;
  code: string;
  badgeColor: string;
  usersCount: number;
  permissions: {
    roomAccess: boolean;
    bookingManage: boolean;
    checkoutFinance: boolean;
    housekeepingOps: boolean;
    inventoryEdit: boolean;
    auditLogView: boolean;
    userAdmin: boolean;
  };
}

/* ══════════════════════════════════════════════════════════
   ROLE DEFINITIONS SCHEMA
══════════════════════════════════════════════════════════ */
const ROLE_DEFINITIONS: Omit<RolePermissionItem, "usersCount">[] = [
  {
    id: "role-admin",
    name: "Quản trị viên toàn quyền",
    code: "ADMIN",
    badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
    permissions: {
      roomAccess: true,
      bookingManage: true,
      checkoutFinance: true,
      housekeepingOps: true,
      inventoryEdit: true,
      auditLogView: true,
      userAdmin: true
    }
  },
  {
    id: "role-manager",
    name: "Quản lý khách sạn",
    code: "MANAGER",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
    permissions: {
      roomAccess: true,
      bookingManage: true,
      checkoutFinance: true,
      housekeepingOps: true,
      inventoryEdit: true,
      auditLogView: true,
      userAdmin: false
    }
  },
  {
    id: "role-frontdesk",
    name: "Nhân viên Lễ tân",
    code: "FRONT_DESK",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
    permissions: {
      roomAccess: true,
      bookingManage: true,
      checkoutFinance: true,
      housekeepingOps: false,
      inventoryEdit: false,
      auditLogView: false,
      userAdmin: false
    }
  },
  {
    id: "role-housekeeping",
    name: "Bộ phận Buồng phòng",
    code: "HOUSEKEEPING",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
    permissions: {
      roomAccess: true,
      bookingManage: false,
      checkoutFinance: false,
      housekeepingOps: true,
      inventoryEdit: false,
      auditLogView: false,
      userAdmin: false
    }
  },
  {
    id: "role-engineering",
    name: "Bộ phận Kỹ thuật & Bảo trì",
    code: "ENGINEERING",
    badgeColor: "bg-orange-100 text-orange-800 border-orange-300",
    permissions: {
      roomAccess: true,
      bookingManage: false,
      checkoutFinance: false,
      housekeepingOps: false,
      inventoryEdit: true,
      auditLogView: false,
      userAdmin: false
    }
  },
  {
    id: "role-fnb",
    name: "Nhân viên Bếp & F&B",
    code: "FNB_STAFF",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
    permissions: {
      roomAccess: false,
      bookingManage: false,
      checkoutFinance: false,
      housekeepingOps: false,
      inventoryEdit: true,
      auditLogView: false,
      userAdmin: false
    }
  },
  {
    id: "role-hr",
    name: "Chuyên viên Nhân sự",
    code: "HR",
    badgeColor: "bg-pink-100 text-pink-800 border-pink-300",
    permissions: {
      roomAccess: false,
      bookingManage: false,
      checkoutFinance: false,
      housekeepingOps: false,
      inventoryEdit: false,
      auditLogView: true,
      userAdmin: true
    }
  },
  {
    id: "role-sales",
    name: "Kinh doanh & Đặt phòng",
    code: "SALES",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-300",
    permissions: {
      roomAccess: true,
      bookingManage: true,
      checkoutFinance: false,
      housekeepingOps: false,
      inventoryEdit: false,
      auditLogView: false,
      userAdmin: false
    }
  }
];

/* ══════════════════════════════════════════════════════════
   PROPS
══════════════════════════════════════════════════════════ */
interface Props {
  onBack: () => void;
}

export default function AdminStation({ onBack }: Props) {
  // Navigation states
  const [currentTab, setCurrentTab] = useState<AdminTab>("accounts");
  const [accountSubTab, setAccountSubTab] = useState<AccountSubTab>("list");
  const [topProfileOpen, setTopProfileOpen] = useState(false);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);

  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Data states
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [catalogServices, setCatalogServices] = useState<ServiceCatalogItem[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<EmployeeProfileDto | null>(null);

  const rolesList: RolePermissionItem[] = useMemo(() => {
    return ROLE_DEFINITIONS.map(r => ({
      ...r,
      usersCount: accounts.filter(a => a.roleCode === r.code).length,
    }));
  }, [accounts]);

  // Modals
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountItem | null>(null);

  // New account form
  const [newAccountForm, setNewAccountForm] = useState({
    name: "",
    email: "",
    phone: "",
    department: "Lễ tân",
    roleCode: "FRONT_DESK" as AccountItem["roleCode"],
    status: "Active" as "Active" | "Locked"
  });

  // Settings states
  const [securitySettings, setSecuritySettings] = useState({
    mfaRequired: true,
    sessionTimeout: "30",
    passwordExpiryDays: "90",
    ipBruteforceLock: true,
    maintenanceMode: false
  });

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const activeAccounts = accounts.filter(account => account.status === "Active").length;
  const accountTotal = accounts.length;
  const accountPercent = accountTotal ? Math.round((activeAccounts / accountTotal) * 1000) / 10 : 0;

  useEffect(() => {
    let active = true;
    const mapRole = (role: EmployeeAdmin["role"]): AccountItem["roleCode"] => {
      if (role === "KITCHEN") return "FNB_STAFF";
      if (role === "TECHNICAL") return "ENGINEERING";
      if (role === "DIRECTOR" || role === "STAFF") return "ADMIN";
      return role as AccountItem["roleCode"];
    };
    const departmentFor = (role: EmployeeAdmin["role"]) => ({
      FRONT_DESK: "Lễ tân", HOUSEKEEPING: "Buồng phòng", KITCHEN: "Bếp & F&B", TECHNICAL: "Kỹ thuật",
      ACCOUNTING: "Kế toán", HR: "Nhân sự", MANAGER: "Ban quản lý", DIRECTOR: "Ban giám đốc", ADMIN: "CNTT", STAFF: "Vận hành",
    }[role] ?? "Vận hành");
    hrGovernanceApi.employees(true)
      .then(employees => {
        if (!active) return;
        setAccounts(employees.map((employee: EmployeeAdmin, index): AccountItem => ({
          id: employee.employee_id,
          name: employee.full_name,
          avatar: `https://images.unsplash.com/photo-${index % 2 === 0 ? "1534528741775-53994a69daeb" : "1507003211169-0a1dd7228f2d"}?w=150&auto=format&fit=crop&q=80`,
          email: `${employee.employee_id.toLowerCase()}@hotel.com`,
          department: departmentFor(employee.role),
          roleCode: mapRole(employee.role),
          status: employee.enabled && employee.account_non_locked ? "Active" : "Locked",
          lastLogin: employee.last_login_at ? new Date(employee.last_login_at).toLocaleString("vi-VN") : "Chưa đăng nhập",
          ip: "—",
        })));
      })
      .catch(err => { console.warn("Backend employee admin list unavailable:", err); if (active) setAccounts([]); });
    hrGovernanceApi.audit({ page: 0, size: 20 })
      .then(value => {
        const auditRows = apiRows<AuditEntry>(value);
        if (active) {
          setActivityLogs(auditRows.map((entry, index): ActivityLogItem => ({
            id: String(entry.id), time: new Date(entry.created_at).toLocaleString("vi-VN"), email: entry.actor,
            action: `${entry.action} · ${entry.entity_type}/${entry.entity_id}`,
            ip: entry.correlation_key ?? undefined,
            badge: index % 2 === 0 ? "Cập nhật" : "Hệ thống",
            badgeColor: index % 2 === 0 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200",
          })));
        }
      })
      .catch(err => { console.warn("Backend audit log unavailable:", err); if (active) setActivityLogs([]); });
    frontDeskApi.services()
      .then(services => { if (active) setCatalogServices(services); })
      .catch(err => { console.warn("Backend service catalog unavailable:", err); if (active) setCatalogServices([]); });
    authApi.employeeProfile()
      .then(p => { if (active) setUserProfile(p); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  /* ══════════════════════════════════════════════════════════
     HANDLERS
  ══════════════════════════════════════════════════════════ */
  const handleToggleSelectAccount = (id: string) => {
    setSelectedAccountIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllAccounts = () => {
    if (selectedAccountIds.length === filteredAccounts.length) {
      setSelectedAccountIds([]);
    } else {
      setSelectedAccountIds(filteredAccounts.map(a => a.id));
    }
  };

  const handleToggleAccountLock = async (account: AccountItem) => {
    const newStatus = account.status === "Active" ? "Locked" : "Active";
    try {
      await hrGovernanceApi.setStatus(account.id, newStatus === "Active");
      setAccounts(prev => prev.map(a => (a.id === account.id ? { ...a, status: newStatus } : a)));
      showToast(newStatus === "Locked" ? `Đã khóa tài khoản ${account.email}!` : `Đã mở khóa tài khoản ${account.email}!`);
    } catch (error) {
      console.warn("Unable to update employee status:", error);
      showToast("Không thể cập nhật trạng thái tài khoản trên backend.");
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountForm.name || !newAccountForm.email || !newAccountForm.phone) {
      alert("Vui lòng điền họ tên, email và số điện thoại.");
      return;
    }
    const roleMap: Record<AccountItem["roleCode"], string> = {
      FRONT_DESK: "FRONT_DESK", MANAGER: "MANAGER", HOUSEKEEPING: "HOUSEKEEPING",
      FNB_STAFF: "KITCHEN", ENGINEERING: "TECHNICAL", HR: "HR", SALES: "STAFF", ACCOUNTING: "ACCOUNTING", TECHNICAL: "TECHNICAL", DIRECTOR: "DIRECTOR", STAFF: "STAFF", ADMIN: "ADMIN",
    };
    try {
      const created = await enterpriseApi.autoProvisionEmployee({
        full_name: newAccountForm.name,
        role: roleMap[newAccountForm.roleCode] ?? "STAFF",
        phone: newAccountForm.phone,
        email: newAccountForm.email,
      });
      setAccounts(prev => [{
        id: created.employee_id,
        name: created.full_name,
        avatar: "",
        email: created.email,
        department: newAccountForm.department,
        roleCode: newAccountForm.roleCode,
        status: "Active",
        lastLogin: "Chưa đăng nhập",
        ip: "—",
      }, ...prev]);
      setIsAddAccountModalOpen(false);
      setNewAccountForm({ name: "", email: "", phone: "", department: "Lễ tân", roleCode: "FRONT_DESK", status: "Active" });
      showToast(`Đã tạo ${created.employee_id}. Mật khẩu tạm đã được hệ thống tự sinh: ${created.temporary_password}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể tạo tài khoản trên backend.");
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    try {
      const roleMap: Record<AccountItem["roleCode"], EmployeeAdmin["role"]> = {
        FRONT_DESK: "FRONT_DESK", MANAGER: "MANAGER", HOUSEKEEPING: "HOUSEKEEPING",
        FNB_STAFF: "KITCHEN", ENGINEERING: "TECHNICAL", HR: "HR", SALES: "STAFF", ACCOUNTING: "ACCOUNTING", TECHNICAL: "TECHNICAL", DIRECTOR: "DIRECTOR", STAFF: "STAFF", ADMIN: "ADMIN",
      };
      const updated = await hrGovernanceApi.setRole(editingAccount.id, roleMap[editingAccount.roleCode]);
      setAccounts(prev => prev.map(account => account.id === editingAccount.id ? {
        ...account,
        name: updated.full_name,
        roleCode: editingAccount.roleCode,
        status: updated.enabled && updated.account_non_locked ? "Active" : "Locked",
      } : account));
      setEditingAccount(null);
      showToast(`Đã cập nhật vai trò ${editingAccount.id} trên backend. Họ tên chỉ đọc theo hồ sơ nhân viên.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể cập nhật vai trò trên backend.");
    }
  };

  // Helper for role badge colors
  const getRoleBadge = (code: AccountItem["roleCode"]) => {
    switch (code) {
      case "FRONT_DESK":
        return { label: "FRONT_DESK", bg: "bg-blue-50 text-blue-700 border-blue-200" };
      case "MANAGER":
        return { label: "MANAGER", bg: "bg-purple-50 text-purple-700 border-purple-200" };
      case "HOUSEKEEPING":
        return { label: "HOUSEKEEPING", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case "FNB_STAFF":
        return { label: "FNB_STAFF", bg: "bg-amber-50 text-amber-700 border-amber-200" };
      case "ENGINEERING":
        return { label: "ENGINEERING", bg: "bg-orange-50 text-orange-700 border-orange-200" };
      case "HR":
        return { label: "HR", bg: "bg-pink-50 text-pink-700 border-pink-200" };
      case "SALES":
        return { label: "SALES", bg: "bg-sky-50 text-sky-700 border-sky-200" };
      case "ADMIN":
      default:
        return { label: "ADMIN", bg: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  };

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      if (filterDepartment !== "all" && acc.department !== filterDepartment) return false;
      if (filterRole !== "all" && acc.roleCode !== filterRole) return false;
      if (filterStatus !== "all" && acc.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          acc.name.toLowerCase().includes(q) ||
          acc.email.toLowerCase().includes(q) ||
          acc.department.toLowerCase().includes(q) ||
          acc.roleCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [accounts, filterDepartment, filterRole, filterStatus, searchQuery]);

  /* ══════════════════════════════════════════════════════════
     COMPONENTS
  ══════════════════════════════════════════════════════════ */

  // ── 1. DARK SIDEBAR (Exact match to reference mockup) ──
  const Sidebar = (
    <aside className="w-64 bg-[#0B132B] flex flex-col justify-between py-6 px-4 z-20 flex-shrink-0 text-gray-300">
      <div>
        {/* Logo & System Admin Title */}
        <div className="flex flex-col items-center text-center pb-6 border-b border-gray-800">
          <div className="w-10 h-10 flex items-center justify-center text-[#C5A059] mb-1">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9 text-[#C5A059]">
              <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z" />
            </svg>
          </div>
          <h2 className="font-serif font-bold text-base tracking-widest text-[#E5C178] uppercase">
            GRAND HOTEL
          </h2>
          <p className="text-[10px] tracking-wider text-gray-400 mt-0.5 font-sans">
            System Administration
          </p>
        </div>

        {/* Navigation Items */}
        <nav className="mt-5 space-y-1.5">
          <button
            onClick={() => setCurrentTab("dashboard")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              currentTab === "dashboard"
                ? "bg-[#2563EB] text-white font-semibold shadow-md shadow-blue-900/30"
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Tổng quan hệ thống</span>
          </button>

          <button
            onClick={() => setCurrentTab("accounts")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              currentTab === "accounts"
                ? "bg-[#2563EB] text-white font-semibold shadow-md shadow-blue-900/30"
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Quản lý tài khoản</span>
          </button>

          <button
            onClick={() => setCurrentTab("roles")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              currentTab === "roles"
                ? "bg-[#2563EB] text-white font-semibold shadow-md shadow-blue-900/30"
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Phân quyền Role</span>
          </button>

          <button
            onClick={() => setCurrentTab("audit")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              currentTab === "audit"
                ? "bg-[#2563EB] text-white font-semibold shadow-md shadow-blue-900/30"
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Nhật ký Audit Logs</span>
          </button>

          <button
            onClick={() => setCurrentTab("settings")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              currentTab === "settings"
                ? "bg-[#2563EB] text-white font-semibold shadow-md shadow-blue-900/30"
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Cấu hình hệ thống</span>
          </button>
        </nav>
      </div>

      {/* Admin Profile */}
      <div style={{ padding:"10px 0 0",borderTop:"1px solid rgba(255,255,255,0.1)",position:"relative" }}>
        <div
          onClick={() => setSidebarProfileOpen(p => !p)}
          style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer" }}
          title="Hồ sơ nhân viên"
        >
          <div style={{ width:30,height:30,borderRadius:99,flexShrink:0,
            background:"linear-gradient(135deg,#1D4ED8,#3B82F6)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:12,fontWeight:800,color:"#FFF" }}>AD</div>
          <div style={{ textAlign:"left" }}>
            <p style={{ fontSize:11,fontWeight:700,color:"#F8FAFC",lineHeight:1 }}>Quản trị viên</p>
            <p style={{ fontSize:10,color:"#94A3B8" }}>Quản trị hệ thống</p>
          </div>
        </div>
        <button onClick={onBack}
          style={{ display:"flex",alignItems:"center",gap:5,color:"#94A3B8",cursor:"pointer",fontSize:11,background:"transparent",border:"none",padding:0 }}>
          <LogOut size={11} /> Đăng xuất
        </button>
        <EmployeeProfileDropdown
          isOpen={sidebarProfileOpen}
          onClose={() => setSidebarProfileOpen(false)}
          onLogout={onBack}
          align="bottom-left"
          currentRoleLabel="Quản trị Hệ thống"
          departmentName="Trung tâm IT & Quản trị"
        />
      </div>
    </aside>
  );

  // ── 2. TOP HEADER ──
  const Header = (
    <header className="h-16 bg-white border-b border-gray-100 px-6 flex items-center justify-between z-30 flex-shrink-0">
      {/* Center/Left Search Box */}
      <div className="flex-1 max-w-md">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm tài khoản, email, phòng ban..."
            className="w-full bg-[#F5F6F8] hover:bg-[#EEF0F3] focus:bg-white text-gray-800 text-xs rounded-full pl-9 pr-4 py-2 border border-transparent focus:border-blue-500 focus:outline-none transition-all placeholder:text-gray-400 shadow-2xs"
          />
        </div>
      </div>

      {/* Right User Bar */}
      <div className="flex items-center gap-5">
        {/* Calendar & Clock */}
        <div className="flex items-center gap-2.5 text-right text-xs text-gray-600">
          <Calendar className="w-4 h-4 text-gray-400" />
          <div className="leading-tight">
            <p className="font-medium text-gray-700">{new Date().toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</p>
            <p className="text-[10px] text-gray-400 font-mono">Trực tuyến</p>
          </div>
        </div>

        <div className="h-4 w-px bg-gray-200" />

        {/* Bell notification */}
        <button
          onClick={() => showToast("Hệ thống bảo mật đang hoạt động an toàn, không có cảnh báo mới.")}
          className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors relative cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
        </button>

        {/* Admin profile */}
        <div className="relative">
          <div
            onClick={() => setTopProfileOpen(p => !p)}
            className="flex items-center gap-2.5 pl-1 cursor-pointer"
            title="Hồ sơ nhân viên"
          >
            <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold ring-2 ring-blue-600/20">
              {userProfile?.full_name ? userProfile.full_name.charAt(0) : "A"}
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-gray-900 leading-tight">{userProfile?.full_name || "Quản trị viên"}</p>
              <p className="text-[10px] text-gray-400 leading-tight">{userProfile?.role || "System Administrator"}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <EmployeeProfileDropdown
            isOpen={topProfileOpen}
            onClose={() => setTopProfileOpen(false)}
            onLogout={onBack}
            align="top-right"
            currentRoleLabel="Quản trị Hệ thống"
            departmentName="Trung tâm IT & Quản trị"
          />
        </div>
      </div>
    </header>
  );

  // ── 3. TOP 4 KPI CARDS (Exact match to reference mockup) ──
  const TopMetricCards = (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {/* 1. Tài khoản hoạt động */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-col justify-between">
        <div className="flex items-center gap-3.5 mb-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Tài khoản hoạt động</p>
            <p className="text-2xl font-bold text-gray-900 font-serif leading-tight">{activeAccounts} / {accountTotal}</p>
          </div>
        </div>
        {/* Progress bar + percentage */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${accountPercent}%` }} />
          </div>
          <span className="text-xs font-semibold text-emerald-600">{accountPercent}%</span>
        </div>
      </div>

      {/* 2. Phiên đăng nhập realtime */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
            <Wifi className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Phiên đăng nhập realtime</p>
            <p className="text-2xl font-bold text-gray-900 font-serif leading-tight">14</p>
            <span className="text-xs font-semibold text-emerald-600 inline-flex items-center gap-1 mt-0.5">
              ↑ 27%
            </span>
          </div>
        </div>
        {/* Sparkline curve */}
        <div className="w-16 h-8 text-blue-500">
          <svg viewBox="0 0 60 30" fill="none" className="w-full h-full stroke-current stroke-2">
            <path d="M0 24 Q15 26, 25 18 T45 12 T60 5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* 3. Sự cố bảo mật */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Sự cố bảo mật</p>
            <p className="text-2xl font-bold text-gray-900 font-serif leading-tight">0</p>
            <p className="text-xs text-gray-400 mt-0.5">Không có cảnh báo</p>
          </div>
        </div>
      </div>

      {/* 4. Uptime hệ thống */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Uptime hệ thống</p>
            <p className="text-2xl font-bold text-gray-900 font-serif leading-tight">—</p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">Theo dõi qua OS máy chủ</p>
          </div>
        </div>
        {/* Sparkline curve */}
        <div className="w-16 h-8 text-blue-500">
          <svg viewBox="0 0 60 30" fill="none" className="w-full h-full stroke-current stroke-2">
            <path d="M0 20 Q10 22, 20 15 T40 16 T60 8" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );

  // ── 4. TAB 2: QUẢN LÝ TÀI KHOẢN (EXACT MATCH TO REFERENCE SCREENSHOT) ──
  const AccountsManagementView = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Center Table Area (approx 8.5 cols) */}
      <div className="lg:col-span-8 xl:col-span-9 bg-white rounded-2xl border border-gray-100 shadow-xs p-5 flex flex-col justify-between">
        <div>
          {/* Sub-tabs & Action button */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-6 text-xs">
              <button
                onClick={() => setAccountSubTab("list")}
                className={`pb-2.5 font-bold transition-all relative cursor-pointer ${
                  accountSubTab === "list"
                    ? "text-[#2563EB] border-b-2 border-[#2563EB]"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Danh sách tài khoản
              </button>

              <button
                onClick={() => {
                  setAccountSubTab("roles");
                  setCurrentTab("roles");
                }}
                className={`pb-2.5 font-medium transition-all relative cursor-pointer ${
                  accountSubTab === "roles"
                    ? "text-[#2563EB] border-b-2 border-[#2563EB]"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Vai trò &amp; Quyền
              </button>

              <button
                onClick={() => setAccountSubTab("groups")}
                className={`pb-2.5 font-medium transition-all relative cursor-pointer ${
                  accountSubTab === "groups"
                    ? "text-[#2563EB] border-b-2 border-[#2563EB]"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Nhóm người dùng
              </button>
            </div>

            {/* + Thêm tài khoản button */}
            <button
              onClick={() => setIsAddAccountModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm tài khoản</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2.5 mb-4">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên, email, phòng ban..."
                className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500 shadow-2xs"
              />
            </div>

            {/* Department Dropdown */}
            <div className="relative">
              <select
                value={filterDepartment}
                onChange={e => setFilterDepartment(e.target.value)}
                className="appearance-none bg-white border border-gray-200 text-xs font-medium text-gray-700 rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
              >
                <option value="all">Tất cả phòng ban</option>
                <option value="Lễ tân">Lễ tân</option>
                <option value="Ban quản lý">Ban quản lý</option>
                <option value="Buồng phòng">Buồng phòng</option>
                <option value="Bếp & F&B">Bếp & F&B</option>
                <option value="Kỹ thuật">Kỹ thuật</option>
                <option value="Nhân sự">Nhân sự</option>
                <option value="Kinh doanh">Kinh doanh</option>
                <option value="CNTT">CNTT</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Role Dropdown */}
            <div className="relative">
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value)}
                className="appearance-none bg-white border border-gray-200 text-xs font-medium text-gray-700 rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
              >
                <option value="all">Tất cả vai trò</option>
                <option value="FRONT_DESK">FRONT_DESK</option>
                <option value="MANAGER">MANAGER</option>
                <option value="HOUSEKEEPING">HOUSEKEEPING</option>
                <option value="FNB_STAFF">FNB_STAFF</option>
                <option value="ENGINEERING">ENGINEERING</option>
                <option value="HR">HR</option>
                <option value="ACCOUNTING">ACCOUNTING</option>
                <option value="TECHNICAL">TECHNICAL</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="appearance-none bg-white border border-gray-200 text-xs font-medium text-gray-700 rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="Active">Active (Hoạt động)</option>
                <option value="Locked">Locked (Đã khóa)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Filter button */}
            <button
              onClick={() => {
                setFilterDepartment("all");
                setFilterRole("all");
                setFilterStatus("all");
                setSearchQuery("");
                showToast("Đã đặt lại bộ lọc tài khoản.");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs"
            >
              <Filter className="w-3.5 h-3.5 text-gray-500" />
              <span>Bộ lọc</span>
            </button>
          </div>

          {/* Accounts Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8F9FA] text-[11px] font-semibold text-gray-600 border-b border-gray-100">
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={
                        filteredAccounts.length > 0 &&
                        selectedAccountIds.length === filteredAccounts.length
                      }
                      onChange={handleSelectAllAccounts}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3">Nhân viên</th>
                  <th className="py-2.5 px-3">Email / Tên đăng nhập</th>
                  <th className="py-2.5 px-3">Phòng ban</th>
                  <th className="py-2.5 px-3">Vai trò</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  <th className="py-2.5 px-3">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredAccounts.map(account => {
                  const roleBadge = getRoleBadge(account.roleCode);
                  const isSelected = selectedAccountIds.includes(account.id);
                  return (
                    <tr
                      key={account.id}
                      className={`hover:bg-gray-50/70 transition-colors ${
                        isSelected ? "bg-blue-50/30" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectAccount(account.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Nhân viên */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={account.avatar}
                            alt={account.name}
                            className="w-7 h-7 rounded-full object-cover ring-1 ring-gray-200"
                          />
                          <span className="font-semibold text-gray-900 whitespace-nowrap">
                            {account.name}
                          </span>
                        </div>
                      </td>

                      {/* Email / Tên đăng nhập */}
                      <td className="py-3 px-3 font-mono text-[11px] text-gray-600">
                        {account.email}
                      </td>

                      {/* Phòng ban */}
                      <td className="py-3 px-3 text-gray-700">
                        {account.department}
                      </td>

                      {/* Vai trò */}
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${roleBadge.bg}`}
                        >
                          {roleBadge.label}
                        </span>
                      </td>

                      {/* Trạng thái */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                            account.status === "Active" ? "text-emerald-700" : "text-red-600"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              account.status === "Active" ? "bg-emerald-500" : "bg-red-500"
                            }`}
                          />
                          {account.status}
                        </span>
                      </td>

                      {/* Thao tác */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setEditingAccount(account)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-md transition-colors cursor-pointer shadow-2xs"
                          >
                            <Edit2 className="w-3 h-3 text-gray-400" />
                            <span>Chỉnh sửa</span>
                          </button>

                          <button
                            onClick={() => handleToggleAccountLock(account)}
                            title={account.status === "Active" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                            className="p-1 text-gray-400 hover:text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-md transition-colors cursor-pointer shadow-2xs"
                          >
                            {account.status === "Active" ? (
                              <Lock className="w-3 h-3 text-amber-600" />
                            ) : (
                              <Unlock className="w-3 h-3 text-emerald-600" />
                            )}
                          </button>

                          <button
                            onClick={() =>
                              showToast(`Tùy chọn nâng cao cho tài khoản: ${account.email}`)
                            }
                            className="p-1 text-gray-400 hover:text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-md transition-colors cursor-pointer shadow-2xs"
                          >
                            <MoreHorizontal className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Footer */}
        <div className="pt-4 mt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
          <p>Hiển thị {accountTotal === 0 ? 0 : 1} - {Math.min(8, accountTotal)} của {accountTotal} tài khoản</p>

          <div className="flex items-center gap-1">
            <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 cursor-pointer">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#2563EB] text-white font-bold cursor-pointer">
              1
            </button>
            <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 cursor-pointer">
              2
            </button>
            <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 cursor-pointer">
              3
            </button>
            <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 cursor-pointer">
              4
            </button>
            <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 cursor-pointer">
              5
            </button>
            <span className="px-1 text-gray-400">...</span>
            <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 cursor-pointer">
              9
            </button>
            <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 cursor-pointer">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative">
            <select className="appearance-none bg-white border border-gray-200 rounded-lg pl-2.5 pr-6 py-1 text-xs text-gray-700 cursor-pointer focus:outline-none">
              <option>10 / trang</option>
              <option>20 / trang</option>
              <option>50 / trang</option>
            </select>
            <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Right Column: Activity Logs & System Status (approx 3.5 cols) */}
      <div className="lg:col-span-4 xl:col-span-3 space-y-5">
        {/* Card 1: Nhật ký hoạt động hệ thống */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 font-serif">
              Nhật ký hoạt động hệ thống
            </h3>
            <button
              onClick={() => setCurrentTab("audit")}
              className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-0.5"
            >
              <span>Xem tất cả</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3.5 text-xs">
            {activityLogs.map((log, index) => (
              <div key={log.id} className="flex items-start gap-2.5 relative">
                {/* Timeline vertical connector */}
                {index < activityLogs.length - 1 && (
                  <div className="absolute left-[7px] top-4 bottom-[-14px] w-0.5 bg-gray-100" />
                )}

                {/* Status Dot */}
                <span
                  className={`w-3.5 h-3.5 rounded-full mt-0.5 flex-shrink-0 z-10 flex items-center justify-center ${
                    log.badge === "Cảnh báo"
                      ? "bg-red-100 text-red-600"
                      : log.badge === "Tạo mới"
                      ? "bg-teal-100 text-teal-600"
                      : "bg-emerald-100 text-emerald-600"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      log.badge === "Cảnh báo"
                        ? "bg-red-500"
                        : log.badge === "Tạo mới"
                        ? "bg-teal-500"
                        : "bg-emerald-500"
                    }`}
                  />
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-mono text-gray-400">{log.time}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${log.badgeColor}`}
                    >
                      {log.badge}
                    </span>
                  </div>

                  <p className="font-semibold text-gray-800 text-[11px] truncate mt-0.5">
                    {log.email}
                  </p>
                  <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{log.action}</p>

                  {log.ip && (
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">IP: {log.ip}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Trạng thái hệ thống */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 font-serif">
              Trạng thái hệ thống
            </h3>
            <button
              onClick={() => setCurrentTab("dashboard")}
              className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-0.5"
            >
              <span>Xem chi tiết</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mb-3.5 flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50/70 p-2 rounded-xl border border-emerald-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Tất cả dịch vụ đang hoạt động</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {catalogServices.map(srv => (
              <div key={srv.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-gray-700 font-medium">{srv.name}</span>
                </div>
                <span className="text-emerald-600 font-medium text-[11px]">{srv.active === false ? "Tạm ngưng" : srv.stock <= 0 ? "Hết tồn kho" : "Đang hoạt động"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ── 5. TAB 1: TỔNG QUAN HỆ THỐNG (SYSTEM OVERVIEW & TELEMETRY) ──
  const SystemOverviewView = (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-6 text-white relative overflow-hidden shadow-sm">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider mb-2">
            ● Hệ thống lõi Grand Hotel MIS Online
          </span>
          <h2 className="text-2xl font-serif font-bold text-white mb-1">
            Trung tâm kiểm soát &amp; Giám sát hạ tầng
          </h2>
          <p className="text-blue-100/80 text-xs leading-relaxed">
            Hệ thống đang hoạt động với {accountTotal} tài khoản nhân sự ({activeAccounts} đang kích hoạt). Giám sát truy cập và phân quyền bảo mật thời gian thực.
          </p>
        </div>
        <div className="absolute right-4 -bottom-6 w-48 h-48 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
      </div>

      {TopMetricCards}

      {/* Server Telemetry Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span className="font-semibold text-gray-700">CPU Usage</span>
            <Cpu className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 font-serif">—</p>
          <div className="w-full h-2 rounded-full bg-gray-100 mt-2 overflow-hidden">
            <div className="h-full rounded-full bg-blue-600" style={{ width: "0%" }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">Chưa cấu hình telemetry hạ tầng</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span className="font-semibold text-gray-700">RAM Memory</span>
            <Activity className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 font-serif">—</p>
          <div className="w-full h-2 rounded-full bg-gray-100 mt-2 overflow-hidden">
            <div className="h-full rounded-full bg-purple-600" style={{ width: "0%" }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">Giám sát qua OS máy chủ</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span className="font-semibold text-gray-700">NVMe SSD Storage</span>
            <HardDrive className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 font-serif">—</p>
          <div className="w-full h-2 rounded-full bg-gray-100 mt-2 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: "0%" }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">Lưu trữ backend CSDL</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span className="font-semibold text-gray-700">Kết nối mạng</span>
            <Radio className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 font-serif">Online</p>
          <div className="w-full h-2 rounded-full bg-gray-100 mt-2 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: "100%" }} />
          </div>
          <p className="text-[10px] text-emerald-600 font-medium mt-1.5">API Spring Boot hoạt động</p>
        </div>
      </div>

      {/* Database Backup & Active Realtime Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif font-bold text-gray-900 text-sm">
              Sao lưu dữ liệu tự động (Backup Database)
            </h3>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              Hoạt động tốt
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">Snapshot CSDL định kỳ</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Quản lý trực tiếp qua máy chủ CSDL PostgreSQL</p>
              </div>
              <button
                onClick={() => showToast("Đã kích hoạt sao lưu tức thì snapshot cơ sở dữ liệu!")}
                className="px-3 py-1.5 bg-white hover:bg-gray-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
              >
                Sao lưu ngay
              </button>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">Khôi phục điểm phục hồi (Disaster Recovery)</p>
                <p className="text-[11px] text-gray-400 mt-0.5">RPO: 15 phút • RTO: 5 phút</p>
              </div>
              <span className="text-xs font-mono font-bold text-gray-600">Sẵn sàng</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-gray-900 text-sm">
                Phân bố nhân sự theo phòng ban
              </h3>
              <span className="text-xs text-blue-600 font-bold">{activeAccounts} Hoạt động</span>
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                { name: "Bộ phận Lễ tân", dept: "Lễ tân", color: "bg-blue-500" },
                { name: "Bộ phận Buồng phòng", dept: "Buồng phòng", color: "bg-emerald-500" },
                { name: "Bộ phận Bếp & F&B", dept: "Bếp & F&B", color: "bg-amber-500" },
                { name: "Ban quản lý & Giám đốc", dept: "Ban quản lý", color: "bg-purple-500" },
                { name: "Bộ phận Kỹ thuật", dept: "Kỹ thuật", color: "bg-orange-500" },
                { name: "Bộ phận Kế toán", dept: "Kế toán", color: "bg-emerald-600" },
                { name: "Bộ phận Nhân sự", dept: "Nhân sự", color: "bg-pink-500" },
                { name: "Quản trị viên CNTT", dept: "CNTT", color: "bg-slate-700" },
              ].map(item => {
                const count = accounts.filter(a => a.department === item.dept).length;
                return (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${item.color}`} />
                      <span className="text-gray-700">{item.name}</span>
                    </div>
                    <span className="font-bold text-gray-900 font-mono">{count} tài khoản</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-gray-100 text-right">
            <button
              onClick={() => setCurrentTab("accounts")}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Quản lý chi tiết từng tài khoản →
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── 6. TAB 3: PHÂN QUYỀN ROLE (ROLE & PERMISSION MATRIX) ──
  const RolesPermissionView = (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-serif font-bold text-gray-900 text-base">
            Ma trận phân quyền vai trò (Role-Based Access Control)
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Cấu hình quyền hạn chi tiết cho từng nhóm tài khoản theo đúng quy chế an ninh dữ liệu khách sạn
          </p>
        </div>

        <button
          onClick={() => showToast("Chức năng thêm vai trò tùy chỉnh (Custom Role) sẵn sàng.")}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm vai trò mới</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8F9FA] text-[11px] font-semibold text-gray-600 border-b border-gray-100 uppercase">
                <th className="py-3 px-4">Mã Role</th>
                <th className="py-3 px-4">Tên vai trò</th>
                <th className="py-3 px-4 text-center">Số User</th>
                <th className="py-3 px-4 text-center">Đặt phòng &amp; Check-in</th>
                <th className="py-3 px-4 text-center">Thu ngân / Trả phòng</th>
                <th className="py-3 px-4 text-center">Nhiệm vụ dọn phòng</th>
                <th className="py-3 px-4 text-center">Kho &amp; Minibar</th>
                <th className="py-3 px-4 text-center">Audit Logs</th>
                <th className="py-3 px-4 text-center">Cấu hình hệ thống</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rolesList.map(role => (
                <tr key={role.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold">
                    <span className={`px-2 py-0.5 rounded border text-[10px] ${role.badgeColor}`}>
                      {role.code}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-gray-900">{role.name}</td>
                  <td className="py-3.5 px-4 text-center font-mono font-semibold text-gray-700">
                    {role.usersCount}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {role.permissions.roomAccess ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {role.permissions.checkoutFinance ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {role.permissions.housekeepingOps ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {role.permissions.inventoryEdit ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {role.permissions.auditLogView ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {role.permissions.userAdmin ? (
                      <CheckCircle2 className="w-4 h-4 text-purple-600 mx-auto" />
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ── 7. TAB 4: NHẬT KÝ AUDIT LOGS (SECURITY LOGS) ──
  const AuditLogsView = (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-serif font-bold text-gray-900 text-sm">
            Nhật ký truy vết bảo mật (System Audit Trail)
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Lưu vết tất cả thao tác nhạy cảm, đăng nhập và sửa đổi dữ liệu phòng/giá
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => showToast("Đang xuất nhật ký Audit Logs ra file CSV...")}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Xuất Audit CSV</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8F9FA] text-[11px] font-semibold text-gray-600 border-b border-gray-100 uppercase">
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Người thực hiện</th>
                <th className="py-3 px-4">Hành động / Sự kiện</th>
                <th className="py-3 px-4">Địa chỉ IP</th>
                <th className="py-3 px-4 text-center">Phân loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activityLogs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50/70">
                  <td className="py-3.5 px-4 font-mono text-[11px] text-gray-600">{log.time}</td>
                  <td className="py-3.5 px-4 font-semibold text-gray-900">{log.email}</td>
                  <td className="py-3.5 px-4 text-gray-700">{log.action}</td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500">
                    {log.ip || "192.168.1.1"}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${log.badgeColor}`}>
                      {log.badge}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ── 8. TAB 5: CẤU HÌNH HỆ THỐNG (SYSTEM CONFIGURATION) ──
  const SystemSettingsView = (
    <div className="space-y-5 max-w-4xl">
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
        <h3 className="font-serif font-bold text-gray-900 text-base mb-1">
          Chính sách bảo mật &amp; Đăng nhập
        </h3>
        <p className="text-xs text-gray-400 mb-5">
          Quy định xác thực, thời gian phiên làm việc và bảo vệ mật khẩu cho toàn bộ khách sạn
        </p>

        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <div>
              <p className="font-semibold text-gray-800">Bắt buộc xác thực 2 yếu tố (2FA / OTP)</p>
              <p className="text-gray-400 text-[11px] mt-0.5">Áp dụng cho tài khoản Quản lý, Kế toán và CNTT</p>
            </div>
            <input
              type="checkbox"
              checked={securitySettings.mfaRequired}
              onChange={e => {
                setSecuritySettings({ ...securitySettings, mfaRequired: e.target.checked });
                showToast("Đã cập nhật chính sách 2FA.");
              }}
              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <div>
              <p className="font-semibold text-gray-800">Tự động đăng xuất phiên không hoạt động (Timeout)</p>
              <p className="text-gray-400 text-[11px] mt-0.5">Khóa màn hình làm việc khi nhân viên rời quầy</p>
            </div>
            <select
              value={securitySettings.sessionTimeout}
              onChange={e => {
                setSecuritySettings({ ...securitySettings, sessionTimeout: e.target.value });
                showToast(`Đã đổi thời gian timeout thành ${e.target.value} phút.`);
              }}
              className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
            >
              <option value="15">15 phút</option>
              <option value="30">30 phút (Khuyến nghị)</option>
              <option value="60">60 phút</option>
              <option value="120">2 giờ</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <div>
              <p className="font-semibold text-gray-800">Bảo vệ chống Brute-force mật khẩu</p>
              <p className="text-gray-400 text-[11px] mt-0.5">Tự động khóa IP và tài khoản sau 5 lần nhập sai liên tiếp</p>
            </div>
            <input
              type="checkbox"
              checked={securitySettings.ipBruteforceLock}
              onChange={e => {
                setSecuritySettings({ ...securitySettings, ipBruteforceLock: e.target.checked });
                showToast("Đã cập nhật tính năng chống dò mật khẩu.");
              }}
              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-red-50/60 border border-red-100">
            <div>
              <p className="font-semibold text-red-900">Chế độ bảo trì hệ thống (Maintenance Mode)</p>
              <p className="text-red-600/80 text-[11px] mt-0.5">Tạm dừng truy cập toàn bộ ngoại trừ tài khoản Quản trị viên</p>
            </div>
            <button
              onClick={() => {
                const next = !securitySettings.maintenanceMode;
                setSecuritySettings({ ...securitySettings, maintenanceMode: next });
                showToast(next ? "ĐÃ BẬT CHẾ ĐỘ BẢO TRÌ HỆ THỐNG!" : "Đã tắt chế độ bảo trì.");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                securitySettings.maintenanceMode
                  ? "bg-red-600 text-white"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {securitySettings.maintenanceMode ? "Đang bật bảo trì" : "Bật bảo trì"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════
     MODALS
  ══════════════════════════════════════════════════════════ */

  // Modal: Add Account
  const AddAccountModal = isAddAccountModalOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
          <div>
            <h3 className="font-serif font-bold text-gray-900 text-base">Thêm tài khoản người dùng mới</h3>
            <p className="text-xs text-gray-400 mt-0.5">Cấp tài khoản đăng nhập vào hệ thống khách sạn</p>
          </div>
          <button
            onClick={() => setIsAddAccountModalOpen(false)}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreateAccount} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Họ và tên nhân viên *</label>
            <input
              type="text"
              required
              value={newAccountForm.name}
              onChange={e => setNewAccountForm({ ...newAccountForm, name: e.target.value })}
              placeholder="VD: Nguyễn Thị Mai"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Email / Tên đăng nhập *</label>
            <input
              type="email"
              required
              value={newAccountForm.email}
              onChange={e => setNewAccountForm({ ...newAccountForm, email: e.target.value })}
              placeholder="nguyen.thi.mai@hotel.com"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Số điện thoại *</label>
            <input
              type="tel"
              required
              value={newAccountForm.phone}
              onChange={e => setNewAccountForm({ ...newAccountForm, phone: e.target.value })}
              placeholder="0901 234 567"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Phòng ban</label>
              <select
                value={newAccountForm.department}
                onChange={e => setNewAccountForm({ ...newAccountForm, department: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="Lễ tân">Lễ tân</option>
                <option value="Ban quản lý">Ban quản lý</option>
                <option value="Buồng phòng">Buồng phòng</option>
                <option value="Bếp & F&B">Bếp & F&B</option>
                <option value="Kỹ thuật">Kỹ thuật</option>
                <option value="Nhân sự">Nhân sự</option>
                <option value="Kinh doanh">Kinh doanh</option>
                <option value="CNTT">CNTT</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Vai trò hệ thống</label>
              <select
                value={newAccountForm.roleCode}
                onChange={e => setNewAccountForm({ ...newAccountForm, roleCode: e.target.value as any })}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="FRONT_DESK">FRONT_DESK</option>
                <option value="MANAGER">MANAGER</option>
                <option value="HOUSEKEEPING">HOUSEKEEPING</option>
                <option value="FNB_STAFF">FNB_STAFF</option>
                <option value="ENGINEERING">ENGINEERING</option>
                <option value="HR">HR</option>
                <option value="ACCOUNTING">ACCOUNTING</option>
                <option value="TECHNICAL">TECHNICAL</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-blue-800">
            Hệ thống tự sinh mật khẩu tạm và bắt buộc nhân viên đổi mật khẩu ở lần đăng nhập đầu tiên.
          </div>

          <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddAccountModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg cursor-pointer shadow-xs"
            >
              Tạo tài khoản
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Modal: Edit Account
  const EditAccountModal = editingAccount && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
          <div>
            <h3 className="font-serif font-bold text-gray-900 text-base">Chỉnh sửa tài khoản</h3>
            <p className="text-xs text-gray-400 mt-0.5">{editingAccount.email}</p>
          </div>
          <button
            onClick={() => setEditingAccount(null)}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleUpdateAccount} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Họ và tên</label>
            <input
              type="text"
              required
              value={editingAccount.name}
              onChange={e => setEditingAccount({ ...editingAccount, name: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Phòng ban</label>
              <input
                type="text"
                value={editingAccount.department}
                onChange={e => setEditingAccount({ ...editingAccount, department: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Vai trò</label>
              <select
                value={editingAccount.roleCode}
                onChange={e => setEditingAccount({ ...editingAccount, roleCode: e.target.value as any })}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="FRONT_DESK">FRONT_DESK</option>
                <option value="MANAGER">MANAGER</option>
                <option value="HOUSEKEEPING">HOUSEKEEPING</option>
                <option value="FNB_STAFF">FNB_STAFF</option>
                <option value="ENGINEERING">ENGINEERING</option>
                <option value="HR">HR</option>
                <option value="ACCOUNTING">ACCOUNTING</option>
                <option value="TECHNICAL">TECHNICAL</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Trạng thái tài khoản</label>
            <select
              value={editingAccount.status}
              onChange={e => setEditingAccount({ ...editingAccount, status: e.target.value as any })}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="Active">Active (Hoạt động bình thường)</option>
              <option value="Locked">Locked (Khóa đăng nhập)</option>
            </select>
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                showToast(`Đã gửi email khôi phục mật khẩu tới ${editingAccount.email}!`);
              }}
              className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
            >
              Reset mật khẩu
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-gray-100 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg cursor-pointer shadow-xs"
              >
                Lưu
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════
     MAIN RETURN
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-screen bg-[#F5F6F8] font-sans overflow-hidden text-gray-900">
      {/* 1. TOP HEADER */}
      {Header}

      {/* 2. BODY CONTAINER */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        {Sidebar}

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[1440px] mx-auto">
            {/* Page Title & Subtitle */}
            <div className="mb-5">
              <h1 className="text-2xl font-serif font-bold text-gray-900">
                {currentTab === "accounts" && "Quản lý tài khoản"}
                {currentTab === "dashboard" && "Tổng quan hệ thống"}
                {currentTab === "roles" && "Phân quyền Role"}
                {currentTab === "audit" && "Nhật ký Audit Logs"}
                {currentTab === "settings" && "Cấu hình hệ thống"}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {currentTab === "accounts" && "Quản trị người dùng, phân quyền và bảo mật hệ thống khách sạn."}
                {currentTab === "dashboard" && "Giám sát hiệu năng máy chủ, phiên hoạt động và tính khả dụng của dịch vụ."}
                {currentTab === "roles" && "Cấu hình ma trận phân quyền chi tiết cho từng vai trò nhân sự."}
                {currentTab === "audit" && "Truy vết nhật ký hoạt động người dùng và cảnh báo an ninh."}
                {currentTab === "settings" && "Chính sách mật khẩu, thời gian timeout phiên và bảo vệ chống xâm nhập."}
              </p>
            </div>

            {/* TAB CONTENT */}
            {currentTab === "accounts" && (
              <>
                {TopMetricCards}
                {AccountsManagementView}
              </>
            )}

            {currentTab === "dashboard" && SystemOverviewView}
            {currentTab === "roles" && RolesPermissionView}
            {currentTab === "audit" && AuditLogsView}
            {currentTab === "settings" && SystemSettingsView}
          </div>
        </main>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs flex items-center gap-2.5 animate-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Modals */}
      {AddAccountModal}
      {EditAccountModal}
    </div>
  );
}
