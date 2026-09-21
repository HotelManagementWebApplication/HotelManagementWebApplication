import { RoleId } from "./types";

export interface RolePermissions {
  // Navigation pages visible
  pages: string[];

  // Room matrix
  room: {
    canView: boolean;
    canCheckIn: boolean;
    canCheckOut: boolean;
    canBook: boolean;
    canTransfer: boolean;
    canMarkCleaning: boolean;       // HOUSEKEEPING: báo đang dọn
    canReportCleanDone: boolean;    // HOUSEKEEPING: báo xong (chờ MANAGER xác nhận)
    canMarkAvailable: boolean;      // MANAGER/DIRECTOR sau khi nghiệm thu
    canPutMaintenance: boolean;     // TECHNICAL
    canEndMaintenance: boolean;     // TECHNICAL báo hoàn thành (chờ MANAGER nghiệm thu)
    canReportIncident: boolean;     // HOUSEKEEPING báo sự cố → TECHNICAL xử lý
  };

  // Finance
  finance: {
    canView: boolean;
    canCreateReceipt: boolean;
    canManageDebt: boolean;
    canShiftHandover: boolean;
    canModifyReservation: boolean;  // chỉ FRONT_DESK/MANAGER
    canApproveRefund: boolean;      // chỉ DIRECTOR
    canApprovePriceChange: boolean; // MANAGER + DIRECTOR
  };

  // Approvals
  approvals: {
    canApproveConfig: boolean;       // MANAGER: duyệt cấu hình/giá TECHNICAL
    canApproveServicePrice: boolean; // MANAGER: duyệt giá dịch vụ KITCHEN
    canApproveRefund: boolean;       // DIRECTOR only
    canSelfApprove: boolean;         // false cho mọi role
  };

  // Housekeeping
  housekeeping: {
    canAssignTasks: boolean;    // MANAGER
    canReceiveTasks: boolean;   // HOUSEKEEPING
    canUpdateProgress: boolean; // HOUSEKEEPING
    canInspect: boolean;        // MANAGER nghiệm thu sau khi TECHNICAL báo xong
  };

  // Technical / devices
  technical: {
    canCreateDraft: boolean;    // TECHNICAL: tạo ở DRAFT
    canSubmitForApproval: boolean;
    canApproveOwn: boolean;     // false — TECHNICAL không tự duyệt
    canViewEquipment: boolean;
  };

  // Reports & analytics
  reports: {
    canViewRevenue: boolean;         // MANAGER + DIRECTOR + ACCOUNTING
    canViewOccupancy: boolean;
    canViewAuditLog: boolean;        // DIRECTOR + ADMIN
    canViewAllBookings: boolean;
    canViewStaffActivity: boolean;   // MANAGER + DIRECTOR
  };

  // Staff management
  staff: {
    canViewList: boolean;
    canManageHR: boolean;
    canAssignRole: boolean;  // capped by role ceiling
  };

  // Labels for locked actions
  lockReasons: Partial<Record<string, string>>;
}

const BASE: RolePermissions = {
  pages: [],
  room: {
    canView: false, canCheckIn: false, canCheckOut: false, canBook: false,
    canTransfer: false, canMarkCleaning: false, canReportCleanDone: false,
    canMarkAvailable: false, canPutMaintenance: false, canEndMaintenance: false,
    canReportIncident: false,
  },
  finance: {
    canView: false, canCreateReceipt: false, canManageDebt: false,
    canShiftHandover: false, canModifyReservation: false,
    canApproveRefund: false, canApprovePriceChange: false,
  },
  approvals: {
    canApproveConfig: false, canApproveServicePrice: false,
    canApproveRefund: false, canSelfApprove: false,
  },
  housekeeping: {
    canAssignTasks: false, canReceiveTasks: false,
    canUpdateProgress: false, canInspect: false,
  },
  technical: {
    canCreateDraft: false, canSubmitForApproval: false,
    canApproveOwn: false, canViewEquipment: false,
  },
  reports: {
    canViewRevenue: false, canViewOccupancy: false, canViewAuditLog: false,
    canViewAllBookings: false, canViewStaffActivity: false,
  },
  staff: { canViewList: false, canManageHR: false, canAssignRole: false },
  lockReasons: {},
};

