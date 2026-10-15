import { useEffect, useRef, useState } from "react";
import { stockReturnsApi, type StockReturn } from "../../shared/api/stockReturns";
import type { Service } from "../../shared/types/kitchenAccounting";
import { apiErrorMessage } from "../../shared/api/client";
import { newKitchenIdempotencyKey } from "../../shared/api/kitchenAccounting";
import "./stockReturns.css";

const statusLabels={PENDING:"Chờ duyệt",APPROVED:"Đã duyệt",REJECTED:"Từ chối"};
export default function StockReturnsPanel({ warehouse=false, onChanged }: { warehouse?:boolean; onChanged?:()=>void }) {
  const [rows,setRows]=useState<StockReturn[]>([]),[items,setItems]=useState<Service[]>([]);
  const [loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [serviceId,setServiceId]=useState(""),[quantity,setQuantity]=useState("1"),[room,setRoom]=useState(""),[reason,setReason]=useState("");
  const [filter,setFilter]=useState(warehouse?"PENDING":"ALL");
  const [decision,setDecision]=useState<{row:StockReturn;approve:boolean}|null>(null);
  const retry=useRef<{signature:string;key:string}|null>(null);
  useEffect(()=>{
    let active=true;setLoading(true);setError("");
    Promise.all([stockReturnsApi.list(),warehouse?Promise.resolve([]):stockReturnsApi.catalog()])
      .then(([requests,catalog])=>{if(active){setRows(requests);setItems(catalog);setServiceId(current=>catalog.some(item=>item.id===current)?current:catalog[0]?.id??"");}})
      .catch(cause=>{if(active)setError(apiErrorMessage(cause,"Không thể tải yêu cầu trả kho."));})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[warehouse,refresh]);
  const create=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy)return;setError("");setNotice("");
    const number=Number(quantity);
    if(!serviceId||!Number.isSafeInteger(number)||number<1||!reason.trim()){setError("Chọn mặt hàng, nhập số lượng nguyên dương và lý do trả hàng.");return;}
    const body={service_id:serviceId,quantity:number,room_id:room.trim()||null,reason:reason.trim()};
    const signature=JSON.stringify(body);
    if(retry.current?.signature!==signature)retry.current={signature,key:newKitchenIdempotencyKey()};
    setBusy(true);
    try{
      const result=await stockReturnsApi.create(body,retry.current.key);
      setRows(current=>[result,...current.filter(row=>row.id!==result.id)]);retry.current=null;
      setQuantity("1");setRoom("");setReason("");setNotice("Đã gửi yêu cầu. Tồn kho chỉ tăng khi nhân viên Kho duyệt.");
    }catch(cause){setError(apiErrorMessage(cause,"Không thể gửi yêu cầu trả kho."));}finally{setBusy(false);}
  };
  const decide=async(note:string)=>{
    if(!decision||busy)return;setBusy(true);setError("");setNotice("");
    try{
      const result=await stockReturnsApi.decide(decision.row.id,decision.approve,note);
      setRows(current=>current.map(row=>row.id===result.id?result:row));setDecision(null);
      setNotice(result.status==="APPROVED"?"Đã duyệt trả hàng và cộng tồn kho.":"Đã từ chối yêu cầu; tồn kho không thay đổi.");onChanged?.();
    }catch(cause){setError(apiErrorMessage(cause,"Không thể quyết định yêu cầu trả kho."));throw cause;}finally{setBusy(false);}
  };
  const visible=rows.filter(row=>filter==="ALL"||row.status===filter);
  return <section className="stock-returns">
    <header><div><h2>{warehouse?"Duyệt trả kho":"Trả hàng về Kho"}</h2><p>{warehouse?"Kiểm đếm hàng nhận lại từ Buồng phòng trước khi cộng tồn.":"Gửi các mặt hàng còn dùng được về Kho. Yêu cầu cần được Kho duyệt trước khi nhập lại tồn."}</p></div>
      <button type="button" disabled={loading||busy} onClick={()=>setRefresh(value=>value+1)}>Tải lại</button></header>
    {error&&<p role="alert" className="stock-returns-error">{error}</p>}
    {notice&&<p role="status" className="stock-returns-notice">{notice}</p>}
    {!warehouse&&<form className="stock-returns-form" onSubmit={event=>void create(event)}>
      <label>Mặt hàng trả<select required value={serviceId} disabled={loading||busy} onChange={event=>setServiceId(event.target.value)}>
        {!items.length&&<option value="">Chưa có mặt hàng</option>}{items.map(item=><option key={item.id} value={item.id}>{item.name} ({item.id}) · {item.unit}</option>)}
      </select></label>
      <label>Số lượng trả<input required type="number" min="1" max="2147483647" step="1" value={quantity} onChange={event=>setQuantity(event.target.value)} disabled={busy}/></label>
      <label>Phòng trả (tùy chọn)<input value={room} maxLength={10} onChange={event=>setRoom(event.target.value)} disabled={busy} placeholder="Ví dụ: 502"/></label>
      <label className="stock-returns-wide">Lý do trả hàng<textarea required maxLength={255} value={reason} onChange={event=>setReason(event.target.value)} disabled={busy} placeholder="Ví dụ: Đồ dùng còn nguyên, chưa sử dụng"/></label>
      <button type="submit" className="stock-returns-primary" disabled={loading||busy||!items.length}>{busy?"Đang gửi…":"Gửi yêu cầu trả kho"}</button>
    </form>}
    <div className="stock-returns-filters" aria-label="Trạng thái trả kho">
      {(["ALL","PENDING","APPROVED","REJECTED"] as const).map(status=><button type="button" key={status} aria-pressed={filter===status} onClick={()=>setFilter(status)}>{status==="ALL"?"Tất cả":statusLabels[status]} ({rows.filter(row=>status==="ALL"||row.status===status).length})</button>)}
    </div>
    {loading?<p>Đang tải yêu cầu…</p>:<div className="stock-returns-table"><table><thead><tr>{["Mã / Thời điểm","Mặt hàng","Số lượng","Phòng","Người gửi / Lý do","Trạng thái","Quyết định"].map(label=><th key={label}>{label}</th>)}</tr></thead>
      <tbody>{visible.map(row=><tr key={row.id}><td>TK-{row.id}<small>{new Date(row.requested_at).toLocaleString("vi-VN")}</small></td><td>{row.service_name}<small>{row.service_id}</small></td><td>{row.quantity} {row.unit}</td><td>{row.room_id||"—"}</td><td>{row.requester}<small>{row.reason}</small></td>
        <td><span className={`stock-returns-status ${row.status.toLowerCase()}`}>{statusLabels[row.status]}</span></td>
        <td>{warehouse&&row.status==="PENDING"?<div className="stock-returns-actions"><button type="button" disabled={busy} onClick={()=>setDecision({row,approve:true})}>Duyệt nhập lại kho</button><button type="button" disabled={busy} onClick={()=>setDecision({row,approve:false})}>Từ chối</button></div>:<>{row.approver||"Chờ Kho kiểm đếm"}<small>{row.decision_reason}</small></>}</td>
      </tr>)}{!visible.length&&<tr><td colSpan={7}>Chưa có yêu cầu trả kho ở trạng thái này.</td></tr>}</tbody></table></div>}
    {decision&&<ReturnDecisionDialog value={decision} busy={busy} onClose={()=>{if(!busy)setDecision(null);}} onConfirm={decide}/>}
  </section>;
}

