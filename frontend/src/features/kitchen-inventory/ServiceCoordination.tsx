import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { RestaurantBooking } from "../../shared/types/kitchenAccounting";

export function ServiceCoordination({ bookings, items, date, loading, error, busyId, searchQuery, onDateChange, onRefresh, onMarkUsed }: {
  bookings: RestaurantBooking[];
  items: { id: string; category: string; unit: string }[];
  date: string;
  loading: boolean;
  error: string | null;
  busyId: number | null;
  searchQuery: string;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
  onMarkUsed: (booking: RestaurantBooking) => void;
}) {
  const [category, setCategory] = useState("");
  const categories = [...new Set(bookings.map(booking => items.find(item => item.id === booking.service_id)?.category).filter((value): value is string => Boolean(value)))];
  const visibleBookings = bookings.filter(booking => !category || items.find(item => item.id === booking.service_id)?.category === category).filter(booking => !searchQuery.trim()
    || `${booking.room_id} ${booking.reservation_id} ${booking.service_name} ${booking.note ?? ""}`.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  const confirmed = visibleBookings.filter(booking => booking.status === "CONFIRMED").length;
  const used = visibleBookings.filter(booking => booking.status === "USED").length;
  const cancelled = visibleBookings.filter(booking => booking.status === "CANCELLED").length;
  const mealLabel = (value: string | null) => value === "LUNCH" ? "Bữa trưa" : value === "DINNER" ? "Bữa tối" : "";
  return (
    <div style={{ flex:1,overflowY:"auto",padding:"20px 24px",background:"#F8FAFC" }}>
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,marginBottom:18,flexWrap:"wrap" }}>
        <div><p style={{ fontSize:11,color:"#D97706",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em" }}>Vận hành dịch vụ</p><h2 style={{ fontSize:22,fontWeight:800,color:"#0F172A",marginTop:3 }}>Điều phối dịch vụ</h2></div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}><input type="date" value={date} onChange={event => onDateChange(event.target.value)} style={{ height:36,border:"1px solid #CBD5E1",borderRadius:8,padding:"0 10px",fontSize:12,background:"#FFF" }} /><button onClick={onRefresh} disabled={loading} style={{ height:36,padding:"0 13px",display:"flex",alignItems:"center",gap:6,border:"1px solid #CBD5E1",borderRadius:8,background:"#FFF",fontSize:12,fontWeight:600,cursor:loading?"wait":"pointer" }}><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Làm mới</button></div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12,marginBottom:16 }}>
        {[["Đã đặt",confirmed,"#FEF3C7","#92400E"],["Đã sử dụng",used,"#DCFCE7","#166534"],["Đã hủy",cancelled,"#F1F5F9","#475569"]].map(([label,value,bg,color]) => <div key={String(label)} style={{ background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,padding:15 }}><p style={{ fontSize:11,color:"#64748B" }}>{label}</p><div style={{ display:"flex",alignItems:"center",gap:8,marginTop:6 }}><strong style={{ fontSize:24,color:String(color) }}>{value}</strong><span style={{ fontSize:10,fontWeight:700,color:String(color),background:String(bg),padding:"2px 7px",borderRadius:99 }}>đơn</span></div></div>)}
      </div>
      <label style={{display:"block",fontSize:12,marginBottom:16}}>Nhóm dịch vụ <select aria-label="Nhóm dịch vụ" value={category} onChange={event => setCategory(event.target.value)} style={{marginLeft:8,padding:8,border:"1px solid #CBD5E1",borderRadius:8,background:"white"}}><option value="">Tất cả nhóm</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      {error && <div role="alert" style={{ marginBottom:14,padding:"10px 12px",borderRadius:9,background:"#FFF1F2",border:"1px solid #FECDD3",color:"#BE123C",fontSize:12 }}>{error}</div>}
      <div style={{ background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}><table style={{ width:"100%",borderCollapse:"collapse",minWidth:780 }}><thead><tr style={{ background:"#F8FAFC" }}>{["Giờ phục vụ","Phòng / Booking","Dịch vụ","Số lượng","Ghi chú","Trạng thái","Thao tác"].map(label => <th key={label} style={{ padding:"10px 13px",textAlign:"left",fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:"0.05em" }}>{label}</th>)}</tr></thead><tbody>
          {visibleBookings.map(booking => { const due = new Date(booking.scheduled_at).getTime() <= Date.now(); const canUse = booking.status === "CONFIRMED" && due; return <tr key={booking.id} style={{ borderTop:"1px solid #F1F5F9" }}><td style={{ padding:"12px 13px",fontSize:12,fontWeight:700,color:"#0F172A" }}>{new Date(booking.scheduled_at).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}<p style={{ marginTop:2,fontSize:10,color:"#64748B",fontWeight:500 }}>{mealLabel(booking.meal_period)}</p></td><td style={{ padding:"12px 13px",fontSize:12,color:"#334155" }}><strong>Phòng {booking.room_id}</strong><p style={{ marginTop:2,fontSize:10,color:"#94A3B8" }}>BK-{booking.reservation_id}</p></td><td style={{ padding:"12px 13px",fontSize:12,color:"#334155" }}>{booking.service_name}</td><td style={{ padding:"12px 13px",fontSize:13,fontWeight:700,color:"#0F172A" }}>{booking.quantity} {items.find(item => item.id === booking.service_id)?.unit ?? ""}<p style={{ marginTop:2,fontSize:10,color:"#64748B",fontWeight:400 }}>miễn phí {booking.free_quantity}</p></td><td style={{ padding:"12px 13px",fontSize:11,color:"#64748B",maxWidth:220 }}>{booking.note || "—"}</td><td style={{ padding:"12px 13px" }}><span style={{ fontSize:10,fontWeight:700,borderRadius:99,padding:"3px 8px",background:booking.status==="USED"?"#DCFCE7":booking.status==="CANCELLED"?"#F1F5F9":"#FEF3C7",color:booking.status==="USED"?"#166534":booking.status==="CANCELLED"?"#475569":"#92400E" }}>{booking.status === "USED" ? "Đã sử dụng" : booking.status === "CANCELLED" ? "Đã hủy" : "Đã đặt"}</span></td><td style={{ padding:"12px 13px" }}><button onClick={() => onMarkUsed(booking)} disabled={!canUse || busyId === booking.id} title={!due && booking.status === "CONFIRMED" ? "Chưa đến giờ phục vụ" : undefined} style={{ border:0,borderRadius:7,padding:"7px 10px",background:canUse?"#0F172A":"#E2E8F0",color:canUse?"#FFF":"#94A3B8",fontSize:11,fontWeight:700,cursor:canUse?"pointer":"not-allowed" }}>{busyId === booking.id ? "Đang lưu…" : booking.status === "USED" ? "Đã sử dụng" : "Xác nhận sử dụng"}</button></td></tr>; })}
          {!loading && visibleBookings.length === 0 && <tr><td colSpan={7} style={{ padding:38,textAlign:"center",fontSize:12,color:"#64748B" }}>{bookings.length === 0 ? "Không có lịch dịch vụ trong ngày đã chọn." : "Không tìm thấy lịch dịch vụ khớp với từ khóa."}</td></tr>}
          {loading && <tr><td colSpan={7} style={{ padding:38,textAlign:"center",fontSize:12,color:"#64748B" }}>Đang tải lịch dịch vụ…</td></tr>}
        </tbody></table></div>
      </div>
    </div>
  );
}
