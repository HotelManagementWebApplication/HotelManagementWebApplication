import React, { useState } from "react";
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
import { CustomerVoucher } from "../../shared/types/customer";
import type { CommercialSpace } from "../../shared/types/public";

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
  onIssueVoucher: (spaceId: string, visitAt: string) => Promise<CustomerVoucher | null>;
  commercialSpaces?: CommercialSpace[];
  resolveSpaceId?: (service: FnbService | null) => string | null;
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
  onIssueVoucher,
  commercialSpaces = [],
  resolveSpaceId,
  isAuthenticated = false,
  onLogin,
  loading = false,
  error = null,
  onRetry,
}) => {
  const [voucher, setVoucher] = useState<CustomerVoucher | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("18:30");
  const [partySize, setPartySize] = useState("2 khách");
  const [specialRequest, setSpecialRequest] = useState("");

  // Catalog dịch vụ là dữ liệu vận hành từ backend. Không fallback sang dữ liệu demo,
  // nếu không tải được thì phải hiển thị trạng thái rỗng để tránh đặt nhầm dịch vụ.
  const displayList = services ?? [];
  const filtered = fnbCategory === "all" ? displayList : displayList.filter((s) => s.category === fnbCategory);
  const featuredService = displayList.find(service => service.category === "fine-dining" && /brasserie|restaurant/i.test(service.title))
    ?? displayList.find(service => service.category === "fine-dining");

  const handleOpenBooking = (svc: FnbService | null) => {
    if (!isAuthenticated) {
      if (svc?.id) {
        sessionStorage.setItem("pending_booking_service_id", svc.id);
      }
      onLogin?.();
      return;
    }
    onSelectService(svc);
    setTableModal(true);
    setVoucher(null);
    setBookingSuccess(false);
  };

  const handleConfirmReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setTableModal(false);
      onLogin?.();
      return;
    }
    setVoucherLoading(true);
    try {
      const spaceFromCatalog = selectedService
        ? commercialSpaces.find(space => space.service_id === selectedService.id)
        : undefined;
      const spaceId = resolveSpaceId
        ? resolveSpaceId(selectedService)
        : spaceFromCatalog?.id ?? null;
      if (!spaceId) {
        window.alert("Dịch vụ này chưa có mặt bằng hoặc API đặt chỗ tương ứng trên backend.");
        return;
      }

     const res = await onIssueVoucher(spaceId, `${date}T${time}:00`);
      if (res) {
        setVoucher(res);
        setBookingSuccess(true);
      }
    } catch {
      setBookingSuccess(false);
    } finally {
      setVoucherLoading(false);
    }
  };

  return (
    <div className="bg-[#FAF8F5] min-h-screen text-[#1C1917] selection:bg-[#B8944A]/20">
      {/* 1. CINEMATIC HERO SECTION (Đồng bộ với LuxuryHero) */}
      <div className="relative w-full min-h-[500px] lg:min-h-[560px] flex flex-col justify-between overflow-hidden bg-[#0A0E17]">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1800&h=900&fit=crop&auto=format"
            alt="MaM Resort Gastronomy"
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
            <span>MAM RESORT · ẨM THỰC &amp; TIỆN ÍCH</span>
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
                  Đặt bàn trước
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
              <p className="text-sm text-[#78716C]">Đang tải danh mục dịch vụ &amp; trải nghiệm từ hệ thống...</p>
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
              <p className="text-sm text-[#78716C]">Chưa có dịch vụ khả dụng từ hệ thống cho danh mục này.</p>
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
                          Giá trải nghiệm
                        </span>
                        <span className="text-sm sm:text-base font-semibold text-[#1C1917]">
                          {svc.price.toLocaleString("vi-VN")} ₫
                          <span className="text-xs font-light text-[#78716C]"> / {svc.unit}</span>
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs uppercase tracking-wider font-semibold text-[#8C6D37]">
                        Bao gồm trong kỳ nghỉ
                      </span>
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
                    Đặt trước
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. LUXURY RESERVATION & VOUCHER MODAL */}
      {tableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl p-8 bg-[#FAF8F5] shadow-2xl border border-[#E2DDD4] relative max-h-[90vh] overflow-y-auto">
            {/* Close button */}
            <button
              onClick={() => setTableModal(false)}
              className="absolute top-6 right-6 w-9 h-9 rounded-full bg-[#EDE8E0] hover:bg-[#DDD6C8] flex items-center justify-center text-[#1C1917] transition cursor-pointer"
            >
              <X size={18} />
            </button>

            {bookingSuccess ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-[#8C6D37]/10 text-[#8C6D37] flex items-center justify-center mx-auto mb-4 border border-[#8C6D37]/30">
                  <CheckCircle size={32} />
                </div>
                <h3 className="font-display text-2xl text-[#1C1917] mb-2">
                  Xác Nhận Đặt Chỗ Thành Công!
                </h3>
                <p className="text-xs text-[#78716C] mb-6">
                  Chúng tôi đã tiếp nhận yêu cầu và sẽ liên hệ hỗ trợ bạn trong vòng 15 phút.
                </p>

                {voucher && (
                  <div className="rounded-2xl p-6 text-center bg-gradient-to-br from-[#141A24] to-[#0A0E17] text-white border border-[#B8944A]/50 shadow-xl mb-6">
                    <p className="text-xs tracking-[0.25em] mb-2 uppercase text-[#D4AF6E] font-semibold">
                      MÃ ƯU ĐÃI ĐẶC QUYỀN
                    </p>
                    <p className="font-mono text-2xl font-bold tracking-widest text-[#F7F5F0]">
                      {voucher.voucher_code}
                    </p>
                    <p className="text-xs mt-3 text-white/60">
                      Áp dụng tại: {voucher.zone} · Tầng {voucher.floor}
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
              <form onSubmit={handleConfirmReservation}>
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-[0.25em] font-semibold text-[#8C6D37] mb-1">
                    Đặt chỗ trải nghiệm
                  </p>
                  <h3 className="font-display text-2xl sm:text-3xl text-[#1C1917] font-light">
                    {selectedService?.title || featuredService?.title || "Dịch vụ đang được cập nhật"}
                  </h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs uppercase tracking-wider font-semibold text-[#78716C] block mb-1.5">
                      Họ và tên quý khách *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Nguyễn Văn An"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none bg-white border border-[#E2DDD4] text-[#1C1917] focus:border-[#8C6D37]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs uppercase tracking-wider font-semibold text-[#78716C] block mb-1.5">
                        Số điện thoại *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="0901 234 567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none bg-white border border-[#E2DDD4] text-[#1C1917] focus:border-[#8C6D37]"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider font-semibold text-[#78716C] block mb-1.5">
                        Email nhận xác nhận
                      </label>
                      <input
                        type="email"
                        placeholder="khach@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none bg-white border border-[#E2DDD4] text-[#1C1917] focus:border-[#8C6D37]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs uppercase tracking-wider font-semibold text-[#78716C] block mb-1.5">
                        Ngày
                      </label>
                      <input
                        type="date"
                        value={date}
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
                      <label className="text-xs uppercase tracking-wider font-semibold text-[#78716C] block mb-1.5">
                        Số khách
                      </label>
                      <select
                        value={partySize}
                        onChange={(e) => setPartySize(e.target.value)}
                        className="w-full px-3 py-3 rounded-xl text-xs sm:text-sm outline-none bg-white border border-[#E2DDD4] text-[#1C1917] cursor-pointer"
                      >
                        {["1 khách", "2 khách", "3 khách", "4 khách", "5-8 khách", "Trên 8 khách"].map(
                          (s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

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
                    disabled={voucherLoading}
                    className="w-full py-4 bg-[#1C1917] hover:bg-[#8C6D37] text-white text-xs font-semibold uppercase tracking-[0.2em] transition-all duration-300 rounded-xl shadow-md cursor-pointer mt-3 disabled:opacity-50 text-center"
                  >
                    {voucherLoading ? "Đang xử lý..." : "Xác nhận đặt chỗ & nhận ưu đãi"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LuxuryFnBView;
