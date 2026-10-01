import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { customerApi } from "../../../shared/api/customer";
import { apiErrorMessage } from "../../../shared/api/client";
import type { CustomerReservation, VnpayPaymentAttempt } from "../../../shared/types/customer";

interface Props {
  isAuthenticated: boolean;
  onLogin: () => void;
}

const fmtVND = (value: number) => (value ?? 0).toLocaleString("vi-VN") + " ₫";

/** Trang đích sau redirect VNPay; trạng thái hiển thị được đọc lại từ backend. */
export function VnpayPaymentResultPage({ isAuthenticated, onLogin }: Props) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const reservationId = Number(params.get("reservation_id"));
  const returnResult = params.get("result") ?? "failed";
  const responseCode = params.get("response_code");
  const [reservation, setReservation] = useState<CustomerReservation | null>(null);
  const [attempt, setAttempt] = useState<VnpayPaymentAttempt | null>(null);
  const [loading, setLoading] = useState(isAuthenticated);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !Number.isSafeInteger(reservationId) || reservationId <= 0) {
      setLoading(false);
      return;
    }
    try {
      const [booking, payment] = await Promise.all([
        customerApi.reservation(reservationId),
        customerApi.latestVnpayPayment(reservationId),
      ]);
      setReservation(booking);
      setAttempt(payment);
      setError("");
    } catch (cause) {
      setError(apiErrorMessage(cause, "Không thể tải trạng thái thanh toán. Vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, reservationId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (attempt?.status !== "PENDING") return;
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(timer);
  }, [attempt?.status, refresh]);

  const paid = reservation?.deposit_payment?.status === "PAID" || attempt?.status === "SUCCEEDED";
  const pending = attempt?.status === "PENDING";
  const canRetry = Boolean(reservation && reservation.status === "DRAFT"
    && reservation.deposit_payment?.status === "PENDING"
    && (!reservation.deposit_payment.expires_at || new Date(reservation.deposit_payment.expires_at).getTime() > Date.now()));

  const retry = async () => {
    if (!canRetry || !reservation) return;
    setRetrying(true);
    setError("");
    try {
      const checkout = await customerApi.createVnpayCheckout(reservation.id);
      window.location.assign(checkout.payment_url);
    } catch (cause) {
      setError(apiErrorMessage(cause, "Không thể tạo lại giao dịch VNPay."));
      setRetrying(false);
    }
  };

  const backHome = () => window.location.assign("/");

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#F7F3EC] px-4 py-16 flex items-center justify-center">
        <section className="w-full max-w-lg rounded-3xl border border-[#E2D8C8] bg-white p-8 text-center shadow-xl">
          <ShieldCheck className="mx-auto text-[#8C6D37]" size={42} />
          <h1 className="font-display text-3xl text-[#1C1917] mt-4">Xem kết quả thanh toán</h1>
          <p className="text-sm text-[#78716C] mt-3">Vui lòng đăng nhập lại để kiểm tra booking và khoản tiền cọc của bạn.</p>
          <button type="button" onClick={onLogin} className="mt-7 w-full rounded-xl bg-[#1C1917] py-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-[#8C6D37]">
            Đăng nhập
          </button>
        </section>
      </main>
    );
  }

  const Icon = paid ? CheckCircle2 : pending ? Clock3 : AlertCircle;
  const iconClass = paid ? "bg-emerald-50 text-emerald-600" : pending ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600";
  const title = paid ? "Thanh toán cọc thành công" : pending ? "Đang xác nhận giao dịch" : "Thanh toán chưa hoàn tất";
  const description = paid
    ? "VNPay đã xác nhận khoản cọc. Phòng được giữ và booking đã đồng bộ sang lễ tân."
    : pending
    ? "Hệ thống đang chờ phản hồi từ VNPay. Trang này sẽ tự cập nhật."
    : returnResult === "invalid"
    ? "Kết quả trả về không có chữ ký hợp lệ. Booking chưa được ghi nhận thanh toán."
    : "Giao dịch bị hủy hoặc không thành công. Bạn có thể thử lại trong thời gian giữ phòng còn lại.";

  return (
    <main className="min-h-screen bg-[#F7F3EC] px-4 py-10 sm:py-16 flex items-center justify-center">
      <section className="w-full max-w-xl overflow-hidden rounded-3xl border border-[#E2D8C8] bg-white shadow-xl">
        <header className="border-b border-[#EEE7DA] bg-[#FBF8F2] px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#8C6D37]">MaM Hotel · VNPay Sandbox</p>
            <p className="mt-1 text-sm text-[#57534E]">Booking {reservationId > 0 ? `BK-${reservationId}` : "—"}</p>
          </div>
          <ShieldCheck size={24} className="text-[#8C6D37]" />
        </header>

        <div className="p-6 sm:p-9 text-center">
          <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${iconClass}`}>
            <Icon size={42} />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-[#1C1917] mt-5">{loading ? "Đang kiểm tra giao dịch…" : title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#78716C]">{loading ? "Vui lòng chờ trong giây lát." : description}</p>

          {error && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-left text-xs text-rose-700">{error}</div>}

          {!loading && reservation && (
            <div className="mt-7 rounded-2xl border border-[#E7DECD] bg-[#FAF6EE] p-4 text-left text-sm space-y-3">
              <div className="flex justify-between gap-4"><span className="text-[#78716C]">Mã giao dịch</span><strong className="font-mono text-right">{attempt?.transaction_reference ?? "—"}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-[#78716C]">Tiền cọc</span><strong className="text-[#8C6D37]">{fmtVND(reservation.deposit_amount)}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-[#78716C]">Trạng thái</span><strong>{paid ? "Đã thanh toán" : attempt?.status ?? "Chưa xác định"}</strong></div>
              {responseCode && <div className="flex justify-between gap-4"><span className="text-[#78716C]">Mã phản hồi VNPay</span><strong>{responseCode}</strong></div>}
              {reservation.deposit_payment?.expires_at && !paid && <div className="flex justify-between gap-4"><span className="text-[#78716C]">Giữ phòng đến</span><strong>{new Date(reservation.deposit_payment.expires_at).toLocaleString("vi-VN")}</strong></div>}
            </div>
          )}

          <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button type="button" onClick={backHome} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D8CFBF] bg-white py-3.5 text-xs font-semibold uppercase tracking-wider text-[#57534E] hover:bg-[#F5F1EA]">
              <ArrowLeft size={15} /> Trang chủ
            </button>
            {paid ? (
              <button type="button" onClick={backHome} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1C1917] py-3.5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#8C6D37]">
                <ExternalLink size={15} /> Xem đơn đặt
              </button>
            ) : (
              <button type="button" disabled={!canRetry || retrying} onClick={() => void retry()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1C1917] py-3.5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#8C6D37] disabled:cursor-not-allowed disabled:opacity-40">
                <RefreshCw size={15} className={retrying ? "animate-spin" : ""} /> {retrying ? "Đang chuyển…" : "Thanh toán lại"}
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
