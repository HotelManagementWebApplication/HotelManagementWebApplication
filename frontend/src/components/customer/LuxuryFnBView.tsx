import React, { useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  Users,
  ChevronRight,
  X,
  CheckCircle,
  ArrowUpRight,
  Star,
} from "lucide-react";
import type { CustomerReservation, HotelServiceBooking, HotelServiceBookingRequest } from "../../shared/types/customer";
import { localDateValue } from "../../shared/utils/localDate";

export interface FnbService {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  price: number;
  unit: string;
  desc: string;
  img: string;
  tag: string;
  tagColor: string;
}

export const FNB_CATEGORIES = [
  { id: "all", label: "TẤT CẢ TRẢI NGHIỆM" },
  { id: "fine-dining", label: "NHÀ HÀNG & BAR" },
  { id: "spa", label: "SPA & DƯỠNG TÂM" },
  { id: "inroom", label: "ẨM THỰC TẠI PHÒNG" },
  { id: "transport", label: "DU THUYỀN & ĐƯA ĐÓN" },
  { id: "recreation", label: "THỂ THAO & BIỂN" },
  { id: "business", label: "TIỆC CƯỚI & SỰ KIỆN" },
];

interface LuxuryFnBViewProps {
  fnbCategory: string;
  setFnbCategory: (c: string) => void;
  tableModal: boolean;
  setTableModal: (v: boolean) => void;
  services: FnbService[];
  selectedService: FnbService | null;
  onSelectService: (service: FnbService | null) => void;
  onBookService: (request: HotelServiceBookingRequest) => Promise<HotelServiceBooking | null>;
  onLoadBookings: (reservationId: number) => Promise<HotelServiceBooking[]>;
  onCancelBooking: (bookingId: number) => Promise<HotelServiceBooking>;
  reservations: CustomerReservation[];
  isAuthenticated?: boolean;
  onLogin?: () => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const LuxuryFnBView: React.FC<LuxuryFnBViewProps> = ({
  fnbCategory,
  setFnbCategory,
  tableModal,
  setTableModal,
  services,
  selectedService,
  onSelectService,
  onBookService,
  onLoadBookings,
  onCancelBooking,
  reservations,
  isAuthenticated = false,
  onLogin,
  loading = false,
  error = null,
  onRetry,
}) => {
  const [serviceBooking, setServiceBooking] = useState<HotelServiceBooking | null>(null);
  const [existingBookings, setExistingBookings] = useState<HotelServiceBooking[]>([]);
  const [bookingsError, setBookingsError] = useState("");
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [bookingLoading, setServiceBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState(0);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [mealPeriod, setMealPeriod] = useState<"LUNCH" | "DINNER">("LUNCH");
  const [date, setDate] = useState(() => localDateValue());
  const [time, setTime] = useState("18:30");
  const [specialRequest, setSpecialRequest] = useState("");
  const eligibleReservations = reservations.filter(reservation =>
    ["DEPOSIT_PAID", "CONFIRMED", "CHECKED_IN"].includes(reservation.status) && reservation.deposit_payment?.status === "PAID"
  );
  const selectedStay = eligibleReservations.find(reservation => reservation.id === selectedReservationId) ?? eligibleReservations[0];
  const selectedRoom = selectedStay?.rooms.find(room => room.room_id === selectedRoomId) ?? selectedStay?.rooms[0];

  useEffect(() => {
    const reservationId = selectedStay?.id;
    if (!reservationId) { setExistingBookings([]); return; }
    let active = true;
    onLoadBookings(reservationId)
      .then(rows => { if (active) { setExistingBookings(rows); setBookingsError(""); } })
      .catch(() => { if (active) setBookingsError("Không thể tải dịch vụ đã đặt."); });
    return () => { active = false; };
  }, [selectedStay?.id, bookingSuccess, onLoadBookings]);

  useEffect(() => {
    if (!selectedRoom) return;
    const firstDay = selectedRoom.expected_check_in.slice(0, 10);
    const lastDay = selectedRoom.expected_check_out.slice(0, 10);
    if (date < firstDay || date > lastDay) setDate(firstDay);
  }, [selectedRoom, date]);

  const cancelBooking = async (bookingId: number) => {
    setCancellingId(bookingId);
    try {
      const updated = await onCancelBooking(bookingId);
      setExistingBookings(rows => rows.map(row => row.id === bookingId ? updated : row));
      setBookingsError("");
    } catch { setBookingsError("Không thể hủy dịch vụ. Dịch vụ đã sử dụng không thể hủy."); }
    finally { setCancellingId(null); }
  };

  // Catalog dịch vụ là dữ liệu vận hành từ backend. Không fallback sang dữ liệu demo,
  // nếu không tải được thì phải hiển thị trạng thái rỗng để tránh đặt nhầm dịch vụ.
  const displayList = services ?? [];
  const filtered = fnbCategory === "all" ? displayList : displayList.filter((s) => s.category === fnbCategory);
  const featuredService = displayList.find(service => service.category === "fine-dining" && /brasserie|restaurant/i.test(service.title))
    ?? displayList.find(service => service.category === "fine-dining");

  const handleOpenBooking = (svc: FnbService | null) => {
    if (!svc) return;
    onSelectService(svc);
    setTableModal(true);
    setServiceBooking(null);
    setBookingSuccess(false);
  };

  const handleConfirmReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setTableModal(false);
      onLogin?.();
      return;
    }
    if (!selectedService || !selectedStay || !selectedRoom) return;
    setServiceBookingLoading(true);
    try {
      const res = await onBookService({ reservation_id: selectedStay.id, room_id: selectedRoom.room_id,
        service_id: selectedService.id, scheduled_at: `${date}T${time}:00`, quantity,
        ...(selectedService.id === "MAMREST" ? { meal_period: mealPeriod } : {}),
        note: specialRequest.trim() || undefined });
      if (res) {
        setServiceBooking(res);
        setBookingSuccess(true);
      }
    } catch {
      setBookingSuccess(false);
    } finally {
      setServiceBookingLoading(false);
    }
  };

