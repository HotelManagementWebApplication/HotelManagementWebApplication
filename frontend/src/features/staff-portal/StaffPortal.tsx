import { useEffect, useState } from "react";
import { RoleId, Room, RoomStatus } from "../../shared/types/domain";
import type { Booking, FinanceEntry, HousekeepingTask, StaffMember } from "../../shared/types/domain";
import { publicApi } from "../../shared/api/public";
import { frontDeskApi } from "../../shared/api/frontDesk";
import { housekeepingTechnicalApi } from "../../shared/api/housekeepingTechnical";
import type { HousekeepingTask as ApiHousekeepingTask } from "../../shared/types/housekeepingTechnical";
import { hrGovernanceApi, rows } from "../../shared/api/hrGovernance";
import { authApi } from "../../shared/api/auth";
import { kitchenAccountingApi } from "../../shared/api/kitchenAccounting";
import { EmployeeProfileDropdown } from "../../shared/components/EmployeeProfileDropdown";
import type { Approval, AuditEntry, EmployeeAdmin } from "../../shared/types/hrGovernance";
import { employeeRoleLabel } from "../../shared/types/api";
import type { EmployeeProfileDto } from "../../shared/types/api";
import { PERMISSIONS, ROLE_META, can, lockReason } from "../../app/navigation/permissions";
import { formatVnd } from "../../shared/utils/money";
import { apiErrorMessage } from "../../shared/api/client";
import {
  LayoutDashboard, ConciergeBell, Grid3X3, Sparkles, Wrench, Calculator,
  Users, Settings, LogOut, ChevronLeft, ChevronRight, Bell, Search, Sun,
  Moon, RefreshCw, Wifi, BedDouble, UserCheck, UserMinus, TrendingUp,
  TrendingDown, CheckCircle2, Clock, QrCode, Eye, LogIn, FileText, X,
  Banknote, ShieldCheck, CalendarDays, Plus, Filter, MoreHorizontal,
  Star, Lock, AlertTriangle, ArrowRightLeft, ClipboardList, Hammer,
  CheckSquare, PackageOpen, Wallet, Activity, ChevronDown, Info,
  Send, ThumbsUp, ThumbsDown, Hourglass, History
} from "lucide-react";

/* ── Formatters ─────────────────────────────── */
const fmtVND = formatVnd;
const fmtFull = formatVnd;
const roomTypeLabel = (type: string) => ({
  Standard:"Tiêu chuẩn", Deluxe:"Cao cấp", Suite:"Suite", "VIP Suite":"Suite VIP",
}[type] ?? type);
const roomAmenityLabel = (amenity: string) => ({
  Safe:"Két an toàn", Butler:"Quản gia", "Butler riêng":"Quản gia riêng", "Mini bar":"Minibar",
}[amenity] ?? amenity);
const roomBedLabel = (beds: string) => ({
  "Giường King":"Giường King", "Giường đôi":"Giường đôi", "Hai giường đơn":"Hai giường đơn",
  "Giường King+Sofa":"Giường King + sofa", "Hai giường Queen":"Hai giường Queen", "Giường Emperor":"Giường siêu cỡ",
}[beds] ?? beds);

/* ── Room status ────────────────────────────── */
const RS: Record<RoomStatus,{label:string;color:string;bg:string}> = {
  available:    {label:"Sẵn sàng",  color:"#22C55E",bg:"rgba(34,197,94,0.1)"},
  occupied:     {label:"Đang có khách", color:"#6366F1",bg:"rgba(99,102,241,0.1)"},
  housekeeping: {label:"Đang dọn",  color:"#F59E0B",bg:"rgba(245,158,11,0.1)"},
  maintenance:  {label:"Đang bảo trì", color:"#EF4444",bg:"rgba(239,68,68,0.1)"},
  reserved:     {label:"Đã giữ phòng", color:"#A78BFA",bg:"rgba(167,139,250,0.1)"},
};

