import { AccountingDialog } from "./AccountingDialog";
import { useEffect, useRef, useState } from "react";
import { kitchenAccountingApi as api, newKitchenIdempotencyKey } from "../../shared/api/kitchenAccounting";
import { apiErrorMessage } from "../../shared/api/client";
import type { Approval, Expense, PartnerDebt, DebtSettlement, PaymentMethod } from "../../shared/types/kitchenAccounting";
import { formatVnd } from "../../shared/utils/money";
import { formatDateTimeVi } from "../../shared/utils/localDate";
import { accountingErrorMessage, cashVoucherHtml, cashVoucherMethod, cashVoucherStyles, expensePurposes, printCashVoucher, receiptPurposes, type CashVoucher, type CashVoucherPrintDetails } from "./accountingLogic";
import { compactActionStyle, disabledActionStyle, primaryActionStyle, secondaryActionStyle } from "./accountingUi";

export const paymentMethods: {value:PaymentMethod;label:string}[]=[{value:"CASH",label:"Tiền mặt"},{value:"CARD",label:"Thẻ"},{value:"BANK_TRANSFER",label:"Chuyển khoản ngân hàng"}];
export const methodLabel=(method:PaymentMethod|null)=>paymentMethods.find(row=>row.value===method)?.label??"Chưa ghi phương thức";
export const fieldStyle={width:"100%",height:34,padding:"0 8px",border:"1px solid #CBD5E1",borderRadius:7,marginTop:4,boxSizing:"border-box" as const};
export const buttonStyle=primaryActionStyle;
export function MethodSelect({value,onChange,disabled}:{value:PaymentMethod;onChange:(method:PaymentMethod)=>void;disabled?:boolean}){
  return <select aria-label="Phương thức giao dịch" style={fieldStyle} value={value} disabled={disabled} onChange={event=>onChange(event.target.value as PaymentMethod)}>{paymentMethods.map(row=><option key={row.value} value={row.value}>{row.label}</option>)}</select>;
}

