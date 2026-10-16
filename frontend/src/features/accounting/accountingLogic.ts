import type { Invoice, CashDenomination, Payment, PaymentMethod } from "../../shared/types/kitchenAccounting";
import { ApiError, apiErrorMessage } from "../../shared/api/client";
import { formatDateVi, formatDateTimeVi } from "../../shared/utils/localDate";
import { formatVnd } from "../../shared/utils/money";

/** Preserve local accounting validation messages while keeping API errors structured. */
export const accountingErrorMessage = (error: unknown, fallback: string) => error instanceof ApiError
  ? apiErrorMessage(error, fallback)
  : error instanceof Error && error.message ? error.message : fallback;

export const businessDateValue = (date = new Date()) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);

/** Invoice.payable is remaining receivable, never revenue or the VAT base. */
export const invoiceTotal = (invoice: Invoice) => Math.max(0, Math.round((invoice.room_total + invoice.service_total
  + invoice.late_surcharge + invoice.compensation + invoice.extension_total + invoice.adjustment_total - invoice.discount)/1000)*1000);

export const parseCashCount = (text: string, amount: number): CashDenomination[] => {
  if (!text.trim()) return [];
  const lines = text.split(",").map(token => {
    const parts = token.trim().split(":");
    const denomination = Number(parts[0]); const quantity = Number(parts[1]);
    if(parts.length !== 2 || !Number.isSafeInteger(denomination) || denomination <= 0 || !Number.isSafeInteger(quantity) || quantity <= 0)
      throw new Error("Chi tiết mệnh giá dùng định dạng 500000:2,200000:1.");
    return { denomination, quantity };
  });
  if(lines.reduce((sum,line)=>sum+line.denomination*line.quantity,0)!==amount)
    throw new Error("Tổng chi tiết mệnh giá phải bằng tiền thực đếm.");
  return lines;
};

/** Refund command binds one original payment and its original method. */
export const refundablePaymentAmount = (payment: Payment, payments: Payment[]) => payment.type !== "PAYMENT" || payment.status !== "COMPLETED" ? 0
  : Math.max(0,payment.amount-payments.filter(row=>row.type === "REFUND" && row.status === "COMPLETED"
    && row.reference?.startsWith(`REFUND_OF:${payment.id}:`)).reduce((sum,row)=>sum+row.amount,0));

/** Printing is read-only. Supplemental names/reasons exist only while the dialog is open. */
export interface CashVoucher {
  kind: "receipt" | "expense";
  number: string;
  occurredAt: string;
  amount: number;
  method: PaymentMethod | null;
  issuerId: string;
  issuerName: string;
  reference: string;
  reason: string;
  counterpartyName?: string;
}
export interface CashVoucherPrintDetails { counterpartyName: string; issuerName: string; reason: string; purpose: string; }
export const receiptPurposes = ["Thu tiền cọc phòng", "Thanh toán tiền phòng & dịch vụ", "Thu khác"];
export const expensePurposes = ["Mua thiết bị", "Phí bảo trì", "Mua minibar", "Phí OTA", "Lương", "Chi khác"];
export const cashVoucherMethod = (method:PaymentMethod|null) => ({CASH:"Tiền mặt",CARD:"Thẻ (POS)",BANK_TRANSFER:"Chuyển khoản ngân hàng",MOMO:"Ví MoMo",OTHER:"Khác"})[method??"OTHER"];
const voucherEscape=(value:unknown)=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));

export function cashVoucherHtml(voucher:CashVoucher,details:CashVoucherPrintDetails) {
  const incoming=voucher.kind==="receipt";
  const choices=incoming?receiptPurposes:expensePurposes;
  const check=(label:string,checked:boolean)=>`<span class="acct-voucher-option"><span class="acct-voucher-check">${checked?"✓":""}</span>${voucherEscape(label)}</span>`;
  return `<article class="acct-voucher-paper">
    <header><div><strong>KHÁCH SẠN MaM HOTEL</strong><p>Đơn vị phụ trách: Kế toán</p></div><span>Mẫu số: ${incoming?"KT_BM1":"KT_BM2"}</span></header>
    <h1>${incoming?"PHIẾU THU":"PHIẾU CHI"}</h1>
    <div class="acct-voucher-meta"><p><strong>Số phiếu:</strong> ${voucherEscape(voucher.number)}</p><p><strong>Ngày lập:</strong> ${voucherEscape(formatDateVi(voucher.occurredAt))}</p></div>
    <p><strong>Họ tên người ${incoming?"nộp":"nhận"} tiền:</strong> ${voucherEscape(details.counterpartyName.trim()||"................................................................")}</p>
    <div class="acct-voucher-purpose"><strong>Lý do ${incoming?"nộp":"chi"}:</strong><div>${choices.map(label=>check(label,label===details.purpose)).join("")}</div></div>
    <p class="acct-voucher-reason">${voucherEscape(details.reason.trim()||"................................................................................................")}</p>
    <p class="acct-voucher-amount"><strong>Số tiền ${incoming?"nộp":"chi"}:</strong> ${voucherEscape(formatVnd(voucher.amount))}</p>
    <div class="acct-voucher-method"><strong>Hình thức thanh toán:</strong><div>${["CASH","CARD","BANK_TRANSFER"].map(method=>check(cashVoucherMethod(method as PaymentMethod),voucher.method===method)).join("")}${!["CASH","CARD","BANK_TRANSFER"].includes(voucher.method??"")?check(voucher.method?cashVoucherMethod(voucher.method):"Chưa ghi phương thức",true):""}</div></div>
    <p class="acct-voucher-reference"><strong>Chứng từ liên quan:</strong> ${voucherEscape(voucher.reference)}</p>
    <section class="acct-voucher-signatures"><div><strong>Người ${incoming?"nộp":"nhận"} tiền</strong><em>(Ký, ghi rõ họ tên)</em><p>${voucherEscape(details.counterpartyName)}</p></div><div><strong>Kế toán lập phiếu</strong><em>(Ký, ghi rõ họ tên)</em><p>${voucherEscape(details.issuerName)}</p><small>Mã nhân viên: ${voucherEscape(voucher.issuerId)}</small></div></section>
    <footer>Thời điểm ghi nhận: ${voucherEscape(formatDateTimeVi(voucher.occurredAt))}</footer>
  </article>`;
}

