import { AccountingDialog } from "./AccountingDialog";
import { AccountingDocument, receiptDocument } from "./AccountingDocument";
import { useEffect, useRef, useState } from "react";
import { kitchenAccountingApi as api, newKitchenIdempotencyKey, toRows } from "../../shared/api/kitchenAccounting";
import { enterpriseApi } from "../../shared/api/enterprise";
import { apiErrorMessage } from "../../shared/api/client";
import type { Invoice, Payment, Receipt, Approval, PaymentMethod, Page } from "../../shared/types/kitchenAccounting";
import type { VatInvoice } from "../../shared/types/enterprise";
import { formatVnd } from "../../shared/utils/money";
import { formatDateTimeVi } from "../../shared/utils/localDate";
import { accountingErrorMessage, invoiceTotal, refundablePaymentAmount } from "./accountingLogic";
import { MethodSelect, methodLabel, fieldStyle, buttonStyle } from "./FinanceOperations";
import { compactActionStyle, disabledActionStyle, primaryActionStyle, secondaryActionStyle } from "./accountingUi";

export default function InvoiceOperations({onChanged,onVatCreated,refresh,search,vatInvoices}:{onChanged:()=>void;onVatCreated:(row:VatInvoice)=>void;refresh:number;search:string;vatInvoices:VatInvoice[]}){
  const [page,setPage]=useState(0);const [data,setData]=useState<Page<Invoice>|null>(null);const [selected,setSelected]=useState<Invoice|null>(null);
  const [payments,setPayments]=useState<Payment[]>([]);const [receipts,setReceipts]=useState<Receipt[]>([]);const [requests,setRequests]=useState<Approval[]>([]);
  const [error,setError]=useState("");const [loading,setLoading]=useState(true);const [detailsLoading,setDetailsLoading]=useState(false);const [detailsError,setDetailsError]=useState("");const [busy,setBusy]=useState(false);
  const [mode,setMode]=useState<"payment"|"refund"|"receipt"|"vat"|null>(null);
  const [amount,setAmount]=useState("");const [method,setMethod]=useState<PaymentMethod>("CASH");const [reference,setReference]=useState("");
  const [customerType,setCustomerType]=useState("INDIVIDUAL");const [customerName,setCustomerName]=useState("");const [taxCode,setTaxCode]=useState("");const [company,setCompany]=useState("");const [address,setAddress]=useState("");
  const [document,setDocument]=useState<Receipt|null>(null);
  const retry=useRef<{signature:string;key:string;approvalKey:string}|null>(null);
  const reservationId=search.trim()?Number(search.trim()):undefined;
  useEffect(()=>setPage(0),[search]);
  useEffect(()=>{setSelected(null);setMode(null);},[page,search]);
  useEffect(()=>{let active=true;setLoading(true);setError("");
    if(search.trim() && (!Number.isSafeInteger(reservationId) || (reservationId??0)<=0)){setError("Nhập mã đặt phòng bằng số để tìm hóa đơn.");setLoading(false);return;}
    api.invoices({page,size:10,reservation_id:reservationId}).then(result=>{if(active){setData(result);setSelected(current=>current?result.items.find(row=>row.id===current.id)??null:null);if(page>=Math.max(1,result.totalPages))setPage(Math.max(0,result.totalPages-1));}}).catch(cause=>{if(active)setError(apiErrorMessage(cause,"Không thể tải hóa đơn."));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[page,refresh,reservationId,search]);
  useEffect(()=>{let active=true;api.refundRequests().then(rows=>{if(active)setRequests(rows);}).catch(cause=>{if(active)setError(apiErrorMessage(cause,"Không thể tải yêu cầu hoàn tiền."));});return()=>{active=false;};},[refresh]);
  useEffect(()=>{
    let active=true;if(!selected){setPayments([]);setReceipts([]);return;}setDetailsLoading(true);setDetailsError("");setPayments([]);setReceipts([]);
    Promise.all([api.invoicePayments(selected.id),api.invoiceReceipts(selected.id)]).then(([pay,rcpt])=>{if(active){setPayments(toRows(pay));setReceipts(toRows(rcpt));}}).catch(cause=>{if(active)setDetailsError(apiErrorMessage(cause,"Không thể tải giao dịch / phiếu thu của hóa đơn."));}).finally(()=>{if(active)setDetailsLoading(false);});
    return()=>{active=false;};
  },[selected?.id,refresh]);
  const netReceived=payments.filter(row=>row.status==="COMPLETED").reduce((sum,row)=>sum+(row.type==="REFUND"?-row.amount:row.amount),0);
  const receivedByMethod=payments.filter(row=>row.status==="COMPLETED" && row.method===method).reduce((sum,row)=>sum+(row.type==="REFUND"?-row.amount:row.amount),0);
  const refundable=Math.max(0,...payments.filter(row=>row.method===method).map(row=>refundablePaymentAmount(row,payments)));
  const unreceipted=Math.max(0,receivedByMethod-receipts.filter(row=>row.method===method).reduce((sum,row)=>sum+row.amount,0));
  const open=(next:typeof mode)=>{setMode(next);setAmount("");setReference("");setError("");retry.current=null;};
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy || !selected || detailsLoading || detailsError)return;setError("");
    try{
      const value=Number(amount);
      if(mode!=="vat" && (!amount.trim() || !Number.isSafeInteger(value) || value<=0))throw new Error("Nhập số tiền VND nguyên, lớn hơn 0.");
      if(mode==="payment" && value>selected.payable)throw new Error("Số tiền thu vượt công nợ còn lại.");
      if(mode==="refund" && (value>refundable || !reference.trim()))throw new Error(`Hoàn tối đa ${formatVnd(refundable)} trên một giao dịch gốc của phương thức này và phải có lý do.`);
      if(mode==="refund" && requests.some(row=>row.target_id===String(selected.id) && row.amount===value
        && ["PENDING","APPROVED"].includes(row.status) && (()=>{try{const payload=JSON.parse(row.payload);return payload.method===method && payload.reference===reference.trim();}catch{return false;}})()))
        throw new Error("Đã có yêu cầu hoàn tiền này đang chờ duyệt hoặc chờ thực hiện; kiểm tra danh sách bên dưới.");
      if(mode==="receipt" && (value>unreceipted || !reference.trim()))throw new Error(`Biên lai cần số chứng từ, không vượt ${formatVnd(unreceipted)} tiền đã thu chưa lập biên lai.`);
      if(mode==="vat" && !customerName.trim())throw new Error("Điền tên người nhận hóa đơn.");
      const signature=JSON.stringify({invoice:selected.id,mode,value,method,reference:reference.trim(),customerType,customerName:customerName.trim(),taxCode,company,address});
      if(retry.current?.signature!==signature)retry.current={signature,key:newKitchenIdempotencyKey(),approvalKey:newKitchenIdempotencyKey()};
      setBusy(true);
      if(mode==="payment")await api.recordPayment(selected.id,{amount:value,method,type:"PAYMENT",reference:reference.trim()||null},retry.current.key);
      else if(mode==="refund")await api.requestRefund(selected.id,{amount:value,method,type:"REFUND",reference:reference.trim()},retry.current.key,retry.current.approvalKey);
      else if(mode==="receipt")await api.issueReceipt(selected.id,{receipt_number:reference.trim(),amount:value,method},retry.current.key);
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
      {detailsError && <p role="alert">{detailsError} <button type="button" style={compactActionStyle} onClick={onChanged}>Tải lại giao dịch hóa đơn</button></p>}
      <dl className="acct-invoice-totals"><div><dt>Tổng hóa đơn</dt><dd>{formatVnd(invoiceTotal(selected))}</dd></div><div><dt>Đã thu sau hoàn tiền</dt><dd>{detailsLoading?"Đang tải…":detailsError?"Chưa tải được":formatVnd(netReceived)}</dd></div><div><dt>Còn phải thu</dt><dd>{formatVnd(selected.payable)}</dd></div></dl>
      <p style={{fontSize:12,color:"#64748b",marginBottom:12}}>Tổng hóa đơn đã trừ giảm giá {formatVnd(selected.discount)}. Khoản còn phải thu lấy từ số dư hóa đơn.</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{(["payment","refund","receipt","vat"] as const).map(next=>{const unavailable=busy || detailsLoading || !!detailsError || selected.status==="DU_KIEN" || next==="payment" && selected.payable<=0 || next==="refund" && netReceived<=0 || next==="vat" && vatInvoices.some(row=>row.invoice_id===selected.id);return <button type="button" key={next} style={{...compactActionStyle,...(unavailable?disabledActionStyle:{})}} disabled={unavailable} onClick={()=>open(next)}>{({payment:"Ghi nhận thu tiền",refund:"Xin Giám đốc duyệt hoàn tiền",receipt:"Lập phiếu thu",vat:"Phát hành VAT"})[next]}</button>;})}</div>
      {selected.status==="DU_KIEN" && <p style={{fontSize:12,marginTop:8}}>Folio đang dự kiến; xử lý xác nhận cọc qua luồng đặt phòng của lễ tân.</p>}
      {mode && <AccountingDialog title={{payment:"Ghi nhận thu tiền",refund:"Đề nghị hoàn tiền",receipt:"Lập phiếu thu",vat:"Phát hành hóa đơn VAT"}[mode]} description={`Hóa đơn INV-${selected.id} · Đặt phòng #${selected.reservation_id}`} busy={busy} onClose={()=>setMode(null)}><form className="acct-form" onSubmit={event=>void save(event)} style={{marginTop:16}}>
        {error && <p role="alert">{error}</p>}
        {mode!=="vat"?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,fontSize:12}}><label>Số tiền (VND)<input required type="number" min="1" step="1" value={amount} onChange={event=>setAmount(event.target.value)} style={fieldStyle} disabled={busy}/></label><label>Phương thức<MethodSelect value={method} onChange={setMethod} disabled={busy}/></label><label>{mode==="refund"?"Lý do hoàn tiền":mode==="receipt"?"Số phiếu thu":"Mã tham chiếu / nội dung"}<input required={mode!=="payment"} maxLength={mode==="refund"?69:mode==="receipt"?40:100} value={reference} onChange={event=>setReference(event.target.value)} style={fieldStyle} disabled={busy}/></label></div>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,fontSize:12}}><label>Loại khách<select style={fieldStyle} value={customerType} onChange={event=>setCustomerType(event.target.value)} disabled={busy}><option value="INDIVIDUAL">Cá nhân</option><option value="COMPANY">Doanh nghiệp</option></select></label><label>Tên người nhận<input required maxLength={200} style={fieldStyle} value={customerName} onChange={event=>setCustomerName(event.target.value)} disabled={busy}/></label>{customerType==="COMPANY" && <><label>Mã số thuế<input required maxLength={30} style={fieldStyle} value={taxCode} onChange={event=>setTaxCode(event.target.value)} disabled={busy}/></label><label>Tên công ty<input required maxLength={200} style={fieldStyle} value={company} onChange={event=>setCompany(event.target.value)} disabled={busy}/></label><label>Địa chỉ công ty<input required maxLength={500} style={fieldStyle} value={address} onChange={event=>setAddress(event.target.value)} disabled={busy}/></label></>}</div>}
        {mode==="refund" && <p style={{fontSize:12,color:"#64748B",marginTop:8}}>Có thể xin hoàn tối đa {formatVnd(refundable)} trên một giao dịch gốc của phương thức này. Yêu cầu được duyệt vẫn cần thực hiện hoàn tiền.</p>}
        {mode==="vat" && <p style={{fontSize:12,color:"#64748B",marginTop:8}}>Giá đã gồm VAT. Thuế được tách từ tổng hóa đơn sau giảm giá; tiền cọc và thanh toán không làm thay đổi tiền thuế.</p>}
        <button type="submit" disabled={busy} style={{...buttonStyle,marginTop:12,...(busy?disabledActionStyle:{})}}>{busy?"Đang lưu…":mode==="refund"?"Gửi yêu cầu phê duyệt":"Lưu nghiệp vụ"}</button>
        {mode==="receipt" && <p style={{fontSize:12,color:"#64748b",marginTop:10}}>Lập phiếu cho tiền đã thu, không thu thêm lần nữa. Có thể lập tối đa {formatVnd(unreceipted)} theo phương thức đang chọn.</p>}
      </form></AccountingDialog>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16,marginTop:16,fontSize:12}}><div><strong>Lịch sử thu / hoàn</strong>{detailsLoading?<p>Đang tải…</p>:detailsError?<p>Chưa tải được lịch sử.</p>:payments.map(row=><p key={row.id} style={{paddingTop:8}}>PAY-{row.id} · {row.type==="REFUND"?"Hoàn":"Thu"} {formatVnd(row.amount)} · {methodLabel(row.method)} · {({COMPLETED:"Hoàn tất",FAILED:"Không thành công",VOIDED:"Đã hủy"} as Record<string,string>)[row.status]??row.status} · {formatDateTimeVi(row.occurred_at)}</p>)}</div><div><strong>Phiếu thu đã lập</strong>{!detailsLoading && receipts.map(row=><div key={row.id} style={{padding:"10px 0",borderBottom:"1px solid #e2e8f0"}}><p>{row.receipt_number} · {formatVnd(row.amount)} · {methodLabel(row.method)} · {formatDateTimeVi(row.issued_at)}</p><button type="button" style={{...compactActionStyle,marginTop:8}} disabled={busy} onClick={()=>setDocument(row)}>In phiếu thu {row.receipt_number}</button></div>)}{!detailsLoading && !detailsError && receipts.length===0 && <p style={{paddingTop:8}}>Chưa có phiếu thu.</p>}</div></div>
    </div>}
    <div style={{marginTop:22,fontSize:12}}><h3>Yêu cầu hoàn tiền của tôi</h3>{requests.map(row=><div key={row.id} style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",padding:"12px 0",borderBottom:"1px solid #E2E8F0"}}><span>#{row.id} · INV-{row.target_id} · {formatVnd(row.amount??0)} · {row.reason}</span><strong>{({PENDING:"Chờ Giám đốc",APPROVED:"Đã duyệt, chưa hoàn",CONSUMED:"Đã thực hiện",REJECTED:"Bị từ chối",EXPIRED:"Hết hạn"} as Record<string,string>)[row.status]??row.status}</strong>{row.status==="APPROVED" && !row.consumed_at && <button type="button" style={{...primaryActionStyle,...(busy?disabledActionStyle:{})}} disabled={busy} onClick={()=>void executeRefund(row)}>Thực hiện hoàn tiền đã duyệt</button>}</div>)}{requests.length===0 && <p style={{marginTop:8,color:"#64748B"}}>Chưa có yêu cầu hoàn tiền.</p>}</div>
    {document && <AccountingDocument data={receiptDocument(document)} onClose={()=>setDocument(null)}/>}
  </section>;
}
