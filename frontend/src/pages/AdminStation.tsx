import { useEffect, useState, useMemo } from "react";
import { hrGovernanceApi, rows as apiRows } from "../shared/api/hrGovernance";
import { enterpriseApi } from "../shared/api/enterprise";
import { frontDeskApi } from "../shared/api/frontDesk";
import { authApi } from "../shared/api/auth";
import { EmployeeProfileDropdown } from "../components/common/EmployeeProfileDropdown";
import type { AuditEntry, EmployeeAdmin } from "../shared/types/hrGovernance";
import type { ServiceCatalogItem } from "../shared/types/frontDesk";
import { EMPLOYEE_ROLES, type EmployeeProfileDto, type EmployeeRole } from "../shared/types/api";
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

interface AccountItem {
  id: string;
  name: string;
  email: string | null;
  department: string;
  roleCode: EmployeeRole;
  status: "Active" | "Locked" | "Disabled";
  employmentStatus: EmployeeAdmin["employment_status"];
}

interface ActivityLogItem {
  id: string;
  time: string;
  actor: string;
  action: string;
  entity: string;
}

interface RolePermissionItem {
  name: string;
  code: string;
  usersCount: number;
}

const ROLE_META: Record<EmployeeRole, { name: string; department: string; badgeColor: string }> = {
  MANAGER: { name: "Quản lý", department: "Ban quản lý", badgeColor: "bg-violet-50 text-violet-700 border-violet-200" },
  FRONT_DESK: { name: "Lễ tân", department: "Lễ tân", badgeColor: "bg-blue-50 text-blue-700 border-blue-200" },
  HOUSEKEEPING: { name: "Buồng phòng", department: "Buồng phòng", badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  TECHNICAL: { name: "Kỹ thuật", department: "Kỹ thuật", badgeColor: "bg-orange-50 text-orange-700 border-orange-200" },
  KITCHEN: { name: "Bếp & F&B", department: "Bếp & F&B", badgeColor: "bg-amber-50 text-amber-700 border-amber-200" },
  ACCOUNTING: { name: "Kế toán", department: "Kế toán", badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  DIRECTOR: { name: "Giám đốc", department: "Ban giám đốc", badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  ADMIN: { name: "Quản trị hệ thống", department: "CNTT", badgeColor: "bg-slate-100 text-slate-700 border-slate-200" },
  HR: { name: "Nhân sự", department: "Nhân sự", badgeColor: "bg-pink-50 text-pink-700 border-pink-200" },
  STAFF: { name: "Nhân viên", department: "Vận hành", badgeColor: "bg-stone-100 text-stone-700 border-stone-200" },
};

type LoadState = "loading" | "ready" | "error";
const toAccountItem = (employee: EmployeeAdmin): AccountItem => ({
  id: employee.employee_id,
  name: employee.full_name,
  email: employee.email || null,
  department: ROLE_META[employee.role].department,
  roleCode: employee.role,
  status: !employee.enabled ? "Disabled" : !employee.account_non_locked ? "Locked" : "Active",
  employmentStatus: employee.employment_status,
});

/* ══════════════════════════════════════════════════════════
   PROPS
══════════════════════════════════════════════════════════ */
interface Props {
  onBack: () => void;
}

export default function AdminStation({ onBack }: Props) {
  // Navigation states
  const [currentTab, setCurrentTab] = useState<AdminTab>("dashboard");
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
  const [userProfile, setUserProfile] = useState<EmployeeProfileDto | null>(null);
  const [loadState, setLoadState] = useState({ employees: "loading" as LoadState, audit: "loading" as LoadState, services: "loading" as LoadState, profile: "loading" as LoadState });
  const [refreshKey, setRefreshKey] = useState(0);

  const rolesList: RolePermissionItem[] = useMemo(() => {
    const counts = new Map<EmployeeRole, number>();
    accounts.forEach(account => counts.set(account.roleCode, (counts.get(account.roleCode) ?? 0) + 1));
    return [...counts.entries()].map(([code, usersCount]) => ({ code, name: ROLE_META[code].name, usersCount }))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [accounts]);

  // Modals
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountItem | null>(null);

  // New account form
  const [newAccountForm, setNewAccountForm] = useState({
    name: "",
    email: "",
    phone: "",
    roleCode: "FRONT_DESK" as EmployeeRole,
  });

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const activeAccounts = accounts.filter(account => account.status === "Active").length;
  const disabledAccounts = accounts.filter(account => account.status === "Disabled").length;
  const lockedAccounts = accounts.filter(account => account.status === "Locked").length;
  const accountTotal = accounts.length;
  const accountPercent = accountTotal ? Math.round((activeAccounts / accountTotal) * 1000) / 10 : 0;

  useEffect(() => {
    let active = true;
    hrGovernanceApi.employees(true)
      .then(employees => {
        if (!active) return;
        setAccounts(employees.map(toAccountItem));
        setLoadState(current => ({ ...current, employees: "ready" }));
      })
      .catch(err => { console.warn("Backend employee admin list unavailable:", err); if (active) { setAccounts([]); setLoadState(current => ({ ...current, employees: "error" })); } });
    hrGovernanceApi.audit({ page: 0, size: 20 })
      .then(value => {
        const auditRows = apiRows<AuditEntry>(value);
        if (active) {
          setActivityLogs(auditRows.map((entry): ActivityLogItem => ({
            id: String(entry.id), time: new Date(entry.created_at).toLocaleString("vi-VN"), actor: entry.actor,
            action: entry.action.replaceAll("_", " ").toLowerCase(),
            entity: [entry.entity_type, entry.entity_id].filter(Boolean).join(" · ") || "—",
          })));
          setLoadState(current => ({ ...current, audit: "ready" }));
        }
      })
      .catch(err => { console.warn("Backend audit log unavailable:", err); if (active) { setActivityLogs([]); setLoadState(current => ({ ...current, audit: "error" })); } });
    frontDeskApi.services()
      .then(services => { if (active) { setCatalogServices(services); setLoadState(current => ({ ...current, services: "ready" })); } })
      .catch(err => { console.warn("Backend service catalog unavailable:", err); if (active) { setCatalogServices([]); setLoadState(current => ({ ...current, services: "error" })); } });
    authApi.employeeProfile()
      .then(p => { if (active) { setUserProfile(p); setLoadState(current => ({ ...current, profile: "ready" })); } })
      .catch(() => { if (active) setLoadState(current => ({ ...current, profile: "error" })); });
    return () => { active = false; };
  }, [refreshKey]);

  /* ══════════════════════════════════════════════════════════
     HANDLERS
  ══════════════════════════════════════════════════════════ */
  const handleToggleAccountLock = async (account: AccountItem) => {
    if (account.status === "Locked") {
      showToast("Tài khoản đang bị khóa sau lần đăng nhập thất bại; màn hình này chưa có API mở khóa an toàn.");
      return;
    }
    const enabled = account.status === "Disabled";
    try {
      const updated = await hrGovernanceApi.setStatus(account.id, enabled);
      setAccounts(prev => prev.map(a => a.id === account.id ? toAccountItem(updated) : a));
      showToast(enabled ? `Đã kích hoạt tài khoản ${account.id}.` : `Đã vô hiệu hóa tài khoản ${account.id}.`);
    } catch (error) {
      console.warn("Unable to update employee status:", error);
      showToast("Không thể cập nhật trạng thái tài khoản. Vui lòng thử lại.");
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountForm.name || !newAccountForm.email || !newAccountForm.phone) {
      alert("Vui lòng điền họ tên, email và số điện thoại.");
      return;
    }
    try {
      const created = await enterpriseApi.autoProvisionEmployee({
        full_name: newAccountForm.name,
        role: newAccountForm.roleCode,
        phone: newAccountForm.phone,
        email: newAccountForm.email,
      });
      setRefreshKey(key => key + 1);
      setIsAddAccountModalOpen(false);
      setNewAccountForm({ name: "", email: "", phone: "", roleCode: "FRONT_DESK" });
      showToast(`Đã tạo ${created.employee_id}. Mật khẩu tạm đã được hệ thống tự sinh: ${created.temporary_password}`);
    } catch (error) {
      showToast("Không thể tạo tài khoản. Vui lòng thử lại.");
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    try {
      const updated = await hrGovernanceApi.setRole(editingAccount.id, editingAccount.roleCode);
      setAccounts(prev => prev.map(account => account.id === editingAccount.id ? {
        ...toAccountItem(updated),
      } : account));
      setEditingAccount(null);
      showToast(`Đã cập nhật vai trò ${editingAccount.id}.`);
    } catch (error) {
      showToast("Không thể cập nhật vai trò. Vui lòng thử lại.");
    }
  };

  // Helper for role badge colors
  const getRoleBadge = (code: AccountItem["roleCode"]) => {
    return { label: ROLE_META[code].name, bg: ROLE_META[code].badgeColor };
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
          (acc.email ?? "").toLowerCase().includes(q) ||
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
            MaM Hotel
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

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Tài khoản bị khóa</p>
            <p className="text-2xl font-bold text-gray-900 font-serif leading-tight">{lockedAccounts}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Unlock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Tài khoản đã vô hiệu hóa</p>
            <p className="text-2xl font-bold text-gray-900 font-serif leading-tight">{disabledAccounts}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Sự kiện kiểm toán mới</p>
            <p className="text-2xl font-bold text-gray-900 font-serif leading-tight">{loadState.audit === "ready" ? activityLogs.length : "—"}</p>
            <p className="text-xs text-gray-400 mt-0.5">{activityLogs.length === 20 ? "20 sự kiện gần nhất" : "Theo dữ liệu API"}</p>
          </div>
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
          {/* Account header and create action */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Danh sách tài khoản nhân viên</h2>
              <p className="mt-1 text-xs text-slate-500">Thông tin lấy trực tiếp từ hồ sơ nhân viên.</p>
            </div>
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
                {EMPLOYEE_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
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
                <option value="Locked">Locked (Khóa do đăng nhập sai)</option>
                <option value="Disabled">Disabled (Đã vô hiệu hóa)</option>
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
                  return (
                    <tr key={account.id} className="hover:bg-gray-50/70 transition-colors">

                      {/* Nhân viên */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold ring-1 ring-slate-200" aria-hidden="true">{account.name.trim().slice(0, 1).toLocaleUpperCase("vi-VN") || "?"}</span>
                          <div className="min-w-0"><span className="block font-semibold text-gray-900 whitespace-nowrap">{account.name}</span><span className="block text-[10px] text-gray-400 font-mono">{account.id}</span></div>
                        </div>
                      </td>

                      {/* Email / Tên đăng nhập */}
                      <td className="py-3 px-3 font-mono text-[11px] text-gray-600">
                        {account.email || <span className="font-sans text-gray-400">Chưa có email</span>}
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
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${account.status === "Active" ? "text-emerald-700" : account.status === "Disabled" ? "text-slate-500" : "text-red-600"}`}>
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              account.status === "Active" ? "bg-emerald-500" : account.status === "Disabled" ? "bg-slate-400" : "bg-red-500"
                            }`}
                          />
                          {account.status === "Active" ? "Hoạt động" : account.status === "Locked" ? "Bị khóa" : "Vô hiệu hóa"}
                        </span>
                        {account.employmentStatus !== "WORKING" && <span className="mt-1 block text-[10px] text-gray-500">{account.employmentStatus === "ON_LEAVE" ? "Tạm nghỉ" : "Đã nghỉ việc"}</span>}
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
                            title={account.status === "Active" ? "Vô hiệu hóa tài khoản" : account.status === "Disabled" ? "Kích hoạt tài khoản" : "Chưa có API mở khóa tài khoản"}
                            disabled={account.status === "Locked"}
                            className="p-1 text-gray-400 hover:text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                          >
                            {account.status === "Active" ? (
                              <Lock className="w-3 h-3 text-amber-600" />
                            ) : (
                              <Unlock className="w-3 h-3 text-emerald-600" />
                            )}
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })}
                {loadState.employees === "loading" && <tr><td colSpan={6} className="py-10 text-center text-gray-500">Đang tải danh sách nhân viên…</td></tr>}
                {loadState.employees === "error" && <tr><td colSpan={6} className="py-10 text-center text-rose-700">Không tải được danh sách từ API. <button className="underline font-semibold" onClick={() => setRefreshKey(key => key + 1)}>Thử lại</button></td></tr>}
                {loadState.employees === "ready" && filteredAccounts.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-gray-500">Không có nhân viên khớp bộ lọc.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Footer */}
        <div className="pt-4 mt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
          <p>Đang hiển thị {filteredAccounts.length} trên {accountTotal} hồ sơ nhân viên.</p>
          <p className="text-[11px]">Trạng thái tài khoản và trạng thái lao động được tách riêng.</p>
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

                <span className="w-3.5 h-3.5 rounded-full mt-0.5 bg-slate-100 text-slate-500 flex-shrink-0 z-10 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-slate-500" /></span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-mono text-gray-400">{log.time}</span>
                  </div>

                  <p className="font-semibold text-gray-800 text-[11px] truncate mt-0.5">
                    {log.actor || "Không rõ tác nhân"}
                  </p>
                  <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{log.action} · {log.entity}</p>
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

          <div className={`mb-3.5 flex items-center gap-2 text-xs font-semibold p-2 rounded-xl border ${loadState.services === "ready" ? "text-slate-700 bg-slate-50 border-slate-200" : loadState.services === "loading" ? "text-blue-700 bg-blue-50 border-blue-100" : "text-rose-700 bg-rose-50 border-rose-100"}`}>
            <span className={`w-2 h-2 rounded-full ${loadState.services === "ready" ? "bg-slate-500" : loadState.services === "loading" ? "bg-blue-500" : "bg-rose-500"}`} />
            <span>{loadState.services === "ready" ? `${catalogServices.length} dịch vụ trong danh mục` : loadState.services === "loading" ? "Đang tải danh mục dịch vụ…" : "Không tải được danh mục dịch vụ"}</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {catalogServices.slice(0, 8).map(srv => (
              <div key={srv.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-gray-700 font-medium">{srv.name}</span>
                </div>
                <span className={`${srv.active === false ? "text-slate-500" : srv.stock <= 0 ? "text-amber-700" : "text-emerald-700"} font-medium text-[11px]`}>{srv.active === false ? "Tạm ngưng" : srv.stock <= 0 ? "Hết tồn kho" : "Đang bán"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const SystemOverviewView = (
    <div className="space-y-5">
      <section className="rounded-2xl bg-[#101827] p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300">MaM Hotel · Control room</p>
            <h2 className="mt-2 text-2xl font-serif font-bold">Dữ liệu quản trị có nguồn gốc rõ ràng</h2>
            <p className="mt-2 text-xs leading-5 text-slate-300">Trang này chỉ hiển thị số liệu nhận được từ API nhân viên, audit và danh mục dịch vụ. CPU, RAM, backup và phiên realtime đã được bỏ vì backend chưa cung cấp telemetry.</p>
          </div>
          <button onClick={() => setRefreshKey(key => key + 1)} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold hover:bg-white/15"><RefreshCw className="h-4 w-4" /> Đồng bộ lại</button>
        </div>
      </section>
      {TopMetricCards}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="font-serif text-sm font-bold text-slate-900">Kết nối dữ liệu</h3>
          <div className="mt-4 space-y-3">
            {([
              ["Tài khoản nhân viên", loadState.employees, `${accountTotal} hồ sơ`],
              ["Nhật ký kiểm toán", loadState.audit, `${activityLogs.length} sự kiện`],
              ["Danh mục dịch vụ", loadState.services, `${catalogServices.length} dịch vụ`],
              ["Hồ sơ đăng nhập", loadState.profile, userProfile?.employee_id || "—"],
            ] as const).map(([label, state, detail]) => <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-xs"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${state === "ready" ? "bg-emerald-500" : state === "loading" ? "bg-blue-500" : "bg-rose-500"}`} /><span className="font-medium text-slate-700">{label}</span></div><span className="text-slate-500">{state === "loading" ? "Đang tải" : state === "error" ? "Lỗi API" : detail}</span></div>)}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-gray-900 text-sm">Phân bố nhân sự theo phòng ban</h3>
              <span className="text-xs text-blue-600 font-bold">{activeAccounts} Hoạt động</span>
            </div>
            <div className="space-y-2.5 text-xs">
              {[...new Set(accounts.map(account => account.department))].sort((a, b) => a.localeCompare(b, "vi")).map(department => <div key={department} className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-400" /><span className="text-gray-700">{department}</span></div><span className="font-mono font-bold text-gray-900">{accounts.filter(account => account.department === department).length} tài khoản</span></div>)}
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-gray-100 text-right">
            <button onClick={() => setCurrentTab("accounts")} className="text-xs font-semibold text-blue-600 hover:underline">Quản lý tài khoản →</button>
          </div>
        </div>
      </div>
    </div>
  );

  // The backend remains the single source of truth for role permissions. This screen
  // deliberately shows only roles actually returned by the employee API.
  const RolesPermissionView = (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
        <div>
          <h3 className="font-serif font-bold text-gray-900 text-base">Vai trò đang sử dụng</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Số liệu lấy từ tài khoản nhân viên. Ma trận quyền do backend cấp qua JWT; giao diện không tự giả lập quyền.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8F9FA] text-[11px] font-semibold text-gray-600 border-b border-gray-100 uppercase">
                <th className="py-3 px-4">Mã Role</th>
                <th className="py-3 px-4">Tên vai trò</th>
                <th className="py-3 px-4">Bộ phận</th>
                <th className="py-3 px-4 text-right">Tài khoản</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rolesList.map(role => (
                <tr key={role.code} className="hover:bg-gray-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold">
                    <span className={`px-2 py-0.5 rounded border text-[10px] ${ROLE_META[role.code as EmployeeRole].badgeColor}`}>
                      {role.code}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-gray-900">{role.name}</td>
                  <td className="py-3.5 px-4 text-gray-600">{ROLE_META[role.code as EmployeeRole].department}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-semibold text-gray-700">{role.usersCount}</td>
                </tr>
              ))}
              {loadState.employees === "ready" && rolesList.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-gray-500">Chưa có vai trò nào được sử dụng.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const AuditLogsView = (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-serif font-bold text-gray-900 text-sm">Nhật ký truy vết hệ thống</h3>
          <p className="text-xs text-gray-400 mt-0.5">Dữ liệu do backend ghi nhận; không suy diễn IP hay loại sự kiện.</p>
        </div>
        <button onClick={() => setRefreshKey(key => key + 1)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5" /> Làm mới</button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8F9FA] text-[11px] font-semibold text-gray-600 border-b border-gray-100 uppercase">
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Người thực hiện</th>
                <th className="py-3 px-4">Hành động</th>
                <th className="py-3 px-4">Đối tượng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activityLogs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50/70">
                  <td className="py-3.5 px-4 font-mono text-[11px] text-gray-600">{log.time}</td>
                  <td className="py-3.5 px-4 font-semibold text-gray-900">{log.actor || "Không rõ"}</td>
                  <td className="py-3.5 px-4 text-gray-700">{log.action}</td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500">{log.entity}</td>
                </tr>
              ))}
              {loadState.audit === "loading" && <tr><td colSpan={4} className="py-10 text-center text-gray-500">Đang tải nhật ký…</td></tr>}
              {loadState.audit === "error" && <tr><td colSpan={4} className="py-10 text-center text-rose-700">Không tải được nhật ký kiểm toán.</td></tr>}
              {loadState.audit === "ready" && activityLogs.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-gray-500">Chưa có sự kiện nào.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const SystemSettingsView = (
    <div className="space-y-5 max-w-4xl">
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
        <h3 className="font-serif font-bold text-gray-900 text-base mb-1">Cấu hình hệ thống</h3>
        <p className="text-xs text-gray-500 mb-5">Chưa có API backend để lưu cấu hình bảo mật toàn cục. Các công tắc giả đã được gỡ để tránh quản trị viên tưởng rằng thay đổi đã có hiệu lực.</p>
        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          {["Xác thực hai bước", "Thời gian hết hạn phiên", "Chống brute-force theo IP", "Chế độ bảo trì"].map(item => <div key={item} className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"><p className="font-semibold text-slate-800">{item}</p><p className="mt-1 text-[11px] text-slate-500">Chưa được backend hỗ trợ cấu hình động.</p></div>)}
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

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Vai trò hệ thống</label>
            <select value={newAccountForm.roleCode} onChange={e => setNewAccountForm({ ...newAccountForm, roleCode: e.target.value as EmployeeRole })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer">
              {EMPLOYEE_ROLES.map(role => <option key={role} value={role}>{role} — {ROLE_META[role].name}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-gray-400">Phòng ban được suy ra từ vai trò và không lưu riêng trên hồ sơ nhân viên.</p>
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
            <label className="block text-gray-700 font-semibold mb-1">Họ và tên (chỉ đọc)</label>
            <input
              type="text"
              value={editingAccount.name}
              readOnly
              className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Vai trò</label>
            <select value={editingAccount.roleCode} onChange={e => setEditingAccount({ ...editingAccount, roleCode: e.target.value as EmployeeRole })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer">
              {EMPLOYEE_ROLES.map(role => <option key={role} value={role}>{role} — {ROLE_META[role].name}</option>)}
            </select>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-600">Trạng thái hiện tại: <strong>{editingAccount.status}</strong>. Dùng nút khóa/kích hoạt ở danh sách để thay đổi trạng thái qua API.</div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
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
                {currentTab === "dashboard" && "Theo dõi hoạt động hệ thống, phiên làm việc và các dịch vụ đang phục vụ."}
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