export const cashVoucherStyles=String.raw`
.acct-voucher-paper{box-sizing:border-box;background:white;color:#111;font-family:"Times New Roman",serif;font-size:15px;line-height:1.7;padding:32px;overflow-wrap:anywhere;text-align:left}
.acct-voucher-paper *{box-sizing:border-box}.acct-voucher-paper p{margin:12px 0}.acct-voucher-paper header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;font-size:13px}.acct-voucher-paper header p{margin:0}.acct-voucher-paper h1{text-align:center;font-size:25px;letter-spacing:1px;margin:27px 0 20px;font-weight:bold;color:#000}
.acct-voucher-paper .acct-voucher-meta{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #333;padding-bottom:12px;margin-bottom:20px}.acct-voucher-paper .acct-voucher-meta p{margin:0}.acct-voucher-paper .acct-voucher-option{display:inline-flex;align-items:center;gap:7px;margin-right:16px;margin-top:7px;font-size:14px}.acct-voucher-paper .acct-voucher-check{display:inline-flex;justify-content:center;align-items:center;border:1px solid #444;width:14px;height:14px;font-family:Arial,sans-serif;font-size:12px;flex-shrink:0}.acct-voucher-paper .acct-voucher-reason{white-space:pre-wrap;min-height:42px}.acct-voucher-paper .acct-voucher-amount{font-size:19px;border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:11px 0}.acct-voucher-paper .acct-voucher-reference{font-size:13px;margin-top:20px}
.acct-voucher-paper .acct-voucher-signatures{display:grid;grid-template-columns:1fr 1fr;gap:25px;border-top:1px dashed #555;margin-top:30px;padding-top:20px;break-inside:avoid}.acct-voucher-paper .acct-voucher-signatures>div{text-align:center}.acct-voucher-paper .acct-voucher-signatures em{display:block;font-size:13px}.acct-voucher-paper .acct-voucher-signatures p{padding-top:65px;font-weight:bold;margin-bottom:0;white-space:pre-wrap}.acct-voucher-paper .acct-voucher-signatures small{font-size:11px}.acct-voucher-paper footer{font-size:11px;color:#555;border-top:1px solid #ddd;padding-top:10px;margin-top:24px}
`;

/** The iframe contains one saved voucher only; never prints the application screen. */
export function printCashVoucher(voucher:CashVoucher,details:CashVoucherPrintDetails,onError:(message:string)=>void) {
  if(!details.counterpartyName.trim()||!details.issuerName.trim()||!details.reason.trim())throw new Error("Nhập đầy đủ họ tên và lý do trước khi in phiếu.");
  if(!Number.isSafeInteger(voucher.amount)||voucher.amount<=0)throw new Error("Chứng từ không có số tiền hợp lệ để in.");
  document.getElementById("accounting-cash-voucher-frame")?.remove();
  const frame=document.createElement("iframe");
  frame.id="accounting-cash-voucher-frame";frame.title="In phiếu thu chi";frame.setAttribute("aria-hidden","true");
  Object.assign(frame.style,{position:"fixed",width:"0",height:"0",border:"0",bottom:"0",left:"0"});
  let started=false;
  frame.onload=()=>{
    if(started)return;started=true;
    try{
      const target=frame.contentWindow;if(!target||typeof target.print!=="function")throw new Error("Trình duyệt chưa mở được hộp thoại in. Hãy thử lại.");
      target.addEventListener("afterprint",()=>frame.remove(),{once:true});target.focus();target.print();
    }catch(cause){frame.remove();onError(accountingErrorMessage(cause,"Không thể mở hộp thoại in."));}
  };
  frame.srcdoc=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${voucherEscape(voucher.number)}</title><style>@page{size:A4 portrait;margin:18mm}html,body{margin:0;background:#fff}${cashVoucherStyles}.acct-voucher-paper{padding:0;font-size:12pt}.acct-voucher-paper h1{font-size:20pt}</style></head><body>${cashVoucherHtml(voucher,details)}</body></html>`;
  document.body.appendChild(frame);
}
