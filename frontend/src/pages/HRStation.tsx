import { useEffect, useState, useMemo } from "react";
import type { ChangeEvent } from "react";
import { hrGovernanceApi, rows as apiRows } from "../shared/api/hrGovernance";
import { enterpriseApi } from "../shared/api/enterprise";
import { authApi } from "../shared/api/auth";
import { EmployeeProfileDropdown } from "../components/common/EmployeeProfileDropdown";
import type { AttendanceRecord as ApiAttendanceRecord, LeaveRequest as ApiLeaveRequest } from "../shared/types/enterprise";
import type { Approval, EmployeeAdmin, Shift } from "../shared/types/hrGovernance";
import type { EmployeeProfileDto } from "../shared/types/api";
import { localDateValue } from "../shared/utils/localDate";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Clock,
  FileText,
  Search,
  Bell,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Plus,
  Filter,
  Download,
  RefreshCw,
  MoreHorizontal,
  X,
  Check,
  UserCheck,
  Briefcase,
  Phone,
  Mail,
  Calendar,
  Building,
  ArrowRightLeft,
  ShieldCheck,
  Eye,
  Edit3,
  Trash2,
  Utensils,
  Wrench,
  BedDouble,
  ConciergeBell,
  Sparkles,
  Award,
  TrendingUp,
  TrendingDown,
  Coffee,
  Sun,
  Moon,
  AlertTriangle
} from "lucide-react";

/* ══════════════════════════════════════════════════════════
   TYPES & INTERFACES
══════════════════════════════════════════════════════════ */
type TabType = "overview" | "schedule" | "staff" | "attendance" | "leaves";

type ShiftType = "morning" | "afternoon" | "night" | "off";

interface ShiftCell {
  day: string; // T2, T3, T4, T5, T6, T7, CN
  date: string; // 14/09, etc.
  shift: ShiftType;
  shiftId?: number;
  isoDate?: string;
}

interface ScheduleEmployee {
  id: string;
  name: string;
  avatar: string;
  departmentId: string;
  role: string;
  shifts: ShiftCell[];
}

interface DepartmentGroup {
  id: string;
  name: string;
  icon: any;
  colorClass: string;
  badgeBg: string;
  badgeText: string;
  employees: ScheduleEmployee[];
}

interface LeaveTodayItem {
  id: string;
  name: string;
  role: string;
  avatar: string;
  type: string;
  statusColor: string;
}

interface PendingApprovalItem {
  id: string;
  name: string;
  department: string;
  avatar: string;
  type: "swap" | "leave";
  typeLabel: string;
  date: string;
  reason: string;
}

interface EmployeeProfile {
  id: string;
  name: string;
  gender: "Nam" | "Nữ" | "—";
  dob: string;
  avatar: string;
  department: string;
  departmentId: string;
  role: string;
  email: string;
  phone: string;
  idCard: string;
  joinDate: string;
  contractType: "Chính thức" | "Thử việc" | "Thời vụ" | "—";
  salaryGrade: string;
  leaveBalance: number | null; // null khi backend chưa cung cấp
  status: "Đang làm việc" | "Thử việc" | "Tạm hoãn" | "Đã nghỉ việc";
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  avatar: string;
  department: string;
  shiftName: string;
  checkIn: string;
  checkOut: string;
  workHours: string;
  lateMinutes: number;
  earlyMinutes: number;
  otHours: number;
  status: "Đúng giờ" | "Đi muộn" | "Về sớm" | "Vắng" | "Có phép";
}

interface LeaveRequest {
  id: string;
  employeeName: string;
  avatar: string;
  department: string;
  type: "Nghỉ phép năm" | "Nghỉ ốm" | "Việc riêng" | "Đổi ca trực" | "Nghỉ chế độ";
  dateRange: string;
  totalDays: string;
  reason: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
  approver?: string;
}

/* ══════════════════════════════════════════════════════════
   PROPS
══════════════════════════════════════════════════════════ */
interface Props {
  onBack: () => void;
}