  return (
    <div className="bg-[#FAF8F5] min-h-screen text-[#1C1917] selection:bg-[#B8944A]/20">
      {/* 1. CINEMATIC HERO SECTION (Đồng bộ với LuxuryHero) */}
      <div className="relative w-full min-h-[500px] lg:min-h-[560px] flex flex-col justify-between overflow-hidden bg-[#0A0E17]">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1800&h=900&fit=crop&auto=format"
            alt="MaM Hotel Gastronomy"
            className="w-full h-full object-cover scale-105 transition-transform duration-1000"
            style={{ filter: "brightness(0.75) contrast(1.05)" }}
          />
          {/* Gradient vương giả */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(13,17,23,0.45) 0%, rgba(13,17,23,0.2) 50%, rgba(13,17,23,0.75) 85%, #FAF8F5 100%)",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% 35%, rgba(184,148,74,0.12) 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="pt-16" />

        {/* Center Typography */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center my-auto py-16">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 mb-6 text-[#E6CA85] text-xs tracking-[0.3em] uppercase font-semibold">
            <span>MaM Hotel · ẨM THỰC &amp; TIỆN ÍCH</span>
          </div>

          <h1
            className="font-display font-light text-white tracking-tight leading-[1.12] mb-6"
            style={{ fontSize: "clamp(1.85rem, 3.8vw, 3.5rem)" }}
          >
            <span className="inline-block whitespace-normal md:whitespace-nowrap">
              Ẩm Thực &amp; Trải Nghiệm Nghỉ Dưỡng
            </span>
            <br />
            <span className="italic font-normal font-display text-[#E8C878] text-[0.72em] block mt-2">
              Hương vị tinh tế và tiện ích xa hoa chuẩn 5 sao
            </span>
          </h1>

          <p className="text-sm sm:text-base text-white/80 font-light max-w-2xl mx-auto leading-relaxed">
            Thưởng thức hải sản tươi ngon trong ngày, ẩm thực Á – Âu chọn lọc cùng các dịch vụ spa thư giãn
            và tiện ích cao cấp dành riêng cho kỳ nghỉ của bạn.
          </p>
        </div>

        <div className="pb-10" />
      </div>

      {/* 2. CATEGORY TABS (Thanh tab ngang gạch chân tối giản chuẩn 5 sao) */}
      <div
        id="fnb-tabs"
        className="scroll-mt-[73px] sticky top-[73px] z-30 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E7E2D6] px-6 sm:px-10 py-3"
      >
        <div
          className="max-w-7xl mx-auto flex items-center gap-6 sm:gap-8 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {FNB_CATEGORIES.map((cat) => {
            const isActive = fnbCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFnbCategory(cat.id)}
                className={`whitespace-nowrap pb-3 text-xs tracking-[0.2em] uppercase font-semibold transition-all cursor-pointer relative ${
                  isActive
                    ? "text-[#8C6D37] border-b-2 border-[#8C6D37]"
                    : "text-[#78716C] hover:text-[#1C1917]"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {isAuthenticated && eligibleReservations.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 pt-8" aria-label="Dịch vụ đã đặt">
          <div className="rounded-2xl border border-[#E7E2D6] bg-white p-5 sm:p-7 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-[11px] tracking-[0.2em] uppercase text-[#8C6D37] font-semibold">Kỳ lưu trú của bạn</p><h2 className="font-display text-2xl text-[#1C1917]">Dịch vụ đã đặt</h2></div>
              <select aria-label="Chọn booking để xem dịch vụ" value={selectedStay?.id ?? ""} onChange={event => { setSelectedReservationId(Number(event.target.value)); setSelectedRoomId(""); }} className="rounded-xl border border-[#E2DDD4] bg-[#FAF8F5] px-3 py-2 text-sm text-[#1C1917]">
                {eligibleReservations.map(stay => <option key={stay.id} value={stay.id}>Booking #{stay.id}</option>)}
              </select>
            </div>
            {bookingsError && <p role="alert" className="mt-3 text-sm text-red-700">{bookingsError}</p>}
            {existingBookings.length === 0 ? <p className="mt-4 text-sm text-[#78716C]">Chưa có dịch vụ đặt trước cho booking này.</p> : (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {existingBookings.map(booking => <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E7E2D6] bg-[#FAF8F5] p-4">
                  <div className="min-w-0"><p className="font-semibold text-sm">{services.find(service => service.id === booking.service_id)?.title ?? booking.service_id} · Phòng {booking.room_id}</p><p className="mt-1 text-xs text-[#78716C]">{booking.scheduled_at.replace("T", " ").slice(0, 16)} · {booking.quantity} suất/lần · {booking.status === "CONFIRMED" ? "Đã đặt" : booking.status === "USED" ? "Đã sử dụng" : "Đã hủy"}</p><p className="mt-1 text-xs text-[#8C6D37]">Miễn phí {booking.free_quantity}/{booking.quantity} · Phải trả {booking.amount_due.toLocaleString("vi-VN")} ₫ khi checkout nếu đã dùng</p></div>
                  {booking.status === "CONFIRMED" && <button type="button" disabled={cancellingId === booking.id} onClick={() => void cancelBooking(booking.id)} className="rounded-lg border border-[#B8944A] px-3 py-2 text-xs font-semibold text-[#8C6D37] disabled:opacity-50">{cancellingId === booking.id ? "Đang hủy…" : "Hủy dịch vụ"}</button>}
                </div>)}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3. FEATURED RESTAURANT SHOWCASE (Bố cục bất đối xứng lớn như Trang nghỉ dưỡng) */}
      {(fnbCategory === "all" || fnbCategory === "fine-dining") && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 pt-14 pb-10">
          <div className="bg-white rounded-3xl border border-[#E7E2D6] overflow-hidden shadow-lg grid grid-cols-1 lg:grid-cols-12 items-stretch">
            {/* Ảnh lớn bên trái */}
            <div className="lg:col-span-6 relative min-h-[360px] sm:min-h-[440px] lg:min-h-[500px] overflow-hidden group">
              {featuredService?.img ? (
                <img src={featuredService.img} alt={featuredService.title} className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-[#78716C]">Hình ảnh dịch vụ đang được cập nhật</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 pointer-events-none" />
              <div className="absolute bottom-6 left-6">
                <span className="text-xs uppercase tracking-[0.2em] font-semibold text-white bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20">
                  Không gian nhà hàng sang trọng
                </span>
              </div>
            </div>

            {/* Thông tin chi tiết bên phải */}
            <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] font-semibold text-[#8C6D37] mb-2">
                  SIGNATURE RESTAURANT &amp; SUNSET LOUNGE
                </p>
                <h2 className="font-display text-3xl sm:text-4xl text-[#1C1917] font-light tracking-tight mb-4">
                  {featuredService?.title || "Dịch vụ đang được cập nhật"}
                </h2>
                <p className="text-sm sm:text-base text-[#57534E] leading-relaxed font-light mb-8">
                  {featuredService?.desc || "Thông tin dịch vụ sẽ hiển thị sau khi được cập nhật trong hệ thống."}
                </p>

                {/* 4 Thẻ thông số chuẩn mực */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                  <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EBE6DC]">
                    <span className="text-[11px] uppercase tracking-wider text-[#8C827A] block mb-1">
                      Giờ mở cửa
                    </span>
                    <span className="text-sm font-semibold text-[#1C1917]">06:30 – 22:30</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EBE6DC]">
                    <span className="text-[11px] uppercase tracking-wider text-[#8C827A] block mb-1">
                      Phong cách
                    </span>
                    <span className="text-sm font-semibold text-[#1C1917]">Fine Dining &amp; Biển</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EBE6DC]">
                    <span className="text-[11px] uppercase tracking-wider text-[#8C827A] block mb-1">
                      Không gian
                    </span>
                    <span className="text-sm font-semibold text-[#1C1917]">Ban công mở hướng vịnh</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EBE6DC]">
                    <span className="text-[11px] uppercase tracking-wider text-[#8C827A] block mb-1">
                      Trang phục
                    </span>
                    <span className="text-sm font-semibold text-[#1C1917]">Lịch sự &amp; Thanh lịch</span>
                  </div>
                </div>
              </div>

              {/* 2 Nút hành động */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-[#EDE8DF]">
                <button
                  type="button"
                  onClick={() => handleOpenBooking(featuredService ?? null)}
                  className="w-full py-3.5 px-6 bg-[#1C1917] hover:bg-[#8C6D37] text-white text-xs font-semibold uppercase tracking-[0.2em] transition-all rounded-none cursor-pointer shadow-md text-center"
                >
                  Xem &amp; đặt bàn
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenBooking(featuredService ?? null)}
                  className="w-full py-3.5 px-6 border border-[#1C1917] text-[#1C1917] hover:bg-[#1C1917] hover:text-white text-xs font-semibold uppercase tracking-[0.2em] transition-all rounded-none cursor-pointer text-center"
                >
                  Xem thực đơn mẫu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. CURATED EXPERIENCES GRID (Lưới dịch vụ tinh hoa) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] font-semibold text-[#8C6D37] mb-2">
              Bộ sưu tập dịch vụ &amp; trải nghiệm
            </p>
            <h3 className="font-display text-3xl sm:text-4xl font-light text-[#1F2421] tracking-tight">
              Curated Experiences ({filtered.length})
            </h3>
          </div>
          <span className="text-xs text-[#78716C] uppercase tracking-wider">
            Dịch vụ chuẩn mực 5 sao
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading && (
            <div className="md:col-span-2 lg:col-span-3 py-16 text-center bg-white rounded-2xl border border-[#E2DDD4]">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#8C6D37] border-t-transparent mb-3" />
              <p className="text-sm text-[#78716C]">Đang tải danh sách dịch vụ &amp; trải nghiệm...</p>
            </div>
          )}

          {error && !loading && (
            <div className="md:col-span-2 lg:col-span-3 py-16 text-center bg-white rounded-2xl border border-red-200">
              <p className="text-sm text-red-600 mb-4">{error}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-6 py-2.5 bg-[#8C6D37] hover:bg-[#785c2c] text-white text-xs font-semibold uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                >
                  Thử lại kết nối
                </button>
              )}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="md:col-span-2 lg:col-span-3 py-16 text-center bg-white rounded-2xl border border-[#E2DDD4]">
              <p className="text-sm text-[#78716C]">Chưa có dịch vụ khả dụng trong nhóm này.</p>
            </div>
          )}
          {filtered.map((svc) => (
            <div
              key={svc.id}
              id={svc.id}
              onClick={() => handleOpenBooking(svc)}
              className="scroll-mt-[140px] group bg-white rounded-2xl border border-[#E7E2D6] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer"
            >
              {/* Image Container */}
              <div className="relative h-[250px] overflow-hidden bg-[#EAE6DF]">
                <img
                  src={svc.img}
                  alt={svc.title}
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-60" />
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 text-[11px] uppercase tracking-wider font-semibold rounded-full bg-black/50 text-[#E6CA85] backdrop-blur-md border border-white/20">
                    {svc.tag}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 flex flex-col flex-1 justify-between bg-white">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#8C6D37] mb-1.5">
                    {svc.subtitle}
                  </p>
                  <h4 className="font-display text-2xl text-[#1C1917] font-normal tracking-wide mb-3 group-hover:text-[#8C6D37] transition-colors">
                    {svc.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-[#57534E] font-light leading-relaxed mb-6 line-clamp-3">
                    {svc.desc}
                  </p>
                </div>

                {/* Price & Action */}
                <div className="pt-4 border-t border-[#F0EBE1] flex items-center justify-between">
                  <div>
                    {svc.price > 0 ? (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-[#8C827A] block">
                          Giá niêm yết · phần vượt hạn mức
                        </span>
                        <span className="text-sm sm:text-base font-semibold text-[#1C1917]">
                          {svc.price.toLocaleString("vi-VN")} ₫
                          <span className="text-xs font-light text-[#78716C]"> / {svc.unit}</span>
                        </span>
                        {["POOL", "LNDRYSTD", "BREAKFAST", "MAMREST"].includes(svc.id) && <span className="text-[11px] text-emerald-700 block mt-1">Miễn phí trong hạn mức cho khách lưu trú theo đêm</span>}
                      </div>
                    ) : (
                      <span className="text-xs uppercase tracking-wider font-semibold text-[#8C6D37]">Chưa niêm yết giá</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenBooking(svc);
                    }}
                    className="py-2.5 px-5 bg-[#1C1917] hover:bg-[#8C6D37] text-white text-xs font-semibold uppercase tracking-[0.18em] transition-all rounded-none cursor-pointer"
                  >
                    {svc.id === "POOL" ? "Xem thông tin" : svc.price <= 0 ? "Xem thông tin" : "Xem dịch vụ"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Đặt dịch vụ khách sạn */}
      {tableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-3xl bg-[#FAF8F5] shadow-2xl border border-[#E2DDD4] relative max-h-[92vh] overflow-y-auto overflow-x-hidden">
            {/* Close button */}
            <button
              onClick={() => setTableModal(false)}
              className="absolute top-6 right-6 w-9 h-9 rounded-full bg-[#EDE8E0] hover:bg-[#DDD6C8] flex items-center justify-center text-[#1C1917] transition cursor-pointer"
            >
              <X size={18} />
            </button>

            {bookingSuccess ? (
              <div className="mx-auto max-w-lg text-center px-8 py-12">
                <div className="w-16 h-16 rounded-full bg-[#8C6D37]/10 text-[#8C6D37] flex items-center justify-center mx-auto mb-4 border border-[#8C6D37]/30">
                  <CheckCircle size={32} />
                </div>
                <h3 className="font-display text-2xl text-[#1C1917] mb-2">
                  Đã xác nhận đặt dịch vụ
                </h3>
                <p className="text-xs text-[#78716C] mb-6">
                  Dịch vụ sẽ được phục vụ trong kỳ lưu trú sau khi quý khách nhận phòng.
                </p>

                {serviceBooking && (
                  <div className="rounded-2xl p-6 text-center bg-gradient-to-br from-[#141A24] to-[#0A0E17] text-white border border-[#B8944A]/50 shadow-xl mb-6">
                    <p className="text-xs tracking-[0.25em] mb-2 uppercase text-[#D4AF6E] font-semibold">
                      MÃ ĐẶT DỊCH VỤ
                    </p>
                    <p className="font-mono text-2xl font-bold tracking-widest text-[#F7F5F0]">
                      #{serviceBooking.id}
                    </p>
                    <p className="text-xs mt-3 text-white/60">
                      Miễn phí {serviceBooking.free_quantity}/{serviceBooking.quantity} · Dự kiến cộng hóa đơn {serviceBooking.amount_due.toLocaleString("vi-VN")} ₫
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setTableModal(false)}
                  className="w-full py-3.5 bg-[#1C1917] hover:bg-[#8C6D37] text-white text-xs font-semibold uppercase tracking-[0.2em] transition rounded-xl cursor-pointer"
                >
                  Hoàn tất
                </button>
              </div>
            ) : (
              <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
                <aside className="relative min-h-[360px] overflow-hidden bg-[#151A20] text-white lg:min-h-[680px]">
                  {selectedService?.img && (
                    <img src={selectedService.img} alt={selectedService.title} className="absolute inset-0 h-full w-full object-cover opacity-55" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
                  <div className="relative flex h-full flex-col justify-end p-7 sm:p-9">
                    <span className="mb-3 w-fit rounded-full border border-white/25 bg-black/35 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E8C878] backdrop-blur-sm">
                      {selectedService?.tag || "Dịch vụ MaM Hotel"}
                    </span>
                    <p className="text-xs uppercase tracking-[0.24em] text-white/65">Thông tin dịch vụ</p>
                    <h3 className="mt-2 font-display text-3xl font-light sm:text-4xl">{selectedService?.title}</h3>
                    <p className="mt-4 text-sm font-light leading-7 text-white/80">{selectedService?.desc}</p>
                    <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/20 pt-5 text-sm">
                      <div><span className="block text-[10px] uppercase tracking-wider text-white/50">Giá niêm yết</span><strong>{selectedService ? `${selectedService.price.toLocaleString("vi-VN")} ₫` : "—"}</strong></div>
                      <div><span className="block text-[10px] uppercase tracking-wider text-white/50">Đơn vị</span><strong>{selectedService?.unit || "lần"}</strong></div>
                    </div>
                    {selectedService && ["POOL", "LNDRYSTD", "BREAKFAST", "MAMREST"].includes(selectedService.id) && (
                      <div className="mt-5 rounded-xl border border-emerald-300/30 bg-emerald-950/45 p-3 text-xs leading-5 text-emerald-100 backdrop-blur-sm">
                        Khách thuê theo đêm được áp dụng hạn mức miễn phí. Khách thuê theo giờ trả toàn bộ theo giá niêm yết.
                      </div>
                    )}
                  </div>
                </aside>

              <form onSubmit={handleConfirmReservation} className="p-7 sm:p-9">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-[0.25em] font-semibold text-[#8C6D37] mb-1">
                    Đặt chỗ trải nghiệm
                  </p>
                  <h3 className="font-display text-2xl sm:text-3xl text-[#1C1917] font-light">
                    {selectedService?.title || featuredService?.title || "Dịch vụ đang được cập nhật"}
                  </h3>
                </div>

                  {!isAuthenticated && (
                    <div className="mb-5 rounded-xl border border-[#D9C79E] bg-[#FAF5EB] p-4 text-sm text-[#6F552B]">
                      <p className="font-semibold">Bạn có thể xem đầy đủ thông tin dịch vụ.</p>
                      <p className="mt-1 text-xs leading-5">Đăng nhập bằng tài khoản khách hàng và có booking đã thanh toán cọc để đặt trước.</p>
                      <button type="button" onClick={onLogin} className="mt-3 rounded-lg bg-[#1C1917] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white">Đăng nhập để đặt</button>
                    </div>
                  )}

                  {selectedService?.id === "POOL" && (
                    <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      <p className="font-semibold">Hồ bơi không cần đặt trước trên website.</p>
                      <p className="mt-1 text-xs leading-5">Khách theo đêm sử dụng miễn phí không giới hạn trong kỳ lưu trú theo số khách đăng ký. Khách theo giờ trả theo giá niêm yết.</p>
                    </div>
                  )}

                  <div className="space-y-4">
                  <div>
                    <label htmlFor="service-stay" className="text-xs uppercase tracking-wider font-semibold text-[#78716C] block mb-1.5">Booking đã xác nhận cọc</label>
                    <select id="service-stay" required value={selectedStay?.id ?? ""} onChange={event => { setSelectedReservationId(Number(event.target.value)); setSelectedRoomId(""); }}
                      className="w-full px-4 py-3 rounded-xl text-sm bg-white border border-[#E2DDD4] text-[#1C1917]">
                      {eligibleReservations.map(stay => <option key={stay.id} value={stay.id}>Booking #{stay.id} · {stay.rental_type === "PACKAGE" ? "Theo đêm" : "Theo giờ"}</option>)}
                    </select>
                    {eligibleReservations.length === 0 && <p className="text-sm text-amber-700 mt-2">Cần có booking đã thanh toán cọc để đặt dịch vụ.</p>}
                  </div>
                  {selectedStay && <div>
                    <label htmlFor="service-room" className="text-xs uppercase tracking-wider font-semibold text-[#78716C] block mb-1.5">Phòng sử dụng dịch vụ</label>
                    <select id="service-room" value={selectedRoom?.room_id ?? ""} onChange={event => setSelectedRoomId(event.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm bg-white border border-[#E2DDD4] text-[#1C1917]">
                      {selectedStay.rooms.map(room => <option key={room.room_id} value={room.room_id}>Phòng {room.room_id} · {room.guest_count} khách</option>)}
                    </select>
                  </div>}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs uppercase tracking-wider font-semibold text-[#78716C] block mb-1.5">
                        Ngày
                      </label>
                      <input
                        type="date"
                        value={date}
                        min={selectedRoom?.expected_check_in.slice(0, 10)}
                        max={selectedRoom?.expected_check_out.slice(0, 10)}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-3 rounded-xl text-xs sm:text-sm outline-none bg-white border border-[#E2DDD4] text-[#1C1917] cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider font-semibold text-[#78716C] block mb-1.5">
                        Giờ
                      </label>
                      <select
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full px-3 py-3 rounded-xl text-xs sm:text-sm outline-none bg-white border border-[#E2DDD4] text-[#1C1917] cursor-pointer"
                      >
                        {["07:00", "08:30", "11:30", "12:30", "17:30", "18:30", "19:30", "20:30"].map(
                          (t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="service-quantity" className="text-xs uppercase tracking-wider font-semibold text-[#78716C] block mb-1.5">Số suất/lần</label>
                      <input id="service-quantity" type="number" min={1} max={20} value={quantity}
                        onChange={event => setQuantity(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
                        className="w-full px-3 py-3 rounded-xl text-xs sm:text-sm bg-white border border-[#E2DDD4] text-[#1C1917]" />
                    </div>
                  </div>

                  {selectedService?.id === "MAMREST" && <div>
                    <label htmlFor="service-meal" className="text-xs uppercase tracking-wider font-semibold text-[#78716C] block mb-1.5">Bữa ăn</label>
                    <select id="service-meal" value={mealPeriod} onChange={event => { const period=event.target.value as "LUNCH" | "DINNER"; setMealPeriod(period); setTime(period === "LUNCH" ? "12:30" : "18:30"); }}
                      className="w-full px-4 py-3 rounded-xl text-sm bg-white border border-[#E2DDD4] text-[#1C1917]">
                      <option value="LUNCH">Bữa trưa</option><option value="DINNER">Bữa tối</option>
                    </select>
                    <p className="text-xs text-[#78716C] mt-2">Khách thuê theo đêm: mỗi khách được miễn một bữa trưa và một bữa tối mỗi ngày. Phần vượt tính {selectedService.price.toLocaleString("vi-VN")} ₫/suất.</p>
                  </div>}

                  <p className="text-xs text-[#78716C]">Giá niêm yết: {selectedService?.price.toLocaleString("vi-VN") ?? "—"} ₫/{selectedService?.unit || "lần"}. Hệ thống áp dụng hạn mức miễn phí theo booking; phần phải trả được ghi khi dịch vụ đã sử dụng và quyết toán lúc trả phòng.</p>

                  {selectedStay?.rental_type === "HOURLY" && (
                    <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium leading-5 text-amber-800">
                      Booking theo giờ không có dịch vụ miễn phí. Toàn bộ số lượng đã sử dụng sẽ được cộng vào hóa đơn phòng.
                    </p>
                  )}

                  <div>
                    <label className="text-xs uppercase tracking-wider font-semibold text-[#78716C] block mb-1.5">
                      Ghi chú / Yêu cầu đặc biệt
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Bàn view biển ngắm hoàng hôn, tiệc sinh nhật, dị ứng thức ăn..."
                      value={specialRequest}
                      onChange={(e) => setSpecialRequest(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm outline-none bg-white border border-[#E2DDD4] text-[#1C1917] focus:border-[#8C6D37] resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={bookingLoading || !isAuthenticated || !selectedStay || !selectedRoom || !selectedService || selectedService.id === "POOL" || selectedService.price <= 0}
                    className="w-full py-4 bg-[#1C1917] hover:bg-[#8C6D37] text-white text-xs font-semibold uppercase tracking-[0.2em] transition-all duration-300 rounded-xl shadow-md cursor-pointer mt-3 disabled:opacity-50 text-center"
                  >
                    {bookingLoading ? "Đang xử lý..." : selectedService?.id === "POOL" ? "Không cần đặt trước" : "Xác nhận đặt dịch vụ"}
                  </button>
                </div>
              </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LuxuryFnBView;
