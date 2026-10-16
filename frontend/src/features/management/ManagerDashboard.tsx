import { useEffect, useState, useMemo, createContext, useContext } from "react";
import { hrGovernanceApi } from "../../shared/api/hrGovernance";
import { enterpriseApi } from "../../shared/api/enterprise";
import { housekeepingTechnicalApi } from "../../shared/api/housekeepingTechnical";
import { frontDeskApi } from "../../shared/api/frontDesk";
import { kitchenAccountingApi } from "../../shared/api/kitchenAccounting";
import { authApi } from "../../shared/api/auth";
import { apiErrorMessage } from "../../shared/api/client";
import { EmployeeProfileDropdown } from "../../shared/components/EmployeeProfileDropdown";
import type { Approval as ApiApproval, EmployeeAdmin } from "../../shared/types/hrGovernance";
import type { LeaveRequest } from "../../shared/types/enterprise";
import type { EquipmentIncident, HousekeepingTask, Room as ApiRoom, TechnicalWorkOrder } from "../../shared/types/housekeepingTechnical";
import type { Invoice as ApiInvoice } from "../../shared/types/frontDesk";
import type { Expense, Approval as KitchenApproval } from "../../shared/types/kitchenAccounting";
import { useManagementFinance, type ManagementFinance } from "./managementFinance";
import { EmployeeProvisionModal } from "./EmployeeProvisionModal";
import { invoiceTotal } from "../accounting/accountingLogic";
import { localDateValue } from "../../shared/utils/localDate";
import "./management.css";
import { formatVnd } from "../../shared/utils/money";
import { employeeRoleLabel } from "../../shared/types/api";
import {
  Home, Zap, LayoutGrid, Users, AlertTriangle, BarChart2,
  Search, Bell, ChevronDown, ArrowRight, Sun, CalendarDays,
  Check, X, TrendingUp, ArrowUpRight, LogOut,
  ConciergeBell, Sparkles, UtensilsCrossed, Wrench,
} from "lucide-react";



import type { Service } from "../../shared/types/kitchenAccounting";

// Only price-review cards consume this data; other approval workflows keep their props.
export const ServicePriceReviewContext = createContext<{
  services: Service[];
  employees: EmployeeAdmin[];
  managerId?: string;
}>({services:[],employees:[]});

export const useServicePriceReview = () => useContext(ServicePriceReviewContext);

/* ══════════════════════════════════════════════════════════
   TYPES & DATA
══════════════════════════════════════════════════════════ */
type NavPage = "overview" | "approvals" | "operations" | "staff" | "incidents" | "reports" | "notifications";
type ApprovalStatus = "pending" | "approved" | "rejected";
type ManagerRole = "manager" | "director";

interface Approval {
  id: string; dept: string; deptColor: string; emoji: string;
  title: string; detail: string[]; time: string; badge: string; badgeColor: string;
  kind: "service-price" | "refund" | "technical-release" | "expense" | "leave" | "incident";
  approvalBlockedReason?: string;
  rawWorkOrderId?: number;
  rawApproval?: ApiApproval;
}

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
const fmtVND = formatVnd;
const incidentStatusLabel = (status: EquipmentIncident["handoff_status"]) => ({OPEN:"Chờ tiếp nhận",ACKNOWLEDGED:"Đang xử lý",RESOLVED:"Đã xử lý"}[status]);
const approvalActionLabels: Record<string, string> = {SERVICE_CATALOG_CREATE:"Thêm danh mục dịch vụ / kho",SERVICE_PRICE_CHANGE:"Thay đổi giá dịch vụ",PAYMENT_REFUND:"Hoàn tiền",BILLING_ADJUSTMENT:"Điều chỉnh hóa đơn",ROOM_TYPE_ACTIVATE:"Phê duyệt loại phòng"};
const approvalActionLabel = (action: string) => approvalActionLabels[action] ?? action;
const roomTypeLabel = (type: string) => ({
  Standard:"Tiêu chuẩn", Deluxe:"Cao cấp", Suite:"Suite", "VIP Suite":"Suite VIP",
}[type] ?? type);

/* ══════════════════════════════════════════════════════════
   SIDEBAR NAV
══════════════════════════════════════════════════════════ */
const SIDE_NAV: { id:NavPage; label:string; Icon:React.ElementType; badge?:number }[] = [
  { id:"overview",   label:"Tổng quan",           Icon:Home },
  { id:"approvals",  label:"Trung tâm Phê duyệt", Icon:Zap,        badge:4 },
  { id:"operations", label:"Vận hành & Phòng",    Icon:LayoutGrid },
  { id:"staff",      label:"Nhân sự & Phân ca",   Icon:Users },
  { id:"incidents",  label:"Sự cố & Khẩn cấp",   Icon:AlertTriangle },
  { id:"reports",    label:"Báo cáo điều hành",   Icon:BarChart2 },
];

/* ══════════════════════════════════════════════════════════
   OVERVIEW SCREEN
══════════════════════════════════════════════════════════ */
const approvalsForRole = (role: ManagerRole, source: Approval[] = []) =>
  source.filter(item => role === "director" || item.kind !== "refund");

type ApprovalDecision = Exclude<ApprovalStatus, "pending">;

