import { useEffect, useState, useMemo } from "react";
import { hrGovernanceApi } from "../shared/api/hrGovernance";
import { housekeepingTechnicalApi } from "../shared/api/housekeepingTechnical";
import { frontDeskApi } from "../shared/api/frontDesk";
import { kitchenAccountingApi } from "../shared/api/kitchenAccounting";
import { authApi } from "../shared/api/auth";
import { EmployeeProfileDropdown } from "../components/common/EmployeeProfileDropdown";
import type { Approval as ApiApproval, EmployeeAdmin } from "../shared/types/hrGovernance";
import type { EquipmentIncident, HousekeepingTask, Room as ApiRoom, TechnicalWorkOrder } from "../shared/types/housekeepingTechnical";
import type { Invoice as ApiInvoice } from "../shared/types/frontDesk";
import type { Expense } from "../shared/types/kitchenAccounting";
import {
  Home, Zap, LayoutGrid, Users, AlertTriangle, BarChart2,
  Search, Bell, ChevronDown, ArrowRight, Sun,
  Check, X, TrendingUp, ArrowUpRight, LogOut,
  ConciergeBell, Sparkles, UtensilsCrossed, Wrench,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════
   TYPES & DATA
══════════════════════════════════════════════════════════ */
type NavPage = "overview" | "approvals" | "operations" | "staff" | "incidents" | "reports";
type ApprovalStatus = "pending" | "approved" | "rejected";
type ManagerRole = "manager" | "director";

interface Approval {
  id: string; dept: string; deptColor: string; emoji: string;
  title: string; detail: string[]; time: string; badge: string; badgeColor: string;
  kind: "service-price" | "refund" | "technical-release" | "expense";
  rawWorkOrderId?: number;
}

const NOTIFICATIONS: never[] = [];

/* bar chart data */
const BAR_DATA: { day: string; rev: number; occ: number }[] = [];
const MAX_REV = 200;

/* donut data */
const DONUT: { label: string; pct: number; color: string }[] = [];

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
const fmtVND = (n: number) => `${n.toLocaleString("vi-VN")} đ`;
const roomTypeLabel = (type: string) => ({
  Standard:"Tiêu chuẩn", Deluxe:"Cao cấp", Suite:"Suite", "VIP Suite":"Suite VIP",
}[type] ?? type);

function donutPath(pct: number, prev: number, r: number) {
  const cx = 60, cy = 60;
  const startA = (prev / 100) * 2 * Math.PI - Math.PI / 2;
  const endA   = ((prev + pct) / 100) * 2 * Math.PI - Math.PI / 2;
  const x1 = cx + r * Math.cos(startA), y1 = cy + r * Math.sin(startA);
  const x2 = cx + r * Math.cos(endA),   y2 = cy + r * Math.sin(endA);
  const large = pct > 50 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

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
  role,
  approvalsData = [],
  rooms = [],
  invoices = [],
  incidents = [],
  techOrders = [],
  onDecision
}: {
  onNavApprovals: () => void;
  role: ManagerRole;
  approvalsData?: Approval[];
  rooms?: ApiRoom[];
  invoices?: ApiInvoice[];
  incidents?: EquipmentIncident[];
  techOrders?: TechnicalWorkOrder[];
  onDecision?: (id: string, action: ApprovalDecision) => Promise<boolean>;
}) {
  const [approvals, setApprovals] = useState<Record<string,ApprovalStatus>>({});
  const visibleApprovals = approvalsForRole(role, approvalsData);
  const occupiedRooms = rooms.filter(room => room.status === "occupied" || room.status === "reserved").length;
  const occupancy = rooms.length ? Math.round((occupiedRooms / rooms.length) * 100) : 0;
  const paidInvoices = invoices.filter(invoice => invoice.status === "DA_THANH_TOAN");
  const revenue = paidInvoices.reduce((sum, invoice) => sum + (invoice.payable || invoice.room_total + invoice.service_total), 0);
  const adr = paidInvoices.length ? Math.round(revenue / paidInvoices.length) : 0;
  const revpar = rooms.length ? Math.round(revenue / rooms.length) : 0;
  const barData = [...new Set(invoices.map(invoice => invoice.issued_at.slice(0, 10)))].slice(-7).map((day, index, days) => ({
    day: new Date(`${day}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
    rev: invoices.filter(invoice => invoice.issued_at.startsWith(day)).reduce((sum, invoice) => sum + (invoice.payable || invoice.room_total + invoice.service_total), 0) / 1_000_000,
    occ: rooms.length ? Math.round((occupiedRooms / rooms.length) * 100) : 0,
    today: index === days.length - 1,
  }));
  const maxRev = Math.max(...barData.map(item => item.rev), 1);
  const liveNotifications = [
    ...incidents.map(item => ({ id: `incident-${item.id}`, icon: "🔴", msg: `Phòng ${item.room_id}: ${item.equipment_name}`, time: item.handoff_status })),
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
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20 }}>
        {[
          { label:"Công suất phòng (Occupancy)",  val:`${occupancy}%`,    sub:`${occupiedRooms} / ${rooms.length} phòng`, note:"Theo trạng thái phòng hiện tại", up:false,  color:"#3B82F6", prog:occupancy },
          { label:"Giá bán bình quân (ADR)",      val:fmtVND(adr),sub:null,            note:"Theo hóa đơn đã thanh toán",  up:false,  color:"#10B981", prog:null },
          { label:"Doanh thu trên mỗi phòng (RevPAR)",val:fmtVND(revpar),sub:null,        note:"Theo dữ liệu hóa đơn hiện có", up:false,  color:"#8B5CF6", prog:null },
          { label:"Doanh thu dự kiến hôm nay",    val:fmtVND(revenue),sub:null,          note:"Theo hóa đơn đã thanh toán", up:false,  color:"#F59E0B", prog:null },
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
            {k.prog === null && (
              /* mini sparkline placeholder */
              <svg width="80" height="24" style={{ display:"block",marginBottom:4 }}>
                <polyline points="0,18 16,14 32,15 48,10 64,8 80,4"
                  fill="none" stroke={k.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <div style={{ display:"flex",alignItems:"center",gap:3 }}>
              <ArrowUpRight size={11} style={{ color:"#16A34A" }} />
              <span style={{ fontSize:11,fontWeight:600,color:"#16A34A" }}>{k.note}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Middle row */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16 }}>

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
                      {a.detail.map((d,i) => (
                        <p key={i} style={{ fontSize:11,color:"#64748B",lineHeight:1.4 }}>{d}</p>
                      ))}
                    </div>
                    {/* Actions */}
                    {!st ? (
                      <div style={{ display:"flex",flexDirection:"column",gap:5,flexShrink:0 }}>
                        <button onClick={() => handle(a.id,"approved")}
                          style={{ display:"flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:7,
                            border:"none",background:"#16A34A",color:"#FFF",fontSize:11,fontWeight:700,cursor:"pointer" }}>
                          <Check size={11} /> Phê duyệt
                        </button>
                        <button onClick={() => handle(a.id,"rejected")}
                          style={{ display:"flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:7,
                            border:"1px solid #E2E8F0",background:"#FFF",color:"#64748B",fontSize:11,fontWeight:600,cursor:"pointer" }}>
                          <X size={11} /> Từ chối
                        </button>
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
            <button style={{ fontSize:11,fontWeight:600,color:"#2563EB",cursor:"pointer",
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
                  status:"Hoạt động bình thường",statusOk:true,
                  stats:[
                    { val:"Theo dõi",label:"Kho đồ uống & Thực phẩm" },
                    { val:"0",label:"Đề xuất điều chỉnh giá" },
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
      <div style={{ display:"grid",gridTemplateColumns:"1fr 240px 240px",gap:16 }}>

        {/* BAR CHART */}
        <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",padding:"16px 20px" }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
            <p style={{ fontSize:13,fontWeight:700,color:"#0F172A" }}>Biểu đồ doanh thu 7 ngày qua</p>
            <div style={{ display:"flex",gap:12 }}>
              <div style={{ display:"flex",alignItems:"center",gap:5 }}>
                <div style={{ width:12,height:12,borderRadius:3,background:"#3B82F6" }} />
                <span style={{ fontSize:11,color:"#64748B" }}>Doanh thu (VND)</span>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:5 }}>
                <div style={{ width:12,height:3,borderRadius:99,background:"#6366F1" }} />
                <span style={{ fontSize:11,color:"#64748B" }}>Công suất phòng (%)</span>
              </div>
            </div>
          </div>
          <div style={{ position:"relative",height:160 }}>
            {/* Y-axis labels */}
            <div style={{ position:"absolute",left:0,top:0,bottom:24,width:40,
              display:"flex",flexDirection:"column",justifyContent:"space-between" }}>
              {["200M","150M","100M","50M","0"].map(l => (
                <span key={l} style={{ fontSize:9,color:"#94A3B8",textAlign:"right",display:"block" }}>{l}</span>
              ))}
            </div>
            {/* Right Y-axis */}
            <div style={{ position:"absolute",right:0,top:0,bottom:24,width:36,
              display:"flex",flexDirection:"column",justifyContent:"space-between" }}>
              {["100%","75%","50%","25%","0%"].map(l => (
                <span key={l} style={{ fontSize:9,color:"#94A3B8",textAlign:"left",display:"block" }}>{l}</span>
              ))}
            </div>
            {/* SVG Chart */}
            <svg width="100%" height="136" style={{ position:"absolute",left:44,top:0,right:40,width:"calc(100% - 84px)" }}
              viewBox="0 0 420 136" preserveAspectRatio="none">
              {/* Grid lines */}
              {[0,34,68,102,136].map(y => (
                <line key={y} x1="0" y1={y} x2="420" y2={y} stroke="#F1F5F9" strokeWidth="1" />
              ))}
              {/* Bars */}
              {barData.map((d, i) => {
                const barW = 42, gap = 18;
                const x = i * (barW + gap) + 4;
                const h = (d.rev / maxRev) * 128;
                const y = 128 - h;
                return (
                  <rect key={i} x={x} y={y} width={barW} height={h}
                    fill={d.today?"#3B82F6":"#BFDBFE"} rx="3" />
                );
              })}
              {/* Occupancy line */}
              <polyline
                points={barData.map((d,i) => {
                  const barW=42,gap=18,x=i*(barW+gap)+4+barW/2;
                  const y = 128 - (d.occ/100)*128;
                  return `${x},${y}`;
                }).join(" ")}
                fill="none" stroke="#6366F1" strokeWidth="2"
                strokeDasharray="4 2" strokeLinecap="round" strokeLinejoin="round" />
              {barData.map((d,i) => {
                const barW=42,gap=18,x=i*(barW+gap)+4+barW/2;
                const y=128-(d.occ/100)*128;
                return <circle key={i} cx={x} cy={y} r="3" fill="#6366F1" />;
              })}
            </svg>
            {/* X-axis labels */}
            <div style={{ position:"absolute",bottom:0,left:44,right:40,
              display:"flex",justifyContent:"space-around" }}>
              {barData.map(d => (
                <span key={d.day} style={{ fontSize:9,color:"#94A3B8",textAlign:"center" }}>{d.day}</span>
              ))}
            </div>
          </div>
        </div>

        {/* DONUT CHART */}
        <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",padding:"14px 16px" }}>
          <p style={{ fontSize:12,fontWeight:700,color:"#0F172A",marginBottom:2 }}>Cơ cấu nguồn khách đặt phòng</p>
          <div style={{ position:"relative",margin:"8px auto 8px",width:120,height:120 }}>
            <svg viewBox="0 0 120 120" width="120" height="120">
              {(() => {
                let prev = 0;
                return DONUT.map(d => {
                  const path = donutPath(d.pct, prev, 48);
                  prev += d.pct;
                  return <path key={d.label} d={path} fill={d.color} stroke="#FFF" strokeWidth="1.5" />;
                });
              })()}
              <circle cx="60" cy="60" r="30" fill="#FFF" />
              <text x="60" y="56" textAnchor="middle" fontSize="9" fill="#64748B">Tổng đặt phòng</text>
              <text x="60" y="68" textAnchor="middle" fontSize="14" fontWeight="800" fill="#0F172A">240</text>
            </svg>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
            {DONUT.map(d => (
              <div key={d.label} style={{ display:"flex",alignItems:"center",gap:6 }}>
                <span style={{ width:8,height:8,borderRadius:2,flexShrink:0,background:d.color }} />
                <span style={{ fontSize:10,color:"#334155",flex:1,lineHeight:1.3 }}>{d.label}</span>
                <span style={{ fontSize:11,fontWeight:700,color:"#0F172A",fontFamily:"'JetBrains Mono',monospace" }}>{d.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* NOTIFICATIONS */}
        <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden" }}>
          <div style={{ padding:"12px 14px",borderBottom:"1px solid #F1F5F9",
            display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <p style={{ fontSize:12,fontWeight:700,color:"#0F172A" }}>Thông báo &amp; Cảnh báo</p>
            <button style={{ fontSize:10,fontWeight:600,color:"#2563EB",cursor:"pointer",
              display:"flex",alignItems:"center",gap:2 }}>Xem tất cả <ArrowRight size={10} /></button>
          </div>
          <div>
            {liveNotifications.map((n,i) => (
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
function ApprovalsScreen({ role, approvalsData = [], onDecision }: { role: ManagerRole; approvalsData?: Approval[]; onDecision?: (id: string, action: ApprovalDecision) => Promise<boolean> }) {
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
                {a.detail.map((d,i) => <p key={i} style={{ fontSize:12,color:"#64748B",lineHeight:1.5 }}>{d}</p>)}
              </div>
              {!st ? (
                <div style={{ display:"flex",gap:8,flexShrink:0,alignItems:"center" }}>
                  <button onClick={() => handle(a.id,"approved")}
                    style={{ display:"flex",alignItems:"center",gap:5,padding:"8px 16px",borderRadius:8,
                      border:"none",background:"#16A34A",color:"#FFF",fontSize:12,fontWeight:700,cursor:"pointer" }}>
                    <Check size={13} /> Phê duyệt
                  </button>
                  <button onClick={() => handle(a.id,"rejected")}
                    style={{ display:"flex",alignItems:"center",gap:5,padding:"8px 16px",borderRadius:8,
                      border:"1px solid #E2E8F0",background:"#FFF",color:"#475569",fontSize:12,fontWeight:600,cursor:"pointer" }}>
                    <X size={13} /> Từ chối
                  </button>
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
function ReportsScreen({ invoices = [], rooms = [], expenses = [] }: { invoices?: ApiInvoice[]; rooms?: ApiRoom[]; expenses?: Expense[] }) {
  const paidInvoices = invoices.filter(invoice => invoice.status === "DA_THANH_TOAN");
  const revenue = paidInvoices.reduce((sum, invoice) => sum + (invoice.payable || invoice.room_total + invoice.service_total), 0);
  const occupied = rooms.filter(room => room.status === "occupied").length;
  const kpis = [
    { label:"Tổng doanh thu đang ghi nhận", val:fmtVND(revenue), up:"—", color:"#16A34A" },
    { label:"Công suất phòng hiện tại", val:`${rooms.length ? Math.round((occupied / rooms.length) * 100) : 0}%`, up:"—", color:"#2563EB" },
    { label:"Hóa đơn đã thanh toán", val:`${paidInvoices.length} hóa đơn`, up:"—", color:"#7C3AED" },
    { label:"Chi phí vận hành", val:fmtVND(expenses.reduce((sum, expense) => sum + expense.amount, 0)), up:`${expenses.length} khoản ghi nhận`, color:"#F59E0B" },
  ];
  const departmentRows = [{ dept:"Phòng & dịch vụ", rev:fmtVND(revenue), pct:revenue > 0 ? "100%" : "0%", growth:"—", ok:true }];
  return (
    <div style={{ flex:1,overflowY:"auto",padding:"20px 24px" }}>
      <div style={{ marginBottom:16 }}>
        <h2 style={{ fontSize:20,fontWeight:800,color:"#0F172A",marginBottom:2 }}>Báo cáo điều hành</h2>
        <p style={{ fontSize:12,color:"#94A3B8" }}>{`Tổng hợp hiệu quả kinh doanh – Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`}</p>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",padding:"16px 18px" }}>
            <p style={{ fontSize:11,color:"#64748B",marginBottom:6 }}>{k.label}</p>
            <p style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:18,fontWeight:800,color:"#0F172A",marginBottom:4 }}>{k.val}</p>
            <div style={{ display:"flex",alignItems:"center",gap:4 }}>
              <TrendingUp size={11} style={{ color:k.color }} />
              <span style={{ fontSize:11,fontWeight:700,color:k.color }}>{k.up} vs tháng 8</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden" }}>
        <div style={{ padding:"14px 18px",borderBottom:"1px solid #F1F5F9" }}>
          <p style={{ fontSize:13,fontWeight:700,color:"#0F172A" }}>{`Doanh thu theo bộ phận – Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`}</p>
        </div>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#F8FAFC" }}>
              {["Bộ phận","Doanh thu","% Tổng","Tăng trưởng","Trạng thái"].map(h => (
                <th key={h} style={{ padding:"10px 16px",fontSize:11,fontWeight:700,color:"#64748B",
                  textAlign:"left",letterSpacing:"0.04em",textTransform:"uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {departmentRows.map((r,i) => (
              <tr key={r.dept} style={{ borderTop:"1px solid #F1F5F9",background:i%2===0?"#FFF":"#FAFAFA" }}>
                <td style={{ padding:"11px 16px",fontSize:13,fontWeight:600,color:"#0F172A" }}>{r.dept}</td>
                <td style={{ padding:"11px 16px",fontSize:12,fontWeight:700,color:"#0F172A",fontFamily:"'JetBrains Mono',monospace" }}>{r.rev}</td>
                <td style={{ padding:"11px 16px" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                    <div style={{ flex:1,maxWidth:80,height:6,background:"#E2E8F0",borderRadius:99,overflow:"hidden" }}>
                      <div style={{ height:"100%",width:r.pct,background:"#3B82F6",borderRadius:99 }} />
                    </div>
                    <span style={{ fontSize:12,color:"#475569" }}>{r.pct}</span>
                  </div>
                </td>
                <td style={{ padding:"11px 16px" }}>
                  <span style={{ fontSize:12,fontWeight:700,color:r.ok?"#16A34A":"#DC2626" }}>{r.growth}</span>
                </td>
                <td style={{ padding:"11px 16px" }}>
                  <span style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,
                    background:r.ok?"#DCFCE7":"#FFE4E6",color:r.ok?"#166534":"#BE123C" }}>
                    {r.ok?"▲ Tăng trưởng":"▼ Giảm"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OperationsScreen({ rooms }: { rooms: ApiRoom[] }) {
  const actionRooms = rooms.filter(room => room.status === "cleaning" || room.status === "maintenance");
  const [released, setReleased] = useState<string[]>([]);
  return (
    <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(150px,1fr))",gap:12,marginBottom:16}}>
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
          <p style={{fontSize:11,color:"#64748B",marginTop:2}}>Quản lý kiểm tra thực tế trước khi chuyển phòng về trạng thái sẵn sàng.</p>
        </div>
        {actionRooms.map(room=>{
          const done = released.includes(room.id);
          return <div key={room.id} style={{display:"grid",gridTemplateColumns:"80px 1.2fr 1fr 190px",gap:12,alignItems:"center",padding:"12px 16px",borderBottom:"1px solid #F1F5F9"}}>
            <strong style={{fontSize:15}}>P.{room.name}</strong>
            <span style={{fontSize:12,color:"#475569"}}>{roomTypeLabel(room.room_type_name)} · Tầng {room.floor}</span>
            <span style={{fontSize:11,fontWeight:600,color:room.status==="maintenance"?"#DC2626":"#D97706"}}>{room.status==="maintenance"?"Kỹ thuật báo hoàn thành":"Buồng phòng báo đã dọn"}</span>
            <button disabled={done} onClick={()=>setReleased(items=>[...items,room.id])} style={{height:32,borderRadius:8,border:"none",background:done?"#DCFCE7":"#0F172A",color:done?"#166534":"#FFF",fontSize:11,fontWeight:700,cursor:done?"default":"pointer"}}>
              {done?"Đã nghiệm thu & mở phòng":"Nghiệm thu & mở phòng"}
            </button>
          </div>;
        })}
      </div>
    </div>
  );
}

function StaffOperationsScreen({ employees, tasks }: { employees: EmployeeAdmin[]; tasks: HousekeepingTask[] }) {
  return (
    <div style={{flex:1,overflowY:"auto",padding:"20px 24px",display:"grid",gridTemplateColumns:"1.2fr .8fr",gap:16}}>
      <div style={{background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"14px 16px",borderBottom:"1px solid #E2E8F0"}}><strong>Nhân sự trong ca</strong></div>
        {employees.map(person=><div key={person.employee_id} style={{display:"grid",gridTemplateColumns:"1fr 130px 100px",gap:10,padding:"12px 16px",borderBottom:"1px solid #F1F5F9",alignItems:"center"}}>
          <div><p style={{fontSize:12,fontWeight:700}}>{person.full_name}</p><p style={{fontSize:10,color:"#94A3B8"}}>{person.role} · {person.employee_id}</p></div>
          <span style={{fontSize:11,color:"#475569"}}>{person.employment_status}</span>
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

function IncidentsScreen({ incidents }: { incidents: EquipmentIncident[] }) {
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [saving, setSaving] = useState<string[]>([]);
  const acknowledge = async (item: EquipmentIncident) => {
    const key = String(item.id);
    setSaving(ids => [...ids, key]);
    try {
      await housekeepingTechnicalApi.handoffIncident(item.id, { status: "ACKNOWLEDGED", note: "Đã tiếp nhận từ màn hình Ban điều hành." });
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
            <div style={{flex:1}}><p style={{fontSize:13,fontWeight:700}}>{item.equipment_name} · Phòng {item.room_id}</p><p style={{fontSize:11,color:"#94A3B8",marginTop:2}}>{item.handoff_note || item.handoff_status}</p></div>
            <button disabled={done || saving.includes(key)} onClick={()=>void acknowledge(item)} style={{padding:"7px 12px",borderRadius:8,border:"1px solid #E2E8F0",background:done?"#DCFCE7":"#FFF",color:done?"#166534":"#334155",fontSize:11,fontWeight:700,cursor:done?"default":"pointer"}}>{done?"Đã tiếp nhận":saving.includes(key)?"Đang lưu...":"Xác nhận tiếp nhận"}</button>
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
  const [page, setPage] = useState<NavPage>("overview");
  const [liveApprovals, setLiveApprovals] = useState<Approval[]>([]);
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
          setProfileError(err instanceof Error ? err.message : "Không thể tải hồ sơ quản lý.");
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
            detail = Object.entries(payload).slice(0, 2).map(([key, item]) => `${key}: ${String(item)}`);
          } catch { /* reason remains the visible fallback */ }
          return {
            id: String(approval.id), dept: approval.action, deptColor: "#3B82F6", emoji: "✓",
            title: approval.action, detail: detail.length > 0 ? detail : [approval.reason],
            time: approval.requested_at, badge: approval.risk, badgeColor: approval.risk === "HIGH" ? "#DC2626" : "#F59E0B",
            kind: approval.action === "SERVICE_PRICE_CHANGE" ? "service-price" : approval.action.toLowerCase().includes("refund") ? "refund" : approval.action.toLowerCase().includes("technical") ? "technical-release" : "expense",
          };
        }));
      })
      .catch(err => { console.warn("Backend approval queue unavailable:", err); if (active) setLiveApprovals([]); });

    // Load operational state
    Promise.all([
      housekeepingTechnicalApi.rooms(),
      hrGovernanceApi.employees(true),
      housekeepingTechnicalApi.tasks(),
      housekeepingTechnicalApi.incidents(),
      frontDeskApi.invoices({ page: 0, size: 100 }),
      housekeepingTechnicalApi.workOrders(),
    ])
      .then(([rooms, employees, tasks, incidents, invoices, workOrders]) => {
        if (!active) return;
        setLiveRooms(rooms);
        setLiveEmployees(employees);
        setLiveTasks(tasks);
        setLiveIncidents(incidents);
        setLiveInvoices(invoices.items);
        setLiveTechnicalOrders(workOrders);
      })
      .catch(err => {
        console.warn("Backend manager operations snapshot unavailable:", err);
        if (active) {
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

    return () => { active = false; };
  }, [role]);

  // Combine live WAITING_ACCEPTANCE technical work orders into approvals
  const technicalApprovals: Approval[] = useMemo(() => {
    return liveTechnicalOrders
      .filter(order => order.status === "WAITING_ACCEPTANCE")
      .map(order => ({
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
        rawWorkOrderId: order.id,
      }));
  }, [liveTechnicalOrders]);

  const allApprovals = useMemo(() => {
    return [...liveApprovals, ...technicalApprovals];
  }, [liveApprovals, technicalApprovals]);

  const pendingCount = approvalsForRole(role, allApprovals).length;

  const handleApprovalDecision = async (id: string, action: ApprovalDecision) => {
    if (id.startsWith("tech-")) {
      const orderId = Number(id.replace("tech-", ""));
      const targetOrder = liveTechnicalOrders.find(o => o.id === orderId);
      if (action === "approved") {
        if (targetOrder) {
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
      if (action === "approved") await hrGovernanceApi.approve(numericId);
      else await hrGovernanceApi.reject(numericId);
      setLiveApprovals(previous => previous.filter(item => item.id !== id));
      return true;
    } catch (err) {
      console.warn("Unable to persist manager approval decision:", err);
      return false;
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
      setAcceptModalError(err instanceof Error ? err.message : "Không thể nghiệm thu phiếu kỹ thuật.");
    } finally {
      setIsAccepting(false);
    }
  };

  const managerName = profileLoading ? "Đang tải..." : profileError ? (role === "director" ? "Giám đốc Khách sạn" : "Quản lý Khách sạn") : currentManager?.name || (role === "director" ? "Giám đốc Khách sạn" : "Quản lý Khách sạn");
  const managerDeptTitle = role === "director" ? "Ban giám đốc" : "Tổng quản lý";
  const managerInitials = profileLoading ? "..." : profileError ? (role === "director" ? "GĐ" : "QL") : currentManager?.initials || (role === "director" ? "GĐ" : "QL");

  return (
    <div style={{ display:"flex",height:"100vh",overflow:"hidden",
      background:"#F8FAFC",fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* SIDEBAR */}
      <aside style={{ width:200,background:"#FFF",borderRight:"1px solid #E2E8F0",
        display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden" }}>
        {/* Brand */}
        <div style={{ padding:"14px 14px 12px",borderBottom:"1px solid #E2E8F0" }}>
          <div style={{ display:"flex",alignItems:"center",gap:9 }}>
            <img
              src="/hotel_logo.png"
              alt="MAM Hotel Logo"
              style={{ width:36,height:"auto",objectFit:"contain",flexShrink:0,filter:"drop-shadow(0 2px 6px rgba(184,148,74,0.35))" }}
            />
            <div>
              <p style={{ fontSize:13,fontWeight:700,color:"#0F172A",lineHeight:1.1,fontFamily:"'Cormorant Garamond',Georgia,serif",letterSpacing:"0.05em" }}>MAM HOTEL</p>
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
            <input placeholder="Tìm kiếm phòng, đặt phòng, khách, phiếu công việc..."
              style={{ width:"100%",height:34,paddingLeft:32,paddingRight:42,borderRadius:8,
                border:"1px solid #E2E8F0",background:"#F8FAFC",fontSize:12,outline:"none",boxSizing:"border-box" }} />
            <span style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
              fontSize:10,color:"#CBD5E1",fontFamily:"'JetBrains Mono',monospace",
              background:"#F1F5F9",padding:"1px 5px",borderRadius:4,border:"1px solid #E2E8F0" }}>⌘ K</span>
          </div>

          {/* Date */}
          <div style={{ display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:8,
            border:"1px solid #E2E8F0",background:"#F8FAFC",cursor:"pointer" }}>
            <CalendarDays size={12} style={{ color:"#64748B" }} />
            <span style={{ fontSize:12,color:"#334155",whiteSpace:"nowrap" }}>{new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "short", day: "numeric" })}</span>
            <ChevronDown size={11} style={{ color:"#94A3B8" }} />
          </div>

          <div style={{ flex:1 }} />

          {/* Weather */}
          <div style={{ display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:8,
            background:"#FFF7ED",border:"1px solid #FED7AA" }}>
            <Sun size={14} style={{ color:"#F59E0B" }} />
            <div>
              <p style={{ fontSize:11,fontWeight:700,color:"#92400E",lineHeight:1 }}>32°C</p>
              <p style={{ fontSize:9,color:"#94A3B8" }}>TP. Hồ Chí Minh</p>
            </div>
          </div>

          {/* Bell */}
          <button style={{ width:34,height:34,borderRadius:8,background:"#F8FAFC",border:"1px solid #E2E8F0",
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
          </h1>
          <p style={{ fontSize:13,color:"#64748B" }}>
            {page==="overview"  && `Chào mừng trở lại, ${role === "director" ? "Giám đốc" : "Quản lý"}! Đây là tình hình hoạt động của khách sạn hôm nay.`}
            {page==="approvals" && "Các yêu cầu phê duyệt từ tất cả bộ phận – hôm nay."}
            {page==="operations"&& "Tình trạng phòng và vận hành theo thời gian thực."}
            {page==="staff"     && "Quản lý nhân viên, lịch phân ca và hiệu suất."}
            {page==="incidents" && "Theo dõi sự cố và cảnh báo khẩn cấp."}
            {page==="reports"   && `Báo cáo tổng hợp kinh doanh tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}.`}
          </p>
        </div>

        {/* CONTENT */}
        <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
          {page==="overview"   && <OverviewScreen role={role} approvalsData={allApprovals} rooms={liveRooms} invoices={liveInvoices} incidents={liveIncidents} techOrders={liveTechnicalOrders} onDecision={handleApprovalDecision} onNavApprovals={() => setPage("approvals")} />}
          {page==="approvals"  && <ApprovalsScreen role={role} approvalsData={allApprovals} onDecision={handleApprovalDecision} />}
          {page==="reports"    && <ReportsScreen invoices={liveInvoices} rooms={liveRooms} expenses={liveExpenses} />}
          {page==="operations" && <OperationsScreen rooms={liveRooms} />}
          {page==="staff"      && <StaffOperationsScreen employees={liveEmployees} tasks={liveTasks} />}
          {page==="incidents"  && <IncidentsScreen incidents={liveIncidents} />}
        </div>
      </div>

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
  );
}

/* Calendar icon (used in header date) */
function CalendarDays({ size, style }: { size: number; style?: React.CSSProperties }) {
  return <CalendarDaysIcon size={size} style={style} />;
}
function CalendarDaysIcon({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
