import React, { useEffect, useMemo, useState } from "react";
import { Room } from "../../types";
import { X, Calendar, Clock, Users, ShieldCheck, CreditCard, Wallet, Banknote } from "lucide-react";

interface LuxuryBookingModalProps {
  room: Room;
  isOpen: boolean;
  onClose: () => void;
  checkIn: string;
  checkOut: string;
  guests: number;
  onConfirm: (bookingData: {
    room: Room;
    mode: "night" | "hour";
    checkIn: string;
    checkOut: string;
    hourlyCheckIn?: string;
    hourlyCheckOut?: string;
    guests: number;
    guestName: string;
    guestId: string;
    phone: string;
    email: string;
    paymentMethod: "cash" | "card" | "transfer";
  }) => Promise<void>;
  loading?: boolean;
  isAuthenticated?: boolean;
  onLogin?: () => void;
}

const fmtVND = (n: number) => n.toLocaleString("vi-VN") + " ₫";

/** Giữ nguyên giờ địa phương của ô datetime-local; không chuyển sang UTC rồi cắt chuỗi. */
const localDateTime = (value: Date) => {
  const two = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${two(value.getMonth() + 1)}-${two(value.getDate())}T${two(value.getHours())}:${two(value.getMinutes())}`;
};

const addLocalHours = (value: string, hours: number) => {
  const at = new Date(value);
  at.setHours(at.getHours() + hours);
  return localDateTime(at);
};

const nextNightCheckoutDate = (checkIn: string) => {
  const at = new Date(`${checkIn}T12:00:00`);
  at.setDate(at.getDate() + 1);
  return localDateTime(at).slice(0, 10);
};

export const LuxuryBookingModal: React.FC<LuxuryBookingModalProps> = ({
  room,
  isOpen,
  onClose,
  checkIn: initialCheckIn,
  checkOut: initialCheckOut,
  guests: initialGuests,
  onConfirm,
  loading = false,
  isAuthenticated,
  onLogin,
}) => {
  const [bookMode, setBookMode] = useState<"night" | "hour">("night");
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guests, setGuests] = useState(initialGuests);

  // Hourly state
  const [hourlyCheckIn, setHourlyCheckIn] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(14, 0, 0, 0);
    return localDateTime(d);
  });
  const [hourlyDuration, setHourlyDuration] = useState(3);

  // Guest details form
  const [guestName, setGuestName] = useState("");
  const [guestId, setGuestId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "transfer">("transfer");
  const [formError, setFormError] = useState("");

  const earliestNightDate = useMemo(() => {
    const now = new Date();
    if (now.getHours() >= 14) now.setDate(now.getDate() + 1);
    return localDateTime(now).slice(0, 10);
  }, [isOpen]);
  const earliestHourlyDateTime = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5, 0, 0);
    return localDateTime(now);
  }, [isOpen]);

  useEffect(() => {
    if (checkIn < earliestNightDate) setCheckIn(earliestNightDate);
    const minimumCheckOutDate = nextNightCheckoutDate(checkIn);
    if (checkOut < minimumCheckOutDate) setCheckOut(minimumCheckOutDate);
  }, [checkIn, checkOut, earliestNightDate]);

  if (!isOpen) return null;

  // Nights calculation
  const nights = Math.max(
    1,
    Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
  );

  // Price calculation
  const totalAmount =
    bookMode === "night"
      ? room.pricePerNight * nights
      : room.pricePerHour * Math.max(3, hourlyDuration);
  // Backend yêu cầu tiền cọc bằng 50% giá trị dự kiến của booking.
  const depositAmount = totalAmount * 0.5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticated === false && onLogin) {
      onClose();
      onLogin();
      return;
    }
    if (!guestName.trim()) {
      setFormError("Vui lòng nhập Họ và tên.");
      return;
    }
    if (!phone.trim()) {
      setFormError("Vui lòng nhập Số điện thoại liên hệ.");
      return;
    }
    const start = bookMode === "hour" ? new Date(hourlyCheckIn) : new Date(`${checkIn}T14:00:00`);
    const end = bookMode === "hour"
      ? new Date(addLocalHours(hourlyCheckIn, hourlyDuration))
      : new Date(`${checkOut}T12:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start <= new Date() || end <= start) {
      setFormError("Vui lòng chọn thời gian lưu trú hợp lệ trong tương lai.");
      return;
    }
    setFormError("");

    await onConfirm({
      room,
      mode: bookMode,
      checkIn,
      checkOut,
      hourlyCheckIn: bookMode === "hour" ? hourlyCheckIn : undefined,
      hourlyCheckOut:
        bookMode === "hour"
          ? addLocalHours(hourlyCheckIn, hourlyDuration)
          : undefined,
      guests,
      guestName,
      guestId,
      phone,
      email,
      paymentMethod,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#E2DDD4] max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[#EAE6DD] flex items-center justify-between bg-[#FAF8F5]">
          <div>
            <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#8C6D37]">
              Phiếu Đặt phòng Nghỉ dưỡng
            </span>
            <h3 className="font-display text-2xl text-[#1C1917] font-normal">
              {room.type} – Phòng {room.number}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-[#EFECE6] border border-[#E2DDD4] flex items-center justify-center text-[#57534E] transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {formError && (
            <div className="p-3.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
              {formError}
            </div>
          )}

          {/* Rental Mode Tabs */}
          <div className="flex p-1 bg-[#F5F2EB] rounded-2xl border border-[#E7E0D3]">
            <button
              type="button"
              onClick={() => setBookMode("night")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                bookMode === "night"
                  ? "bg-white text-[#1C1917] shadow-sm"
                  : "text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              Lưu trú qua đêm (Theo đêm)
            </button>
            <button
              type="button"
              onClick={() => setBookMode("hour")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                bookMode === "hour"
                  ? "bg-white text-[#1C1917] shadow-sm"
                  : "text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              Nghỉ dưỡng trong ngày (Theo giờ)
            </button>
          </div>

          {/* Dates & Times */}
          {bookMode === "night" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#E7E0D3]">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C] flex items-center gap-1 mb-1">
                  <Calendar size={13} /> Nhận phòng
                </label>
                <input
                  type="date"
                  value={checkIn}
                  min={earliestNightDate}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-[#1C1917] outline-none cursor-pointer"
                />
              </div>

              <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#E7E0D3]">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C] flex items-center gap-1 mb-1">
                  <Calendar size={13} /> Trả phòng ({nights} đêm)
                </label>
                <input
                  type="date"
                  value={checkOut}
                  min={nextNightCheckoutDate(checkIn)}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-[#1C1917] outline-none cursor-pointer"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#E7E0D3]">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C] flex items-center gap-1 mb-1">
                  <Clock size={13} /> Giờ nhận phòng
                </label>
                <input
                  type="datetime-local"
                  value={hourlyCheckIn}
                  min={earliestHourlyDateTime}
                  onChange={(e) => setHourlyCheckIn(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-[#1C1917] outline-none cursor-pointer"
                />
              </div>

              <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#E7E0D3]">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C] mb-1 block">
                  Thời lượng lưu trú
                </label>
                <select
                  value={hourlyDuration}
                  onChange={(e) => setHourlyDuration(Number(e.target.value))}
                  className="w-full bg-transparent text-sm font-semibold text-[#1C1917] outline-none cursor-pointer"
                >
                  {[3, 4, 5, 6, 8, 10, 12].map((h) => (
                    <option key={h} value={h}>
                      {h} tiếng (từ {fmtVND(room.pricePerHour * h)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Number of Guests */}
          <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#E7E0D3]">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C] flex items-center justify-between mb-1">
              <span className="flex items-center gap-1"><Users size={13} /> Số lượng khách</span>
              <span>Tối đa {room.maxOccupancy ?? 2} khách</span>
            </label>
            <select
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className="w-full bg-transparent text-sm font-semibold text-[#1C1917] outline-none cursor-pointer"
            >
              {Array.from({ length: room.maxOccupancy ?? 2 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} khách người lớn
                </option>
              ))}
            </select>
          </div>

          {/* Guest Information Inputs */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-[#1C1917] mb-3">
              Thông tin Người đại diện Đặt phòng
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-xs text-[#78716C] mb-1 block">Họ và tên *</label>
                <input
                  type="text"
                  required
                  placeholder="Nguyễn Văn A"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E2DDD4] rounded-xl text-sm text-[#1C1917] outline-none focus:border-[#8C6D37]"
                />
              </div>

              <div>
                <label className="text-xs text-[#78716C] mb-1 block">Số điện thoại *</label>
                <input
                  type="tel"
                  required
                  placeholder="0901 234 567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E2DDD4] rounded-xl text-sm text-[#1C1917] outline-none focus:border-[#8C6D37]"
                />
              </div>

              <div>
                <label className="text-xs text-[#78716C] mb-1 block">Số CCCD / Hộ chiếu</label>
                <input
                  type="text"
                  placeholder="012345678901"
                  value={guestId}
                  onChange={(e) => setGuestId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E2DDD4] rounded-xl text-sm text-[#1C1917] outline-none focus:border-[#8C6D37]"
                />
              </div>

              <div>
                <label className="text-xs text-[#78716C] mb-1 block">Email nhận xác nhận</label>
                <input
                  type="email"
                  placeholder="khachhang@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E2DDD4] rounded-xl text-sm text-[#1C1917] outline-none focus:border-[#8C6D37]"
                />
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-xs text-[#78716C] mb-2 block font-medium">
              Phương thức thanh toán bảo đảm
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "transfer", label: "Chuyển khoản QR", icon: Wallet },
                { id: "card", label: "Thẻ Quốc tế", icon: CreditCard },
                { id: "cash", label: "Tại khách sạn", icon: Banknote },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-3 px-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1.5 transition cursor-pointer border ${
                      isSelected
                        ? "bg-[#1C1917] text-white border-[#1C1917]"
                        : "bg-[#FAF8F5] text-[#57534E] border-[#E2DDD4] hover:bg-[#F0ECE4]"
                    }`}
                  >
                    <Icon size={16} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price Breakdown Box */}
          <div className="p-4 bg-[#FAF6EE] rounded-2xl border border-[#E7DECD] space-y-2">
            <div className="flex justify-between text-xs text-[#78716C]">
              <span>
                {bookMode === "night"
                  ? `${fmtVND(room.pricePerNight)} × ${nights} đêm`
                  : `${fmtVND(room.pricePerHour)} × ${hourlyDuration} giờ`}
              </span>
              <span className="font-semibold text-[#1C1917]">{fmtVND(totalAmount)}</span>
            </div>

            <div className="flex justify-between text-xs text-[#78716C]">
              <span>Tiền đặt cọc giữ chỗ (50%)</span>
              <span className="font-semibold text-[#8C6D37]">{fmtVND(depositAmount)}</span>
            </div>

            <div className="h-px bg-[#E2DDD4] my-1" />

            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold text-[#1C1917]">Tổng chi phí dự tính:</span>
              <span className="text-2xl font-display font-bold text-[#8C6D37]">
                {fmtVND(totalAmount)}
              </span>
            </div>
          </div>

          {/* Action Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#1C1917] hover:bg-[#8C6D37] text-white text-xs uppercase tracking-[0.2em] font-semibold transition-all duration-300 rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ShieldCheck size={16} />
            <span>
              {loading
                ? "Đang xử lý đặt chỗ..."
                : isAuthenticated === false
                ? "Đăng nhập để đặt phòng"
                : "Xác nhận & Hoàn tất Đặt phòng"}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
export default LuxuryBookingModal;
