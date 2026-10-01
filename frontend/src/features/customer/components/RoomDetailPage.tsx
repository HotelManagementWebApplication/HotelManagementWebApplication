import React, { useEffect, useState } from "react";
import { Room } from "../../../shared/types/domain";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Users,
  Eye,
  BedDouble,
  Building,
  Check,
  ShieldCheck,
  Calendar,
  Clock,
} from "lucide-react";
import { getRoomFullName, getRoomDescription } from "../roomProfiles";

interface RoomDetailPageProps {
  room: Room;
  onBack: () => void;
  onBook: (room: Room) => void;
}

const fmtVND = (n: number) => n.toLocaleString("vi-VN") + " ₫";

export const RoomDetailPage: React.FC<RoomDetailPageProps> = ({ room, onBack, onBook }) => {
  const images = Array.from(new Set([...(room.imageUrls ?? []), room.image].filter(Boolean))).slice(0, 4);
  const [activePhoto, setActivePhoto] = useState(0);
  const [galleryDirection, setGalleryDirection] = useState<"prev" | "next">("next");

  useEffect(() => {
    setActivePhoto(0);
    setGalleryDirection("next");
  }, [room.id]);

  const moveToPhoto = (nextIndex: number, direction: "prev" | "next") => {
    setGalleryDirection(direction);
    setActivePhoto(nextIndex);
  };

  const photoAt = (offset: number) => {
    if (images.length === 0) return undefined;
    return images[(activePhoto + offset + images.length) % images.length];
  };

  const handlePrev = () => {
    moveToPhoto(activePhoto === 0 ? images.length - 1 : activePhoto - 1, "prev");
  };

  const handleNext = () => {
    moveToPhoto(activePhoto === images.length - 1 ? 0 : activePhoto + 1, "next");
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C1917] pb-24">
      {/* Breadcrumbs Bar (Matches Figure 5) */}
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EDE8DF]">
        <div className="flex items-center gap-2 text-xs text-[#78716C] tracking-wide font-light flex-wrap">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[#1C1917] font-medium hover:text-[#8C6D37] transition cursor-pointer mr-2"
          >
            <ArrowLeft size={14} />
            <span>Quay lại</span>
          </button>
          <span>/</span>
          <span>MaM Hotel</span>
          <span>/</span>
          <span>Hội An</span>
          <span>/</span>
          <span>Phòng nghỉ &amp; Biệt thự</span>
          <span>/</span>
          <span className="text-[#1C1917] font-semibold">{getRoomFullName(room)}</span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="text-emerald-600 font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Phòng sẵn sàng đón tiếp
          </span>
        </div>
      </div>

      {/* Panorama Triple-Photo Showcase (Matches Figure 5) */}
      <div className="relative w-full overflow-hidden bg-[#EDE8E0] py-4">
        <div className="max-w-[1600px] mx-auto px-2 sm:px-4">
          <div
            key={`${room.id}-${activePhoto}`}
            className={`grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-center room-gallery-shift room-gallery-shift-${galleryDirection}`}
          >
            {/* Left Photo */}
            <div className="hidden md:block md:col-span-3 h-[380px] lg:h-[460px] rounded-xl overflow-hidden shadow-sm">
              {photoAt(-1) ? (
                <img src={photoAt(-1)} alt="Không gian phòng · ảnh trước" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-[#78716C]">Hình ảnh đang được cập nhật</div>
              )}
            </div>

            {/* Center Main Photo */}
            <div className="col-span-1 md:col-span-6 relative h-[380px] sm:h-[480px] lg:h-[560px] rounded-2xl overflow-hidden shadow-xl border border-white/40 group">
              {photoAt(0) ? (
                <img src={photoAt(0)} alt={room.number} className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-[#78716C]">Hình ảnh phòng chưa được cập nhật</div>
              )}

              <button
                type="button"
                onClick={handlePrev}
                aria-label="Ảnh trước"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#1A1A1A] flex items-center justify-center backdrop-blur-sm transition cursor-pointer shadow-md"
                disabled={images.length < 2}
              >
                <ChevronLeft size={18} />
              </button>

              <button
                type="button"
                onClick={handleNext}
                aria-label="Ảnh kế tiếp"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#1A1A1A] flex items-center justify-center backdrop-blur-sm transition cursor-pointer shadow-md"
                disabled={images.length < 2}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Right Photo */}
            <div className="hidden md:block md:col-span-3 h-[380px] lg:h-[460px] rounded-xl overflow-hidden shadow-sm">
              {photoAt(1) ? (
                <img src={photoAt(1)} alt="Không gian phòng · ảnh kế tiếp" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-[#78716C]">Hình ảnh đang được cập nhật</div>
              )}
            </div>
          </div>

          {images.length > 1 && (
            <div className="flex items-center justify-center gap-2 pt-3" aria-label="Chọn ảnh phòng">
              {images.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => moveToPhoto(index, index >= activePhoto ? "next" : "prev")}
                  aria-label={`Xem ảnh ${index + 1}`}
                  aria-current={activePhoto === index}
                  className={`h-12 w-16 overflow-hidden rounded-lg border-2 transition-all cursor-pointer ${
                    activePhoto === index
                      ? "border-[#B8944A] opacity-100 shadow-md"
                      : "border-white/70 opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={image} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
              <span className="ml-2 text-[11px] uppercase tracking-[0.18em] text-[#78716C]">
                {activePhoto + 1} / {images.length} ảnh
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Narrative & Room Info (Matches Figure 5 layout) */}
      <div className="max-w-4xl mx-auto px-6 pt-12 text-center">
        <p className="text-xs uppercase tracking-[0.3em] font-semibold text-[#8C6D37] mb-2">
          Sanctuary Living · Phòng {room.number}
        </p>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-normal text-[#171717] tracking-tight mb-6">
          {getRoomFullName(room)}
        </h1>

        <div className="w-12 h-px bg-[#B8944A] mx-auto mb-6" />

        <p className="text-[#57534E] text-base sm:text-lg leading-relaxed font-light max-w-3xl mx-auto mb-12">
          {room.description || getRoomDescription(room)}
        </p>

        {/* Specs Icon Grid (Matches Figure 5 icons row) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 py-8 border-y border-[#E7E2D6] mb-14">
          <div className="flex flex-col items-center justify-center p-3">
            <BedDouble size={24} className="text-[#8C6D37] mb-2" />
            <span className="text-[11px] uppercase tracking-wider text-[#78716C]">Giường ngủ</span>
            <span className="text-xs font-semibold text-[#1C1917] mt-1">{room.beds || "—"}</span>
          </div>

          <div className="flex flex-col items-center justify-center p-3">
            <Maximize2 size={24} className="text-[#8C6D37] mb-2" />
            <span className="text-[11px] uppercase tracking-wider text-[#78716C]">Diện tích</span>
            <span className="text-xs font-semibold text-[#1C1917] mt-1">{room.area ? `${room.area} m²` : "—"}</span>
          </div>

          <div className="flex flex-col items-center justify-center p-3">
            <Eye size={24} className="text-[#8C6D37] mb-2" />
            <span className="text-[11px] uppercase tracking-wider text-[#78716C]">Tầm nhìn</span>
            <span className="text-xs font-semibold text-[#1C1917] mt-1">{room.view || "—"}</span>
          </div>

          <div className="flex flex-col items-center justify-center p-3">
            <Building size={24} className="text-[#8C6D37] mb-2" />
            <span className="text-[11px] uppercase tracking-wider text-[#78716C]">Vị trí</span>
            <span className="text-xs font-semibold text-[#1C1917] mt-1">Tầng {room.floor}</span>
          </div>

          <div className="flex flex-col items-center justify-center p-3 col-span-2 sm:col-span-1">
            <Users size={24} className="text-[#8C6D37] mb-2" />
            <span className="text-[11px] uppercase tracking-wider text-[#78716C]">Sức chứa</span>
            <span className="text-xs font-semibold text-[#1C1917] mt-1">{room.maxOccupancy ? `${room.maxOccupancy} Khách` : "—"}</span>
          </div>
        </div>
      </div>

      {/* Detailed Amenities & Included Privileges */}
      <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
        {/* Amenities Details (2 Cols) */}
        <div className="lg:col-span-2 space-y-8">
          <div>
            <h3 className="font-display text-2xl text-[#1C1917] mb-4 font-normal">
              Đặc quyền &amp; Tiện nghi Thượng hạng
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {room.amenities && room.amenities.length > 0 ? (
                room.amenities.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm text-[#44403C]">
                    <Check size={16} className="text-[#8C6D37] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#78716C] col-span-2 italic">Tiện nghi chi tiết đang được cập nhật từ hệ thống.</p>
              )}
            </div>
          </div>

          <div className="p-6 bg-[#FAF6EE] rounded-2xl border border-[#E7DECD]">
            <div className="flex items-center text-xs font-semibold uppercase tracking-wider text-[#8C6D37] mb-2">
              <span>Chính sách kỳ nghỉ chánh niệm</span>
            </div>
            <p className="text-xs text-[#57534E] leading-relaxed">
              Nhận phòng từ 14:00 · Trả phòng trước 12:00. Miễn phí hủy phòng trước 48 giờ.
              Đã bao gồm bữa sáng dinh dưỡng tự chọn tại nhà hàng ven biển và gói trị liệu Nam Y hàng ngày.
            </p>
          </div>
        </div>

        {/* Sticky Booking Action Card */}
        <div className="lg:col-span-1 bg-white p-7 rounded-2xl border border-[#DDD6C8] shadow-lg sticky top-24">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-[#8C6D37] mb-2">
            ĐẶT PHÒNG TRỰC TIẾP
          </p>

          <div className="mb-6 pb-4 border-b border-[#EDE8DF]">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-display text-[#1C1917]">
                {fmtVND(room.pricePerNight)}
              </span>
              <span className="text-xs text-[#78716C]">/ đêm</span>
            </div>
            <p className="text-xs text-[#8C6D37] mt-1">
              Hoặc {fmtVND(room.pricePerHour)} / giờ (từ 3 giờ)
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between text-xs text-[#57534E]">
              <span className="flex items-center gap-1.5"><Calendar size={13} /> Nhận / Trả</span>
              <span className="font-semibold text-[#1C1917]">14:00 – 12:00</span>
            </div>
            <div className="flex items-center justify-between text-xs text-[#57534E]">
              <span className="flex items-center gap-1.5"><Users size={13} /> Số khách</span>
              <span className="font-semibold text-[#1C1917]">Tối đa {room.maxOccupancy ?? 2} người</span>
            </div>
            <div className="flex items-center justify-between text-xs text-[#57534E]">
              <span className="flex items-center gap-1.5"><ShieldCheck size={13} /> Cam kết</span>
              <span className="font-semibold text-emerald-600">Giá tốt nhất thị trường</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onBook(room)}
            disabled={room.availableForBooking === false}
            title={room.availableForBooking === false ? "Phòng không còn trống trong khoảng thời gian đã chọn" : undefined}
            className="w-full py-4 bg-[#1C1917] hover:bg-[#8C6D37] disabled:bg-[#D6D3D1] disabled:text-[#78716C] disabled:cursor-not-allowed text-white text-xs uppercase tracking-[0.2em] font-semibold transition-colors duration-200 cursor-pointer text-center rounded-xl shadow-md mb-3"
          >
            {room.availableForBooking === false ? "HẾT PHÒNG TRONG THỜI GIAN ĐÃ CHỌN" : "ĐẶT PHÒNG NÀY NGAY"}
          </button>

          <p className="text-[11px] text-center text-[#A8A29E] leading-normal">
            Không trừ tiền ngay · Thanh toán linh hoạt tại khách sạn
          </p>
        </div>
      </div>
    </div>
  );
};
export default RoomDetailPage;
