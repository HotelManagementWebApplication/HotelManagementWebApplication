import {useEffect,useRef,useState} from "react";
import {serviceAvailabilityApi} from "../../shared/api/serviceAvailability";
import {apiErrorMessage} from "../../shared/api/client";
export function ServiceCapacityDialog({item,onClose,onSaved}:{item:{id:string;name:string;stock:number};onClose:()=>void;onSaved:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),[capacity,setCapacity]=useState(String(item.stock)),[minutes,setMinutes]=useState("60"),[reason,setReason]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[shared,setShared]=useState(false),[ready,setReady]=useState(false);
 useEffect(()=>{ref.current?.showModal();void serviceAvailabilityApi.list().then(rows=>{const row=rows.find(r=>r.service_id===item.id);if(row){setMinutes(String(row.duration_minutes));setCapacity(String(row.capacity));setShared(Boolean(row.resource_source_id)||rows.some(other=>other.resource_source_id===item.id));setReady(true);}}).catch(e=>setError(apiErrorMessage(e,"Không tải được thời lượng.")));},[item.id]);
 return <dialog ref={ref} aria-label="Cấu hình tài nguyên dịch vụ" onCancel={e=>{e.preventDefault();if(!busy)onClose();}} style={{padding:24,border:0,borderRadius:12,width:420,maxWidth:"calc(100vw - 32px)"}}><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await serviceAvailabilityApi.configure(item.id,{capacity:Number(capacity),minutes:Number(minutes),reason});onSaved();onClose();}catch(e){setError(apiErrorMessage(e,"Không thể lưu."));}finally{setBusy(false);}}}><h2>{item.name}</h2>
 {shared&&<p>Sức chứa dùng chung với gói dịch vụ khác. Thay đổi số máy áp dụng cho cả nhóm.</p>}<label style={{display:"grid",margin:"12px 0"}}>Tổng số tài nguyên<input required min="1" step="1" type="number" value={capacity} onChange={e=>setCapacity(e.target.value)}/></label>
 <label style={{display:"grid",margin:"12px 0"}}>Thời gian một lượt (phút)<input required min="1" max="10080" step="1" type="number" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>
 <label style={{display:"grid",margin:"12px 0"}}>Lý do thay đổi<textarea required maxLength={255} value={reason} onChange={e=>setReason(e.target.value)}/></label>
 {error&&<p role="alert">{error}</p>}<footer style={{display:"flex",gap:12,justifyContent:"flex-end"}}><button type="button" disabled={busy} onClick={onClose}>Hủy</button><button disabled={busy||!ready}>{busy?"Đang lưu…":"Lưu cấu hình"}</button></footer>
 </form></dialog>;
}
