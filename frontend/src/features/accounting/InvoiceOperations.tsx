import { AccountingDialog } from "./AccountingDialog";
import { useEffect, useRef, useState } from "react";
import { kitchenAccountingApi as api, newKitchenIdempotencyKey, toRows } from "../../shared/api/kitchenAccounting";
import { enterpriseApi } from "../../shared/api/enterprise";
import { apiErrorMessage } from "../../shared/api/client";
import type { Invoice, Payment, Receipt, Approval, PaymentMethod, Page } from "../../shared/types/kitchenAccounting";
import type { VatInvoice } from "../../shared/types/enterprise";
import { formatVnd } from "../../shared/utils/money";
import { formatDateTimeVi } from "../../shared/utils/localDate";
import { accountingErrorMessage, invoiceTotal, refundablePaymentAmount, type CashVoucher } from "./accountingLogic";
import { CashVoucherDialog, FinancialApprovalQueue, MethodSelect, methodLabel, fieldStyle, buttonStyle } from "./FinanceOperations";
import { compactActionStyle, disabledActionStyle, primaryActionStyle, secondaryActionStyle } from "./accountingUi";

export default function InvoiceOperations({onChanged,onVatCreated,refresh,search,vatInvoices,employee}:{onChanged:()=>void;onVatCreated:(row:VatInvoice)=>void;refresh:number;search:string;vatInvoices:VatInvoice[];employee?:{employee_id:string;full_name:string}|null}){
  const [page,setPage]=useState(0);const [data,setData]=useState<Page<Invoice>|null>(null);const [selected,setSelected]=useState<Invoice|null>(null);
  const [payments,setPayments]=useState<Payment[]>([]);const [receipts,setReceipts]=useState<Receipt[]>([]);const [requests,setRequests]=useState<Approval[]>([]);
  const [error,setError]=useState("");const [loading,setLoading]=useState(true);const [detailsLoading,setDetailsLoading]=useState(false);const [busy,setBusy]=useState(false);
  const [mode,setMode]=useState<"payment"|"refund"|"receipt"|"vat"|null>(null);
  const [amount,setAmount]=useState("");const [method,setMethod]=useState<PaymentMethod>("CASH");const [reference,setReference]=useState("");
  const [customerType,setCustomerType]=useState("INDIVIDUAL");const [customerName,setCustomerName]=useState("");const [taxCode,setTaxCode]=useState("");const [company,setCompany]=useState("");const [address,setAddress]=useState("");
  const [voucher,setVoucher]=useState<CashVoucher|null>(null);
  const openReceiptVoucher=(row:Receipt)=>setVoucher({kind:"receipt",number:row.receipt_number,occurredAt:row.issued_at,amount:row.amount,method:row.method,issuerId:row.issued_by,issuerName:employee?.employee_id===row.issued_by?employee.full_name:"",reference:`Hóa đơn INV-${row.invoice_id}${selected?` · Đặt phòng #${selected.reservation_id}`:""}`,reason:`Thu tiền theo hóa đơn INV-${row.invoice_id}`});
  const retry=useRef<{signature:string;key:string;approvalKey:string}|null>(null);
  const reservationId=search.trim()?Number(search.trim()):undefined;
  useEffect(()=>setPage(0),[search]);
  useEffect(()=>{let active=true;setLoading(true);setError("");
    if(search.trim() && (!Number.isSafeInteger(reservationId) || (reservationId??0)<=0)){setError("Nhập mã đặt phòng bằng số để tìm hóa đơn.");setLoading(false);return;}
    api.invoices({page,size:10,reservation_id:reservationId}).then(result=>{if(active){setData(result);if(page>=Math.max(1,result.totalPages))setPage(Math.max(0,result.totalPages-1));}}).catch(cause=>{if(active)setError(apiErrorMessage(cause,"Không thể tải hóa đơn."));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[page,refresh,reservationId,search]);
  useEffect(()=>{let active=true;api.refundRequests().then(rows=>{if(active)setRequests(rows);}).catch(cause=>{if(active)setError(apiErrorMessage(cause,"Không thể tải yêu cầu hoàn tiền."));});return()=>{active=false;};},[refresh]);
  useEffect(()=>{
    let active=true;if(!selected){setPayments([]);setReceipts([]);return;}setDetailsLoading(true);setError("");
    Promise.all([api.invoicePayments(selected.id),api.invoiceReceipts(selected.id)]).then(([pay,rcpt])=>{if(active){setPayments(toRows(pay));setReceipts(toRows(rcpt));}}).catch(cause=>{if(active)setError(apiErrorMessage(cause,"Không thể tải giao dịch / biên lai của hóa đơn."));}).finally(()=>{if(active)setDetailsLoading(false);});
    return()=>{active=false;};
  },[selected?.id,refresh]);
  const netReceived=payments.filter(row=>row.status==="COMPLETED").reduce((sum,row)=>sum+(row.type==="REFUND"?-row.amount:row.amount),0);
  const receivedByMethod=payments.filter(row=>row.status==="COMPLETED" && row.method===method).reduce((sum,row)=>sum+(row.type==="REFUND"?-row.amount:row.amount),0);
  const refundable=Math.max(0,...payments.filter(row=>row.method===method).map(row=>refundablePaymentAmount(row,payments)));
  const unreceipted=Math.max(0,receivedByMethod-receipts.filter(row=>row.method===method).reduce((sum,row)=>sum+row.amount,0));
  const open=(next:typeof mode)=>{setMode(next);setAmount(next==="receipt"&&unreceipted>0?String(unreceipted):"");setReference(next==="receipt"?`PT-${selected?.id}-${Date.now()}`:"");setError("");retry.current=null;};
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy || !selected || detailsLoading)return;setError("");
    try{
      const value=Number(amount);
      if(mode!=="vat" && (!amount.trim() || !Number.isSafeInteger(value) || value<=0))throw new Error("Nhập số tiền VND nguyên, lớn hơn 0.");
      if(mode==="payment" && value>selected.payable)throw new Error("Số tiền thu vượt công nợ còn lại.");
      if(mode==="refund" && (value>refundable || !reference.trim()))throw new Error(`Hoàn tối đa ${formatVnd(refundable)} trên một giao dịch gốc của phương thức này và phải có lý do.`);
      if(mode==="refund" && requests.some(row=>row.target_id===String(selected.id) && row.amount===value
        && ["PENDING","APPROVED"].includes(row.status) && (()=>{try{const payload=JSON.parse(row.payload);return payload.method===method && payload.reference===reference.trim();}catch{return false;}})()))
        throw new Error("Đã có yêu cầu hoàn tiền này đang chờ duyệt hoặc chờ thực hiện; kiểm tra danh sách bên dưới.");
      if(mode==="receipt" && (value>unreceipted || !reference.trim()))throw new Error(`Phiếu thu cần số chứng từ, không vượt ${formatVnd(unreceipted)} tiền đã thu chưa lập phiếu.`);
      if(mode==="vat" && !customerName.trim())throw new Error("Điền tên người nhận hóa đơn.");
      const signature=JSON.stringify({invoice:selected.id,mode,value,method,reference:reference.trim(),customerType,customerName:customerName.trim(),taxCode,company,address});
      if(retry.current?.signature!==signature)retry.current={signature,key:newKitchenIdempotencyKey(),approvalKey:newKitchenIdempotencyKey()};
      setBusy(true);
      if(mode==="payment"){
        const body={amount:value,method,type:"PAYMENT" as const,reference:reference.trim()||null};
        if(value>10000000)await api.requestFinancial("payment",body,retry.current.key,retry.current.approvalKey,selected.id);
        else await api.recordPayment(selected.id,body,retry.current.key);
      }
      else if(mode==="refund")await api.requestRefund(selected.id,{amount:value,method,type:"REFUND",reference:reference.trim()},retry.current.key,retry.current.approvalKey);
      else if(mode==="receipt")openReceiptVoucher(await api.issueReceipt(selected.id,{receipt_number:reference.trim(),amount:value,method},retry.current.key));
      else if(mode==="vat")onVatCreated(await enterpriseApi.createVat({invoice_id:selected.id,customer_type:customerType,customer_name:customerName.trim(),tax_code:taxCode.trim()||undefined,company_name:company.trim()||undefined,company_address:address.trim()||undefined}));
      setMode(null);retry.current=null;onChanged();
      try{const updated=await api.invoices({reservation_id:selected.reservation_id,page:0,size:10});setSelected(updated.items.find(row=>row.id===selected.id)??null);}
      catch(cause){setSelected(null);setError(apiErrorMessage(cause,"Đã ghi nhận nghiệp vụ; chưa tải được số dư mới. Hãy tải lại."));}
    }catch(cause){setError(accountingErrorMessage(cause,"Không thể ghi nhận nghiệp vụ hóa đơn."));}finally{setBusy(false);}
  };
  const executeRefund=async(request:Approval)=>{
    if(busy)return;setBusy(true);setError("");
    try{const payload=JSON.parse(request.payload);await api.recordPayment(Number(request.target_id),{amount:request.amount??0,method:payload.method,type:"REFUND",reference:payload.reference},payload.idempotency_key);setSelected(null);onChanged();}
    catch(cause){setError(apiErrorMessage(cause,"Không thể thực hiện hoàn tiền đã duyệt."));}finally{setBusy(false);}
  };
  return <section className="acct-panel" style={{padding:22,background:"#FFF",borderBottom:"1px solid #E2E8F0"}}>
    <h2 style={{fontSize:18}}>Hóa đơn, thu tiền & phiếu thu</h2><p style={{fontSize:12,color:"#64748B",margin:"6px 0 16px"}}>Hóa đơn được theo dõi toàn bộ lịch sử. Công nợ còn lại được tính sau cọc, các lần thu và hoàn tiền.</p>
    {error && !mode && <p role="alert" style={{color:"#B91C1C",paddingBottom:12}}>{error} <button type="button" style={compactActionStyle} onClick={onChanged}>Tải lại</button></p>}
    <div className="acct-table-wrap" style={{overflow:"auto"}}><table className="acct-table" style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Hóa đơn / booking","Ngày lập","Tổng sau giảm giá","Tiền cọc đã ghi nhận","Còn phải thu","Trạng thái","Thao tác"].map(label=><th key={label} style={{padding:10,textAlign:"left"}}>{label}</th>)}</tr></thead><tbody>{!loading && !error && data?.items.map(row=><tr key={row.id} style={{borderTop:"1px solid #E2E8F0"}}><td style={{padding:10}}>INV-{row.id} / #{row.reservation_id}</td><td>{formatDateTimeVi(row.issued_at)}</td><td>{formatVnd(invoiceTotal(row))}</td><td>{formatVnd(row.deposit)}</td><td>{formatVnd(row.payable)}</td><td>{row.status==="DU_KIEN"?"Dự kiến":row.status==="DA_THANH_TOAN"?"Đã thanh toán":"Còn công nợ"}</td><td><button type="button" style={{...compactActionStyle,...(busy?disabledActionStyle:{})}} disabled={busy} onClick={()=>{setSelected(row);setMode(null);setError("");}}>Xem / ghi nhận</button></td></tr>)}{loading && <tr><td colSpan={7}>Đang tải hóa đơn…</td></tr>}{!loading && !error && data?.items.length===0 && <tr><td colSpan={7}>Chưa có hóa đơn phù hợp.</td></tr>}</tbody></table></div>
    <div className="acct-inline-pagination" style={{display:"flex",gap:10,alignItems:"center",marginTop:12,fontSize:12}}><button type="button" style={{...compactActionStyle,...(loading || busy || page===0?disabledActionStyle:{})}} disabled={loading || busy || page===0} onClick={()=>setPage(value=>value-1)}>Trang hóa đơn trước</button><span>Trang {page+1}/{Math.max(1,data?.totalPages??0)} · {data?.totalElements??0} hóa đơn</span><button type="button" style={{...compactActionStyle,...(loading || busy || page+1>=(data?.totalPages??0)?disabledActionStyle:{})}} disabled={loading || busy || page+1>=(data?.totalPages??0)} onClick={()=>setPage(value=>value+1)}>Trang hóa đơn sau</button></div>
    {selected && <div className="acct-details-card" style={{marginTop:18,padding:18,background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><h3>INV-{selected.id} · Đặt phòng #{selected.reservation_id}</h3><button type="button" style={{...secondaryActionStyle,...(busy?disabledActionStyle:{})}} disabled={busy} onClick={()=>{setSelected(null);setMode(null);}}>Đóng hóa đơn</button></div>
      <p style={{fontSize:12,margin:"10px 0"}}>Tổng sau giảm giá {formatVnd(invoiceTotal(selected))} · Giảm giá {formatVnd(selected.discount)} · Thực thu ròng {detailsLoading?"Đang tải…":formatVnd(netReceived)} · Còn phải thu {formatVnd(selected.payable)}.</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{(["payment","refund","receipt","vat"] as const).map(next=>{const unavailable=busy || detailsLoading || selected.status==="DU_KIEN" || next==="payment" && selected.payable<=0 || next==="refund" && netReceived<=0 || next==="vat" && vatInvoices.some(row=>row.invoice_id===selected.id);return <button type="button" key={next} style={{...compactActionStyle,...(unavailable?disabledActionStyle:{})}} disabled={unavailable} onClick={()=>open(next)}>{({payment:"Ghi nhận thu tiền",refund:"Xin Giám đốc duyệt hoàn tiền",receipt:"Lập phiếu thu",vat:"Phát hành VAT"})[next]}</button>;})}</div>
      {selected.status==="DU_KIEN" && <p style={{fontSize:12,marginTop:8}}>Folio đang dự kiến; xử lý xác nhận cọc qua luồng đặt phòng của lễ tân.</p>}
      {mode && <AccountingDialog title={{payment:"Ghi nhận thu tiền",refund:"Đề nghị hoàn tiền",receipt:"Lập phiếu thu",vat:"Phát hành hóa đơn VAT"}[mode]} description={`Hóa đơn INV-${selected.id} · Đặt phòng #${selected.reservation_id}`} busy={busy} onClose={()=>setMode(null)}><form className="acct-form" onSubmit={event=>void save(event)} style={{marginTop:16}}>
        {error && <p role="alert">{error}</p>}
        {mode!=="vat"?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,fontSize:12}}><label>Số tiền (VND)<input required type="number" min="1" step="1" value={amount} onChange={event=>setAmount(event.target.value)} style={fieldStyle} disabled={busy}/></label><label>Phương thức<MethodSelect value={method} onChange={setMethod} disabled={busy}/></label><label>{mode==="refund"?"Lý do hoàn tiền":mode==="receipt"?"Số phiếu thu":"Mã tham chiếu / nội dung"}<input required={mode!=="payment"} maxLength={mode==="refund"?69:mode==="receipt"?40:100} value={reference} onChange={event=>setReference(event.target.value)} style={fieldStyle} disabled={busy}/></label></div>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,fontSize:12}}><label>Loại khách<select style={fieldStyle} value={customerType} onChange={event=>setCustomerType(event.target.value)} disabled={busy}><option value="INDIVIDUAL">Cá nhân</option><option value="COMPANY">Doanh nghiệp</option></select></label><label>Tên người nhận<input required maxLength={200} style={fieldStyle} value={customerName} onChange={event=>setCustomerName(event.target.value)} disabled={busy}/></label>{customerType==="COMPANY" && <><label>Mã số thuế<input required maxLength={30} style={fieldStyle} value={taxCode} onChange={event=>setTaxCode(event.target.value)} disabled={busy}/></label><label>Tên công ty<input required maxLength={200} style={fieldStyle} value={company} onChange={event=>setCompany(event.target.value)} disabled={busy}/></label><label>Địa chỉ công ty<input required maxLength={500} style={fieldStyle} value={address} onChange={event=>setAddress(event.target.value)} disabled={busy}/></label></>}</div>}
        {mode==="payment"&&Number(amount)>10000000&&<p>Khoản thu trên 10 triệu cần Giám đốc duyệt trước khi ghi nhận. Gửi yêu cầu chưa làm thay đổi số dư hóa đơn.</p>}
        {mode==="refund" && <p style={{fontSize:12,color:"#64748B",marginTop:8}}>Có thể xin hoàn tối đa {formatVnd(refundable)} trên một giao dịch gốc của phương thức này. Yêu cầu được duyệt vẫn cần thực hiện hoàn tiền.</p>}
        {mode==="vat" && <p style={{fontSize:12,color:"#64748B",marginTop:8}}>Giá đã gồm VAT. Backend tách thuế từ tổng sau giảm giá, không trừ tiền cọc hay các lần thanh toán.</p>}
        {mode==="receipt"&&<p style={{fontSize:12,color:"#64748B",marginTop:8}}>Lập phiếu cho tiền đã thu, không thu tiền thêm lần nữa. Có thể lập tối đa {formatVnd(unreceipted)} theo phương thức đang chọn.</p>}
        <button type="submit" disabled={busy} style={{...buttonStyle,marginTop:12,...(busy?disabledActionStyle:{})}}>{busy?"Đang lưu…":mode==="refund"||mode==="payment"&&Number(amount)>10000000?"Gửi yêu cầu phê duyệt":"Lưu nghiệp vụ"}</button>
      </form></AccountingDialog>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16,marginTop:16,fontSize:12}}><div><strong>Lịch sử thu / hoàn</strong>{detailsLoading?<p>Đang tải…</p>:payments.map(row=><p key={row.id} style={{paddingTop:8}}>PAY-{row.id} · {row.type==="REFUND"?"Hoàn":"Thu"} {formatVnd(row.amount)} · {methodLabel(row.method)} · {row.status} · {formatDateTimeVi(row.occurred_at)}</p>)}</div><div><strong>Phiếu thu đã lập</strong>{!detailsLoading&&receipts.map(row=><div key={row.id} style={{padding:"10px 0",borderBottom:"1px solid #E2E8F0"}}><p>{row.receipt_number} · {formatVnd(row.amount)} · {methodLabel(row.method)} · {formatDateTimeVi(row.issued_at)}</p><button type="button" style={{...compactActionStyle,marginTop:7}} disabled={busy} onClick={()=>openReceiptVoucher(row)}>In phiếu thu {row.receipt_number}</button></div>)}{!detailsLoading && receipts.length===0 && <p style={{paddingTop:8}}>Chưa có phiếu thu.</p>}</div></div>
    </div>}
    <div style={{marginTop:22,fontSize:12}}><h3>Yêu cầu hoàn tiền của tôi</h3>{requests.map(row=><div key={row.id} style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",padding:"12px 0",borderBottom:"1px solid #E2E8F0"}}><span>#{row.id} · INV-{row.target_id} · {formatVnd(row.amount??0)} · {row.reason}</span><strong>{({PENDING:"Chờ Giám đốc",APPROVED:"Đã duyệt, chưa hoàn",CONSUMED:"Đã thực hiện",REJECTED:"Bị từ chối",EXPIRED:"Hết hạn"} as Record<string,string>)[row.status]??row.status}</strong>{row.status==="APPROVED" && !row.consumed_at && <button type="button" style={{...primaryActionStyle,...(busy?disabledActionStyle:{})}} disabled={busy} onClick={()=>void executeRefund(row)}>Thực hiện hoàn tiền đã duyệt</button>}</div>)}{requests.length===0 && <p style={{marginTop:8,color:"#64748B"}}>Chưa có yêu cầu hoàn tiền.</p>}</div>
    <FinancialApprovalQueue operation="payment" refresh={refresh} onChanged={()=>{setSelected(null);onChanged();}}/>
    {voucher&&<CashVoucherDialog key={`${voucher.kind}-${voucher.number}`} voucher={voucher} onClose={()=>setVoucher(null)}/>}
  </section>;
}
