import { useEffect, useState } from "react";
import { kitchenAccountingApi } from "../../shared/api/kitchenAccounting";
import { enterpriseApi } from "../../shared/api/enterprise";
import { authApi } from "../../shared/api/auth";
import { apiErrorMessage, ApiError } from "../../shared/api/client";
import { AccountingWorkspace, type AccountingPage } from "./AccountingWorkspace";
import { AccountingDialog } from "./AccountingDialog";
import type { OtaReconciliation, VatInvoice } from "../../shared/types/enterprise";
import type { CashHandover, LedgerPayment, PaymentMethod, PaymentPage, Reconciliation, PartnerDebt } from "../../shared/types/kitchenAccounting";
import type { EmployeeProfileDto } from "../../shared/types/api";
import { formatDateVi } from "../../shared/utils/localDate";
import { businessDateValue } from "./accountingLogic";
import CashHandoverPanel from "./CashHandoverPanel";
import OtaReconciliationScreen from "./OtaReconciliationScreen";
import FinanceOperations from "./FinanceOperations";
import InvoiceOperations from "./InvoiceOperations";
import { compactActionStyle } from "./accountingUi";
import { formatVnd } from "../../shared/utils/money";
import {
  BarChart2, Search, ChevronDown, Download, Printer,
  DollarSign, CreditCard, Building2, RefreshCcw,
  ChevronLeft, ChevronRight,
} from "lucide-react";


/* ══════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════ */
type LedgerTab = "all" | "cash" | "card" | "vietqr" | "momo" | "other";
type PayStatus = "paid" | "refunded" | "failed" | "voided";
interface PaymentLedgerEntry {
  id: string;
  invoiceId: string;
  reservationId: number | "—";
  description: string;
  amount: number;
  method: string;
  methodType: LedgerTab;
  time: string;
  status: PayStatus;
  ledgerTab: LedgerTab[];
}
interface VatRow {
  invoice: string;
  guest: string;
  invoiceId: number;
  amount: number;
  vat: number;
  totalAmount: number;
  vatRate: string;
  status: string;
  vatId?: number;
  customerType: string;
  taxCode: string | null;
  companyName: string | null;
  companyAddress: string | null;
  issuedAt: string;
  createdBy: string;
}

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
const fmtMoney = formatVnd;

const METHOD_CFG: Record<string,{bg:string;text:string;label:string}> = {
  visa:    { bg:"#DBEAFE",text:"#1D4ED8",label:"VISA" },
  card:    { bg:"#FFE4E6",text:"#BE123C",label:"Thẻ" },
  cash:    { bg:"#DCFCE7",text:"#166534",label:"Tiền mặt" },
  vietqr:  { bg:"#EDE9FE",text:"#5B21B6",label:"Chuyển khoản" },
  momo:    { bg:"#FCE7F3",text:"#9D174D",label:"Ví MoMo" },
  other:   { bg:"#F1F5F9",text:"#475569",label:"Khác" },
};

