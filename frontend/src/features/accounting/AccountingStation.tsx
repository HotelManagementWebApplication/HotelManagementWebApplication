import { useEffect, useState } from "react";
import { kitchenAccountingApi, newKitchenIdempotencyKey } from "../../shared/api/kitchenAccounting";
import { enterpriseApi } from "../../shared/api/enterprise";
import { authApi } from "../../shared/api/auth";
import { apiErrorMessage, ApiError } from "../../shared/api/client";
import { EmployeeProfileDropdown } from "../../shared/components/EmployeeProfileDropdown";
import type { OtaReconciliation, VatInvoice } from "../../shared/types/enterprise";
import type { CashHandover, CashDenomination, LedgerPayment, PaymentMethod, PaymentPage, Reconciliation, PartnerDebt } from "../../shared/types/kitchenAccounting";
import { employeeRoleLabel } from "../../shared/types/api";
import type { EmployeeProfileDto } from "../../shared/types/api";
import { localDateValue } from "../../shared/utils/localDate";
import { formatVnd, formatVndNumber } from "../../shared/utils/money";
import {
  LayoutDashboard, ConciergeBell, CalendarDays, Sparkles, UtensilsCrossed,
  Wrench, FileText, BarChart2, Users, Settings,
  Search, Bell, ChevronDown, Download, Printer,
  DollarSign, CreditCard, Building2, RefreshCcw, AlertCircle,
  CheckCircle2, ArrowUpRight, ChevronLeft, ChevronRight, LogOut, Sun, Moon,
} from "lucide-react";


/* ══════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════ */
type MainTab = "handover" | "ledger" | "ota" | "vat" | "debt";
type LedgerTab = "all" | "cash" | "card" | "vietqr" | "momo" | "other";
type PayStatus = "paid" | "pending" | "refunded" | "failed" | "cancelled";
type OtaChannel = "agoda" | "booking" | "expedia" | "airbnb" | "direct";