function ReturnDecisionDialog({value,busy,onClose,onConfirm}:{value:{row:StockReturn;approve:boolean};busy:boolean;onClose:()=>void;onConfirm:(reason:string)=>Promise<void>}){
  const ref=useRef<HTMLDialogElement>(null);const [reason,setReason]=useState("");const [error,setError]=useState("");
  useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>dialog.close();},[]);
  return <dialog className="stock-return-decision" ref={ref} aria-label={value.approve?"Duyệt nhập lại kho":"Từ chối trả kho"} onCancel={event=>{event.preventDefault();onClose();}}>
    <form onSubmit={async event=>{event.preventDefault();try{await onConfirm(reason.trim());}catch(cause){setError(apiErrorMessage(cause,"Không thể lưu quyết định."));}}}>
      <h3>{value.approve?"Xác nhận đã kiểm đếm hàng trả":"Từ chối yêu cầu trả hàng"}</h3>
      <p>{value.row.service_name} · <strong>{value.row.quantity} {value.row.unit}</strong></p>
      <p>{value.approve?"Sau khi duyệt, số hàng này sẽ được cộng lại vào tồn kho.":"Tồn kho sẽ được giữ nguyên khi từ chối."}</p>
      <label>{value.approve?"Ghi chú kiểm đếm (tùy chọn)":"Lý do từ chối"}<textarea required={!value.approve} maxLength={255} disabled={busy} value={reason} onChange={event=>setReason(event.target.value)}/></label>
      {error&&<p role="alert">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={onClose}>Hủy</button><button type="submit" disabled={busy}>{busy?"Đang lưu…":value.approve?"Xác nhận duyệt":"Xác nhận từ chối"}</button></footer>
    </form>
  </dialog>;
}