export const PERMISSIONS: Record<RoleId, RolePermissions> = {

  /* ── CUSTOMER ──────────────────────────────── */
  customer: {
    ...BASE,
    pages: ["browse", "booking", "my-bookings"],
    room: { ...BASE.room, canView: true },
    lockReasons: {},
  },

  /* ── F&B / KITCHEN ─────────────────────────── */
  fnb: {
    ...BASE,
    pages: ["dashboard", "inventory", "pricing", "reports", "settings"],
    room: { ...BASE.room, canView: true },
    reports: { ...BASE.reports, canViewOccupancy: true },
    lockReasons: {
      finance: "Bếp không có quyền truy cập báo cáo tài chính tổng thể",
      approvePrice: "Thay đổi giá dịch vụ cần Quản lý phê duyệt",
    },
  },

  /* ── FRONT DESK (Lễ tân) ───────────────────── */
  reception: {
    ...BASE,
    pages: ["dashboard", "rooms", "arrivals", "services", "shift", "settings"],
    room: {
      ...BASE.room,
      canView: true,
      canCheckIn: true,
      canCheckOut: true,
      canBook: true,
      canTransfer: true,
      canReportIncident: true,
    },
    finance: {
      ...BASE.finance,
      canView: false,          // ❌ FRONT_DESK không xem báo cáo tài chính
      canShiftHandover: true,
      canModifyReservation: true,
    },
    reports: {
      ...BASE.reports,
      canViewOccupancy: true,
      canViewAllBookings: true,
    },
    lockReasons: {
      finance: "Lễ tân không có quyền xem báo cáo tài chính",
      approveRefund: "Hoàn tiền phải do Giám đốc phê duyệt",
      markAvailable: "Không thể tự đưa phòng về trống — cần TECHNICAL & MANAGER xác nhận",
      putMaintenance: "Chỉ Kỹ thuật mới được đưa phòng vào bảo trì",
    },
  },

  /* ── HOUSEKEEPING (Buồng phòng) ────────────── */
  housekeeping: {
    ...BASE,
    pages: ["dashboard", "tasks", "rooms", "incident-report", "settings"],
    room: {
      ...BASE.room,
      canView: true,
      canMarkCleaning: true,
      canReportCleanDone: true,   // "báo xong" — MANAGER mới confirm AVAILABLE
      canMarkAvailable: false,    // ❌ không tự đưa về trống
      canReportIncident: true,
    },
    housekeeping: {
      ...BASE.housekeeping,
      canReceiveTasks: true,
      canUpdateProgress: true,
    },
    reports: {
      ...BASE.reports,
      canViewOccupancy: true,
    },
    lockReasons: {
      checkIn: "Lễ tân mới được phép check-in khách",
      checkOut: "Lễ tân mới được phép check-out khách",
      markAvailable: "Buồng phòng không thể tự đưa phòng về trống — MANAGER sẽ nghiệm thu và xác nhận",
      finance: "Không có quyền truy cập tài chính",
    },
  },

  /* ── TECHNICAL (Kỹ thuật) ──────────────────── */
  maintenance: {
    ...BASE,
    pages: ["dashboard", "incidents", "rooms", "equipment", "settings"],
    room: {
      ...BASE.room,
      canView: true,
      canPutMaintenance: true,    // đưa phòng vào bảo trì
      canEndMaintenance: true,    // báo hoàn thành (chờ MANAGER nghiệm thu)
      canMarkAvailable: false,    // ❌ MANAGER mới mở khóa phòng sau nghiệm thu
      canReportIncident: true,
    },
    technical: {
      canCreateDraft: true,
      canSubmitForApproval: true,
      canApproveOwn: false,       // ❌ KHÔNG tự phê duyệt
      canViewEquipment: true,
    },
    reports: {
      ...BASE.reports,
      canViewOccupancy: true,
      canViewEquipment: true,
    } as RolePermissions["reports"] & { canViewEquipment?: boolean },
    lockReasons: {
      checkIn: "Chỉ Lễ tân mới thực hiện check-in",
      checkOut: "Chỉ Lễ tân mới thực hiện check-out",
      markAvailable: "Sau khi báo hoàn thành, MANAGER phải nghiệm thu và xác nhận trước khi phòng về trống",
      approveOwn: "TECHNICAL không được tự phê duyệt cấu hình hoặc giá do mình tạo",
      finance: "Không có quyền truy cập tài chính",
    },
  },

  /* ── ACCOUNTING (Kế toán) ──────────────────── */
  accounting: {
    ...BASE,
    pages: ["dashboard", "finance", "shift", "debt", "settings"],
    room: {
      ...BASE.room,
      canView: true,
      canMarkAvailable: false,    // ❌
      canCheckIn: false,          // ❌
      canCheckOut: false,         // ❌
    },
    finance: {
      canView: true,
      canCreateReceipt: true,
      canManageDebt: true,
      canShiftHandover: true,
      canModifyReservation: false, // ❌ ACCOUNTING không sửa reservation
      canApproveRefund: false,     // ❌ chỉ DIRECTOR
      canApprovePriceChange: false,
    },
    reports: {
      ...BASE.reports,
      canViewRevenue: true,
      canViewOccupancy: true,
      canViewAllBookings: true,
    },
    lockReasons: {
      modifyReservation: "Kế toán không được sửa đặt phòng hoặc trạng thái phòng — chỉ Lễ tân hoặc Quản lý",
      approveRefund: "Hoàn tiền phải do Giám đốc phê duyệt",
      checkIn: "Chỉ Lễ tân mới thực hiện check-in/out",
      roomStatus: "Kế toán không thay đổi trạng thái phòng",
    },
  },

  /* ── MANAGER / DIRECTOR ────────────────────── */
  manager: {
    ...BASE,
    pages: ["dashboard", "rooms", "arrivals", "finance", "staff", "approvals", "reports", "settings"],
    room: {
      canView: true,
      canCheckIn: true,
      canCheckOut: true,
      canBook: true,
      canTransfer: true,
      canMarkCleaning: false,
      canReportCleanDone: false,
      canMarkAvailable: true,     // ✅ MANAGER nghiệm thu → mở khóa phòng
      canPutMaintenance: false,
      canEndMaintenance: false,
      canReportIncident: false,
    },
    finance: {
      canView: true,
      canCreateReceipt: true,
      canManageDebt: true,
      canShiftHandover: true,
      canModifyReservation: true,
      canApproveRefund: false,    // hoàn tiền chỉ do DIRECTOR phê duyệt
      canApprovePriceChange: true,
    },
    approvals: {
      canApproveConfig: true,      // ✅ duyệt cấu hình TECHNICAL
      canApproveServicePrice: true,// ✅ duyệt giá dịch vụ KITCHEN
      canApproveRefund: false,
      canSelfApprove: false,
    },
    housekeeping: {
      canAssignTasks: true,        // ✅ MANAGER phân công
      canReceiveTasks: false,
      canUpdateProgress: false,
      canInspect: true,            // ✅ MANAGER nghiệm thu sau TECHNICAL báo xong
    },
    technical: {
      canCreateDraft: false,
      canSubmitForApproval: false,
      canApproveOwn: false,
      canViewEquipment: true,
    },
    reports: {
      canViewRevenue: true,
      canViewOccupancy: true,
      canViewAuditLog: false,
      canViewAllBookings: true,
      canViewStaffActivity: true,
    },
    staff: {
      canViewList: true,
      canManageHR: true,
      canAssignRole: true,
    },
    lockReasons: {},
  },

  /* ── DIRECTOR ──────────────────────────────── */
  director: {
    ...BASE,
    pages: ["dashboard", "approvals", "reports", "audit", "staff", "settings"],
    room: { ...BASE.room, canView: true, canMarkAvailable: true },
    finance: {
      ...BASE.finance,
      canView: true,
      canCreateReceipt: true,
      canManageDebt: true,
      canShiftHandover: true,
      canApproveRefund: true,
      canApprovePriceChange: true,
    },
    approvals: {
      canApproveConfig: true,
      canApproveServicePrice: true,
      canApproveRefund: true,
      canSelfApprove: false,
    },
    housekeeping: { ...BASE.housekeeping, canAssignTasks: true, canInspect: true },
    technical: { ...BASE.technical, canViewEquipment: true },
    reports: {
      canViewRevenue: true,
      canViewOccupancy: true,
      canViewAuditLog: true,
      canViewAllBookings: true,
      canViewStaffActivity: true,
    },
    staff: { canViewList: true, canManageHR: true, canAssignRole: true },
    lockReasons: {
      modifyReservation: "Giám đốc giám sát và phê duyệt; thao tác đặt phòng thuộc Lễ tân hoặc Quản lý",
    },
  },

  /* ── ADMIN ─────────────────────────────────── */
  admin: {
    ...BASE,
    pages: ["dashboard", "staff", "audit", "settings"],
    room: { ...BASE.room, canView: true },
    finance: { ...BASE.finance, canView: true },
    approvals: { ...BASE.approvals, canApproveConfig: true, canApproveServicePrice: true },
    technical: { ...BASE.technical, canViewEquipment: true },
    reports: {
      canViewRevenue: true,
      canViewOccupancy: true,
      canViewAuditLog: true,
      canViewAllBookings: true,
      canViewStaffActivity: true,
    },
    staff: { canViewList: true, canManageHR: true, canAssignRole: true },
    lockReasons: {
      approveRefund: "Theo quy trình nghiệp vụ, hoàn tiền phải do Giám đốc phê duyệt",
      modifyReservation: "Quản trị hệ thống không thực hiện nghiệp vụ đặt phòng",
    },
  },

  /* ── HR ────────────────────────────────────── */
  hr: {
    ...BASE,
    pages: ["dashboard", "staff", "shift", "settings"],
    staff: { canViewList: true, canManageHR: true, canAssignRole: false },
    lockReasons: {
      assignRole: "Nhân sự quản lý hồ sơ và phân ca nhưng không tự cấp hoặc đổi vai trò",
      finance: "Nhân sự không có quyền xem lương hoặc dữ liệu tài chính",
    },
  },

  /* ── STAFF ─────────────────────────────────── */
  staff: {
    ...BASE,
    pages: ["dashboard", "rooms", "settings"],
    room: { ...BASE.room, canView: true },
    reports: { ...BASE.reports, canViewOccupancy: true },
    lockReasons: {
      write: "Nhân viên chỉ được xem dữ liệu vận hành cơ bản",
      finance: "Nhân viên không có quyền truy cập tài chính",
    },
  },
};

