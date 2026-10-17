import {useState} from "react";
import {kitchenAccountingApi as api} from "../../shared/api/kitchenAccounting";
import type {CashHandover} from "../../shared/types/kitchenAccounting";
import {formatVnd} from "../../shared/utils/money";
import {formatDateTimeVi} from "../../shared/utils/localDate";
import {apiErrorMessage} from "../../shared/api/client";
export default function CashHandoverPanel({handovers,date,actor,onSaved}:{handovers:CashHandover[];date:string;actor?:string;onSaved:()=>void}){
 const [busy,setBusy]=useState<number|null>(null),[error,setError]=useState("");
 const rows=handovers.filter(r=>r.handed_over_at.slice(0,10)===date);
 return <section style={{background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,overflow:"hidden"}}><header style={{padding:18}}><h2 style={{fontWeight:700}}>Tiếp nhận bàn giao ca</h2><p>Lễ tân kiểm đếm và gửi bàn giao; kế toán kiểm tra thông tin, xác nhận đã nhận.</p></header>
 {error&&<p role="alert" style={{padding:12,color:"#B91C1C"}}>{error}</p>}
 <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr>{["Thời điểm / ca","Người giao → nhận","Dự kiến","Thực đếm","Chênh lệch","Xác nhận"].map(t=><th key={t} style={{padding:12,textAlign:"left",background:"#F8FAFC"}}>{t}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id} style={{borderTop:"1px solid #E2E8F0"}}><td style={{padding:12}}>{formatDateTimeVi(row.handed_over_at)}<br/>{row.shift_code}</td><td>{row.from_actor} → {row.to_actor}<br/>{row.note}</td><td>{formatVnd(row.expected_amount)}</td><td>{formatVnd(row.actual_amount)}</td><td>{formatVnd(row.variance)}</td><td>{row.confirmed_at?<span>Đã xác nhận<br/>{formatDateTimeVi(row.confirmed_at)}</span>:row.to_actor===actor?<button disabled={busy!==null} onClick={async()=>{setBusy(row.id);setError("");try{await api.confirmCashHandover(row.id);onSaved();}catch(e){setError(apiErrorMessage(e,"Không thể xác nhận."));}finally{setBusy(null);}}}>{busy===row.id?"Đang xác nhận…":"Xác nhận đã nhận"}</button>:<span>Chờ người nhận xác nhận</span>}</td></tr>)}
 {!rows.length&&<tr><td colSpan={6} style={{padding:28,textAlign:"center"}}>Chưa có bàn giao trong ngày.</td></tr>}</tbody></table></div></section>;
}
