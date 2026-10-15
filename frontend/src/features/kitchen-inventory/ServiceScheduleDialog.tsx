import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { apiErrorMessage } from "../../shared/api/client";
import { serviceScheduleApi, type ScheduleMode } from "../../shared/api/serviceSchedule";

export function ServiceScheduleDialog({item,onClose,onSaved}:{item:{id:string;name:string;unit?:string};onClose:()=>void;onSaved:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [capacity,setCapacity]=useState("");const [unit,setUnit]=useState("");const [minutes,setMinutes]=useState("");
  const [mode,setMode]=useState<ScheduleMode>("UNITS");const [consume,setConsume]=useState(false);const [reason,setReason]=useState("");
  const [loading,setLoading]=useState(true);const [loaded,setLoaded]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState<string|null>(null);
  useEffect(()=>{dialog.current?.showModal();let active=true;
    serviceScheduleApi.get(item.id).then(row=>{if(!active)return;setCapacity(row.capacity==null?"":String(row.capacity));setUnit(row.unit??"");setMinutes(row.minutes_per_unit==null?"":String(row.minutes_per_unit));setMode(row.mode??"UNITS");setConsume(row.consumes_stock);setLoaded(true);})
      .catch(error=>{if(active)setError(apiErrorMessage(error,"Không tải được cấu hình dịch vụ."));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};},[item.id]);
  const submit=async(event:React.FormEvent)=>{event.preventDefault();if(loading||saving)return;setSaving(true);setError(null);
    try{await serviceScheduleApi.save(item.id,{capacity:Number(capacity),unit:unit.trim(),minutes_per_unit:Number(minutes),mode,consumes_stock:mode==="STOCK"||consume,reason:reason.trim()});onSaved();onClose();}
    catch(error){setError(apiErrorMessage(error,"Không lưu được cấu hình dịch vụ."));}finally{setSaving(false);}};
  const inputStyle={width:"100%",padding:10,border:"1px solid #CBD5E1",borderRadius:8,marginTop:5,fontSize:14};
  const count=Number(capacity)>0?Number(capacity).toLocaleString("vi-VN"):"…";
  const countUnit=unit.trim()||"chỗ";
  const duration=Number(minutes)>0 ? Number(minutes)%1440===0 ? `${Number(minutes)/1440} ngày`
    : Number(minutes)%60===0 ? `${Number(minutes)/60} giờ` : `${minutes} phút` : "…";
  const summary=mode==="STOCK" ? "Số lượng khách có thể đặt được tính từ hàng còn trong kho, sau khi trừ các đơn đang giữ hàng."
    : mode==="DAILY" ? `Nhận tối đa ${count} ${countUnit} trong một ngày.`
    : mode==="STAY" ? `Có ${count} ${countUnit}. Khách đặt sẽ giữ đến lúc trả phòng.`
    : mode==="OVERNIGHT" ? `Nhận tối đa ${count} ${countUnit} cùng lúc. Mỗi lượt giữ đến 08:00 sáng hôm sau.`
    : mode==="DURATION" ? `Có ${count} ${countUnit} phục vụ cùng lúc. Mỗi ${item.unit||"đơn vị tính tiền"} khách đặt sẽ giữ 1 ${countUnit} trong ${duration}.`
    : `Nhận tối đa ${count} ${countUnit} cùng lúc. Mỗi lượt đặt giữ chỗ trong ${duration}.`;
  return <dialog ref={dialog} onCancel={event=>{if(saving)event.preventDefault();else onClose();}} aria-labelledby="schedule-title" style={{width:"min(560px,94vw)",border:0,borderRadius:16,padding:24,color:"#0F172A"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2 id="schedule-title" style={{fontSize:20,fontWeight:700}}>Thiết lập số lượng phục vụ</h2><button onClick={onClose} disabled={saving} aria-label="Đóng"><X size={20}/></button></div>
    <p style={{margin:"8px 0 16px",color:"#64748B"}}>{item.name} ({item.id})</p>
    {error&&<p role="alert" style={{color:"#B91C1C",marginBottom:12}}>{error}</p>}
    {loading?<p>Đang tải cấu hình…</p>:!loaded?<button onClick={onClose}>Đóng và thử lại</button>:<form onSubmit={event=>void submit(event)} style={{display:"grid",gap:14,fontSize:14}}>
      <label>Cách nhận đặt dịch vụ<select style={inputStyle} value={mode} onChange={e=>{const next=e.target.value as ScheduleMode;setMode(next);if(next==="STOCK")setConsume(true);}}>
        <option value="DURATION">Giữ chỗ theo số giờ/ngày khách đặt</option><option value="UNITS">Giữ chỗ trong một khoảng thời gian</option><option value="STAY">Giữ đến khi khách trả phòng</option><option value="DAILY">Giới hạn số lượng trong ngày</option><option value="OVERNIGHT">Giữ đến 08:00 sáng hôm sau</option><option value="STOCK">Nhận đặt theo hàng còn trong kho</option></select></label>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><label>Số lượng phục vụ tối đa<input required type="number" min="1" max="2147483647" step="1" value={capacity} onChange={e=>setCapacity(e.target.value)} style={inputStyle}/></label><label>Đơn vị (suất, sân, phòng…)<input required maxLength={20} placeholder="Ví dụ: suất" value={unit} onChange={e=>setUnit(e.target.value)} style={inputStyle}/></label></div>
      <label>{mode==="DURATION"?`Thời gian cho 1 ${item.unit||"đơn vị tính tiền"} (phút)`:"Thời gian giữ chỗ mỗi lượt (phút)"}<input required type="number" min="1" max="10080" step="1" value={minutes} onChange={e=>setMinutes(e.target.value)} style={inputStyle}/></label>
      <div style={{padding:12,borderRadius:8,background:"#EFF6FF",color:"#1E40AF",lineHeight:1.6}}><strong>Với thiết lập này:</strong><p style={{marginTop:4}}>{summary}</p></div>
      <label style={{display:"flex",gap:8,alignItems:"center"}}><input type="checkbox" checked={mode==="STOCK"||consume} disabled={mode==="STOCK"} onChange={e=>setConsume(e.target.checked)}/>Trừ hàng trong kho khi xác nhận khách đã dùng</label>
      <p style={{color:"#64748B",fontSize:12,marginTop:-6,lineHeight:1.6}}>{mode==="STOCK"||consume?"Bật cho suất ăn, đồ uống hoặc hàng dùng hết. Số có thể đặt còn phụ thuộc lượng hàng trong kho.":"Không trừ kho. Sân, phòng hoặc xe có thể phục vụ lượt tiếp theo sau khi hết thời gian giữ chỗ."}</p>
      <label>Lý do thay đổi<textarea required maxLength={255} value={reason} onChange={e=>setReason(e.target.value)} style={inputStyle}/></label>
      <div style={{display:"flex",justifyContent:"flex-end",gap:10}}><button type="button" disabled={saving} onClick={onClose}>Hủy bỏ</button><button disabled={saving||!reason.trim()} style={{padding:"9px 16px",background:"#2563EB",color:"white",borderRadius:8}}>{saving?"Đang lưu…":"Lưu cấu hình"}</button></div>
    </form>}
  </dialog>;
}