const employeeAvatar = (name: string) => {
  const initials = name.trim().split(/\s+/).slice(-2).map(part => part[0] ?? "").join("").toUpperCase() || "NV";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="48" fill="#E8F5EE"/><text x="48" y="57" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#087443">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

export default function HRStation({ onBack }: Props) {
  // Navigation
  const [currentTab, setCurrentTab] = useState<TabType>("schedule");

  // Global search & filters
  const [globalSearch, setGlobalSearch] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("all");

  // Notifications
  const [showNotifications, setShowNotifications] = useState(false);
  const [userProfile, setUserProfile] = useState<EmployeeProfileDto | null>(null);
  const [topProfileOpen, setTopProfileOpen] = useState(false);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ── Tab 2 (Lịch phân ca) states ──
  const [scheduleData, setScheduleData] = useState<DepartmentGroup[]>([]);
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});
  const [leaveTodayList, setLeaveTodayList] = useState<LeaveTodayItem[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalItem[]>([]);

  // Quick edit shift modal
  const [editingShift, setEditingShift] = useState<{
    employeeId: string;
    employeeName: string;
    dayIndex: number;
    currentShift: ShiftType;
  } | null>(null);

  // ── Tab 3 (Hồ sơ nhân sự) states ──
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeProfile | null>(null);
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [staffFilterDept, setStaffFilterDept] = useState("all");
  const [staffFilterStatus, setStaffFilterStatus] = useState("all");

  // New employee form state
  const [newEmpForm, setNewEmpForm] = useState({
    name: "",
    gender: "Nữ" as "Nam" | "Nữ",
    dob: "2000-01-01",
    department: "Bộ phận Lễ tân",
    departmentId: "reception",
    role: "Nhân viên Lễ tân",
    email: "",
    phone: "",
    idCard: "",
    joinDate: localDateValue(),
    contractType: "Thử việc" as "Chính thức" | "Thử việc" | "Thời vụ",
    salaryGrade: "Bậc 1 (8,500,000 ₫)",
    leaveBalance: 12
  });

  // ── Tab 4 (Chấm công) states ──
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceViewMode, setAttendanceViewMode] = useState<"daily" | "monthly">("daily");
  const [attendanceDate, setAttendanceDate] = useState(localDateValue());
  const [isSyncingBiometrics, setIsSyncingBiometrics] = useState(false);

  // ── Tab 5 (Đơn nghỉ phép) states ──
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveTabFilter, setLeaveTabFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [isCreateLeaveModalOpen, setIsCreateLeaveModalOpen] = useState(false);
  const [newLeaveForm, setNewLeaveForm] = useState({
    employeeName: "",
    department: "Bộ phận Lễ tân",
    type: "Nghỉ phép năm" as LeaveRequest["type"],
    dateRange: new Date().toLocaleDateString("vi-VN"),
    totalDays: "1 ngày",
    reason: ""
  });

  useEffect(() => {
    let active = true;
    const departmentFor = (role: string) => ({
      FRONT_DESK: ["Bộ phận Lễ tân", "reception"], HOUSEKEEPING: ["Bộ phận Buồng phòng", "housekeeping"],
      KITCHEN: ["Bộ phận Bếp & F&B", "fnb"], TECHNICAL: ["Bộ phận Kỹ thuật", "technical"],
      ACCOUNTING: ["Bộ phận Kế toán", "accounting"], HR: ["Bộ phận Nhân sự", "hr"],
      MANAGER: ["Ban quản lý", "management"], DIRECTOR: ["Ban giám đốc", "management"], ADMIN: ["Bộ phận CNTT", "admin"], STAFF: ["Bộ phận Vận hành", "operations"],
    }[role] ?? ["Bộ phận Vận hành", "operations"]);
    const mapEmployee = (employee: EmployeeAdmin): EmployeeProfile => {
      const [department, departmentId] = departmentFor(employee.role);
      return {
        id: employee.employee_id, name: employee.full_name, gender: "—", dob: "—",
        avatar: employeeAvatar(employee.full_name),
        department, departmentId, role: employee.role, email: employee.email ?? "—", phone: employee.phone,
        idCard: "—", joinDate: "—", contractType: "—", salaryGrade: "Chưa có dữ liệu backend", leaveBalance: null,
        status: employee.employment_status === "TERMINATED" ? "Đã nghỉ việc" : employee.employment_status === "ON_LEAVE" ? "Tạm hoãn" : "Đang làm việc",
      };
    };

    const today = new Date();
    const monday = new Date(today);
    const day = monday.getDay() || 7;
    monday.setDate(monday.getDate() - day + 1);
    const dates = Array.from({ length: 7 }, (_, index) => {
      const value = new Date(monday);
      value.setDate(monday.getDate() + index);
      return value;
    });
    const dateKey = (value: Date) => localDateValue(value);
    const shiftName = (shift?: Shift): ShiftType => {
      if (!shift || shift.status === "CANCELLED") return "off";
      const code = shift.shift_code.toLowerCase();
      if (code.includes("morning") || code.includes("sáng") || code === "am") return "morning";
      if (code.includes("night") || code.includes("đêm") || code === "night") return "night";
      return "afternoon";
    };
    const groupMeta = (departmentId: string, name: string): Omit<DepartmentGroup, "employees"> => ({
      id: departmentId,
      name,
      icon: departmentId === "reception" ? ConciergeBell : departmentId === "housekeeping" ? Sparkles : departmentId === "fnb" ? Utensils : departmentId === "technical" ? Wrench : Users,
      colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
      badgeBg: "#EAF8F0",
      badgeText: "#008A4B",
    });

    Promise.all([
      hrGovernanceApi.employees(),
      hrGovernanceApi.shifts({ date: dateKey(dates[0]), to: dateKey(dates[6]) }),
      enterpriseApi.attendance(attendanceDate),
      enterpriseApi.leaves(),
    ]).then(([employeeRows, shifts, attendanceRows, leaveRows]) => {
      if (!active) return;
      const profiles = employeeRows.map(mapEmployee);
      setEmployees(profiles);
      const groups = new Map<string, DepartmentGroup>();
      profiles.forEach(profile => {
        const meta = groupMeta(profile.departmentId, profile.department);
        const group = groups.get(profile.departmentId) ?? { ...meta, employees: [] };
        const cells = dates.map((date, index): ShiftCell => {
          const source = shifts.find(item => item.employee_id === profile.id && item.shift_date === dateKey(date));
          return {
            day: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][index],
            date: date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
            isoDate: dateKey(date),
            shiftId: source?.id,
            shift: shiftName(source),
          };
        });
        group.employees.push({ id: profile.id, name: profile.name, avatar: profile.avatar, departmentId: profile.departmentId, role: profile.role, shifts: cells });
        groups.set(profile.departmentId, group);
      });
      setScheduleData([...groups.values()]);
      const profileById = new Map(profiles.map(profile => [profile.id, profile]));
      setAttendanceRecords(attendanceRows.map((row: ApiAttendanceRecord): AttendanceRecord => {
        const employee = profileById.get(row.employee_id);
        const inAt = row.clock_in ? new Date(row.clock_in) : null;
        const outAt = row.clock_out ? new Date(row.clock_out) : null;
        const hours = inAt && outAt ? Math.max(0, (outAt.getTime() - inAt.getTime()) / 3600000) : 0;
        return { id: String(row.id), employeeId: row.employee_id, employeeName: employee?.name ?? row.employee_id, avatar: employee?.avatar ?? "", department: employee?.department ?? "—", shiftName: "Theo dữ liệu chấm công", checkIn: inAt ? inAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—", checkOut: outAt ? outAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—", workHours: hours ? `${hours.toFixed(1)} giờ` : "—", lateMinutes: 0, earlyMinutes: 0, otHours: 0, status: row.status === "ABSENT" ? "Vắng" : row.status === "ON_LEAVE" ? "Có phép" : row.status === "LATE" ? "Đi muộn" : "Đúng giờ" };
      }));
      setLeaveRequests(leaveRows.map((row: ApiLeaveRequest): LeaveRequest => {
        const employee = profileById.get(row.employee_id);
        const type = row.leave_type === "ANNUAL" ? "Nghỉ phép năm" : row.leave_type === "SICK" ? "Nghỉ ốm" : row.leave_type === "SHIFT_CHANGE" ? "Đổi ca trực" : "Việc riêng";
        const status = row.status === "APPROVED" ? "approved" : row.status === "REJECTED" ? "rejected" : "pending";
        return { id: String(row.id), employeeName: employee?.name ?? row.employee_id, avatar: employee?.avatar ?? "", department: employee?.department ?? "—", type, dateRange: `${row.start_date} – ${row.end_date}`, totalDays: "Theo ngày", reason: row.reason, submittedAt: row.created_at, status, approver: row.approver ?? undefined };
      }));
      const todayStr = dateKey(today);
      const todayLeaves: LeaveTodayItem[] = leaveRows
        .filter(r => r.status === "APPROVED" && r.start_date <= todayStr && r.end_date >= todayStr)
        .map(r => {
          const employee = profileById.get(r.employee_id);
          return {
            id: String(r.id),
            name: employee?.name ?? r.employee_id,
            role: employee?.role ?? "Nhân viên",
            avatar: employee?.avatar ?? "",
            type: r.leave_type === "ANNUAL" ? "Phép năm" : r.leave_type === "SICK" ? "Nghỉ ốm" : "Việc riêng",
            statusColor: "bg-purple-50 text-purple-700",
          };
        });
      setLeaveTodayList(todayLeaves);
    }).catch(err => {
      console.warn("Backend employee/shift data unavailable:", err);
      if (active) { setEmployees([]); setScheduleData([]); setAttendanceRecords([]); setLeaveRequests([]); setLeaveTodayList([]); }
    });

    hrGovernanceApi.approvals("PENDING")
      .then(value => {
        const approvals = apiRows<Approval>(value);
        if (active) {
          setPendingApprovals(approvals.map(approval => ({
            id: String(approval.id), name: approval.requester, department: approval.action,
            avatar: employeeAvatar(approval.requester),
            type: approval.action.toLowerCase().includes("shift") ? "swap" : "leave",
            typeLabel: approval.action, date: approval.expires_at, reason: approval.reason,
          })));
        }
      })
      .catch(err => { console.warn("Backend HR approvals unavailable:", err); if (active) setPendingApprovals([]); });

    authApi.employeeProfile()
      .then(profile => { if (active) setUserProfile(profile); })
      .catch(err => console.warn("Backend HR profile unavailable:", err));

    return () => { active = false; };
  }, [attendanceDate]);

  const today = useMemo(() => new Date(), []);
  const todayLabel = useMemo(() => {
    return today.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  }, [today]);
  const currentMonthLabel = useMemo(() => {
    return `${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
  }, [today]);
  const weekRangeLabel = useMemo(() => {
    const monday = new Date(today);
    const day = monday.getDay() || 7;
    monday.setDate(monday.getDate() - day + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `${monday.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })} - ${sunday.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
  }, [today]);
  const pendingLeaves = useMemo(() => leaveRequests.filter(l => l.status === "pending"), [leaveRequests]);
  const totalUnreadNotifs = pendingLeaves.length + pendingApprovals.length;
  const attendanceSummary = useMemo(() => {
    const onTime = attendanceRecords.filter(record => record.status === "Đúng giờ").length;
    const late = attendanceRecords.filter(record => record.status === "Đi muộn").length;
    const absent = attendanceRecords.filter(record => record.status === "Vắng").length;
    const incomplete = attendanceRecords.filter(record => record.checkIn !== "—" && record.checkOut === "—").length;
    return { onTime, late, absent, incomplete, total: attendanceRecords.length, rate: attendanceRecords.length ? Math.round(onTime / attendanceRecords.length * 100) : 0 };
  }, [attendanceRecords]);

  const shiftCounts = useMemo(() => {
    const todayIso = localDateValue(today);
    let morning = 0;
    let afternoon = 0;
    let night = 0;
    let off = 0;
    scheduleData.forEach(dept => {
      dept.employees.forEach(emp => {
        const cell = emp.shifts.find(s => s.isoDate === todayIso);
        if (cell) {
          if (cell.shift === "morning") morning++;
          else if (cell.shift === "afternoon") afternoon++;
          else if (cell.shift === "night") night++;
          else if (cell.shift === "off") off++;
        }
      });
    });
    return { morning, afternoon, night, off, totalActive: morning + afternoon + night };
  }, [scheduleData, today]);

  /* ══════════════════════════════════════════════════════════
     HANDLERS
  ══════════════════════════════════════════════════════════ */
  const toggleDeptCollapse = (deptId: string) => {
    setCollapsedDepts(prev => ({ ...prev, [deptId]: !prev[deptId] }));
  };

  const persistApprovalDecision = async (item: PendingApprovalItem, action: "approve" | "reject") => {
    const numericId = Number(item.id);
    if (Number.isInteger(numericId)) {
      try {
        if (action === "approve") await hrGovernanceApi.approve(numericId);
        else await hrGovernanceApi.reject(numericId);
      } catch (err) {
        console.warn("Unable to persist HR approval decision:", err);
        return;
      }
    }
    setPendingApprovals(prev => prev.filter(p => p.id !== item.id));
    setLeaveRequests(prev =>
      prev.map(r => (r.employeeName === item.name && r.status === "pending" ? { ...r, status: action === "approve" ? "approved" : "rejected", approver: userProfile?.full_name ? `${userProfile.full_name} (${userProfile.role})` : "Quản lý nhân sự" } : r))
    );
    showToast(action === "approve" ? `Đã duyệt yêu cầu của ${item.name}!` : `Đã từ chối yêu cầu của ${item.name}.`);
  };

  const handleApproveRequest = (item: PendingApprovalItem) => { void persistApprovalDecision(item, "approve"); };
  const handleRejectRequest = (item: PendingApprovalItem) => { void persistApprovalDecision(item, "reject"); };

  const handleUpdateShift = async (newShift: ShiftType) => {
    if (!editingShift) return;
    const cell = scheduleData.flatMap(group => group.employees).find(employee => employee.id === editingShift.employeeId)?.shifts[editingShift.dayIndex];
    if (!cell?.isoDate || newShift === "off") {
      showToast("Không thể xóa ca từ biểu mẫu này.");
      return;
    }
    const ranges: Record<Exclude<ShiftType, "off">, { code: string; start: string; end: string }> = {
      morning: { code: "MORNING", start: "06:00:00", end: "14:00:00" },
      afternoon: { code: "AFTERNOON", start: "14:00:00", end: "22:00:00" },
      night: { code: "NIGHT", start: "22:00:00", end: "23:59:59" },
    };
    const range = ranges[newShift];
    try {
      if (cell.shiftId) {
        await hrGovernanceApi.updateShift(cell.shiftId, { shift_date: cell.isoDate, shift_code: range.code, starts_at: `${cell.isoDate}T${range.start}`, ends_at: `${cell.isoDate}T${range.end}` });
      } else {
        await hrGovernanceApi.assignShift({ employee_id: editingShift.employeeId, shift_date: cell.isoDate, shift_code: range.code, starts_at: `${cell.isoDate}T${range.start}`, ends_at: `${cell.isoDate}T${range.end}` });
      }
    } catch (error) {
      console.warn("Unable to persist shift:", error);
      showToast("Không thể lưu ca trực. Vui lòng thử lại.");
      return;
    }
    setScheduleData(prev =>
      prev.map(dept => ({
        ...dept,
        employees: dept.employees.map(emp => {
          if (emp.id === editingShift.employeeId) {
            const updatedShifts = [...emp.shifts];
            updatedShifts[editingShift.dayIndex] = {
              ...updatedShifts[editingShift.dayIndex],
              shift: newShift
            };
            return { ...emp, shifts: updatedShifts };
          }
          return emp;
        })
      }))
    );
    showToast(`Đã cập nhật ca trực cho ${editingShift.employeeName}!`);
    setEditingShift(null);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpForm.name || !newEmpForm.phone) {
      alert("Vui lòng điền đầy đủ tên và số điện thoại.");
      return;
    }
    try {
      const roleMap: Record<string, string> = { reception: "FRONT_DESK", housekeeping: "HOUSEKEEPING", fnb: "KITCHEN", technical: "TECHNICAL" };
      const result = await enterpriseApi.autoProvisionEmployee({ full_name: newEmpForm.name, role: roleMap[newEmpForm.departmentId] ?? "STAFF", phone: newEmpForm.phone, email: newEmpForm.email || `${newEmpForm.name.replace(/\s+/g, ".").toLowerCase()}@hotel.com` });
      showToast(`Đã tạo ${result.employee_id}. Mật khẩu tạm: ${result.temporary_password}`);
      setIsAddEmployeeModalOpen(false);
    } catch (error) { showToast("Không thể tạo tài khoản nhân viên. Vui lòng thử lại."); }
  };

  const handleSyncBiometrics = async () => {
    setIsSyncingBiometrics(true);
    try {
      const rows = await enterpriseApi.attendance(attendanceDate);
        setAttendanceRecords(rows.map(row => ({ id: String(row.id), employeeId: row.employee_id, employeeName: row.employee_id, avatar: "", department: "—", shiftName: row.source === "BIOMETRIC_IMPORT" ? "Dữ liệu máy vân tay" : "Nhập thủ công", checkIn: row.clock_in ? new Date(row.clock_in).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—", checkOut: row.clock_out ? new Date(row.clock_out).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—", workHours: "—", lateMinutes: 0, earlyMinutes: 0, otHours: 0, status: row.status === "ABSENT" ? "Vắng" : row.status === "ON_LEAVE" ? "Có phép" : row.status === "LATE" ? "Đi muộn" : "Đúng giờ" })));
      showToast("Đã tải dữ liệu chấm công thành công.");
    } catch (error) { showToast("Không thể tải dữ liệu chấm công. Vui lòng thử lại."); }
    finally { setIsSyncingBiometrics(false); }
  };

  const handleImportAttendanceFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsSyncingBiometrics(true);
    try {
      const text = await file.text();
      const raw = text.trim();
      const records = raw.startsWith("[")
        ? JSON.parse(raw) as Record<string, string>[]
        : (() => {
            const lines = raw.split(/\r?\n/).filter(Boolean);
            const headers = (lines.shift() ?? "").split(",").map(value => value.trim());
            return lines.map(line => {
              const values = line.split(",");
              return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
            });
          })();
      const normalizeTimestamp = (value?: string) => !value ? null : /^\d{2}:\d{2}/.test(value) ? `${attendanceDate}T${value}` : value;
      const imported = records.map(record => ({
        employee_id: (record.employee_id || record.employeeId || "").trim(),
        work_date: record.work_date || record.workDate || attendanceDate,
        clock_in: normalizeTimestamp(record.clock_in || record.clockIn),
        clock_out: normalizeTimestamp(record.clock_out || record.clockOut),
        status: record.status || "PRESENT",
        source: "BIOMETRIC_IMPORT",
        device_event_id: record.device_event_id || record.deviceEventId || `FILE-${Date.now()}`,
        note: record.note || `Nhập từ ${file.name}`,
      })).filter(record => Boolean(record.employee_id));
      if (imported.length === 0) throw new Error("File chưa có dòng chấm công hợp lệ.");
      const rows = await enterpriseApi.importAttendance(imported);
      const employeeById = new Map(employees.map(employee => [employee.id, employee]));
      setAttendanceRecords(rows.filter(row => row.work_date === attendanceDate).map(row => {
        const employee = employeeById.get(row.employee_id);
        const inAt = row.clock_in ? new Date(row.clock_in) : null;
        const outAt = row.clock_out ? new Date(row.clock_out) : null;
        const hours = inAt && outAt ? Math.max(0, (outAt.getTime() - inAt.getTime()) / 3600000) : 0;
        return { id: String(row.id), employeeId: row.employee_id, employeeName: employee?.name ?? row.employee_id, avatar: employee?.avatar ?? "", department: employee?.department ?? "—", shiftName: "Dữ liệu máy vân tay", checkIn: inAt ? inAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—", checkOut: outAt ? outAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—", workHours: hours ? `${hours.toFixed(1)} giờ` : "—", lateMinutes: 0, earlyMinutes: 0, otHours: 0, status: row.status === "ABSENT" ? "Vắng" : row.status === "ON_LEAVE" ? "Có phép" : "Đúng giờ" };
      }));
      showToast(`Đã nhập ${imported.length} dòng chấm công.`);
    } catch (error) { showToast("Không thể nhập file chấm công. Vui lòng thử lại."); }
    finally { setIsSyncingBiometrics(false); }
  };

  const handleCreateLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const employee = employees.find(item => item.name === newLeaveForm.employeeName);
    const date = newLeaveForm.dateRange.split(/[–-]/)[0].trim();
    const [day, month, year] = date.includes("/") ? date.split("/").map(Number) : [0, 0, 0];
    if (!employee || !day || !month || !year) { showToast("Vui lòng chọn nhân viên và ngày nghỉ hợp lệ."); return; }
    const typeMap: Record<string, string> = { "Nghỉ phép năm": "ANNUAL", "Nghỉ ốm": "SICK", "Đổi ca trực": "SHIFT_CHANGE", "Việc riêng": "UNPAID" };
    try {
      const row = await enterpriseApi.createLeave({ employee_id: employee.id, leave_type: typeMap[newLeaveForm.type] ?? "UNPAID", start_date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, end_date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, reason: newLeaveForm.reason || "Không ghi chú" });
      setLeaveRequests(prev => [{ id: String(row.id), employeeName: employee.name, avatar: employee.avatar, department: employee.department, type: newLeaveForm.type, dateRange: `${row.start_date} – ${row.end_date}`, totalDays: "1 ngày", reason: row.reason, submittedAt: row.created_at, status: "pending" }, ...prev]);
      setIsCreateLeaveModalOpen(false); showToast("Đã gửi đơn nghỉ, chờ quản lý duyệt.");
    } catch (error) { showToast("Không thể tạo đơn nghỉ. Vui lòng thử lại."); }
  };

  const decideLeave = async (request: LeaveRequest, approve: boolean) => {
    try {
      const row = approve ? await enterpriseApi.approveLeave(Number(request.id)) : await enterpriseApi.rejectLeave(Number(request.id));
      setLeaveRequests(prev => prev.map(item => item.id === request.id ? { ...item, status: approve ? "approved" : "rejected", approver: row.approver ?? "Quản lý" } : item));
      setPendingApprovals(prev => prev.filter(item => item.name !== request.employeeName));
      showToast(approve ? `Đã phê duyệt đơn ${request.id}.` : `Đã từ chối đơn ${request.id}.`);
    } catch (error) { showToast("Không thể cập nhật đơn nghỉ. Vui lòng thử lại."); }
  };

  // Helper render for Shift Badge
  const renderShiftBadge = (shift: ShiftType, onClick?: () => void) => {
    switch (shift) {
      case "morning":
        return (
          <button
            onClick={onClick}
            title="Ca Sáng: 06:00 - 14:00"
            className="w-full py-1.5 px-2 rounded-md font-medium text-xs text-amber-900 bg-amber-100 hover:bg-amber-200 transition-colors text-center cursor-pointer border border-amber-200/60 shadow-xs"
          >
            Ca Sáng
          </button>
        );
      case "afternoon":
        return (
          <button
            onClick={onClick}
            title="Ca Chiều: 14:00 - 22:00"
            className="w-full py-1.5 px-2 rounded-md font-medium text-xs text-blue-800 bg-blue-100 hover:bg-blue-200 transition-colors text-center cursor-pointer border border-blue-200/60 shadow-xs"
          >
            Ca Chiều
          </button>
        );
      case "night":
        return (
          <button
            onClick={onClick}
            title="Ca Đêm: 22:00 - 06:00"
            className="w-full py-1.5 px-2 rounded-md font-medium text-xs text-purple-900 bg-purple-100 hover:bg-purple-200 transition-colors text-center cursor-pointer border border-purple-200/60 shadow-xs"
          >
            Ca Đêm
          </button>
        );
      case "off":
      default:
        return (
          <button
            onClick={onClick}
            title="Nghỉ ca"
            className="w-full py-1.5 px-2 rounded-md font-medium text-xs text-gray-400 bg-transparent hover:bg-gray-100 transition-colors text-center cursor-pointer"
          >
            -
          </button>
        );
    }
  };

  /* ══════════════════════════════════════════════════════════
     RENDER SECTIONS
  ══════════════════════════════════════════════════════════ */

  // ── 1. HEADER ──
  const Header = (
    <header className="h-16 bg-white border-b border-gray-100 px-6 flex items-center justify-between z-30 flex-shrink-0">
      {/* Brand logo & title */}
      <div className="flex items-center gap-3">
        {/* Gold Crown Logo */}
        <div className="w-8 h-8 flex items-center justify-center text-amber-600">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-[#C5A059]">
            <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif font-bold text-gray-900 text-lg tracking-wide">
              MaM Hotel <span className="font-sans font-normal text-gray-400">-</span> Human Resources
            </h1>
          </div>
          <p className="text-[10px] tracking-widest text-gray-400 uppercase font-medium">
            PEOPLE MAKE EXCEPTIONAL STAYS
          </p>
        </div>
      </div>

      {/* Center Search Input */}
      <div className="flex-1 max-w-md mx-8">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            placeholder="Tìm nhân viên, chức vụ, bộ phận..."
            className="w-full bg-[#F5F6F8] hover:bg-[#EEF0F3] focus:bg-white text-gray-800 text-xs rounded-full pl-9 pr-4 py-2 border border-transparent focus:border-emerald-500 focus:outline-none transition-all placeholder:text-gray-400 shadow-xs"
          />
        </div>
      </div>

      {/* Right User Bar */}
      <div className="flex items-center gap-5">
        {/* Date display */}
        <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span>{todayLabel}</span>
        </div>

        <div className="h-4 w-px bg-gray-200" />

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors relative cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {totalUnreadNotifs > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </button>

          {/* Notifications dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">Thông báo nhân sự</span>
                <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-semibold">
                  {totalUnreadNotifs} mới
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 text-xs">
                {totalUnreadNotifs === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-xs">Không có thông báo mới</div>
                ) : (
                  <>
                    {pendingLeaves.map(leave => (
                      <div
                        key={`leave-${leave.id}`}
                        onClick={() => { setCurrentTab("leaves"); setShowNotifications(false); }}
                        className="p-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <p className="font-semibold text-gray-800">{leave.type}</p>
                        <p className="text-gray-500 text-[11px] mt-0.5">{leave.employeeName} ({leave.department}) xin nghỉ {leave.dateRange}.</p>
                        <span className="text-[10px] text-gray-400 mt-1 block">{leave.submittedAt || "Mới"}</span>
                      </div>
                    ))}
                    {pendingApprovals.map(appr => (
                      <div
                        key={`appr-${appr.id}`}
                        onClick={() => { setCurrentTab("schedule"); setShowNotifications(false); }}
                        className="p-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <p className="font-semibold text-gray-800">{appr.typeLabel || "Yêu cầu phê duyệt"}</p>
                        <p className="text-gray-500 text-[11px] mt-0.5">{appr.name}: {appr.reason || appr.department}</p>
                        <span className="text-[10px] text-gray-400 mt-1 block">{appr.date || "Mới"}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative">
          <div
            onClick={() => setTopProfileOpen(p => !p)}
            className="flex items-center gap-3 pl-1 cursor-pointer"
            title="Hồ sơ nhân viên"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center ring-2 ring-emerald-600/20">
              {userProfile?.full_name ? userProfile.full_name.slice(0, 2).toUpperCase() : "HR"}
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-gray-900 leading-tight">{userProfile?.full_name || "Nhân viên Nhân sự"}</p>
              <p className="text-[11px] text-gray-400 leading-tight">{userProfile?.role || "Quản lý nhân sự"}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <EmployeeProfileDropdown
            isOpen={topProfileOpen}
            onClose={() => setTopProfileOpen(false)}
            onLogout={onBack}
            align="top-right"
            currentRoleLabel={userProfile?.role || "Quản lý Nhân sự"}
            departmentName="Bộ phận Nhân sự"
          />
        </div>
      </div>
    </header>
  );

  // ── 2. SIDEBAR NAVIGATION ──
  const Sidebar = (
    <aside className="w-56 bg-white border-r border-gray-100 flex flex-col justify-between shrink-0">
      <nav className="p-3 space-y-1">
        <button
          onClick={() => setCurrentTab("overview")}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
            currentTab === "overview"
              ? "bg-[#EAF8F0] text-[#008A4B] font-semibold"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          <LayoutDashboard className={`w-4 h-4 ${currentTab === "overview" ? "text-[#008A4B]" : "text-gray-400"}`} />
          <span>Tổng quan</span>
        </button>

        <button
          onClick={() => setCurrentTab("schedule")}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
            currentTab === "schedule"
              ? "bg-[#EAF8F0] text-[#008A4B] font-semibold"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          <CalendarDays className={`w-4 h-4 ${currentTab === "schedule" ? "text-[#008A4B]" : "text-gray-400"}`} />
          <span>Lịch phân ca</span>
        </button>

        <button
          onClick={() => setCurrentTab("staff")}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
            currentTab === "staff"
              ? "bg-[#EAF8F0] text-[#008A4B] font-semibold"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          <Users className={`w-4 h-4 ${currentTab === "staff" ? "text-[#008A4B]" : "text-gray-400"}`} />
          <span>Hồ sơ nhân sự</span>
          <span className="ml-auto text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
            {employees.length}
          </span>
        </button>

        <button
          onClick={() => setCurrentTab("attendance")}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
            currentTab === "attendance"
              ? "bg-[#EAF8F0] text-[#008A4B] font-semibold"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          <Clock className={`w-4 h-4 ${currentTab === "attendance" ? "text-[#008A4B]" : "text-gray-400"}`} />
          <span>Chấm công</span>
        </button>

        <button
          onClick={() => setCurrentTab("leaves")}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
            currentTab === "leaves"
              ? "bg-[#EAF8F0] text-[#008A4B] font-semibold"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          <FileText className={`w-4 h-4 ${currentTab === "leaves" ? "text-[#008A4B]" : "text-gray-400"}`} />
          <span>Đơn nghỉ phép</span>
          {pendingApprovals.length > 0 && (
            <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {pendingApprovals.length}
            </span>
          )}
        </button>
      </nav>

      {/* Profile */}
      <div style={{ padding:"10px 14px",borderTop:"1px solid #F1F5F9",position:"relative" }}>
        <div
          onClick={() => setSidebarProfileOpen(p => !p)}
          style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer" }}
          title="Hồ sơ nhân viên"
        >
          <div style={{ width:30,height:30,borderRadius:99,flexShrink:0,
            background:"linear-gradient(135deg,#1D4ED8,#3B82F6)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:12,fontWeight:800,color:"#FFF" }}>
            {userProfile?.full_name ? userProfile.full_name.slice(0, 2).toUpperCase() : "HR"}
          </div>
          <div style={{ textAlign:"left" }}>
            <p style={{ fontSize:11,fontWeight:700,color:"#0F172A",lineHeight:1 }}>{userProfile?.full_name || "Quản lý Nhân sự"}</p>
            <p style={{ fontSize:10,color:"#94A3B8" }}>{userProfile?.role || "Bộ phận Nhân sự"}</p>
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
          currentRoleLabel={userProfile?.role || "Quản lý Nhân sự"}
          departmentName="Bộ phận Nhân sự"
        />
      </div>
    </aside>
  );

  // ── 3. TOP 4 METRIC CARDS (Exact match to reference mockup) ──
  const TopMetricCards = (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {/* 1. Đang trong ca trực */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between relative overflow-hidden">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#EAF8F0] flex items-center justify-center text-[#008A4B]">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Đang trong ca trực</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-bold text-gray-900 font-serif">{shiftCounts.totalActive}</span>
              <span className="text-xs text-gray-500 font-medium">nhân viên</span>
            </div>
          </div>
        </div>
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 self-start mt-1 mr-1" />
      </div>

      {/* 2. Nghỉ ca hôm nay */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between relative overflow-hidden">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-400">
            <BedDouble className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Nghỉ ca hôm nay</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-bold text-gray-900 font-serif">{shiftCounts.off}</span>
              <span className="text-xs text-gray-500 font-medium">nhân viên</span>
            </div>
          </div>
        </div>
        <div className="w-2.5 h-2.5 rounded-full bg-red-400 self-start mt-1 mr-1" />
      </div>

      {/* 3. Nghỉ phép có phép */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between relative overflow-hidden">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Nghỉ phép có phép</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-bold text-gray-900 font-serif">{leaveTodayList.length}</span>
              <span className="text-xs text-gray-500 font-medium">nhân viên</span>
            </div>
          </div>
        </div>
        <div className="w-2.5 h-2.5 rounded-full bg-purple-500 self-start mt-1 mr-1" />
      </div>

      {/* 4. Điểm danh đúng giờ */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between relative overflow-hidden">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Điểm danh đúng giờ</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-bold text-gray-900 font-serif">
                {attendanceRecords.length > 0
                  ? `${Math.round((attendanceRecords.filter(r => r.status === "Đúng giờ").length / attendanceRecords.length) * 100)}%`
                  : "—"}
              </span>
            </div>
          </div>
        </div>
        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 self-start mt-1 mr-1" />
      </div>
    </div>
  );

  // ── 4. TAB: LỊCH PHÂN CA (EXACT MATCH TO REFERENCE IMAGE) ──
  const filteredScheduleGroups = useMemo(() => {
    return scheduleData.filter(dept => {
      if (selectedDeptFilter !== "all" && dept.id !== selectedDeptFilter) return false;
      return true;
    });
  }, [scheduleData, selectedDeptFilter]);

  const ScheduleView = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Center Table (approx 8.5 cols) */}
      <div className="lg:col-span-8 xl:col-span-9 bg-white rounded-2xl border border-gray-100 shadow-xs p-5 flex flex-col">
        {/* Table Top Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold text-gray-900 font-serif">
            Lịch trực theo tuần
          </h2>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Department dropdown */}
            <div className="relative">
              <select
                value={selectedDeptFilter}
                onChange={e => setSelectedDeptFilter(e.target.value)}
                className="appearance-none bg-white border border-gray-200 text-xs font-medium text-gray-700 rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
              >
                <option value="all">Theo bộ phận</option>
                <option value="reception">Bộ phận Lễ tân</option>
                <option value="housekeeping">Bộ phận Buồng phòng</option>
                <option value="fnb">Bộ phận Bếp & F&B</option>
                <option value="technical">Bộ phận Kỹ thuật</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Date navigation */}
            <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden shadow-2xs">
              <button
                onClick={() => showToast("Đang tải lịch tuần trước...")}
                className="px-2 py-1.5 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors cursor-pointer border-r border-gray-200"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>{weekRangeLabel}</span>
              </div>
              <button
                onClick={() => showToast("Đang tải lịch tuần tiếp theo...")}
                className="px-2 py-1.5 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors cursor-pointer border-l border-gray-200"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* "Hôm nay" button */}
            <button
              onClick={() => showToast(`Đang hiển thị tuần hiện tại (${today.toLocaleDateString("vi-VN")})`)}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs"
            >
              Hôm nay
            </button>
          </div>
        </div>

        {/* Weekly Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F8F9FA] text-[11px] font-semibold text-gray-600 border-b border-gray-100">
                <th className="py-2.5 px-3 text-left w-48 font-medium">Nhân viên</th>
                <th className="py-2.5 px-2 text-center font-medium">
                  <div>T2</div>
                  <div className="text-[10px] text-gray-400 font-normal">14/09</div>
                </th>
                <th className="py-2.5 px-2 text-center font-medium">
                  <div>T3</div>
                  <div className="text-[10px] text-gray-400 font-normal">15/09</div>
                </th>
                <th className="py-2.5 px-2 text-center font-medium">
                  <div>T4</div>
                  <div className="text-[10px] text-gray-400 font-normal">16/09</div>
                </th>
                <th className="py-2.5 px-2 text-center font-medium">
                  <div>T5</div>
                  <div className="text-[10px] text-gray-400 font-normal">17/09</div>
                </th>
                {/* T6 18/09 Highlighted as Today */}
                <th className="py-2.5 px-2 text-center font-semibold text-[#008A4B] bg-emerald-50/40 border-x border-emerald-100/50">
                  <div>T6</div>
                  <div className="text-[10px] text-[#008A4B]">18/09</div>
                </th>
                <th className="py-2.5 px-2 text-center font-medium">
                  <div>T7</div>
                  <div className="text-[10px] text-gray-400 font-normal">19/09</div>
                </th>
                <th className="py-2.5 px-2 text-center font-medium">
                  <div>CN</div>
                  <div className="text-[10px] text-gray-400 font-normal">20/09</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredScheduleGroups.map(dept => {
                const Icon = dept.icon;
                const isCollapsed = collapsedDepts[dept.id];
                return (
                  <div key={dept.id} className="contents">
                    {/* Department Header Row */}
                    <tr className="border-t border-gray-100 bg-gray-50/50">
                      <td colSpan={8} className="py-2 px-3">
                        <button
                          onClick={() => toggleDeptCollapse(dept.id)}
                          className="flex items-center gap-2 text-xs font-semibold text-gray-800 hover:text-emerald-700 transition-colors cursor-pointer"
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-gray-500 transition-transform ${
                              isCollapsed ? "-rotate-90" : ""
                            }`}
                          />
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                            style={{ backgroundColor: dept.badgeBg, color: dept.badgeText }}
                          >
                            <Icon className="w-3 h-3" />
                          </div>
                          <span>
                            {dept.name}{" "}
                            <span className="text-gray-400 font-normal">({dept.employees.length})</span>
                          </span>
                        </button>
                      </td>
                    </tr>

                    {/* Employee rows */}
                    {!isCollapsed &&
                      dept.employees.map(emp => (
                        <tr
                          key={emp.id}
                          className="border-b border-gray-100 hover:bg-gray-50/70 transition-colors"
                        >
                          {/* Employee info */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={emp.avatar}
                                alt={emp.name}
                                className="w-7 h-7 rounded-full object-cover ring-1 ring-gray-200"
                              />
                              <span className="text-xs font-medium text-gray-800 whitespace-nowrap">
                                {emp.name}
                              </span>
                            </div>
                          </td>

                          {/* 7 Days Shifts */}
                          {emp.shifts.map((s, idx) => {
                            const isToday = s.day === "T6";
                            return (
                              <td
                                key={idx}
                                className={`py-2 px-1 text-center ${
                                  isToday ? "bg-emerald-50/20 border-x border-emerald-100/30" : ""
                                }`}
                              >
                                {renderShiftBadge(s.shift, () =>
                                  setEditingShift({
                                    employeeId: emp.id,
                                    employeeName: emp.name,
                                    dayIndex: idx,
                                    currentShift: s.shift
                                  })
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </div>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Column: Attendance & Leaves Today (approx 3.5 cols) */}
      <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-xs p-5 flex flex-col justify-between">
        <div>
          {/* Header Link */}
          <div
            onClick={() => setCurrentTab("leaves")}
            className="flex items-center justify-between cursor-pointer group mb-4 pb-2 border-b border-gray-100"
          >
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors font-serif">
              Điểm danh & Nghỉ phép hôm nay
            </h3>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all" />
          </div>

          {/* Section 1: Nhân viên nghỉ phép hôm nay */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-800 mb-3">
              <BedDouble className="w-4 h-4 text-emerald-600" />
              <span>Nhân viên nghỉ phép hôm nay ({leaveTodayList.length})</span>
            </div>

            <div className="space-y-3">
              {leaveTodayList.length === 0 && <p className="text-xs text-gray-400 italic py-3 text-center">Hôm nay chưa có nhân viên nghỉ phép.</p>}
              {leaveTodayList.map(item => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={item.avatar}
                      alt={item.name}
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-100"
                    />
                    <div>
                      <p className="text-xs font-semibold text-gray-900 leading-tight">{item.name}</p>
                      <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{item.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>{item.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Đang chờ duyệt nghỉ phép */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-800 mb-3">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>Đang chờ duyệt nghỉ phép ({pendingApprovals.length})</span>
            </div>

            {pendingApprovals.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-3 text-center">Không có yêu cầu chờ duyệt.</p>
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map(item => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-gray-50/70 border border-gray-100 hover:border-gray-200 transition-colors"
                  >
                    {/* Header: User info + date */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={item.avatar}
                          alt={item.name}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <div>
                          <p className="text-xs font-semibold text-gray-900">{item.name}</p>
                          <p className="text-[10px] text-gray-400">{item.department}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-semibold text-gray-700 block">
                          {item.typeLabel}
                        </span>
                        <span className="text-[10px] text-gray-400">{item.date}</span>
                      </div>
                    </div>

                    {/* Reason text */}
                    <p className="text-[11px] text-gray-600 mt-2 italic leading-relaxed">
                      "{item.reason}"
                    </p>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-200/50">
                      <button
                        onClick={() => handleApproveRequest(item)}
                        className="flex-1 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer text-center shadow-xs"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectRequest(item)}
                        className="flex-1 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-300 rounded-lg text-xs font-medium transition-colors cursor-pointer text-center"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 text-center">
          <p className="text-[11px] text-gray-400">Dữ liệu tự động cập nhật theo ca trực thời gian thực</p>
        </div>
      </div>
    </div>
  );

  // ── 5. TAB 1: TỔNG QUAN (HR EXECUTIVE OVERVIEW) ──
  const OverviewView = (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl p-6 text-white relative overflow-hidden shadow-sm">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 bg-emerald-700/60 border border-emerald-500/30 text-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider mb-2">
            ● Báo cáo điều hành nhân sự hôm nay
          </span>
          <h2 className="text-2xl font-serif font-bold text-white mb-1">
            Xin chào, {userProfile?.full_name || "Quản lý Nhân sự"}
          </h2>
          <p className="text-emerald-100/80 text-xs leading-relaxed">
            Hôm nay có {shiftCounts.totalActive}/{employees.length} nhân viên đang trong ca trực hoạt động. Bạn có {totalUnreadNotifs} yêu cầu duyệt đang chờ xử lý.
          </p>
        </div>
        <div className="absolute right-4 -bottom-6 w-48 h-48 rounded-full bg-emerald-600/20 blur-2xl pointer-events-none" />
      </div>

      {/* Top metrics */}
      {TopMetricCards}

      {/* Row 2: Headcount breakdown & Live Shifts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Headcount by department */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif font-bold text-gray-900 text-sm">Phân bổ nhân sự theo phòng ban</h3>
            <span className="text-xs text-gray-400 font-medium">Tổng: 65 nhân sự</span>
          </div>

          <div className="space-y-3.5">
            {[
              { name: "Bộ phận Buồng phòng", count: 20, pct: 31, color: "bg-blue-500" },
              { name: "Bộ phận Bếp & F&B", count: 16, pct: 25, color: "bg-emerald-500" },
              { name: "Bộ phận Lễ tân", count: 12, pct: 18, color: "bg-amber-500" },
              { name: "Bộ phận Kỹ thuật & Bảo trì", count: 8, pct: 12, color: "bg-purple-500" },
              { name: "Kế toán & Tài chính", count: 5, pct: 8, color: "bg-indigo-500" },
              { name: "Khối Quản lý & Điều hành", count: 4, pct: 6, color: "bg-gray-700" },
            ].map(item => (
              <div key={item.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-gray-700">{item.name}</span>
                  <span className="text-gray-500 font-semibold">{item.count} nhân viên ({item.pct}%)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Shift Monitor */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-gray-900 text-sm">Giám sát ca trực thời gian thực</h3>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                ● {today.toLocaleDateString("vi-VN")}
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                    CS
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">Ca Sáng (06:00 - 14:00)</p>
                    <p className="text-[11px] text-gray-500">
                      {shiftCounts.morning > 0 ? `${shiftCounts.morning} nhân viên theo lịch phân ca` : "Chưa có nhân viên phân ca"}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-white px-2.5 py-1 rounded-md shadow-2xs">
                  {shiftCounts.morning > 0 ? "Đã xếp ca" : "Trống"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                    CC
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">Ca Chiều (14:00 - 22:00)</p>
                    <p className="text-[11px] text-gray-500">
                      {shiftCounts.afternoon > 0 ? `${shiftCounts.afternoon} nhân viên theo lịch phân ca` : "Chưa có nhân viên phân ca"}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-blue-600 bg-white px-2.5 py-1 rounded-md shadow-2xs">
                  {shiftCounts.afternoon > 0 ? "Đã xếp ca" : "Trống"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">
                    CĐ
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">Ca Đêm (22:00 - 06:00)</p>
                    <p className="text-[11px] text-gray-500">
                      {shiftCounts.night > 0 ? `${shiftCounts.night} nhân viên theo lịch phân ca` : "Chưa có nhân viên phân ca"}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-500 bg-white px-2.5 py-1 rounded-md shadow-2xs">
                  {shiftCounts.night > 0 ? "Đã xếp ca" : "Trống"}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Tự động đồng bộ với hệ thống máy chấm công</span>
            <button
              onClick={() => setCurrentTab("attendance")}
              className="text-emerald-700 font-semibold hover:underline"
            >
              Chi tiết chấm công →
            </button>
          </div>
        </div>
      </div>

      {/* Row 3: Contracts alerts & Quick Action Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Alerts & Reminders */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
          <h3 className="font-serif font-bold text-gray-900 text-sm mb-3">
            Cảnh báo nghiệp vụ nhân sự cần chú ý
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-orange-50/80 border border-orange-100">
              <div className="flex items-center gap-2 text-orange-800 text-xs font-bold mb-1">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <span>Tái ký hợp đồng (3)</span>
              </div>
              <p className="text-[11px] text-gray-600">
                3 nhân viên hết hạn HĐLĐ trong 30 ngày tới cần lập tờ trình gia hạn.
              </p>
              <button
                onClick={() => setCurrentTab("staff")}
                className="mt-2 text-[11px] font-semibold text-orange-700 hover:underline"
              >
                Xem danh sách →
              </button>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-100">
              <div className="flex items-center gap-2 text-blue-800 text-xs font-bold mb-1">
                <Award className="w-4 h-4 text-blue-600" />
                <span>Xét duyệt thử việc (2)</span>
              </div>
              <p className="text-[11px] text-gray-600">
                Đỗ Hương & 1 nhân sự hoàn thành 2 tháng thử việc cần đánh giá KPI.
              </p>
              <button
                onClick={() => setCurrentTab("staff")}
                className="mt-2 text-[11px] font-semibold text-blue-700 hover:underline"
              >
                Đánh giá KPI →
              </button>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-100">
              <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold mb-1">
                <Coffee className="w-4 h-4 text-emerald-600" />
                <span>Sinh nhật tháng 9 (4)</span>
              </div>
              <p className="text-[11px] text-gray-600">
                Lên danh sách gửi quà và thiệp chúc mừng sinh nhật cán bộ nhân viên.
              </p>
              <button
                onClick={() => showToast("Đã gửi email chúc mừng sinh nhật tháng 9!")}
                className="mt-2 text-[11px] font-semibold text-emerald-700 hover:underline"
              >
                Gửi chúc mừng →
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-gray-100 shadow-xs flex flex-col justify-between">
          <h3 className="font-serif font-bold text-gray-900 text-sm mb-3">Tác vụ nhanh</h3>
          <div className="space-y-2">
            <button
              onClick={() => setIsAddEmployeeModalOpen(true)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gray-50 hover:bg-emerald-50 text-gray-700 hover:text-emerald-800 text-xs font-medium transition-colors cursor-pointer border border-gray-100 hover:border-emerald-200"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Thêm nhân viên mới</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </button>

            <button
              onClick={() => setCurrentTab("schedule")}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gray-50 hover:bg-emerald-50 text-gray-700 hover:text-emerald-800 text-xs font-medium transition-colors cursor-pointer border border-gray-100 hover:border-emerald-200"
            >
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-600" />
                <span>Phân ca tuần tiếp theo</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </button>

            <button
              onClick={() => {
                setCurrentTab("leaves");
                setIsCreateLeaveModalOpen(true);
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gray-50 hover:bg-emerald-50 text-gray-700 hover:text-emerald-800 text-xs font-medium transition-colors cursor-pointer border border-gray-100 hover:border-emerald-200"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Tạo đơn xin nghỉ / đổi ca</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
          <div className="mt-3" />
        </div>
      </div>
    </div>
  );

  // ── 6. TAB 3: HỒ SƠ NHÂN SỰ (STAFF DIRECTORY) ──
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (staffFilterDept !== "all" && emp.departmentId !== staffFilterDept) return false;
      if (staffFilterStatus !== "all" && emp.status !== staffFilterStatus) return false;
      if (globalSearch) {
        const q = globalSearch.toLowerCase();
        return (
          emp.name.toLowerCase().includes(q) ||
          emp.role.toLowerCase().includes(q) ||
          emp.id.toLowerCase().includes(q) ||
          emp.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [employees, staffFilterDept, staffFilterStatus, globalSearch]);

  const StaffView = (
    <div className="space-y-5">
      {/* Top action & filter bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Dept filter */}
          <div className="relative">
            <select
              value={staffFilterDept}
              onChange={e => setStaffFilterDept(e.target.value)}
              className="appearance-none bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700 rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
            >
              <option value="all">Tất cả phòng ban</option>
              <option value="reception">Bộ phận Lễ tân</option>
              <option value="housekeeping">Bộ phận Buồng phòng</option>
              <option value="fnb">Bộ phận Bếp & F&B</option>
              <option value="technical">Bộ phận Kỹ thuật</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={staffFilterStatus}
              onChange={e => setStaffFilterStatus(e.target.value)}
              className="appearance-none bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700 rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="Đang làm việc">Đang làm việc</option>
              <option value="Thử việc">Thử việc</option>
              <option value="Tạm hoãn">Tạm hoãn</option>
              <option value="Đã nghỉ việc">Đã nghỉ việc</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <span className="text-xs text-gray-500 ml-2">
            Tìm thấy <strong>{filteredEmployees.length}</strong> nhân sự
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => showToast("Đang xuất danh sách hồ sơ nhân sự ra file Excel...")}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Xuất Excel</span>
          </button>

          <button
            onClick={() => setIsAddEmployeeModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm nhân viên mới</span>
          </button>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FA] text-[11px] font-semibold text-gray-600 border-b border-gray-100 uppercase tracking-wider">
                <th className="py-3 px-4">Mã NV</th>
                <th className="py-3 px-4">Nhân viên</th>
                <th className="py-3 px-4">Bộ phận</th>
                <th className="py-3 px-4">Liên hệ</th>
                <th className="py-3 px-4">Hợp đồng</th>
                <th className="py-3 px-4">Ngày vào làm</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-semibold text-gray-700">
                    {emp.id}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={emp.avatar}
                        alt={emp.name}
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-200"
                      />
                      <div>
                        <p className="font-semibold text-gray-900 leading-tight">{emp.name}</p>
                        <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{emp.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-gray-700 font-medium">
                    {emp.department}
                  </td>
                  <td className="py-3.5 px-4 text-gray-600">
                    <p className="text-[11px]">{emp.phone}</p>
                    <p className="text-[10px] text-gray-400">{emp.email}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      emp.contractType === "Chính thức"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                        : emp.contractType === "Thử việc"
                        ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                        : "bg-blue-50 text-blue-700 border border-blue-200/60"
                    }`}>
                      {emp.contractType}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-gray-600 font-mono text-[11px]">
                    {emp.joinDate}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 text-[11px] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {emp.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => setSelectedEmployee(emp)}
                      className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer border border-emerald-200/60"
                    >
                      Xem hồ sơ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ── 7. TAB 4: CHẤM CÔNG (TIME & ATTENDANCE) ──
  const AttendanceView = (
    <div className="space-y-5">
      {/* Attendance KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Đúng giờ hôm nay</p>
            <p className="text-2xl font-serif font-bold text-gray-900 mt-1">{attendanceSummary.onTime} / {attendanceSummary.total}</p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Tỷ lệ: {attendanceSummary.total ? `${attendanceSummary.rate}%` : "—"}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Đi muộn hôm nay</p>
            <p className="text-2xl font-serif font-bold text-amber-700 mt-1">{attendanceSummary.late}</p>
            <p className="text-[11px] text-amber-600 font-semibold mt-0.5">Theo trạng thái máy chấm công</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Vắng mặt không phép</p>
            <p className="text-2xl font-serif font-bold text-gray-900 mt-1">{attendanceSummary.absent}</p>
            <p className="text-[11px] text-gray-500 font-semibold mt-0.5">Theo ngày đã chọn</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Chưa chấm ra</p>
            <p className="text-2xl font-serif font-bold text-blue-700 mt-1">{attendanceSummary.incomplete}</p>
            <p className="text-[11px] text-blue-600 font-semibold mt-0.5">Có giờ vào nhưng chưa có giờ ra</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* View mode toggle */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setAttendanceViewMode("daily")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                attendanceViewMode === "daily" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Chấm công theo ngày
            </button>
            <button
              onClick={() => setAttendanceViewMode("monthly")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                attendanceViewMode === "monthly" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Bảng tổng hợp tháng {currentMonthLabel}
            </button>
          </div>

          {/* Date Picker */}
          {attendanceViewMode === "daily" && (
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <input
                type="date"
                value={attendanceDate}
                onChange={e => setAttendanceDate(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncBiometrics}
            disabled={isSyncingBiometrics}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${isSyncingBiometrics ? "animate-spin" : ""}`} />
            <span>{isSyncingBiometrics ? "Đang đồng bộ..." : "Đồng bộ máy vân tay"}</span>
          </button>

          <label htmlFor="biometric-file-import" className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs">
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Nhập file chấm công</span>
            <input id="biometric-file-import" type="file" accept=".csv,.json,application/json,text/csv" onChange={handleImportAttendanceFile} className="hidden" />
          </label>

          <button
            onClick={() => showToast("Đang tải bảng chấm công Excel...")}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Xuất báo cáo</span>
          </button>
        </div>
      </div>

      {/* Attendance Table */}
      {attendanceViewMode === "daily" ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8F9FA] text-[11px] font-semibold text-gray-600 border-b border-gray-100 uppercase tracking-wider">
                  <th className="py-3 px-4">Nhân viên</th>
                  <th className="py-3 px-4">Bộ phận</th>
                  <th className="py-3 px-4">Ca trực</th>
                  <th className="py-3 px-4">Nhận phòng</th>
                  <th className="py-3 px-4">Trả phòng</th>
                  <th className="py-3 px-4">Tổng giờ</th>
                  <th className="py-3 px-4">Đi muộn</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-center">Điều chỉnh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {attendanceRecords.length === 0 && (
                  <tr><td colSpan={9} className="py-8 px-4 text-center text-xs text-gray-400">Chưa có dữ liệu chấm công cho ngày đang chọn. Có thể nhập file máy vân tay để ghi nhận vào hệ thống.</td></tr>
                )}
                {attendanceRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={rec.avatar}
                          alt={rec.employeeName}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">{rec.employeeName}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{rec.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">{rec.department}</td>
                    <td className="py-3.5 px-4 text-gray-600 font-medium">{rec.shiftName}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-800">{rec.checkIn}</td>
                    <td className="py-3.5 px-4 font-mono text-gray-600">{rec.checkOut}</td>
                    <td className="py-3.5 px-4 font-medium text-gray-800">{rec.workHours}</td>
                    <td className="py-3.5 px-4">
                      {rec.lateMinutes > 0 ? (
                        <span className="text-red-600 font-bold">+{rec.lateMinutes} phút</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        rec.status === "Đúng giờ"
                          ? "bg-emerald-50 text-emerald-700"
                          : rec.status === "Đi muộn"
                          ? "bg-red-50 text-red-600"
                          : "bg-blue-50 text-blue-600"
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => showToast(`Mở hộp thoại điều chỉnh giờ công cho ${rec.employeeName}`)}
                        className="text-xs text-gray-500 hover:text-emerald-700 font-medium cursor-pointer"
                      >
                        Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Monthly Summary Mode */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif font-bold text-gray-900 text-sm">Bảng tổng hợp công tháng {currentMonthLabel}</h3>
            <span className="text-xs text-gray-500">Tiêu chuẩn: 26 ngày công</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F8F9FA] text-[11px] font-semibold text-gray-600 border-b border-gray-100 uppercase">
                  <th className="py-3 px-4">Mã NV</th>
                  <th className="py-3 px-4">Họ và tên</th>
                  <th className="py-3 px-4">Bộ phận</th>
                  <th className="py-3 px-4 text-center">Công chuẩn</th>
                  <th className="py-3 px-4 text-center">Công thực tế</th>
                  <th className="py-3 px-4 text-center">Nghỉ phép (hưởng lương)</th>
                  <th className="py-3 px-4 text-center">Giờ OT</th>
                  <th className="py-3 px-4 text-center">Tỷ lệ chuyên cần</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-gray-50/70">
                    <td className="py-3 px-4 font-mono font-medium">{emp.id}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{emp.name}</td>
                    <td className="py-3 px-4 text-gray-600">{emp.department}</td>
                    <td className="py-3 px-4 text-center font-mono">—</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-gray-400">—</td>
                    <td className="py-3 px-4 text-center font-mono">—</td>
                    <td className="py-3 px-4 text-center font-mono text-gray-400">—</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        Chưa có dữ liệu
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // ── 8. TAB 5: ĐƠN NGHỈ PHÉP (LEAVE & SHIFT SWAP MANAGEMENT) ──
  const filteredLeaveRequests = useMemo(() => {
    return leaveRequests.filter(req => {
      if (leaveTabFilter === "all") return true;
      return req.status === leaveTabFilter;
    });
  }, [leaveRequests, leaveTabFilter]);

  const LeavesView = (
    <div className="space-y-5">
      {/* Top action and tabs */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          {[
            { key: "all", label: "Tất cả đơn", count: leaveRequests.length },
            { key: "pending", label: "Chờ duyệt", count: leaveRequests.filter(r => r.status === "pending").length },
            { key: "approved", label: "Đã phê duyệt", count: leaveRequests.filter(r => r.status === "approved").length },
            { key: "rejected", label: "Từ chối", count: leaveRequests.filter(r => r.status === "rejected").length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setLeaveTabFilter(tab.key as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                leaveTabFilter === tab.key ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                leaveTabFilter === tab.key ? "bg-gray-100 text-gray-700" : "bg-gray-200 text-gray-600"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setIsCreateLeaveModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo đơn thay nhân viên</span>
        </button>
      </div>

      {/* Requests list */}
      <div className="space-y-3">
        {filteredLeaveRequests.length === 0 && (
          <p className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-xs text-gray-400">Chưa có đơn nghỉ phép hoặc đổi ca.</p>
        )}
        {filteredLeaveRequests.map(req => (
          <div
            key={req.id}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs hover:border-gray-200 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            {/* Left: User & Request info */}
            <div className="flex items-start gap-3.5">
              <img
                src={req.avatar}
                alt={req.employeeName}
                className="w-10 h-10 rounded-full object-cover ring-1 ring-gray-100 mt-0.5"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-gray-500">{req.id}</span>
                  <span className="font-bold text-sm text-gray-900">{req.employeeName}</span>
                  <span className="text-xs text-gray-400">({req.department})</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    req.type === "Đổi ca trực"
                      ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                      : req.type === "Nghỉ ốm"
                      ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                      : "bg-purple-50 text-purple-700 border border-purple-200/60"
                  }`}>
                    {req.type}
                  </span>
                </div>

                <p className="text-xs text-gray-700 mt-1 italic">
                  "{req.reason}"
                </p>

                <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-1.5">
                  <span>Thời gian xin nghỉ/đổi: <strong className="text-gray-700">{req.dateRange}</strong> ({req.totalDays})</span>
                  <span>•</span>
                  <span>Gửi lúc: {req.submittedAt}</span>
                  {req.approver && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-700 font-medium">Người duyệt: {req.approver}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions / Status */}
            <div className="flex items-center gap-2 self-end md:self-center">
              {req.status === "pending" ? (
                <>
                  <button
                    onClick={() => void decideLeave(req, true)}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    Phê duyệt
                  </button>
                  <button
                    onClick={() => void decideLeave(req, false)}
                    className="px-4 py-2 bg-white hover:bg-red-50 text-red-600 border border-red-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Từ chối
                  </button>
                </>
              ) : req.status === "approved" ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <Check className="w-3.5 h-3.5" /> Đã duyệt
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                  <X className="w-3.5 h-3.5" /> Đã từ chối
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════
     MODALS & DRAWERS
  ══════════════════════════════════════════════════════════ */

  // Modal: Quick Shift Change
  const ShiftEditModal = editingShift && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
          <div>
            <h3 className="font-serif font-bold text-gray-900 text-sm">Chỉnh sửa ca làm việc</h3>
            <p className="text-xs text-gray-500 mt-0.5">{editingShift.employeeName}</p>
          </div>
          <button
            onClick={() => setEditingShift(null)}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-600 mb-3">Chọn ca làm việc mới:</p>

        <div className="space-y-2">
          <button
            onClick={() => handleUpdateShift("morning")}
            className="w-full py-2.5 px-3 rounded-xl font-medium text-xs text-amber-900 bg-amber-100 hover:bg-amber-200 transition-colors text-left flex items-center justify-between cursor-pointer border border-amber-200"
          >
            <span>Ca Sáng (06:00 - 14:00)</span>
            {editingShift.currentShift === "morning" && <Check className="w-4 h-4 text-amber-900" />}
          </button>

          <button
            onClick={() => handleUpdateShift("afternoon")}
            className="w-full py-2.5 px-3 rounded-xl font-medium text-xs text-blue-800 bg-blue-100 hover:bg-blue-200 transition-colors text-left flex items-center justify-between cursor-pointer border border-blue-200"
          >
            <span>Ca Chiều (14:00 - 22:00)</span>
            {editingShift.currentShift === "afternoon" && <Check className="w-4 h-4 text-blue-800" />}
          </button>

          <button
            onClick={() => handleUpdateShift("night")}
            className="w-full py-2.5 px-3 rounded-xl font-medium text-xs text-purple-900 bg-purple-100 hover:bg-purple-200 transition-colors text-left flex items-center justify-between cursor-pointer border border-purple-200"
          >
            <span>Ca Đêm (22:00 - 06:00)</span>
            {editingShift.currentShift === "night" && <Check className="w-4 h-4 text-purple-900" />}
          </button>

          <button
            onClick={() => handleUpdateShift("off")}
            className="w-full py-2.5 px-3 rounded-xl font-medium text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors text-left flex items-center justify-between cursor-pointer border border-gray-200"
          >
            <span>Nghỉ ca (-)</span>
            {editingShift.currentShift === "off" && <Check className="w-4 h-4 text-gray-700" />}
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={() => setEditingShift(null)}
            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );

  // Modal: Add Employee
  const AddEmployeeModal = isAddEmployeeModalOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
          <div>
            <h3 className="font-serif font-bold text-gray-900 text-base">Thêm hồ sơ nhân viên mới</h3>
            <p className="text-xs text-gray-400 mt-0.5">Nhập đầy đủ thông tin nhân sự để lưu vào hệ thống khách sạn</p>
          </div>
          <button
            onClick={() => setIsAddEmployeeModalOpen(false)}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Họ và tên *</label>
              <input
                type="text"
                required
                value={newEmpForm.name}
                onChange={e => setNewEmpForm({ ...newEmpForm, name: e.target.value })}
                placeholder="VD: Nguyễn Văn Hoàng"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Giới tính</label>
              <select
                value={newEmpForm.gender}
                onChange={e => setNewEmpForm({ ...newEmpForm, gender: e.target.value as any })}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="Nữ">Nữ</option>
                <option value="Nam">Nam</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Số điện thoại *</label>
              <input
                type="tel"
                required
                value={newEmpForm.phone}
                onChange={e => setNewEmpForm({ ...newEmpForm, phone: e.target.value })}
                placeholder="0912 345 678"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Email</label>
              <input
                type="email"
                value={newEmpForm.email}
                onChange={e => setNewEmpForm({ ...newEmpForm, email: e.target.value })}
                placeholder="hoang.nguyen@hotel.com"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Bộ phận</label>
              <select
                value={newEmpForm.departmentId}
                onChange={e => {
                  const val = e.target.value;
                  const deptMap: Record<string, { name: string; role: string }> = {
                    reception: { name: "Bộ phận Lễ tân", role: "Nhân viên Lễ tân" },
                    housekeeping: { name: "Bộ phận Buồng phòng", role: "Nhân viên Buồng phòng" },
                    fnb: { name: "Bộ phận Bếp & F&B", role: "Nhân viên Bếp / Phục vụ" },
                    technical: { name: "Bộ phận Kỹ thuật", role: "Kỹ thuật viên bảo trì" },
                  };
                  setNewEmpForm({
                    ...newEmpForm,
                    departmentId: val,
                    department: deptMap[val].name,
                    role: deptMap[val].role
                  });
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="reception">Bộ phận Lễ tân</option>
                <option value="housekeeping">Bộ phận Buồng phòng</option>
                <option value="fnb">Bộ phận Bếp & F&B</option>
                <option value="technical">Bộ phận Kỹ thuật</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Chức danh</label>
              <input
                type="text"
                value={newEmpForm.role}
                onChange={e => setNewEmpForm({ ...newEmpForm, role: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Loại hợp đồng</label>
              <select
                value={newEmpForm.contractType}
                onChange={e => setNewEmpForm({ ...newEmpForm, contractType: e.target.value as any })}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="Thử việc">Thử việc (2 tháng)</option>
                <option value="Chính thức">Chính thức (1 năm / Không thời hạn)</option>
                <option value="Thời vụ">Thời vụ / Bán thời gian</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Ngày bắt đầu làm việc</label>
              <input
                type="date"
                value={newEmpForm.joinDate}
                onChange={e => setNewEmpForm({ ...newEmpForm, joinDate: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddEmployeeModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Lưu hồ sơ
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Drawer / Modal: View Employee Details
  const EmployeeDetailModal = selectedEmployee && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={() => setSelectedEmployee(null)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4 pb-5 border-b border-gray-100">
          <img
            src={selectedEmployee.avatar}
            alt={selectedEmployee.name}
            className="w-16 h-16 rounded-full object-cover ring-2 ring-emerald-600/30"
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-bold text-gray-900 text-lg">{selectedEmployee.name}</h3>
              <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                {selectedEmployee.id}
              </span>
            </div>
            <p className="text-xs text-gray-600 font-medium">{selectedEmployee.role} • {selectedEmployee.department}</p>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {selectedEmployee.status}
            </span>
          </div>
        </div>

        <div className="py-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-gray-50">
              <span className="text-gray-400 block text-[10px]">Số điện thoại:</span>
              <span className="font-semibold text-gray-800">{selectedEmployee.phone}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-gray-50">
              <span className="text-gray-400 block text-[10px]">Email công ty:</span>
              <span className="font-semibold text-gray-800">{selectedEmployee.email}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-gray-50">
              <span className="text-gray-400 block text-[10px]">Số CCCD / CMND:</span>
              <span className="font-semibold text-gray-800 font-mono">{selectedEmployee.idCard}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-gray-50">
              <span className="text-gray-400 block text-[10px]">Ngày sinh:</span>
              <span className="font-semibold text-gray-800">{selectedEmployee.dob}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-gray-50">
              <span className="text-gray-400 block text-[10px]">Ngày vào làm:</span>
              <span className="font-semibold text-gray-800">{selectedEmployee.joinDate}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-gray-50">
              <span className="text-gray-400 block text-[10px]">Quỹ phép năm còn lại:</span>
              <span className="font-semibold text-emerald-700">{selectedEmployee.leaveBalance == null ? "Chưa có dữ liệu backend" : `${selectedEmployee.leaveBalance} / 12 ngày`}</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
            <div>
              <span className="text-emerald-900 font-bold block">Bậc lương hiện tại:</span>
              <span className="text-emerald-800 font-medium">{selectedEmployee.salaryGrade}</span>
            </div>
            <span className="text-[10px] bg-emerald-200/60 text-emerald-900 font-semibold px-2 py-0.5 rounded-full">
              Dữ liệu hợp đồng
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={() => {
              showToast(`Đã in sơ yếu lý lịch của ${selectedEmployee.name}`);
            }}
            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer"
          >
            In hồ sơ
          </button>
          <button
            onClick={() => setSelectedEmployee(null)}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );

  // Modal: Create Leave Request
  const CreateLeaveModal = isCreateLeaveModalOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
          <div>
            <h3 className="font-serif font-bold text-gray-900 text-base">Tạo đơn xin nghỉ / đổi ca</h3>
            <p className="text-xs text-gray-400 mt-0.5">HR nhập thay nhân viên hoặc duyệt trực tiếp</p>
          </div>
          <button
            onClick={() => setIsCreateLeaveModalOpen(false)}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreateLeaveRequest} className="space-y-3 text-xs">
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Nhân viên *</label>
            <select
              value={newLeaveForm.employeeName}
              onChange={e => {
                const name = e.target.value;
                const found = employees.find(emp => emp.name === name);
                setNewLeaveForm({
                  ...newLeaveForm,
                  employeeName: name,
                  department: found?.department || "Bộ phận Lễ tân"
                });
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.name}>
                  {emp.name} ({emp.department})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Loại đơn *</label>
            <select
              value={newLeaveForm.type}
              onChange={e => setNewLeaveForm({ ...newLeaveForm, type: e.target.value as any })}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="Nghỉ phép năm">Nghỉ phép năm (có lương)</option>
              <option value="Nghỉ ốm">Nghỉ ốm (hưởng BHXH)</option>
              <option value="Đổi ca trực">Đổi ca trực với nhân sự khác</option>
              <option value="Việc riêng">Việc riêng không lương</option>
              <option value="Nghỉ chế độ">Nghỉ chế độ (kết hôn, tang lễ...)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Thời gian xin nghỉ</label>
              <input
                type="text"
                value={newLeaveForm.dateRange}
                onChange={e => setNewLeaveForm({ ...newLeaveForm, dateRange: e.target.value })}
                placeholder="DD/MM/YYYY"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Số lượng</label>
              <input
                type="text"
                value={newLeaveForm.totalDays}
                onChange={e => setNewLeaveForm({ ...newLeaveForm, totalDays: e.target.value })}
                placeholder="1 ngày"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Lý do chi tiết</label>
            <textarea
              rows={3}
              value={newLeaveForm.reason}
              onChange={e => setNewLeaveForm({ ...newLeaveForm, reason: e.target.value })}
              placeholder="Ghi rõ lý do xin nghỉ hoặc đổi ca..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateLeaveModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer shadow-xs"
            >
              Tạo đơn
            </button>
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
            {/* When Tab is 'schedule', render top 4 metric cards then the schedule board & right panel */}
            {currentTab === "schedule" && (
              <>
                {TopMetricCards}
                {ScheduleView}
              </>
            )}

            {/* When Tab is 'overview' */}
            {currentTab === "overview" && OverviewView}

            {/* When Tab is 'staff' */}
            {currentTab === "staff" && StaffView}

            {/* When Tab is 'attendance' */}
            {currentTab === "attendance" && AttendanceView}

            {/* When Tab is 'leaves' */}
            {currentTab === "leaves" && LeavesView}
          </div>
        </main>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs flex items-center gap-2.5 animate-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      {ShiftEditModal}
      {AddEmployeeModal}
      {EmployeeDetailModal}
      {CreateLeaveModal}
    </div>
  );
}
