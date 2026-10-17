import {useEffect,useRef,useState} from "react";
import {stockRequestsApi} from "../../shared/api/stockRequests";
import {apiErrorMessage} from "../../shared/api/client";
export default function StockRequestDialog({item,kind,onClose,onSent}:{item:{id:string;item:string;unit:string};kind:"ISSUE"|"RETURN"|"DAMAGE";onClose:()=>void;onSent:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),request=useRef<{body:string;key:string}|null>(null);
 const [quantity,setQuantity]=useState("1"),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{dialog.current?.showModal();},[]);
 const title=kind==="ISSUE"?"Yêu cầu cấp hàng":kind==="RETURN"?"Trả hàng về kho":"Thông báo vật tư hỏng";
 return <dialog ref={dialog} aria-label={title} onCancel={e=>{e.preventDefault();if(!busy)onClose();}} style={{border:0,borderRadius:12,padding:24,width:420,maxWidth:"calc(100vw - 32px)"}}>
  <form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError("");try{const body={kind,service_id:item.id,quantity:Number(quantity),reason:reason.trim(),room_id:null};const serialized=JSON.stringify(body);if(request.current?.body!==serialized)request.current={body:serialized,key:crypto.randomUUID()};await stockRequestsApi.create(body,request.current.key);onSent();onClose();}catch(cause){setError(apiErrorMessage(cause,"Không thể gửi yêu cầu."));}finally{setBusy(false);}}}>
   <h2 style={{fontSize:18,fontWeight:700}}>{title}</h2><p style={{margin:"12px 0"}}>{item.item}</p>
   <label style={{display:"grid",gap:6,marginBottom:12}}>Số lượng ({item.unit})<input required type="number" min="1" max="2147483647" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)} disabled={busy}/></label>
   <label style={{display:"grid",gap:6}}>Lý do<textarea required maxLength={255} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}/></label>
   {error&&<p role="alert" style={{color:"#B91C1C",marginTop:10}}>{error}</p>}
   <footer style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:20}}><button type="button" disabled={busy} onClick={onClose}>Hủy</button><button type="submit" disabled={busy}>{busy?"Đang gửi…":"Gửi Kho & Dịch vụ"}</button></footer>
  </form>
 </dialog>;
}
