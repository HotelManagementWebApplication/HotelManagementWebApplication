import { useEffect, useState, useMemo } from "react";
import { housekeepingTechnicalApi } from "../../shared/api/housekeepingTechnical";
import { enterpriseApi } from "../../shared/api/enterprise";
import { authApi } from "../../shared/api/auth";
import { apiErrorMessage } from "../../shared/api/client";
import type { EquipmentIncident, HousekeepingTask, Room as ApiRoom } from "../../shared/types/housekeepingTechnical";
import { employeeRoleLabel } from "../../shared/types/api";
import type { EmployeeProfileDto } from "../../shared/types/api";
import { EmployeeProfileDropdown } from "../../shared/components/EmployeeProfileDropdown";
import {
  Home, LayoutGrid, ClipboardList, Package, Wrench,
  Search, Bell, ChevronDown, X, Clock, AlertTriangle,
  CheckCircle2, Minus, Plus, User, Users, BedDouble,
  Sparkles, LogOut, Filter, BarChart2, ArrowUpRight,
  CheckSquare, Square, MoreHorizontal, Zap, RefreshCcw,
  ShieldAlert, TrendingUp, Calendar, Inbox, Archive, Send
} from "lucide-react";

/* ══════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════ */
export type HKStatus  = "to-clean" | "in-progress" | "inspecting" | "ready";
export type SubType   = "checkout-dirty" | "stayover" | "vip-arrival" | "maintenance";
export type NavPage   = "overview" | "board" | "inspection" | "linen" | "incidents";
export type ShiftName = "Sáng" | "Chiều" | "Tối";
export type Priority  = "high" | "medium" | "low";
export type IncStatus = "open" | "in-progress" | "resolved";

export interface Staff {
  id: string; name: string; shortName: string;
  shift: ShiftName; color: string; rooms: number; done: number;
}
export interface CheckItem { id: string; label: string; done: boolean; }
export interface MinibarItem { item: string; unit: string; count: number; }
export interface HKRoom {
  id: string; number: string; floor: number; type: string;
  status: HKStatus; subType: SubType; isVip?: boolean;
  staffId?: string; estMin?: number; doneMin?: number;
  taskId?: number;
  checklist: CheckItem[]; minibar: MinibarItem[];
  notes?: string;
}
export interface Incident {
  id: string; room: string; type: string; desc: string;
  priority: Priority; status: IncStatus;
  reportedBy: string; reportedAt: string; assignedTo?: string;
}

export type LinenRow = { id:string; item:string; unit:string; stock:number; min:number; max:number; category:string };

const roomTypeLabel = (type: string) => ({
  Standard: "Tiêu chuẩn", Deluxe: "Cao cấp", Suite: "Suite", "VIP Suite": "Suite VIP",
  "Deluxe giường King": "Deluxe giường King", "Superior hai giường": "Superior hai giường",
}[type] ?? type);

/* ══════════════════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════════════════ */
const STATUS_CFG = {
  "to-clean":   { label:"Cần dọn",       dot:"#F59E0B", bg:"#FEF9C3", text:"#92400E" },
  "in-progress":{ label:"Đang vệ sinh",  dot:"#3B82F6", bg:"#DBEAFE", text:"#1D4ED8" },
  "inspecting": { label:"Đang kiểm tra", dot:"#8B5CF6", bg:"#EDE9FE", text:"#6D28D9" },
  "ready":      { label:"Sẵn sàng",      dot:"#16A34A", bg:"#DCFCE7", text:"#166534" },
};
const SUB_CFG = {
  "checkout-dirty":{ label:"Phòng trả khách cần dọn", bg:"#FEF3C7", text:"#92400E" },
  "stayover":      { label:"Khách đang ở",        bg:"#F1F5F9", text:"#475569" },
  "vip-arrival":   { label:"Khách VIP sắp đến",     bg:"#DCFCE7", text:"#166534" },
  "maintenance":   { label:"Bảo trì",         bg:"#FFE4E6", text:"#BE123C" },
};
const PRI_CFG = {
  high:  { label:"Cao",    bg:"#FFE4E6",text:"#BE123C",dot:"#F43F5E" },
  medium:{ label:"Trung bình",bg:"#FEF9C3",text:"#92400E",dot:"#F59E0B" },
  low:   { label:"Thấp",   bg:"#F0FDF4",text:"#166534",dot:"#22C55E" },
};
const INC_STATUS_CFG = {
  open:       { label:"Mới",         bg:"#FFE4E6",text:"#BE123C" },
  "in-progress":{ label:"Đang xử lý",bg:"#DBEAFE",text:"#1D4ED8" },
  resolved:   { label:"Hoàn thành",  bg:"#DCFCE7",text:"#166534" },
};

