import { useEffect, useRef, useState } from "react";
import { kitchenAccountingApi as api, newKitchenIdempotencyKey } from "../../shared/api/kitchenAccounting";
import { apiErrorMessage } from "../../shared/api/client";
import type { CashBalance, CashRecipient, CashHandover } from "../../shared/types/kitchenAccounting";
import { formatVnd } from "../../shared/utils/money";
import { formatDateTimeVi } from "../../shared/utils/localDate";
import { accountingErrorMessage, parseCashCount } from "./accountingLogic";
import { disabledActionStyle, primaryActionStyle, secondaryActionStyle } from "./accountingUi";

const inputStyle = {width:"100%",height:34,border:"1px solid #CBD5E1",borderRadius:7,padding:"0 8px",boxSizing:"border-box" as const,marginTop:4};
export default function CashHandoverPanel({ handovers, date, actor, onSaved }: {
  handovers: CashHandover[]; date: string; actor?: string; onSaved: () => void;
}) {
  const [balance,setBalance]=useState<CashBalance|null>(null);
  const [recipients,setRecipients]=useState<CashRecipient[]>([]);
  const [error,setError]=useState(""); const [reload,setReload]=useState(0);
  const [open,setOpen]=useState(false); const [busy,setBusy]=useState(false);
  const [amount,setAmount]=useState(""); const [recipient,setRecipient]=useState("");
  const [shift,setShift]=useState("MORNING"); const [count,setCount]=useState(""); const [note,setNote]=useState("");
  const retry=useRef<{signature:string;key:string}|null>(null);
  useEffect(()=>{
    let active=true;setBalance(null);setError("");
    Promise.all([api.cashBalance(),api.cashRecipients()]).then(([value,people])=>{if(active){setBalance(value);setRecipients(people);}})
      .catch(cause=>{if(active)setError(apiErrorMessage(cause,"Không thể tải số dư và người nhận bàn giao."));});
    return ()=>{active=false;};
  },[reload,actor]);
  const rows=handovers.filter(row=>row.handed_over_at.slice(0,10)===date);
  const alreadyHanded=rows.some(row=>row.from_actor===actor && row.shift_code===shift);
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy || !balance)return;setError("");
    try{
      const actual=Number(amount);
      if(!amount.trim() || !Number.isSafeInteger(actual) || actual<0)throw new Error("Nhập số tiền thực đếm bằng VND, không âm.");
      if(!recipients.some(row=>row.employee_id===recipient))throw new Error("Chọn nhân viên nhận bàn giao.");
      if(actual!==balance.expected_amount && !note.trim())throw new Error("Tiền thực đếm khác dự kiến; cần ghi chú nguyên nhân để đối soát.");
      const body={shift_code:shift,from_actor:balance.actor_id,to_actor:recipient,actual_amount:actual,note:note.trim()||null,denominations:parseCashCount(count,actual)};
      const signature=JSON.stringify(body);
      if(retry.current?.signature!==signature)retry.current={signature,key:newKitchenIdempotencyKey()};
      setBusy(true);await api.recordCashHandover(body,retry.current.key);
      retry.current=null;setOpen(false);setAmount("");setCount("");setNote("");setRecipient("");setReload(value=>value+1);onSaved();
    }catch(cause){setError(accountingErrorMessage(cause,"Không thể ghi nhận bàn giao."));}
    finally{setBusy(false);}
  };
  return <section style={{flex:"1 1 50%",minWidth:340,display:"flex",flexDirection:"column",background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,overflow:"auto"}}>
    <div style={{padding:18,borderBottom:"1px solid #E2E8F0"}}>
      <strong>Bàn giao két tiền</strong>
      <p style={{fontSize:12,color:"#64748B",marginTop:6}}>Số dư của {actor || "nhân viên đang đăng nhập"}, sau các lần bàn giao đã chốt.</p>
      <p style={{fontSize:24,fontWeight:800,margin:"10px 0"}}>{balance ? formatVnd(balance.expected_amount) : error ? "Chưa tải được số dư" : "Đang tải số dư…"}</p>
      {balance && <p style={{fontSize:11,color:"#64748B"}}>Thu {formatVnd(balance.payments)} − hoàn {formatVnd(balance.refunds)} + nhận bàn giao {formatVnd(balance.received_handovers)} − dự kiến đã chốt {formatVnd(balance.handed_over_expected)} − chi tiền mặt {formatVnd(balance.cash_expenses + balance.cash_debt_settlements)}.</p>}
      <div style={{display:"flex",gap:8,marginTop:12}}>
        <button type="button" disabled={!balance || busy} style={{...(open?secondaryActionStyle:primaryActionStyle),...(!balance || busy?disabledActionStyle:{})}} onClick={()=>{setOpen(value=>!value);setError("");}}>{open?"Đóng biểu mẫu":"Ghi nhận bàn giao"}</button>
        <button type="button" disabled={busy} style={{...secondaryActionStyle,...(busy?disabledActionStyle:{})}} onClick={()=>setReload(value=>value+1)}>Tải lại số dư</button>
        <button type="button" style={secondaryActionStyle} onClick={()=>window.print()}>In biên bản bàn giao</button>
      </div>
    </div>
    {error && <p role="alert" style={{padding:14,color:"#B91C1C"}}>{error}</p>}
    {open && <form onSubmit={event=>void submit(event)} style={{padding:18,background:"#F8FAFC",borderBottom:"1px solid #E2E8F0"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12,fontSize:12}}>
        <label>Ca bàn giao<select value={shift} onChange={event=>setShift(event.target.value)} disabled={busy} style={inputStyle}><option value="MORNING">Ca sáng</option><option value="AFTERNOON">Ca chiều</option><option value="NIGHT">Ca đêm</option></select></label>
        <label>Nhân viên nhận<select required value={recipient} onChange={event=>setRecipient(event.target.value)} disabled={busy} style={inputStyle}><option value="">Chọn người nhận</option>{recipients.map(row=><option key={row.employee_id} value={row.employee_id}>{row.full_name} ({row.employee_id})</option>)}</select></label>
        <label>Số tiền thực đếm<input required type="number" min="0" step="1" value={amount} onChange={event=>setAmount(event.target.value)} disabled={busy} style={inputStyle}/></label>
        <label>Chi tiết mệnh giá (tùy chọn)<input value={count} onChange={event=>setCount(event.target.value)} placeholder="500000:2,200000:1" disabled={busy} style={inputStyle}/></label>
      </div>
      <label style={{display:"block",fontSize:12,marginTop:12}}>Ghi chú đối soát<input maxLength={500} value={note} onChange={event=>setNote(event.target.value)} disabled={busy} style={inputStyle}/></label>
      {alreadyHanded && <p style={{fontSize:12,color:"#B45309",marginTop:8}}>Đã có biên bản ca này trong ngày đang xem. Bàn giao mới luôn ghi theo ngày hiện tại.</p>}
      <button type="submit" disabled={busy || !balance} style={{...primaryActionStyle,marginTop:12,...(busy || !balance?disabledActionStyle:{})}}>{busy?"Đang lưu…":"Lưu bàn giao"}</button>
    </form>}
    <div style={{padding:"12px 18px",fontSize:12,fontWeight:700}}>Lịch sử bàn giao ngày {date} — {rows.length} biên bản</div>
    <div style={{overflow:"auto",flex:1}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr>{["Thời điểm / ca","Người giao → nhận","Dự kiến","Thực đếm","Chênh lệch"].map(label=><th key={label} style={{padding:10,textAlign:"left",background:"#F8FAFC"}}>{label}</th>)}</tr></thead>
      <tbody>{rows.map(row=><tr key={row.id}><td style={{padding:10}}>{formatDateTimeVi(row.handed_over_at)}<br/>{row.shift_code}</td><td style={{padding:10}}>{row.from_actor} → {row.to_actor}</td><td>{formatVnd(row.expected_amount)}</td><td>{formatVnd(row.actual_amount)}</td><td style={{color:row.variance===0?"#15803D":"#B91C1C"}}>{formatVnd(row.variance)}</td></tr>)}{rows.length===0 && <tr><td colSpan={5} style={{padding:24,textAlign:"center"}}>Chưa có bàn giao trong ngày đã chọn.</td></tr>}</tbody></table></div>
  </section>;
}