/* ── Helpers ─────────────────────────────────── */
export function can(role: RoleId, action: string): boolean {
  const p = PERMISSIONS[role];
  const parts = action.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = p;
  for (const part of parts) {
    if (obj == null || typeof obj !== "object") return false;
    obj = obj[part];
  }
  return Boolean(obj);
}

export function lockReason(role: RoleId, key: string): string {
  return PERMISSIONS[role].lockReasons[key] ?? "Không có quyền thực hiện thao tác này";
}

export const ROLE_META: Record<RoleId, { label: string; labelEn: string; color: string; bg: string; gr: string; desc: string }> = {
  customer:     { label:"Khách hàng",          labelEn:"Khách hàng",    color:"#B8944A", bg:"rgba(184,148,74,0.12)", gr:"linear-gradient(135deg,#92400E,#B8944A)", desc:"Đặt phòng, xem lịch sử lưu trú" },
  reception:    { label:"Lễ tân",              labelEn:"Lễ tân",  color:"#6366F1", bg:"rgba(99,102,241,0.12)", gr:"linear-gradient(135deg,#4338CA,#6366F1)", desc:"Check-in/out, đặt phòng, giao ca" },
  housekeeping: { label:"Buồng phòng",         labelEn:"Buồng phòng",color:"#10B981", bg:"rgba(16,185,129,0.12)", gr:"linear-gradient(135deg,#047857,#10B981)", desc:"Dọn phòng, checklist, báo sự cố" },
  maintenance:  { label:"Kỹ thuật",            labelEn:"Kỹ thuật",   color:"#F97316", bg:"rgba(249,115,22,0.12)", gr:"linear-gradient(135deg,#C2410C,#F97316)", desc:"Bảo trì thiết bị, cấu hình phòng" },
  accounting:   { label:"Kế toán",             labelEn:"Kế toán",  color:"#8B5CF6", bg:"rgba(139,92,246,0.12)", gr:"linear-gradient(135deg,#6D28D9,#8B5CF6)", desc:"Hóa đơn, thu chi, công nợ" },
  manager:      { label:"Quản lý",              labelEn:"Quản lý",    color:"#B8944A", bg:"rgba(184,148,74,0.12)", gr:"linear-gradient(135deg,#78350F,#B8944A)", desc:"Điều hành bộ phận, nghiệm thu và phê duyệt giá" },
  director:     { label:"Giám đốc",            labelEn:"Giám đốc",    color:"#B8944A", bg:"rgba(184,148,74,0.12)", gr:"linear-gradient(135deg,#78350F,#B8944A)", desc:"Báo cáo toàn bộ, hoàn tiền và phê duyệt giá" },
  admin:        { label:"Quản trị hệ thống",    labelEn:"Quản trị hệ thống",       color:"#334155", bg:"rgba(51,65,85,0.12)", gr:"linear-gradient(135deg,#0F172A,#475569)", desc:"Tài khoản, phân quyền, cấu hình và nhật ký" },
  hr:           { label:"Nhân sự",              labelEn:"Nhân sự",          color:"#EC4899", bg:"rgba(236,72,153,0.12)", gr:"linear-gradient(135deg,#BE185D,#EC4899)", desc:"Hồ sơ nhân viên và phân ca" },
  staff:        { label:"Nhân viên",            labelEn:"Nhân viên",       color:"#64748B", bg:"rgba(100,116,139,0.12)", gr:"linear-gradient(135deg,#334155,#64748B)", desc:"Xem dữ liệu vận hành cơ bản" },
  fnb:          { label:"Bếp & Minibar",        labelEn:"Bếp & Minibar",         color:"#F59E0B", bg:"rgba(245,158,11,0.12)", gr:"linear-gradient(135deg,#B45309,#F59E0B)", desc:"Kho bếp, minibar và giá dịch vụ" },
};
