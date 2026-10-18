import { useState } from "react";
import { enterpriseApi } from "../../shared/api/enterprise";
import { apiErrorMessage } from "../../shared/api/client";
import type { OtaReconciliation } from "../../shared/types/enterprise";
import { formatVnd } from "../../shared/utils/money";
import { formatDateVi } from "../../shared/utils/localDate";
import { compactActionStyle, disabledActionStyle, primaryActionStyle, secondaryActionStyle } from "./accountingUi";

const channels: Record<string,string>={AGODA:"Agoda",BOOKING_COM:"Booking.com",EXPEDIA:"Expedia",AIRBNB:"Airbnb",DIRECT:"Trực tiếp"};
export default function OtaReconciliationScreen({rows,onUpdated}:{rows:OtaReconciliation[];onUpdated:(row:OtaReconciliation)=>void}){
  const [busy,setBusy]=useState<number|null>(null);const [error,setError]=useState("");
  const [selected,setSelected]=useState<Record<number,string>>({});
  const statuses:Record<string,string>={PENDING:"Chờ đối soát",MATCHED:"Đã khớp",DISPUTED:"Có tranh chấp",NOT_APPLICABLE:"Không áp dụng"};
  const update=async(row:OtaReconciliation)=>{
    if(busy!==null)return;setBusy(row.reservation_id);setError("");
    try{onUpdated(await enterpriseApi.updateOtaStatus(row.reservation_id,selected[row.reservation_id]));}
    catch(cause){setError(apiErrorMessage(cause,"Không thể cập nhật đối soát."));}finally{setBusy(null);}
  };
  const exportCsv=()=>{
    const quote=(value:unknown)=>`"${String(value??"").replace(/^[=+@-]/,"'$&").replace(/"/g,'""')}"`;
    const csv=[["Booking","Kênh","Khách","Phòng","Ngày đặt","Doanh thu gộp","Hoa hồng","Doanh thu ròng","Trạng thái"],...rows.map(row=>[row.reservation_id,channels[row.booking_source]??row.booking_source,row.guest_name,row.room_id,row.booked_at,row.gross_revenue,row.commission,row.net_revenue,statuses[row.status]??row.status])].map(row=>row.map(quote).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="ota-reconciliation.csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <section className="acct-panel" style={{padding:22,overflow:"auto",flex:1}}>
    <div className="acct-section-header" style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}><div><h2 style={{fontSize:18}}>Đối soát kênh bán</h2><p style={{fontSize:12,color:"#64748B",marginTop:6}}>Mỗi booking có trạng thái riêng. Tổng dưới đây là giá trị booking OTA, không phải số tiền đã thu.</p></div><button type="button" style={{...secondaryActionStyle,...(!rows.length?disabledActionStyle:{})}} onClick={exportCsv} disabled={rows.length===0}>Xuất báo cáo CSV</button></div>
    <div style={{display:"flex",gap:24,flexWrap:"wrap",padding:"18px 0",fontSize:13}}><span>Gộp: <strong>{formatVnd(rows.reduce((sum,row)=>sum+row.gross_revenue,0))}</strong></span><span>Hoa hồng: <strong>{formatVnd(rows.reduce((sum,row)=>sum+row.commission,0))}</strong></span><span>Ròng: <strong>{formatVnd(rows.reduce((sum,row)=>sum+row.net_revenue,0))}</strong></span></div>
    {error && <p role="alert" style={{color:"#B91C1C",paddingBottom:12}}>{error}</p>}
    <div className="acct-table-wrap" style={{overflow:"auto",background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12}}><table className="acct-table" style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Booking / khách","Kênh / ngày đặt","Phòng","Gộp","Hoa hồng","Ròng","Đối soát","Thao tác"].map(label=><th key={label} style={{padding:12,textAlign:"left",background:"#F8FAFC"}}>{label}</th>)}</tr></thead><tbody>{rows.map(row=>{const unavailable=busy!==null || !selected[row.reservation_id] || selected[row.reservation_id]===row.status;return <tr key={row.reservation_id} style={{borderTop:"1px solid #E2E8F0"}}><td style={{padding:12}}>#{row.reservation_id} · {row.guest_name}</td><td>{channels[row.booking_source]??row.booking_source}<br/>{formatDateVi(row.booked_at)}</td><td>{row.room_id}</td><td>{formatVnd(row.gross_revenue)}</td><td>{formatVnd(row.commission)}<br/>{row.gross_revenue>0?`${(row.commission/row.gross_revenue*100).toFixed(1)}%`:"—"}</td><td>{formatVnd(row.net_revenue)}</td><td><select aria-label={`Trạng thái OTA booking ${row.reservation_id}`} disabled={busy!==null} value={selected[row.reservation_id]??row.status} onChange={event=>setSelected(values=>({...values,[row.reservation_id]:event.target.value}))}>{["PENDING","MATCHED","DISPUTED"].map(status=><option key={status} value={status}>{statuses[status]}</option>)}</select></td><td style={{padding:12}}><button type="button" style={{...compactActionStyle,...(unavailable?disabledActionStyle:{...primaryActionStyle,minHeight:30,padding:"0 9px",fontSize:11})}} disabled={unavailable} onClick={()=>void update(row)}>{busy===row.reservation_id?"Đang lưu…":"Lưu đối soát"}</button></td></tr>;})}{rows.length===0 && <tr><td colSpan={8} style={{padding:28,textAlign:"center"}}>Chưa có booking OTA.</td></tr>}</tbody></table></div>
  </section>;
}
