import {useEffect,useState} from "react";
import {housekeepingTechnicalApi as api} from "../../shared/api/housekeepingTechnical";
import type {Room,HousekeepingTask,HousekeepingShiftAssignment} from "../../shared/types/housekeepingTechnical";
import {localDateValue} from "../../shared/utils/localDate";import {apiErrorMessage} from "../../shared/api/client";
export default function ShiftRosterPanel({rooms,onCreated}:{rooms:Room[];onCreated:(task:HousekeepingTask)=>void}){
 const [shift,setShift]=useState(()=>new Date().getHours()>=6&&new Date().getHours()<14?"MORNING":new Date().getHours()>=14&&new Date().getHours()<22?"AFTERNOON":"NIGHT");
 const [rows,setRows]=useState<HousekeepingShiftAssignment[]>([]),[employee,setEmployee]=useState(""),[room,setRoom]=useState(""),[note,setNote]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError("");api.shiftAssignments(shift).then(v=>{if(active){setRows(v);setEmployee("");}}).catch(e=>{if(active)setError(apiErrorMessage(e,"Không tải được nhân viên trong ca."));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[shift,refresh]);
 return <section style={{padding:18,background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,marginBottom:16}}><h2 style={{fontWeight:700,marginBottom:12}}>Phân công buồng phòng theo ca</h2>
 <select aria-label="Ca phân công" value={shift} onChange={e=>setShift(e.target.value)}><option value="MORNING">Ca sáng</option><option value="AFTERNOON">Ca chiều</option><option value="NIGHT">Ca đêm</option></select>
 {loading&&<p>Đang tải ca…</p>}{error&&<p role="alert" style={{color:"#B91C1C"}}>{error}</p>}
 <div style={{display:"flex",gap:12,flexWrap:"wrap",margin:"12px 0"}}>{rows.map(row=><div key={row.employee_id}><strong>{row.full_name}</strong><p>{row.rooms.length} phòng đang phụ trách: {row.rooms.map(r=>r.room_id).join(", ")||"Chưa có"}</p></div>)}</div>
 {!loading&&!rows.length&&<p>Không có nhân viên buồng phòng đang làm trong ca này.</p>}
 <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{const task=await api.createTask({room_id:room,assignee:employee,note,shift_code:shift,shift_date:localDateValue()});onCreated(task);setRefresh(v=>v+1);setRoom("");setNote("");}catch(e){setError(apiErrorMessage(e,"Không thể giao phòng."));}finally{setBusy(false);}}} style={{display:"flex",gap:10,flexWrap:"wrap"}}>
 <select required aria-label="Nhân viên trong ca" value={employee} onChange={e=>setEmployee(e.target.value)}><option value="">Chọn nhân viên</option>{rows.map(e=><option key={e.employee_id} value={e.employee_id}>{e.full_name}</option>)}</select>
 <select required aria-label="Phòng giao dọn" value={room} onChange={e=>setRoom(e.target.value)}><option value="">Chọn phòng</option>{rooms.filter(r=>["cleaning","available","reserved"].includes(r.status)).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>
 <input aria-label="Ghi chú phân công" maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="Ghi chú"/>
 <button disabled={busy||loading||!rows.length}>{busy?"Đang giao…":"Giao phòng"}</button></form></section>;
}
