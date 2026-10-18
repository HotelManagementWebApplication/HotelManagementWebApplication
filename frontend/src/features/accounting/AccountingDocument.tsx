import { useEffect, useRef, useState } from "react";
import { Printer } from "lucide-react";
import type { CashHandover, Expense, PaymentMethod, Receipt } from "../../shared/types/kitchenAccounting";
import { formatDateTimeVi } from "../../shared/utils/localDate";
import { formatVnd } from "../../shared/utils/money";
import { AccountingDialog } from "./AccountingDialog";
import { primaryActionStyle, secondaryActionStyle } from "./accountingUi";

export interface AccountingDocumentData {
  title: string;
  number: string;
  recordedAt: string;
  fields: [string, string][];
  signatures: string[];
}
const methodName = (method: PaymentMethod | null) => method === null ? "Chưa ghi phương thức" : ({ CASH: "Tiền mặt", CARD: "Thẻ", BANK_TRANSFER: "Chuyển khoản", MOMO: "Ví MoMo", OTHER: "Khác" })[method];

export const receiptDocument = (row: Receipt): AccountingDocumentData => ({
  title: "PHIẾU THU", number: row.receipt_number, recordedAt: row.issued_at,
  fields: [["Hóa đơn liên quan", `INV-${row.invoice_id}`], ["Số tiền đã lập phiếu", formatVnd(row.amount)], ["Phương thức thanh toán", methodName(row.method)], ["Mã nhân viên lập phiếu", row.issued_by]],
  signatures: ["Người nộp tiền", "Người lập phiếu"],
});
export const expenseDocument = (row: Expense): AccountingDocumentData => ({
  title: "PHIẾU CHI", number: `PC-${String(row.id).padStart(6, "0")}`, recordedAt: row.paid_at,
  fields: [["Nhóm chi phí", row.category], ["Nội dung", row.description], ["Số tiền đã chi", formatVnd(row.amount)], ["Phương thức thanh toán", methodName(row.method)], ["Mã nhân viên ghi nhận", row.paid_by], ["Trạng thái", row.status === "VOIDED" ? "Đã hủy" : "Đã ghi nhận"]],
  signatures: ["Người nhận tiền", "Người lập phiếu"],
});
export const handoverDocument = (row: CashHandover): AccountingDocumentData => ({
  title: "BIÊN BẢN BÀN GIAO CA", number: `BG-${row.id}`, recordedAt: row.handed_over_at,
  fields: [["Ca bàn giao", ({ MORNING: "Ca sáng", AFTERNOON: "Ca chiều", NIGHT: "Ca đêm" } as Record<string, string>)[row.shift_code] ?? row.shift_code], ["Mã nhân viên bàn giao", row.from_actor], ["Mã nhân viên tiếp nhận", row.to_actor], ["Số tiền dự kiến", formatVnd(row.expected_amount)], ["Số tiền thực đếm", formatVnd(row.actual_amount)], ["Chênh lệch", formatVnd(row.variance)], ["Ghi chú", row.note || "—"], ["Xác nhận tiếp nhận", row.confirmed_at ? `${row.confirmed_by || row.to_actor} · ${formatDateTimeVi(row.confirmed_at)}` : "Chờ xác nhận"]],
  signatures: ["Người bàn giao", "Người tiếp nhận"],
});

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const documentStyles = `
  .acct-paper{box-sizing:border-box;background:white;color:#111;font-family:"Times New Roman",serif;font-size:15px;line-height:1.7;padding:30px;min-width:440px}
  .acct-paper header{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #aaa;padding-bottom:14px;font-size:13px}
  .acct-paper h1{text-align:center;font-size:24px;font-weight:bold;margin:28px 0}
  .acct-paper dl{display:grid;grid-template-columns:minmax(150px,1fr) 2fr;gap:12px 22px}.acct-paper dt{font-weight:bold}.acct-paper dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
  .acct-paper .signatures{display:flex;justify-content:space-around;gap:20px;border-top:1px dashed #aaa;margin-top:32px;padding-top:20px;text-align:center;break-inside:avoid}.acct-paper .signatures>div{flex:1;min-height:150px}.acct-paper em{display:block;font-size:12px}.acct-paper footer{font-size:11px;border-top:1px solid #ddd;padding-top:10px;color:#555}
`;
export const accountingDocumentHtml = (data: AccountingDocumentData) => `<article class="acct-paper">
  <header><strong>KHÁCH SẠN MaM HOTEL</strong><span>Số chứng từ: ${escapeHtml(data.number)}</span></header>
  <h1>${escapeHtml(data.title)}</h1><dl><dt>Thời điểm ghi nhận</dt><dd>${escapeHtml(formatDateTimeVi(data.recordedAt))}</dd>${data.fields.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>
  <div class="signatures">${data.signatures.map(label => `<div><strong>${escapeHtml(label)}</strong><em>(Ký, ghi rõ họ tên)</em></div>`).join("")}</div><footer>Nội dung trích từ chứng từ đã lưu trên hệ thống.</footer>
</article>`;

export function AccountingDocument({ data, onClose }: { data: AccountingDocumentData; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const html = accountingDocumentHtml(data);
  useEffect(() => () => { frame.current?.remove(); }, []);
  const print = () => {
    if (printing) return;
    setPrinting(true); setError(""); frame.current?.remove();
    const next = document.createElement("iframe");
    frame.current = next;
    next.title = `In ${data.number}`;
    next.setAttribute("aria-hidden", "true");
    Object.assign(next.style, { position: "fixed", width: "0", height: "0", border: "0", bottom: "0", left: "0" });
    next.onload = () => {
      try {
        const target = next.contentWindow;
        if (!target) throw new Error("Không mở được bản in.");
        target.focus(); target.print();
      } catch { setError("Không mở được hộp thoại in. Hãy thử lại."); }
      finally { setPrinting(false); }
    };
    next.srcdoc = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(data.number)}</title><style>@page{size:A4 portrait;margin:18mm}body{margin:0}${documentStyles}.acct-paper{padding:0;min-width:0}</style></head><body>${html}</body></html>`;
    document.body.appendChild(next);
  };
  return <AccountingDialog title={`${data.title} · ${data.number}`} description="Xem trước chứng từ đã lưu" onClose={onClose} className="acct-document-dialog">
    <p className="acct-document-note">Thông tin dưới đây lấy từ chứng từ đã lưu. In lại giữ nguyên nội dung và không ghi thêm giao dịch. Trong hộp thoại in, có thể chọn lưu thành PDF.</p>
    {error && <p role="alert">{error}</p>}
    <div className="acct-document-preview"><style>{documentStyles}</style><div dangerouslySetInnerHTML={{ __html: html }} /></div>
    <div className="acct-document-actions"><button type="button" style={secondaryActionStyle} onClick={onClose}>Đóng</button><button type="button" style={primaryActionStyle} disabled={printing} onClick={print}><Printer size={16} />{printing ? "Đang mở bản in…" : "In / Lưu PDF"}</button></div>
  </AccountingDialog>;
}