function LedgerPanel({ fillHeight = false, date = businessDateValue(), onDateChange, search = "", onSearchChange, refresh = 0 }: { fillHeight?: boolean; date?: string; onDateChange: (date: string) => void; search?: string; onSearchChange: (value: string) => void; refresh?: number }) {
  const [lTab, setLTab] = useState<LedgerTab>("all");
  const [page, setPage] = useState(1);
  const searchQuery = search;
  const [paymentPage, setPaymentPage] = useState<PaymentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const PER_PAGE = 10;
  const currentDateLabel = formatDateVi(date);
  const today = date;
  useEffect(()=>{setPage(1);},[search,date]);
  const methods: Record<Exclude<LedgerTab, "all">, PaymentMethod> = { cash:"CASH", card:"CARD", vietqr:"BANK_TRANSFER", momo:"MOMO", other:"OTHER" };
  const method = lTab === "all" ? undefined : methods[lTab];

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setExportError("");
    kitchenAccountingApi.payments({ from:today, to:today, page:page-1, size:PER_PAGE, method, search:searchQuery.trim() || undefined })
      .then(result => {
        if (!active) return;
        if (result.page !== page-1) throw new ApiError(502,{code:"INVALID_PAGE_RESPONSE",message:"Máy chủ trả sai trang giao dịch. Vui lòng tải lại."});
        if (page > Math.max(1,result.totalPages)) { setPage(Math.max(1,result.totalPages)); return; }
        setPaymentPage(result);
      })
      .catch(cause => { if (active) setError(apiErrorMessage(cause,"Không thể tải giao dịch thanh toán.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, method, searchQuery, today, reload, refresh]);

  const toLedgerRow = (payment: LedgerPayment): PaymentLedgerEntry => {
      const methodType: LedgerTab = payment.method === "CASH" ? "cash"
        : payment.method === "CARD" ? "card"
        : payment.method === "BANK_TRANSFER" ? "vietqr"
        : payment.method === "MOMO" ? "momo" : "other";
      const status: PayStatus = payment.status === "COMPLETED"
        ? payment.type === "REFUND" ? "refunded" : "paid"
        : payment.status === "VOIDED" ? "voided" : "failed";
      const occurredAt = new Date(payment.occurred_at);
      return {
        id: `PAY-${payment.id}`,
        invoiceId: `INV-${payment.invoice_id}`,
        reservationId: payment.reservation_id,
        description: payment.type === "REFUND" ? "Hoàn tiền" : payment.service_total > 0 ? "Phòng & dịch vụ" : "Tiền phòng",
        amount: payment.amount,
        method: payment.method,
        methodType,
        time: Number.isNaN(occurredAt.getTime()) ? "—" : occurredAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        status,
        ledgerTab: ["all", methodType],
      };
  };
  const pageRows = loading || error ? [] : (paymentPage?.items ?? []).map(toLedgerRow);
  const totalElements = paymentPage?.totalElements ?? 0;
  const totalPages = Math.max(1,paymentPage?.totalPages ?? 0);
  const methodCounts = paymentPage?.methodCounts ?? {};
  const pageNumbers = [...new Set([1,Math.max(1,page-1),page,Math.min(totalPages,page+1),totalPages])].sort((a,b)=>a-b);

  const TABS: { id:LedgerTab; label:string; count:number }[] = [
    { id:"all",     label:"Tất cả",        count:Object.values(methodCounts).reduce((sum,count)=>sum+(count ?? 0),0) },
    { id:"cash",    label:"Tiền mặt",       count:methodCounts.CASH ?? 0 },
    { id:"card",    label:"Thẻ",            count:methodCounts.CARD ?? 0 },
    { id:"vietqr",  label:"Chuyển khoản",  count:methodCounts.BANK_TRANSFER ?? 0 },
    { id:"momo", label:"Ví MoMo", count:methodCounts.MOMO ?? 0 },
    { id:"other", label:"Khác", count:methodCounts.OTHER ?? 0 },
  ];

  const STATUS_CFG: Record<PayStatus,{label:string;bg:string;text:string;dot:string}> = {
    paid:     { label:"Đã thanh toán",     bg:"#DCFCE7",text:"#166534",dot:"#16A34A" },
    refunded: { label:"Đã hoàn tiền", bg:"#FEF9C3",text:"#92400E",dot:"#F59E0B" },
    failed:   { label:"Thất bại", bg:"#FFE4E6",text:"#BE123C",dot:"#E11D48" },
    voided:   { label:"Đã hủy", bg:"#F1F5F9",text:"#64748B",dot:"#94A3B8" },
  };

  const exportRows = async () => {
    setExporting(true);
    setExportError("");
    try {
    const payments: LedgerPayment[] = [];
    let pages = 1;
    let expectedTotal: number | undefined;
    const ids = new Set<number>();
    for (let index=0; index<pages; index++) {
      const result = await kitchenAccountingApi.payments({ from:today, to:today, method, search:searchQuery.trim() || undefined, page:index, size:100 });
      if (result.page !== index || (expectedTotal !== undefined && result.totalElements !== expectedTotal)
          || (result.items.length === 0 && payments.length < result.totalElements)
          || result.items.some(row=>ids.has(row.id))) throw new ApiError(502,{code:"EXPORT_DATA_CHANGED",message:"Dữ liệu giao dịch đã thay đổi hoặc trả thiếu khi xuất. Vui lòng thử lại."});
      expectedTotal = result.totalElements;
      result.items.forEach(row=>ids.add(row.id));
      payments.push(...result.items);
      pages = result.totalPages;
    }
    if (payments.length !== expectedTotal) throw new ApiError(502,{code:"EXPORT_INCOMPLETE",message:"Chưa tải đủ giao dịch để xuất CSV. Vui lòng thử lại."});
    const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [
      ["transaction_id", "invoice_id", "reservation_id", "type", "amount", "method", "occurred_at", "status", "reference"],
      ...payments.map(source => {
        const row = toLedgerRow(source);
        return [row.id, row.invoiceId, row.reservationId, row.description, row.amount, row.method, source?.occurred_at ?? "", row.status, source?.reference ?? ""];
      }),
    ].map(row => row.map(escapeCsv).join(","));
    const url = URL.createObjectURL(new Blob([`\uFEFF${rows.join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `payments-${date}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setExportError(apiErrorMessage(cause,"Không thể xuất giao dịch CSV.")); }
    finally { setExporting(false); }
  };

  return (
    <div className="acct-card acct-ledger" style={{ flex:fillHeight?"1 1 100%":"1 1 50%",minWidth:0,minHeight:0,display:"flex",flexDirection:"column",
      background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden" }}>
      {/* Header */}
      <div className="acct-card-header" style={{ padding:"16px 18px",borderBottom:"1px solid #E2E8F0",
        display:"flex",alignItems:"flex-start",justifyContent:"space-between" }}>
        <div>
          <p style={{ fontSize:14,fontWeight:700,color:"#0F172A",marginBottom:2 }}>Sổ giao dịch thanh toán</p>
          <p style={{ fontSize:11,color:"#94A3B8" }}>Giao dịch thực tế ghi nhận ngày {currentDateLabel}</p>
        </div>
        <button disabled={exporting || loading} onClick={() => void exportRows()} style={{ display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,
          border:"1px solid #E2E8F0",background:"#F8FAFC",color:"#334155",fontSize:11,
          fontWeight:600,cursor:"pointer" }}>
          <Download size={12} /> {exporting ? "Đang xuất…" : "Xuất giao dịch CSV"}
        </button>
      </div>

      {/* Search row */}
      <div className="acct-ledger-filters" style={{ padding:"10px 18px",borderBottom:"1px solid #F1F5F9",
        display:"flex",gap:8,alignItems:"center" }}>
        <div style={{ position:"relative",flex:1 }}>
          <Search size={12} style={{ position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none" }} />
          <input value={searchQuery} maxLength={200} onChange={event => { onSearchChange(event.target.value); setPage(1); }} placeholder="Tìm mã giao dịch, hóa đơn hoặc đặt phòng..."
            style={{ width:"100%",height:30,paddingLeft:28,paddingRight:8,borderRadius:7,
              border:"1px solid #E2E8F0",background:"#F8FAFC",fontSize:11,outline:"none",boxSizing:"border-box" }} />
        </div>
        <label className="acct-ledger-date"><span>Ngày giao dịch</span><input aria-label="Ngày tra cứu giao dịch" type="date" value={date} onChange={event=>{if(event.target.value){setPage(1);onDateChange(event.target.value);}}}/></label>
        <button type="button" style={compactActionStyle} disabled={date===businessDateValue()} onClick={()=>onDateChange(businessDateValue())}>Hôm nay</button>
        <div style={{ position:"relative" }}>
          <select aria-label="Phương thức thanh toán" value={lTab} onChange={event => { setLTab(event.target.value as LedgerTab); setPage(1); }} style={{ height:30,padding:"0 22px 0 8px",borderRadius:7,border:"1px solid #E2E8F0",
            background:"#F8FAFC",fontSize:11,outline:"none",cursor:"pointer",appearance:"none" }}>
            <option value="all">Tất cả phương thức</option>
            <option value="cash">Tiền mặt</option><option value="card">Thẻ</option>
            <option value="vietqr">Chuyển khoản</option><option value="momo">Ví MoMo</option><option value="other">Khác</option>
          </select>
          <ChevronDown size={10} style={{ position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none" }} />
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="acct-ledger-tabs" style={{ display:"flex",padding:"0 18px",borderBottom:"1px solid #E2E8F0",gap:0 }}>
        {TABS.map(t => {
          const act = lTab === t.id;
          return (
            <button key={t.id} onClick={() => { setLTab(t.id); setPage(1); }}
              style={{ padding:"8px 12px",fontSize:12,fontWeight:act?600:400,cursor:"pointer",
                color:act?"#0F172A":"#64748B",background:"transparent",
                borderBottom:act?"2px solid #0F172A":"2px solid transparent",
                whiteSpace:"nowrap",marginBottom:-1 }}>
              {t.label} <span style={{ fontSize:10,marginLeft:3,
                background:act?"#0F172A":"#F1F5F9",color:act?"#FFF":"#64748B",
                padding:"1px 5px",borderRadius:99 }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {error && <div role="alert" style={{padding:"12px 18px",color:"#B91C1C"}}>{error} <button type="button" style={compactActionStyle} onClick={()=>setReload(value=>value+1)}>Tải lại giao dịch</button></div>}
      {exportError && <div role="alert" style={{padding:"12px 18px",color:"#B91C1C"}}>{exportError}</div>}
      {/* Table */}
      <div className="acct-table-wrap" style={{ flex:1,overflow:"auto" }}>
        <table className="acct-table" style={{ width:"100%",borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#F8FAFC" }}>
              {["Mã giao dịch","Mã đặt phòng","Mã hóa đơn","Loại giao dịch","Số tiền","Phương thức","Giờ giao dịch","Trạng thái"].map(h => (
                <th key={h} style={{ padding:"8px 10px",fontSize:10,fontWeight:700,color:"#64748B",
                  textAlign:"left",letterSpacing:"0.04em",textTransform:"uppercase",
                  whiteSpace:"nowrap",borderBottom:"1px solid #E2E8F0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{padding:28,textAlign:"center"}}>Đang tải giao dịch…</td></tr>}
            {!loading && !error && pageRows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding:"28px 12px",textAlign:"center",fontSize:12,color:"#94A3B8" }}>
                  Chưa có giao dịch thanh toán phù hợp trong ngày đã chọn.
                </td>
              </tr>
            )}
            {pageRows.map((entry,i) => {
              const mc  = METHOD_CFG[entry.methodType] ?? { bg:"#F1F5F9",text:"#475569",label:entry.method };
              const sc  = STATUS_CFG[entry.status];
              return (
                <tr key={entry.id} style={{ borderBottom:"1px solid #F8FAFC",background:i%2===0?"#FFF":"#FAFAFA" }}>
                  <td style={{ padding:"7px 10px",fontSize:10,fontWeight:600,color:"#2563EB",
                    fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap" }}>{entry.id}</td>
                  <td style={{ padding:"7px 10px",fontSize:12,fontWeight:700,color:"#0F172A" }}>{entry.reservationId}</td>
                  <td style={{ padding:"7px 10px",fontSize:12,color:"#334155",whiteSpace:"nowrap",maxWidth:120,
                    overflow:"hidden",textOverflow:"ellipsis" }}>{entry.invoiceId}</td>
                  <td style={{ padding:"7px 10px",fontSize:11,color:"#64748B",whiteSpace:"nowrap" }}>{entry.description}</td>
                  <td style={{ padding:"7px 10px",fontSize:12,fontWeight:700,color:"#0F172A",
                    fontFamily:"'JetBrains Mono',monospace" }}>{fmtMoney(entry.amount)}</td>
                  <td style={{ padding:"7px 10px" }}>
                    <span style={{ fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:5,
                      background:mc.bg,color:mc.text,whiteSpace:"nowrap" }}>{mc.label}</span>
                  </td>
                  <td style={{ padding:"7px 10px",fontSize:11,color:"#94A3B8",whiteSpace:"nowrap" }}>{entry.time}</td>
                  <td style={{ padding:"7px 10px" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:4 }}>
                      <span style={{ width:6,height:6,borderRadius:99,background:sc.dot,flexShrink:0 }} />
                      <span style={{ fontSize:11,fontWeight:600,color:sc.text }}>{sc.label}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="acct-pagination" style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"10px 18px",borderTop:"1px solid #E2E8F0",background:"#F8FAFC",flexShrink:0 }}>
        <span style={{ fontSize:11,color:"#64748B" }}>{loading ? "Đang tải trang giao dịch…" : error ? "Chưa tải được giao dịch" : `Hiển thị ${totalElements === 0 ? 0 : (page-1)*PER_PAGE+1}–${totalElements === 0 ? 0 : (page-1)*PER_PAGE+pageRows.length} trên ${totalElements} giao dịch`}</span>
        <div style={{ display:"flex",gap:4,alignItems:"center" }}>
          <button type="button" aria-label="Trang trước" onClick={() => setPage(p=>Math.max(1,p-1))} disabled={loading || !!error || page===1}
            style={{ width:24,height:24,borderRadius:6,border:"1px solid #E2E8F0",background:"#FFF",
              cursor:loading || error || page===1?"not-allowed":"pointer",color:loading || error || page===1?"#CBD5E1":"#475569",
              display:"flex",alignItems:"center",justifyContent:"center" }}>
            <ChevronLeft size={11} />
          </button>
          {pageNumbers.map(n => (
            <button type="button" aria-label={`Trang ${n}`} aria-current={page===n?"page":undefined} disabled={loading || !!error} key={n} onClick={() => setPage(n)}
              style={{ width:24,height:24,borderRadius:6,fontSize:11,
                border:page===n?"none":"1px solid #E2E8F0",cursor:"pointer",
                background:page===n?"#0F172A":"#FFF",color:page===n?"#FFF":"#475569",
                fontWeight:page===n?700:400 }}>{n}</button>
          ))}
          <button type="button" aria-label="Trang sau" onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={loading || !!error || page>=totalPages}
            style={{ width:24,height:24,borderRadius:6,border:"1px solid #E2E8F0",background:"#FFF",
              cursor:loading || error || page>=totalPages?"not-allowed":"pointer",color:loading || error || page>=totalPages?"#CBD5E1":"#475569",
              display:"flex",alignItems:"center",justifyContent:"center" }}>
            <ChevronRight size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   OTA RECONCILIATION SCREEN
══════════════════════════════════════════════════════════ */
function VatScreen({ vatData = [], onExportXml, onExportAllXml, date }: {
  vatData?: VatRow[];
  date: string;
  onExportXml?: (id: number) => void;
  onExportAllXml?: (ids: number[]) => void;
}) {
  const [selectedInvoice, setSelectedInvoice] = useState<VatRow | null>(null);
  const totalVat = vatData.filter(row=>row.status==="issued").reduce((s,r) => s+r.vat, 0);
  const currentDateLabel = formatDateVi(date);
  return (
    <div className="acct-panel acct-vat-report" style={{ padding:"20px 22px",flex:1,overflowY:"auto" }}>
      <div className="acct-section-header" style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:18,fontWeight:700,color:"#0F172A",marginBottom:2 }}>Hóa đơn &amp; VAT</h2>
          <p style={{ fontSize:12,color:"#94A3B8" }}>Hóa đơn VAT phát hành ngày {currentDateLabel}</p>
        </div>
        <div className="acct-section-actions" style={{ display:"flex",gap:8 }}>
          <button disabled={vatData.length===0} onClick={() => window.print()} style={{ padding:"7px 14px",borderRadius:8,border:"1px solid #E2E8F0",
            background:"#FFF",color:"#334155",fontSize:12,fontWeight:600,cursor:"pointer",
            display:"flex",alignItems:"center",gap:5 }}>
            <Printer size={12} /> In tất cả
          </button>
          <button disabled={!vatData.some(row => row.vatId && row.status==="issued")} onClick={() => onExportAllXml?.(vatData.flatMap(row => row.vatId && row.status==="issued" ? [row.vatId] : []))} style={{ padding:"7px 14px",borderRadius:8,
            background:"#0F172A",color:"#FFF",fontSize:12,fontWeight:600,cursor:"pointer",
            display:"flex",alignItems:"center",gap:5,opacity:vatData.some(row => row.vatId && row.status==="issued") ? 1 : 0.5 }}>
            <Download size={12} /> Xuất XML
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="acct-vat-summary" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16 }}>
        {[
          { label:"Tổng hóa đơn đã phát hành",val:String(vatData.filter(r=>r.status==="issued").length),unit:"hóa đơn" },
          { label:"Hóa đơn chờ phát hành",     val:String(vatData.filter(r=>r.status==="pending").length), unit:"hóa đơn" },
          { label:"VAT trên hóa đơn đã phát hành",val:fmtMoney(totalVat),unit:"Phát hành hóa đơn không đồng nghĩa đã thu tiền" },
        ].map(c => (
          <div key={c.label} style={{ background:"#FFF",borderRadius:10,border:"1px solid #E2E8F0",padding:"14px 18px" }}>
            <p style={{ fontSize:11,color:"#64748B",marginBottom:4 }}>{c.label}</p>
            <p style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:800,color:"#0F172A",marginBottom:2 }}>{c.val}</p>
            <p style={{ fontSize:11,color:"#94A3B8" }}>{c.unit}</p>
          </div>
        ))}
      </div>

      <div className="acct-table-wrap" style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflow:"auto" }}>
        <table className="acct-table" style={{ width:"100%",borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#F8FAFC" }}>
              {["Số hóa đơn","Tên khách","Mã hóa đơn","Số tiền","VAT","Thuế suất","Trạng thái","Thao tác"].map(h => (
                <th key={h} style={{ padding:"10px 14px",fontSize:11,fontWeight:700,color:"#64748B",
                  textAlign:"left",letterSpacing:"0.04em",textTransform:"uppercase",whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vatData.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding:"32px 14px",textAlign:"center",fontSize:12,color:"#94A3B8" }}>
                  Chưa có dữ liệu hóa đơn VAT hoặc thuế suất.
                </td>
              </tr>
            )}
            {vatData.map((row,i) => (
              <tr key={row.invoice} style={{ borderTop:"1px solid #F1F5F9",background:i%2===0?"#FFF":"#FAFAFA" }}>
                <td style={{ padding:"11px 14px",fontSize:11,fontWeight:600,color:"#2563EB",
                  fontFamily:"'JetBrains Mono',monospace" }}>{row.invoice}</td>
                <td style={{ padding:"11px 14px",fontSize:13,fontWeight:600,color:"#0F172A" }}>{row.guest}</td>
                <td style={{ padding:"11px 14px",fontSize:13,fontWeight:700,color:"#0F172A" }}>{row.invoiceId}</td>
                <td style={{ padding:"11px 14px",fontSize:12,fontWeight:700,color:"#0F172A",
                  fontFamily:"'JetBrains Mono',monospace" }}>{fmtMoney(row.amount)}</td>
                <td style={{ padding:"11px 14px",fontSize:12,fontWeight:700,color:"#DC2626",
                  fontFamily:"'JetBrains Mono',monospace" }}>{fmtMoney(row.vat)}</td>
                <td style={{ padding:"11px 14px" }}>
                  <span style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:5,
                    background:"#F1F5F9",color:"#475569" }}>{row.vatRate}</span>
                </td>
                <td style={{ padding:"11px 14px" }}>
                  <span style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,
                    background:row.status==="issued"?"#DCFCE7":"#FEF9C3",
                    color:row.status==="issued"?"#166534":"#92400E" }}>
                    {row.status==="issued"?"✓ Đã phát hành":row.status==="cancelled"?"Đã hủy":"⏳ Bản nháp"}
                  </span>
                </td>
                <td style={{ padding:"11px 14px" }}>
                  <div style={{ display:"flex",gap:5 }}>
                    <button onClick={() => setSelectedInvoice(row)} aria-label={`Xem hóa đơn VAT ${row.invoice}`} style={{ fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:6,
                      border:"1px solid #E2E8F0",background:"#FFF",color:"#334155",cursor:"pointer" }}>Xem</button>
                    <button disabled={row.status!=="issued"} onClick={() => row.vatId && onExportXml?.(row.vatId)} style={{ fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:6,
                      border:"1px solid #E2E8F0",background:"#FFF",color:"#334155",cursor:"pointer" }}>XML</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedInvoice && (
        <AccountingDialog title="Chi tiết hóa đơn VAT" description={selectedInvoice.invoice} onClose={() => setSelectedInvoice(null)}>
            <dl style={{display:"grid",gridTemplateColumns:"minmax(130px, .8fr) 1.2fr",gap:"10px 16px",fontSize:12}}>
              <dt style={{color:"#64748B"}}>Khách hàng</dt><dd style={{fontWeight:600,color:"#0F172A"}}>{selectedInvoice.guest}</dd>
              <dt style={{color:"#64748B"}}>Mã hóa đơn gốc</dt><dd style={{fontWeight:600}}>{selectedInvoice.invoiceId}</dd>
              <dt style={{color:"#64748B"}}>Loại khách hàng</dt><dd>{selectedInvoice.customerType}</dd>
              <dt style={{color:"#64748B"}}>Mã số thuế</dt><dd>{selectedInvoice.taxCode || "—"}</dd>
              <dt style={{color:"#64748B"}}>Tên đơn vị</dt><dd>{selectedInvoice.companyName || "—"}</dd>
              <dt style={{color:"#64748B"}}>Địa chỉ</dt><dd>{selectedInvoice.companyAddress || "—"}</dd>
              <dt style={{color:"#64748B"}}>Tiền trước thuế</dt><dd style={{fontWeight:700}}>{fmtMoney(selectedInvoice.amount)}</dd>
              <dt style={{color:"#64748B"}}>Thuế suất / tiền thuế</dt><dd>{selectedInvoice.vatRate} · {fmtMoney(selectedInvoice.vat)}</dd>
              <dt style={{color:"#64748B"}}>Tổng thanh toán</dt><dd style={{fontWeight:800,color:"#8C6D37"}}>{fmtMoney(selectedInvoice.totalAmount)}</dd>
              <dt style={{color:"#64748B"}}>Trạng thái</dt><dd>{selectedInvoice.status === "issued" ? "Đã phát hành" : "Đang chờ"}</dd>
              <dt style={{color:"#64748B"}}>Thời điểm phát hành</dt><dd>{new Date(selectedInvoice.issuedAt).toLocaleString("vi-VN")}</dd>
              <dt style={{color:"#64748B"}}>Người lập</dt><dd>{selectedInvoice.createdBy}</dd>
            </dl>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
              {selectedInvoice.vatId && <button type="button" onClick={() => onExportXml?.(selectedInvoice.vatId!)} style={{height:36,padding:"0 14px",border:"1px solid #CBD5E1",borderRadius:8,background:"#FFF",fontWeight:700,cursor:"pointer"}}>Tải XML</button>}
              <button type="button" onClick={() => setSelectedInvoice(null)} style={{height:36,padding:"0 14px",border:0,borderRadius:8,background:"#0F172A",color:"#FFF",fontWeight:700,cursor:"pointer"}}>Đóng</button>
            </div>
        </AccountingDialog>
      )}
    </div>
  );
}

export default function AccountingStation({ onBack }: { onBack: () => void }) {
  const [mainTab, setMainTab] = useState<AccountingPage>("handover");
  const [financeSummary, setFinanceSummary] = useState<Reconciliation | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [liveDebts, setLiveDebts] = useState<PartnerDebt[]>([]);
  const [liveCashHandovers, setLiveCashHandovers] = useState<CashHandover[]>([]);
  const [selectedDate,setSelectedDate]=useState(businessDateValue());
  const [refresh,setRefresh]=useState(0);
  const [globalSearch,setGlobalSearch]=useState("");
  const [refundCount,setRefundCount]=useState<number|null>(null);
  const [dataError,setDataError]=useState("");
  const [dataLoading,setDataLoading]=useState(true);
  const refreshData=()=>setRefresh(value=>value+1);
  const [liveOta, setLiveOta] = useState<OtaReconciliation[]>([]);
  const [liveVat, setLiveVat] = useState<VatInvoice[]>([]);
  const [userProfile, setUserProfile] = useState<EmployeeProfileDto | null>(null);

  useEffect(() => {
    let active = true;setDataLoading(true);setSummaryError("");setDataError("");setFinanceSummary(null);setRefundCount(null);
    const load=<T,>(promise:Promise<T>,set:(value:T)=>void,label:string)=>promise.then(value=>{if(active)set(value);}).catch(cause=>{if(active)setDataError(previous=>[previous,apiErrorMessage(cause,label)].filter(Boolean).join(" · "));});
    Promise.allSettled([
      kitchenAccountingApi.reconciliation({from:selectedDate,to:selectedDate}).then(value=>{if(active)setFinanceSummary(value);}).catch(cause=>{if(active)setSummaryError(apiErrorMessage(cause,"Không thể tải tổng hợp tài chính."));}),
      load(kitchenAccountingApi.partnerDebts(),setLiveDebts,"Không thể tải công nợ."),
      load(kitchenAccountingApi.cashHandovers(),setLiveCashHandovers,"Không thể tải lịch sử bàn giao."),
      load(enterpriseApi.ota(),setLiveOta,"Không thể tải đối soát OTA."),
      load(enterpriseApi.vatInvoices(),setLiveVat,"Không thể tải hóa đơn VAT."),
      load(authApi.employeeProfile(),setUserProfile,"Không thể tải nhân viên."),
      load(kitchenAccountingApi.refundRequests(),rows=>setRefundCount(rows.filter(row=>row.status==="PENDING").length),"Không thể tải yêu cầu hoàn tiền."),
    ]).finally(()=>{if(active)setDataLoading(false);});
    return()=>{active=false;};
  },[selectedDate,refresh]);

  const liveVatData: VatRow[] = liveVat.filter(row=>row.issued_at.slice(0,10)===selectedDate).map(row => ({
    vatId: row.id,
    invoice: row.vat_invoice_number,
    guest: row.customer_name,
    invoiceId: row.invoice_id,
    amount: row.taxable_amount,
    vat: row.tax_amount,
    totalAmount: row.total_amount,
    vatRate: `${row.tax_rate}%`,
    status: row.status === "ISSUED" ? "issued" : row.status === "CANCELLED" ? "cancelled" : "pending",
    customerType: row.customer_type,
    taxCode: row.tax_code,
    companyName: row.company_name,
    companyAddress: row.company_address,
    issuedAt: row.issued_at,
    createdBy: row.created_by,
  }));
  const exportVatXml = async (id: number) => {
    try { const xml = await enterpriseApi.vatXml(id); const blob = new Blob([xml], { type: "application/xml;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `vat-${id}.xml`; link.click(); URL.revokeObjectURL(url); }
    catch (error) { window.alert("Không thể xuất XML VAT. Vui lòng thử lại."); }
  };
  const exportAllVatXml = async (ids: number[]) => {
    if (ids.length === 0) return;
    try {
      const documents = await Promise.all(ids.map(id => enterpriseApi.vatXml(id)));
      const body = documents.map(document => document.replace(/^\s*<\?xml[^>]*\?>\s*/i, "")).join("\n");
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<vatInvoices>\n${body}\n</vatInvoices>`;
      const url = URL.createObjectURL(new Blob([xml], { type: "application/xml;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `vat-invoices-${selectedDate}.xml`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      window.alert("Không thể xuất danh sách XML VAT. Vui lòng thử lại.");
    }
  };
  const summaryMoney = (value: number | undefined) => value === undefined ? "—" : fmtMoney(value);
  const financeKpis = [
    { label:"Thu/hoàn ròng ngày chọn", Icon:DollarSign, iconBg:"#DCFCE7",iconColor:"#16A34A",val:summaryMoney(financeSummary?.net_total),sub:financeSummary ? `${financeSummary.completed_transactions} giao dịch hoàn tất` : "Đang tải tổng hợp" },
    { label:"Tiền mặt thu/hoàn ròng ngày chọn", Icon:DollarSign, iconBg:"#DBEAFE",iconColor:"#2563EB",val:summaryMoney(financeSummary ? financeSummary.totals_by_method.CASH ?? 0 : undefined), sub:"Theo giao dịch thu và hoàn thực tế" },
    { label:"Thanh toán thẻ ròng ngày chọn", Icon:CreditCard, iconBg:"#EDE9FE",iconColor:"#5B21B6",val:summaryMoney(financeSummary ? financeSummary.totals_by_method.CARD ?? 0 : undefined),sub:"Theo giao dịch thu và hoàn thực tế" },
    { label:"Doanh thu đã ghi nhận ngày chọn",Icon:BarChart2,iconBg:"#DCFCE7",iconColor:"#15803D",val:summaryMoney(financeSummary?.recognized_revenue),sub:"Theo bút toán doanh thu đã chốt" },
    { label:"Còn phải thu — chuyển khoản",Icon:Building2, iconBg:"#FEF9C3",iconColor:"#92400E",val:summaryMoney(financeSummary?.outstanding_bank_transfer_balances), sub:"Số dư còn phải thu trên hóa đơn chuyển khoản" },
    { label:"Hoàn tiền chờ Giám đốc",  Icon:RefreshCcw,  iconBg:"#FFE4E8",iconColor:"#DC2626",val:refundCount===null?"—":String(refundCount), sub:"Yêu cầu do tôi gửi đang chờ duyệt" },
  ];
  return (
    <AccountingWorkspace
      page={mainTab} onPageChange={next=>{setGlobalSearch("");setMainTab(next);}} profile={userProfile} loading={dataLoading}
      search={globalSearch} onSearchChange={value=>{setGlobalSearch(value);setMainTab(mainTab==="vat"?"vat":"ledger");}}
      date={selectedDate} onDateChange={setSelectedDate} onRefresh={refreshData} onLogout={onBack}
      metrics={financeKpis}
      alerts={<>
        {summaryError && <p role="alert">{summaryError}</p>}
        {dataError && <p role="alert">{dataError} <button type="button" style={compactActionStyle} onClick={refreshData}>Tải lại dữ liệu</button></p>}
        {dataLoading && <p role="status">Đang cập nhật dữ liệu kế toán…</p>}
      </>}
    >
      {mainTab === "handover" && <div className="acct-overview-grid">
        <CashHandoverPanel handovers={liveCashHandovers} date={selectedDate} actor={userProfile?.employee_id} onSaved={refreshData}/>
        <LedgerPanel date={selectedDate} onDateChange={setSelectedDate} search={globalSearch} onSearchChange={setGlobalSearch} refresh={refresh}/>
      </div>}
      {mainTab === "ledger" && <LedgerPanel fillHeight date={selectedDate} onDateChange={setSelectedDate} search={globalSearch} onSearchChange={setGlobalSearch} refresh={refresh}/>}
      {mainTab === "ota" && <OtaReconciliationScreen rows={liveOta} onUpdated={updated=>setLiveOta(rows=>rows.map(row=>row.reservation_id===updated.reservation_id?updated:row))}/>}
      {mainTab === "vat" && <div className="acct-vat-stack"><InvoiceOperations vatInvoices={liveVat} onChanged={refreshData} onVatCreated={row=>setLiveVat(rows=>[row,...rows])} refresh={refresh} search={globalSearch}/><VatScreen vatData={liveVatData} date={selectedDate} onExportXml={exportVatXml} onExportAllXml={exportAllVatXml}/></div>}
      {mainTab === "debt" && <FinanceOperations debts={liveDebts} date={selectedDate} onChanged={refreshData} refresh={refresh}/>}
    </AccountingWorkspace>
  );
}
