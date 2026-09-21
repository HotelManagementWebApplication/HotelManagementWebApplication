import React, { useState, useEffect, useRef } from "react";
import {
  X,
  User,
  Shield,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Building,
  BadgeCheck,
  Cpu,
} from "lucide-react";
import { authApi } from "../../shared/api/auth";
import type { EmployeeProfileDto, EmployeeRole, PermissionCode } from "../../shared/types/api";

export interface EmployeeProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  currentRoleLabel?: string;
  departmentName?: string;
  align?: "top-right" | "bottom-left" | "bottom-right" | "right";
}

type TabType = "overview" | "password" | "permissions";

const ROLE_INFO_MAP: Record<string, { label: string; department: string; gradient: string; badge: string }> = {
  FRONT_DESK: {
    label: "Lễ tân PMS",
    department: "Bộ phận Tiền sảnh",
    gradient: "from-[#1D4ED8] to-[#3B82F6]",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  HOUSEKEEPING: {
    label: "Giám sát Buồng phòng",
    department: "Bộ phận Buồng phòng",
    gradient: "from-[#15803D] to-[#16A34A]",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  TECHNICAL: {
    label: "Kỹ thuật & Bảo trì",
    department: "Bộ phận Kỹ thuật",
    gradient: "from-[#B45309] to-[#D97706]",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  KITCHEN: {
    label: "Bếp trưởng & F&B",
    department: "Bộ phận Bếp & Minibar",
    gradient: "from-[#EA580C] to-[#F97316]",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
  },
  ACCOUNTING: {
    label: "Kế toán & Tài chính",
    department: "Bộ phận Kế toán",
    gradient: "from-[#0E7490] to-[#06B6D4]",
    badge: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  MANAGER: {
    label: "Quản lý Vận hành",
    department: "Ban Quản lý",
    gradient: "from-[#6D28D9] to-[#8B5CF6]",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
  },
  DIRECTOR: {
    label: "Giám đốc Điều hành",
    department: "Ban Giám đốc",
    gradient: "from-[#B8944A] to-[#8C6D37]",
    badge: "bg-amber-50 text-[#8C6D37] border-[#8C6D37]/30",
  },
  ADMIN: {
    label: "Quản trị Hệ thống",
    department: "Trung tâm IT & Quản trị",
    gradient: "from-[#BE123C] to-[#E11D48]",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
  },
  HR: {
    label: "Quản lý Nhân sự",
    department: "Bộ phận Nhân sự",
    gradient: "from-[#BE185D] to-[#EC4899]",
    badge: "bg-pink-50 text-pink-700 border-pink-200",
  },
  STAFF: {
    label: "Nhân viên Vận hành",
    department: "Bộ phận Vận hành",
    gradient: "from-[#334155] to-[#475569]",
    badge: "bg-slate-50 text-slate-700 border-slate-200",
  },
};

type PermissionInfo = {
  label: string;
  description: string;
  group: string;
};

/** Human-readable permission names for staff who do not work with technical codes. */
const PERMISSION_INFO: Record<string, PermissionInfo> = {
  EMPLOYEE_READ: { label: "Xem nhân viên", description: "Xem danh sách và thông tin nhân viên", group: "Nhân sự & tài khoản" },
  EMPLOYEE_PROVISION: { label: "Tạo tài khoản nhân viên", description: "Tạo tài khoản mới cho nhân viên", group: "Nhân sự & tài khoản" },
  EMPLOYEE_PASSWORD_RESET: { label: "Đặt lại mật khẩu nhân viên", description: "Cấp lại mật khẩu cho nhân viên", group: "Nhân sự & tài khoản" },
  SHIFT_READ: { label: "Xem ca làm việc", description: "Xem lịch và tình trạng ca làm việc", group: "Nhân sự & tài khoản" },
  SHIFT_WRITE: { label: "Quản lý ca làm việc", description: "Tạo, sửa và phân công ca làm việc", group: "Nhân sự & tài khoản" },

  ROOM_READ: { label: "Xem phòng", description: "Xem danh sách và tình trạng phòng", group: "Phòng & thiết bị" },
  ROOM_WRITE: { label: "Cập nhật phòng", description: "Cập nhật trạng thái phòng", group: "Phòng & thiết bị" },
  ROOM_CATALOG_WRITE: { label: "Quản lý danh mục phòng", description: "Thêm và sửa loại phòng, giá và tiện nghi", group: "Phòng & thiết bị" },
  ROOM_ADMIN_READ: { label: "Xem quản trị phòng", description: "Xem dữ liệu quản trị và cấu hình phòng", group: "Phòng & thiết bị" },
  ROOM_ADMIN_WRITE: { label: "Quản trị phòng", description: "Thay đổi cấu hình và dữ liệu quản trị phòng", group: "Phòng & thiết bị" },
  EQUIPMENT_READ: { label: "Xem thiết bị", description: "Xem thiết bị được trang bị trong phòng và tòa nhà", group: "Phòng & thiết bị" },
  EQUIPMENT_WRITE: { label: "Quản lý thiết bị", description: "Thêm, sửa và cập nhật thiết bị", group: "Phòng & thiết bị" },

  GUEST_READ: { label: "Xem hồ sơ khách", description: "Xem thông tin khách lưu trú", group: "Khách & đặt phòng" },
  GUEST_WRITE: { label: "Cập nhật hồ sơ khách", description: "Tạo và chỉnh sửa thông tin khách", group: "Khách & đặt phòng" },
  RESERVATION_READ: { label: "Xem đặt phòng", description: "Xem danh sách và chi tiết đặt phòng", group: "Khách & đặt phòng" },
  RESERVATION_CREATE: { label: "Tạo đặt phòng", description: "Tạo đặt phòng mới", group: "Khách & đặt phòng" },
  RESERVATION_WRITE: { label: "Cập nhật đặt phòng", description: "Sửa thông tin và trạng thái đặt phòng", group: "Khách & đặt phòng" },
  RESERVATION_CHECKOUT: { label: "Làm thủ tục trả phòng", description: "Thực hiện trả phòng và chốt lưu trú", group: "Khách & đặt phòng" },
  RESERVATION_SERVICE_WRITE: { label: "Ghi nhận dịch vụ phòng", description: "Thêm dịch vụ phát sinh vào đặt phòng", group: "Khách & đặt phòng" },

  INCIDENT_WRITE: { label: "Ghi nhận sự cố", description: "Tạo và cập nhật thông tin sự cố", group: "Vận hành & kỹ thuật" },
  INCIDENT_HANDOFF: { label: "Bàn giao sự cố", description: "Chuyển sự cố cho bộ phận chịu trách nhiệm xử lý", group: "Vận hành & kỹ thuật" },
  FRONT_DESK_DASHBOARD: { label: "Xem màn hình lễ tân", description: "Xem bảng điều hành nghiệp vụ tiền sảnh", group: "Vận hành & kỹ thuật" },
  HOUSEKEEPING_TASK_READ: { label: "Xem nhiệm vụ buồng phòng", description: "Xem danh sách việc dọn và kiểm tra phòng", group: "Vận hành & kỹ thuật" },
  HOUSEKEEPING_TASK_WRITE: { label: "Cập nhật nhiệm vụ buồng phòng", description: "Cập nhật tiến độ và kết quả dọn phòng", group: "Vận hành & kỹ thuật" },
  HOUSEKEEPING_TASK_ASSIGN: { label: "Phân công buồng phòng", description: "Giao nhiệm vụ dọn phòng cho nhân viên", group: "Vận hành & kỹ thuật" },
  TECHNICAL_WORK_ORDER_READ: { label: "Xem phiếu kỹ thuật", description: "Xem các phiếu sửa chữa và bảo trì", group: "Vận hành & kỹ thuật" },
  TECHNICAL_WORK_ORDER_WRITE: { label: "Quản lý phiếu kỹ thuật", description: "Tạo và cập nhật phiếu sửa chữa", group: "Vận hành & kỹ thuật" },
  TECHNICAL_WORK_ORDER_ACCEPT: { label: "Tiếp nhận phiếu kỹ thuật", description: "Nhận xử lý phiếu được giao", group: "Vận hành & kỹ thuật" },
  TECHNICAL_WORK_ORDER_RELEASE: { label: "Bàn giao phiếu kỹ thuật", description: "Hoàn tất và bàn giao kết quả sửa chữa", group: "Vận hành & kỹ thuật" },

  BILLING_READ: { label: "Xem hóa đơn", description: "Xem hóa đơn và công nợ", group: "Thanh toán & tài chính" },
  BILLING_WRITE: { label: "Quản lý hóa đơn", description: "Tạo và cập nhật hóa đơn", group: "Thanh toán & tài chính" },
  PAYMENT_WRITE: { label: "Ghi nhận thanh toán", description: "Ghi nhận tiền khách thanh toán", group: "Thanh toán & tài chính" },
  CASH_HANDOVER_WRITE: { label: "Bàn giao két tiền", description: "Lập và xác nhận bàn giao tiền mặt", group: "Thanh toán & tài chính" },
  FINANCE_READ: { label: "Xem tài chính", description: "Xem báo cáo và sổ tài chính", group: "Thanh toán & tài chính" },
  FINANCE_WRITE: { label: "Ghi nhận tài chính", description: "Tạo và cập nhật nghiệp vụ tài chính", group: "Thanh toán & tài chính" },

  SERVICE_READ: { label: "Xem dịch vụ", description: "Xem danh mục và giá dịch vụ", group: "Dịch vụ & kho" },
  SERVICE_WRITE: { label: "Quản lý dịch vụ", description: "Tạo và cập nhật dịch vụ", group: "Dịch vụ & kho" },
  INVENTORY_READ: { label: "Xem tồn kho", description: "Xem số lượng hàng hóa và vật tư", group: "Dịch vụ & kho" },
  INVENTORY_WRITE: { label: "Nhập xuất kho", description: "Ghi nhận nhập, xuất và điều chỉnh tồn kho", group: "Dịch vụ & kho" },
  SERVICE_PRICE_REQUEST: { label: "Đề xuất đổi giá dịch vụ", description: "Tạo yêu cầu thay đổi giá dịch vụ", group: "Dịch vụ & kho" },
  SERVICE_PRICE_ACTIVATE: { label: "Kích hoạt giá dịch vụ", description: "Đưa mức giá dịch vụ đã duyệt vào sử dụng", group: "Dịch vụ & kho" },

  NOTIFICATION_READ: { label: "Xem thông báo", description: "Xem thông báo nội bộ và thông báo vận hành", group: "Thông báo & kiểm soát" },
  NOTIFICATION_WRITE: { label: "Gửi thông báo", description: "Tạo và gửi thông báo nội bộ", group: "Thông báo & kiểm soát" },
  MAINTENANCE_READ: { label: "Xem bảo trì", description: "Xem lịch sử và tình trạng bảo trì", group: "Thông báo & kiểm soát" },
  MAINTENANCE_WRITE: { label: "Quản lý bảo trì", description: "Tạo và cập nhật công việc bảo trì", group: "Thông báo & kiểm soát" },
  APPROVAL_REQUEST: { label: "Tạo yêu cầu phê duyệt", description: "Gửi nghiệp vụ cần cấp trên phê duyệt", group: "Thông báo & kiểm soát" },
  APPROVAL_APPROVE: { label: "Phê duyệt yêu cầu", description: "Phê duyệt hoặc từ chối nghiệp vụ được gửi lên", group: "Thông báo & kiểm soát" },
  AUDIT_READ: { label: "Xem nhật ký hệ thống", description: "Xem lịch sử thao tác và kiểm toán", group: "Thông báo & kiểm soát" },
};

const PERMISSION_GROUP_ORDER = [
  "Nhân sự & tài khoản",
  "Phòng & thiết bị",
  "Khách & đặt phòng",
  "Vận hành & kỹ thuật",
  "Thanh toán & tài chính",
  "Dịch vụ & kho",
  "Thông báo & kiểm soát",
  "Khác",
];

const getPermissionInfo = (permission: PermissionCode | string): PermissionInfo => {
  const known = PERMISSION_INFO[permission];
  if (known) return known;

  const label = permission
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return { label, description: "Quyền hệ thống chưa có phần giải thích tiếng Việt", group: "Khác" };
};

export const EmployeeProfileDropdown: React.FC<EmployeeProfileDropdownProps> = ({
  isOpen,
  onClose,
  onLogout,
  currentRoleLabel,
  departmentName,
  align = "top-right",
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Profile data
  const [profile, setProfile] = useState<EmployeeProfileDto | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Change password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwError, setPwError] = useState("");

  // Handle click outside & Esc key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Load profile from real database backend
  useEffect(() => {
    if (!isOpen) return;
    setLoadingProfile(true);
    authApi
      .employeeProfile()
      .then((data) => setProfile(data))
      .catch((err) => {
        console.warn("Could not load employee profile from backend:", err);
      })
      .finally(() => setLoadingProfile(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const roleKey = profile?.role || "STAFF";
  const roleMeta = ROLE_INFO_MAP[roleKey] ?? {
    label: currentRoleLabel || "Nhân viên",
    department: departmentName || "Khách sạn MAM",
    gradient: "from-[#1E293B] to-[#334155]",
    badge: "bg-slate-50 text-slate-700 border-slate-200",
  };

  const displayName = profile?.full_name || currentRoleLabel || "Nhân viên";
  const displayRole = roleMeta.label;
  const displayDepartment = departmentName || roleMeta.department;
  const displayInitials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "NV";

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");

    if (!newPassword) {
      setPwError("Vui lòng nhập mật khẩu mới.");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSavingPw(true);
    try {
      await authApi.changePassword(newPassword);
      setPwSuccess("Đổi mật khẩu thành công và lưu vào CSDL!");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setPwSuccess("");
        setActiveTab("overview");
      }, 1500);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setPwError(apiErr?.message || "Đổi mật khẩu thất bại. Vui lòng thử lại.");
    } finally {
      setSavingPw(false);
    }
  };

  // Alignment classes
  const alignmentClass = {
    "top-right": "right-0 top-full mt-2",
    "bottom-left": "left-0 bottom-full mb-2",
    "bottom-right": "right-0 bottom-full mb-2",
    "right": "right-0 top-full mt-2",
  }[align];

  return (
    <div
      ref={dropdownRef}
      role="dialog"
      aria-label="Cửa sổ thông tin nhân viên"
      className={`absolute ${alignmentClass} w-[340px] sm:w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col text-[#0F172A] animate-in fade-in zoom-in-95 duration-150`}
      style={{
        boxShadow: "0 20px 45px -10px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08)",
      }}
    >
      {/* ── DROPDOWN HEADER ── */}
      <div className="bg-[#0F172A] text-white p-4 relative border-b border-slate-700">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-full bg-gradient-to-br ${roleMeta.gradient} flex items-center justify-center text-white font-bold text-sm shadow-md border-2 border-white/20 shrink-0`}
            >
              {displayInitials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold text-white truncate max-w-[180px]">
                  {displayName}
                </p>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/20 shrink-0">
                  {profile?.employee_id || "STAFF"}
                </span>
              </div>
              <p className="text-xs text-white/70 flex items-center gap-1.5 mt-0.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">{displayRole}</span>
                <span className="text-white/40">·</span>
                <span className="text-white/60 truncate">{displayDepartment}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white p-1 rounded-full hover:bg-white/10 transition cursor-pointer shrink-0"
            title="Đóng"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── SEGMENTED TAB NAV ── */}
      <div className="grid grid-cols-3 bg-slate-100 p-1 border-b border-slate-200 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`py-1.5 px-2 rounded-lg text-center transition cursor-pointer flex items-center justify-center gap-1 text-[11px] ${
            activeTab === "overview"
              ? "bg-white text-[#0F172A] font-semibold shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <User size={12} />
          <span>Hồ sơ</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("password")}
          className={`py-1.5 px-2 rounded-lg text-center transition cursor-pointer flex items-center justify-center gap-1 text-[11px] ${
            activeTab === "password"
              ? "bg-white text-[#0F172A] font-semibold shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <KeyRound size={12} />
          <span>Đổi mật khẩu</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("permissions")}
          className={`py-1.5 px-2 rounded-lg text-center transition cursor-pointer flex items-center justify-center gap-1 text-[11px] ${
            activeTab === "permissions"
              ? "bg-white text-[#0F172A] font-semibold shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Shield size={12} />
          <span>Quyền hạn</span>
        </button>
      </div>

      {/* ── TAB BODY ── */}
      <div className="p-4 max-h-[360px] overflow-y-auto space-y-3">
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-3">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <User size={12} className="text-slate-400" /> Họ và tên
                </span>
                <span className="font-semibold text-slate-800">{displayName}</span>
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <BadgeCheck size={12} className="text-slate-400" /> Mã nhân viên
                </span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {profile?.employee_id || "STAFF"}
                </span>
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Briefcase size={12} className="text-slate-400" /> Chức vụ
                </span>
                <span className="font-medium text-slate-800">{displayRole}</span>
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Building size={12} className="text-slate-400" /> Bộ phận
                </span>
                <span className="text-slate-700">{displayDepartment}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Shield size={12} className="text-slate-400" /> Trạng thái
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 size={12} /> Đang trực tuyến · CSDL
                </span>
              </div>
            </div>

            {/* Quick Action Shortcuts */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("password")}
                className="py-2 px-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <KeyRound size={13} className="text-slate-600" />
                <span>Đổi mật khẩu</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("permissions")}
                className="py-2 px-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Shield size={13} className="text-slate-600" />
                <span>Xem quyền ({profile?.permissions?.length ?? 0})</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: CHANGE PASSWORD */}
        {activeTab === "password" && (
          <form onSubmit={handleChangePassword} className="space-y-3">
            {pwSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-1.5 animate-fadeIn">
                <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                <span>{pwSuccess}</span>
              </div>
            )}

            {pwError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-1.5 animate-fadeIn">
                <AlertCircle size={14} className="shrink-0 text-rose-600" />
                <span>{pwError}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Mật khẩu mới (tối thiểu 8 ký tự)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800 pr-8 bg-slate-50/50"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Xác nhận mật khẩu mới
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800 bg-slate-50/50"
                minLength={8}
                required
              />
            </div>

            <button
              type="submit"
              disabled={savingPw}
              className="w-full py-2 px-3 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {savingPw ? (
                <span>Đang cập nhật CSDL...</span>
              ) : (
                <>
                  <KeyRound size={13} />
                  <span>Cập nhật mật khẩu</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* TAB 3: PERMISSIONS */}
        {activeTab === "permissions" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <span className="text-[11px] text-slate-500">Các quyền được cấp cho tài khoản</span>
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                {profile?.permissions?.length ?? 0} quyền
              </span>
            </div>

            {profile?.permissions && profile.permissions.length > 0 ? (
              <div className="max-h-[220px] overflow-y-auto py-1 space-y-3">
                {PERMISSION_GROUP_ORDER.map((group) => {
                  const permissions = profile.permissions.filter((permission) => getPermissionInfo(permission).group === group);
                  if (permissions.length === 0) return null;

                  return (
                    <section key={group}>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        {group}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {permissions.map((permission) => {
                          const info = getPermissionInfo(permission);
                          return (
                            <span
                              key={permission}
                              title={info.description}
                              className="text-[10px] font-medium px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200/80 cursor-help"
                            >
                              {info.label}
                            </span>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                <Shield size={16} className="mx-auto mb-1 text-slate-400" />
                <span>Đang tải thông tin quyền hạn tài khoản...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── DROPDOWN FOOTER: LOGOUT ── */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 font-mono">
          Phiên làm việc: Bảo mật
        </span>
        <button
          type="button"
          onClick={() => {
            onClose();
            onLogout();
          }}
          className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-rose-50 transition cursor-pointer border border-transparent hover:border-rose-200"
        >
          <LogOut size={12} />
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );
};
export default EmployeeProfileDropdown;
