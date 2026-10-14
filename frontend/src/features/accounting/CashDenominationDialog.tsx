import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { CashDenomination } from "../../shared/types/kitchenAccounting";
import { formatVnd } from "../../shared/utils/money";
import "./CashDenominationDialog.css";

const DENOMINATIONS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];
const COLORS = ["#ddc3b6", "#bad7cd", "#d2ddbd", "#bdd8d6", "#c8d2b5", "#e2cfaa", "#d8c7aa", "#d6d1ba", "#d4d2bd"];

export default function CashDenominationDialog({ value, onConfirm, onClose }: {
  value: CashDenomination[];
  onConfirm: (value: CashDenomination[]) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [quantities, setQuantities] = useState<Record<number, string>>(() =>
    Object.fromEntries(value.map(line => [line.denomination, String(line.quantity)])));
  const lines = DENOMINATIONS.map(denomination => ({ denomination, quantity: Number(quantities[denomination] || 0) }));
  const totalNotes = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + line.quantity * line.denomination, 0);
  const valid = lines.every(line => Number.isSafeInteger(line.quantity) && line.quantity >= 0)
    && Number.isSafeInteger(total) && Number.isSafeInteger(totalNotes);

  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog ref={dialogRef} className="cash-count-dialog" aria-labelledby="cash-count-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      } }}>
      <form onSubmit={event => { event.preventDefault(); if (valid) onConfirm(lines.filter(line => line.quantity > 0)); }}>
        <header className="cash-count-header">
          <h2 id="cash-count-title">Chi tiết kiểm đếm mệnh giá tiền mặt</h2>
          <button type="button" aria-label="Đóng kiểm đếm mệnh giá" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="cash-count-content">
          <table>
            <thead><tr><th>Mệnh giá</th><th>Số lượng tờ</th><th>Thành tiền</th></tr></thead>
            <tbody>{lines.map((line, index) => (
              <tr key={line.denomination}>
                <td><span className="cash-count-note" style={{ backgroundColor: COLORS[index] }}>{formatVnd(line.denomination)}</span></td>
                <td><input aria-label={`Số tờ ${formatVnd(line.denomination)}`} type="number" min="0" step="1" inputMode="numeric"
                  placeholder="0" value={quantities[line.denomination] ?? ""}
                  onChange={event => setQuantities(current => ({ ...current, [line.denomination]: event.target.value }))} /></td>
                <td>{formatVnd(line.denomination * line.quantity)}</td>
              </tr>
            ))}</tbody>
          </table>
          <div className="cash-count-totals" aria-live="polite">
            <div><span>Tổng số tờ</span><strong>{totalNotes.toLocaleString("vi-VN")}</strong></div>
            <div><span>Tổng tiền mặt kiểm đếm</span><strong>{formatVnd(total)}</strong></div>
          </div>
          {!valid && <p role="alert">Vui lòng nhập số tờ nguyên không âm và tổng tiền hợp lệ.</p>}
        </div>
        <footer className="cash-count-footer">
          <button type="button" onClick={onClose}>Hủy bỏ</button>
          <button type="submit" disabled={!valid}>Xác nhận &amp; Điền</button>
        </footer>
      </form>
    </dialog>
  );
}
