import { useEffect, useRef, useState } from "react";
import { kitchenAccountingApi as api, newKitchenIdempotencyKey } from "../../shared/api/kitchenAccounting";
import { apiErrorMessage } from "../../shared/api/client";
import type { Expense, PartnerDebt, DebtSettlement, PaymentMethod } from "../../shared/types/kitchenAccounting";
import { formatVnd } from "../../shared/utils/money";
import { formatDateTimeVi } from "../../shared/utils/localDate";
import { accountingErrorMessage } from "./accountingLogic";
import { compactActionStyle, disabledActionStyle, primaryActionStyle, secondaryActionStyle } from "./accountingUi";

export const paymentMethods: {value:PaymentMethod;label:string}[]=[{value:"CASH",label:"Tiền mặt"},{value:"CARD",label:"Thẻ"},{value:"BANK_TRANSFER",label:"Chuyển khoản ngân hàng"}];
export const methodLabel=(method:PaymentMethod|null)=>paymentMethods.find(row=>row.value===method)?.label??"Chưa ghi phương thức";
export const fieldStyle={width:"100%",height:34,padding:"0 8px",border:"1px solid #CBD5E1",borderRadius:7,marginTop:4,boxSizing:"border-box" as const};
export const buttonStyle=primaryActionStyle;
export function MethodSelect({value,onChange,disabled}:{value:PaymentMethod;onChange:(method:PaymentMethod)=>void;disabled?:boolean}){
  return <select aria-label="Phương thức giao dịch" style={fieldStyle} value={value} disabled={disabled} onChange={event=>onChange(event.target.value as PaymentMethod)}>{paymentMethods.map(row=><option key={row.value} value={row.value}>{row.label}</option>)}</select>;
}