/* ── Mini components ────────────────────────── */
function Donut({pct,color,size=64}:{pct:number;color:string;size?:number}) {
  const r=(size-10)/2, c=2*Math.PI*r, dash=(pct/100)*c;
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${c-dash}`} strokeLinecap="round"/>
    </svg>
  );
}

/* Lock badge overlay */
function LockedAction({reason, children}:{reason:string; children:React.ReactNode}) {
  const [tip, setTip] = useState(false);
  return (
    <div style={{position:"relative", display:"inline-block"}}
      onMouseEnter={()=>setTip(true)} onMouseLeave={()=>setTip(false)}>
      <div style={{opacity:0.4, pointerEvents:"none", filter:"grayscale(0.5)"}}>{children}</div>
      <div style={{position:"absolute",top:0,right:0,bottom:0,left:0,cursor:"not-allowed",display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:6}}>
        <Lock size={11} style={{color:"#EF4444"}}/>
      </div>
      {tip && (
        <div style={{position:"absolute",bottom:"calc(100% + 6px)",left:"50%",transform:"translateX(-50%)",
          background:"#111827",color:"#FFF",fontSize:11,padding:"6px 10px",borderRadius:8,whiteSpace:"nowrap",
          zIndex:99,boxShadow:"0 4px 12px rgba(0,0,0,0.3)",maxWidth:260,textAlign:"center",lineHeight:1.5}}>
          <Lock size={10} style={{display:"inline",marginRight:4,color:"#EF4444"}}/>
          {reason}
        </div>
      )}
    </div>
  );
}

/* Permission badge row */
function PermBadge({ok,label}:{ok:boolean;label:string}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0"}}>
      {ok
        ? <CheckCircle2 size={13} style={{color:"#22C55E",flexShrink:0}}/>
        : <Lock size={13} style={{color:"#EF4444",flexShrink:0}}/>}
      <span style={{fontSize:11,color: ok ? "#22C55E" : "#EF4444"}}>{label}</span>
    </div>
  );
}

/* Draft badge */
function DraftBadge() {
  return (
    <span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:4,
      background:"rgba(245,158,11,0.15)",color:"#F59E0B",border:"1px solid rgba(245,158,11,0.3)",
      letterSpacing:"0.06em",verticalAlign:"middle",marginLeft:6}}>BẢN NHÁP</span>
  );
}

/* Approval required badge */
function ApprovalBadge({by}:{by:string}) {
  return (
    <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:4,
      background:"rgba(99,102,241,0.1)",color:"#6366F1",border:"1px solid rgba(99,102,241,0.25)",
      letterSpacing:"0.05em",display:"inline-flex",alignItems:"center",gap:4}}>
      <Hourglass size={9}/> Chờ {by}
    </span>
  );
}

/* ── Page menu configs ──────────────────────── */
const MENU: Record<RoleId,{id:string;label:string;icon:React.ElementType;badge?:string}[]> = {
  customer:[],
  reception:[
    {id:"dashboard", label:"Tổng quan",       icon:LayoutDashboard},
    {id:"rooms",     label:"Ma trận phòng",   icon:Grid3X3, badge:"50"},
    {id:"arrivals",  label:"Đến / Đi hôm nay",icon:ConciergeBell, badge:"14"},
    {id:"shift",     label:"Giao ca",          icon:RefreshCw},
    {id:"settings",  label:"Cài đặt",          icon:Settings},
  ],
  housekeeping:[
    {id:"dashboard", label:"Tổng quan",        icon:LayoutDashboard},
    {id:"tasks",     label:"Nhiệm vụ dọn phòng",icon:Sparkles, badge:"6"},
    {id:"rooms",     label:"Ma trận phòng",    icon:Grid3X3},
    {id:"incidents", label:"Báo sự cố",         icon:AlertTriangle},
    {id:"settings",  label:"Cài đặt",           icon:Settings},
  ],
  maintenance:[
    {id:"dashboard", label:"Tổng quan",         icon:LayoutDashboard},
    {id:"incidents", label:"Sự cố & Bảo trì",   icon:Wrench, badge:"4"},
    {id:"equipment", label:"Thiết bị (BẢN NHÁP)",   icon:PackageOpen},
    {id:"rooms",     label:"Ma trận phòng",     icon:Grid3X3},
    {id:"settings",  label:"Cài đặt",            icon:Settings},
  ],
  accounting:[
    {id:"dashboard", label:"Tổng quan",         icon:LayoutDashboard},
    {id:"finance",   label:"Thu / Chi",          icon:Calculator},
    {id:"shift",     label:"Bàn giao ca",        icon:RefreshCw},
    {id:"debt",      label:"Công nợ",            icon:Wallet},
    {id:"settings",  label:"Cài đặt",            icon:Settings},
  ],
  fnb:[
    {id:"dashboard", label:"Tổng quan",          icon:LayoutDashboard},
    {id:"inventory", label:"Kho bếp & Minibar", icon:PackageOpen},
    {id:"reports",   label:"Báo cáo",            icon:Activity},
    {id:"settings",  label:"Cài đặt",            icon:Settings},
  ],
  manager:[
    {id:"dashboard", label:"Tổng quan",          icon:LayoutDashboard},
    {id:"approvals", label:"Phê duyệt",           icon:ShieldCheck, badge:"3"},
    {id:"rooms",     label:"Ma trận phòng",      icon:Grid3X3},
    {id:"arrivals",  label:"Đến / Đi",            icon:ConciergeBell},
    {id:"finance",   label:"Tài chính",           icon:Calculator},
    {id:"staff",     label:"Nhân sự & Phân ca",   icon:Users},
    {id:"reports",   label:"Báo cáo",             icon:Activity},
    {id:"settings",  label:"Cài đặt",             icon:Settings},
  ],
  director:[
    {id:"dashboard", label:"Tổng quan điều hành", icon:LayoutDashboard},
    {id:"approvals", label:"Phê duyệt",            icon:ShieldCheck, badge:"3"},
    {id:"finance",   label:"Tài chính",            icon:Calculator},
    {id:"staff",     label:"Nhân sự",              icon:Users},
    {id:"reports",   label:"Báo cáo toàn bộ",      icon:Activity},
    {id:"audit",     label:"Nhật ký hệ thống",     icon:History},
    {id:"settings",  label:"Cài đặt",              icon:Settings},
  ],
  admin:[
    {id:"dashboard", label:"Tổng quan hệ thống",   icon:LayoutDashboard},
    {id:"staff",     label:"Tài khoản nhân viên",  icon:Users},
    {id:"audit",     label:"Nhật ký truy cập",     icon:History},
    {id:"settings",  label:"Cấu hình hệ thống",    icon:Settings},
  ],
  hr:[
    {id:"dashboard", label:"Tổng quan nhân sự",    icon:LayoutDashboard},
    {id:"staff",     label:"Hồ sơ nhân viên",      icon:Users},
    {id:"shift",     label:"Lịch & Phân ca",       icon:CalendarDays},
    {id:"settings",  label:"Cài đặt",              icon:Settings},
  ],
  staff:[
    {id:"dashboard", label:"Tổng quan",            icon:LayoutDashboard},
    {id:"rooms",     label:"Tình trạng phòng",     icon:Grid3X3},
    {id:"settings",  label:"Cài đặt",              icon:Settings},
  ],
};

/* ── MAIN ────────────────────────────────────── */
interface Props { role: RoleId; onBack: () => void; }

export default function StaffPortal({ role, onBack }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [notifOpen, setNotifOpen] = useState(false);
  const [topProfileOpen, setTopProfileOpen] = useState(false);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);
  const [roomsState, setRoomsState] = useState<Room[]>([]);
  const [arrivals, setArrivals] = useState<Booking[]>([]);
  const [departures, setDepartures] = useState<Booking[]>([]);
  const [housekeepingTasks, setHousekeepingTasks] = useState<HousekeepingTask[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [financeToday, setFinanceToday] = useState<FinanceEntry[]>([]);
  const [notifications, setNotifications] = useState<Array<{ id:number; title:string; desc:string; time:string; type:string; urgent:boolean }>>([]);
  const [selRoom, setSelRoom] = useState<Room | null>(null);
  const [floor, setFloor] = useState(0);
  const [showPermPanel, setShowPermPanel] = useState(false);
  const [shiftFilter, setShiftFilter] = useState<"all"|"active"|"off">("all");
  const [shiftPublished, setShiftPublished] = useState(false);
  const [userProfile, setUserProfile] = useState<EmployeeProfileDto | null>(null);
  const [approvalsList, setApprovalsList] = useState<Approval[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState("");
  const [loadRevision, setLoadRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setRoomsLoading(true);
    setRoomsError("");
    const access = PERMISSIONS[role];
    Promise.all([publicApi.rooms(undefined, 0, 100),
      access.reports.canViewAllBookings ? frontDeskApi.reservations({ page: 0, size: 100 }) : Promise.resolve({ items: [] }),
      role === "housekeeping" || role === "manager" || role === "director" ? housekeepingTechnicalApi.tasks() : Promise.resolve([])])
      .then(([roomRows, reservationPage, taskRows]) => {
        if (!active) return;
        const roomById = new Map(roomRows.map(room => [room.room_id, room]));
        const roomType = (name: string): Room["type"] => name.includes("VIP") ? "VIP Suite" : name.includes("Suite") ? "Suite" : name.includes("Deluxe") ? "Deluxe" : "Standard";
        setRoomsState(roomRows.map(item => ({
          id: item.room_id, number: item.room_name, floor: item.floor, type: roomType(item.room_type_name),
          pricePerNight: item.daily_price, pricePerHour: item.hourly_price,
          status: item.status === "cleaning" ? "housekeeping" : item.status === "out_of_service" ? "maintenance" : item.status,
          cleanStatus: item.status === "cleaning" ? "in-progress" : "clean",
          view: item.view ?? "Đang cập nhật", beds: item.bed_type ?? "Đang cập nhật", area: item.area ?? 0,
          amenities: item.amenities ?? [], image: item.image_url ?? "",
        })));
        const bookings = reservationPage.items.flatMap(reservation => reservation.rooms.slice(0, 1).map(line => ({
          id: `BK-${reservation.id}`, guestName: `Khách #${reservation.guest_id}`, guestId: String(reservation.guest_id),
          roomNumber: line.room_id, roomType: "Phòng", checkIn: line.expected_check_in, checkOut: line.expected_check_out,
          depositStatus: reservation.deposit > 0 ? "paid" as const : "pending" as const, totalAmount: reservation.deposit,
          type: reservation.status === "CHECKED_IN" ? "departure" as const : "arrival" as const,
          nights: Math.max(0, Math.ceil((new Date(line.expected_check_out).getTime() - new Date(line.expected_check_in).getTime()) / 86400000)),
          nationality: "—", phone: "—", paymentMethod: "cash" as const,
        })));
        setArrivals(bookings.filter(item => item.type === "arrival"));
        setDepartures(bookings.filter(item => item.type === "departure"));
        setHousekeepingTasks(taskRows.map((task: ApiHousekeepingTask): HousekeepingTask => {
          const room = roomById.get(task.room_id);
          return {
            id: String(task.id),
            roomNumber: room?.room_name ?? task.room_id,
            floor: room?.floor ?? 0,
            type: task.status === "CLEANED" ? "inspection" : task.blocking_incident ? "deep-clean" : "checkout-clean",
            status: task.status === "NEEDS_CLEANING" ? "pending" : task.status === "IN_PROGRESS" ? "in-progress" : "done",
            priority: task.blocking_incident ? "high" : task.status === "NEEDS_CLEANING" ? "medium" : "low",
            assignedTo: task.assignee ?? "Chưa phân công",
            requestTime: new Date(task.updated_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
            note: task.note ?? undefined,
          };
        }));
        setNotifications(taskRows.filter(task => task.blocking_incident).map(task => ({
          id: task.id,
          title: `Phòng ${task.room_id} đang chờ kỹ thuật`,
          desc: task.note ?? "Nhiệm vụ buồng phòng bị chặn bởi sự cố.",
          time: new Date(task.updated_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          type: "housekeeping",
          urgent: true,
        })));
      })
      .catch(error => {
        console.warn("Backend staff portal data unavailable:", error);
        if (active) { setRoomsError(apiErrorMessage(error, "Không thể tải danh sách phòng. Vui lòng thử lại.")); }
      })
      .finally(() => { if (active) setRoomsLoading(false); });
    return () => { active = false; };
  }, [role, loadRevision]);

  useEffect(() => {
    let active = true;
    const roleMap: Record<string, RoleId> = {
      FRONT_DESK: "reception", HOUSEKEEPING: "housekeeping", TECHNICAL: "maintenance",
      ACCOUNTING: "accounting", KITCHEN: "fnb", MANAGER: "manager", DIRECTOR: "director",
      ADMIN: "admin", HR: "hr", STAFF: "staff",
    };
    (PERMISSIONS[role].staff.canViewList ? hrGovernanceApi.employees(true) : Promise.resolve([]))
      .then(rows => {
        if (!active) return;
        setStaff(rows.map((employee: EmployeeAdmin): StaffMember => ({
          id: employee.employee_id,
          name: employee.full_name,
          role: roleMap[employee.role] ?? "staff",
          roleLabel: employeeRoleLabel(employee.role),
          shift: "morning",
          phone: employee.phone,
          status: !employee.enabled ? "off" : employee.employment_status === "ON_LEAVE" ? "on-leave" : "active",
          avatar: "",
          joinDate: "—",
        })));
      })
      .catch(error => { console.warn("Backend staff directory unavailable:", error); if (active) setStaff([]); });
    (PERMISSIONS[role].finance.canView ? kitchenAccountingApi.invoices({ page: 0, size: 100 }) : Promise.resolve({items: []}))
      .then(pageData => {
        if (!active) return;
        setFinanceToday(pageData.items.map(invoice => ({
          id: String(invoice.id),
          type: "income",
          category: invoice.service_total > 0 ? "Phòng & dịch vụ" : "Tiền phòng",
          amount: invoice.payable || invoice.room_total + invoice.service_total,
          method: invoice.payment_method === "CASH" ? "cash" : invoice.payment_method === "CARD" ? "card" : "transfer",
          time: new Date(invoice.issued_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          note: `Hóa đơn #${invoice.id}`,
        })));
      })
      .catch(error => { console.warn("Backend staff finance snapshot unavailable:", error); if (active) setFinanceToday([]); });
    authApi.employeeProfile()
      .then(p => { if (active) setUserProfile(p); })
      .catch(() => {});
    (PERMISSIONS[role].approvals.canApproveConfig || PERMISSIONS[role].approvals.canApproveRefund ? hrGovernanceApi.approvals("PENDING") : Promise.resolve([]))
      .then(res => { if (active) setApprovalsList(rows(res)); })
      .catch(() => { if (active) setApprovalsList([]); });
    (PERMISSIONS[role].reports.canViewAuditLog ? hrGovernanceApi.audit({ page: 0, size: 20 }) : Promise.resolve([]))
      .then(res => { if (active) setAuditLogs(rows(res)); })
      .catch(() => { if (active) setAuditLogs([]); });
    return () => { active = false; };
  }, [role]);

  const rm = ROLE_META[role];
  const perm = PERMISSIONS[role];
  const menu = MENU[role] || [];

  /* Theme */
  const BG     = dark ? "#060C18" : "#F0EDE8";
  const CARD   = dark ? "#0D1828" : "#FFFFFF";
  const BORDER = dark ? "#1A2A42" : "#E5E0D8";
  const T1     = dark ? "#EDE9E0" : "#111827";
  const T2     = dark ? "#8893A5" : "#6B7280";
  const INPUT  = dark ? "#142035" : "#F5F2ED";
  const NAV    = dark ? "#0A1525" : "#FFFFFF";

  /* Stats */
  const total   = roomsState.length;
  const occ     = roomsState.filter(r=>r.status==="occupied").length;
  const avail   = roomsState.filter(r=>r.status==="available").length;
  const hk      = roomsState.filter(r=>r.status==="housekeeping").length;
  const maint   = roomsState.filter(r=>r.status==="maintenance").length;
  const res     = roomsState.filter(r=>r.status==="reserved").length;
  const occRate = total === 0 ? 0 : Math.round((occ/total)*100);

  const income  = financeToday.filter(e=>e.type==="income").reduce((a,e)=>a+e.amount,0);
  const expense = financeToday.filter(e=>e.type==="expense").reduce((a,e)=>a+e.amount,0);
  const urgentN = notifications.filter(n=>n.urgent).length;

  const floorRooms = roomsState.filter(r=>floor === 0 || r.floor===floor);

  /* Room state mutation */
  const updateRoom = (id:string, patch:Partial<Room>) => {
    setRoomsState(prev=>prev.map(r=>r.id===id?{...r,...patch}:r));
    setSelRoom(prev=>prev?.id===id?{...prev,...patch} as Room:prev);
  };

  /* ════════════════════════════════════════════
     SIDEBAR
  ════════════════════════════════════════════ */
  const Sidebar = (
    <aside style={{width:collapsed?64:248,background:"#080F1E",flexShrink:0,
      borderRight:"1px solid rgba(255,255,255,0.04)",display:"flex",flexDirection:"column",
      height:"100%",position:"relative",transition:"width 240ms cubic-bezier(.4,0,.2,1)"}}>
      {/* Logo */}
      <div style={{padding:collapsed?"18px 14px":"18px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)",
        display:"flex",alignItems:"center",gap:10}}>
        <img
          src="/hotel_logo.png"
          alt="MaM Hotel Logo"
          style={{width:34,height:"auto",objectFit:"contain",flexShrink:0,filter:"drop-shadow(0 2px 8px rgba(184,148,74,0.4))"}}
        />
        {!collapsed && (
          <div style={{overflow:"hidden"}}>
            <p style={{fontFamily:"'Cormorant Garamond',serif",color:"#FFF",fontSize:17,fontWeight:700,letterSpacing:"0.05em",lineHeight:1.1,whiteSpace:"nowrap"}}>MaM Hotel</p>
            <p style={{fontSize:9,color:rm.color,opacity:.85,whiteSpace:"nowrap",letterSpacing:"0.08em",textTransform:"uppercase"}}>{rm.labelEn}</p>
          </div>
        )}
      </div>

      {/* Toggle */}
      <button onClick={()=>setCollapsed(!collapsed)} style={{position:"absolute",right:-11,top:20,
        width:22,height:22,borderRadius:99,background:"#080F1E",border:`1.5px solid ${rm.color}50`,
        color:rm.color,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:10}}>
        {collapsed?<ChevronRight size={10}/>:<ChevronLeft size={10}/>}
      </button>

      {/* Role badge */}
      {!collapsed && (
        <div style={{margin:"10px 10px 0",padding:"8px 12px",borderRadius:10,
          background:rm.bg,border:`1px solid ${rm.color}30`,display:"flex",alignItems:"center",gap:8}}>
          <span style={{width:8,height:8,borderRadius:99,background:rm.color,flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:12,fontWeight:700,color:rm.color,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{rm.label}</p>
            <p style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginTop:1,lineHeight:1.4}}>{rm.desc}</p>
          </div>
          <button onClick={()=>setShowPermPanel(!showPermPanel)} style={{color:"rgba(255,255,255,0.3)",cursor:"pointer",flexShrink:0}}>
            <Info size={13}/>
          </button>
        </div>
      )}

      {/* Nav */}
      <nav style={{flex:1,padding:"12px 8px",overflowY:"auto"}}>
        {menu.map(item=>{
          const Icon=item.icon;
          const active=page===item.id;
          return (
            <button key={item.id} onClick={()=>setPage(item.id)} title={collapsed?item.label:undefined}
              style={{width:"100%",display:"flex",alignItems:"center",gap:9,
                padding:collapsed?"10px 15px":"9px 10px",borderRadius:10,cursor:"pointer",
                marginBottom:2,background:active?`${rm.color}14`:"transparent",
                justifyContent:collapsed?"center":"flex-start",
                borderLeft:`3px solid ${active?rm.color:"transparent"}`}}>
              <div style={{width:28,height:28,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                background:active?`${rm.color}20`:"rgba(255,255,255,0.04)"}}>
                <Icon size={14} style={{color:active?rm.color:"rgba(255,255,255,0.38)"}} strokeWidth={active?2:1.5}/>
              </div>
              {!collapsed && (
                <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"space-between",minWidth:0}}>
                  <span style={{fontSize:13,fontWeight:active?600:400,
                    color:active?"#FFF":"rgba(255,255,255,0.45)",whiteSpace:"nowrap"}}>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:99,
                      background:active?`${rm.color}30`:"rgba(255,255,255,0.08)",
                      color:active?rm.color:"rgba(255,255,255,0.35)"}}>
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Shift info */}
      {!collapsed && (
        <div style={{margin:"0 10px 8px",borderRadius:10,padding:"10px 12px",
          background:`linear-gradient(135deg,${rm.color}10,${rm.color}05)`,border:`1px solid ${rm.color}18`}}>
          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
            <Clock size={10} style={{color:rm.color}}/>
            <span style={{fontSize:10,fontWeight:600,color:rm.color}}>Dữ liệu phòng trực tuyến</span>
          </div>
          <div style={{height:2,borderRadius:99,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
            <div style={{height:"100%",width:"57%",borderRadius:99,background:rm.gr}}/>
          </div>
          <p style={{fontSize:9,color:"rgba(255,255,255,0.25)",marginTop:4}}>Chỉ hiển thị dữ liệu trong phạm vi quyền</p>
        </div>
      )}

      {/* User */}
      <div style={{borderTop:"1px solid rgba(255,255,255,0.05)",padding:collapsed?"12px":"12px 14px",
        display:"flex",alignItems:"center",gap:10,justifyContent:collapsed?"center":"flex-start",position:"relative"}}>
        <div
          onClick={()=>setSidebarProfileOpen(p=>!p)}
          style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",flex:1,minWidth:0}}
          title="Hồ sơ nhân viên"
        >
          <div style={{width:30,height:30,borderRadius:99,background:rm.gr,flexShrink:0,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#080F1E"}}>NV</div>
          {!collapsed && (
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:12,fontWeight:600,color:"#FFF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Nhân viên Khách sạn</p>
              <p style={{fontSize:9,color:"rgba(255,255,255,0.28)"}}>{rm.label}</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <button onClick={onBack} style={{color:"rgba(255,255,255,0.2)",cursor:"pointer",background:"none",border:"none",padding:0}} title="Đăng xuất"><LogOut size={13}/></button>
        )}
        <EmployeeProfileDropdown
          isOpen={sidebarProfileOpen}
          onClose={()=>setSidebarProfileOpen(false)}
          onLogout={onBack}
          align="bottom-left"
          currentRoleLabel={rm.label}
          departmentName="Bộ phận Vận hành"
        />
      </div>
    </aside>
  );

  /* ════════════════════════════════════════════
     NAVBAR
  ════════════════════════════════════════════ */
  const Navbar = (
    <header style={{height:54,background:NAV,borderBottom:`1px solid ${BORDER}`,
      display:"flex",alignItems:"center",gap:10,padding:"0 18px",flexShrink:0,zIndex:20}}>
      <div style={{display:"flex",alignItems:"center",gap:5}}>
        <span style={{fontSize:11,color:T2}}>MaM Hotel</span>
        <ChevronRight size={11} style={{color:T2}}/>
        <span style={{fontSize:11,fontWeight:600,color:T1}}>{menu.find(m=>m.id===page)?.label||"Tổng quan"}</span>
      </div>
      <div style={{flex:1}}/>
      {/* Search */}
      <div style={{display:"flex",alignItems:"center",gap:7,background:INPUT,
        border:`1px solid ${BORDER}`,borderRadius:9,padding:"5px 11px",width:200}}>
        <Search size={12} style={{color:T2}}/>
        <input placeholder="Tìm kiếm nhanh…"
          style={{background:"transparent",border:"none",outline:"none",fontSize:12,color:T1,width:"100%"}}/>
      </div>
      {/* System */}
      <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:8,
        background:dark?"rgba(34,197,94,0.08)":"#F0FDF4",border:"1px solid #BBF7D0"}}>
        <span style={{width:6,height:6,borderRadius:99,background:"#22C55E"}}/>
        <span role="status" style={{fontSize:11,fontWeight:600,color:roomsError?"#B91C1C":"#16A34A"}}>{roomsLoading ? "Đang tải phòng…" : roomsError ? "Lỗi tải phòng" : "Đã kết nối"}</span>
        {roomsError && <div role="alert">{roomsError} <button onClick={() => setLoadRevision(value => value + 1)}>Thử lại</button></div>}
      </div>
      {/* Role pill */}
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:8,
        background:rm.bg,border:`1px solid ${rm.color}30`}}>
        <span style={{fontSize:11,fontWeight:700,color:rm.color}}>{rm.label}</span>
      </div>
      {/* Notifications */}
      <div style={{position:"relative"}}>
        <button onClick={()=>setNotifOpen(!notifOpen)} style={{width:34,height:34,borderRadius:9,
          background:INPUT,border:`1px solid ${BORDER}`,display:"flex",alignItems:"center",
          justifyContent:"center",cursor:"pointer",position:"relative"}}>
          <Bell size={14} style={{color:T2}}/>
          {urgentN>0 && <span style={{position:"absolute",top:-3,right:-3,width:15,height:15,borderRadius:99,
            background:"#EF4444",color:"#FFF",fontSize:8,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{urgentN}</span>}
        </button>
        {notifOpen && (
          <>
            <div style={{position:"fixed",inset:0,zIndex:10}} onClick={()=>setNotifOpen(false)}/>
            <div style={{position:"absolute",right:0,top:40,width:300,background:CARD,
              border:`1px solid ${BORDER}`,borderRadius:14,boxShadow:"0 16px 48px rgba(0,0,0,0.15)",zIndex:20,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:13,fontWeight:700,color:T1}}>Thông báo</span>
                <span style={{fontSize:9,padding:"2px 7px",borderRadius:99,background:"#EF4444",color:"#FFF",fontWeight:700}}>{urgentN} khẩn</span>
              </div>
              {notifications.map((n,i)=>(
                <div key={n.id} style={{padding:"10px 16px",borderBottom:i<notifications.length-1?`1px solid ${BORDER}`:"none",
                  background:n.urgent?(dark?"rgba(239,68,68,0.04)":"rgba(239,68,68,0.02)"):"transparent"}}>
                  <div style={{display:"flex",gap:9}}>
                    <div style={{width:7,height:7,borderRadius:99,marginTop:4,flexShrink:0,
                      background:n.urgent?"#EF4444":"#22C55E"}}/>
                    <div>
                      <p style={{fontSize:12,fontWeight:600,color:T1}}>{n.title}</p>
                      <p style={{fontSize:10,color:T2,marginTop:2}}>{n.desc}</p>
                      <p style={{fontSize:9,color:T2,marginTop:3,opacity:.6}}>{n.time} trước</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {/* Dark mode */}
      <button onClick={()=>setDark(!dark)} style={{width:34,height:34,borderRadius:9,
        background:INPUT,border:`1px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
        {dark?<Sun size={14} style={{color:"#B8944A"}}/>:<Moon size={14} style={{color:T2}}/>}
      </button>
      {/* User Profile in Navbar */}
      <div style={{position:"relative"}}>
        <button
          onClick={()=>setTopProfileOpen(p=>!p)}
          style={{display:"flex",alignItems:"center",gap:6,background:INPUT,border:`1px solid ${BORDER}`,borderRadius:9,padding:"4px 8px",cursor:"pointer"}}
          title="Hồ sơ nhân viên"
        >
          <div style={{width:24,height:24,borderRadius:99,background:rm.gr,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#080F1E"}}>NV</div>
          <ChevronDown size={11} style={{color:T2}}/>
        </button>
        <EmployeeProfileDropdown
          isOpen={topProfileOpen}
          onClose={()=>setTopProfileOpen(false)}
          onLogout={onBack}
          align="top-right"
          currentRoleLabel={rm.label}
          departmentName="Bộ phận Vận hành"
        />
      </div>
    </header>
  );

  /* ════════════════════════════════════════════
     PERMISSION PANEL (slide-in info)
  ════════════════════════════════════════════ */
  const PermPanel = showPermPanel && (
    <>
      <div style={{position:"fixed",inset:0,zIndex:30,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(2px)"}}
        onClick={()=>setShowPermPanel(false)}/>
      <div style={{position:"fixed",left:collapsed?64:248,top:0,bottom:0,zIndex:40,width:300,
        background:CARD,borderRight:`1px solid ${BORDER}`,boxShadow:"4px 0 24px rgba(0,0,0,0.15)",
        display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"16px 18px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:T1}}>Phân quyền</p>
            <p style={{fontSize:11,color:T2,marginTop:2}}>{rm.label}</p>
          </div>
          <button onClick={()=>setShowPermPanel(false)} style={{color:T2,cursor:"pointer"}}><X size={15}/></button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:16}}>
          {[
            {title:"📋 Đặt phòng & Lưu trú", items:[
              {ok:perm.room.canCheckIn,    label:"Nhận phòng cho khách"},
              {ok:perm.room.canCheckOut,   label:"Trả phòng cho khách"},
              {ok:perm.room.canBook,       label:"Tạo đặt phòng mới"},
              {ok:perm.room.canTransfer,   label:"Chuyển phòng"},
            ]},
            {title:"🧹 Buồng phòng", items:[
              {ok:perm.room.canMarkCleaning,    label:"Cập nhật đang dọn"},
              {ok:perm.room.canReportCleanDone, label:"Báo hoàn thành dọn dẹp"},
              {ok:perm.room.canMarkAvailable,   label:"Xác nhận phòng trống (nghiệm thu)"},
              {ok:perm.housekeeping.canAssignTasks, label:"Phân công nhiệm vụ"},
            ]},
            {title:"🔧 Kỹ thuật", items:[
              {ok:perm.room.canPutMaintenance,  label:"Đưa phòng vào bảo trì"},
              {ok:perm.room.canEndMaintenance,  label:"Báo hoàn thành bảo trì"},
              {ok:perm.technical.canCreateDraft,label:"Tạo cấu hình (bản nháp)"},
              {ok:perm.technical.canApproveOwn, label:"Tự phê duyệt cấu hình của mình"},
            ]},
            {title:"💰 Tài chính", items:[
              {ok:perm.finance.canView,             label:"Xem báo cáo tài chính"},
              {ok:perm.finance.canCreateReceipt,    label:"Tạo phiếu thu/chi"},
              {ok:perm.finance.canShiftHandover,    label:"Bàn giao ca"},
              {ok:perm.finance.canModifyReservation,label:"Sửa đặt phòng / trạng thái phòng"},
            ]},
            {title:"✅ Phê duyệt", items:[
              {ok:perm.approvals.canApproveRefund,  label:"Phê duyệt hoàn tiền (chỉ Giám đốc)"},
              {ok:perm.approvals.canApproveConfig,  label:"Duyệt cấu hình kỹ thuật"},
              {ok:perm.finance.canApprovePriceChange, label:"Duyệt thay đổi giá"},
            ]},
            {title:"📊 Báo cáo", items:[
              {ok:perm.reports.canViewRevenue,      label:"Xem doanh thu"},
              {ok:perm.reports.canViewAuditLog,     label:"Xem nhật ký truy vết"},
              {ok:perm.reports.canViewStaffActivity,label:"Xem hoạt động nhân viên"},
            ]},
          ].map(group=>(
            <div key={group.title} style={{marginBottom:16}}>
              <p style={{fontSize:11,fontWeight:700,color:T2,marginBottom:8}}>{group.title}</p>
              <div style={{background:INPUT,borderRadius:10,padding:"8px 12px"}}>
                {group.items.map(item=><PermBadge key={item.label} ok={item.ok} label={item.label}/>)}
              </div>
            </div>
          ))}
          {/* Key restrictions */}
          {Object.keys(perm.lockReasons).length > 0 && (
            <div style={{marginTop:4}}>
              <p style={{fontSize:11,fontWeight:700,color:T2,marginBottom:8}}>⛔ Giới hạn quan trọng</p>
              <div style={{background:"rgba(239,68,68,0.04)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:10,padding:"10px 12px"}}>
                {Object.values(perm.lockReasons).map((r,i)=>(
                  <div key={i} style={{display:"flex",gap:7,padding:"3px 0"}}>
                    <Lock size={11} style={{color:"#EF4444",flexShrink:0,marginTop:1}}/>
                    <p style={{fontSize:11,color:"#EF4444",lineHeight:1.5}}>{r}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  /* ════════════════════════════════════════════
     DASHBOARD PAGE
  ════════════════════════════════════════════ */
  const DashboardPage = (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {/* Welcome banner */}
      <div style={{borderRadius:18,overflow:"hidden",position:"relative",
        background:`linear-gradient(135deg,#080F1E 0%,#162040 100%)`,padding:"22px 26px"}}>
        <div style={{position:"absolute",right:-30,top:-30,width:200,height:200,borderRadius:99,
          background:`radial-gradient(circle,${rm.color}20,transparent 70%)`}}/>
        <div style={{position:"relative",display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:14}}>
          <div>
            <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",color:rm.color,textTransform:"uppercase",marginBottom:5}}>
              ● Thông tin vận hành · {rm.label}
            </p>
            <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,color:"#FFF",lineHeight:1.1,margin:0}}>
              Xin chào, {userProfile?.full_name || "Nhân viên"}
            </h1>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:4}}>{new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })} · MaM Hotel</p>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {[
              {label:"Công suất",value:`${occ}/${total}`,color:"#60A5FA"},
              {label:"Chờ dọn", value:`${hk}p`,color:"#FBBF24"},
              ...(perm.finance.canView ? [{label:"Doanh thu",value:fmtVND(income),color:"#34D399"}] : []),
            ].map(s=>(
              <div key={s.label} style={{background:"rgba(255,255,255,0.07)",backdropFilter:"blur(8px)",
                border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"8px 12px"}}>
                <p style={{fontSize:10,color:"rgba(255,255,255,0.38)",marginBottom:3}}>{s.label}</p>
                <p style={{fontSize:15,fontWeight:700,color:"#FFF",fontFamily:"'JetBrains Mono',monospace"}}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:14}}>
        {/* Occupancy */}
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:18}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
            <div>
              <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.06em",color:T2,textTransform:"uppercase"}}>Tổng phòng</p>
              <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:40,color:T1,lineHeight:1,marginTop:4}}>{total}</p>
              <p style={{fontSize:10,color:"#22C55E",marginTop:3}}>▲ {occRate}% công suất</p>
            </div>
            <div style={{position:"relative"}}>
              <Donut pct={occRate} color={rm.color} size={62}/>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:11,fontWeight:700,color:T1,fontFamily:"'JetBrains Mono',monospace"}}>{occRate}%</span>
              </div>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {([["Sẵn sàng",avail,"#22C55E"],["Đang có khách",occ,"#6366F1"],["Đã giữ phòng",res,"#A78BFA"],["Đang dọn",hk,"#F59E0B"],["Đang bảo trì",maint,"#EF4444"]] as [string,number,string][]).map(([l,v,c])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:7}}>
                <span style={{width:7,height:7,borderRadius:99,background:c,flexShrink:0}}/>
                <span style={{fontSize:11,color:T2,flex:1}}>{l}</span>
                <span style={{fontSize:11,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:c}}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue — chỉ hiển thị nếu có quyền */}
        {perm.finance.canView ? (
          <div style={{background:"linear-gradient(135deg,#080F1E,#162040)",border:`1px solid ${BORDER}`,
            borderRadius:14,padding:18,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",right:-15,top:-15,width:100,height:100,borderRadius:99,background:"rgba(255,255,255,0.03)"}}/>
            <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.06em",color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>Doanh thu hôm nay</p>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,color:"#FFF",lineHeight:1,marginTop:5}}>{fmtVND(income)}</p>
            <p style={{fontSize:10,color:"rgba(255,255,255,0.6)",marginTop:4}}>Tổng thu theo hóa đơn phát sinh trong ngày</p>
            <div style={{marginTop:14}}>
              <div style={{marginBottom:7}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>Số lượng hóa đơn</span>
                  <span style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.65)",fontFamily:"'JetBrains Mono',monospace"}}>{financeToday.length} giao dịch</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Finance locked card */
          <div style={{background:CARD,border:`2px dashed ${BORDER}`,borderRadius:14,padding:18,
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:180,gap:10}}>
            <div style={{width:44,height:44,borderRadius:12,background:"rgba(239,68,68,0.08)",
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Lock size={20} style={{color:"#EF4444"}}/>
            </div>
            <div style={{textAlign:"center"}}>
              <p style={{fontSize:13,fontWeight:600,color:T2}}>Báo cáo tài chính</p>
              <p style={{fontSize:11,color:T2,opacity:.6,marginTop:4,lineHeight:1.5}}>
                {lockReason(role,"finance")}
              </p>
            </div>
          </div>
        )}

        {/* Today arrivals mini */}
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:18}}>
          <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.06em",color:T2,textTransform:"uppercase"}}>Nhận phòng hôm nay</p>
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:40,color:T1,lineHeight:1,marginTop:4}}>{perm.reports.canViewAllBookings ? arrivals.length : "—"}</p>
          <p style={{fontSize:10,color:T2,marginTop:3}}>{perm.reports.canViewAllBookings ? "Theo dữ liệu booking đã tải" : "Vai trò này không xem dữ liệu booking"}</p>
          <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:7}}>
            {arrivals.slice(0,3).map(b=>(
              <div key={b.id} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 9px",
                borderRadius:9,background:INPUT,border:`1px solid ${BORDER}`}}>
                <div style={{width:26,height:26,borderRadius:99,background:rm.gr,flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#080F1E"}}>
                  {b.guestName.split(" ").map(n=>n[0]).join("").slice(0,2)}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:11,fontWeight:600,color:T1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.guestName}</p>
                  <p style={{fontSize:9,color:T2}}>Phòng {b.roomNumber}</p>
                </div>
                <span style={{fontSize:9,padding:"2px 6px",borderRadius:99,fontWeight:600,
                  background:b.depositStatus==="paid"?"rgba(34,197,94,0.1)":"rgba(245,158,11,0.1)",
                  color:b.depositStatus==="paid"?"#22C55E":"#F59E0B"}}>
                  {b.depositStatus==="paid"?"✓ Cọc":"Chờ"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Room mosaic */}
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:18}}>
          <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.06em",color:T2,textTransform:"uppercase",marginBottom:12}}>Trạng thái phòng</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:3,marginBottom:14}}>
            {roomsState.map(r=>(
              <div key={r.id} title={`${r.number}–${RS[r.status].label}`} style={{height:16,borderRadius:3,
                background:RS[r.status].color,opacity:.75,cursor:"pointer"}}/>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
            {([["Sẵn sàng",avail,"#22C55E"],["Đang có khách",occ,"#6366F1"],["Đang dọn",hk,"#F59E0B"],["Đang bảo trì",maint,"#EF4444"]] as [string,number,string][]).map(([l,v,c])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 8px",borderRadius:7,background:INPUT}}>
                <span style={{width:7,height:7,borderRadius:99,background:c,flexShrink:0}}/>
                <span style={{fontSize:10,color:T2,flex:1}}>{l}</span>
                <span style={{fontSize:11,fontWeight:700,color:T1}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Arrivals table — only for roles that handle guests */}
      {(perm.room.canCheckIn || perm.reports.canViewAllBookings) && (
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,overflow:"hidden"}}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:T1}}>Khách đến hôm nay</h2>
              <p style={{fontSize:10,color:T2,marginTop:2}}>{arrivals.length} lượt check-in · {new Date().toLocaleDateString("vi-VN")}</p>
            </div>
            <div style={{display:"flex",gap:7}}>
              {perm.room.canBook && (
                <button style={{display:"flex",alignItems:"center",gap:5,padding:"5px 11px",borderRadius:8,
                  background:rm.gr,color:"#080F1E",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  <Plus size={11}/> Đặt phòng mới
                </button>
              )}
            </div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:dark?"rgba(255,255,255,0.02)":"#F9F7F4",borderBottom:`1px solid ${BORDER}`}}>
                  {["Mã","Khách hàng","Phòng","Thời gian","Cọc","Tổng tiền","Thao tác"].map(h=>(
                    <th key={h} style={{textAlign:"left",padding:"9px 14px",fontSize:10,fontWeight:700,
                      letterSpacing:"0.07em",color:T2,textTransform:"uppercase"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {arrivals.map((b,i)=>(
                  <tr key={b.id} style={{borderBottom:i<arrivals.length-1?`1px solid ${BORDER}`:"none"}}
                    onMouseEnter={e=>(e.currentTarget.style.background=dark?"rgba(255,255,255,0.02)":"#FAFAF8")}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                    <td style={{padding:"11px 14px"}}>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:600,
                        padding:"2px 7px",borderRadius:5,background:rm.bg,color:rm.color}}>{b.id}</span>
                    </td>
                    <td style={{padding:"11px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:9}}>
                        <div style={{width:28,height:28,borderRadius:99,background:rm.gr,flexShrink:0,
                          display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#080F1E"}}>
                          {b.guestName.split(" ").map(n=>n[0]).join("").slice(0,2)}
                        </div>
                        <div>
                          <p style={{fontSize:12,fontWeight:600,color:T1}}>{b.guestName}</p>
                          <p style={{fontSize:10,color:T2}}>{b.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{padding:"11px 14px"}}>
                      <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700,color:T1}}>#{b.roomNumber}</p>
                      <p style={{fontSize:10,color:T2}}>{b.roomType}</p>
                    </td>
                    <td style={{padding:"11px 14px"}}>
                      <p style={{fontSize:11,color:T1}}>{b.checkIn}</p>
                      <p style={{fontSize:10,color:T2}}>{b.nights} đêm</p>
                    </td>
                    <td style={{padding:"11px 14px"}}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,fontWeight:600,
                        padding:"3px 9px",borderRadius:99,
                        background:b.depositStatus==="paid"?"rgba(34,197,94,0.1)":"rgba(245,158,11,0.1)",
                        color:b.depositStatus==="paid"?"#22C55E":"#F59E0B"}}>
                        <span style={{width:5,height:5,borderRadius:99,background:b.depositStatus==="paid"?"#22C55E":"#F59E0B"}}/>
                        {b.depositStatus==="paid"?"Đã cọc":"Chờ cọc"}
                      </span>
                    </td>
                    <td style={{padding:"11px 14px"}}>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700,color:T1}}>{fmtVND(b.totalAmount)}</span>
                    </td>
                    <td style={{padding:"11px 14px"}}>
                      <div style={{display:"flex",gap:5,alignItems:"center"}}>
                        {perm.room.canCheckIn ? (
                          b.depositStatus==="paid" ? (
                            <button style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",
                              borderRadius:7,background:rm.gr,color:"#080F1E",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                              <LogIn size={10}/> Nhận phòng
                            </button>
                          ) : (
                            <button style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",
                              borderRadius:7,background:"rgba(245,158,11,0.1)",color:"#F59E0B",fontSize:11,
                              fontWeight:600,cursor:"pointer",border:"1px solid rgba(245,158,11,0.25)"}}>
                              <QrCode size={10}/> Thu cọc
                            </button>
                          )
                        ) : (
                          <LockedAction reason={lockReason(role,"checkIn")}>
                            <button style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",
                              borderRadius:7,background:INPUT,color:T2,fontSize:11,cursor:"not-allowed"}}>
                              <LogIn size={10}/> Nhận phòng
                            </button>
                          </LockedAction>
                        )}
                        <button style={{width:26,height:26,borderRadius:7,background:INPUT,display:"flex",
                          alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                          <Eye size={11} style={{color:T2}}/>
                        </button>
                      </div>
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

  /* ════════════════════════════════════════════
     ROOM MATRIX PAGE
  ════════════════════════════════════════════ */
  const RoomMatrixPage = (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Permission notice for restricted roles */}
      {role==="accounting" && (
        <div style={{display:"flex",gap:10,padding:"12px 16px",borderRadius:12,
          background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.2)"}}>
          <Info size={15} style={{color:"#8B5CF6",flexShrink:0,marginTop:1}}/>
          <p style={{fontSize:12,color:"#8B5CF6",lineHeight:1.5}}>
            <strong>Kế toán · Chỉ xem:</strong> Bạn có thể xem trạng thái phòng để đối soát hóa đơn, nhưng không thể thay đổi trạng thái phòng hoặc đặt phòng.
          </p>
        </div>
      )}
      {role==="housekeeping" && (
        <div style={{display:"flex",gap:10,padding:"12px 16px",borderRadius:12,
          background:"rgba(16,185,129,0.06)",border:"1px solid rgba(16,185,129,0.2)"}}>
          <Info size={15} style={{color:"#10B981",flexShrink:0,marginTop:1}}/>
          <p style={{fontSize:12,color:"#10B981",lineHeight:1.5}}>
            <strong>Buồng phòng:</strong> Bạn chỉ cập nhật trạng thái vệ sinh và báo sự cố. Sau khi báo hoàn thành, Quản lý sẽ nghiệm thu và mở khóa phòng.
          </p>
        </div>
      )}
      {role==="maintenance" && (
        <div style={{display:"flex",gap:10,padding:"12px 16px",borderRadius:12,
          background:"rgba(249,115,22,0.06)",border:"1px solid rgba(249,115,22,0.2)"}}>
          <Info size={15} style={{color:"#F97316",flexShrink:0,marginTop:1}}/>
          <p style={{fontSize:12,color:"#F97316",lineHeight:1.5}}>
            <strong>Kỹ thuật:</strong> Sau khi bạn báo hoàn thành bảo trì, Quản lý phải nghiệm thu trước khi phòng tự động về trạng thái Sẵn sàng.
          </p>
        </div>
      )}

      <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,overflow:"hidden"}}>
        <div style={{padding:"18px 22px",borderBottom:`1px solid ${BORDER}`,
          display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:T1}}>Ma trận phòng</h2>
            <p style={{fontSize:10,color:T2,marginTop:2}}>Nhấp vào phòng để xem chi tiết</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
            {Object.entries(RS).map(([s,m])=>(
              <div key={s} style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{width:8,height:8,borderRadius:99,background:m.color}}/>
                <span style={{fontSize:11,color:T2}}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Floor tabs */}
        <div style={{display:"flex",flexWrap:"wrap",gap:3,padding:"10px 18px 0"}}>
          {[0, ...Array.from(new Set(roomsState.map(room => room.floor))).sort((a,b) => a-b)].map(f=>(
            <button key={f} onClick={()=>setFloor(f)}
              style={{padding:"7px 14px",borderRadius:"8px 8px 0 0",fontSize:12,fontWeight:600,cursor:"pointer",
                background:floor===f?CARD:"transparent",
                color:floor===f?(f===4?rm.color:T1):T2,
                borderTop:`1px solid ${floor===f?BORDER:"transparent"}`,
                borderLeft:`1px solid ${floor===f?BORDER:"transparent"}`,
                borderRight:`1px solid ${floor===f?BORDER:"transparent"}`,
                borderBottom:floor===f?`1px solid ${CARD}`:"1px solid transparent",
                marginBottom:floor===f?-1:0}}>
              {f===0 ? "Tất cả tầng" : `Tầng ${f}`}
            </button>
          ))}
        </div>
        <div style={{padding:18,borderTop:`1px solid ${BORDER}`,
          display:"grid",gap:9,gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))"}}>
          {floorRooms.map(room=>{
            const meta=RS[room.status];
            return (
              <button key={room.id} onClick={()=>setSelRoom(room)}
                style={{textAlign:"left",background:meta.bg,border:`1.5px solid ${meta.color}28`,
                  borderRadius:12,padding:13,cursor:"pointer",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:meta.color,opacity:.5,borderRadius:"12px 12px 0 0"}}/>
                <div style={{display:"flex",alignItems:"start",justifyContent:"space-between",marginBottom:7}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:800,color:meta.color}}>{room.number}</span>
                  <span style={{width:7,height:7,borderRadius:99,background:meta.color,marginTop:2}}/>
                </div>
                <p style={{fontSize:10,fontWeight:600,color:T1,marginBottom:2}}>{roomTypeLabel(room.type)}</p>
                {room.guestName
                  ? <p style={{fontSize:9,color:T2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{room.guestName}</p>
                  : <p style={{fontSize:9,color:meta.color,opacity:.7}}>{meta.label}</p>}
                <p style={{fontSize:9,marginTop:7,fontFamily:"'JetBrains Mono',monospace",color:T2}}>{fmtVND(room.pricePerNight)}</p>
                {room.floor===4&&<Star size={9} style={{color:"#B8944A",fill:"#B8944A",marginTop:3}}/>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════
     HOUSEKEEPING KANBAN
  ════════════════════════════════════════════ */
  const typeLabel: Record<string,string> = {
    "checkout-clean":"Dọn sau trả phòng","daily-service":"Dọn hàng ngày",
    "deep-clean":"Vệ sinh sâu","inspection":"Kiểm tra phòng",
  };
  const HousekeepingPage = (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T1}}>Bảng nhiệm vụ vệ sinh</h2>
          <p style={{fontSize:11,color:T2,marginTop:2}}>Ca sáng 06:00–14:00 · {housekeepingTasks.length} nhiệm vụ</p>
        </div>
        {perm.housekeeping.canAssignTasks && (
          <button style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,
            background:rm.gr,color:"#080F1E",fontSize:12,fontWeight:700,cursor:"pointer"}}>
            <Plus size={13}/> Phân công mới
          </button>
        )}
      </div>

      {/* Rule reminder for housekeeping */}
      {role==="housekeeping" && (
        <div style={{display:"flex",gap:10,padding:"10px 14px",borderRadius:10,
          background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)"}}>
          <AlertTriangle size={14} style={{color:"#F59E0B",flexShrink:0,marginTop:1}}/>
          <p style={{fontSize:11,color:"#F59E0B",lineHeight:1.5}}>
            Sau khi báo "Hoàn thành", Quản lý sẽ nghiệm thu phòng. Phòng chỉ chuyển về <strong>Sẵn sàng</strong> sau khi được xác nhận — bạn không tự chuyển được.
          </p>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {[
          {id:"pending",    label:"⏳ Chờ xử lý",  color:"#F59E0B", tasks:housekeepingTasks.filter(t=>t.status==="pending")},
          {id:"in-progress",label:"🔵 Đang thực hiện",color:"#6366F1",tasks:housekeepingTasks.filter(t=>t.status==="in-progress")},
          {id:"done",       label:"✅ Hoàn thành",  color:"#22C55E", tasks:housekeepingTasks.filter(t=>t.status==="done")},
        ].map(col=>(
          <div key={col.id}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9,
              padding:"9px 13px",borderRadius:10,background:CARD,border:`1px solid ${BORDER}`}}>
              <span style={{fontSize:12,fontWeight:700,color:T1}}>{col.label}</span>
              <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:99,
                background:`${col.color}12`,color:col.color}}>{col.tasks.length}</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {col.tasks.map(task=>{
                const pc=task.priority==="high"?"#EF4444":task.priority==="medium"?"#F59E0B":"#22C55E";
                return (
                  <div key={task.id} style={{background:CARD,borderRadius:11,
                    borderTop:`1px solid ${BORDER}`,borderRight:`1px solid ${BORDER}`,
                    borderBottom:`1px solid ${BORDER}`,borderLeft:`3px solid ${col.color}`,
                    padding:13,cursor:"pointer",
                    boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}
                    onMouseEnter={e=>(e.currentTarget.style.boxShadow="0 4px 14px rgba(0,0,0,0.1)")}
                    onMouseLeave={e=>(e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)")}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:800,color:col.color}}>
                          {task.roomNumber}
                        </span>
                        <span style={{fontSize:9,fontWeight:700,padding:"2px 5px",borderRadius:4,
                          background:`${pc}12`,color:pc,textTransform:"uppercase"}}>
                          {task.priority==="high"?"Khẩn":task.priority==="medium"?"BT":"Thấp"}
                        </span>
                      </div>
                      <button style={{color:T2,cursor:"pointer"}}><MoreHorizontal size={13}/></button>
                    </div>
                    <p style={{fontSize:12,fontWeight:600,color:T1,marginBottom:4}}>{typeLabel[task.type]}</p>
                    {task.note && <p style={{fontSize:10,color:T2,marginBottom:8,lineHeight:1.5}}>{task.note}</p>}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                      marginTop:10,paddingTop:9,borderTop:`1px solid ${BORDER}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <div style={{width:18,height:18,borderRadius:99,background:rm.gr,
                          display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:700,color:"#080F1E"}}>
                          {task.assignedTo.split(" ").map(n=>n[0]).join("").slice(0,2)}
                        </div>
                        <span style={{fontSize:10,color:T2}}>{task.assignedTo.split(" ").slice(-1)[0]}</span>
                      </div>
                      {/* Role-specific action */}
                      {perm.housekeeping.canReceiveTasks && task.status==="in-progress" && (
                        <button style={{fontSize:9,padding:"3px 8px",borderRadius:6,fontWeight:700,cursor:"pointer",
                          background:"rgba(34,197,94,0.1)",color:"#22C55E",border:"1px solid rgba(34,197,94,0.2)"}}>
                          Báo xong
                        </button>
                      )}
                      {perm.housekeeping.canAssignTasks && task.status==="done" && (
                        <button style={{fontSize:9,padding:"3px 8px",borderRadius:6,fontWeight:700,cursor:"pointer",
                          background:rm.bg,color:rm.color,border:`1px solid ${rm.color}30`}}>
                          Nghiệm thu
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {col.tasks.length===0 && (
                <div style={{border:`2px dashed ${BORDER}`,borderRadius:10,padding:"20px 14px",textAlign:"center"}}>
                  <CheckCircle2 size={18} style={{color:T2,margin:"0 auto 5px",opacity:.35}}/>
                  <p style={{fontSize:11,color:T2,opacity:.4}}>Không có nhiệm vụ</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ════════════════════════════════════════════
     INCIDENTS PAGE
  ════════════════════════════════════════════ */
  const IncidentsPage = (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T1}}>
            {role==="housekeeping" ? "Báo sự cố phòng" : "Sự cố & Bảo trì thiết bị"}
          </h2>
          <p style={{fontSize:11,color:T2,marginTop:2}}>
            {role==="housekeeping" ? "Báo cáo sự cố để bộ phận kỹ thuật xử lý" : "Quản lý phiếu bảo trì, đề xuất thanh lý"}
          </p>
        </div>
        {(perm.room.canPutMaintenance || role==="housekeeping") && (
          <button style={{display:"flex",alignItems:"center",gap:6,padding:"7px 13px",borderRadius:9,
            background:rm.gr,color:"#080F1E",fontSize:12,fontWeight:700,cursor:"pointer"}}>
            <Plus size={12}/> {role==="housekeeping"?"Báo sự cố":"Tạo phiếu"}
          </button>
        )}
      </div>

      {/* Draft notice for TECHNICAL */}
      {role==="maintenance" && (
        <div style={{display:"flex",gap:10,padding:"10px 14px",borderRadius:10,
          background:"rgba(249,115,22,0.06)",border:"1px solid rgba(249,115,22,0.2)"}}>
          <AlertTriangle size={14} style={{color:"#F97316",flexShrink:0,marginTop:1}}/>
          <p style={{fontSize:11,color:"#F97316",lineHeight:1.5}}>
            Cấu hình giá hoặc thiết bị mới tạo ở trạng thái <strong>BẢN NHÁP</strong>. Quản lý hoặc Giám đốc mới có thể phê duyệt. Bạn không tự phê duyệt được.
          </p>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
        {[["Chờ xử lý","2","#EF4444"],["Đang xử lý","1","#6366F1"],["Chờ nghiệm thu","1","#F59E0B"],["Hoàn thành","1","#22C55E"]].map(([l,v,c])=>(
          <div key={l} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:"14px 16px",
            display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,color:c as string,lineHeight:1}}>{v}</span>
            <span style={{fontSize:11,color:T2,lineHeight:1.4}}>{l}</span>
          </div>
        ))}
      </div>

      {[
        {id:"MT-301",room:"105",device:"Điều hòa Daikin",issue:"Không lạnh – lỗi E3",     priority:"high",  status:"pending",       age:1.2,propose:"Gọi bảo hành",awaitApproval:false},
        {id:"MT-302",room:"208",device:"Điều hòa LG",    issue:"Lỗi E7 – thay board mạch", priority:"high",  status:"in-progress",   age:3.5,propose:"Thay linh kiện",awaitApproval:false},
        {id:"MT-303",room:"V04",device:"Bồn tắm Jacuzzi",issue:"Mô-tơ không hoạt động",    priority:"high",  status:"await-inspect", age:4.1,propose:"Kiểm tra điện → Báo xong, chờ quản lý",awaitApproval:true},
        {id:"MT-298",room:"304",device:"Tivi 65\" Samsung",issue:"Màn hình vệt đen",       priority:"medium",status:"done",          age:3.8,propose:"Thanh lý (>2 năm)",awaitApproval:false},
      ].map(t=>{
        const pc=t.priority==="high"?"#EF4444":"#F59E0B";
        const sc=t.status==="done"?"#22C55E":t.status==="in-progress"?"#6366F1":t.status==="await-inspect"?"#F59E0B":"#EF4444";
        const sl=t.status==="done"?"Xong":t.status==="in-progress"?"Đang xử lý":t.status==="await-inspect"?"Chờ nghiệm thu":"Chờ xử lý";
        return (
          <div key={t.id} style={{background:CARD,borderRadius:13,padding:18,
            borderTop:`1px solid ${BORDER}`,borderRight:`1px solid ${BORDER}`,
            borderBottom:`1px solid ${BORDER}`,borderLeft:`4px solid ${sc}`,
            display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:42,height:42,borderRadius:11,background:`${sc}10`,
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Wrench size={18} style={{color:sc}}/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,flexWrap:"wrap"}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,padding:"1px 6px",borderRadius:4,
                  background:rm.bg,color:rm.color}}>{t.id}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700,color:T1}}>Phòng {t.room}</span>
                <span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:`${pc}10`,color:pc}}>
                  {t.priority==="high"?"Khẩn":"Bình thường"}
                </span>
                {t.awaitApproval && <ApprovalBadge by="Quản lý nghiệm thu"/>}
              </div>
              <p style={{fontSize:12,fontWeight:600,color:T1,marginBottom:2}}>{t.device}</p>
              <p style={{fontSize:11,color:T2,marginBottom:3}}>{t.issue}</p>
              <div style={{display:"flex",gap:12}}>
                <span style={{fontSize:10,color:T2}}>Tuổi: <b style={{color:T1}}>{t.age}năm</b></span>
                <span style={{fontSize:10,color:T2}}>→ <b style={{color:rm.color}}>{t.propose}</b></span>
                {t.age>2 && <span style={{fontSize:9,padding:"1px 6px",borderRadius:4,
                  background:"rgba(239,68,68,0.1)",color:"#EF4444"}}>Đền 200%</span>}
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <span style={{display:"inline-block",fontSize:10,padding:"3px 9px",borderRadius:99,fontWeight:600,
                background:`${sc}10`,color:sc,marginBottom:8}}>{sl}</span>
              <div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
                {t.status==="in-progress" && perm.room.canEndMaintenance && (
                  <button style={{padding:"4px 10px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",
                    background:rm.bg,color:rm.color,border:`1px solid ${rm.color}30`}}>
                    Báo xong
                  </button>
                )}
                {t.status==="await-inspect" && perm.housekeeping.canInspect && (
                  <button style={{padding:"4px 10px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",
                    background:"linear-gradient(135deg,#22C55E,#16A34A)",color:"#FFF"}}>
                    Nghiệm thu ✓
                  </button>
                )}
                {t.status==="pending" && perm.room.canPutMaintenance && (
                  <button style={{padding:"4px 10px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",
                    background:rm.gr,color:"#080F1E"}}>
                    Nhận xử lý
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ════════════════════════════════════════════
     EQUIPMENT DRAFT PAGE (TECHNICAL only)
  ════════════════════════════════════════════ */
  const EquipmentPage = (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T1}}>Cấu hình thiết bị & Phòng</h2>
          <p style={{fontSize:11,color:T2,marginTop:2}}>Tạo ở trạng thái bản nháp · Cần Quản lý hoặc Giám đốc phê duyệt trước khi có hiệu lực</p>
        </div>
        <button style={{display:"flex",alignItems:"center",gap:6,padding:"7px 13px",borderRadius:9,
          background:rm.gr,color:"#080F1E",fontSize:12,fontWeight:700,cursor:"pointer"}}>
          <Plus size={12}/> Tạo cấu hình mới
        </button>
      </div>

      <div style={{display:"flex",gap:10,padding:"12px 16px",borderRadius:12,
        background:"rgba(249,115,22,0.06)",border:"1px solid rgba(249,115,22,0.2)"}}>
        <Lock size={15} style={{color:"#F97316",flexShrink:0,marginTop:1}}/>
        <p style={{fontSize:12,color:"#F97316",lineHeight:1.5}}>
          <strong>Quy tắc quan trọng:</strong> Mọi thay đổi giá phòng hoặc cấu hình kỹ thuật do bạn tạo sẽ ở trạng thái <strong>BẢN NHÁP</strong>. Bạn không thể tự phê duyệt. Chỉ Quản lý hoặc Giám đốc mới có quyền kích hoạt.
        </p>
      </div>

      <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:36,textAlign:"center"}}>
        <PackageOpen size={36} style={{color:rm.color,margin:"0 auto 10px",opacity:0.7}}/>
        <p style={{fontSize:14,fontWeight:600,color:T1,marginBottom:4}}>Chưa có bản nháp cấu hình kỹ thuật</p>
        <p style={{fontSize:12,color:T2}}>Khi kỹ thuật viên tạo đề xuất thay đổi danh mục thiết bị hoặc thông số phòng, các bản nháp sẽ xuất hiện tại đây để chuyển cấp quản lý phê duyệt.</p>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════
     FINANCE PAGE
  ════════════════════════════════════════════ */
  const FinancePage = perm.finance.canView ? (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T1}}>Thu / Chi hôm nay</h2>
          <p style={{fontSize:11,color:T2,marginTop:2}}>{new Date().toLocaleDateString("vi-VN")} · Ca sáng</p>
        </div>
        {perm.finance.canCreateReceipt && (
          <button style={{display:"flex",alignItems:"center",gap:6,padding:"7px 13px",borderRadius:9,
            background:rm.gr,color:"#080F1E",fontSize:12,fontWeight:700,cursor:"pointer"}}>
            <Plus size={12}/> Tạo phiếu
          </button>
        )}
      </div>

      {/* Restriction note for accounting */}
      {role==="accounting" && (
        <div style={{display:"flex",gap:10,padding:"10px 14px",borderRadius:10,
          background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.2)"}}>
          <Lock size={14} style={{color:"#8B5CF6",flexShrink:0,marginTop:1}}/>
          <p style={{fontSize:11,color:"#8B5CF6",lineHeight:1.5}}>
            <strong>Phạm vi Kế toán:</strong> Bạn chỉ ghi nhận tài chính. Mọi thay đổi đặt phòng hoặc trạng thái phòng phải do Lễ tân hoặc Quản lý thực hiện. Hoàn tiền cần Giám đốc phê duyệt.
          </p>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        {[
          {label:"Tổng thu",       val:income,         icon:TrendingUp,   color:"#22C55E",trend:"+12.4%"},
          {label:"Tổng chi",       val:expense,        icon:TrendingDown, color:"#EF4444",trend:"-2.1%"},
          {label:"Doanh thu thuần",val:income-expense, icon:Banknote,     color:rm.color, trend:"+11.4%"},
        ].map(s=>{
          const Icon=s.icon;
          return (
            <div key={s.label} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:13,padding:18}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
                <div style={{width:38,height:38,borderRadius:10,background:`${s.color}10`,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Icon size={17} style={{color:s.color}}/>
                </div>
                <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:99,
                  background:`${s.color}10`,color:s.color}}>{s.trend}</span>
              </div>
              <p style={{fontSize:10,color:T2,marginBottom:3}}>{s.label}</p>
              <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,color:T1,lineHeight:1}}>{fmtVND(s.val)}</p>
            </div>
          );
        })}
      </div>

      <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:13,overflow:"hidden"}}>
        <div style={{padding:"13px 17px",borderBottom:`1px solid ${BORDER}`}}>
          <h3 style={{fontSize:15,fontWeight:600,color:T1}}>Phiếu thu/chi hôm nay</h3>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:dark?"rgba(255,255,255,0.02)":"#F9F7F4",borderBottom:`1px solid ${BORDER}`}}>
                {["Mã phiếu","Loại","Danh mục","Số tiền","Hình thức","Giờ","Ghi chú","Thao tác"].map(h=>(
                  <th key={h} style={{textAlign:"left",padding:"9px 13px",fontSize:9,fontWeight:700,
                    letterSpacing:"0.08em",color:T2,textTransform:"uppercase"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {financeToday.map((e,i)=>(
                <tr key={e.id} style={{borderBottom:i<financeToday.length-1?`1px solid ${BORDER}`:"none"}}
                  onMouseEnter={ev=>(ev.currentTarget.style.background=dark?"rgba(255,255,255,0.02)":"#FAFAF8")}
                  onMouseLeave={ev=>(ev.currentTarget.style.background="transparent")}>
                  <td style={{padding:"10px 13px"}}>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,padding:"2px 7px",borderRadius:5,
                      background:rm.bg,color:rm.color}}>{e.id}</span>
                  </td>
                  <td style={{padding:"10px 13px"}}>
                    <span style={{fontSize:10,padding:"3px 8px",borderRadius:99,fontWeight:600,
                      background:e.type==="income"?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)",
                      color:e.type==="income"?"#22C55E":"#EF4444"}}>
                      {e.type==="income"?"● Thu":"● Chi"}
                    </span>
                  </td>
                  <td style={{padding:"10px 13px",fontSize:12,color:T1}}>{e.category}</td>
                  <td style={{padding:"10px 13px"}}>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700,
                      color:e.type==="income"?"#22C55E":"#EF4444"}}>
                      {e.type==="income"?"+":"-"}{fmtVND(e.amount)}
                    </span>
                  </td>
                  <td style={{padding:"10px 13px"}}>
                    <span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:INPUT,color:T2}}>
                      {e.method==="cash"?"💵 Tiền mặt":e.method==="card"?"💳 Thẻ":"🏦 CK"}
                    </span>
                  </td>
                  <td style={{padding:"10px 13px",fontSize:11,color:T2,fontFamily:"'JetBrains Mono',monospace"}}>{e.time}</td>
                  <td style={{padding:"10px 13px",fontSize:10,color:T2,maxWidth:180}}>
                    <span style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.note}</span>
                  </td>
                  <td style={{padding:"10px 13px"}}>
                    {perm.finance.canModifyReservation ? (
                      <button style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:INPUT,color:T2,cursor:"pointer"}}>
                        Chỉnh sửa
                      </button>
                    ) : (
                      <LockedAction reason={lockReason(role,"modifyReservation")}>
                        <button style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:INPUT,color:T2}}>
                          Chỉnh sửa
                        </button>
                      </LockedAction>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  ) : (
    /* Finance locked for FRONT_DESK */
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:400,gap:16}}>
      <div style={{width:64,height:64,borderRadius:20,background:"rgba(239,68,68,0.08)",
        display:"flex",alignItems:"center",justifyContent:"center"}}>
        <Lock size={28} style={{color:"#EF4444"}}/>
      </div>
      <div style={{textAlign:"center",maxWidth:320}}>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T1,marginBottom:8}}>Không có quyền truy cập</p>
        <p style={{fontSize:13,color:T2,lineHeight:1.6}}>{lockReason(role,"finance")}</p>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════
     SHIFT HANDOVER
  ════════════════════════════════════════════ */
  const cashStart=5_000_000, cashEnd=cashStart+income-expense;
  const ShiftPage = (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,maxWidth:820}}>
      <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:22}}>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:T1,marginBottom:18}}>Biên bản bàn giao ca</h2>
        {[["Tiền mặt đầu ca",fmtFull(cashStart),T1],[`Tổng thu trong ca`,`+${fmtFull(income)}`,"#22C55E"],[`Tổng chi trong ca`,`-${fmtFull(expense)}`,"#EF4444"],["Cuối ca (hệ thống)",fmtFull(cashEnd),rm.color]].map(([l,v,c])=>(
          <div key={l as string} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:"12px 0",borderBottom:`1px solid ${BORDER}`}}>
            <span style={{fontSize:12,color:T2}}>{l}</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:700,color:c as string}}>{v}</span>
          </div>
        ))}
        <div style={{marginTop:14,padding:14,borderRadius:11,background:rm.bg,border:`1px solid ${rm.color}22`}}>
          <p style={{fontSize:11,color:T2,marginBottom:6}}>Tiền mặt kiểm đếm thực tế</p>
          <input type="number" placeholder="0 ₫" style={{width:"100%",background:"transparent",
            border:"none",outline:"none",fontSize:22,fontWeight:700,color:rm.color,fontFamily:"'Cormorant Garamond',serif"}}/>
        </div>
        <button style={{marginTop:12,width:"100%",padding:"12px",borderRadius:11,
          background:rm.gr,color:"#080F1E",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          Xác nhận bàn giao ca
        </button>
      </div>
      <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:22}}>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:T1,marginBottom:18}}>Phân chia hình thức</h2>
        {[["Tiền mặt",financeToday.filter(e=>e.method==="cash"&&e.type==="income").reduce((a,e)=>a+e.amount,0),"#22C55E","💵"],["Thẻ",financeToday.filter(e=>e.method==="card"&&e.type==="income").reduce((a,e)=>a+e.amount,0),"#6366F1","💳"],["Chuyển khoản",financeToday.filter(e=>e.method==="transfer"&&e.type==="income").reduce((a,e)=>a+e.amount,0),"#8B5CF6","🏦"]].map(([l,v,c,ic])=>(
          <div key={l as string} style={{display:"flex",alignItems:"center",gap:10,padding:13,borderRadius:11,
            marginBottom:9,background:`${c as string}08`,border:`1px solid ${c as string}18`}}>
            <span style={{fontSize:20}}>{ic}</span>
            <div style={{flex:1}}>
              <p style={{fontSize:11,color:T2}}>{l}</p>
              <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:15,fontWeight:700,color:c as string}}>{fmtFull(v as number)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ════════════════════════════════════════════
     HR SHIFT PLANNER (no cash / accounting data)
  ════════════════════════════════════════════ */
  const HRShiftPage = (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T1}}>Lịch & Phân ca</h2>
          <p style={{fontSize:11,color:T2,marginTop:2}}>Tuần hiện tại · Nhân sự quản lý lịch, không quản lý thu chi</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:10,padding:"5px 9px",borderRadius:7,
            background:shiftPublished?"rgba(34,197,94,0.1)":"rgba(245,158,11,0.12)",
            color:shiftPublished?"#22C55E":"#F59E0B",fontWeight:700}}>
            {shiftPublished?"Đã phát hành":"Bản nháp"}
          </span>
          <button onClick={()=>setShiftPublished(true)} style={{padding:"8px 12px",borderRadius:9,background:rm.gr,
            color:"#080F1E",fontSize:11,fontWeight:700,cursor:"pointer"}}>Phát hành lịch</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10}}>
        {[
          ["Nhân viên trong lịch",String(staff.length),"#6366F1"],
          ["Đang làm hôm nay",String(staff.filter(s=>s.status==="active").length),"#22C55E"],
          ["Ca trống cần bổ sung",String(Math.max(0,3-staff.filter(s=>s.status==="active").length)),"#F59E0B"],
        ].map(([label,value,color])=>(
          <div key={label} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:"14px 16px"}}>
            <p style={{fontSize:10,color:T2,marginBottom:5}}>{label}</p>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:25,fontWeight:700,color}}>{value}</p>
          </div>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
        {([["all","Tất cả"],["active","Đang làm"],["off","Nghỉ / vắng"]] as const).map(([key,label])=>(
          <button key={key} onClick={()=>setShiftFilter(key)} style={{padding:"7px 11px",borderRadius:8,
            border:`1px solid ${shiftFilter===key?rm.color:BORDER}`,background:shiftFilter===key?rm.bg:INPUT,
            color:shiftFilter===key?rm.color:T2,fontSize:11,fontWeight:600,cursor:"pointer"}}>{label}</button>
        ))}
      </div>
      <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:13,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 100px",gap:10,padding:"11px 14px",background:INPUT,
          color:T2,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em"}}>
          <span>Nhân viên</span><span>Ca hôm nay</span><span>Phân công</span><span>Trạng thái</span>
        </div>
        {staff.filter(s=>shiftFilter==="all" || (shiftFilter==="active"?s.status==="active":s.status!=="active")).map((s,i)=>{
          const shiftLabel={morning:"Ca sáng · 06–14",afternoon:"Ca chiều · 14–22",night:"Ca đêm · 22–06"}[s.shift]||"Chưa xếp ca";
          const statusLabel=s.status==="active"?"Đang làm":s.status==="off"?"Nghỉ phép":"Chờ xác nhận";
          const statusColor=s.status==="active"?"#22C55E":s.status==="off"?"#9CA3AF":"#F59E0B";
          return <div key={s.id} style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 100px",gap:10,padding:"13px 14px",
            borderTop:i?`1px solid ${BORDER}`:"none",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}>
              <div style={{width:29,height:29,borderRadius:99,background:rm.gr,display:"grid",placeItems:"center",fontSize:10,fontWeight:700,color:"#080F1E"}}>{s.avatar}</div>
              <div style={{minWidth:0}}><p style={{fontSize:12,fontWeight:700,color:T1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.name}</p><p style={{fontSize:10,color:T2}}>{s.roleLabel}</p></div>
            </div>
            <span style={{fontSize:11,color:T1}}>{shiftLabel}</span>
            <span style={{fontSize:11,color:T2}}>{s.roleLabel.toLowerCase().includes("buồng")?"Tầng phòng":s.roleLabel.toLowerCase().includes("bếp")?"Bếp & minibar":"Vận hành chung"}</span>
            <span style={{fontSize:10,padding:"3px 7px",borderRadius:99,background:`${statusColor}15`,color:statusColor,fontWeight:600,textAlign:"center"}}>{statusLabel}</span>
          </div>;
        })}
      </div>
    </div>
  );

  /* ════════════════════════════════════════════
     APPROVALS PAGE
  ════════════════════════════════════════════ */
  const ApprovalsPage = (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T1}}>Phê duyệt đặc quyền</h2>
          <p style={{fontSize:11,color:T2,marginTop:2}}>Các thao tác nhạy cảm theo Điều 10 quy tắc nghiệp vụ</p>
        </div>
        <div style={{padding:"5px 12px",borderRadius:8,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)"}}>
          <span style={{fontSize:12,fontWeight:700,color:"#EF4444"}}>3 yêu cầu chờ</span>
        </div>
      </div>

      {/* Rule callout */}
      <div style={{display:"flex",gap:10,padding:"12px 16px",borderRadius:12,
        background:"rgba(184,148,74,0.06)",border:"1px solid rgba(184,148,74,0.2)"}}>
        <ShieldCheck size={15} style={{color:"#B8944A",flexShrink:0,marginTop:1}}/>
        <p style={{fontSize:11,color:"#B8944A",lineHeight:1.6}}>
          <strong>Quy tắc phê duyệt (Điều 10 & 11):</strong> Hoàn tiền cọc → <strong>Giám đốc</strong> duyệt. Cấu hình/giá kỹ thuật → <strong>Quản lý hoặc Giám đốc</strong> duyệt. Giá dịch vụ bếp → <strong>Quản lý</strong> duyệt. Người yêu cầu và người duyệt phải là hai người khác nhau.
        </p>
      </div>

      {approvalsList.length === 0 ? (
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:36,textAlign:"center"}}>
          <ShieldCheck size={36} style={{color:"#B8944A",margin:"0 auto 10px",opacity:0.7}}/>
          <p style={{fontSize:14,fontWeight:600,color:T1,marginBottom:4}}>Không có yêu cầu phê duyệt nào đang chờ</p>
          <p style={{fontSize:12,color:T2}}>Tất cả các đề xuất cấu hình, hoàn cọc và định giá dịch vụ đều đã được xử lý.</p>
        </div>
      ) : (
        approvalsList.map(req => {
          const reqId = `REQ-${req.id}`;
          const isUrgent = req.risk === "HIGH" || req.risk === "CRITICAL";
          const canApproveThis = req.action.includes("REFUND")
            ? perm.approvals.canApproveRefund
            : req.action.includes("CONFIG")
            ? perm.approvals.canApproveConfig
            : perm.approvals.canApproveServicePrice;
          const approverRole = req.action.includes("REFUND") ? "GIÁM ĐỐC" : "QUẢN LÝ / GIÁM ĐỐC";
          return (
            <div key={req.id} style={{background:CARD,border:`1px solid ${isUrgent?"rgba(239,68,68,0.3)":BORDER}`,
              borderRadius:14,padding:20,display:"flex",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
              <div style={{width:44,height:44,borderRadius:12,background:isUrgent?"rgba(239,68,68,0.08)":INPUT,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                🛡️
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6,flexWrap:"wrap"}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,padding:"1px 7px",borderRadius:5,
                    background:rm.bg,color:rm.color}}>{reqId}</span>
                  <span style={{fontSize:11,padding:"2px 9px",borderRadius:99,fontWeight:600,
                    background:"rgba(239,68,68,0.1)",color:"#EF4444"}}>{req.action}</span>
                  <span style={{fontSize:9,padding:"2px 7px",borderRadius:6,fontWeight:600,
                    background:"rgba(99,102,241,0.1)",color:"#6366F1"}}>
                    Người duyệt: {approverRole}
                  </span>
                  {isUrgent && <span style={{fontSize:9,padding:"2px 7px",borderRadius:99,fontWeight:700,
                    background:"rgba(239,68,68,0.12)",color:"#EF4444"}}>⚡ Khẩn</span>}
                </div>
                <p style={{fontSize:13,fontWeight:600,color:T1,marginBottom:2}}>
                  Mục tiêu: {req.target_id || "Hệ thống"}
                </p>
                <p style={{fontSize:11,color:T2,marginBottom:2}}>Người yêu cầu: {req.requester}</p>
                <p style={{fontSize:11,color:T2,marginBottom:8}}>Lý do: {req.reason}</p>
                {req.amount && req.amount > 0 ? (
                  <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:"#EF4444"}}>
                    Số tiền: {fmtFull(req.amount)}
                  </p>
                ) : null}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:7,flexShrink:0,minWidth:130}}>
                {canApproveThis ? (
                  <>
                    <button
                      onClick={async () => {
                        try {
                          await hrGovernanceApi.approve(req.id);
                          setApprovalsList(prev => prev.filter(x => x.id !== req.id));
                        } catch (e) {
                          alert(apiErrorMessage(e, "Không thể phê duyệt yêu cầu. Vui lòng thử lại."));
                        }
                      }}
                      style={{padding:"8px 18px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",
                        background:"linear-gradient(135deg,#22C55E,#16A34A)",color:"#FFF",
                        display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>
                      <ThumbsUp size={12}/> Phê duyệt
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await hrGovernanceApi.reject(req.id);
                          setApprovalsList(prev => prev.filter(x => x.id !== req.id));
                        } catch (e) {
                          alert(apiErrorMessage(e, "Không thể từ chối yêu cầu. Vui lòng thử lại."));
                        }
                      }}
                      style={{padding:"8px 18px",borderRadius:9,fontSize:12,fontWeight:600,cursor:"pointer",
                        background:"rgba(239,68,68,0.08)",color:"#EF4444",border:"1px solid rgba(239,68,68,0.2)",
                        display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>
                      <ThumbsDown size={12}/> Từ chối
                    </button>
                  </>
                ) : (
                  <div style={{padding:"8px 12px",borderRadius:9,background:INPUT,border:`1px solid ${BORDER}`,
                    display:"flex",alignItems:"center",gap:6}}>
                    <Lock size={12} style={{color:"#EF4444"}}/>
                    <span style={{fontSize:10,color:T2,lineHeight:1.4}}>
                      Chỉ <strong style={{color:rm.color}}>{approverRole}</strong> mới phê duyệt được
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  /* ════════════════════════════════════════════
     STAFF PAGE
  ════════════════════════════════════════════ */
  const StaffPage = (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T1}}>Nhân sự & Phân ca</h2>
          <p style={{fontSize:11,color:T2,marginTop:2}}>{new Date().toLocaleDateString("vi-VN")} · {staff.length} nhân viên</p>
        </div>
        <button style={{display:"flex",alignItems:"center",gap:6,padding:"7px 13px",borderRadius:9,
          background:rm.gr,color:"#080F1E",fontSize:12,fontWeight:700,cursor:"pointer"}}>
          <Plus size={12}/> Thêm nhân viên
        </button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:10}}>
        {staff.map(s=>{
          const sc={morning:"#F97316",afternoon:"#6366F1",night:"#8B5CF6"}[s.shift]||rm.color;
          const sl={morning:"Ca sáng 06–14",afternoon:"Ca chiều 14–22",night:"Ca đêm 22–06"}[s.shift]||"";
          const stc=s.status==="active"?"#22C55E":s.status==="off"?"#9CA3AF":"#F59E0B";
          return (
            <div key={s.id} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:16,
              display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:42,height:42,borderRadius:99,background:rm.gr,flexShrink:0,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#080F1E",
                boxShadow:`0 0 0 3px ${rm.color}18`}}>
                {s.avatar}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
                  <p style={{fontSize:13,fontWeight:700,color:T1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</p>
                  <span style={{width:6,height:6,borderRadius:99,background:stc,flexShrink:0}}/>
                </div>
                <p style={{fontSize:10,color:T2,marginBottom:4}}>{s.roleLabel} · {s.id}</p>
                <span style={{fontSize:9,padding:"2px 7px",borderRadius:99,fontWeight:600,
                  background:`${sc}12`,color:sc}}>{sl}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const AuditPage = (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T1}}>Nhật ký hệ thống</h2>
        <p style={{fontSize:11,color:T2,marginTop:2}}>Chỉ Giám đốc và Quản trị hệ thống được xem dữ liệu truy vết nội bộ.</p>
      </div>
      <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:13,overflow:"hidden"}}>
        {auditLogs.length === 0 ? (
          <div style={{padding:28,textAlign:"center",color:T2,fontSize:12}}>
            Chưa có nhật ký kiểm toán nào được ghi nhận từ hệ thống.
          </div>
        ) : (
          auditLogs.map((log, i) => {
            const time = new Date(log.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
            const detail = log.reason || `${log.entity_type} #${log.entity_id}`;
            return (
              <div key={log.id} style={{display:"grid",gridTemplateColumns:"70px 220px 190px 1fr",gap:12,
                padding:"13px 16px",borderBottom:i<auditLogs.length-1?`1px solid ${BORDER}`:"none",alignItems:"center"}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T2}}>{time}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:700,color:rm.color}}>{log.action}</span>
                <span style={{fontSize:11,color:T1}}>{log.actor}</span>
                <span style={{fontSize:11,color:T2}}>{detail}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  /* ════════════════════════════════════════════
     ROOM DRAWER
  ════════════════════════════════════════════ */
  const RoomDrawer = selRoom && (
    <>
      <div style={{position:"fixed",inset:0,zIndex:30,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(3px)"}}
        onClick={()=>setSelRoom(null)}/>
      <div style={{position:"fixed",right:0,top:0,bottom:0,zIndex:40,width:370,background:CARD,
        borderLeft:`1px solid ${BORDER}`,boxShadow:"-8px 0 32px rgba(0,0,0,0.18)",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"start",justifyContent:"space-between"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:T1}}>Phòng {selRoom.number}</span>
              <span style={{fontSize:10,padding:"2px 9px",borderRadius:99,fontWeight:600,
                background:RS[selRoom.status].bg,color:RS[selRoom.status].color}}>
                {RS[selRoom.status].label}
              </span>
            </div>
            <p style={{fontSize:11,color:T2,marginTop:2}}>{roomTypeLabel(selRoom.type)} · Tầng {selRoom.floor}</p>
          </div>
          <button onClick={()=>setSelRoom(null)} style={{width:30,height:30,borderRadius:7,background:INPUT,
            display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:T2}}>
            <X size={13}/>
          </button>
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          <img src={selRoom.image} alt={selRoom.type} style={{width:"100%",height:150,objectFit:"cover",background:"#E8E4DC"}}/>
          <div style={{padding:18,display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[["Giường",roomBedLabel(selRoom.beds)],["Hướng",selRoom.view],["Diện tích",`${selRoom.area}m²`],["Giá/đêm",fmtVND(selRoom.pricePerNight)]].map(([l,v])=>(
                <div key={l} style={{background:INPUT,borderRadius:9,padding:"9px 11px"}}>
                  <p style={{fontSize:9,color:T2}}>{l}</p>
                  <p style={{fontSize:12,fontWeight:600,color:T1,marginTop:2}}>{v}</p>
                </div>
              ))}
            </div>
            {selRoom.guestName && (
              <div style={{background:"rgba(99,102,241,0.05)",border:"1px solid rgba(99,102,241,0.15)",borderRadius:10,padding:13}}>
                <p style={{fontSize:9,fontWeight:700,letterSpacing:"0.06em",color:"#6366F1",textTransform:"uppercase",marginBottom:5}}>Khách hiện tại</p>
                <p style={{fontSize:13,fontWeight:700,color:T1}}>{selRoom.guestName}</p>
                {selRoom.checkIn && <p style={{fontSize:10,color:T2,marginTop:2}}>{selRoom.checkIn} → {selRoom.checkOut}</p>}
              </div>
            )}
            {/* Permission actions section */}
            <div>
              <p style={{fontSize:9,fontWeight:700,letterSpacing:"0.06em",color:T2,textTransform:"uppercase",marginBottom:8}}>Thao tác theo quyền của bạn</p>
              <div style={{background:INPUT,borderRadius:10,padding:10}}>
                <PermBadge ok={perm.room.canCheckIn}        label="Nhận phòng cho khách"/>
                <PermBadge ok={perm.room.canCheckOut}       label="Trả phòng cho khách"/>
                <PermBadge ok={perm.room.canMarkCleaning}   label="Cập nhật đang dọn"/>
                <PermBadge ok={perm.room.canReportCleanDone}label="Báo hoàn thành dọn"/>
                <PermBadge ok={perm.room.canMarkAvailable}  label="Xác nhận phòng trống"/>
                <PermBadge ok={perm.room.canPutMaintenance} label="Đưa vào bảo trì"/>
                <PermBadge ok={perm.room.canEndMaintenance} label="Báo hoàn thành bảo trì"/>
              </div>
            </div>
            <div>
              <p style={{fontSize:9,fontWeight:700,letterSpacing:"0.06em",color:T2,textTransform:"uppercase",marginBottom:6}}>Tiện nghi</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {selRoom.amenities.map(a=>(
                   <span key={a} style={{fontSize:10,padding:"3px 9px",borderRadius:7,background:INPUT,color:T2,border:`1px solid ${BORDER}`}}>{roomAmenityLabel(a)}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Role-specific action buttons */}
        <div style={{padding:14,borderTop:`1px solid ${BORDER}`,display:"flex",flexDirection:"column",gap:7}}>
          {/* CHECK-IN */}
          {selRoom.status==="available" && (
            perm.room.canCheckIn ? (
              <button style={{width:"100%",padding:"10px",borderRadius:11,background:rm.gr,color:"#080F1E",
                fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                <LogIn size={13}/> Nhận phòng cho khách
              </button>
            ) : (
              <LockedAction reason={lockReason(role,"checkIn")}>
                <div style={{width:"100%",padding:"10px",borderRadius:11,background:INPUT,
                  fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6,color:T2}}>
                  <LogIn size={13}/> Nhận phòng cho khách
                </div>
              </LockedAction>
            )
          )}

          {/* CHECKOUT */}
          {selRoom.status==="occupied" && (
            perm.room.canCheckOut ? (
              <button style={{width:"100%",padding:"10px",borderRadius:11,background:INPUT,color:T1,
                border:`1px solid ${BORDER}`,fontSize:12,fontWeight:600,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                <FileText size={13}/> Xử lý trả phòng
              </button>
            ) : (
              <LockedAction reason={lockReason(role,"checkOut")}>
                <div style={{width:"100%",padding:"10px",borderRadius:11,background:INPUT,
                  fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6,color:T2}}>
                  <FileText size={13}/> Xử lý trả phòng
                </div>
              </LockedAction>
            )
          )}

          {/* MARK CLEANING */}
          {selRoom.status==="available" && perm.room.canMarkCleaning && (
            <button onClick={()=>updateRoom(selRoom.id,{status:"housekeeping"})}
              style={{width:"100%",padding:"10px",borderRadius:11,background:"rgba(245,158,11,0.08)",
                color:"#F59E0B",border:"1px solid rgba(245,158,11,0.2)",fontSize:12,fontWeight:600,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <Sparkles size={13}/> Đánh dấu đang dọn
            </button>
          )}

          {/* REPORT CLEAN DONE */}
          {selRoom.status==="housekeeping" && perm.room.canReportCleanDone && (
            <button style={{width:"100%",padding:"10px",borderRadius:11,background:"rgba(245,158,11,0.08)",
              color:"#F59E0B",border:"1px solid rgba(245,158,11,0.2)",fontSize:12,fontWeight:700,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <Send size={13}/> Báo hoàn thành dọn → Chờ quản lý
            </button>
          )}

          {/* MARK AVAILABLE (MANAGER only after inspection) */}
          {selRoom.status==="housekeeping" && perm.room.canMarkAvailable && (
            <button onClick={()=>updateRoom(selRoom.id,{status:"available",cleanStatus:"clean"})}
              style={{width:"100%",padding:"10px",borderRadius:11,background:"rgba(34,197,94,0.1)",
                color:"#22C55E",border:"1px solid rgba(34,197,94,0.25)",fontSize:12,fontWeight:700,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <CheckSquare size={13}/> Nghiệm thu → Mở khóa phòng
            </button>
          )}

          {/* PUT MAINTENANCE */}
          {selRoom.status==="available" && perm.room.canPutMaintenance && (
            <button onClick={()=>updateRoom(selRoom.id,{status:"maintenance"})}
              style={{width:"100%",padding:"10px",borderRadius:11,background:"rgba(239,68,68,0.08)",
                color:"#EF4444",border:"1px solid rgba(239,68,68,0.2)",fontSize:12,fontWeight:700,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <Hammer size={13}/> Đưa vào bảo trì
            </button>
          )}

          {/* END MAINTENANCE */}
          {selRoom.status==="maintenance" && perm.room.canEndMaintenance && !perm.room.canMarkAvailable && (
            <button style={{width:"100%",padding:"10px",borderRadius:11,background:"rgba(249,115,22,0.08)",
              color:"#F97316",border:"1px solid rgba(249,115,22,0.2)",fontSize:12,fontWeight:700,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <Send size={13}/> Báo xong bảo trì → Chờ quản lý nghiệm thu
            </button>
          )}

          {selRoom.status==="maintenance" && perm.room.canMarkAvailable && (
            <button onClick={()=>updateRoom(selRoom.id,{status:"available"})}
              style={{width:"100%",padding:"10px",borderRadius:11,background:"rgba(34,197,94,0.1)",
                color:"#22C55E",border:"1px solid rgba(34,197,94,0.25)",fontSize:12,fontWeight:700,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <CheckSquare size={13}/> Nghiệm thu xong → Mở phòng
            </button>
          )}

          {/* BOOK ROOM */}
          {selRoom.status==="available" && perm.room.canBook && (
            <button style={{width:"100%",padding:"10px",borderRadius:11,background:INPUT,color:T1,
              border:`1px solid ${BORDER}`,fontSize:12,fontWeight:600,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <CalendarDays size={13}/> Đặt phòng
            </button>
          )}
        </div>
      </div>
    </>
  );

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:BG,fontFamily:"'Inter',system-ui,sans-serif"}}>
      {Sidebar}
      <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
        {Navbar}
        <main style={{flex:1,overflowY:"auto",padding:20}}>
          <div style={{maxWidth:1280,margin:"0 auto"}}>
            {page==="dashboard"  && DashboardPage}
            {page==="rooms"      && RoomMatrixPage}
            {page==="arrivals"   && DashboardPage}
            {page==="tasks"      && HousekeepingPage}
            {page==="incidents"  && IncidentsPage}
            {page==="equipment"  && EquipmentPage}
            {page==="finance"    && FinancePage}
            {page==="shift"      && (role==="hr" ? HRShiftPage : ShiftPage)}
            {page==="debt"       && FinancePage}
            {page==="approvals"  && ApprovalsPage}
            {page==="staff"      && StaffPage}
            {page==="reports"    && DashboardPage}
            {page==="audit"      && AuditPage}
            {page==="settings"   && (
              <div>
                <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T1,marginBottom:18}}>Cài đặt</h2>
                <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:13,overflow:"hidden",maxWidth:480}}>
                  {[["Ngôn ngữ","Tiếng Việt"],["Múi giờ","Asia/Ho_Chi_Minh (GMT+7)"],["Tiền tệ","VND – ₫"],["Giờ nhận phòng","14:00"],["Giờ trả phòng","12:00"],["Phiên bản","Hotel OS v2.0.0"]].map(([l,v],i,arr)=>(
                    <div key={l} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                      padding:"13px 18px",borderBottom:i<arr.length-1?`1px solid ${BORDER}`:"none"}}>
                      <span style={{fontSize:12,color:T2}}>{l}</span>
                      <span style={{fontSize:12,fontWeight:600,color:T1}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{height:20}}/>
        </main>
      </div>
      {RoomDrawer}
      {PermPanel}
    </div>
  );
}
