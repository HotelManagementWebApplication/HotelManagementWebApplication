import type { Invoice, CashDenomination, Payment } from "../../shared/types/kitchenAccounting";
import { ApiError, apiErrorMessage } from "../../shared/api/client";

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