/* ══════════════════════════════════════════════════════════
   ROOM CARD (Kanban)
══════════════════════════════════════════════════════════ */
function HKRoomCard({ room, onClick, staffInfo }: { room: HKRoom; onClick: () => void; staffInfo?: { name: string; shortName: string; color: string } }) {
  const [hov, setHov] = useState(false);
  const done      = room.checklist.filter(c => c.done).length;
  const total     = room.checklist.length;
  const subCfg    = SUB_CFG[room.subType] ?? SUB_CFG["checkout-dirty"];
  const stCfg     = STATUS_CFG[room.status] ?? STATUS_CFG["to-clean"];

  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background:"#FFF",borderRadius:10,padding:"12px 14px",cursor:"pointer",
        border:`1px solid ${hov?"#CBD5E1":"#E2E8F0"}`,
        boxShadow:hov?"0 3px 10px rgba(0,0,0,.08)":"0 1px 3px rgba(0,0,0,.04)",
        transition:"box-shadow .12s,border-color .12s" }}>
      {/* Header */}
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8 }}>
        <div>
          <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:2 }}>
            <span style={{ fontSize:18,fontWeight:800,color:"#0F172A" }}>{room.number}</span>
            {room.isVip && (
              <span style={{ fontSize:10,fontWeight:700,background:"#FEF9C3",color:"#92400E",
                padding:"1px 6px",borderRadius:4 }}>VIP</span>
            )}
          </div>
          <p style={{ fontSize:11,color:"#64748B" }}>{roomTypeLabel(room.type)}</p>
        </div>
        {staffInfo ? (
          <div style={{ width:28,height:28,borderRadius:99,flexShrink:0,
            background:staffInfo.color,display:"flex",alignItems:"center",
            justifyContent:"center",fontSize:10,fontWeight:700,color:"#FFF" }}
            title={staffInfo.name}>
            {staffInfo.shortName.charAt(0)}
          </div>
        ) : (
          <button onClick={e=>e.stopPropagation()} style={{ color:"#CBD5E1",cursor:"pointer",background:"transparent",border:"none" }}>
            <MoreHorizontal size={14} />
          </button>
        )}
      </div>

      {/* Sub-type badge */}
      <span style={{ display:"inline-flex",alignItems:"center",fontSize:11,fontWeight:600,
        padding:"2px 8px",borderRadius:99,background:subCfg.bg,color:subCfg.text,marginBottom:10 }}>
        {subCfg.label}
      </span>

      {/* Progress if in-progress or inspecting */}
      {(room.status === "in-progress" || room.status === "inspecting") && total > 0 && (
        <div style={{ marginBottom:8 }}>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:3 }}>
            <span style={{ fontSize:11,color:"#64748B" }}>{done}/{total} hạng mục</span>
          </div>
          <div style={{ height:4,background:"#E2E8F0",borderRadius:99,overflow:"hidden" }}>
            <div style={{ height:"100%",background:"#3B82F6",
              width:`${(done/total)*100}%`,borderRadius:99,transition:"width .3s" }} />
          </div>
        </div>
      )}

      {/* Task info rows */}
      <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
        {room.status === "to-clean" && (
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <BedDouble size={11} style={{ color:"#94A3B8",flexShrink:0 }} />
            <span style={{ fontSize:11,color:"#64748B" }}>
              {room.subType === "checkout-dirty" ? "Cần thay ga" : "Thay khăn tắm"}
            </span>
          </div>
        )}
        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
          <Sparkles size={11} style={{ color:"#94A3B8",flexShrink:0 }} />
          <span style={{ fontSize:11,color:"#64748B" }}>
            Minibar:{" "}
            {room.status === "in-progress"
              ? (done >= 2 ? "Đã kiểm tra" : "Đang kiểm tra")
              : room.status === "to-clean" ? "Chưa kiểm tra"
              : "Đạt"}
          </span>
        </div>
        {(room.estMin && (room.status === "to-clean" || room.status === "in-progress")) && (
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <Clock size={11} style={{ color:"#94A3B8",flexShrink:0 }} />
            <span style={{ fontSize:11,color:"#64748B" }}>
              {room.status === "in-progress" ? `~${room.estMin} phút nữa` : `${room.estMin} phút`}
            </span>
          </div>
        )}
        {room.doneMin !== undefined && room.status !== "in-progress" && (
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <Clock size={11} style={{ color:"#16A34A",flexShrink:0 }} />
            <span style={{ fontSize:11,color:"#16A34A" }}>
              Trước {room.doneMin} phút
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ROOM DETAIL MODAL
══════════════════════════════════════════════════════════ */
function RoomModal({
  room: initRoom,
  onClose,
  onStartClean,
  onComplete,
  onReportIncident,
  staffInfo,
  currentUser,
}: {
  room: HKRoom;
  onClose: () => void;
  onStartClean?: (room: HKRoom) => void;
  onComplete?: (room: HKRoom) => void;
  onReportIncident?: (roomNumber: string) => void;
  staffInfo?: { name: string; shortName: string; color: string };
  currentUser?: EmployeeProfileDto | null;
}) {
  const [room, setRoom] = useState(initRoom);
  const done   = room.checklist.filter(c => c.done).length;
  const total  = room.checklist.length;
  const stCfg  = STATUS_CFG[room.status] ?? STATUS_CFG["to-clean"];

  const toggleCheck = (id: string) =>
    setRoom(r => ({ ...r, checklist: r.checklist.map(c => c.id===id?{...c,done:!c.done}:c) }));

  const adjustMinibar = (i: number, delta: number) =>
    setRoom(r => {
      const mb = [...r.minibar];
      mb[i] = { ...mb[i], count: Math.max(0, mb[i].count + delta) };
      return { ...r, minibar: mb };
    });

  const staffDisplayName = staffInfo?.name ?? (currentUser?.full_name ? currentUser.full_name : (room.staffId ? `Nhân viên ${room.staffId}` : "Chưa phân công"));
  const staffInitial = staffDisplayName.charAt(0).toUpperCase();

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20 }}>
      <div style={{ background:"#FFF",borderRadius:16,width:"100%",maxWidth:560,
        maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",
        boxShadow:"0 20px 60px rgba(0,0,0,.25)" }}>

        {/* Modal header */}
        <div style={{ padding:"20px 24px 16px",borderBottom:"1px solid #E2E8F0",flexShrink:0 }}>
          <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12 }}>
            <div>
              <h2 style={{ fontSize:20,fontWeight:800,color:"#0F172A",marginBottom:4 }}>
                Phòng {room.number}{room.isVip?" VIP":""} – {roomTypeLabel(room.type)}
              </h2>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ display:"inline-flex",alignItems:"center",gap:5,
                  fontSize:12,fontWeight:600,padding:"3px 10px",borderRadius:99,
                  background:stCfg.bg,color:stCfg.text }}>
                  <span style={{ width:7,height:7,borderRadius:99,background:stCfg.dot }} />
                  {stCfg.label}
                </span>
                {room.estMin && room.status === "in-progress" && (
                  <span style={{ display:"flex",alignItems:"center",gap:4,
                    fontSize:12,color:"#64748B" }}>
                    <Clock size={12} /> ~{room.estMin} phút nữa
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose}
              style={{ width:32,height:32,borderRadius:8,background:"#F8FAFC",
                border:"1px solid #E2E8F0",display:"flex",alignItems:"center",
                justifyContent:"center",cursor:"pointer",flexShrink:0 }}>
              <X size={15} style={{ color:"#64748B" }} />
            </button>
          </div>

          {/* Staff info */}
          <div style={{ display:"flex",alignItems:"center",gap:20,padding:"10px 14px",
            background:"#F8FAFC",borderRadius:10,border:"1px solid #E2E8F0" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <div style={{ width:40,height:40,borderRadius:99,background:staffInfo?.color ?? "#16A34A",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:14,fontWeight:700,color:"#FFF",flexShrink:0 }}>
                {staffInitial}
              </div>
              <div>
                <p style={{ fontSize:13,fontWeight:700,color:"#0F172A",margin:0 }}>{staffDisplayName}</p>
                <p style={{ fontSize:11,color:"#64748B",margin:"2px 0 0" }}>Nhân viên phụ trách</p>
              </div>
            </div>
            <div style={{ marginLeft:"auto",display:"flex",gap:20 }}>
              <div>
                <p style={{ fontSize:10,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em",margin:0 }}>Vị trí</p>
                <p style={{ fontSize:12,fontWeight:600,color:"#0F172A",margin:"2px 0 0" }}>Tầng {room.floor}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1,overflowY:"auto",padding:"20px 24px" }}>
          {/* 1. Linen checklist */}
          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <div style={{ width:26,height:26,borderRadius:99,background:"#DBEAFE",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:12,fontWeight:700,color:"#1D4ED8" }}>1</div>
                <h3 style={{ fontSize:14,fontWeight:700,color:"#0F172A",margin:0 }}>Checklist đồ vải &amp; Vệ sinh</h3>
              </div>
              {total > 0 && (
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <span style={{ fontSize:12,color:"#64748B" }}>{done}/{total} hoàn thành</span>
                  <div style={{ width:80,height:6,background:"#E2E8F0",borderRadius:99,overflow:"hidden" }}>
                    <div style={{ height:"100%",background:"#16A34A",
                      width:`${(done/total)*100}%`,borderRadius:99 }} />
                  </div>
                </div>
              )}
            </div>

            {total === 0 ? (
              <p style={{ fontSize:12,color:"#94A3B8",fontStyle:"italic",padding:"8px 0" }}>
                Chưa có hạng mục checklist nào được thiết lập.
              </p>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                {room.checklist.map(item => (
                  <div key={item.id}
                    onClick={() => toggleCheck(item.id)}
                    style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
                      borderRadius:8,border:"1px solid #E2E8F0",cursor:"pointer",
                      background:item.done?"#F0FDF4":"#FFF",transition:"background .12s" }}>
                    {item.done
                      ? <CheckSquare size={16} style={{ color:"#16A34A",flexShrink:0 }} />
                      : <Square     size={16} style={{ color:"#CBD5E1",flexShrink:0 }} />}
                    <span style={{ fontSize:13,color:item.done?"#166534":"#334155" }}>{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Minibar audit */}
          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <div style={{ width:26,height:26,borderRadius:99,background:"#DBEAFE",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:12,fontWeight:700,color:"#1D4ED8" }}>2</div>
                <h3 style={{ fontSize:14,fontWeight:700,color:"#0F172A",margin:0 }}>Kiểm kê minibar</h3>
              </div>
            </div>

            {room.minibar.length === 0 ? (
              <p style={{ fontSize:12,color:"#94A3B8",fontStyle:"italic",padding:"8px 0" }}>
                Không có dữ liệu minibar ghi nhận cho phòng này.
              </p>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                {room.minibar.map((mb, i) => (
                  <div key={i} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
                    padding:"8px 12px",borderRadius:8,border:"1px solid #E2E8F0",background:"#F8FAFC" }}>
                    <span style={{ fontSize:13,color:"#334155" }}>{mb.item}</span>
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <button onClick={() => adjustMinibar(i, -1)}
                        style={{ width:24,height:24,borderRadius:6,border:"1px solid #CBD5E1",background:"#FFF",
                          cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                        <Minus size={12} style={{ color:"#475569" }} />
                      </button>
                      <span style={{ fontSize:13,fontWeight:700,minWidth:24,textAlign:"center",fontFamily:"'JetBrains Mono',monospace" }}>
                        {mb.count}
                      </span>
                      <button onClick={() => adjustMinibar(i, 1)}
                        style={{ width:24,height:24,borderRadius:6,border:"1px solid #CBD5E1",background:"#FFF",
                          cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                        <Plus size={12} style={{ color:"#475569" }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Action button to report incident */}
          <div>
            <button onClick={() => { onReportIncident?.(room.number); onClose(); }}
              style={{ width:"100%",padding:"10px",borderRadius:8,border:"1px dashed #FECDD3",
                background:"#FFF7F7",color:"#BE123C",fontSize:12,fontWeight:600,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
              <ShieldAlert size={14} /> Phát hiện hư hại thiết bị? Báo sự cố kỹ thuật ngay
            </button>
          </div>
        </div>

        {/* Footer buttons */}
        <div style={{ padding:"16px 24px",borderTop:"1px solid #E2E8F0",
          display:"flex",gap:10,flexShrink:0,alignItems:"center" }}>
          <button onClick={onClose}
            style={{ padding:"12px 16px",borderRadius:9,border:"1px solid #CBD5E1",
              background:"#FFF",color:"#475569",fontSize:13,fontWeight:600,cursor:"pointer" }}>
            Hủy / Đóng
          </button>

          {/* Only show "Bắt đầu dọn" when room is to-clean */}
          {room.status === "to-clean" && (
            <button onClick={() => { onStartClean?.(room); onClose(); }}
              style={{ flex:1,padding:"12px",borderRadius:9,border:"1px solid #3B82F6",
                background:"#EFF6FF",color:"#1D4ED8",fontSize:13,fontWeight:700,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
              <RefreshCcw size={15} /> Bắt đầu dọn phòng
            </button>
          )}

          {/* Only show "Hoàn tất vệ sinh" when room is in-progress */}
          {room.status === "in-progress" && (
            <button disabled={done !== total} title={done !== total ? `Cần hoàn thành checklist (${done}/${total})` : undefined} onClick={() => { onComplete?.(room); onClose(); }}
              style={{ flex:2,padding:"12px",borderRadius:9,
                background:"#16A34A",color:"#FFF",fontSize:13,fontWeight:700,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                boxShadow:"0 2px 8px rgba(22,163,74,.3)" }}>
              <CheckCircle2 size={16} /> {done !== total ? `Cần hoàn thành checklist (${done}/${total})` : "Hoàn tất vệ sinh & Bàn giao"}
            </button>
          )}

          {/* When inspecting */}
          {room.status === "inspecting" && (
            <div style={{ flex:2,padding:"12px",borderRadius:9,
              background:"#EDE9FE",color:"#6D28D9",fontSize:13,fontWeight:700,
              display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              <Clock size={16} /> Đang chờ nghiệm thu
            </div>
          )}

          {/* When ready */}
          {room.status === "ready" && (
            <div style={{ flex:2,padding:"12px",borderRadius:9,
              background:"#DCFCE7",color:"#166534",fontSize:13,fontWeight:700,
              display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              <CheckCircle2 size={16} /> Phòng đã sẵn sàng đón khách
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   OVERVIEW SCREEN
══════════════════════════════════════════════════════════ */
function OverviewScreen({
  rooms = [],
  incidents = [],
  search = "",
  onStartClean,
  onComplete,
  onReportIncident,
  currentUser,
}: {
  rooms?: HKRoom[];
  incidents?: Incident[];
  search?: string;
  onStartClean?: (room: HKRoom) => void;
  onComplete?: (room: HKRoom) => void;
  onReportIncident?: (roomNumber: string) => void;
  currentUser?: EmployeeProfileDto | null;
}) {
  const [modal, setModal] = useState<HKRoom|null>(null);
  const [filter, setFilter] = useState<"all"|HKStatus>("all");

  const searchFilteredRooms = useMemo(() => {
    if (!search.trim()) return rooms;
    const q = search.trim().toLowerCase();
    return rooms.filter(r =>
      r.number.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q) ||
      (r.notes && r.notes.toLowerCase().includes(q))
    );
  }, [rooms, search]);

  const currentEmpId = currentUser?.employee_id;
  const myRooms = useMemo(() => {
    if (!currentEmpId) return searchFilteredRooms;
    return searchFilteredRooms.filter(r => r.staffId === currentEmpId || !r.staffId);
  }, [searchFilteredRooms, currentEmpId]);

  const myDone = myRooms.filter(r => r.status === "ready").length;
  const myInspecting = myRooms.filter(r => r.status === "inspecting").length;
  const myInProgress = myRooms.filter(r => r.status === "in-progress").length;
  const myToClean = myRooms.filter(r => r.status === "to-clean").length;
  const myPct = myRooms.length > 0 ? Math.round(((myDone + myInspecting) / myRooms.length) * 100) : 0;

  const filteredMyRooms = useMemo(() => {
    if (filter === "all") return myRooms;
    return myRooms.filter(r => r.status === filter);
  }, [myRooms, filter]);

  // Derive floors from actual rooms
  const floors = useMemo(() => {
    const list = [...new Set(searchFilteredRooms.map(r => r.floor))].sort((a,b) => a-b);
    return list.length > 0 ? list : [1];
  }, [searchFilteredRooms]);

  // Derive recent activity from rooms & incidents
  const recentActivities = useMemo(() => {
    const act: { time: string; msg: string; col: string }[] = [];
    searchFilteredRooms.forEach(r => {
      if (r.status === "ready") {
        act.push({ time: "Hoàn tất", msg: `Phòng ${r.number} đã nghiệm thu đạt chuẩn`, col: "#16A34A" });
      } else if (r.status === "inspecting") {
        act.push({ time: "Chờ duyệt", msg: `Phòng ${r.number} hoàn thành dọn — chờ kiểm tra`, col: "#8B5CF6" });
      } else if (r.status === "in-progress") {
        act.push({ time: "Đang dọn", msg: `Phòng ${r.number} đang được vệ sinh`, col: "#3B82F6" });
      }
    });
    incidents.slice(0, 3).forEach(inc => {
      act.push({ time: "Sự cố", msg: `Phòng ${inc.room}: ${inc.type} — ${inc.status === "resolved" ? "Đã xử lý" : "Đang chờ kỹ thuật"}`, col: "#F59E0B" });
    });
    return act.slice(0, 6);
  }, [searchFilteredRooms, incidents]);

  return (
    <div style={{ flex:1,overflowY:"auto",background:"#F8FAFC" }}>
      <div style={{ padding:"20px 24px" }}>
        <div style={{ marginBottom:16 }}>
          <h2 style={{ fontSize:18,fontWeight:700,color:"#0F172A",marginBottom:2 }}>Tổng quan ca làm</h2>
          <p style={{ fontSize:12,color:"#94A3B8" }}>
            Trực ca vận hành · Bàn giao &amp; Nghiệm thu phòng buồng
          </p>
        </div>

        {/* My Shift Tasks & Assigned Rooms */}
        <div style={{ background:"#FFF",borderRadius:14,border:"1px solid #E2E8F0",padding:"18px 20px",marginBottom:20,boxShadow:"0 1px 3px rgba(0,0,0,.03)" }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:16,paddingBottom:14,borderBottom:"1px solid #F1F5F9" }}>
            <div style={{ display:"flex",alignItems:"center",gap:12 }}>
              <div style={{ width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#16A34A,#15803D)",display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontWeight:800,fontSize:16,boxShadow:"0 3px 8px rgba(22,163,74,.25)" }}>
                {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : "HK"}
              </div>
              <div>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <h3 style={{ fontSize:15,fontWeight:700,color:"#0F172A",margin:0 }}>Nhiệm vụ ca trực của tôi</h3>
                  <span style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,background:"#DCFCE7",color:"#166534" }}>
                    {currentUser?.full_name ? `${currentUser.full_name} · ${employeeRoleLabel(currentUser.role)}` : "Nhân viên Buồng phòng"}
                  </span>
                </div>
                <p style={{ fontSize:12,color:"#64748B",marginTop:3,marginBottom:0 }}>
                  Tiếp nhận danh sách phân công từ Quản lý buồng phòng: <strong>{myRooms.length} phòng</strong> được giao
                </p>
              </div>
            </div>

            <div style={{ display:"flex",alignItems:"center",gap:16,background:"#F8FAFC",padding:"8px 16px",borderRadius:10,border:"1px solid #E2E8F0" }}>
              <div>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:4 }}>
                  <span style={{ fontSize:11,color:"#64748B" }}>Tiến độ hoàn thành:</span>
                  <span style={{ fontSize:12,fontWeight:700,color:myPct===100?"#16A34A":"#D97706" }}>{myDone + myInspecting}/{myRooms.length} phòng ({myPct}%)</span>
                </div>
                <div style={{ width:160,height:6,background:"#E2E8F0",borderRadius:99,overflow:"hidden" }}>
                  <div style={{ height:"100%",background:"#16A34A",width:`${myPct}%`,borderRadius:99,transition:"width .3s" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Quick status chips */}
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginBottom:16 }}>
            <div style={{ padding:"12px 14px",borderRadius:10,background:"#FFFBEB",border:"1px solid #FDE68A" }}>
              <p style={{ fontSize:11,color:"#92400E",fontWeight:600,marginBottom:2 }}>CẦN DỌN (CHỜ XỬ LÝ)</p>
              <p style={{ fontSize:20,fontWeight:800,color:"#B45309",margin:0 }}>{myToClean} phòng</p>
              <p style={{ fontSize:11,color:"#B45309",marginTop:2,marginBottom:0 }}>Ưu tiên phòng trả khách &amp; VIP</p>
            </div>
            <div style={{ padding:"12px 14px",borderRadius:10,background:"#EFF6FF",border:"1px solid #BFDBFE" }}>
              <p style={{ fontSize:11,color:"#1D4ED8",fontWeight:600,marginBottom:2 }}>ĐANG DỌN DẸP</p>
              <p style={{ fontSize:20,fontWeight:800,color:"#1D4ED8",margin:0 }}>{myInProgress} phòng</p>
              <p style={{ fontSize:11,color:"#2563EB",marginTop:2,marginBottom:0 }}>Đang thực hiện checklist</p>
            </div>
            <div style={{ padding:"12px 14px",borderRadius:10,background:"#F5F3FF",border:"1px solid #DDD6FE" }}>
              <p style={{ fontSize:11,color:"#6D28D9",fontWeight:600,marginBottom:2 }}>CHỜ NGHIỆM THU</p>
              <p style={{ fontSize:20,fontWeight:800,color:"#6D28D9",margin:0 }}>{myInspecting} phòng</p>
              <p style={{ fontSize:11,color:"#7C3AED",marginTop:2,marginBottom:0 }}>Đã dọn xong, chờ kiểm tra</p>
            </div>
            <div style={{ padding:"12px 14px",borderRadius:10,background:"#F0FDF4",border:"1px solid #BBF7D0" }}>
              <p style={{ fontSize:11,color:"#166534",fontWeight:600,marginBottom:2 }}>ĐÃ SẴN SÀNG</p>
              <p style={{ fontSize:20,fontWeight:800,color:"#166534",margin:0 }}>{myDone} phòng</p>
              <p style={{ fontSize:11,color:"#15803D",marginTop:2,marginBottom:0 }}>Đã nghiệm thu đạt chuẩn</p>
            </div>
          </div>

          {/* Assigned room list header & filter */}
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:12 }}>
            <p style={{ fontSize:13,fontWeight:700,color:"#0F172A",margin:0 }}>Danh sách phòng được giao trong ca</p>
            <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
              {[
                { id:"all", label:`Tất cả (${myRooms.length})` },
                { id:"to-clean", label:`Cần dọn (${myToClean})` },
                { id:"in-progress", label:`Đang dọn (${myInProgress})` },
                { id:"inspecting", label:`Chờ kiểm tra (${myInspecting})` },
                { id:"ready", label:`Sẵn sàng (${myDone})` },
              ].map(t => {
                const active = filter === t.id;
                return (
                  <button key={t.id} onClick={() => setFilter(t.id as any)}
                    style={{ padding:"4px 10px",borderRadius:6,border:`1px solid ${active?"#0F172A":"#E2E8F0"}`,
                      background:active?"#0F172A":"#FFF",color:active?"#FFF":"#475569",fontSize:11,fontWeight:active?600:400,cursor:"pointer" }}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assigned room grid */}
          {filteredMyRooms.length === 0 ? (
            <div style={{ padding:"24px 16px",textAlign:"center",background:"#F8FAFC",border:"1px dashed #CBD5E1",borderRadius:10,color:"#94A3B8",fontSize:12 }}>
              Chưa có dữ liệu phòng trong danh mục này.
            </div>
          ) : (
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10 }}>
              {filteredMyRooms.map(room => {
                const done = room.checklist.filter(c => c.done).length;
                const total = room.checklist.length;
                const subCfg = SUB_CFG[room.subType] ?? SUB_CFG["checkout-dirty"];
                const stCfg = STATUS_CFG[room.status] ?? STATUS_CFG["to-clean"];
                return (
                  <div key={room.id} onClick={() => setModal(room)}
                    style={{ background:"#F8FAFC",borderRadius:10,border:"1px solid #E2E8F0",padding:"12px 14px",cursor:"pointer",transition:"all .15s",position:"relative" }}>
                    <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:6 }}>
                      <div>
                        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                          <span style={{ fontSize:16,fontWeight:800,color:"#0F172A" }}>P.{room.number}</span>
                          {room.isVip && (
                            <span style={{ fontSize:10,fontWeight:700,background:"#FEF9C3",color:"#92400E",padding:"1px 6px",borderRadius:4 }}>VIP</span>
                          )}
                          <span style={{ fontSize:11,color:"#64748B" }}>· Tầng {room.floor}</span>
                        </div>
                        <p style={{ fontSize:11,color:"#64748B",margin:"2px 0 0" }}>{roomTypeLabel(room.type)}</p>
                      </div>
                      <span style={{ fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:99,background:stCfg.bg,color:stCfg.text }}>
                        {stCfg.label}
                      </span>
                    </div>

                    <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:8 }}>
                      <span style={{ fontSize:10,fontWeight:600,padding:"2px 6px",borderRadius:99,background:subCfg.bg,color:subCfg.text }}>
                        {subCfg.label}
                      </span>
                      {room.notes && (
                        <span style={{ fontSize:10,color:"#D97706",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                          ⚠️ {room.notes}
                        </span>
                      )}
                    </div>

                    {/* Checklist summary */}
                    <div style={{ borderTop:"1px solid #EEF2F6",paddingTop:8,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                      <span style={{ fontSize:11,color:"#64748B" }}>Checklist: <strong>{done}/{total}</strong></span>
                      <button onClick={(e) => { e.stopPropagation(); setModal(room); }}
                        style={{ padding:"3px 8px",borderRadius:6,border:"1px solid #CBD5E1",background:"#FFF",color:"#1E293B",fontSize:10,fontWeight:600,cursor:"pointer" }}>
                        {room.status === "to-clean" ? "Dọn phòng →" : room.status === "in-progress" ? "Tiếp tục →" : "Xem phiếu"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Floor summary */}
        <div style={{ marginBottom:16 }}>
          <p style={{ fontSize:13,fontWeight:700,color:"#0F172A",marginBottom:10 }}>Tình trạng theo tầng</p>
          <div style={{ display:"grid",gridTemplateColumns:`repeat(${Math.max(1, Math.min(5, floors.length))},1fr)`,gap:10 }}>
            {floors.map(f => {
              const fRooms   = searchFilteredRooms.filter(r=>r.floor===f);
              const fDone    = fRooms.filter(r=>r.status==="ready").length;
              const fTotal   = fRooms.length;
              return (
                <div key={f} style={{ background:"#FFF",borderRadius:10,border:"1px solid #E2E8F0",
                  padding:"14px",textAlign:"center" }}>
                  <p style={{ fontSize:11,color:"#94A3B8",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em" }}>Tầng {f}</p>
                  <p style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:24,fontWeight:800,color:"#0F172A",lineHeight:1,marginBottom:6 }}>{fDone}</p>
                  <p style={{ fontSize:10,color:"#64748B",marginBottom:8 }}>/ {fTotal} phòng sẵn sàng</p>
                  <div style={{ height:4,background:"#E2E8F0",borderRadius:99,overflow:"hidden" }}>
                    <div style={{ height:"100%",background:"#16A34A",
                      width:fTotal>0?`${(fDone/fTotal)*100}%`:"0%",borderRadius:99 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Incidents + recent */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
          <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden" }}>
            <div style={{ padding:"14px 16px",borderBottom:"1px solid #F1F5F9",
              display:"flex",alignItems:"center",gap:8 }}>
              <AlertTriangle size={15} style={{ color:"#F59E0B" }} />
              <p style={{ fontSize:13,fontWeight:700,color:"#0F172A",margin:0 }}>Sự cố đang xử lý</p>
              <span style={{ marginLeft:"auto",fontSize:11,fontWeight:600,
                background:"#FFE4E6",color:"#BE123C",padding:"1px 7px",borderRadius:99 }}>
                {incidents.filter(i=>i.status!=="resolved").length}
              </span>
            </div>
            {incidents.filter(i=>i.status!=="resolved").length === 0 ? (
              <div style={{ padding:"20px",textAlign:"center",color:"#94A3B8",fontSize:12 }}>
                Không có sự cố nào đang xử lý.
              </div>
            ) : (
              incidents.filter(i=>i.status!=="resolved").map((inc,i,arr) => (
                <div key={inc.id} style={{ padding:"10px 16px",
                  borderBottom:i<arr.length-1?"1px solid #F8FAFC":"none" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:2 }}>
                    <span style={{ fontSize:11,fontWeight:700,color:"#0F172A" }}>P.{inc.room}</span>
                    <span style={{ fontSize:11,color:"#64748B" }}>{inc.type}</span>
                    <span style={{ marginLeft:"auto",fontSize:10,fontWeight:600,
                      padding:"1px 6px",borderRadius:99,
                      background:PRI_CFG[inc.priority]?.bg ?? "#FEF9C3",color:PRI_CFG[inc.priority]?.text ?? "#92400E" }}>
                      {PRI_CFG[inc.priority]?.label ?? "Trung bình"}
                    </span>
                  </div>
                  <p style={{ fontSize:11,color:"#94A3B8",margin:0 }}>Báo lúc {inc.reportedAt} — {inc.reportedBy}</p>
                </div>
              ))
            )}
          </div>

          <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden" }}>
            <div style={{ padding:"14px 16px",borderBottom:"1px solid #F1F5F9" }}>
              <p style={{ fontSize:13,fontWeight:700,color:"#0F172A",margin:0 }}>Hoạt động gần đây trong ca</p>
            </div>
            {recentActivities.length === 0 ? (
              <div style={{ padding:"20px",textAlign:"center",color:"#94A3B8",fontSize:12 }}>
                Chưa có hoạt động gần đây.
              </div>
            ) : (
              recentActivities.map((a,i,arr) => (
                <div key={i} style={{ display:"flex",alignItems:"flex-start",gap:10,
                  padding:"10px 16px",borderBottom:i<arr.length-1?"1px solid #F8FAFC":"none" }}>
                  <span style={{ width:8,height:8,borderRadius:99,background:a.col,
                    flexShrink:0,marginTop:4 }} />
                  <div>
                    <p style={{ fontSize:12,color:"#334155",margin:0 }}>{a.msg}</p>
                    <p style={{ fontSize:11,color:"#94A3B8",marginTop:2,marginBottom:0 }}>{a.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {modal && (
        <RoomModal
          room={modal}
          onClose={() => setModal(null)}
          onStartClean={onStartClean}
          onComplete={onComplete}
          onReportIncident={onReportIncident}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   BOARD SCREEN (Kanban)
══════════════════════════════════════════════════════════ */
const COLUMNS: { id: HKStatus; label: string; color: string; bg: string }[] = [
  { id:"to-clean",    label:"Cần dọn",              color:"#F59E0B",bg:"#FFFBEB" },
  { id:"in-progress", label:"Đang dọn",             color:"#3B82F6",bg:"#EFF6FF" },
  { id:"inspecting",  label:"Đang kiểm tra",        color:"#8B5CF6",bg:"#F5F3FF" },
  { id:"ready",       label:"Đã kiểm tra",          color:"#16A34A",bg:"#F0FDF4" },
];

function BoardScreen({
  rooms = [],
  search = "",
  onStartClean,
  onComplete,
  onReportIncident,
  currentUser,
}: {
  rooms?: HKRoom[];
  search?: string;
  onStartClean?: (room: HKRoom) => void;
  onComplete?: (room: HKRoom) => void;
  onReportIncident?: (roomNumber: string) => void;
  currentUser?: EmployeeProfileDto | null;
}) {
  const [modal, setModal] = useState<HKRoom|null>(null);
  const [floorFilter, setFloorFilter] = useState<number|"all">("all");
  const [staffFilter, setStaffFilter] = useState<string>("my");

  const floors = useMemo(() => {
    return [...new Set(rooms.map(r => r.floor))].sort((a,b) => a-b);
  }, [rooms]);

  const filtered = useMemo(() => {
    return rooms.filter(r => {
      if (floorFilter !== "all" && r.floor !== floorFilter) return false;
      if (staffFilter === "my" && currentUser?.employee_id) {
        if (r.staffId && r.staffId !== currentUser.employee_id) return false;
      } else if (staffFilter !== "all" && staffFilter !== "my") {
        if (r.staffId !== staffFilter) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const match = r.number.toLowerCase().includes(q) || r.type.toLowerCase().includes(q) || (r.notes && r.notes.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [floorFilter, staffFilter, search, rooms, currentUser]);

  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
      {/* Board toolbar */}
      <div style={{ padding:"10px 20px",borderBottom:"1px solid #E2E8F0",background:"#FFF",
        display:"flex",alignItems:"center",gap:10,flexShrink:0 }}>
        {/* Floor tabs */}
        <div style={{ display:"flex",gap:4 }}>
          {(["all",...floors] as (number|"all")[]).map(f => {
            const active = floorFilter === f;
            return (
              <button key={f} onClick={() => setFloorFilter(f)}
                style={{ padding:"5px 12px",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:active?600:400,
                  background:active?"#0F172A":"#F8FAFC",color:active?"#FFF":"#475569",
                  border:`1px solid ${active?"#0F172A":"#E2E8F0"}` }}>
                {f==="all"?"Tất cả tầng":`Tầng ${f}`}
              </button>
            );
          })}
        </div>
        {/* Staff filter */}
        <div style={{ position:"relative" }}>
          <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)}
            style={{ padding:"5px 28px 5px 10px",borderRadius:7,border:"1px solid #E2E8F0",
              background:"#F8FAFC",fontSize:12,color:"#475569",cursor:"pointer",
              appearance:"none",outline:"none" }}>
            <option value="my">Phòng của tôi ({currentUser?.full_name ?? "Nhân viên"})</option>
            <option value="all">Tất cả phòng trong ca</option>
          </select>
          <ChevronDown size={12} style={{ position:"absolute",right:8,top:"50%",
            transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none" }} />
        </div>
      </div>

      {/* Kanban columns */}
      <div style={{ flex:1,overflowX:"auto",padding:"16px 16px 20px",
        display:"flex",gap:12,minWidth:0,background:"#F8FAFC" }}>
        {COLUMNS.map(col => {
          const colRooms = filtered.filter(r => r.status === col.id);
          return (
            <div key={col.id} style={{ width:230,flexShrink:0,display:"flex",flexDirection:"column",gap:8 }}>
              {/* Column header */}
              <div style={{ display:"flex",alignItems:"center",gap:7,
                padding:"9px 12px",borderRadius:8,background:col.bg,
                border:`1px solid ${col.color}22` }}>
                <span style={{ width:8,height:8,borderRadius:99,background:col.color,flexShrink:0 }} />
                <span style={{ fontSize:14,fontWeight:700,color:"#0F172A",flex:1 }}>{col.label}</span>
                <span style={{ fontSize:11,fontWeight:700,background:col.color+"22",
                  color:col.color,padding:"1px 7px",borderRadius:99 }}>{colRooms.length}</span>
              </div>

              {/* Room cards */}
              <div style={{ display:"flex",flexDirection:"column",gap:8,overflowY:"auto",flex:1 }}>
                {colRooms.length === 0 && (
                  <div style={{ textAlign:"center",padding:"24px 8px",color:"#CBD5E1" }}>
                    <BedDouble size={24} style={{ margin:"0 auto 6px",opacity:.3 }} />
                    <p style={{ fontSize:11 }}>Không có phòng</p>
                  </div>
                )}
                {colRooms.map(room => (
                  <HKRoomCard key={room.id} room={room} onClick={() => setModal(room)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <RoomModal
          room={modal}
          onClose={() => setModal(null)}
          onStartClean={onStartClean}
          onComplete={onComplete}
          onReportIncident={onReportIncident}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   INSPECTION SCREEN
══════════════════════════════════════════════════════════ */
function InspectionScreen({
  rooms = [],
  search = "",
  onComplete,
  onReportIncident,
  currentUser,
}: {
  rooms?: HKRoom[];
  search?: string;
  onComplete?: (room: HKRoom) => void;
  onReportIncident?: (roomNumber: string) => void;
  currentUser?: EmployeeProfileDto | null;
}) {
  const [modal, setModal] = useState<HKRoom|null>(null);

  const searchFilteredRooms = useMemo(() => {
    if (!search.trim()) return rooms;
    const q = search.trim().toLowerCase();
    return rooms.filter(r =>
      r.number.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q) ||
      (r.notes && r.notes.toLowerCase().includes(q))
    );
  }, [rooms, search]);

  const toInspect = searchFilteredRooms.filter(r => r.status === "inspecting");
  const completed = searchFilteredRooms.filter(r => r.status === "ready").slice(0, 10);

  return (
    <div style={{ flex:1,overflowY:"auto",background:"#F8FAFC" }}>
      <div style={{ padding:"20px 24px" }}>
        <div style={{ marginBottom:16 }}>
          <h2 style={{ fontSize:18,fontWeight:700,color:"#0F172A",marginBottom:2 }}>Chờ quản lý nghiệm thu</h2>
          <p style={{ fontSize:12,color:"#94A3B8" }}>Theo dõi phòng đã dọn xong; chỉ quản lý mới được chuyển phòng sang Sẵn sàng đón khách.</p>
        </div>

        {/* Awaiting inspection */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
            <span style={{ width:8,height:8,borderRadius:99,background:"#8B5CF6" }} />
            <p style={{ fontSize:14,fontWeight:700,color:"#0F172A",margin:0 }}>Chờ quản lý kiểm tra ({toInspect.length} phòng)</p>
          </div>
          {toInspect.length === 0 && (
            <div style={{ padding:"20px",background:"#FFF",borderRadius:12,border:"1px dashed #CBD5E1",textAlign:"center",color:"#94A3B8",fontSize:12 }}>
              Hiện không có phòng nào đang chờ kiểm tra nghiệm thu.
            </div>
          )}
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10 }}>
            {toInspect.map(r => (
                <div key={r.id} style={{ background:"#FFF",borderRadius:12,border:"2px solid #EDE9FE",
                  padding:"14px 16px",display:"flex",flexDirection:"column",gap:10 }}>
                  <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between" }}>
                    <div>
                      <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:2 }}>
                        <span style={{ fontSize:18,fontWeight:800,color:"#0F172A" }}>{r.number}</span>
                        {r.isVip && <span style={{ fontSize:10,fontWeight:700,background:"#FEF9C3",color:"#92400E",padding:"1px 6px",borderRadius:4 }}>VIP</span>}
                      </div>
                      <p style={{ fontSize:12,color:"#64748B",margin:0 }}>{r.type} — Tầng {r.floor}</p>
                    </div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                    <Clock size={11} style={{ color:"#8B5CF6" }} />
                    <span style={{ fontSize:11,color:"#8B5CF6",fontWeight:600 }}>
                      Đã bàn giao {r.doneMin || 5} phút trước — chờ quản lý nghiệm thu
                    </span>
                  </div>
                  <div style={{ display:"flex",gap:8 }}>
                    <button onClick={() => setModal(r)}
                      style={{ flex:1,padding:"8px",borderRadius:8,border:"1px solid #8B5CF6",
                        background:"#EDE9FE",color:"#6D28D9",fontSize:12,fontWeight:700,cursor:"pointer" }}>
                      Xem chi tiết
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Completed */}
        <div>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
            <span style={{ width:8,height:8,borderRadius:99,background:"#16A34A" }} />
            <p style={{ fontSize:14,fontWeight:700,color:"#0F172A",margin:0 }}>Đã nghiệm thu ({completed.length} phòng)</p>
          </div>
          <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden" }}>
            {completed.length === 0 ? (
              <div style={{ padding:"24px",textAlign:"center",color:"#94A3B8",fontSize:12 }}>
                Chưa có phòng nào đã nghiệm thu xong trong ca.
              </div>
            ) : (
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"#F8FAFC" }}>
                    {["Phòng","Loại","Tầng","Nhân viên","Thời gian","Trạng thái"].map(h => (
                      <th key={h} style={{ padding:"10px 14px",fontSize:11,fontWeight:600,color:"#64748B",textAlign:"left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {completed.map((r,i) => (
                    <tr key={r.id} style={{ borderTop:"1px solid #F1F5F9",background:i%2===0?"#FFF":"#FAFAFA" }}>
                      <td style={{ padding:"10px 14px",fontSize:14,fontWeight:700,color:"#0F172A" }}>{r.number}</td>
                      <td style={{ padding:"10px 14px",fontSize:12,color:"#475569" }}>{r.type}</td>
                      <td style={{ padding:"10px 14px",fontSize:12,color:"#64748B" }}>Tầng {r.floor}</td>
                      <td style={{ padding:"10px 14px" }}>
                        <span style={{ fontSize:12,color:"#334155" }}>{r.staffId ?? "Hệ thống"}</span>
                      </td>
                      <td style={{ padding:"10px 14px" }}>
                        <div style={{ display:"flex",alignItems:"center",gap:4 }}>
                          <Clock size={11} style={{ color:"#16A34A" }} />
                          <span style={{ fontSize:12,color:"#16A34A",fontWeight:600 }}>Trước {r.doneMin || 10} phút</span>
                        </div>
                      </td>
                      <td style={{ padding:"10px 14px" }}>
                        <span style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,
                          background:"#DCFCE7",color:"#166534" }}>✓ Sẵn sàng</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      {modal && (
        <RoomModal
          room={modal}
          onClose={() => setModal(null)}
          onComplete={onComplete}
          onReportIncident={onReportIncident}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   INCIDENTS SCREEN
══════════════════════════════════════════════════════════ */
function IncidentsScreen({
  incidents = [],
  onCreateIncident,
  onRemindTechnical,
  prefillRoom,
  onClearPrefill,
}: {
  incidents?: Incident[];
  onCreateIncident?: (data: { room: string; type: string; priority: Priority; desc: string }) => Promise<void>;
  onRemindTechnical?: (inc: Incident) => Promise<void>;
  prefillRoom?: string | null;
  onClearPrefill?: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all"|IncStatus>("all");
  const [showForm, setShowForm] = useState(false);
  const [newRoom, setNewRoom] = useState("");
  const [newType, setNewType] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [newDesc, setNewDesc] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remindBusyId, setRemindBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (prefillRoom) {
      setNewRoom(prefillRoom);
      setShowForm(true);
    }
  }, [prefillRoom]);

  const handleFormSubmit = async () => {
    if (!newRoom.trim() || !newType.trim()) {
      setFormError("Vui lòng nhập đầy đủ số phòng và loại sự cố.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (onCreateIncident) {
        await onCreateIncident({
          room: newRoom.trim(),
          type: newType.trim(),
          priority: newPriority,
          desc: newDesc.trim() || "Sự cố thiết bị ghi nhận từ trạm Buồng phòng",
        });
      }
      setSuccessMsg(`Đã tạo và gửi báo cáo sự cố P.${newRoom} đến bộ phận Kỹ thuật!`);
      setNewRoom("");
      setNewType("");
      setNewDesc("");
      onClearPrefill?.();
      setTimeout(() => {
        setShowForm(false);
        setSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setFormError(apiErrorMessage(err, "Không thể tạo sự cố trên hệ thống. Vui lòng thử lại."));
    } finally {
      setBusy(false);
    }
  };

  const handleRemind = async (inc: Incident) => {
    setRemindBusyId(inc.id);
    try {
      if (onRemindTechnical) {
        await onRemindTechnical(inc);
      }
      setSuccessMsg(`Đã gửi cập nhật nhắc nhở xử lý sự cố P.${inc.room} đến bộ phận Kỹ thuật!`);
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err: any) {
      alert("Không thể gửi nhắc nhở kỹ thuật.");
    } finally {
      setRemindBusyId(null);
    }
  };

  const filtered = statusFilter === "all" ? incidents : incidents.filter(i => i.status === statusFilter);

  return (
    <div style={{ flex:1,overflowY:"auto",background:"#F8FAFC" }}>
      <div style={{ padding:"20px 24px" }}>
        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16 }}>
          <div>
            <h2 style={{ fontSize:18,fontWeight:700,color:"#0F172A",marginBottom:2 }}>Báo sự cố kỹ thuật</h2>
            <p style={{ fontSize:12,color:"#94A3B8" }}>Quản lý và theo dõi sự cố phòng liên kết với Bộ phận Kỹ thuật</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            style={{ padding:"8px 16px",borderRadius:9,background:"#DC2626",
              color:"#FFF",fontSize:12,fontWeight:700,cursor:"pointer",
              display:"flex",alignItems:"center",gap:6 }}>
            <ShieldAlert size={14} /> Báo sự cố mới
          </button>
        </div>

        {successMsg && (
          <div style={{ padding:"12px 16px",borderRadius:10,background:"#DCFCE7",border:"1px solid #BBF7D0",
            color:"#166534",fontSize:12,fontWeight:600,marginBottom:16,display:"flex",alignItems:"center",gap:8 }}>
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}

        {/* New incident form (collapsible) */}
        {showForm && (
          <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #FECDD3",
            padding:"16px 20px",marginBottom:16,boxShadow:"0 2px 8px rgba(220,38,38,0.06)" }}>
            <p style={{ fontSize:14,fontWeight:700,color:"#0F172A",marginBottom:12 }}>Tạo sự cố thiết bị mới</p>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10 }}>
              <div>
                <p style={{ fontSize:12,fontWeight:600,color:"#475569",marginBottom:4 }}>Số phòng <span style={{ color:"#DC2626" }}>*</span></p>
                <input value={newRoom} onChange={e => setNewRoom(e.target.value)} placeholder="VD: 204"
                  style={{ width:"100%",height:36,padding:"0 10px",borderRadius:8,
                    border:"1px solid #CBD5E1",fontSize:12,outline:"none",boxSizing:"border-box" }} />
              </div>
              <div>
                <p style={{ fontSize:12,fontWeight:600,color:"#475569",marginBottom:4 }}>Loại sự cố <span style={{ color:"#DC2626" }}>*</span></p>
                <input value={newType} onChange={e => setNewType(e.target.value)} placeholder="VD: Điều hòa không lạnh, Rò nước..."
                  style={{ width:"100%",height:36,padding:"0 10px",borderRadius:8,
                    border:"1px solid #CBD5E1",fontSize:12,outline:"none",boxSizing:"border-box" }} />
              </div>
              <div>
                <p style={{ fontSize:12,fontWeight:600,color:"#475569",marginBottom:4 }}>Mức độ ưu tiên</p>
                <select value={newPriority} onChange={e => setNewPriority(e.target.value as Priority)}
                  style={{ width:"100%",height:36,padding:"0 10px",borderRadius:8,
                    border:"1px solid #CBD5E1",fontSize:12,outline:"none",background:"#FFF",boxSizing:"border-box" }}>
                  <option value="high">Cao (Cần xử lý gấp)</option>
                  <option value="medium">Trung bình</option>
                  <option value="low">Thấp</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <p style={{ fontSize:12,fontWeight:600,color:"#475569",marginBottom:4 }}>Mô tả chi tiết sự cố</p>
              <textarea rows={3} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Mô tả hiện trạng sự cố..."
                style={{ width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid #CBD5E1",
                  fontSize:12,outline:"none",resize:"vertical",boxSizing:"border-box" }} />
            </div>
            {formError && (
              <p style={{ fontSize:11,color:"#DC2626",marginBottom:10,fontWeight:600 }}>{formError}</p>
            )}
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={handleFormSubmit} disabled={busy}
                style={{ padding:"8px 18px",borderRadius:8,background:"#DC2626",
                  color:"#FFF",fontSize:12,fontWeight:700,cursor:"pointer",opacity:busy?0.6:1 }}>
                {busy ? "Đang gửi…" : "Gửi báo cáo"}
              </button>
              <button onClick={() => { setShowForm(false); onClearPrefill?.(); setFormError(null); }}
                style={{ padding:"8px 16px",borderRadius:8,border:"1px solid #E2E8F0",
                  background:"#FFF",color:"#64748B",fontSize:12,cursor:"pointer" }}>
                Hủy
              </button>
            </div>
          </div>
        )}

        {/* Status filter */}
        <div style={{ display:"flex",gap:6,marginBottom:16 }}>
          {([["all","Tất cả"],["open","Mới"],["in-progress","Đang xử lý"],["resolved","Hoàn thành"]] as [string,string][]).map(([v,l]) => {
            const active = statusFilter === v;
            return (
              <button key={v} onClick={() => setStatusFilter(v as "all"|IncStatus)}
                style={{ padding:"6px 14px",borderRadius:99,cursor:"pointer",fontSize:12,
                  fontWeight:active?600:400,
                  background:active?"#0F172A":"#FFF",color:active?"#FFF":"#475569",
                  border:`1px solid ${active?"#0F172A":"#E2E8F0"}` }}>
                {l}
              </button>
            );
          })}
        </div>

        {/* Incidents list */}
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {filtered.length === 0 && (
            <div style={{ padding:"24px",background:"#FFF",borderRadius:12,border:"1px dashed #CBD5E1",textAlign:"center",color:"#94A3B8",fontSize:12 }}>
              Không có sự cố nào trong danh sách.
            </div>
          )}
          {filtered.map(inc => {
            const priCfg = PRI_CFG[inc.priority] ?? PRI_CFG.medium;
            const staCfg = INC_STATUS_CFG[inc.status] ?? INC_STATUS_CFG.open;
            return (
              <div key={inc.id} style={{ background:"#FFF",borderRadius:12,
                border:`1px solid ${inc.status==="open"?"#FECDD3":"#E2E8F0"}`,
                padding:"16px 20px" }}>
                <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <div style={{ width:40,height:40,borderRadius:10,
                      background:inc.status==="resolved"?"#DCFCE7":inc.status==="in-progress"?"#DBEAFE":"#FFE4E6",
                      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                      <ShieldAlert size={18} style={{ color:inc.status==="resolved"?"#16A34A":inc.status==="in-progress"?"#2563EB":"#DC2626" }} />
                    </div>
                    <div>
                      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:2 }}>
                        <span style={{ fontSize:15,fontWeight:800,color:"#0F172A" }}>P.{inc.room}</span>
                        <span style={{ fontSize:14,fontWeight:600,color:"#334155" }}>{inc.type}</span>
                      </div>
                      <p style={{ fontSize:12,color:"#64748B",margin:0 }}>{inc.desc}</p>
                    </div>
                  </div>
                  <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0 }}>
                    <span style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,
                      background:staCfg.bg,color:staCfg.text }}>{staCfg.label}</span>
                    <span style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,
                      background:priCfg.bg,color:priCfg.text }}>{priCfg.label}</span>
                  </div>
                </div>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,paddingTop:10,
                  borderTop:"1px solid #F1F5F9",fontSize:11,color:"#64748B" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:16,flexWrap:"wrap" }}>
                    <span>Báo lúc: <strong style={{ color:"#334155" }}>{inc.reportedAt}</strong></span>
                    <span>Người báo: <strong style={{ color:"#334155" }}>{inc.reportedBy}</strong></span>
                    {inc.assignedTo ? (
                      <span style={{ display:"inline-flex",alignItems:"center",gap:4 }}>
                        Kỹ thuật phụ trách: <strong style={{ color:"#1D4ED8",background:"#DBEAFE",padding:"2px 8px",borderRadius:6 }}>{inc.assignedTo}</strong>
                      </span>
                    ) : (
                      <span style={{ color:"#D97706",background:"#FEF3C7",padding:"2px 8px",borderRadius:6,fontWeight:600 }}>
                        Chờ Kỹ thuật tiếp nhận phân công
                      </span>
                    )}
                  </div>
                  {inc.status !== "resolved" ? (
                    <button
                      onClick={() => handleRemind(inc)}
                      disabled={remindBusyId === inc.id}
                      style={{ padding:"5px 12px",borderRadius:7,border:"1px solid #CBD5E1",
                        background:"#FFF",color:"#334155",fontSize:11,fontWeight:500,cursor:"pointer",
                        display:"flex",alignItems:"center",gap:5,opacity:remindBusyId===inc.id?0.6:1 }}>
                      <Send size={11} style={{ color:"#64748B" }} /> {remindBusyId === inc.id ? "Đang gửi…" : "Nhắc kỹ thuật"}
                    </button>
                  ) : (
                    <span style={{ display:"flex",alignItems:"center",gap:4,color:"#166534",fontSize:11,fontWeight:600 }}>
                      <CheckCircle2 size={13} style={{ color:"#16A34A" }} /> Kỹ thuật đã xử lý xong
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   LINEN & SUPPLY SCREEN
══════════════════════════════════════════════════════════ */
function LinenScreen({ stock = [], onMove }: { stock?: LinenRow[]; onMove?: (itemId: string, movementType: "RECEIVE" | "ISSUE", quantity: number, reason: string) => Promise<void> }) {
  const [category, setCategory] = useState("all");
  const [movement, setMovement] = useState<{ item: LinenRow; type: "RECEIVE" | "ISSUE" } | null>(null);
  const [movementQuantity, setMovementQuantity] = useState("1");
  const [movementReason, setMovementReason] = useState("");
  const [movementBusy, setMovementBusy] = useState(false);
  const [movementError, setMovementError] = useState<string | null>(null);
  const [movementSuccess, setMovementSuccess] = useState<string | null>(null);
  const cats = ["all","linen","towels","amenities","minibar"];
  const catLabels: Record<string,string> = { all:"Tất cả",linen:"Đồ vải",towels:"Khăn",amenities:"Đồ dùng phòng",minibar:"Minibar" };

  const filtered = category === "all" ? stock : stock.filter(s => s.category.toLowerCase() === category.toLowerCase());

  const stockPct = (item: LinenRow) => Math.round((item.stock / item.max) * 100);
  const stockStatus = (item: LinenRow) => {
    const pct = stockPct(item);
    if (item.stock <= item.min) return { color:"#DC2626", label:"Hết", bg:"#FFE4E6" };
    if (pct < 40) return { color:"#D97706", label:"Thấp", bg:"#FEF3C7" };
    return { color:"#16A34A", label:"Đạt", bg:"#DCFCE7" };
  };
  const lowStock = stock.filter(s => s.stock <= s.min);

  const openMovement = (item: LinenRow, type: "RECEIVE" | "ISSUE") => {
    setMovement({ item, type }); setMovementQuantity("1"); setMovementReason(""); setMovementError(null); setMovementSuccess(null);
  };
  const submitMovement = async () => {
    if (!movement || !onMove) return;
    const quantity = Number(movementQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) { setMovementError("Số lượng phải là số nguyên lớn hơn 0."); return; }
    setMovementBusy(true); setMovementError(null); setMovementSuccess(null);
    try {
      await onMove(movement.item.id, movement.type, quantity, movementReason.trim() || (movement.type === "RECEIVE" ? "Nhập kho buồng phòng" : "Xuất kho buồng phòng"));
      setMovementSuccess(`Đã ${movement.type === "RECEIVE" ? "nhập" : "xuất"} ${quantity} ${movement.item.unit} ${movement.item.item} thành công!`);
      setTimeout(() => {
        setMovement(null);
        setMovementSuccess(null);
      }, 1500);
    }
    catch (error) { setMovementError(apiErrorMessage(error, "Không thể cập nhật tồn kho. Vui lòng thử lại.")); }
    finally { setMovementBusy(false); }
  };

  return (
    <div style={{ flex:1,overflowY:"auto",background:"#F8FAFC" }}>
      <div style={{ padding:"20px 24px" }}>
        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16 }}>
          <div>
            <h2 style={{ fontSize:18,fontWeight:700,color:"#0F172A",marginBottom:2 }}>Kho đồ vải &amp; Vật tư</h2>
            <p style={{ fontSize:12,color:"#94A3B8" }}>Quản lý tồn kho và xuất nhập vật tư</p>
          </div>
          <button onClick={() => stock[0] && openMovement(stock[0], "RECEIVE")} disabled={!stock.length} style={{ padding:"8px 16px",borderRadius:9,background:"#0F172A",
            color:"#FFF",fontSize:12,fontWeight:700,cursor:"pointer",
            display:"flex",alignItems:"center",gap:6,opacity:!stock.length?0.5:1 }}>
            <Plus size={14} /> Nhập kho
          </button>
        </div>

        {/* Low stock alerts */}
        {lowStock.length > 0 && (
          <div style={{ padding:"12px 16px",borderRadius:10,border:"1px solid #FECDD3",
            background:"#FFF7F7",marginBottom:16,display:"flex",alignItems:"center",gap:10 }}>
            <AlertTriangle size={16} style={{ color:"#F43F5E",flexShrink:0 }} />
            <p style={{ fontSize:12,color:"#BE123C",margin:0 }}>
              <strong>Cảnh báo tồn kho thấp:</strong>{" "}
              {lowStock.map(s => `${s.item} (${s.stock} ${s.unit})`).join(", ")}
            </p>
          </div>
        )}

        {/* Category tabs */}
        <div style={{ display:"flex",gap:6,marginBottom:16 }}>
          {cats.map(c => {
            const active = category === c;
            return (
              <button key={c} onClick={() => setCategory(c)}
                style={{ padding:"6px 14px",borderRadius:99,cursor:"pointer",fontSize:12,
                  fontWeight:active?600:400,
                  background:active?"#0F172A":"#FFF",
                  color:active?"#FFF":"#475569",
                  border:`1px solid ${active?"#0F172A":"#E2E8F0"}` }}>
                {catLabels[c]}
              </button>
            );
          })}
        </div>

        {movement && <div style={{ background:"#FFF",border:"1px solid #BFDBFE",borderRadius:12,padding:"14px 16px",marginBottom:16 }}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><div><p style={{fontSize:12,fontWeight:700,color:"#0F172A",margin:0}}>{movement.type === "RECEIVE" ? "Nhập kho" : "Xuất kho"}: {movement.item.item}</p><p style={{fontSize:10,color:"#64748B",marginTop:2,marginBottom:0}}>Tồn hiện tại: {movement.item.stock} {movement.item.unit}</p></div><button onClick={()=>setMovement(null)} style={{fontSize:12,color:"#64748B",cursor:"pointer",background:"transparent",border:"none"}}>Đóng</button></div>
          <div style={{display:"grid",gridTemplateColumns:"180px 1fr auto",gap:8,alignItems:"end",marginTop:10}}>
            <label style={{fontSize:10,color:"#64748B"}}>Số lượng<input type="number" min="1" step="1" value={movementQuantity} onChange={event=>setMovementQuantity(event.target.value)} style={{display:"block",width:"100%",height:34,marginTop:3,border:"1px solid #E2E8F0",borderRadius:7,padding:"0 8px",boxSizing:"border-box"}} /></label>
            <label style={{fontSize:10,color:"#64748B"}}>Lý do<input value={movementReason} onChange={event=>setMovementReason(event.target.value)} placeholder="Ví dụ: Nhập lô mới" style={{display:"block",width:"100%",height:34,marginTop:3,border:"1px solid #E2E8F0",borderRadius:7,padding:"0 8px",boxSizing:"border-box"}} /></label>
            <button onClick={()=>void submitMovement()} disabled={movementBusy} style={{height:34,padding:"0 14px",borderRadius:7,background:"#2563EB",color:"#FFF",fontSize:11,fontWeight:700,cursor:"pointer",opacity:movementBusy?0.6:1}}>{movementBusy ? "Đang lưu…" : "Lưu tồn kho"}</button>
          </div>
          {movementError && <p role="alert" style={{fontSize:11,color:"#BE123C",marginTop:8,marginBottom:0}}>{movementError}</p>}
          {movementSuccess && <p style={{fontSize:11,color:"#166534",marginTop:8,marginBottom:0}}>{movementSuccess}</p>}
        </div>}

        {/* Stock grid */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10 }}>
          {filtered.length === 0 && (
            <div style={{ gridColumn:"1 / -1",padding:"28px 16px",textAlign:"center",background:"#FFF",border:"1px dashed #CBD5E1",borderRadius:12,color:"#94A3B8",fontSize:12 }}>
              Chưa có dữ liệu tồn kho đồ vải/vật tư buồng phòng.
            </div>
          )}
          {filtered.map(item => {
            const pct  = stockPct(item);
            const stat = stockStatus(item);
            return (
              <div key={item.id} style={{ background:"#FFF",borderRadius:12,
                border:`1px solid ${item.stock<=item.min?"#FECDD3":"#E2E8F0"}`,
                padding:"14px 16px" }}>
                <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10 }}>
                  <div>
                    <p style={{ fontSize:13,fontWeight:700,color:"#0F172A",marginBottom:2 }}>{item.item}</p>
                    <p style={{ fontSize:11,color:"#94A3B8",margin:0 }}>Tối thiểu: {item.min} {item.unit}</p>
                  </div>
                  <span style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,
                    background:stat.bg,color:stat.color }}>{stat.label}</span>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:800,
                    color:stat.color,lineHeight:1 }}>{item.stock}</span>
                  <span style={{ fontSize:12,color:"#94A3B8" }}>/ {item.max} {item.unit}</span>
                </div>
                <div style={{ height:6,background:"#E2E8F0",borderRadius:99,overflow:"hidden",marginBottom:10 }}>
                  <div style={{ height:"100%",background:stat.color,
                    width:`${pct}%`,borderRadius:99,transition:"width .3s" }} />
                </div>
                <div style={{ display:"flex",gap:6 }}>
                  <button onClick={() => openMovement(item, "ISSUE")} style={{ flex:1,padding:"6px",borderRadius:7,border:"1px solid #E2E8F0",
                    background:"#F8FAFC",color:"#475569",fontSize:11,cursor:"pointer" }}>Xuất kho</button>
                  <button onClick={() => openMovement(item, "RECEIVE")} style={{ flex:1,padding:"6px",borderRadius:7,border:"1px solid #3B82F6",
                    background:"#EFF6FF",color:"#1D4ED8",fontSize:11,fontWeight:600,cursor:"pointer" }}>Nhập thêm</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SHARED KPI BAR
══════════════════════════════════════════════════════════ */
function HKKpiBar({ rooms = [], incidents = [] }: { rooms?: HKRoom[]; incidents?: Incident[] }) {
  const dirty      = rooms.filter(r => r.status === "to-clean").length;
  const inProgress = rooms.filter(r => r.status === "in-progress").length;
  const inspecting = rooms.filter(r => r.status === "inspecting").length;
  const ready      = rooms.filter(r => r.status === "ready").length;
  const maintenance= incidents.filter(i => i.status !== "resolved").length;
  return (
    <div style={{ background:"#FFF",borderBottom:"1px solid #E2E8F0",
      display:"flex",flexShrink:0,padding:"0 20px" }}>
      {[
        { label:"Phòng bẩn",         val:dirty,       iconBg:"#FEF9C3",iconColor:"#D97706",Icon:BedDouble },
        { label:"Đang dọn phòng",   val:inProgress,  iconBg:"#DBEAFE",iconColor:"#3B82F6",Icon:RefreshCcw },
        { label:"Chờ nghiệm thu",   val:inspecting,  iconBg:"#EDE9FE",iconColor:"#7C3AED",Icon:ClipboardList },
        { label:"Đã sẵn sàng",       val:ready,       iconBg:"#DCFCE7",iconColor:"#16A34A",Icon:CheckCircle2 },
        { label:"Cảnh báo kỹ thuật", val:maintenance, iconBg:"#FFE4E6",iconColor:"#DC2626",Icon:AlertTriangle },
      ].map((k,i,arr) => (
        <div key={k.label} style={{ flex:1,padding:"14px 0",display:"flex",alignItems:"center",gap:12,
          borderRight:i<arr.length-1?"1px solid #F1F5F9":"none",
          paddingRight:i<arr.length-1?16:0,paddingLeft:i>0?16:0 }}>
          <div style={{ width:40,height:40,borderRadius:10,background:k.iconBg,flexShrink:0,
            display:"flex",alignItems:"center",justifyContent:"center" }}>
            <k.Icon size={18} style={{ color:k.iconColor }} />
          </div>
          <div>
            <p style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:800,color:"#0F172A",lineHeight:1,marginBottom:3 }}>{k.val}</p>
            <p style={{ fontSize:12,fontWeight:600,color:"#334155",margin:0 }}>{k.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function HousekeepingStation({ onBack }: { onBack: () => void }) {
  const [page, setPage]     = useState<NavPage>("overview");
  const [search, setSearch] = useState("");
  const [liveRooms, setLiveRooms] = useState<HKRoom[]>([]);
  const [liveIncidents, setLiveIncidents] = useState<Incident[]>([]);
  const [liveLinen, setLiveLinen] = useState<LinenRow[]>([]);
  const [currentUser, setCurrentUser] = useState<EmployeeProfileDto | null>(null);
  const [prefillIncidentRoom, setPrefillIncidentRoom] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);
  const [topProfileOpen, setTopProfileOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profile, tasks, incidents, rooms, templates, linen] = await Promise.all([
        authApi.employeeProfile().catch((err: any) => {
          if (err?.status === 401 || err?.status === 403) throw err;
          return null;
        }),
        housekeepingTechnicalApi.tasks(),
        housekeepingTechnicalApi.incidents(),
        housekeepingTechnicalApi.rooms(),
        housekeepingTechnicalApi.checklistTemplates().catch(() => []),
        enterpriseApi.linen(),
      ]);

      if (profile) {
        setCurrentUser(profile);
      }

      const roomById = new Map((rooms || []).map((room: ApiRoom) => [room.id, room]));

      const mappedRooms = await Promise.all(
        (tasks || []).map(async (task: HousekeepingTask): Promise<HKRoom> => {
          const room = roomById.get(task.room_id);
          const [checklistResults, inspections] = await Promise.all([
            housekeepingTechnicalApi.checklistResults(task.id).catch(() => []),
            housekeepingTechnicalApi.inspections(task.id).catch(() => []),
          ]);

          const status: HKStatus =
            task.status === "NEEDS_CLEANING"
              ? "to-clean"
              : task.status === "IN_PROGRESS"
              ? "in-progress"
              : task.status === "CLEANED" || task.status === "WAITING_TECHNICAL"
              ? "inspecting"
              : "ready";

          const checklist: CheckItem[] =
            checklistResults.length > 0
              ? checklistResults.map(result => ({
                  id: String(result.id),
                  label: result.item,
                  done: result.passed,
                }))
              : (templates || []).map(tmpl => ({
                  id: String(tmpl.id),
                  label: tmpl.name,
                  done: false,
                }));

          const minibar: MinibarItem[] = inspections
            .filter(inspection => inspection.inspection_type === "MINIBAR")
            .map(inspection => ({
              item: inspection.item,
              unit: "món",
              count: inspection.quantity,
            }));

          return {
            id: task.room_id,
            taskId: task.id,
            number: room?.name ?? task.room_id,
            floor: room?.floor ?? 1,
            type: room?.room_type_name ?? room?.room_type_id ?? "Phòng",
            status,
            subType: task.blocking_incident ? "maintenance" : "checkout-dirty",
            staffId: task.assignee ?? undefined,
            estMin: 30,
            checklist,
            minibar,
            notes: task.note ?? undefined,
          };
        })
      );
      setLiveRooms(mappedRooms);

      setLiveIncidents(
        (incidents || []).map((incident: EquipmentIncident): Incident => ({
          id: String(incident.id),
          room: incident.room_id,
          type: incident.equipment_name,
          desc: incident.handoff_note ? incident.handoff_note : `Sự cố thiết bị: ${incident.equipment_name}`,
          priority:
            incident.severity === "CRITICAL" || incident.severity === "HIGH"
              ? "high"
              : incident.severity === "MEDIUM"
              ? "medium"
              : "low",
          status:
            incident.handoff_status === "RESOLVED"
              ? "resolved"
              : incident.handoff_status === "ACKNOWLEDGED"
              ? "in-progress"
              : "open",
          reportedBy: "Buồng phòng",
          reportedAt: "Vừa cập nhật",
          assignedTo: incident.handoff_status === "OPEN" ? undefined : "Kỹ thuật",
        }))
      );

      setLiveLinen(
        (linen || []).map(item => ({
          id: item.id,
          item: item.name,
          unit: item.unit,
          stock: item.current_quantity,
          min: item.safety_threshold,
          max: Math.max(item.safety_threshold * 2, item.current_quantity, 1),
          category: (item.category || "linen").toLowerCase(),
        }))
      );
    } catch (err: any) {
      console.error("Backend housekeeping data error:", err);
      if (err?.status === 401) {
        setError("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.");
      } else if (err?.status === 403) {
        setError("Tài khoản không có quyền truy cập dữ liệu buồng phòng.");
      } else {
        setError("Không thể tải dữ liệu vận hành. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleStartClean = async (room: HKRoom) => {
    if (!room.taskId) return;
    try {
      await housekeepingTechnicalApi.updateTask(room.taskId, { status: "IN_PROGRESS" });
      await loadData();
    } catch (err) {
      console.error("Unable to start cleaning on backend:", err);
      alert("Không thể bắt đầu dọn phòng. Vui lòng thử lại.");
      await loadData();
    }
  };

  const handleCompleteRoom = async (room: HKRoom) => {
    if (!room.taskId) return;
    if (room.checklist.some(item => !item.done)) {
      alert("Cần hoàn thành toàn bộ checklist trước khi bàn giao vệ sinh.");
      return;
    }
    try {
      // 1. Save all checklist results - do NOT swallow errors with catch(() => null)
      for (const item of room.checklist) {
        await housekeepingTechnicalApi.addChecklistResult(room.taskId, {
          item: item.label,
          passed: item.done,
          note: undefined,
        });
      }
      // 2. Save minibar inspections - do NOT swallow errors with catch(() => null)
      for (const item of room.minibar) {
        await housekeepingTechnicalApi.addInspection(room.taskId, {
          inspection_type: "MINIBAR",
          item: item.item,
          quantity: item.count,
          item_condition: item.count > 0 ? "OK" : "MISSING",
          note: "Cập nhật từ checklist buồng phòng",
        });
      }
      // 3. Update task status to CLEANED
      await housekeepingTechnicalApi.updateTask(room.taskId, { status: "CLEANED" });
      await loadData();
    } catch (err) {
      console.error("Unable to complete housekeeping task on backend:", err);
      alert(apiErrorMessage(err, "Không thể hoàn tất vệ sinh phòng. Vui lòng thử lại."));
      await loadData();
    }
  };

  const handleReportIncidentModal = (roomNumber: string) => {
    setPrefillIncidentRoom(roomNumber);
    setPage("incidents");
  };

  const handleCreateIncident = async (data: { room: string; type: string; priority: Priority; desc: string }) => {
    await housekeepingTechnicalApi.createIncident({
      room_id: data.room,
      equipment_name: data.type,
      quantity: 1,
      severity: data.priority === "high" ? "HIGH" : data.priority === "medium" ? "MEDIUM" : "LOW",
      description: data.desc,
    });
    await loadData();
  };

  const handleRemindTechnical = async (inc: Incident) => {
    await housekeepingTechnicalApi.handoffIncident(Number(inc.id), {
      status: inc.status === "resolved" ? "RESOLVED" : inc.status === "in-progress" ? "ACKNOWLEDGED" : "OPEN",
      note: "Buồng phòng nhắc kỹ thuật xử lý sự cố",
    });
    await loadData();
  };

  const handleLinenMovement = async (itemId: string, movementType: "RECEIVE" | "ISSUE", quantity: number, reason: string) => {
    // Call real API and re-fetch. Do NOT update local state if API fails!
    await enterpriseApi.moveLinen({ item_id: itemId, movement_type: movementType, quantity, reason });
    await loadData();
  };

  const NAV: { id: NavPage; label: string; Icon: React.ElementType }[] = [
    { id:"overview",   label:"Tổng quan",            Icon:Home },
    { id:"board",      label:"Nhiệm vụ & Checklist", Icon:LayoutGrid },
    { id:"inspection", label:"Kiểm tra & Nghiệm thu", Icon:ClipboardList },
    { id:"linen",      label:"Đồ vải & Vật tư ca",   Icon:Package },
    { id:"incidents",  label:"Báo sự cố kỹ thuật",   Icon:Wrench },
  ];

  const employeeName = currentUser?.full_name ?? "Nhân viên buồng phòng";
  const employeeInitial = employeeName.charAt(0).toUpperCase();
  const employeeRole = currentUser?.role ? employeeRoleLabel(currentUser.role) : "Nhân viên buồng phòng";

  return (
    <div style={{ display:"flex",height:"100vh",overflow:"hidden",
      background:"#F8FAFC",fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* SIDEBAR */}
      <aside style={{ width:195,background:"#FFF",borderRight:"1px solid #E2E8F0",
        display:"flex",flexDirection:"column",flexShrink:0 }}>
        {/* Brand */}
        <div style={{ padding:"14px 16px 12px",borderBottom:"1px solid #E2E8F0" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <img
              src="/hotel_logo.png"
              alt="MaM Hotel Logo"
              style={{ width:38,height:"auto",objectFit:"contain",flexShrink:0,filter:"drop-shadow(0 2px 6px rgba(184,148,74,0.35))" }}
            />
            <div>
              <p style={{ fontSize:14,fontWeight:700,color:"#0F172A",lineHeight:1.1,fontFamily:"'Cormorant Garamond',Georgia,serif",letterSpacing:"0.05em",margin:0 }}>MaM Hotel</p>
              <p style={{ fontSize:9,color:"#16A34A",letterSpacing:"0.1em",textTransform:"uppercase",marginTop:2,marginBottom:0,fontWeight:600 }}>VẬN HÀNH BUỒNG PHÒNG</p>
            </div>
          </div>
        </div>
        {/* Nav */}
        <nav style={{ flex:1,padding:"10px 8px",overflowY:"auto" }}>
          {NAV.map(n => {
            const active = page === n.id;
            return (
              <button key={n.id} onClick={() => setPage(n.id)}
                style={{ width:"100%",display:"flex",alignItems:"center",gap:9,
                  padding:"8px 10px",borderRadius:8,cursor:"pointer",marginBottom:2,
                  background:active?"#DBEAFE":"transparent",
                  border:"none",
                  color:active?"#1D4ED8":"#475569",fontWeight:active?600:400,fontSize:13,
                  textAlign:"left",transition:"all .1s" }}>
                <n.Icon size={15} style={{ color:active?"#3B82F6":"#94A3B8",flexShrink:0 }} strokeWidth={active?2:1.5} />
                {n.label}
              </button>
            );
          })}
        </nav>
        {/* Profile */}
        <div style={{ padding:"10px 14px",borderTop:"1px solid #F1F5F9",position:"relative" }}>
          <div
            onClick={() => setSidebarProfileOpen(p => !p)}
            style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer" }}
            title="Xem hồ sơ & đổi mật khẩu"
          >
            <div style={{ width:30,height:30,borderRadius:99,flexShrink:0,
              background:"linear-gradient(135deg,#1D4ED8,#3B82F6)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:12,fontWeight:800,color:"#FFF" }}>{employeeInitial}</div>
            <div style={{ flex:1,minWidth:0 }}>
              <p style={{ fontSize:11,fontWeight:700,color:"#0F172A",lineHeight:1,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{employeeName}</p>
              <p style={{ fontSize:10,color:"#94A3B8",margin:"2px 0 0" }}>{employeeRole}</p>
            </div>
            <ChevronDown size={12} style={{ color:"#94A3B8" }} />
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
            currentRoleLabel="Buồng phòng"
            departmentName="Bộ phận Buồng phòng"
          />
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0 }}>

        {/* TOP HEADER */}
        <header style={{ background:"#FFF",borderBottom:"1px solid #E2E8F0",
          height:56,display:"flex",alignItems:"center",gap:12,padding:"0 20px",flexShrink:0 }}>
          <div>
            <p style={{ fontSize:15,fontWeight:700,color:"#0F172A",lineHeight:1,margin:0 }}>
              Trạm Buồng phòng · Ca trực
            </p>
            <p style={{ fontSize:11,color:"#94A3B8",margin:"2px 0 0" }}>Quản lý hoạt động buồng phòng theo thời gian thực</p>
          </div>
          <div style={{ flex:1 }} />
          {/* Search */}
          <div style={{ position:"relative" }}>
            <Search size={13} style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm phòng, ghi chú..."
              style={{ height:34,paddingLeft:30,paddingRight:10,borderRadius:8,width:200,
                border:"1px solid #E2E8F0",background:"#F8FAFC",fontSize:12,outline:"none" }} />
          </div>
          {/* Bell */}
          <button style={{ width:34,height:34,borderRadius:8,background:"#F8FAFC",border:"1px solid #E2E8F0",
            display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative" }}>
            <Bell size={14} style={{ color:"#475569" }} />
            {liveIncidents.filter(i=>i.status!=="resolved").length > 0 && (
              <span style={{ position:"absolute",top:5,right:5,width:8,height:8,borderRadius:99,
                background:"#EF4444",display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:8,color:"#FFF",fontWeight:700 }}>
                {liveIncidents.filter(i=>i.status!=="resolved").length}
              </span>
            )}
          </button>
          {/* Staff */}
          <div style={{ position:"relative" }}>
            <div
              onClick={() => setTopProfileOpen(p => !p)}
              style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"4px 6px",borderRadius:8 }}
              title="Hồ sơ nhân viên"
            >
              <div style={{ width:30,height:30,borderRadius:99,
                background:"linear-gradient(135deg,#16A34A,#15803D)",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:11,fontWeight:700,color:"#FFF" }}>{employeeInitial}</div>
              <div>
                <p style={{ fontSize:12,fontWeight:700,color:"#0F172A",lineHeight:1,margin:0 }}>{employeeName}</p>
                <p style={{ fontSize:10,color:"#94A3B8",margin:"2px 0 0" }}>{employeeRole}</p>
              </div>
              <ChevronDown size={12} style={{ color:"#94A3B8" }} />
            </div>
            <EmployeeProfileDropdown
              isOpen={topProfileOpen}
              onClose={() => setTopProfileOpen(false)}
              onLogout={onBack}
              align="top-right"
              currentRoleLabel="Buồng phòng"
              departmentName="Bộ phận Buồng phòng"
            />
          </div>
        </header>

        {/* Error banner with retry button */}
        {error && (
          <div style={{ padding:"12px 20px",background:"#FEF2F2",borderBottom:"1px solid #FECDD3",
            display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,color:"#B91C1C",fontSize:12,fontWeight:600 }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
            <button onClick={() => void loadData()}
              style={{ padding:"4px 12px",borderRadius:6,border:"1px solid #B91C1C",background:"#FFF",color:"#B91C1C",fontSize:11,fontWeight:700,cursor:"pointer" }}>
              Thử lại
            </button>
          </div>
        )}

        {/* Loading banner */}
        {loading && (
          <div style={{ padding:"10px 20px",background:"#EFF6FF",borderBottom:"1px solid #BFDBFE",
            display:"flex",alignItems:"center",gap:8,color:"#1D4ED8",fontSize:12,fontWeight:600 }}>
            <RefreshCcw size={14} className="animate-spin" />
            <span>Đang tải dữ liệu vận hành từ hệ thống...</span>
          </div>
        )}

        {/* KPI BAR */}
        <HKKpiBar rooms={liveRooms} incidents={liveIncidents} />

        {/* CONTENT */}
        {page === "overview"   && (
          <OverviewScreen
            rooms={liveRooms}
            incidents={liveIncidents}
            search={search}
            onStartClean={handleStartClean}
            onComplete={handleCompleteRoom}
            onReportIncident={handleReportIncidentModal}
            currentUser={currentUser}
          />
        )}
        {page === "board"      && (
          <BoardScreen
            rooms={liveRooms}
            search={search}
            onStartClean={handleStartClean}
            onComplete={handleCompleteRoom}
            onReportIncident={handleReportIncidentModal}
            currentUser={currentUser}
          />
        )}
        {page === "inspection" && (
          <InspectionScreen
            rooms={liveRooms}
            search={search}
            onComplete={handleCompleteRoom}
            onReportIncident={handleReportIncidentModal}
            currentUser={currentUser}
          />
        )}
        {page === "linen"      && (
          <LinenScreen
            stock={liveLinen}
            onMove={handleLinenMovement}
          />
        )}
        {page === "incidents"  && (
          <IncidentsScreen
            incidents={liveIncidents}
            onCreateIncident={handleCreateIncident}
            onRemindTechnical={handleRemindTechnical}
            prefillRoom={prefillIncidentRoom}
            onClearPrefill={() => setPrefillIncidentRoom(null)}
          />
        )}
      </div>
    </div>
  );
}
