import React from "react";
import { ChevronRight } from "lucide-react";
import type { FnbService } from "./LuxuryFnBView";

interface AmenitiesMosaicProps {
  onSelectCategory?: (category: string, itemId?: string) => void;
  services: FnbService[];
}

interface AmenityItem {
  id: string;
  title: string;
  subtitle: string;
  desc: string;
  image: string;
  actionText: string;
  linkCategory: string;
}

const ACCOMMODATION: AmenityItem = {
  id: "accommodation",
  title: "ACCOMMODATION",
  subtitle: "Biệt thự & Phòng nghỉ",
  desc: "Khám phá các hạng phòng và lựa chọn lưu trú hiện có tại MaM Hotel.",
  image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&h=800&fit=crop&auto=format",
  actionText: "Khám phá phòng",
  linkCategory: "rooms",
};

const serviceCard = (service: FnbService | undefined, fallback: Pick<AmenityItem, "id" | "title" | "subtitle" | "actionText" | "linkCategory">): AmenityItem => ({
  ...fallback,
  id: service?.id || fallback.id,
  desc: service?.desc || "Thông tin dịch vụ đang được cập nhật trong hệ thống.",
  image: service?.img || "",
  title: service?.title || fallback.title,
});

const categoryService = (services: FnbService[], category: string, index = 0) => services.filter(service => service.category === category)[index];

const amenityItems = (services: FnbService[]): AmenityItem[] => [
  ACCOMMODATION,
  serviceCard(categoryService(services, "fine-dining"), { id: "dining", title: "NHÀ HÀNG", subtitle: "Ẩm thực", actionText: "Xem nhà hàng", linkCategory: "fnb" }),
  serviceCard(categoryService(services, "spa"), { id: "wellness", title: "WELLNESS & SPA", subtitle: "Trị liệu", actionText: "Xem spa", linkCategory: "spa" }),
  serviceCard(categoryService(services, "business"), { id: "weddings", title: "SỰ KIỆN", subtitle: "Sự kiện", actionText: "Xem sự kiện", linkCategory: "business" }),
  serviceCard(categoryService(services, "business", 1), { id: "meetings", title: "HỘI NGHỊ", subtitle: "Hội nghị", actionText: "Xem hội nghị", linkCategory: "business" }),
];

export const AmenitiesMosaic: React.FC<AmenitiesMosaicProps> = ({ onSelectCategory, services }) => {
  const [accommodation, dining, ...bottomItems] = amenityItems(services);

  return (
    <section className="w-full bg-[#FAF8F5] text-[#1C1917] py-20 px-4 sm:px-6 lg:px-8 border-b border-[#E8E2D6]">
      <div className="max-w-7xl mx-auto">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <p className="text-sm sm:text-base tracking-[0.38em] text-[#8C6D37] font-bold uppercase mb-3">
            MaM Hotel Experiences
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-[#1F2421] mb-4">
            Tiện ích &amp; Không gian Trải nghiệm
          </h2>
          <p className="text-[#57534E] text-sm sm:text-base leading-relaxed font-light">
            Mỗi góc nhỏ tại MaM Hotel đều được nâng niu để kiến tạo nên kỳ nghỉ yên ả,
            nâng tầm phong cách sống và trân quý từng phút giây an trú.
          </p>
        </div>

        {/* Mosaic Layout (Matches Figure 2) */}
        <div className="space-y-4">
          {/* Top Row: 2 Large Split Blocks (Accommodation & Dining) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Block 1: Accommodation */}
            <div
              onClick={() => onSelectCategory?.(accommodation.linkCategory, accommodation.id)}
              className="group relative h-[380px] sm:h-[440px] rounded-2xl overflow-hidden cursor-pointer border border-white/10 shadow-lg"
            >
              <img
                src={accommodation.image}
                alt={accommodation.title}
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/20 group-hover:from-black/90 transition-all duration-300" />

              <div className="absolute inset-0 p-8 sm:p-10 flex flex-col justify-end items-start text-left z-10">
                <p className="text-xs uppercase tracking-[0.25em] text-[#D4AF6E] font-medium mb-1">
                  {accommodation.subtitle}
                </p>
                <h3 className="font-display text-3xl sm:text-4xl font-light text-white tracking-wide mb-3">
                  {accommodation.title}
                </h3>
                <p className="text-sm text-white/80 font-light line-clamp-3 max-w-lg mb-6 leading-relaxed">
                  {accommodation.desc}
                </p>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider text-white border border-white/60 bg-white/10 backdrop-blur-sm group-hover:bg-white group-hover:text-[#0D1117] transition-all duration-300 cursor-pointer"
                >
                  <span>{accommodation.actionText}</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Block 2: Dining */}
            <div
              onClick={() => onSelectCategory?.(dining.linkCategory, dining.id)}
              className="group relative h-[380px] sm:h-[440px] rounded-2xl overflow-hidden cursor-pointer border border-white/10 shadow-lg"
            >
              {dining.image && <img src={dining.image} alt={dining.title} className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/20 group-hover:from-black/90 transition-all duration-300" />

              <div className="absolute inset-0 p-8 sm:p-10 flex flex-col justify-end items-start text-left z-10">
                <p className="text-xs uppercase tracking-[0.25em] text-[#D4AF6E] font-medium mb-1">
                  {dining.subtitle}
                </p>
                <h3 className="font-display text-3xl sm:text-4xl font-light text-white tracking-wide mb-3">
                  {dining.title}
                </h3>
                <p className="text-sm text-white/80 font-light line-clamp-3 max-w-lg mb-6 leading-relaxed">
                  {dining.desc}
                </p>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider text-white border border-white/60 bg-white/10 backdrop-blur-sm group-hover:bg-white group-hover:text-[#0D1117] transition-all duration-300 cursor-pointer"
                >
                  <span>{dining.actionText}</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Row: 3 Columns (Wellness & Spa, Weddings, Meetings & Events) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bottomItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectCategory?.(item.linkCategory, item.id)}
                className="group relative h-[320px] sm:h-[360px] rounded-2xl overflow-hidden cursor-pointer border border-white/10 shadow-lg"
              >
                {item.image && <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/20 group-hover:from-black/90 transition-all duration-300" />

                <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-end items-start text-left z-10">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[#D4AF6E] font-medium mb-1">
                    {item.subtitle}
                  </p>
                  <h3 className="font-display text-2xl sm:text-3xl font-light text-white tracking-wide mb-2">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-white/75 font-light line-clamp-2 mb-5 leading-relaxed">
                    {item.desc}
                  </p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-semibold uppercase tracking-wider text-white border border-white/60 bg-white/10 backdrop-blur-sm group-hover:bg-white group-hover:text-[#0D1117] transition-all duration-300 cursor-pointer"
                  >
                    <span>{item.actionText}</span>
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
export default AmenitiesMosaic;