export default function FinanceOperations({debts,onChanged,date}:{debts:PartnerDebt[];onChanged:()=>void;date:string}){
  const [expenses,setExpenses]=useState<Expense[]>([]);const [history,setHistory]=useState<DebtSettlement[]>([]);
  const [mode,setMode]=useState<"expense"|"debt"|"settlement"|null>(null);const [debt,setDebt]=useState<PartnerDebt|null>(null);
  const [error,setError]=useState("");const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [reload,setReload]=useState(0);
  const [first,setFirst]=useState("");const [second,setSecond]=useState("");const [amount,setAmount]=useState("");const [method,setMethod]=useState<PaymentMethod>("BANK_TRANSFER");
  const retry=useRef<{signature:string;key:string}|null>(null);
  useEffect(()=>{if(debt)setDebt(debts.find(row=>row.id===debt.id)??null);},[debts]);
  useEffect(()=>{let active=true;setLoading(true);api.expenses().then(rows=>{if(active)setExpenses(rows);}).catch(cause=>{if(active)setError(apiErrorMessage(cause,"Không tải được khoản chi."));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[reload]);
  useEffect(()=>{let active=true;setHistory([]);if(debt)api.settlements(debt.id).then(rows=>{if(active)setHistory(rows);}).catch(cause=>{if(active)setError(apiErrorMessage(cause,"Không tải được lịch sử tất toán."));});return()=>{active=false;};},[debt,reload]);
  const open=(next:typeof mode,row:PartnerDebt|null=null)=>{setMode(next);setDebt(row);setFirst("");setSecond("");setAmount("");setError("");retry.current=null;};
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy)return;setError("");
    try{
      const value=Number(amount);if(!amount.trim() || !Number.isSafeInteger(value) || value<=0)throw new Error("Số tiền phải là VND nguyên, lớn hơn 0.");
      if(mode!=="settlement" && (!first.trim() || !second.trim()))throw new Error("Điền đầy đủ các thông tin chứng từ.");
      if(mode==="settlement" && (!debt || value>debt.amount-debt.settled_amount))throw new Error("Số tiền tất toán vượt công nợ còn lại.");
      const signature=JSON.stringify({mode,id:debt?.id,first:first.trim(),second:second.trim(),value,method});
      if(retry.current?.signature!==signature)retry.current={signature,key:newKitchenIdempotencyKey()};
      setBusy(true);
      if(mode==="expense")await api.recordExpense({category:first.trim(),description:second.trim(),amount:value,method},retry.current.key);
      else if(mode==="debt")await api.recordPartnerDebt({partner_name:first.trim(),reference_code:second.trim(),amount:value},retry.current.key);
      else if(debt)await api.settlePartnerDebt(debt.id,{amount:value,note:second.trim()||null,method},retry.current.key);
      setMode(null);retry.current=null;setReload(value=>value+1);onChanged();
    }catch(cause){setError(accountingErrorMessage(cause,"Không thể ghi nhận giao dịch."));}finally{setBusy(false);}
  };
  const dailyExpenses=expenses.filter(row=>row.paid_at.slice(0,10)===date);
  const outstanding=debts.filter(row=>row.status!=="VOIDED").reduce((sum,row)=>sum+Math.max(0,row.amount-row.settled_amount),0);
  return <section style={{padding:22,flex:1,overflow:"auto"}}>
    <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:16}}><div style={{flex:1}}><h2 style={{fontSize:18}}>Thu chi & công nợ nhà cung cấp</h2><p style={{fontSize:12,color:"#64748B",marginTop:6}}>Công nợ phải trả còn lại: <strong>{formatVnd(outstanding)}</strong>. Ghi nợ chưa phải là chi tiền.</p></div><button type="button" style={{...buttonStyle,...(busy?disabledActionStyle:{})}} disabled={busy} onClick={()=>open("expense")}>Ghi khoản chi</button><button type="button" style={{...buttonStyle,...(busy?disabledActionStyle:{})}} disabled={busy} onClick={()=>open("debt")}>Ghi công nợ</button></div>
    {error && <p role="alert" style={{color:"#B91C1C",padding:12}}>{error} <button type="button" style={compactActionStyle} onClick={()=>{setError("");setReload(value=>value+1);onChanged();}}>Tải lại</button></p>}
    {mode && <form onSubmit={event=>void submit(event)} style={{background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,padding:18,marginBottom:20}}>
      <h3>{mode==="expense"?"Ghi khoản chi":mode==="debt"?"Ghi công nợ phải trả":`Thanh toán công nợ ${debt?.reference_code}`}</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,fontSize:12,marginTop:12}}>
        {mode!=="settlement" && <label>{mode==="expense"?"Nhóm chi phí":"Nhà cung cấp"}<input required value={first} maxLength={mode==="expense"?100:150} onChange={event=>setFirst(event.target.value)} style={fieldStyle} disabled={busy}/></label>}
        <label>{mode==="expense"?"Mô tả chứng từ":mode==="debt"?"Mã chứng từ / hợp đồng":"Ghi chú thanh toán"}<input required={mode!=="settlement"} value={second} maxLength={mode==="expense"?255:mode==="debt"?80:500} onChange={event=>setSecond(event.target.value)} style={fieldStyle} disabled={busy}/></label>
        <label>Số tiền (VND)<input type="number" required min="1" step="1" max={mode==="settlement" && debt?debt.amount-debt.settled_amount:undefined} value={amount} onChange={event=>setAmount(event.target.value)} style={fieldStyle} disabled={busy}/></label>
        {mode!=="debt" && <label>Phương thức thanh toán<MethodSelect value={method} onChange={setMethod} disabled={busy}/></label>}
      </div>
      <div style={{display:"flex",gap:8,marginTop:14}}><button type="submit" style={{...buttonStyle,...(busy?disabledActionStyle:{})}} disabled={busy}>{busy?"Đang lưu…":"Lưu chứng từ"}</button><button type="button" style={{...secondaryActionStyle,...(busy?disabledActionStyle:{})}} disabled={busy} onClick={()=>setMode(null)}>Đóng</button></div>
    </form>}
    <div style={{overflow:"auto",background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12}}><table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr>{["Chứng từ","Nhà cung cấp","Tổng nợ","Đã trả","Còn lại","Trạng thái","Thao tác"].map(label=><th key={label} style={{padding:12,textAlign:"left"}}>{label}</th>)}</tr></thead><tbody>{debts.map(row=><tr key={row.id} style={{borderTop:"1px solid #E2E8F0"}}><td style={{padding:12}}>{row.reference_code}</td><td>{row.partner_name}</td><td>{formatVnd(row.amount)}</td><td>{formatVnd(row.settled_amount)}</td><td>{formatVnd(Math.max(0,row.amount-row.settled_amount))}</td><td>{({OPEN:"Chưa thanh toán",PARTIALLY_SETTLED:"Đã trả một phần",SETTLED:"Đã tất toán",VOIDED:"Đã hủy"} as Record<string,string>)[row.status]??row.status}</td><td style={{padding:12}}><button type="button" style={{...compactActionStyle,...(busy?disabledActionStyle:{})}} disabled={busy} onClick={()=>open(row.status==="SETTLED" || row.status==="VOIDED"?null:"settlement",row)}>Chi tiết / thanh toán</button></td></tr>)}{debts.length===0 && <tr><td colSpan={7} style={{padding:24}}>Chưa có công nợ nhà cung cấp.</td></tr>}</tbody></table></div>
    {debt && <div style={{padding:16,marginTop:12,background:"#FFF",borderRadius:12}}><strong>Lịch sử thanh toán {debt.reference_code}</strong>{history.map(row=><p key={row.id} style={{fontSize:12,marginTop:8}}>{formatDateTimeVi(row.settled_at)} · {formatVnd(row.amount)} · {methodLabel(row.method)} · {row.settled_by} · {row.note}</p>)}{history.length===0 && <p style={{fontSize:12,marginTop:8}}>Chưa có thanh toán.</p>}</div>}
    <div style={{marginTop:24,padding:18,background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12}}><h3>Khoản chi ngày {date}</h3><p style={{fontSize:12,color:"#64748B",marginTop:6}}>Tổng khoản chi còn hiệu lực: {formatVnd(dailyExpenses.filter(row=>row.status!=="VOIDED").reduce((sum,row)=>sum+row.amount,0))}. Thanh toán công nợ được theo dõi riêng.</p>{loading?<p>Đang tải khoản chi…</p>:dailyExpenses.map(row=><p key={row.id} style={{fontSize:12,padding:"10px 0",borderBottom:"1px solid #F1F5F9"}}>{formatDateTimeVi(row.paid_at)} · {row.category} · {row.description} · <strong>{formatVnd(row.amount)}</strong> · {methodLabel(row.method)} · {row.status}</p>)}{!loading && dailyExpenses.length===0 && <p style={{fontSize:12,paddingTop:12}}>Chưa có khoản chi trong ngày đã chọn.</p>}</div>
  </section>;
}