function OverviewScreen({
  onNavApprovals,
  onNavOperations,
  onNavNotifications,
  finance,
  role,
  approvalsData = [],
  rooms = [],
  invoices = [],
  incidents = [],
  techOrders = [],
  onDecision
}: {
  onNavApprovals: () => void;
  onNavOperations: () => void;
  onNavNotifications: () => void;
  finance: ManagementFinance;
  role: ManagerRole;
  approvalsData?: Approval[];
  rooms?: ApiRoom[];
  invoices?: ApiInvoice[];
  incidents?: EquipmentIncident[];
  techOrders?: TechnicalWorkOrder[];
  onDecision?: (id: string, action: ApprovalDecision) => Promise<boolean>;
}) {
  const {services:priceCatalog,employees:priceEmployees} = useServicePriceReview();
  const [approvals, setApprovals] = useState<Record<string,ApprovalStatus>>({});
  const visibleApprovals = approvalsForRole(role, approvalsData);
  const occupiedRooms = rooms.filter(room => room.status === "occupied").length;
  const occupancy = rooms.length ? Math.round((occupiedRooms / rooms.length) * 100) : 0;
  const paidInvoices = invoices.filter(invoice => invoice.status === "DA_THANH_TOAN" && invoice.issued_at.startsWith(finance.today));
  const revenue = finance.daily?.recognized_revenue;
  const averageInvoice = paidInvoices.length ? Math.round(paidInvoices.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0) / paidInvoices.length) : 0;
  const barData = finance.days;
  const maxRev = Math.max(...barData.map(item => Math.abs(item.rev)), 1);
  const liveNotifications = [
    ...incidents.filter(item => item.handoff_status !== "RESOLVED").map(item => ({ id: `incident-${item.id}`, icon: "🔴", msg: `Phòng ${item.room_id}: ${item.equipment_name}`, time: incidentStatusLabel(item.handoff_status) })),
    ...visibleApprovals.map(item => ({ id: `approval-${item.id}`, icon: "🔧", msg: item.title, time: item.badge })),
  ];

  const handle = async (id: string, action: ApprovalDecision) => {
    if (onDecision && !(await onDecision(id, action))) return;
    setApprovals(p => ({ ...p, [id]: action }));
  };

  const pendingCount = visibleApprovals.filter(a => approvals[a.id] !== "approved" && approvals[a.id] !== "rejected").length;

  return (
    <div style={{ flex:1,overflowY:"auto",padding:"20px 24px" }}>

      {/* KPI CARDS */}
      <div className="management-kpis" style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20 }}>
        {[
          { label:"Công suất phòng hiện tại", val:`${occupancy}%`, sub:`${occupiedRooms} / ${rooms.length} phòng có khách`, note:"Không gồm phòng giữ chỗ", color:"#3B82F6", prog:occupancy },
          { label:"Thu/hoàn ròng hôm nay", val:finance.daily ? fmtVND(finance.daily.net_total) : "—", sub:null, note:"Theo giao dịch hoàn tất", color:"#10B981", prog:null },
          { label:"Giá trị hóa đơn bình quân hôm nay", val:fmtVND(averageInvoice), sub:`${paidInvoices.length} hóa đơn đã thanh toán`, note:"Theo ngày lập hóa đơn, sau giảm giá", color:"#8B5CF6", prog:null },
          { label:"Doanh thu đã ghi nhận hôm nay", val:revenue == null ? "—" : fmtVND(revenue), sub:null, note:"Theo bút toán đã chốt", color:"#F59E0B", prog:null },
        ].map(k => (
          <div key={k.label} style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",
            padding:"16px 18px",boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
            <p style={{ fontSize:11,color:"#64748B",marginBottom:6,lineHeight:1.4 }}>{k.label}</p>
            <p style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:k.val.length>10?18:22,fontWeight:800,
              color:"#0F172A",lineHeight:1,marginBottom:k.sub?4:6 }}>{k.val}</p>
            {k.sub && <p style={{ fontSize:11,color:"#64748B",marginBottom:6 }}>{k.sub}</p>}
            {k.prog !== null && (
              <div style={{ height:5,background:"#E2E8F0",borderRadius:99,overflow:"hidden",marginBottom:6 }}>
                <div style={{ height:"100%",width:`${k.prog}%`,borderRadius:99,background:k.color }} />
              </div>
            )}
            <div style={{ display:"flex",alignItems:"center",gap:3 }}>
              <span style={{ fontSize:11,fontWeight:600,color:"#16A34A" }}>{k.note}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Middle row */}
      <div className="management-pair" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16 }}>

        {/* APPROVAL HUB */}
        <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden" }}>
          <div style={{ padding:"14px 18px",borderBottom:"1px solid #F1F5F9",
            display:"flex",alignItems:"center",gap:8 }}>
            <p style={{ fontSize:14,fontWeight:700,color:"#0F172A" }}>Trung tâm phê duyệt</p>
            <span style={{ fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:99,
              background:"#FEF9C3",color:"#92400E" }}>{pendingCount} việc cần duyệt</span>
            <div style={{ flex:1 }} />
            <button onClick={onNavApprovals}
              style={{ fontSize:11,fontWeight:600,color:"#2563EB",cursor:"pointer",
                display:"flex",alignItems:"center",gap:3 }}>
              Xem tất cả <ArrowRight size={12} />
            </button>
          </div>
          <div style={{ padding:"8px 0" }}>
            {visibleApprovals.length === 0 ? (
              <div style={{ padding:"24px 18px", textAlign:"center", color:"#94A3B8", fontSize:12 }}>
                Hiện không có yêu cầu phê duyệt nào đang chờ xử lý từ các bộ phận.
              </div>
            ) : (
              visibleApprovals.slice(0,3).map(a => {
                const st = approvals[a.id];
                return (
                  <div key={a.id} style={{ padding:"10px 18px",borderBottom:"1px solid #F8FAFC",
                    display:"flex",gap:12,alignItems:"flex-start",
                    opacity:st==="approved"||st==="rejected"?0.5:1,
                    transition:"opacity .2s" }}>
                    {/* Icon */}
                    <div style={{ width:36,height:36,borderRadius:10,flexShrink:0,fontSize:18,
                      background:a.deptColor+"18",display:"flex",alignItems:"center",justifyContent:"center" }}>
                      {a.emoji}
                    </div>
                    {/* Info */}
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:3 }}>
                        <span style={{ fontSize:11,color:"#64748B" }}>{a.dept}</span>
                        <span style={{ fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:99,
                          background:a.badgeColor+"18",color:a.badgeColor }}>{a.badge}</span>
                        <span style={{ fontSize:10,color:"#94A3B8",marginLeft:"auto",whiteSpace:"nowrap" }}>{a.time}</span>
                      </div>
                      <p style={{ fontSize:12,fontWeight:700,color:"#0F172A",marginBottom:3 }}>{a.title}</p>
                      {(a.kind === "service-price" && a.rawApproval ? priceReviewDetails(a.rawApproval, priceCatalog, priceEmployees) : a.detail).map((d,i) => (
                        <p key={i} style={{ fontSize:11,color:"#64748B",lineHeight:1.4 }}>{d}</p>
                      ))}
                    </div>
                    {/* Actions */}
                    {a.approvalBlockedReason && !st ? (
                      <p role="note" style={{ maxWidth:150,flexShrink:0,fontSize:10,lineHeight:1.4,textAlign:"right",color:"#B45309" }}>
                        {a.approvalBlockedReason}
                      </p>
                    ) : !st ? (
                      <div style={{ display:"flex",flexDirection:"column",gap:5,flexShrink:0 }}>
                        <button onClick={() => handle(a.id,"approved")}
                          style={{ display:"flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:7,
                            border:"none",background:"#16A34A",color:"#FFF",fontSize:11,fontWeight:700,cursor:"pointer" }}>
                          <Check size={11} /> Phê duyệt
                        </button>
                        {a.kind !== "technical-release" && a.kind !== "incident" && <button onClick={() => handle(a.id,"rejected")}
                          style={{ display:"flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:7,
                            border:"1px solid #E2E8F0",background:"#FFF",color:"#64748B",fontSize:11,fontWeight:600,cursor:"pointer" }}>
                          <X size={11} /> Từ chối
                        </button>}
                      </div>
                    ) : (
                      <span style={{ fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:99,flexShrink:0,
                        background:st==="approved"?"#DCFCE7":"#FFE4E6",
                        color:st==="approved"?"#166534":"#BE123C" }}>
                        {st==="approved"?"✓ Đã duyệt":"✗ Từ chối"}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* DEPARTMENT STATUS */}
        <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden" }}>
          <div style={{ padding:"14px 18px",borderBottom:"1px solid #F1F5F9",
            display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <p style={{ fontSize:14,fontWeight:700,color:"#0F172A" }}>Tình hình vận hành các bộ phận</p>
            <button onClick={onNavOperations} style={{ fontSize:11,fontWeight:600,color:"#2563EB",cursor:"pointer",
              display:"flex",alignItems:"center",gap:3 }}>Xem chi tiết <ArrowRight size={12} /></button>
          </div>
          <div style={{ padding:"12px 18px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            {(() => {
              const unpaidCount = invoices.filter(inv => inv.status !== "DA_THANH_TOAN").length;
              const readyRooms = rooms.filter(r => r.status === "available").length;
              const cleaningRooms = rooms.filter(r => r.status === "cleaning").length;
              const maintRooms = rooms.filter(r => r.status === "maintenance").length;
              const techWaiting = techOrders.filter(o => o.status === "WAITING_ACCEPTANCE").length;
              const techActive = techOrders.filter(o => o.status !== "ROOM_RELEASED" && o.status !== "COMPLETED").length;
              const hasIncidents = incidents.some(i => i.handoff_status !== "RESOLVED");

              return [
                {
                  emoji:"🏨",label:"Lễ tân",Icon:ConciergeBell,
                  status: unpaidCount > 0 ? `${unpaidCount} hóa đơn chưa thu` : "Hoạt động ổn định",
                  statusOk: unpaidCount === 0,
                  stats:[
                    { val:`${occupiedRooms}/${rooms.length}`,label:"Phòng có khách lưu trú" },
                    { val:String(unpaidCount),label:"Hóa đơn chưa thanh toán",danger:unpaidCount>0 },
                  ],
                },
                {
                  emoji:"🧹",label:"Buồng phòng",Icon:Sparkles,
                  status:"Đang triển khai theo phòng",statusOk:true,
                  stats:[
                    { val:String(readyRooms),label:"Phòng sạch sẵn sàng" },
                    { val:String(cleaningRooms),label:"Phòng đang dọn" },
                    { val:String(maintRooms),label:"Phòng bảo trì",danger:maintRooms>0 },
                  ],
                },
                {
                  emoji:"🍳",label:"Bếp / Minibar",Icon:UtensilsCrossed,
                  status:"Theo dõi đề xuất giá",statusOk:!visibleApprovals.some(item => item.kind === "service-price"),
                  stats:[
                    { val:"Theo dõi",label:"Kho đồ uống & Thực phẩm" },
                    { val:String(visibleApprovals.filter(item => item.kind === "service-price").length),label:"Đề xuất giá chờ duyệt" },
                  ],
                },
                {
                  emoji:"🔧",label:"Kỹ thuật",Icon:Wrench,
                  status: (techWaiting > 0 || hasIncidents) ? `${techWaiting} phiếu chờ nghiệm thu` : "Vận hành ổn định",
                  statusOk: techWaiting === 0 && !hasIncidents,
                  stats:[
                    { val:String(techWaiting),label:"Phiếu chờ nghiệm thu",danger:techWaiting>0 },
                    { val:String(techActive),label:"Phiếu đang xử lý" },
                  ],
                },
              ];
            })().map(dept => (
              <div key={dept.label} style={{ borderRadius:10,border:"1px solid #E2E8F0",padding:"12px 14px",
                background:dept.statusOk?"#FAFAFA":"#FFF7F7" }}>
                <div style={{ display:"flex",alignItems:"center",gap:7,marginBottom:8 }}>
                  <span style={{ fontSize:18 }}>{dept.emoji}</span>
                  <div>
                    <p style={{ fontSize:11,fontWeight:700,color:"#0F172A",lineHeight:1.2 }}>{dept.label}</p>
                    <div style={{ display:"flex",alignItems:"center",gap:4,marginTop:2 }}>
                      <span style={{ width:6,height:6,borderRadius:99,flexShrink:0,
                        background:dept.statusOk?"#16A34A":"#DC2626" }} />
                      <span style={{ fontSize:10,color:dept.statusOk?"#16A34A":"#DC2626",fontWeight:600 }}>{dept.status}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
                  {dept.stats.map((s,i) => (
                    <div key={i}>
                      <p style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:800,
                        color:(s as {danger?:boolean}).danger?"#DC2626":"#0F172A",lineHeight:1 }}>{s.val}</p>
                      <p style={{ fontSize:10,color:"#94A3B8",lineHeight:1.3,marginTop:2 }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="management-bottom" style={{ display:"grid",gridTemplateColumns:"1fr 240px 240px",gap:16 }}>

        <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",padding:18 }}>
          <p style={{fontSize:14,fontWeight:700,marginBottom:16}}>Doanh thu đã ghi nhận 7 ngày qua</p>
          {finance.error ? <p role="alert" style={{color:"#B91C1C",fontSize:13}}>{finance.error} <button onClick={finance.reload}>Tải lại</button></p> : !finance.daily ? <p role="status">Đang tải số liệu…</p> : <div style={{display:"flex",gap:8,height:180,alignItems:"flex-end"}}>
            {barData.map(day => <div key={day.date} style={{flex:1,minWidth:0,textAlign:"center"}} title={`${day.date}: ${fmtVND(day.rev)}`}>
              <span style={{fontSize:10,color:"#475569",display:"block",marginBottom:4}}>{fmtVND(day.rev)}</span>
              <div style={{height:Math.max(2,Math.abs(day.rev)/maxRev*125),background:day.rev<0?"#EF4444":day.today?"#2563EB":"#BFDBFE",borderRadius:4}} />
              <span style={{display:"block",fontSize:11,color:"#64748B",marginTop:8}}>{day.day}</span>
            </div>)}
          </div>}
          <p style={{fontSize:11,color:"#64748B",marginTop:12}}>Bút toán đã chốt; khoản điều chỉnh giảm hiển thị màu đỏ.</p>
        </div>
        <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",padding:16 }}>
          <p style={{fontSize:13,fontWeight:700,marginBottom:14}}>Thu và hoàn hôm nay</p>
          <p style={{fontSize:12,color:"#64748B"}}>Tổng thu</p><p style={{fontSize:18,fontWeight:700,marginBottom:14}}>{finance.daily ? fmtVND(finance.daily.total_payments) : "—"}</p>
          <p style={{fontSize:12,color:"#64748B"}}>Tổng hoàn</p><p style={{fontSize:18,fontWeight:700}}>{finance.daily ? fmtVND(finance.daily.total_refunds) : "—"}</p>
          <p style={{fontSize:11,color:"#64748B",marginTop:14}}>Theo thời điểm giao dịch, độc lập với ngày lập hóa đơn.</p>
        </div>
        {/* NOTIFICATIONS */}
        <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden" }}>
          <div style={{ padding:"12px 14px",borderBottom:"1px solid #F1F5F9",
            display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <p style={{ fontSize:12,fontWeight:700,color:"#0F172A" }}>Thông báo &amp; Cảnh báo</p>
            <button onClick={onNavNotifications} style={{ fontSize:10,fontWeight:600,color:"#2563EB",cursor:"pointer",
              display:"flex",alignItems:"center",gap:2 }}>Xem tất cả <ArrowRight size={10} /></button>
          </div>
          <div>
            {liveNotifications.slice(0,5).map((n,i) => (
              <div key={n.id} style={{ padding:"10px 14px",borderBottom:i<liveNotifications.length-1?"1px solid #F8FAFC":"none",
                display:"flex",alignItems:"flex-start",gap:8 }}>
                <span style={{ fontSize:16,flexShrink:0 }}>{n.icon}</span>
                <div style={{ flex:1,minWidth:0 }}>
                  <p style={{ fontSize:11,color:"#0F172A",lineHeight:1.4,marginBottom:2 }}>{n.msg}</p>
                  <p style={{ fontSize:10,color:"#94A3B8" }}>{n.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   APPROVALS SCREEN (full)
══════════════════════════════════════════════════════════ */
function ApprovalsScreen({
  role,
  approvalsData = [],
  onDecision,
  approvedPriceProposals = [],
  activatingPriceId = null,
  onActivatePrice,
}: {
  role: ManagerRole;
  approvalsData?: Approval[];
  onDecision?: (id: string, action: ApprovalDecision) => Promise<boolean>;
  approvedPriceProposals?: KitchenApproval[];
  activatingPriceId?: number | null;
  onActivatePrice?: (approval: KitchenApproval) => Promise<void>;
}) {
  const {services:priceCatalog,employees:priceEmployees,managerId} = useServicePriceReview();
  const [approvals, setApprovals] = useState<Record<string,ApprovalStatus>>({});
  const handle = async (id: string, action: ApprovalDecision) => {
    if (onDecision && !(await onDecision(id, action))) return;
    setApprovals(p => ({ ...p, [id]: action }));
  };

  const visible = approvalsForRole(role, approvalsData);

  return (
    <div style={{ flex:1,overflowY:"auto",padding:"20px 24px" }}>
      <div style={{ marginBottom:16 }}>
        <h2 style={{ fontSize:20,fontWeight:800,color:"#0F172A",marginBottom:2 }}>Trung tâm Phê duyệt</h2>
        <p style={{ fontSize:12,color:"#94A3B8" }}>Tất cả các yêu cầu cần phê duyệt từ các bộ phận</p>
      </div>

      {approvedPriceProposals.length > 0 && (
        <div style={{ marginBottom:18,background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:12,padding:"14px 18px" }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
            <span style={{ fontSize:14,fontWeight:800,color:"#1E40AF" }}>Đề xuất đổi giá dịch vụ đã duyệt chờ kích hoạt ({approvedPriceProposals.length})</span>
          </div>
          <p style={{ margin:"0 0 10px",fontSize:12,color:"#1D4ED8" }}>
            Các đề xuất này đã được Ban Quản lý phê duyệt. Quản lý cần bấm &quot;Áp dụng giá ngay&quot; để bảng giá dịch vụ chính thức cập nhật vào hệ thống.
          </p>
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {approvedPriceProposals.map(pr => {
              const isActivating = activatingPriceId === pr.id;
              return (
                <div key={pr.id} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"10px 14px",background:"#FFF",borderRadius:8,border:"1px solid #DBEAFE" }}>
                  <div>
                    {priceReviewDetails(pr, priceCatalog, priceEmployees).map((line, index) => <p key={index} style={{margin:"2px 0",fontSize:12,color:"#334155"}}>{line}</p>)}
                    <p style={{fontSize:12,color:"#1D4ED8"}}>Đã duyệt · Chưa áp dụng</p>
                  </div>
                  <button
                    onClick={() => onActivatePrice?.(pr)}
                    disabled={activatingPriceId !== null || !managerId || pr.approver !== managerId}
                    title={pr.approver !== managerId ? "Chỉ người đã phê duyệt được áp dụng giá" : undefined}
                    style={{
                      display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:7,
                      border:"none",background:isActivating ? "#94A3B8" : "#2563EB",
                      color:"#FFF",fontSize:12,fontWeight:700,cursor:isActivating ? "wait" : "pointer"
                    }}
                  >
                    <Zap size={13} /> {isActivating ? "Đang áp dụng..." : "Áp dụng giá ngay"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
        {visible.length === 0 ? (
          <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",padding:"36px 20px",textAlign:"center",color:"#94A3B8",fontSize:13 }}>
            Hiện không có yêu cầu phê duyệt nào đang chờ xử lý từ các bộ phận.
          </div>
        ) : visible.map(a => {
            const st = approvals[a.id];
            return (
              <div key={a.id} style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",
              padding:"16px 20px",display:"flex",gap:14,alignItems:"flex-start",
              opacity:st?"0.6":"1",transition:"opacity .2s" }}>
              <div style={{ width:44,height:44,borderRadius:12,fontSize:22,flexShrink:0,
                background:a.deptColor+"15",display:"flex",alignItems:"center",justifyContent:"center" }}>
                {a.emoji}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}>
                  <span style={{ fontSize:12,color:"#64748B",fontWeight:500 }}>{a.dept}</span>
                  <span style={{ fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:99,
                    background:a.badgeColor+"18",color:a.badgeColor }}>{a.badge}</span>
                  <span style={{ fontSize:11,color:"#94A3B8",marginLeft:"auto" }}>{a.time}</span>
                </div>
                <p style={{ fontSize:14,fontWeight:700,color:"#0F172A",marginBottom:4 }}>{a.title}</p>
                {(a.kind === "service-price" && a.rawApproval ? priceReviewDetails(a.rawApproval, priceCatalog, priceEmployees) : a.detail).map((d,i) => <p key={i} style={{ fontSize:12,color:"#64748B",lineHeight:1.5 }}>{d}</p>)}
              </div>
              {a.approvalBlockedReason && !st ? (
                <p role="note" style={{ maxWidth:220,flexShrink:0,alignSelf:"center",fontSize:12,lineHeight:1.5,color:"#B45309" }}>
                  {a.approvalBlockedReason}
                </p>
              ) : !st ? (
                <div style={{ display:"flex",gap:8,flexShrink:0,alignItems:"center" }}>
                  <button onClick={() => handle(a.id,"approved")}
                    style={{ display:"flex",alignItems:"center",gap:5,padding:"8px 16px",borderRadius:8,
                      border:"none",background:"#16A34A",color:"#FFF",fontSize:12,fontWeight:700,cursor:"pointer" }}>
                    <Check size={13} /> Phê duyệt
                  </button>
                  {a.kind !== "technical-release" && a.kind !== "incident" && <button onClick={() => handle(a.id,"rejected")}
                    style={{ display:"flex",alignItems:"center",gap:5,padding:"8px 16px",borderRadius:8,
                      border:"1px solid #E2E8F0",background:"#FFF",color:"#475569",fontSize:12,fontWeight:600,cursor:"pointer" }}>
                    <X size={13} /> Từ chối
                  </button>}
                </div>
              ) : (
                <span style={{ fontSize:12,fontWeight:700,padding:"6px 14px",borderRadius:99,flexShrink:0,
                  background:st==="approved"?"#DCFCE7":"#FFE4E6",
                  color:st==="approved"?"#166534":"#BE123C" }}>
                  {st==="approved"?"✓ Đã phê duyệt":"✗ Đã từ chối"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   REPORTS SCREEN
══════════════════════════════════════════════════════════ */
function ReportsScreen({ invoices = [], rooms = [], expenses = [], finance }: { invoices?: ApiInvoice[]; rooms?: ApiRoom[]; expenses?: Expense[]; finance: ManagementFinance }) {
  const month = finance.today.slice(0, 7);
  const paid = invoices.filter(invoice => invoice.status === "DA_THANH_TOAN" && invoice.issued_at.startsWith(month));
  const costs = expenses.filter(expense => expense.paid_at.startsWith(month) && expense.status !== "VOIDED");
  const occupied = rooms.filter(room => room.status === "occupied").length;
  return <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
    {finance.error && <p role="alert" style={{color:"#B91C1C",marginBottom:16}}>{finance.error} <button onClick={finance.reload}>Tải lại</button></p>}
    <p style={{fontSize:13,color:"#64748B",marginBottom:16}}>Số liệu từ ngày 01/{month.slice(5)}/{month.slice(0,4)} đến {finance.today}. Công suất phản ánh trạng thái hiện tại.</p>
    <div className="management-kpis" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      {[
        {label:"Doanh thu đã ghi nhận trong tháng",value:finance.monthly ? fmtVND(finance.monthly.recognized_revenue) : "—",note:"Bút toán doanh thu đã chốt"},
        {label:"Thu/hoàn ròng trong tháng",value:finance.monthly ? fmtVND(finance.monthly.net_total) : "—",note:"Giao dịch hoàn tất trong kỳ"},
        {label:"Công suất phòng hiện tại",value:`${rooms.length ? Math.round(occupied/rooms.length*100) : 0}%`,note:`${occupied}/${rooms.length} phòng có khách`},
        {label:"Chi phí đã ghi nhận trong tháng",value:fmtVND(costs.reduce((sum,row)=>sum+row.amount,0)),note:`${costs.length} khoản chi trong kỳ`},
      ].map(item=><div key={item.label} style={{background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,padding:16}}><p style={{fontSize:12,color:"#64748B"}}>{item.label}</p><p style={{fontSize:22,fontWeight:800,margin:"8px 0"}}>{item.value}</p><p style={{fontSize:12,color:"#64748B"}}>{item.note}</p></div>)}
    </div>
    <div style={{background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,padding:18,overflowX:"auto"}}>
      <h2 style={{fontSize:16,fontWeight:700}}>Hóa đơn đã thanh toán lập trong tháng ({paid.length})</h2>
      <p style={{fontSize:12,color:"#64748B",margin:"6px 0 14px"}}>Giá trị hóa đơn sau giảm giá gồm tiền cọc đã nhận. Số này được đối chiếu riêng với bút toán doanh thu và dòng tiền.</p>
      <table style={{width:"100%",minWidth:480,borderCollapse:"collapse",fontSize:13}}><thead><tr>{["Hóa đơn","Đặt phòng","Ngày lập","Giá trị sau giảm giá"].map(title=><th key={title} style={{textAlign:"left",padding:10,background:"#F8FAFC"}}>{title}</th>)}</tr></thead>
        <tbody>{paid.map(invoice=><tr key={invoice.id}><td style={{padding:10}}>INV-{invoice.id}</td><td>#{invoice.reservation_id}</td><td>{invoice.issued_at.slice(0,10)}</td><td>{fmtVND(invoiceTotal(invoice))}</td></tr>)}{paid.length===0&&<tr><td colSpan={4} style={{padding:24,textAlign:"center",color:"#64748B"}}>Chưa có hóa đơn đã thanh toán lập trong tháng này.</td></tr>}</tbody>
      </table>
    </div>
  </div>;
}

function OperationsScreen({
  rooms, tasks, employees, workOrders, incidents, onNavigateApprovals, onNavigateIncidents, onTaskCreated, onTaskReady,
}: {
  rooms: ApiRoom[];
  tasks: HousekeepingTask[];
  employees: EmployeeAdmin[];
  workOrders: TechnicalWorkOrder[];
  incidents: EquipmentIncident[];
  onNavigateApprovals: () => void;
  onNavigateIncidents: () => void;
  onTaskCreated: (task: HousekeepingTask) => void;
  onTaskReady: (task: HousekeepingTask) => void;
}) {
  const actionRooms = rooms.filter(room => room.status === "cleaning" || room.status === "maintenance");
  const [assignees, setAssignees] = useState<Record<string, string>>({});
  const [savingRoom, setSavingRoom] = useState<string | null>(null);
  const [error, setError] = useState("");
  const housekeepingEmployees = employees.filter(employee => employee.role === "HOUSEKEEPING"
    && employee.enabled && employee.employment_status === "WORKING");

  const latestTaskForRoom = (roomId: string) => tasks
    .filter(task => task.room_id === roomId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];

  const updateRoomTask = async (task: HousekeepingTask) => {
    setSavingRoom(task.room_id);
    setError("");
    try {
      const updated = await housekeepingTechnicalApi.updateTask(task.id, { status: "READY" });
      onTaskReady(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xác nhận checklist phòng.");
    } finally {
      setSavingRoom(null);
    }
  };

  const assignPostRepairCleaning = async (room: ApiRoom) => {
    const assignee = assignees[room.id];
    if (!assignee) return;
    setSavingRoom(room.id);
    setError("");
    try {
      const task = await housekeepingTechnicalApi.createTask({
        room_id: room.id,
        assignee,
        note: "Dọn phòng và hoàn tất checklist sau khi bảo trì được nghiệm thu.",
      });
      onTaskCreated(task);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể giao checklist buồng phòng sau sửa chữa.");
    } finally {
      setSavingRoom(null);
    }
  };


  return (
    <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
      <div className="management-kpis" style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(150px,1fr))",gap:12,marginBottom:16}}>
        {[
          ["Phòng đang ở", rooms.filter(r=>r.status==="occupied").length, "#2563EB"],
          ["Sẵn sàng bán", rooms.filter(r=>r.status==="available").length, "#16A34A"],
          ["Chờ xác nhận vệ sinh", rooms.filter(r=>r.status==="cleaning").length, "#D97706"],
          ["Chờ nghiệm thu kỹ thuật", rooms.filter(r=>r.status==="maintenance").length, "#DC2626"],
        ].map(([label,value,color])=>(
          <div key={String(label)} style={{background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,padding:16}}>
            <p style={{fontSize:11,color:"#64748B",marginBottom:6}}>{label}</p>
            <p style={{fontSize:26,fontWeight:800,color:String(color)}}>{value}</p>
          </div>
        ))}
      </div>
      <div style={{background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"14px 16px",borderBottom:"1px solid #E2E8F0"}}>
          <p style={{fontSize:14,fontWeight:700,color:"#0F172A"}}>Hàng đợi nghiệm thu để mở phòng</p>
          <p style={{fontSize:11,color:"#64748B",marginTop:2}}>Chỉ checklist đã hoàn tất hoặc quy trình sửa chữa đã nghiệm thu mới được chuyển tiếp.</p>
        </div>
        {error && <p role="alert" style={{padding:"10px 16px",color:"#B91C1C",fontSize:12,background:"#FEF2F2"}}>{error}</p>}
        {actionRooms.map(room=>{
          const task = latestTaskForRoom(room.id);
          const roomRepairs = workOrders.filter(order => order.room_id === room.id);
          const waitingAcceptance = roomRepairs.some(order => order.status === "WAITING_ACCEPTANCE");
          const repairsAccepted = roomRepairs.some(order => order.status === "COMPLETED")
            && roomRepairs.every(order => order.status === "COMPLETED" || order.status === "ROOM_RELEASED");
          const blocked = Boolean(task?.blocking_incident) || incidents.some(incident => incident.room_id === room.id
            && ["HIGH", "CRITICAL"].includes(incident.severity) && incident.handoff_status !== "RESOLVED");
          const canMarkReady = task?.status === "CLEANED" && task.checklist_complete && !blocked
            && (room.status === "cleaning" || repairsAccepted);
          const releaseOrder = task?.status === "READY" && !blocked && repairsAccepted
            ? roomRepairs.find(order => order.status === "COMPLETED") : undefined;
          const canAssignCleaning = room.status === "maintenance" && !task && repairsAccepted;
          let statusText = room.status === "cleaning" ? "Chờ checklist buồng phòng" : "Chờ hoàn tất sửa chữa";
          if (waitingAcceptance) statusText = "Chờ quản lý nghiệm thu kỹ thuật";
          else if (room.status === "maintenance" && task?.checklist_complete) statusText = "Checklist xong · chờ kỹ thuật mở phòng";
          else if (canAssignCleaning) statusText = "Sửa chữa đã nghiệm thu · cần checklist buồng phòng";
          else if (task?.status === "IN_PROGRESS" || task?.status === "NEEDS_CLEANING") statusText = "Buồng phòng đang xử lý checklist";
          if (blocked) statusText = "Sự cố nghiêm trọng chưa được xác nhận xử lý";
          else if (releaseOrder) statusText = "Checklist và sửa chữa đã nghiệm thu · chờ kỹ thuật mở phòng";

          return <div className="management-operation-row" key={room.id} style={{display:"grid",gridTemplateColumns:"80px 1.2fr 1.5fr minmax(180px,1fr)",gap:12,alignItems:"center",padding:"12px 16px",borderBottom:"1px solid #F1F5F9"}}>
            <strong style={{fontSize:15}}>P.{room.name}</strong>
            <span style={{fontSize:12,color:"#475569"}}>{roomTypeLabel(room.room_type_name)} · Tầng {room.floor}</span>
            <span style={{fontSize:11,fontWeight:600,color:room.status==="maintenance"?"#DC2626":"#D97706"}}>{statusText}</span>
            {blocked ? <button onClick={onNavigateIncidents} style={{height:34,borderRadius:8,border:"1px solid #FECDD3",background:"#FFF1F2",color:"#9F1239",fontSize:12,fontWeight:700}}>Xử lý sự cố</button> : releaseOrder ? <span style={{fontSize:12,color:"#166534"}}>Kỹ thuật thực hiện bước mở phòng</span> : canMarkReady ? (
              <button disabled={savingRoom === room.id} onClick={() => void updateRoomTask(task)} style={{height:34,borderRadius:8,border:"none",background:"#0F172A",color:"#FFF",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                {savingRoom === room.id ? "Đang lưu…" : "Xác nhận checklist & sẵn sàng"}
              </button>
            ) : canAssignCleaning ? (
              <div style={{display:"flex",gap:6}}>
                <select aria-label={`Nhân viên buồng phòng phòng ${room.name}`} value={assignees[room.id] ?? ""} onChange={event => setAssignees(previous => ({...previous, [room.id]: event.target.value}))} style={{minWidth:0,flex:1,height:34,border:"1px solid #CBD5E1",borderRadius:7,padding:"0 6px",fontSize:11}}>
                  <option value="">Chọn nhân viên</option>
                  {housekeepingEmployees.map(employee => <option key={employee.employee_id} value={employee.employee_id}>{employee.full_name}</option>)}
                </select>
                <button disabled={!assignees[room.id] || savingRoom === room.id} onClick={() => void assignPostRepairCleaning(room)} style={{height:34,padding:"0 9px",borderRadius:8,border:"none",background:"#0F172A",color:"#FFF",fontSize:10,fontWeight:700,cursor:"pointer",opacity:!assignees[room.id] || savingRoom === room.id ? 0.5 : 1}}>
                  {savingRoom === room.id ? "Đang giao…" : "Giao checklist"}
                </button>
              </div>
            ) : waitingAcceptance ? (
              <button onClick={onNavigateApprovals} style={{height:34,borderRadius:8,border:"1px solid #FED7AA",background:"#FFF7ED",color:"#9A3412",fontSize:11,fontWeight:700,cursor:"pointer"}}>Mở phê duyệt kỹ thuật</button>
            ) : (
              <span style={{fontSize:10,color:"#64748B"}}>{room.status === "maintenance" && housekeepingEmployees.length === 0 ? "Chưa có nhân viên buồng phòng hoạt động" : "Đang chờ bộ phận phụ trách"}</span>
            )}
          </div>;
        })}
        {actionRooms.length === 0 && <p style={{padding:"30px 16px",textAlign:"center",fontSize:12,color:"#64748B"}}>Không có phòng đang chờ vệ sinh hoặc nghiệm thu kỹ thuật.</p>}
      </div>
    </div>
  );
}

function StaffOperationsScreen({ employees, tasks, onAdd }: { employees: EmployeeAdmin[]; tasks: HousekeepingTask[]; onAdd: () => void }) {
  return (
    <div style={{flex:1,overflowY:"auto",padding:"20px 24px",display:"grid",gridTemplateColumns:"1.2fr .8fr",gap:16}}>
      <div style={{background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"14px 16px",borderBottom:"1px solid #E2E8F0"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><strong>Danh sách nhân sự</strong><button onClick={onAdd} style={{background:"#1D4ED8",color:"white",padding:"8px 12px",borderRadius:8,fontSize:13,fontWeight:700}}>Thêm nhân viên</button></div></div>
        {employees.map(person=><div key={person.employee_id} style={{display:"grid",gridTemplateColumns:"1fr 130px 100px",gap:10,padding:"12px 16px",borderBottom:"1px solid #F1F5F9",alignItems:"center"}}>
          <div><p style={{fontSize:12,fontWeight:700}}>{person.full_name}</p><p style={{fontSize:10,color:"#94A3B8"}}>{employeeRoleLabel(person.role)} · {person.employee_id}</p></div>
          <span style={{fontSize:11,color:"#475569"}}>{{WORKING:"Đang làm việc",ON_LEAVE:"Đang nghỉ",TERMINATED:"Đã nghỉ việc"}[person.employment_status]}</span>
          <span style={{fontSize:10,fontWeight:700,color:person.enabled?"#16A34A":"#64748B"}}>{person.enabled?"Đang hoạt động":"Đã khóa"}</span>
        </div>)}
      </div>
      <div style={{background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,overflow:"hidden",alignSelf:"start"}}>
        <div style={{padding:"14px 16px",borderBottom:"1px solid #E2E8F0"}}><strong>Phân công buồng phòng</strong></div>
        {tasks.slice(0,5).map(task=><div key={task.id} style={{padding:"11px 16px",borderBottom:"1px solid #F1F5F9"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8}}><strong style={{fontSize:12}}>P.{task.room_id}</strong><span style={{fontSize:10,color:task.blocking_incident?"#DC2626":"#64748B"}}>{task.blocking_incident?"Có sự cố":"Thường"}</span></div>
          <p style={{fontSize:11,color:"#64748B",marginTop:3}}>{task.assignee || "Chưa phân công"} · {new Date(task.updated_at).toLocaleTimeString("vi-VN", {hour:"2-digit",minute:"2-digit"})}</p>
        </div>)}
      </div>
    </div>
  );
}

function IncidentsScreen({
  incidents,
  onApproveDispatch,
  onResolve,
  workOrders,
}: {
  incidents: EquipmentIncident[];
  onApproveDispatch?: (item: EquipmentIncident) => Promise<boolean | void>;
  onResolve: (item: EquipmentIncident) => void;
  workOrders: TechnicalWorkOrder[];
}) {
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [saving, setSaving] = useState<string[]>([]);
  const acknowledge = async (item: EquipmentIncident) => {
    const key = String(item.id);
    setSaving(ids => [...ids, key]);
    try {
      if (onApproveDispatch) {
        if (await onApproveDispatch(item) === false) return;
      } else {
        await housekeepingTechnicalApi.handoffIncident(item.id, { status: "ACKNOWLEDGED", note: "Đã tiếp nhận từ màn hình Ban điều hành." });
      }
      setAcknowledged(ids => [...ids, key]);
    } catch (error) {
      console.warn("Unable to acknowledge incident:", error);
    } finally {
      setSaving(ids => ids.filter(id => id !== key));
    }
  };
  return (
    <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {incidents.map(item=>{
          const key=String(item.id); const done=acknowledged.includes(key) || item.handoff_status !== "OPEN";
          return <div key={item.id} style={{background:"#FFF",border:`1px solid ${item.severity==="CRITICAL"||item.severity==="HIGH"?"#FECDD3":"#FDE68A"}`,borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
            <AlertTriangle size={18} style={{color:item.severity==="CRITICAL"||item.severity==="HIGH"?"#DC2626":"#D97706"}}/>
            <div style={{flex:1}}><p style={{fontSize:13,fontWeight:700}}>{item.equipment_name} · Phòng {item.room_id}</p><p style={{fontSize:11,color:"#94A3B8",marginTop:2}}>{item.handoff_note || incidentStatusLabel(item.handoff_status)}</p></div>
            <button disabled={done || saving.includes(key)} onClick={()=>void acknowledge(item)} style={{padding:"7px 14px",borderRadius:8,border:"1px solid #E2E8F0",background:done?"#DCFCE7":item.severity==="CRITICAL"||item.severity==="HIGH"?"#DC2626":"#2563EB",color:done?"#166534":"#FFF",fontSize:11,fontWeight:700,cursor:done?"default":"pointer"}}>
              {item.handoff_status === "RESOLVED" ? "Đã xử lý" : done ? "Đã tiếp nhận" : saving.includes(key) ? "Đang xử lý..." : "Duyệt & Giao kỹ thuật"}
            </button>
            {item.handoff_status === "ACKNOWLEDGED" && <button onClick={() => onResolve(item)} disabled={workOrders.some(order => order.room_id === item.room_id && !["COMPLETED", "ROOM_RELEASED"].includes(order.status))} style={{padding:"8px 12px",borderRadius:8,border:"1px solid #BBF7D0",color:"#166534",fontSize:12,fontWeight:700}} title="Xác nhận sau khi phiếu sửa chữa trong phòng đã nghiệm thu">Xác nhận đã xử lý</button>}
          </div>;
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function ManagerDashboard({ role, onBack }: { role: ManagerRole; onBack: () => void }) {
  const finance = useManagementFinance();
  const [showEmployeeProvision, setShowEmployeeProvision] = useState(false);
  const [resolveIncident, setResolveIncident] = useState<EquipmentIncident | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolveSaving, setResolveSaving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [operationsError, setOperationsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedSearchRoom, setSelectedSearchRoom] = useState<ApiRoom | null>(null);
  const [page, setPage] = useState<NavPage>("overview");
  const [liveApprovals, setLiveApprovals] = useState<Approval[]>([]);
  const [liveLeaveRequests, setLiveLeaveRequests] = useState<LeaveRequest[]>([]);
  const [liveRooms, setLiveRooms] = useState<ApiRoom[]>([]);
  const [liveEmployees, setLiveEmployees] = useState<EmployeeAdmin[]>([]);
  const [liveTasks, setLiveTasks] = useState<HousekeepingTask[]>([]);
  const [liveIncidents, setLiveIncidents] = useState<EquipmentIncident[]>([]);
  const [liveInvoices, setLiveInvoices] = useState<ApiInvoice[]>([]);
  const [liveExpenses, setLiveExpenses] = useState<Expense[]>([]);
  const [liveTechnicalOrders, setLiveTechnicalOrders] = useState<TechnicalWorkOrder[]>([]);
  const [currentManager, setCurrentManager] = useState<{ id: string; name: string; roleTitle: string; initials: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [topProfileOpen, setTopProfileOpen] = useState(false);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);
  const [acceptModalOrder, setAcceptModalOrder] = useState<TechnicalWorkOrder | null>(null);
  const [acceptNoteInput, setAcceptNoteInput] = useState("");
  const [acceptModalError, setAcceptModalError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [priceCatalog, setPriceCatalog] = useState<Service[]>([]);
  const [priceNotice, setPriceNotice] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [approvedPriceProposals, setApprovedPriceProposals] = useState<KitchenApproval[]>([]);
  const [activatingPriceId, setActivatingPriceId] = useState<number | null>(null);
  const [refreshApprovalsCount, setRefreshApprovalsCount] = useState(0);

  useEffect(() => {
    let active = true;

    // Load manager profile
    authApi.employeeProfile()
      .then(profile => {
        if (!active) return;
        const name = profile.full_name || profile.employee_id;
        const parts = name.trim().split(" ");
        const initials = (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
        setCurrentManager({
          id: profile.employee_id,
          name,
          roleTitle: role === "director" ? "Giám đốc Khách sạn" : "Quản lý Khách sạn",
          initials,
        });
      })
      .catch(err => {
        console.warn("Backend manager profile unavailable:", err);
        if (active) {
          setCurrentManager(null);
          setProfileError("Không thể tải hồ sơ quản lý. Vui lòng thử lại.");
        }
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    // Load governance approvals
    hrGovernanceApi.approvals("PENDING")
      .then(value => {
        const source = Array.isArray(value) ? value : value.items;
        if (!active) return;
        setLiveApprovals(source.map((approval: ApiApproval): Approval => {
          let detail: string[] = [];
          try {
            const payload = JSON.parse(approval.payload) as Record<string, unknown>;
            detail = approval.action === "SERVICE_CATALOG_CREATE"
              ? [`${payload.kind === "WAREHOUSE" ? "Kho" : "Dịch vụ"}: ${String(payload.name)} (${String(payload.id)})`, `Đơn vị: ${String(payload.unit)} · Giá: ${fmtVND(Number(payload.price))}`, approval.reason]
              : Object.entries(payload).slice(0, 2).map(([key, item]) => `${key}: ${String(item)}`);
            if(approval.target_id.startsWith("finance:"))detail=[
              payload.invoice_id ? `Thu hóa đơn INV-${payload.invoice_id}` : payload.debt_id ? `Thanh toán công nợ #${payload.debt_id}` : `Nhóm chi: ${String(payload.category??"")}`,
              `Phương thức: ${({CASH:"Tiền mặt",CARD:"Thẻ",BANK_TRANSFER:"Chuyển khoản ngân hàng"} as Record<string,string>)[String(payload.method)]??String(payload.method)}`,
              String(payload.description??payload.reference??payload.note??approval.reason),
            ];
          } catch { /* reason remains the visible fallback */ }
          return {
            id: String(approval.id), dept: "Đề xuất nghiệp vụ", deptColor: "#3B82F6", emoji: "✓",
            title: approval.target_id.startsWith("finance:") ? (!approval.target_id.startsWith("finance:payment:") ? "Duyệt chi tiền trên 10 triệu" : "Duyệt thu tiền trên 10 triệu") : approvalActionLabel(approval.action), detail: approval.target_id.startsWith("finance:") ? [...(detail.length?detail:[approval.reason]), `Số tiền: ${fmtVND(Number(approval.amount))}`, `Người đề nghị: ${approval.requester}`] : detail.length > 0 ? detail : [approval.reason],
            time: approval.requested_at, badge: {HIGH:"Rủi ro cao",MEDIUM:"Trung bình",LOW:"Thấp"}[approval.risk] ?? approval.risk, badgeColor: approval.risk === "HIGH" ? "#DC2626" : "#F59E0B",
            kind: approval.action === "SERVICE_PRICE_CHANGE" ? "service-price" : approval.action.toLowerCase().includes("refund") ? "refund" : approval.action.toLowerCase().includes("technical") ? "technical-release" : "expense",
            rawApproval: approval,
          };
        }));
      })
      .catch(err => { console.warn("Backend approval queue unavailable:", err); if (active) setLiveApprovals([]); });

    kitchenAccountingApi.approvals("APPROVED")
      .then(value => {
        if (!active) return;
        const source = Array.isArray(value) ? value : value.items;
        const unconsumed = source.filter((a: KitchenApproval) =>
          (a.action === "SERVICE_PRICE_CHANGE" || a.action === "Thay đổi giá dịch vụ") && !a.consumed_at
        );
        setApprovedPriceProposals(unconsumed);
      })
      .catch(() => { if (active) { setApprovedPriceProposals([]); setPriceError("Không tải được đề xuất đã duyệt chờ áp dụng. Vui lòng tải lại."); } });

    enterpriseApi.leaves("PENDING")
      .then(rows => { if (active) setLiveLeaveRequests(rows); })
      .catch(err => { console.warn("Backend leave approval queue unavailable:", err); if (active) setLiveLeaveRequests([]); });

    // Load operational state
    Promise.all([
      housekeepingTechnicalApi.rooms(),
      hrGovernanceApi.employees(true),
      housekeepingTechnicalApi.tasks(),
      housekeepingTechnicalApi.incidents(),
      (async () => {
        const items: ApiInvoice[] = [];
        for (let page = 0; ; page++) {
          const result = await frontDeskApi.invoices({ page, size: 100 });
          if (!Array.isArray(result.items) || !Number.isSafeInteger(result.total_pages)) throw new Error("Phản hồi danh sách hóa đơn không hợp lệ.");
          items.push(...result.items);
          if (page + 1 >= result.total_pages) return items;
        }
      })(),
      housekeepingTechnicalApi.workOrders(),
    ])
      .then(([rooms, employees, tasks, incidents, invoices, workOrders]) => {
        if (!active) return;
        setLiveRooms(rooms);
        setLiveEmployees(employees);
        setLiveTasks(tasks);
        setLiveIncidents(incidents);
        setLiveInvoices(invoices);
        setOperationsError(null);
        setLiveTechnicalOrders(workOrders);
      })
      .catch(err => {
        console.warn("Backend manager operations snapshot unavailable:", err);
        if (active) {
          setOperationsError(apiErrorMessage(err, "Không thể tải dữ liệu vận hành."));
          setLiveRooms([]);
          setLiveEmployees([]);
          setLiveTasks([]);
          setLiveIncidents([]);
          setLiveInvoices([]);
          setLiveTechnicalOrders([]);
        }
      });

    kitchenAccountingApi.expenses()
      .then(expenses => { if (active) setLiveExpenses(expenses); })
      .catch(err => { console.warn("Backend manager expenses unavailable:", err); if (active) setLiveExpenses([]); });

    kitchenAccountingApi.services().then(rows => { if (active) setPriceCatalog(rows); })
      .catch(() => { if (active) { setPriceCatalog([]); setPriceError("Không tải được bảng giá hiện tại. Vui lòng tải lại trước khi đối chiếu giá."); } });

    return () => { active = false; };
  }, [role, refreshApprovalsCount]);

  // Combine live WAITING_ACCEPTANCE technical work orders into approvals
  const technicalApprovals: Approval[] = useMemo(() => {
    return liveTechnicalOrders
      .filter(order => order.status === "WAITING_ACCEPTANCE")
      .map(order => {
        const approvalBlockedReason = profileLoading
          ? "Đang xác minh tài khoản quản lý."
          : !currentManager?.id
            ? "Không xác minh được tài khoản quản lý; vui lòng tải lại trang."
            : order.created_by === currentManager.id
              ? "Bạn là người tạo phiếu này nên không thể tự nghiệm thu."
              : order.assignee === currentManager.id
                ? "Bạn là người được giao phiếu nên không thể tự nghiệm thu."
                : undefined;
        return {
        id: `tech-${order.id}`,
        dept: "Kỹ thuật & Bảo trì",
        deptColor: "#EA580C",
        emoji: "🔧",
        title: `Nghiệm thu sửa chữa phòng ${order.room_id}`,
        detail: [
          `Hạng mục / Vật tư: ${order.materials || "Bảo trì thiết bị"}`,
          `Báo cáo kỹ thuật: ${order.result_note || "Chưa có báo cáo"}`,
          `Kỹ thuật viên: ${order.assignee || "Chưa phân công"}`,
        ],
        time: order.updated_at ? new Date(order.updated_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "Vừa xong",
        badge: order.priority === "CRITICAL" ? "Khẩn cấp" : order.priority === "HIGH" ? "Ưu tiên cao" : "Nghiệm thu",
        badgeColor: order.priority === "CRITICAL" ? "#DC2626" : "#EA580C",
        kind: "technical-release",
        approvalBlockedReason,
        rawWorkOrderId: order.id,
      };
      });
  }, [liveTechnicalOrders, currentManager?.id, profileLoading]);

  const leaveApprovals: Approval[] = useMemo(() => liveLeaveRequests.map(request => {
    const employee = liveEmployees.find(item => item.employee_id === request.employee_id);
    const leaveType = request.leave_type === "SHIFT_CHANGE" ? "Đổi ca trực"
      : request.leave_type === "SICK" ? "Nghỉ ốm"
      : request.leave_type === "ANNUAL" ? "Nghỉ phép năm" : "Việc riêng";
    return {
      id: `leave-${request.id}`,
      dept: "Nhân sự",
      deptColor: "#7C3AED",
      emoji: "👥",
      title: `${leaveType}: ${employee?.full_name ?? request.employee_id}`,
      detail: [`Thời gian: ${request.start_date} – ${request.end_date}`, request.reason],
      time: request.created_at,
      badge: "Chờ duyệt",
      badgeColor: "#7C3AED",
      kind: "leave",
    };
  }), [liveLeaveRequests, liveEmployees]);

  const incidentApprovals: Approval[] = useMemo(() => {
    return liveIncidents
      .filter(inc => inc.handoff_status === "OPEN")
      .map(inc => ({
        id: `incident-${inc.id}`,
        dept: "Buồng phòng & Sự cố",
        deptColor: "#DC2626",
        emoji: "🚨",
        title: `Sự cố phòng ${inc.room_id}: ${inc.equipment_name}`,
        detail: [
          `Hạng mục / Thiết bị: ${inc.equipment_name} · Phòng ${inc.room_id}`,
          `Mô tả sự cố: ${inc.handoff_note || "Buồng phòng báo sự cố cần kỹ thuật xử lý"}`,
          `Mức độ nghiêm trọng: ${inc.severity === "CRITICAL" ? "Nghiêm trọng (Khẩn cấp)" : inc.severity === "HIGH" ? "Cao" : inc.severity === "MEDIUM" ? "Trung bình" : "Thấp"}`,
        ],
        time: "Chờ duyệt",
        badge: inc.severity === "CRITICAL" ? "Khẩn cấp" : inc.severity === "HIGH" ? "Ưu tiên cao" : "Sự cố phòng",
        badgeColor: inc.severity === "CRITICAL" || inc.severity === "HIGH" ? "#DC2626" : "#EA580C",
        kind: "incident",
      }));
  }, [liveIncidents]);

  const allApprovals = useMemo(() => {
    const authorized = liveApprovals.map(approval => ({ ...approval, approvalBlockedReason: profileLoading
      ? "Đang xác minh tài khoản quản lý."
      : !currentManager?.id ? "Không xác minh được tài khoản quản lý; vui lòng tải lại."
      : approval.rawApproval?.requester === currentManager.id ? "Bạn là người gửi yêu cầu nên không thể tự phê duyệt."
      : approval.rawApproval?.target_id.startsWith("finance:") && role!=="director" ? "Khoản thu/chi này cần Giám đốc phê duyệt."
      : undefined }));
    return [...authorized, ...leaveApprovals, ...technicalApprovals, ...incidentApprovals];
  }, [liveApprovals, leaveApprovals, technicalApprovals, incidentApprovals, currentManager?.id, profileLoading, role]);

  const pendingCount = approvalsForRole(role, allApprovals).length;

  const approveAndDispatchIncident = async (incident: EquipmentIncident) => {
    try {
      // 2. Map priority
      const backendPriority =
        incident.severity === "CRITICAL" ? "CRITICAL" :
        incident.severity === "HIGH" ? "HIGH" :
        incident.severity === "MEDIUM" ? "MEDIUM" : "LOW";

      // 3. Find matching equipment if any
      let equipmentId: number | undefined;
      try {
        const equips = await housekeepingTechnicalApi.equipment(incident.room_id);
        const match = (equips || []).find(e =>
          e.name.toLowerCase().includes(incident.equipment_name.toLowerCase()) ||
          incident.equipment_name.toLowerCase().includes(e.name.toLowerCase())
        );
        if (match) equipmentId = Number(match.id);
      } catch {
        // proceed without equipmentId
      }

      // 4. Create technical work order
      const marker = `[Sự cố #${incident.id}]`;
      const existingOrders = await housekeepingTechnicalApi.workOrders({ roomId: incident.room_id });
      const existingOrder = existingOrders.find(order => order.materials?.startsWith(marker));
      const technicalStaff = liveEmployees.filter(employee => employee.role === "TECHNICAL" && employee.enabled && employee.employment_status === "WORKING");
      const newOrder = existingOrder ?? await housekeepingTechnicalApi.createWorkOrder({
        room_id: incident.room_id,
        equipment_id: equipmentId,
        priority: backendPriority,
        assignee: technicalStaff.length === 1 ? technicalStaff[0].employee_id : undefined,
        materials: `${marker} ${incident.equipment_name}`,
      }, { idempotencyKey: `MGMT-INCIDENT-${incident.id}-ORDER` });
      setLiveTechnicalOrders(prev => [newOrder, ...prev.filter(order => order.id !== newOrder.id)]);
      const updatedIncident = await housekeepingTechnicalApi.handoffIncident(incident.id, {
        status: "ACKNOWLEDGED", note: `Đã giao phiếu kỹ thuật #${newOrder.id}`,
      }, { idempotencyKey: `MGMT-INCIDENT-${incident.id}-DISPATCH` });

      // 5. Update local state

      setLiveIncidents(prev => prev.map(inc =>
        inc.id === incident.id
          ? updatedIncident
          : inc
      ));
      return true;
    } catch (err) {
      console.error("Unable to dispatch incident to technical work order:", err);
      setOperationsError(apiErrorMessage(err, "Không thể duyệt và giao việc kỹ thuật. Vui lòng thử lại."));
      return false;
    }
  };

  const handleApprovalDecision = async (id: string, action: ApprovalDecision) => {
    if (id.startsWith("leave-")) {
      const leaveId = Number(id.slice("leave-".length));
      if (!Number.isSafeInteger(leaveId)) return false;
      try {
        if (action === "approved") await enterpriseApi.approveLeave(leaveId);
        else await enterpriseApi.rejectLeave(leaveId);
        setLiveLeaveRequests(previous => previous.filter(request => request.id !== leaveId));
        return true;
      } catch (err) {
        console.warn("Unable to persist leave approval decision:", err);
        setOperationsError(apiErrorMessage(err, "Không thể lưu quyết định nghỉ phép."));
        return false;
      }
    }
    if (id.startsWith("incident-")) {
      const incidentId = Number(id.replace("incident-", ""));
      const targetIncident = liveIncidents.find(i => i.id === incidentId);
      if (action === "approved" && targetIncident) {
        return await approveAndDispatchIncident(targetIncident);
      }
      return false;
    }
    if (id.startsWith("tech-")) {
      const orderId = Number(id.replace("tech-", ""));
      const targetOrder = liveTechnicalOrders.find(o => o.id === orderId);
      if (action === "approved") {
        const cannotAccept = !currentManager?.id || !targetOrder
          || targetOrder.created_by === currentManager.id
          || targetOrder.assignee === currentManager.id;
        if (!cannotAccept && targetOrder) {
          setAcceptModalOrder(targetOrder);
          setAcceptNoteInput("");
          setAcceptModalError(null);
        }
        return false;
      } else {
        window.alert("Không thể từ chối trực tiếp phiếu kỹ thuật. Vui lòng liên hệ kỹ thuật viên nếu cần bổ sung thông tin.");
        return false;
      }
    }

    const numericId = Number(id);
    if (!Number.isInteger(numericId)) return true;
    try {
      if (action === "approved") {
        await hrGovernanceApi.approve(numericId);
        const target = liveApprovals.find(item => item.id === id);
        if (target?.kind === "service-price") {
          setPriceError(null);
          setPriceNotice("Đã phê duyệt đề xuất. Giá hiện tại được giữ đến khi bấm Áp dụng giá ngay.");
        }
      } else {
        await hrGovernanceApi.reject(numericId);
      }
      setLiveApprovals(previous => previous.filter(item => item.id !== id));
      setRefreshApprovalsCount(c => c + 1);
      finance.reload();
      return true;
    } catch (err) {
      console.warn("Unable to persist manager approval decision:", err);
      setOperationsError(apiErrorMessage(err, "Không thể lưu quyết định phê duyệt."));
      return false;
    }
  };

  const handleActivateApprovedPrice = async (approval: KitchenApproval) => {
    if (activatingPriceId !== null) return;
    setActivatingPriceId(approval.id);
    setPriceError(null);
    setPriceNotice(null);
    try {
      const newPrice = proposedPrice(approval);
      if (newPrice === null) throw new Error("Giá dịch vụ không hợp lệ");
      await kitchenAccountingApi.activatePrice(approval.target_id, {
        price: newPrice,
        reason: approval.reason || "Quản lý kích hoạt giá đã duyệt",
      }, `act-mgr-${approval.id}`);
      setApprovedPriceProposals(prev => prev.filter(p => p.id !== approval.id));
      setPriceCatalog(prev => prev.map(service => service.id === approval.target_id ? { ...service, price: newPrice } : service));
      setPriceNotice(`Đã áp dụng giá ${formatVnd(newPrice)} cho ${approval.target_id}.`);
    } catch (err) {
      setPriceError(apiErrorMessage(err, "Không thể áp dụng giá. Đề xuất vẫn ở trạng thái đã duyệt; vui lòng thử lại."));
    } finally {
      setActivatingPriceId(null);
    }
  };

  const handleConfirmAccept = async () => {
    if (!acceptModalOrder) return;
    if (!acceptNoteInput.trim()) {
      setAcceptModalError("Vui lòng ghi nhận xét nghiệm thu đạt yêu cầu.");
      return;
    }
    setIsAccepting(true);
    setAcceptModalError(null);
    try {
      const updated = await housekeepingTechnicalApi.accept(acceptModalOrder.id, {
        acceptance_note: acceptNoteInput.trim(),
      });
      setLiveTechnicalOrders(prev => prev.map(o => o.id === acceptModalOrder.id ? updated : o));
      setAcceptModalOrder(null);
      setAcceptNoteInput("");
    } catch (err) {
      setAcceptModalError(apiErrorMessage(err, "Không thể nghiệm thu phiếu kỹ thuật. Vui lòng thử lại."));
    } finally {
      setIsAccepting(false);
    }
  };

  const managerName = profileLoading ? "Đang tải..." : profileError ? (role === "director" ? "Giám đốc Khách sạn" : "Quản lý Khách sạn") : currentManager?.name || (role === "director" ? "Giám đốc Khách sạn" : "Quản lý Khách sạn");
  const managerDeptTitle = role === "director" ? "Ban giám đốc" : "Tổng quản lý";
  const managerInitials = profileLoading ? "..." : profileError ? (role === "director" ? "GĐ" : "QL") : currentManager?.initials || (role === "director" ? "GĐ" : "QL");

  return (
    <ServicePriceReviewContext.Provider value={{services:priceCatalog,employees:liveEmployees,managerId:currentManager?.id}}>
    <div className="management-station" style={{ display:"flex",height:"100vh",overflow:"hidden",
      background:"#F8FAFC",fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* SIDEBAR */}
      <aside style={{ width:200,background:"#FFF",borderRight:"1px solid #E2E8F0",
        display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden" }}>
        {/* Brand */}
        <div style={{ padding:"14px 14px 12px",borderBottom:"1px solid #E2E8F0" }}>
          <div style={{ display:"flex",alignItems:"center",gap:9 }}>
            <img
              src="/hotel_logo.png"
              alt="MaM Hotel Logo"
              style={{ width:36,height:"auto",objectFit:"contain",flexShrink:0,filter:"drop-shadow(0 2px 6px rgba(184,148,74,0.35))" }}
            />
            <div>
              <p style={{ fontSize:13,fontWeight:700,color:"#0F172A",lineHeight:1.1,fontFamily:"'Cormorant Garamond',Georgia,serif",letterSpacing:"0.05em" }}>MaM Hotel</p>
              <p style={{ fontSize:9,color:"#7C3AED",letterSpacing:"0.08em",textTransform:"uppercase",marginTop:2,fontWeight:600 }}>BAN ĐIỀU HÀNH</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1,padding:"10px 8px",overflowY:"auto" }}>
          {SIDE_NAV.map(n => {
            const active = page === n.id;
            return (
              <button key={n.id} onClick={() => setPage(n.id)}
                style={{ width:"100%",display:"flex",alignItems:"center",gap:9,
                  padding:"9px 10px",borderRadius:8,cursor:"pointer",marginBottom:2,
                  background:active?"#EFF6FF":"transparent",
                  color:active?"#1D4ED8":"#475569",fontWeight:active?700:400,fontSize:13,
                  textAlign:"left",transition:"all .1s" }}>
                <n.Icon size={15} style={{ color:active?"#2563EB":"#94A3B8",flexShrink:0 }} strokeWidth={active?2:1.5} />
                <span style={{ flex:1 }}>{n.label}</span>
                {n.badge && (
                  <span style={{ fontSize:10,fontWeight:800,minWidth:18,height:18,borderRadius:99,
                    background:"#EF4444",color:"#FFF",display:"flex",alignItems:"center",justifyContent:"center",
                    padding:"0 4px" }}>{pendingCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* GM Profile */}
        <div style={{ padding:"10px 14px",borderTop:"1px solid #F1F5F9",position:"relative" }}>
          <div
            onClick={()=>setSidebarProfileOpen(p=>!p)}
            style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer" }}
            title="Hồ sơ nhân viên"
          >
            <div style={{ width:30,height:30,borderRadius:99,flexShrink:0,
              background:"linear-gradient(135deg,#1D4ED8,#3B82F6)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:12,fontWeight:800,color:"#FFF" }}>{managerInitials}</div>
            <div>
              <p style={{ fontSize:11,fontWeight:700,color:"#0F172A",lineHeight:1 }}>{managerName}</p>
              <p style={{ fontSize:10,color:"#94A3B8" }}>{managerDeptTitle}</p>
            </div>
          </div>
          <button onClick={onBack}
            style={{ display:"flex",alignItems:"center",gap:5,color:"#94A3B8",cursor:"pointer",fontSize:11,background:"transparent",border:"none",padding:0 }}>
            <LogOut size={11} /> Đăng xuất
          </button>
          <EmployeeProfileDropdown
            isOpen={sidebarProfileOpen}
            onClose={()=>setSidebarProfileOpen(false)}
            onLogout={onBack}
            align="bottom-left"
            currentRoleLabel={role === "director" ? "Giám đốc Điều hành" : "Quản lý Vận hành"}
            departmentName={role === "director" ? "Ban Giám đốc" : "Ban Quản lý"}
          />
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0 }}>

        {/* HEADER */}
        <header style={{ background:"#FFF",borderBottom:"1px solid #E2E8F0",height:54,
          display:"flex",alignItems:"center",gap:12,padding:"0 24px",flexShrink:0 }}>
          <div style={{ position:"relative",flex:1,maxWidth:520 }}>
            <Search size={13} style={{ position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none" }} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm phòng hoặc nhân viên..."
              style={{ width:"100%",height:34,paddingLeft:32,paddingRight:42,borderRadius:8,
                border:"1px solid #E2E8F0",background:"#F8FAFC",fontSize:12,outline:"none",boxSizing:"border-box" }} />
            {search.trim() && <div style={{position:"absolute",left:0,right:0,top:38,zIndex:50,background:"white",border:"1px solid #CBD5E1",borderRadius:8,padding:8,maxHeight:280,overflowY:"auto",boxShadow:"0 10px 20px #0F172A18"}}>
              {[...liveRooms.filter(room => `${room.id} ${room.name}`.toLowerCase().includes(search.toLowerCase())).slice(0,6).map(room => ({key:`room-${room.id}`,label:`Phòng ${room.name} · ${room.room_type_name}`,page:"operations" as NavPage})),
              ...liveEmployees.filter(employee => `${employee.employee_id} ${employee.full_name}`.toLowerCase().includes(search.toLowerCase())).slice(0,6).map(employee=>({key:employee.employee_id,label:employee.full_name,page:"staff" as NavPage}))].map(result=><button key={result.key} onClick={()=>{const room=liveRooms.find(item=>result.key===`room-${item.id}`); if(room)setSelectedSearchRoom(room);else setPage(result.page);setSearch("");}} style={{display:"block",width:"100%",textAlign:"left",padding:10,fontSize:13}}>{result.label}</button>)}
              {!liveRooms.some(room => `${room.id} ${room.name}`.toLowerCase().includes(search.toLowerCase())) && !liveEmployees.some(employee => `${employee.employee_id} ${employee.full_name}`.toLowerCase().includes(search.toLowerCase())) && <p style={{padding:10,fontSize:13}}>Không tìm thấy kết quả.</p>}
            </div>}
          </div>

          {/* Date */}
          <div style={{ display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:8,
            border:"1px solid #E2E8F0",background:"#F8FAFC",cursor:"pointer" }}>
            <CalendarDays size={12} style={{ color:"#64748B" }} />
            <span style={{ fontSize:12,color:"#334155",whiteSpace:"nowrap" }}>{new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "short", day: "numeric" })}</span>
            <ChevronDown size={11} style={{ color:"#94A3B8" }} />
          </div>

          <div style={{ flex:1 }} />

          {/* Bell */}
          <button aria-label="Thông báo và cảnh báo" onClick={() => setPage("notifications")} style={{ width:34,height:34,borderRadius:8,background:"#F8FAFC",border:"1px solid #E2E8F0",
            display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative" }}>
            <Bell size={14} style={{ color:"#475569" }} />
            {pendingCount > 0 && <span style={{ position:"absolute",top:5,right:5,width:8,height:8,borderRadius:99,background:"#EF4444",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"#FFF",fontWeight:800 }}>{pendingCount}</span>}
          </button>

          {/* Avatar */}
          <div style={{ position:"relative" }}>
            <div
              onClick={()=>setTopProfileOpen(p=>!p)}
              style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer" }}
              title="Hồ sơ nhân viên"
            >
              <div style={{ width:32,height:32,borderRadius:99,
                background:"linear-gradient(135deg,#1D4ED8,#3B82F6)",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:12,fontWeight:800,color:"#FFF" }}>{managerInitials}</div>
              <div>
                <p style={{ fontSize:12,fontWeight:700,color:"#0F172A",lineHeight:1 }}>{managerName}</p>
                <p style={{ fontSize:10,color:"#94A3B8" }}>{managerDeptTitle}</p>
              </div>
              <ChevronDown size={12} style={{ color:"#94A3B8" }} />
            </div>
            <EmployeeProfileDropdown
              isOpen={topProfileOpen}
              onClose={()=>setTopProfileOpen(false)}
              onLogout={onBack}
              align="top-right"
              currentRoleLabel={role === "director" ? "Giám đốc Điều hành" : "Quản lý Vận hành"}
              departmentName={role === "director" ? "Ban Giám đốc" : "Ban Quản lý"}
            />
          </div>
        </header>

        {/* PAGE TITLE */}
        <div style={{ padding:"16px 24px 12px",background:"#FFF",borderBottom:"1px solid #E2E8F0",flexShrink:0 }}>
          <h1 style={{ fontSize:22,fontWeight:800,color:"#0F172A",marginBottom:2 }}>
            {page==="overview"   && "Tổng quan điều hành"}
            {page==="approvals"  && "Trung tâm Phê duyệt"}
            {page==="operations" && "Vận hành & Phòng"}
            {page==="staff"      && "Nhân sự & Phân ca"}
            {page==="incidents"  && "Sự cố & Khẩn cấp"}
            {page==="reports"    && "Báo cáo điều hành"}
            {page==="notifications" && "Thông báo & Cảnh báo"}
          </h1>
          <p style={{ fontSize:13,color:"#64748B" }}>
            {page==="overview"  && `Chào mừng trở lại, ${role === "director" ? "Giám đốc" : "Quản lý"}! Đây là tình hình hoạt động của khách sạn hôm nay.`}
            {page==="approvals" && "Các yêu cầu đang chờ phê duyệt từ tất cả bộ phận."}
            {page==="operations"&& "Tình trạng phòng và vận hành theo thời gian thực."}
            {page==="staff"     && "Danh sách nhân viên và phân công buồng phòng."}
            {page==="notifications" && "Các yêu cầu đang chờ và sự cố chưa xử lý."}
            {page==="incidents" && "Theo dõi sự cố và cảnh báo khẩn cấp."}
            {page==="reports"   && `Báo cáo tổng hợp kinh doanh tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}.`}
          </p>
        </div>

        {/* CONTENT */}
        <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
          {priceNotice && <p role="status" style={{padding:12,color:"#1D4ED8",background:"#EFF6FF"}}>{priceNotice}</p>}
          {priceError && <p role="alert" style={{padding:12,color:"#B91C1C",background:"#FEF2F2"}}>{priceError}</p>}
          {operationsError && <p role="alert" style={{padding:12,color:"#B91C1C",background:"#FEF2F2"}}>{operationsError} <button onClick={()=>setRefreshApprovalsCount(value=>value+1)}>Tải lại</button></p>}
          {page==="notifications" && <div style={{padding:24,overflowY:"auto"}}>
            <h2 style={{fontWeight:700,marginBottom:12}}>Sự cố chưa xử lý</h2>
            {liveIncidents.filter(item=>item.handoff_status!=="RESOLVED").map(item=><button key={item.id} onClick={()=>setPage("incidents")} style={{display:"block",background:"white",width:"100%",padding:14,border:"1px solid #E2E8F0",borderRadius:8,marginBottom:8,textAlign:"left"}}>Phòng {item.room_id}: {item.equipment_name} · {item.handoff_status==="OPEN"?"Chờ tiếp nhận":"Đang xử lý"}</button>)}
            <h2 style={{fontWeight:700,margin:"20px 0 12px"}}>Yêu cầu chờ phê duyệt</h2>
            {approvalsForRole(role,allApprovals).map(item=><button key={item.id} onClick={()=>setPage("approvals")} style={{display:"block",background:"white",width:"100%",padding:14,border:"1px solid #E2E8F0",borderRadius:8,marginBottom:8,textAlign:"left"}}>{item.title}</button>)}
            {!pendingCount&&!liveIncidents.some(item=>item.handoff_status!=="RESOLVED")&&<p>Không có yêu cầu hoặc cảnh báo đang chờ xử lý.</p>}
          </div>}
          {page==="overview"   && <OverviewScreen role={role} approvalsData={allApprovals} rooms={liveRooms} invoices={liveInvoices} incidents={liveIncidents} techOrders={liveTechnicalOrders} onDecision={handleApprovalDecision} onNavApprovals={() => setPage("approvals")} onNavOperations={() => setPage("operations")} onNavNotifications={() => setPage("notifications")} finance={finance} />}
          {page==="approvals"  && <ApprovalsScreen role={role} approvalsData={allApprovals} onDecision={handleApprovalDecision} approvedPriceProposals={approvedPriceProposals} activatingPriceId={activatingPriceId} onActivatePrice={handleActivateApprovedPrice} />}
          {page==="reports"    && <ReportsScreen invoices={liveInvoices} rooms={liveRooms} expenses={liveExpenses} finance={finance} />}
          {page==="operations" && <OperationsScreen
            rooms={liveRooms}
            tasks={liveTasks}
            employees={liveEmployees}
            workOrders={liveTechnicalOrders}
            incidents={liveIncidents}
            onNavigateApprovals={() => setPage("approvals")}
            onNavigateIncidents={() => setPage("incidents")}
            onTaskCreated={task => {
              setLiveTasks(previous => [task, ...previous.filter(item => item.id !== task.id)]);
              setRefreshApprovalsCount(value => value + 1);
            }}
            onTaskReady={task => {
              setLiveTasks(previous => previous.map(item => item.id === task.id ? task : item));
              setRefreshApprovalsCount(value => value + 1);
            }}
          />}
          {page==="staff"      && <StaffOperationsScreen employees={liveEmployees} tasks={liveTasks} onAdd={() => setShowEmployeeProvision(true)} />}
          {page==="incidents"  && <IncidentsScreen incidents={liveIncidents} onApproveDispatch={approveAndDispatchIncident} workOrders={liveTechnicalOrders} onResolve={item => {setResolveIncident(item); setResolveNote(""); setResolveError(null);}} />}
        </div>
      </div>

      {showEmployeeProvision && <EmployeeProvisionModal role={role} onClose={()=>setShowEmployeeProvision(false)} onCreated={()=>setRefreshApprovalsCount(value=>value+1)} />}
      {selectedSearchRoom && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div role="dialog" aria-modal="true" aria-labelledby="manager-room-detail" className="w-full max-w-lg rounded-2xl bg-white p-6">
        <h2 id="manager-room-detail" className="text-lg font-bold">Chi tiết phòng {selectedSearchRoom.name}</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><dt>Loại phòng</dt><dd>{selectedSearchRoom.room_type_name}</dd><dt>Tầng</dt><dd>{selectedSearchRoom.floor}</dd><dt>Giá ngày</dt><dd>{fmtVND(selectedSearchRoom.daily_price)}</dd><dt>Trạng thái</dt><dd>{{available:"Sẵn sàng",occupied:"Có khách",reserved:"Đã giữ phòng",cleaning:"Đang dọn",maintenance:"Bảo trì",out_of_service:"Ngừng sử dụng"}[selectedSearchRoom.status]}</dd></dl>
        <p className="mt-4 text-sm text-slate-600">Sự cố chưa xử lý: {liveIncidents.filter(item=>item.room_id===selectedSearchRoom.id&&item.handoff_status!=="RESOLVED").length}. Phiếu kỹ thuật chưa hoàn tất: {liveTechnicalOrders.filter(item=>item.room_id===selectedSearchRoom.id&&!["COMPLETED","ROOM_RELEASED"].includes(item.status)).length}.</p>
        <button onClick={()=>setSelectedSearchRoom(null)} className="mt-5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Đóng</button>
      </div></div>}
      {resolveIncident && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><form role="dialog" aria-modal="true" aria-labelledby="resolve-incident-title" className="w-full max-w-lg rounded-2xl bg-white p-6" onSubmit={async event=>{
        event.preventDefault(); if(resolveSaving)return; setResolveSaving(true);setResolveError(null);
        try {await housekeepingTechnicalApi.handoffIncident(resolveIncident.id,{status:"RESOLVED",note:resolveNote.trim()});setResolveIncident(null);setRefreshApprovalsCount(value=>value+1);}
        catch(error){setResolveError(apiErrorMessage(error,"Không thể xác nhận sự cố đã xử lý."));}finally{setResolveSaving(false);}
      }}><h2 id="resolve-incident-title" className="text-lg font-bold">Xác nhận sự cố đã xử lý</h2><p className="my-3 text-sm text-slate-600">Phòng {resolveIncident.room_id}: {resolveIncident.equipment_name}. Phòng chỉ được mở sau khi hoàn tất checklist và quy trình nghiệm thu.</p><label className="block text-sm">Kết quả xử lý *<textarea required minLength={10} value={resolveNote} onChange={event=>setResolveNote(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3" /></label>{resolveError&&<p role="alert" className="mt-3 text-sm text-red-700">{resolveError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={resolveSaving} onClick={()=>setResolveIncident(null)} className="rounded-lg border px-4 py-2">Hủy</button><button disabled={resolveSaving} className="rounded-lg bg-green-700 px-4 py-2 text-white">{resolveSaving?"Đang lưu…":"Xác nhận đã xử lý"}</button></div></form></div>}
      {/* MODAL: NGHIỆM THU PHIẾU KỸ THUẬT */}
      {acceptModalOrder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#FFF", borderRadius: 16, width: "100%", maxWidth: 500, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>Nghiệm thu phiếu bảo trì kỹ thuật</h3>
                <p style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Phiếu #{acceptModalOrder.id} · Phòng {acceptModalOrder.room_id}</p>
              </div>
              <button onClick={() => setAcceptModalOrder(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: "#F8FAFC", borderRadius: 8, padding: 12, border: "1px solid #E2E8F0", marginBottom: 16, fontSize: 12, lineHeight: 1.6 }}>
              <p style={{ margin: 0, color: "#334155" }}><strong>Vật tư / Hạng mục:</strong> {acceptModalOrder.materials || "Bảo trì thiết bị"}</p>
              <p style={{ margin: "4px 0 0", color: "#334155" }}><strong>Kết quả kỹ thuật:</strong> {acceptModalOrder.result_note || "Chưa có báo cáo"}</p>
              <p style={{ margin: "4px 0 0", color: "#64748B" }}><strong>Kỹ thuật viên thực hiện:</strong> {acceptModalOrder.assignee || "Chưa phân công"}</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
                Ý kiến &amp; Đánh giá nghiệm thu <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <textarea
                value={acceptNoteInput}
                onChange={e => setAcceptNoteInput(e.target.value)}
                placeholder="Nhập nhận xét nghiệm thu (ví dụ: Đã kiểm tra thiết bị hoạt động tốt, đạt tiêu chuẩn phục vụ khách)..."
                rows={3}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
              {acceptModalError && (
                <p style={{ color: "#DC2626", fontSize: 12, marginTop: 6, fontWeight: 500 }}>{acceptModalError}</p>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setAcceptModalOrder(null)}
                disabled={isAccepting}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #CBD5E1", background: "#FFF", fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmAccept}
                disabled={isAccepting}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#16A34A", fontSize: 13, fontWeight: 700, color: "#FFF", cursor: isAccepting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                <Check size={15} />
                {isAccepting ? "Đang lưu..." : "Xác nhận nghiệm thu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ServicePriceReviewContext.Provider>
  );
}


type PriceApproval = { amount?: number | null; payload: string; target_id: string; requester: string; reason: string; expires_at?: string | null };

export function proposedPrice(approval: { amount?: number | null; payload: string }): number | null {
  let value: unknown = approval.amount;
  if (value === null || value === undefined) {
    try {
      const payload: unknown = JSON.parse(approval.payload);
      value = typeof payload === "object" && payload !== null ? (payload as { price?: unknown }).price : payload;
    } catch { return null; }
  }
  if (value === "" || value === null || value === undefined || typeof value === "boolean") return null;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

export function priceReviewDetails(approval: PriceApproval, services: Service[], employees: { employee_id: string; full_name: string }[]): string[] {
  const service = services.find(item => item.id === approval.target_id);
  const employee = employees.find(item => item.employee_id === approval.requester);
  const price = proposedPrice(approval);
  return [
    `${service?.name ?? approval.target_id} (${approval.target_id})`,
    `Giá hiện tại: ${service ? formatVnd(service.price) : "Chưa tải được"} · Giá đề xuất: ${price === null ? "Không hợp lệ" : formatVnd(price)}`,
    `Người đề nghị: ${employee?.full_name ?? approval.requester} (${approval.requester})`,
    `Lý do: ${approval.reason}`,
    `Hạn xử lý: ${approval.expires_at ? new Date(approval.expires_at).toLocaleString("vi-VN") : "Không giới hạn"}`,
  ];
}