export default function FinanceOperations({debts,onChanged,date,employee}:{debts:PartnerDebt[];onChanged:()=>void;date:string;employee?:{employee_id:string;full_name:string}|null}){
  const [expenses,setExpenses]=useState<Expense[]>([]);const [history,setHistory]=useState<DebtSettlement[]>([]);
  const [mode,setMode]=useState<"expense"|"debt"|"settlement"|null>(null);const [debt,setDebt]=useState<PartnerDebt|null>(null);
  const [error,setError]=useState("");const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [reload,setReload]=useState(0);
  const [first,setFirst]=useState("");const [second,setSecond]=useState("");const [amount,setAmount]=useState("");const [method,setMethod]=useState<PaymentMethod>("BANK_TRANSFER");
  const [voucher,setVoucher]=useState<CashVoucher|null>(null);
  const openExpenseVoucher=(row:Expense)=>setVoucher({kind:"expense",number:`PC-${String(row.id).padStart(6,"0")}`,occurredAt:row.paid_at,amount:row.amount,method:row.method,issuerId:row.paid_by,issuerName:employee?.employee_id===row.paid_by?employee.full_name:"",reference:`Khoản chi #${row.id} · ${row.category}`,reason:row.description});
  const retry=useRef<{signature:string;key:string;approvalKey:string}|null>(null);
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
      if(retry.current?.signature!==signature)retry.current={signature,key:newKitchenIdempotencyKey(),approvalKey:newKitchenIdempotencyKey()};
      setBusy(true);
      if(mode==="expense"){
        const body={category:first.trim(),description:second.trim(),amount:value,method};
        if(value>10000000)await api.requestFinancial("expense",body,retry.current.key,retry.current.approvalKey);
        else openExpenseVoucher(await api.recordExpense(body,retry.current.key));
      }
      else if(mode==="debt")await api.recordPartnerDebt({partner_name:first.trim(),reference_code:second.trim(),amount:value},retry.current.key);
      else if(debt){const body={amount:value,note:second.trim()||null,method};if(value>10000000)await api.requestFinancial("settlement",body,retry.current.key,retry.current.approvalKey,debt.id);else await api.settlePartnerDebt(debt.id,body,retry.current.key);}
      setMode(null);retry.current=null;setReload(value=>value+1);onChanged();
    }catch(cause){setError(accountingErrorMessage(cause,"Không thể ghi nhận giao dịch."));}finally{setBusy(false);}
  };
  const dailyExpenses=expenses.filter(row=>row.paid_at.slice(0,10)===date);
  const outstanding=debts.filter(row=>row.status!=="VOIDED").reduce((sum,row)=>sum+Math.max(0,row.amount-row.settled_amount),0);
  return <section className="acct-panel" style={{padding:22,flex:1,overflow:"auto"}}>
    <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:16}}><div style={{flex:1}}><h2 style={{fontSize:18}}>Thu chi & công nợ nhà cung cấp</h2><p style={{fontSize:12,color:"#64748B",marginTop:6}}>Công nợ phải trả còn lại: <strong>{formatVnd(outstanding)}</strong>. Ghi nợ chưa phải là chi tiền.</p></div><button type="button" style={{...buttonStyle,...(busy?disabledActionStyle:{})}} disabled={busy} onClick={()=>open("expense")}>Ghi khoản chi</button><button type="button" style={{...buttonStyle,...(busy?disabledActionStyle:{})}} disabled={busy} onClick={()=>open("debt")}>Ghi công nợ</button></div>
    {error && !mode && <p role="alert" style={{color:"#B91C1C",padding:12}}>{error} <button type="button" style={compactActionStyle} onClick={()=>{setError("");setReload(value=>value+1);onChanged();}}>Tải lại</button></p>}
    {mode && <AccountingDialog title={mode==="expense"?"Ghi khoản chi":mode==="debt"?"Ghi công nợ nhà cung cấp":`Thanh toán công nợ ${debt?.reference_code}`} description="Kiểm tra thông tin chứng từ trước khi ghi nhận." busy={busy} onClose={()=>setMode(null)}><form className="acct-form" onSubmit={event=>void submit(event)} style={{background:"#FFF"}}>
      {error && <p role="alert">{error}</p>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,fontSize:12,marginTop:12}}>
        {mode!=="settlement" && <label>{mode==="expense"?"Nhóm chi phí":"Nhà cung cấp"}<input required value={first} maxLength={mode==="expense"?100:150} onChange={event=>setFirst(event.target.value)} style={fieldStyle} disabled={busy}/></label>}
        <label>{mode==="expense"?"Mô tả chứng từ":mode==="debt"?"Mã chứng từ / hợp đồng":"Ghi chú thanh toán"}<input required={mode!=="settlement"} value={second} maxLength={mode==="expense"?255:mode==="debt"?80:500} onChange={event=>setSecond(event.target.value)} style={fieldStyle} disabled={busy}/></label>
        <label>Số tiền (VND)<input type="number" required min="1" step="1" max={mode==="settlement" && debt?debt.amount-debt.settled_amount:undefined} value={amount} onChange={event=>setAmount(event.target.value)} style={fieldStyle} disabled={busy}/></label>
        {mode!=="debt" && <label>Phương thức thanh toán<MethodSelect value={method} onChange={setMethod} disabled={busy}/></label>}
      </div>
      {mode!=="debt"&&Number(amount)>10000000&&<p>Khoản chi trên 10 triệu phải được Giám đốc duyệt trước khi ghi nhận. Số dư chưa thay đổi khi gửi yêu cầu.</p>}
      <div style={{display:"flex",gap:8,marginTop:14}}><button type="submit" style={{...buttonStyle,...(busy?disabledActionStyle:{})}} disabled={busy}>{busy?"Đang lưu…":mode!=="debt"&&Number(amount)>10000000?"Gửi Giám đốc duyệt":"Lưu chứng từ"}</button><button type="button" style={{...secondaryActionStyle,...(busy?disabledActionStyle:{})}} disabled={busy} onClick={()=>setMode(null)}>Đóng</button></div>
    </form></AccountingDialog>}
    <div className="acct-table-wrap" style={{overflow:"auto",background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12}}><table className="acct-table" style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr>{["Chứng từ","Nhà cung cấp","Tổng nợ","Đã trả","Còn lại","Trạng thái","Thao tác"].map(label=><th key={label} style={{padding:12,textAlign:"left"}}>{label}</th>)}</tr></thead><tbody>{debts.map(row=><tr key={row.id} style={{borderTop:"1px solid #E2E8F0"}}><td style={{padding:12}}>{row.reference_code}</td><td>{row.partner_name}</td><td>{formatVnd(row.amount)}</td><td>{formatVnd(row.settled_amount)}</td><td>{formatVnd(Math.max(0,row.amount-row.settled_amount))}</td><td>{({OPEN:"Chưa thanh toán",PARTIALLY_SETTLED:"Đã trả một phần",SETTLED:"Đã tất toán",VOIDED:"Đã hủy"} as Record<string,string>)[row.status]??row.status}</td><td style={{padding:12}}><button type="button" style={{...compactActionStyle,...(busy?disabledActionStyle:{})}} disabled={busy} onClick={()=>open(row.status==="SETTLED" || row.status==="VOIDED"?null:"settlement",row)}>Chi tiết / thanh toán</button></td></tr>)}{debts.length===0 && <tr><td colSpan={7} style={{padding:24}}>Chưa có công nợ nhà cung cấp.</td></tr>}</tbody></table></div>
    {debt && <div style={{padding:16,marginTop:12,background:"#FFF",borderRadius:12}}><strong>Lịch sử thanh toán {debt.reference_code}</strong>{history.map(row=><p key={row.id} style={{fontSize:12,marginTop:8}}>{formatDateTimeVi(row.settled_at)} · {formatVnd(row.amount)} · {methodLabel(row.method)} · {row.settled_by} · {row.note}</p>)}{history.length===0 && <p style={{fontSize:12,marginTop:8}}>Chưa có thanh toán.</p>}</div>}
    <div style={{marginTop:24,padding:18,background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12}}><h3>Phiếu chi ngày {date}</h3><p style={{fontSize:12,color:"#64748B",marginTop:6}}>Tổng khoản chi còn hiệu lực: {formatVnd(dailyExpenses.filter(row=>row.status!=="VOIDED").reduce((sum,row)=>sum+row.amount,0))}. Thanh toán công nợ được theo dõi riêng.</p>
      {loading?<p>Đang tải khoản chi…</p>:<div className="acct-table-wrap" style={{marginTop:14}}><table className="acct-table"><thead><tr>{["Số phiếu / Thời điểm","Nội dung chi","Số tiền","Phương thức","Thao tác"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{dailyExpenses.map(row=><tr key={row.id}><td><strong>PC-{String(row.id).padStart(6,"0")}</strong><br/>{formatDateTimeVi(row.paid_at)}</td><td>{row.category}<br/>{row.description}{row.status==="VOIDED"&&<strong> · Đã hủy</strong>}</td><td>{formatVnd(row.amount)}</td><td>{methodLabel(row.method)}</td><td><button type="button" disabled={busy||row.status==="VOIDED"} style={{...compactActionStyle,...(busy||row.status==="VOIDED"?disabledActionStyle:{})}} onClick={()=>openExpenseVoucher(row)}>In phiếu chi PC-{String(row.id).padStart(6,"0")}</button></td></tr>)}</tbody></table></div>}
      {!loading && dailyExpenses.length===0 && <p style={{fontSize:12,paddingTop:12}}>Chưa có khoản chi trong ngày đã chọn.</p>}
    </div>
    <FinancialApprovalQueue operation="expense" refresh={reload} onChanged={()=>{setReload(value=>value+1);onChanged();}} onExpense={openExpenseVoucher}/>
    {voucher&&<CashVoucherDialog key={`${voucher.kind}-${voucher.number}`} voucher={voucher} onClose={()=>setVoucher(null)}/>}
  </section>;
}

/** Approved requests remain immutable; executing reuses the original transaction key. */
export function FinancialApprovalQueue({operation,refresh,onChanged,onExpense}:{operation:"expense"|"payment";refresh:number;onChanged:()=>void;onExpense?:(row:Expense)=>void}){
  const [version,setVersion]=useState(0);const [rows,setRows]=useState<Approval[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState<number|null>(null);
  useEffect(()=>{let active=true;api.financialRequests().then(result=>{if(active){setRows(result.filter(row=>row.target_id.startsWith(`finance:${operation}:`) || operation==="expense"&&row.target_id.startsWith("finance:settlement:")));setError("");}}).catch(cause=>{if(active)setError(apiErrorMessage(cause,"Không tải được yêu cầu duyệt thu/chi."));});return()=>{active=false;};},[refresh,operation,version]);
  const execute=async(row:Approval)=>{
    if(busy!==null)return;setBusy(row.id);setError("");
    try{
      const data=JSON.parse(row.payload),amount=row.amount??0;
      if(row.target_id.startsWith("finance:settlement:"))await api.settlePartnerDebt(data.debt_id,{amount,method:data.method,note:data.note||null},data.idempotency_key);
      else if(operation==="expense"){
        const saved=await api.recordExpense({category:data.category,description:data.description,amount,method:data.method},data.idempotency_key);onExpense?.(saved);
      }else await api.recordPayment(data.invoice_id,{amount,method:data.method,type:"PAYMENT",reference:data.reference||null},data.idempotency_key);
      onChanged();
    }catch(cause){setError(apiErrorMessage(cause,"Không thể ghi nhận khoản thu/chi đã duyệt."));}finally{setBusy(null);}
  };
  return <section style={{marginTop:22}}><h3>Yêu cầu duyệt {operation==="expense"?"chi":"thu"} tiền trên 10 triệu</h3><p style={{fontSize:12,color:"#64748B",marginTop:6}}>Chờ Giám đốc duyệt trước khi ghi nhận. Duyệt thành công chưa làm thay đổi số dư.</p>{error&&<p role="alert">{error}</p>}{rows.map(row=><div key={row.id} style={{padding:"12px 0",borderBottom:"1px solid #E2E8F0",display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}><span>#{row.id} · {row.reason} · {formatVnd(row.amount??0)}</span><strong>{({PENDING:"Chờ Giám đốc duyệt",APPROVED:"Đã duyệt, chưa ghi nhận",CONSUMED:"Đã ghi nhận",REJECTED:"Bị từ chối",EXPIRED:"Hết hạn"} as Record<string,string>)[row.status]??row.status}</strong>{row.status==="APPROVED"&&!row.consumed_at&&<button type="button" disabled={busy!==null} style={primaryActionStyle} onClick={()=>void execute(row)}>{busy===row.id?"Đang ghi nhận…":"Ghi nhận khoản đã duyệt"}</button>}</div>)}{!rows.length&&!error&&<p style={{marginTop:8}}>Chưa có yêu cầu.</p>}</section>;
}

/** Shared KT_BM1/KT_BM2 preview. No API mutation or persistent browser storage. */
export function CashVoucherDialog({voucher,onClose}:{voucher:CashVoucher;onClose:()=>void}) {
  const choices=voucher.kind==="receipt"?receiptPurposes:expensePurposes;
  const [details,setDetails]=useState<CashVoucherPrintDetails>({counterpartyName:voucher.counterpartyName??"",issuerName:voucher.issuerName,reason:voucher.reason,purpose:choices.find(label=>voucher.reason.toLocaleLowerCase("vi-VN").includes(label.toLocaleLowerCase("vi-VN")))??(voucher.kind==="receipt"?receiptPurposes[1]:expensePurposes[5])});
  const [error,setError]=useState("");
  const update=(field:keyof CashVoucherPrintDetails,value:string)=>{setDetails(previous=>({...previous,[field]:value}));setError("");};
  const print=(event:React.FormEvent)=>{
    event.preventDefault();setError("");
    try{printCashVoucher(voucher,details,setError);}catch(cause){setError(accountingErrorMessage(cause,"Không thể in phiếu."));}
  };
  return <AccountingDialog className="acct-voucher-dialog" title={voucher.kind==="receipt"?"In phiếu thu · KT_BM1":"In phiếu chi · KT_BM2"} description={`${voucher.number} · ${cashVoucherMethod(voucher.method)} · ${formatVnd(voucher.amount)}`} busy={false} onClose={onClose}>
    <div className="acct-voucher-layout">
      <form className="acct-form acct-voucher-fields" onSubmit={print}>
        <p className="acct-voucher-help">Thông tin bổ sung chỉ dùng cho lần in này. Khi đóng phiếu, các thông tin này sẽ không được lưu.</p>
        {error&&<p role="alert">{error}</p>}
        <label>Họ tên người {voucher.kind==="receipt"?"nộp":"nhận"} tiền<input required maxLength={150} value={details.counterpartyName} onChange={event=>update("counterpartyName",event.target.value)}/></label>
        <label>Nhóm lý do<select value={details.purpose} onChange={event=>update("purpose",event.target.value)}>{choices.map(choice=><option key={choice} value={choice}>{choice}</option>)}</select></label>
        <label>Lý do {voucher.kind==="receipt"?"thu":"chi"}<textarea required maxLength={500} rows={3} value={details.reason} onChange={event=>update("reason",event.target.value)}/></label>
        <label>Kế toán lập phiếu<input required maxLength={150} value={details.issuerName} onChange={event=>update("issuerName",event.target.value)}/><small>Mã nhân viên ghi nhận: {voucher.issuerId}</small></label>
        <p className="acct-voucher-help">Trong hộp thoại in, chọn “Lưu dưới dạng PDF” để tải phiếu.</p>
        <div className="acct-voucher-actions"><button type="button" style={secondaryActionStyle} onClick={onClose}>Đóng</button><button type="submit" style={primaryActionStyle}>In / Lưu PDF</button></div>
      </form>
      <section className="acct-voucher-preview" aria-label="Xem trước phiếu"><style>{cashVoucherStyles}</style><div dangerouslySetInnerHTML={{__html:cashVoucherHtml(voucher,details)}}/></section>
    </div>
  </AccountingDialog>;
}
