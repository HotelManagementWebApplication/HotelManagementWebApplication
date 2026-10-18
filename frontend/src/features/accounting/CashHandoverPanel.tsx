import { useState } from "react";
import { kitchenAccountingApi as api } from "../../shared/api/kitchenAccounting";
import type { CashHandover } from "../../shared/types/kitchenAccounting";
import { formatVnd } from "../../shared/utils/money";
import { formatDateTimeVi } from "../../shared/utils/localDate";
import { apiErrorMessage } from "../../shared/api/client";
import { AccountingDocument, handoverDocument } from "./AccountingDocument";
import { compactActionStyle, primaryActionStyle } from "./accountingUi";

export default function CashHandoverPanel({ handovers, date, actor, onSaved }: { handovers: CashHandover[]; date: string; actor?: string; onSaved: () => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [document, setDocument] = useState<CashHandover | null>(null);
  const rows = handovers.filter(row => row.handed_over_at.slice(0, 10) === date);
  const confirm = async (row: CashHandover) => {
    if (busy !== null) return;
    setBusy(row.id); setError("");
    try { await api.confirmCashHandover(row.id); onSaved(); }
    catch (cause) { setError(apiErrorMessage(cause, "Không thể xác nhận bàn giao. Hãy thử lại.")); }
    finally { setBusy(null); }
  };
  return <section className="acct-card acct-handover">
    <header className="acct-card-header"><div><h2>Tiếp nhận bàn giao ca</h2><p>Lễ tân kiểm đếm và gửi bàn giao; kế toán kiểm tra thông tin, xác nhận đã nhận.</p></div></header>
    {error && <p role="alert" style={{ padding: 16, color: "#b91c1c" }}>{error}</p>}
    <div className="acct-table-wrap"><table className="acct-table"><thead><tr>{["Thời điểm / ca", "Người giao → nhận", "Dự kiến", "Thực đếm", "Chênh lệch", "Xác nhận / chứng từ"].map(label => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}>
        <td>{formatDateTimeVi(row.handed_over_at)}<br/>{({ MORNING: "Ca sáng", AFTERNOON: "Ca chiều", NIGHT: "Ca đêm" } as Record<string, string>)[row.shift_code] ?? row.shift_code}</td>
        <td>{row.from_actor} → {row.to_actor}{row.note && <p style={{ maxWidth: 250, color: "#64748b", fontSize: 11 }}>{row.note}</p>}</td>
        <td>{formatVnd(row.expected_amount)}</td><td>{formatVnd(row.actual_amount)}</td>
        <td style={{ color: row.variance === 0 ? "#15803d" : "#b91c1c", fontWeight: 600 }}>{formatVnd(row.variance)}</td>
        <td><div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
          {row.confirmed_at ? <span style={{ color: "#15803d" }}>Đã xác nhận<br/>{formatDateTimeVi(row.confirmed_at)}</span> : row.to_actor === actor ? <button type="button" style={primaryActionStyle} disabled={busy !== null} onClick={() => void confirm(row)}>{busy === row.id ? "Đang xác nhận…" : "Xác nhận đã nhận"}</button> : <span>Chờ người nhận xác nhận</span>}
          <button type="button" style={compactActionStyle} disabled={busy !== null} onClick={() => setDocument(row)}>In biên bản BG-{row.id}</button>
        </div></td>
      </tr>)}{!rows.length && <tr><td colSpan={6} style={{ padding: 28, textAlign: "center", color: "#64748b" }}>Chưa có bàn giao trong ngày.</td></tr>}</tbody>
    </table></div>
    {document && <AccountingDocument data={handoverDocument(document)} onClose={() => setDocument(null)} />}
  </section>;
}