interface PaymentLedgerEntry {
  id: string;
  invoiceId: string;
  reservationId: number | "—";
  guest: string;
  description: string;
  amount: number;
  method: string;
  methodType: LedgerTab;
  time: string;
  status: PayStatus;
  ledgerTab: LedgerTab[];
}
interface OtaRow {
  channel: OtaChannel; bookings: number; revenue: number;
  commission: number; net: number; status: "reconciled"|"pending"|"dispute";
  reservationIds?: number[];
}
interface CashRow {
  denom: string;
  opening: number;
  received: number;
  paidOut: number;
  expected: number;
  actual: number;
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
const fmtVND = formatVndNumber;

const SIDEBAR_NAV: { id:MainTab; label:string; Icon:React.ElementType }[] = [
  { id:"handover", label:"Tổng quan & Bàn giao ca", Icon:LayoutDashboard },
  { id:"ledger",   label:"Sổ thanh toán",            Icon:CreditCard },
  { id:"vat",      label:"Hóa đơn & Biên lai",       Icon:FileText },
  { id:"ota",      label:"Đối soát kênh bán",        Icon:RefreshCcw },
  { id:"debt",     label:"Công nợ đối tác",          Icon:Building2 },
];

const METHOD_CFG: Record<string,{bg:string;text:string;label:string}> = {
  visa:    { bg:"#DBEAFE",text:"#1D4ED8",label:"VISA" },
  card:    { bg:"#FFE4E6",text:"#BE123C",label:"Thẻ" },
  cash:    { bg:"#DCFCE7",text:"#166534",label:"Tiền mặt" },
  vietqr:  { bg:"#EDE9FE",text:"#5B21B6",label:"Chuyển khoản" },
  momo:    { bg:"#FCE7F3",text:"#9D174D",label:"Ví MoMo" },
  other:   { bg:"#F1F5F9",text:"#475569",label:"Khác" },
};

const OTA_CFG: Record<OtaChannel,{label:string;color:string;bg:string;emoji:string}> = {
  agoda:   { label:"Agoda",       color:"#D97706",bg:"#FEF3C7",emoji:"🔴" },
  booking: { label:"Booking.com", color:"#0369A1",bg:"#F0F9FF",emoji:"🔵" },
  expedia: { label:"Expedia",     color:"#1D4ED8",bg:"#DBEAFE",emoji:"✈️" },
  airbnb:  { label:"Airbnb",      color:"#DC2626",bg:"#FFE4E6",emoji:"🏠" },
  direct:  { label:"Trực tiếp",      color:"#166534",bg:"#DCFCE7",emoji:"🏨" },
};

/* ══════════════════════════════════════════════════════════
   CASH HANDOVER TABLE
══════════════════════════════════════════════════════════ */
function CashHandoverPanel({
  cashRows = [],
  handoverDate,
  fromStaff,
  toStaff,
  onSubmit,
  submitting = false,
}: {
  cashRows?: CashRow[];
  handoverDate?: string;
  fromStaff?: string;
  toStaff?: string;
  onSubmit?: (payload: { actualAmount: number; toActor: string; denominations: CashDenomination[] }) => Promise<void>;
  submitting?: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [actualAmount, setActualAmount] = useState("");
  const [nextActor, setNextActor] = useState("");
  const [denominationText, setDenominationText] = useState("");
  const totalExpected = cashRows.reduce((s,r) => s + r.expected, 0);
  const totalActual   = cashRows.reduce((s,r) => s + r.actual, 0);
  const variance      = totalActual - totalExpected;

  const submitHandover = async () => {
    if (!onSubmit) return;
    const amount = Number(actualAmount.replace(/,/g, "").trim());
    if (!Number.isFinite(amount) || amount < 0) {
      window.alert("Vui lòng nhập số tiền bàn giao hợp lệ.");
      return;
    }
    if (!nextActor.trim()) {
      window.alert("Vui lòng nhập mã nhân viên nhận ca.");
      return;
    }
    const denominations: CashDenomination[] = [];
    if (denominationText.trim()) {
      for (const token of denominationText.split(",")) {
        const [denominationValue, quantityValue] = token.split(":").map(value => value.trim());
        const denomination = Number(denominationValue);
        const quantity = Number(quantityValue);
        if (!Number.isFinite(denomination) || denomination <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
          window.alert("Chi tiết mệnh giá dùng định dạng: 500000:2,200000:1");
          return;
        }
        denominations.push({ denomination, quantity });
      }
      const denominationTotal = denominations.reduce((sum, line) => sum + line.denomination * line.quantity, 0);
      if (denominationTotal !== amount) {
        window.alert("Tổng chi tiết mệnh giá phải bằng số tiền bàn giao.");
        return;
      }
    }
    try {
      await onSubmit({ actualAmount: amount, toActor: nextActor.trim(), denominations });
      setConfirmed(true);
      setFormOpen(false);
    } catch (error) {
      window.alert("Không thể ghi nhận bàn giao. Vui lòng thử lại.");
    }
  };

  return (
    <div style={{ flex:"0 0 50%",minWidth:0,display:"flex",flexDirection:"column",
      background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"16px 18px",borderBottom:"1px solid #E2E8F0",
        display:"flex",alignItems:"flex-start",justifyContent:"space-between" }}>
        <div>
          <p style={{ fontSize:14,fontWeight:700,color:"#0F172A",marginBottom:2 }}>Bàn giao két tiền theo ca</p>
          <p style={{ fontSize:11,color:"#94A3B8" }}>Đối soát số dư giữa các ca làm việc</p>
        </div>
        <button style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,
          border:"1px solid #E2E8F0",background:"#F8FAFC",color:"#334155",fontSize:11,
          fontWeight:600,cursor:"pointer",whiteSpace:"nowrap" }}>
          <Printer size={12} /> In biên bản bàn giao
        </button>
      </div>

      {/* Shift timeline */}
      <div style={{ padding:"14px 18px",borderBottom:"1px solid #F1F5F9",
        display:"flex",alignItems:"center",gap:12 }}>
        {/* Morning shift */}
        <div style={{ flex:1,background:"#FFF7ED",borderRadius:10,padding:"10px 12px",
          display:"flex",alignItems:"center",gap:8 }}>
          <div style={{ width:34,height:34,borderRadius:99,background:"#FEF9C3",
            display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
            <Sun size={16} style={{ color:"#F59E0B" }} />
          </div>
          <div>
            <p style={{ fontSize:11,fontWeight:700,color:"#0F172A" }}>Ca trước</p>
            <p style={{ fontSize:11,color:"#64748B" }}>{fromStaff || "Nhân viên ca trước"}</p>
            <p style={{ fontSize:10,color:"#94A3B8" }}>06:00 – 14:00</p>
          </div>
        </div>
        {/* Arrow */}
        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:2 }}>
          <div style={{ fontSize:16,color:"#94A3B8" }}>→</div>
          <div style={{ background:"#F8FAFC",borderRadius:6,border:"1px solid #E2E8F0",
            padding:"3px 8px",textAlign:"center" }}>
            <p style={{ fontSize:10,fontWeight:700,color:"#0F172A" }}>Bàn giao</p>
            <p style={{ fontSize:9,color:"#94A3B8" }}>{handoverDate || new Date().toLocaleDateString("vi-VN")}</p>
            <p style={{ fontSize:10,fontWeight:700,color:"#0F172A" }}>14:00</p>
          </div>
          <div style={{ fontSize:16,color:"#94A3B8" }}>→</div>
        </div>
        {/* Evening shift */}
        <div style={{ flex:1,background:"#EFF6FF",borderRadius:10,padding:"10px 12px",
          display:"flex",alignItems:"center",gap:8 }}>
          <div style={{ width:34,height:34,borderRadius:99,background:"#DBEAFE",
            display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
            <Moon size={16} style={{ color:"#2563EB" }} />
          </div>
          <div>
            <p style={{ fontSize:11,fontWeight:700,color:"#0F172A" }}>Ca nhận</p>
            <p style={{ fontSize:11,color:"#64748B" }}>{toStaff || "Nhân viên nhận ca"}</p>
            <p style={{ fontSize:10,color:"#94A3B8" }}>14:00 – 22:00</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex:1,overflowY:"auto" }}>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#F8FAFC" }}>
              {["Mệnh giá","Đầu ca","Thu vào","Chi ra","Dự kiến","Thực đếm","Chênh lệch"].map(h => (
                <th key={h} style={{ padding:"8px 12px",fontSize:10,fontWeight:700,color:"#64748B",
                  textAlign:h==="Denomination"?"left":"right",letterSpacing:"0.04em",
                  textTransform:"uppercase",whiteSpace:"nowrap",borderBottom:"1px solid #E2E8F0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cashRows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding:"28px 12px",textAlign:"center",fontSize:12,color:"#94A3B8" }}>
                  Chưa có dữ liệu bàn giao két.
                </td>
              </tr>
            )}
            {cashRows.map((r,i) => {
              const v = r.actual - r.expected;
              return (
                <tr key={r.denom} style={{ borderBottom:"1px solid #F8FAFC",background:i%2===0?"#FFF":"#FAFAFA" }}>
                  <td style={{ padding:"7px 12px",fontSize:12,fontWeight:600,color:"#0F172A",
                    fontFamily:"'JetBrains Mono',monospace" }}>{r.denom}</td>
                  {[r.opening,r.received,r.paidOut].map((val,j) => (
                    <td key={j} style={{ padding:"7px 12px",fontSize:12,color:"#475569",textAlign:"right" }}>{val}</td>
                  ))}
                  {[r.expected,r.actual].map((val,j) => (
                    <td key={j} style={{ padding:"7px 12px",fontSize:12,fontWeight:600,color:"#0F172A",
                      textAlign:"right",fontFamily:"'JetBrains Mono',monospace" }}>{fmtVND(val)}</td>
                  ))}
                  <td style={{ padding:"7px 12px",textAlign:"right" }}>
                    <span style={{ fontSize:12,fontWeight:700,
                      color:v===0?"#16A34A":v>0?"#2563EB":"#DC2626" }}>
                      {v === 0 ? "0" : v > 0 ? `+${fmtVND(v)}` : fmtVND(v)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {/* Total row */}
            <tr style={{ background:"#F8FAFC",borderTop:"2px solid #E2E8F0" }}>
              <td style={{ padding:"9px 12px",fontSize:12,fontWeight:800,color:"#0F172A" }}>Tổng</td>
              <td style={{ padding:"9px 12px",textAlign:"right",fontSize:12,color:"#94A3B8" }}>-</td>
              <td style={{ padding:"9px 12px",textAlign:"right",fontSize:12,color:"#94A3B8" }}>-</td>
              <td style={{ padding:"9px 12px",textAlign:"right",fontSize:12,color:"#94A3B8" }}>-</td>
              <td style={{ padding:"9px 12px",fontSize:12,fontWeight:800,color:"#0F172A",textAlign:"right",
                fontFamily:"'JetBrains Mono',monospace" }}>{fmtVND(totalExpected)}</td>
              <td style={{ padding:"9px 12px",fontSize:12,fontWeight:800,color:"#0F172A",textAlign:"right",
                fontFamily:"'JetBrains Mono',monospace" }}>{fmtVND(totalActual)}</td>
              <td style={{ padding:"9px 12px",textAlign:"right" }}>
                <span style={{ fontSize:13,fontWeight:800,color:variance===0?"#16A34A":variance>0?"#2563EB":"#DC2626" }}>{variance === 0 ? "0" : `${variance > 0 ? "+" : ""}${fmtVND(variance)}`}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ padding:"12px 18px",borderTop:"1px solid #E2E8F0",
        display:"flex",alignItems:"center",gap:12 }}>
        <div style={{ flex:1,display:"flex",alignItems:"center",gap:8,padding:"8px 12px",
          borderRadius:8,background:variance===0?"#DCFCE7":"#FEF3C7",border:`1px solid ${variance===0?"#86EFAC":"#FCD34D"}` }}>
          <CheckCircle2 size={16} style={{ color:variance===0?"#16A34A":"#D97706",flexShrink:0 }} />
          <div>
            <p style={{ fontSize:12,fontWeight:700,color:variance===0?"#166534":"#92400E" }}>{variance===0?"Bàn giao cân bằng":"Cần đối soát chênh lệch"}</p>
            <p style={{ fontSize:11,color:variance===0?"#15803D":"#B45309" }}>Chênh lệch: {fmtVND(variance)}{variance===0?" (không sai lệch)":""}</p>
          </div>
        </div>
        <button onClick={() => { setActualAmount(String(totalActual)); setFormOpen(open => !open); setConfirmed(false); }}
          style={{ padding:"9px 18px",borderRadius:8,border:"none",cursor:"pointer",
            background:confirmed?"#15803D":"#16A34A",color:"#FFF",fontSize:12,fontWeight:700,
            display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap" }}>
          <CheckCircle2 size={13} />
          {confirmed ? "Đã ghi nhận ✓" : formOpen ? "Đóng biểu mẫu" : "Ghi nhận bàn giao"}
        </button>
      </div>
      {formOpen && (
        <div style={{ padding:"12px 18px",borderTop:"1px solid #E2E8F0",background:"#F8FAFC" }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <label style={{ fontSize:11,color:"#475569" }}>Số tiền thực tế
              <input value={actualAmount} onChange={event => setActualAmount(event.target.value)} inputMode="decimal" style={{ display:"block",width:"100%",height:32,marginTop:4,padding:"0 8px",border:"1px solid #CBD5E1",borderRadius:7,boxSizing:"border-box" }} />
            </label>
            <label style={{ fontSize:11,color:"#475569" }}>Mã nhân viên nhận ca
              <input value={nextActor} onChange={event => setNextActor(event.target.value)} placeholder="Ví dụ: FRONTDESK" style={{ display:"block",width:"100%",height:32,marginTop:4,padding:"0 8px",border:"1px solid #CBD5E1",borderRadius:7,boxSizing:"border-box" }} />
            </label>
          </div>
          <label style={{ display:"block",fontSize:11,color:"#475569",marginTop:9 }}>Chi tiết mệnh giá
            <input value={denominationText} onChange={event => setDenominationText(event.target.value)} placeholder="500000:2,200000:1" style={{ display:"block",width:"100%",height:32,marginTop:4,padding:"0 8px",border:"1px solid #CBD5E1",borderRadius:7,boxSizing:"border-box" }} />
          </label>
          <button type="button" onClick={() => void submitHandover()} disabled={submitting} style={{ marginTop:10,height:32,padding:"0 14px",border:0,borderRadius:7,background:"#0F172A",color:"#FFF",fontSize:11,fontWeight:700,opacity:submitting?0.6:1 }}>
            {submitting ? "Đang lưu bàn giao…" : "Lưu bàn giao"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   INVOICE & PAYMENT LEDGER PANEL
══════════════════════════════════════════════════════════ */
function LedgerPanel({ fillHeight = false }: { fillHeight?: boolean }) {
  const [lTab, setLTab] = useState<LedgerTab>("all");
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentPage, setPaymentPage] = useState<PaymentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const PER_PAGE = 10;
  const currentDateLabel = new Date().toLocaleDateString("vi-VN");
  const today = localDateValue();
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
  }, [page, method, searchQuery, today, reload]);

  const toLedgerRow = (payment: LedgerPayment): PaymentLedgerEntry => {
      const methodType: LedgerTab = payment.method === "CASH" ? "cash"
        : payment.method === "CARD" ? "card"
        : payment.method === "BANK_TRANSFER" ? "vietqr"
        : payment.method === "MOMO" ? "momo" : "other";
      const status: PayStatus = payment.status === "COMPLETED"
        ? payment.type === "REFUND" ? "refunded" : "paid"
        : payment.status === "PENDING" ? "pending"
        : payment.status === "CANCELLED" ? "cancelled" : "failed";
      const occurredAt = new Date(payment.occurred_at);
      return {
        id: `PAY-${payment.id}`,
        invoiceId: `INV-${payment.invoice_id}`,
        reservationId: payment.reservation_id,
        guest: `Đặt phòng #${payment.reservation_id}`,
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
    { id:"momo",    label:"Ví MoMo",       count:methodCounts.MOMO ?? 0 },
    { id:"other",   label:"Khác",          count:methodCounts.OTHER ?? 0 },
  ];

  const STATUS_CFG: Record<PayStatus,{label:string;bg:string;text:string;dot:string}> = {
    paid:     { label:"Đã thanh toán",     bg:"#DCFCE7",text:"#166534",dot:"#16A34A" },
    pending:  { label:"Chờ thanh toán",  bg:"#DBEAFE",text:"#1D4ED8",dot:"#3B82F6" },
    refunded: { label:"Đã hoàn tiền", bg:"#FEF9C3",text:"#92400E",dot:"#F59E0B" },
    failed:   { label:"Thất bại", bg:"#FFE4E6",text:"#BE123C",dot:"#E11D48" },
    cancelled:{ label:"Đã hủy", bg:"#F1F5F9",text:"#64748B",dot:"#94A3B8" },
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
    link.download = `payments-${localDateValue()}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setExportError(apiErrorMessage(cause,"Không thể xuất giao dịch CSV.")); }
    finally { setExporting(false); }
  };

  return (
    <div style={{ flex:fillHeight?"1 1 100%":"1 1 50%",minWidth:0,minHeight:0,display:"flex",flexDirection:"column",
      background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"16px 18px",borderBottom:"1px solid #E2E8F0",
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
      <div style={{ padding:"10px 18px",borderBottom:"1px solid #F1F5F9",
        display:"flex",gap:8,alignItems:"center" }}>
        <div style={{ position:"relative",flex:1 }}>
          <Search size={12} style={{ position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none" }} />
          <input value={searchQuery} maxLength={200} onChange={event => { setSearchQuery(event.target.value); setPage(1); }} placeholder="Tìm mã giao dịch, hóa đơn hoặc đặt phòng..."
            style={{ width:"100%",height:30,paddingLeft:28,paddingRight:8,borderRadius:7,
              border:"1px solid #E2E8F0",background:"#F8FAFC",fontSize:11,outline:"none",boxSizing:"border-box" }} />
        </div>
        <div style={{ position:"relative" }}>
          <select style={{ height:30,padding:"0 22px 0 8px",borderRadius:7,border:"1px solid #E2E8F0",
            background:"#F8FAFC",fontSize:11,outline:"none",cursor:"pointer",appearance:"none" }}>
            <option>{currentDateLabel}</option>
          </select>
          <ChevronDown size={10} style={{ position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none" }} />
        </div>
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
      <div style={{ display:"flex",padding:"0 18px",borderBottom:"1px solid #E2E8F0",gap:0 }}>
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

      {error && <div role="alert" style={{padding:"12px 18px",color:"#B91C1C"}}>{error} <button onClick={()=>setReload(value=>value+1)}>Tải lại giao dịch</button></div>}
      {exportError && <div role="alert" style={{padding:"12px 18px",color:"#B91C1C"}}>{exportError}</div>}
      {/* Table */}
      <div style={{ flex:1,overflowY:"auto" }}>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
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
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
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
function OtaScreen({ otaData = [], onReconcile }: { otaData?: OtaRow[]; onReconcile?: (row: OtaRow) => void }) {
  const STATUS_CFG = {
    reconciled: { label:"Đã đối soát",bg:"#DCFCE7",text:"#166534",dot:"#16A34A" },
    pending:    { label:"Đang chờ",   bg:"#FEF9C3",text:"#92400E",dot:"#F59E0B" },
    dispute:    { label:"Cần xử lý",   bg:"#FFE4E6",text:"#BE123C",dot:"#EF4444" },
  };
  const totalRevenue    = otaData.reduce((s,r) => s+r.revenue, 0);
  const totalCommission = otaData.reduce((s,r) => s+r.commission, 0);
  const totalNet        = otaData.reduce((s,r) => s+r.net, 0);

  return (
    <div style={{ padding:"20px 22px",flex:1,overflowY:"auto" }}>
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:18,fontWeight:700,color:"#0F172A",marginBottom:2 }}>Đối soát kênh bán</h2>
          <p style={{ fontSize:12,color:"#94A3B8" }}>Đối soát doanh thu từ các kênh đặt phòng theo thời gian thực</p>
        </div>
        <button style={{ display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:8,
          border:"1px solid #E2E8F0",background:"#FFF",color:"#334155",fontSize:12,fontWeight:600,cursor:"pointer" }}>
          <Download size={12} /> Xuất báo cáo
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16 }}>
        {[
          { label:"Tổng doanh thu kênh",  val:fmtMoney(totalRevenue),    color:"#0F172A" },
          { label:"Tổng hoa hồng",   val:fmtMoney(totalCommission), color:"#DC2626" },
          { label:"Doanh thu ròng",        val:fmtMoney(totalNet),        color:"#16A34A" },
        ].map(c => (
          <div key={c.label} style={{ background:"#FFF",borderRadius:10,border:"1px solid #E2E8F0",padding:"14px 18px" }}>
            <p style={{ fontSize:11,color:"#64748B",marginBottom:6 }}>{c.label}</p>
            <p style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:800,color:c.color }}>{c.val}</p>
          </div>
        ))}
      </div>

      <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden" }}>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#F8FAFC" }}>
              {["Kênh bán","Đặt phòng","Doanh thu gộp","Hoa hồng","Doanh thu ròng","Trạng thái","Thao tác"].map(h => (
                <th key={h} style={{ padding:"10px 14px",fontSize:11,fontWeight:700,color:"#64748B",
                  textAlign:"left",letterSpacing:"0.04em",textTransform:"uppercase",whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {otaData.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding:"32px 14px",textAlign:"center",fontSize:12,color:"#94A3B8" }}>
                  Chưa có dữ liệu kênh OTA/nguồn đặt phòng để đối soát.
                </td>
              </tr>
            )}
            {otaData.map((row,i) => {
              const cfg = OTA_CFG[row.channel];
              const stc = STATUS_CFG[row.status];
              const commPct = ((row.commission/row.revenue)*100).toFixed(0);
              return (
                <tr key={row.channel} style={{ borderTop:"1px solid #F1F5F9",background:i%2===0?"#FFF":"#FAFAFA" }}>
                  <td style={{ padding:"11px 14px" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <div style={{ width:32,height:32,borderRadius:8,background:cfg.bg,
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>{cfg.emoji}</div>
                      <span style={{ fontSize:13,fontWeight:600,color:"#0F172A" }}>{cfg.label}</span>
                    </div>
                  </td>
                  <td style={{ padding:"11px 14px",fontSize:13,fontWeight:700,color:"#0F172A" }}>{row.bookings}</td>
                  <td style={{ padding:"11px 14px",fontSize:12,fontWeight:600,color:"#0F172A",
                    fontFamily:"'JetBrains Mono',monospace" }}>{fmtMoney(row.revenue)}</td>
                  <td style={{ padding:"11px 14px" }}>
                    <p style={{ fontSize:12,fontWeight:600,color:"#DC2626",fontFamily:"'JetBrains Mono',monospace" }}>{fmtMoney(row.commission)}</p>
                    <p style={{ fontSize:10,color:"#94A3B8" }}>{commPct}% rate</p>
                  </td>
                  <td style={{ padding:"11px 14px",fontSize:12,fontWeight:700,color:"#16A34A",
                    fontFamily:"'JetBrains Mono',monospace" }}>{fmtMoney(row.net)}</td>
                  <td style={{ padding:"11px 14px" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:5 }}>
                      <span style={{ width:7,height:7,borderRadius:99,background:stc.dot,flexShrink:0 }} />
                      <span style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,
                        background:stc.bg,color:stc.text }}>{stc.label}</span>
                    </div>
                  </td>
                  <td style={{ padding:"11px 14px" }}>
                    <button onClick={() => onReconcile?.(row)} style={{ fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:6,
                      border:"1px solid #E2E8F0",background:"#FFF",color:"#334155",cursor:"pointer" }}>
                      {row.status==="dispute" ? "Xử lý" : "Đối soát"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {/* Total */}
            <tr style={{ background:"#F8FAFC",borderTop:"2px solid #E2E8F0" }}>
              <td style={{ padding:"11px 14px",fontSize:13,fontWeight:800,color:"#0F172A" }}>Tổng</td>
              <td style={{ padding:"11px 14px",fontSize:13,fontWeight:700,color:"#0F172A" }}>{otaData.reduce((s,r)=>s+r.bookings,0)}</td>
              <td style={{ padding:"11px 14px",fontSize:13,fontWeight:800,color:"#0F172A",fontFamily:"'JetBrains Mono',monospace" }}>{fmtMoney(totalRevenue)}</td>
              <td style={{ padding:"11px 14px",fontSize:13,fontWeight:800,color:"#DC2626",fontFamily:"'JetBrains Mono',monospace" }}>{fmtMoney(totalCommission)}</td>
              <td style={{ padding:"11px 14px",fontSize:13,fontWeight:800,color:"#16A34A",fontFamily:"'JetBrains Mono',monospace" }}>{fmtMoney(totalNet)}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   INVOICES & VAT SCREEN
══════════════════════════════════════════════════════════ */
function VatScreen({ vatData = [], onExportXml, onExportAllXml }: {
  vatData?: VatRow[];
  onExportXml?: (id: number) => void;
  onExportAllXml?: (ids: number[]) => void;
}) {
  const [selectedInvoice, setSelectedInvoice] = useState<VatRow | null>(null);
  const totalVat = vatData.reduce((s,r) => s+r.vat, 0);
  const currentDateLabel = new Date().toLocaleDateString("vi-VN");
  return (
    <div style={{ padding:"20px 22px",flex:1,overflowY:"auto" }}>
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:18,fontWeight:700,color:"#0F172A",marginBottom:2 }}>Hóa đơn &amp; VAT</h2>
          <p style={{ fontSize:12,color:"#94A3B8" }}>Hóa đơn VAT phát hành ngày {currentDateLabel}</p>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={() => window.print()} style={{ padding:"7px 14px",borderRadius:8,border:"1px solid #E2E8F0",
            background:"#FFF",color:"#334155",fontSize:12,fontWeight:600,cursor:"pointer",
            display:"flex",alignItems:"center",gap:5 }}>
            <Printer size={12} /> In tất cả
          </button>
          <button disabled={!vatData.some(row => row.vatId)} onClick={() => onExportAllXml?.(vatData.flatMap(row => row.vatId ? [row.vatId] : []))} style={{ padding:"7px 14px",borderRadius:8,
            background:"#0F172A",color:"#FFF",fontSize:12,fontWeight:600,cursor:"pointer",
            display:"flex",alignItems:"center",gap:5,opacity:vatData.some(row => row.vatId) ? 1 : 0.5 }}>
            <Download size={12} /> Xuất XML
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16 }}>
        {[
          { label:"Tổng hóa đơn đã phát hành",val:String(vatData.filter(r=>r.status==="issued").length),unit:"hóa đơn" },
          { label:"Hóa đơn chờ phát hành",     val:String(vatData.filter(r=>r.status==="pending").length), unit:"hóa đơn" },
          { label:"Tổng VAT đã thu",  val:`${Math.round(totalVat).toLocaleString("vi-VN")} ₫`,unit:"Theo số liệu đã ghi nhận" },
        ].map(c => (
          <div key={c.label} style={{ background:"#FFF",borderRadius:10,border:"1px solid #E2E8F0",padding:"14px 18px" }}>
            <p style={{ fontSize:11,color:"#64748B",marginBottom:4 }}>{c.label}</p>
            <p style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:800,color:"#0F172A",marginBottom:2 }}>{c.val}</p>
            <p style={{ fontSize:11,color:"#94A3B8" }}>{c.unit}</p>
          </div>
        ))}
      </div>

      <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden" }}>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
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
                    {row.status==="issued"?"✓ Đã phát hành":"⏳ Đang chờ"}
                  </span>
                </td>
                <td style={{ padding:"11px 14px" }}>
                  <div style={{ display:"flex",gap:5 }}>
                    <button onClick={() => setSelectedInvoice(row)} aria-label={`Xem hóa đơn VAT ${row.invoice}`} style={{ fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:6,
                      border:"1px solid #E2E8F0",background:"#FFF",color:"#334155",cursor:"pointer" }}>Xem</button>
                    <button onClick={() => row.vatId && onExportXml?.(row.vatId)} style={{ fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:6,
                      border:"1px solid #E2E8F0",background:"#FFF",color:"#334155",cursor:"pointer" }}>XML</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedInvoice && (
        <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedInvoice(null); }} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(15,23,42,.48)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <section role="dialog" aria-modal="true" aria-labelledby="vat-invoice-detail-title" style={{width:"min(100%,560px)",maxHeight:"90vh",overflowY:"auto",background:"#FFF",borderRadius:14,boxShadow:"0 24px 80px rgba(15,23,42,.24)",padding:22}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,borderBottom:"1px solid #E2E8F0",paddingBottom:14,marginBottom:14}}>
              <div>
                <h3 id="vat-invoice-detail-title" style={{fontSize:17,fontWeight:800,color:"#0F172A"}}>Chi tiết hóa đơn VAT</h3>
                <p style={{fontFamily:"monospace",fontSize:12,color:"#2563EB",marginTop:4}}>{selectedInvoice.invoice}</p>
              </div>
              <button type="button" aria-label="Đóng chi tiết hóa đơn" onClick={() => setSelectedInvoice(null)} style={{border:0,background:"transparent",fontSize:22,cursor:"pointer",color:"#64748B"}}>×</button>
            </div>
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
          </section>
        </div>
      )}
    </div>
  );
}

function DebtScreen({ debts, onSettled }: { debts: PartnerDebt[]; onSettled: (debt: PartnerDebt) => Promise<void> }) {
  const [settled, setSettled] = useState<string[]>([]);
  return (
    <div style={{flex:1,overflowY:"auto",padding:"18px 22px"}}>
      <div style={{background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"14px 16px",borderBottom:"1px solid #E2E8F0"}}>
          <p style={{fontSize:14,fontWeight:700}}>Công nợ phải thu đối tác</p>
          <p style={{fontSize:11,color:"#64748B",marginTop:2}}>Ghi nhận và đối soát tài chính; không thay đổi đặt phòng hoặc trạng thái phòng.</p>
        </div>
        {debts.map(row=>{
          const key = String(row.id);
          const done=settled.includes(key) || row.status === "SETTLED";
          return <div key={row.id} style={{display:"grid",gridTemplateColumns:"110px 1.4fr 1fr 150px 150px",gap:12,alignItems:"center",padding:"13px 16px",borderBottom:"1px solid #F1F5F9"}}>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#2563EB"}}>{row.reference_code}</span>
            <div><p style={{fontSize:12,fontWeight:700}}>{row.partner_name}</p><p style={{fontSize:10,color:"#94A3B8"}}>{new Date(row.recorded_at).toLocaleDateString("vi-VN")}</p></div>
            <strong style={{fontSize:12}}>{(row.amount-row.settled_amount).toLocaleString("vi-VN")} ₫</strong>
            <span style={{fontSize:11,color:"#64748B"}}>{row.status}</span>
            <button disabled={done} onClick={()=>void onSettled(row).then(()=>setSettled(ids=>[...ids,key]))} style={{height:32,borderRadius:8,border:"none",background:done?"#DCFCE7":"#0F172A",color:done?"#166534":"#FFF",fontSize:11,fontWeight:700,cursor:done?"default":"pointer"}}>{done?"Đã tất toán":"Ghi nhận tất toán"}</button>
          </div>;
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function AccountingStation({ onBack }: { onBack: () => void }) {
  const [mainTab, setMainTab] = useState<MainTab>("handover");
  const [financeSummary, setFinanceSummary] = useState<Reconciliation | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [liveDebts, setLiveDebts] = useState<PartnerDebt[]>([]);
  const [liveCashHandovers, setLiveCashHandovers] = useState<CashHandover[]>([]);
  const [cashHandoverSubmitting, setCashHandoverSubmitting] = useState(false);
  const [liveOta, setLiveOta] = useState<OtaReconciliation[]>([]);
  const [liveVat, setLiveVat] = useState<VatInvoice[]>([]);
  const [userProfile, setUserProfile] = useState<EmployeeProfileDto | null>(null);
  const [topProfileOpen, setTopProfileOpen] = useState(false);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);

  useEffect(() => {
    let active = true;

    kitchenAccountingApi.reconciliation({ from:localDateValue(), to:localDateValue() })
      .then(summary => { if (active) setFinanceSummary(summary); })
      .catch(cause => { if (active) setSummaryError(apiErrorMessage(cause,"Không thể tải tổng hợp tài chính.")); });

    kitchenAccountingApi.partnerDebts()
      .then(rows => { if (active) setLiveDebts(rows); })
      .catch(err => { console.warn("Backend partner debts unavailable:", err); if (active) setLiveDebts([]); });
    kitchenAccountingApi.cashHandovers()
      .then(rows => { if (active) setLiveCashHandovers(rows); })
      .catch(err => { console.warn("Backend cash handover data unavailable:", err); if (active) setLiveCashHandovers([]); });
    Promise.all([enterpriseApi.ota(), enterpriseApi.vatInvoices()])
      .then(([ota, vat]) => { if (active) { setLiveOta(ota); setLiveVat(vat); } })
      .catch(err => { console.warn("Backend OTA/VAT data unavailable:", err); if (active) { setLiveOta([]); setLiveVat([]); } });
    authApi.employeeProfile()
      .then(profile => { if (active) setUserProfile(profile); })
      .catch(err => console.warn("Backend accounting profile unavailable:", err));
    return () => { active = false; };
  }, []);

  const liveOtaData: OtaRow[] = Object.values(liveOta.reduce<Record<string, OtaRow>>((acc, row) => {
    const channel = (row.booking_source || "direct").toLowerCase() as OtaChannel;
    const key = ["agoda", "booking", "expedia", "airbnb", "direct"].includes(channel) ? channel : "direct";
    const current = acc[key] ?? { channel: key, bookings: 0, revenue: 0, commission: 0, net: 0, status: "reconciled", reservationIds: [] };
    current.reservationIds?.push(row.reservation_id);
    current.bookings += 1; current.revenue += Number(row.gross_revenue || 0); current.commission += Number(row.commission || 0); current.net += Number(row.net_revenue || 0);
    if (row.status === "DISPUTED") current.status = "dispute"; else if (row.status === "PENDING") current.status = current.status === "reconciled" ? "pending" : current.status;
    acc[key] = current; return acc;
  }, {}));
  const liveVatData: VatRow[] = liveVat.map(row => ({
    vatId: row.id,
    invoice: row.vat_invoice_number,
    guest: row.customer_name,
    invoiceId: row.invoice_id,
    amount: row.taxable_amount,
    vat: row.tax_amount,
    totalAmount: row.total_amount,
    vatRate: `${row.tax_rate}%`,
    status: row.status === "ISSUED" ? "issued" : "pending",
    customerType: row.customer_type,
    taxCode: row.tax_code,
    companyName: row.company_name,
    companyAddress: row.company_address,
    issuedAt: row.issued_at,
    createdBy: row.created_by,
  }));
  const reconcileOta = async (row: OtaRow) => {
    const reservationId = row.reservationIds?.[0];
    if (!reservationId) return;
    try { await enterpriseApi.updateOtaStatus(reservationId, "MATCHED"); setLiveOta(items => items.map(item => item.reservation_id === reservationId ? { ...item, status: "MATCHED" } : item)); }
    catch (error) { window.alert("Không thể đối soát OTA. Vui lòng thử lại."); }
  };
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
      link.download = `vat-invoices-${localDateValue()}.xml`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      window.alert("Không thể xuất danh sách XML VAT. Vui lòng thử lại.");
    }
  };
  const submitCashHandover = async (payload: { actualAmount: number; toActor: string; denominations: CashDenomination[] }) => {
    if (!userProfile?.employee_id) throw new Error("Không xác định được nhân viên đang đăng nhập.");
    setCashHandoverSubmitting(true);
    try {
      const saved = await kitchenAccountingApi.recordCashHandover({
        shift_code: `ACCOUNTING-${localDateValue()}`,
        from_actor: userProfile.employee_id,
        to_actor: payload.toActor,
        actual_amount: payload.actualAmount,
        note: "Ghi nhận từ giao diện kế toán",
        denominations: payload.denominations,
      }, newKitchenIdempotencyKey());
      setLiveCashHandovers(rows => [saved, ...rows]);
    } finally {
      setCashHandoverSubmitting(false);
    }
  };
  const summaryMoney = (value: number | undefined) => value === undefined ? "—" : fmtMoney(value);
  const financeKpis = [
    { label:"Thu/hoàn ròng hôm nay", Icon:DollarSign, iconBg:"#DCFCE7",iconColor:"#16A34A",val:summaryMoney(financeSummary?.net_total),sub:financeSummary ? `${financeSummary.completed_transactions} giao dịch hoàn tất` : "Đang tải tổng hợp", subUp:false },
    { label:"Tiền mặt nhận ròng hôm nay", Icon:DollarSign, iconBg:"#DBEAFE",iconColor:"#2563EB",val:summaryMoney(financeSummary ? financeSummary.totals_by_method.CASH ?? 0 : undefined), sub:"Theo giao dịch thu và hoàn thực tế", subUp:false },
    { label:"Thanh toán thẻ ròng hôm nay", Icon:CreditCard, iconBg:"#EDE9FE",iconColor:"#5B21B6",val:summaryMoney(financeSummary ? financeSummary.totals_by_method.CARD ?? 0 : undefined),sub:"Theo giao dịch thu và hoàn thực tế", subUp:false },
    { label:"Chuyển khoản chờ đối soát",Icon:Building2, iconBg:"#FEF9C3",iconColor:"#92400E",val:summaryMoney(financeSummary?.pending_bank_transfers), sub:"Theo hóa đơn đang chờ", subUp:false },
    { label:"Hoàn tiền chờ Giám đốc",  Icon:RefreshCcw,  iconBg:"#FFE4E8",iconColor:"#DC2626",val:"0",          sub:"Chưa có dữ liệu hoàn tiền",       subUp:false },
  ];
  const todayLabel = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  const liveCashRows = liveCashHandovers.map(handOver => ({
    denom: `${handOver.shift_code} · ${handOver.from_actor} → ${handOver.to_actor}`,
    opening: 0,
    received: 0,
    paidOut: 0,
    expected: handOver.expected_amount,
    actual: handOver.actual_amount,
  }));

  const MAIN_TABS: { id:MainTab; label:string }[] = [
    { id:"handover", label:"Bàn giao ca & Két tiền" },
    { id:"ledger",   label:"Sổ thanh toán" },
    { id:"ota",      label:"Đối soát kênh bán" },
    { id:"vat",      label:"Hóa đơn & VAT" },
    { id:"debt",     label:"Công nợ đối tác" },
  ];

  return (
    <div style={{ display:"flex",height:"100vh",overflow:"hidden",
      background:"#F8FAFC",fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* SIDEBAR */}
      <aside style={{ width:190,background:"#FFF",borderRight:"1px solid #E2E8F0",
        display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden" }}>
        <div style={{ padding:"14px 14px 12px",borderBottom:"1px solid #E2E8F0" }}>
          <div style={{ display:"flex",alignItems:"center",gap:9 }}>
            <img
              src="/hotel_logo.png"
              alt="MaM Hotel Logo"
              style={{ width:36,height:"auto",objectFit:"contain",flexShrink:0,filter:"drop-shadow(0 2px 6px rgba(184,148,74,0.35))" }}
            />
            <div>
              <p style={{ fontSize:13,fontWeight:700,color:"#0F172A",lineHeight:1.1,fontFamily:"'Cormorant Garamond',Georgia,serif",letterSpacing:"0.05em" }}>MaM Hotel</p>
              <p style={{ fontSize:9,color:"#2563EB",letterSpacing:"0.08em",textTransform:"uppercase",marginTop:2,fontWeight:600 }}>KẾ TOÁN &amp; TÀI CHÍNH</p>
            </div>
          </div>
        </div>
        <nav style={{ flex:1,padding:"8px 8px",overflowY:"auto" }}>
          {SIDEBAR_NAV.map(n => {
            const active = mainTab === n.id;
            return <button key={n.id} onClick={() => setMainTab(n.id)}
              style={{ width:"100%",display:"flex",alignItems:"center",gap:9,
                padding:"8px 10px",borderRadius:8,cursor:"pointer",marginBottom:1,
                background:active?"#0F172A":"transparent",
                color:active?"#FFF":"#475569",fontWeight:active?600:400,fontSize:12,
                textAlign:"left",transition:"all .1s" }}>
              <n.Icon size={14} style={{ color:active?"#FFF":"#94A3B8",flexShrink:0 }} strokeWidth={active?2:1.5} />
              {n.label}
            </button>;
          })}
        </nav>
        {/* Profile */}
        <div style={{ padding:"10px 14px",borderTop:"1px solid #F1F5F9",position:"relative" }}>
          <div
            onClick={()=>setSidebarProfileOpen(p=>!p)}
            style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer" }}
            title="Hồ sơ nhân viên"
          >
            <div style={{ width:30,height:30,borderRadius:99,flexShrink:0,
              background:"linear-gradient(135deg,#1D4ED8,#3B82F6)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:12,fontWeight:800,color:"#FFF" }}>
              {userProfile?.full_name ? userProfile.full_name.slice(0, 2).toUpperCase() : "KT"}
            </div>
            <div>
              <p style={{ fontSize:11,fontWeight:700,color:"#0F172A",lineHeight:1 }}>{userProfile?.full_name || "Kế toán Khách sạn"}</p>
              <p style={{ fontSize:10,color:"#94A3B8" }}>{userProfile?.role ? employeeRoleLabel(userProfile.role) : "Phòng Kế toán - Tài chính"}</p>
            </div>
          </div>
          <button onClick={onBack}
            style={{ display:"flex",alignItems:"center",gap:5,color:"#94A3B8",cursor:"pointer",fontSize:11,background:"transparent",border:"none",padding:0 }}>
            <LogOut size={11} /> Đăng xuất
          </button>
          <EmployeeProfileDropdown
            isOpen={sidebarProfileOpen}
            onClose={()=>setSidebarProfileOpen(false)}
            onLogout={onBack}
            align="bottom-left"
            currentRoleLabel={userProfile?.role ? employeeRoleLabel(userProfile.role) : "Kế toán & Tài chính"}
            departmentName="Bộ phận Kế toán"
          />
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0 }}>

        {/* HEADER */}
        <header style={{ background:"#FFF",borderBottom:"1px solid #E2E8F0",height:52,
          display:"flex",alignItems:"center",gap:12,padding:"0 22px",flexShrink:0 }}>
          <div style={{ position:"relative",flex:1,maxWidth:560 }}>
            <Search size={13} style={{ position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none" }} />
              <input placeholder="Tìm hóa đơn, tên khách, số phòng hoặc mã giao dịch..."
              style={{ width:"100%",height:34,paddingLeft:32,paddingRight:42,borderRadius:8,
                border:"1px solid #E2E8F0",background:"#F8FAFC",fontSize:12,outline:"none",boxSizing:"border-box" }} />
            <span style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
              fontSize:10,color:"#CBD5E1",fontFamily:"'JetBrains Mono',monospace",
              background:"#F1F5F9",padding:"1px 5px",borderRadius:4,border:"1px solid #E2E8F0" }}>⌘ K</span>
          </div>
          <div style={{ flex:1 }} />
          <button style={{ width:34,height:34,borderRadius:8,background:"#F8FAFC",border:"1px solid #E2E8F0",
            display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative" }}>
            <Bell size={14} style={{ color:"#475569" }} />
            <span style={{ position:"absolute",top:6,right:6,width:7,height:7,borderRadius:99,background:"#EF4444" }} />
          </button>
          <div style={{ position:"relative" }}>
            <div
              onClick={()=>setTopProfileOpen(p=>!p)}
              style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer" }}
              title="Hồ sơ nhân viên"
            >
              <div style={{ width:30,height:30,borderRadius:99,
                background:"linear-gradient(135deg,#3B82F6,#1D4ED8)",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:11,fontWeight:700,color:"#FFF" }}>
                {userProfile?.full_name ? userProfile.full_name.slice(0, 2).toUpperCase() : "KT"}
              </div>
              <div>
                <p style={{ fontSize:12,fontWeight:700,color:"#0F172A",lineHeight:1 }}>{userProfile?.full_name || "Nhân viên kế toán"}</p>
                <p style={{ fontSize:10,color:"#94A3B8" }}>{userProfile?.role ? employeeRoleLabel(userProfile.role) : "Bộ phận Kế toán"}</p>
              </div>
              <ChevronDown size={12} style={{ color:"#94A3B8" }} />
            </div>
            <EmployeeProfileDropdown
              isOpen={topProfileOpen}
              onClose={()=>setTopProfileOpen(false)}
              onLogout={onBack}
              align="top-right"
            currentRoleLabel={userProfile?.role ? employeeRoleLabel(userProfile.role) : "Kế toán & Tài chính"}
              departmentName="Bộ phận Kế toán"
            />
          </div>
        </header>

        {/* SCROLL */}
        <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>

          {/* Page title + date */}
          <div style={{ padding:"18px 22px 0",background:"#FFF",borderBottom:"1px solid #E2E8F0",flexShrink:0 }}>
            <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14 }}>
              <div>
                <h1 style={{ fontSize:22,fontWeight:800,color:"#0F172A",marginBottom:3 }}>Kế toán &amp; Đối soát tài chính</h1>
                <p style={{ fontSize:13,color:"#64748B" }}>Quản lý hóa đơn, thanh toán, thu chi, bàn giao ca và công nợ</p>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:9,
                border:"1px solid #E2E8F0",background:"#FFF",cursor:"pointer" }}>
                <CalendarDays size={13} style={{ color:"#64748B" }} />
                <span style={{ fontSize:13,color:"#334155",fontWeight:500 }}>{todayLabel}</span>
                <ChevronDown size={12} style={{ color:"#94A3B8" }} />
              </div>
            </div>

            {summaryError && <p role="alert" style={{color:"#B91C1C",fontSize:12,marginBottom:10}}>{summaryError}</p>}
            {/* KPI CARDS */}
            <div style={{ display:"flex",gap:12,marginBottom:14,overflowX:"auto" }}>
              {financeKpis.map(k => (
                <div key={k.label} style={{ flex:"1 0 160px",background:"#FFF",borderRadius:10,border:"1px solid #E2E8F0",
                  padding:"13px 16px",display:"flex",alignItems:"center",gap:12,
                  boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
                  <div style={{ width:40,height:40,borderRadius:10,background:k.iconBg,flexShrink:0,
                    display:"flex",alignItems:"center",justifyContent:"center" }}>
                    <k.Icon size={18} style={{ color:k.iconColor }} />
                  </div>
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontSize:10,color:"#64748B",marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{k.label}</p>
                    <p style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:18,fontWeight:800,
                      color:k.label==="Hoàn tiền chờ Giám đốc"?"#DC2626":"#0F172A",lineHeight:1,marginBottom:2 }}>{k.val}</p>
                    <div style={{ display:"flex",alignItems:"center",gap:3 }}>
                      {k.subUp && <ArrowUpRight size={10} style={{ color:"#16A34A" }} />}
                      <span style={{ fontSize:10,color:k.subUp?"#16A34A":"#94A3B8",fontWeight:k.subUp?600:400,whiteSpace:"nowrap" }}>{k.sub}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Main tabs */}
            <div style={{ display:"flex",gap:0 }}>
              {MAIN_TABS.map(t => {
                const act = mainTab === t.id;
                return (
                  <button key={t.id} onClick={() => setMainTab(t.id)}
                    style={{ padding:"10px 18px",fontSize:13,fontWeight:act?600:400,cursor:"pointer",
                      color:act?"#0F172A":"#64748B",background:"transparent",
                      borderBottom:act?"2px solid #0F172A":"2px solid transparent",
                      whiteSpace:"nowrap",marginBottom:-1 }}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CONTENT */}
          {mainTab === "handover" && (
            <div style={{ flex:1,display:"flex",gap:14,padding:"14px 22px",overflow:"hidden" }}>
              <CashHandoverPanel cashRows={liveCashRows} handoverDate={todayLabel} fromStaff={userProfile?.employee_id} toStaff={userProfile?.full_name} onSubmit={submitCashHandover} submitting={cashHandoverSubmitting} />
              <LedgerPanel />
            </div>
          )}
          {mainTab === "ledger" && (
            <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",padding:"14px 22px" }}>
              <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden",flex:1,display:"flex",flexDirection:"column" }}>
                <LedgerPanel fillHeight />
              </div>
            </div>
          )}
          {mainTab === "ota"  && <OtaScreen otaData={liveOtaData} onReconcile={reconcileOta} />}
          {mainTab === "vat"  && <VatScreen vatData={liveVatData} onExportXml={exportVatXml} onExportAllXml={exportAllVatXml} />}
          {mainTab === "debt" && <DebtScreen debts={liveDebts} onSettled={async debt => {
            const remaining = debt.amount - debt.settled_amount;
            const updated = await kitchenAccountingApi.settlePartnerDebt(debt.id, { amount: remaining, note: "Tất toán từ giao diện kế toán" }, newKitchenIdempotencyKey());
            setLiveDebts(rows => rows.map(row => row.id === updated.id ? updated : row));
          }} />}
        </div>
      </div>
    </div>
  );
}
