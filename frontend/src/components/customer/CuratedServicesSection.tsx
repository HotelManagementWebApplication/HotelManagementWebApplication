import React from "react";
import { ArrowUpRight } from "lucide-react";

interface CuratedServicesSectionProps {
  onBookSpa?: () => void;
  onExploreWellness?: () => void;
}

export const CuratedServicesSection: React.FC<CuratedServicesSectionProps> = ({
  onBookSpa,
  onExploreWellness,
}) => {
  return (
    <section className="w-full bg-[#EFECE6] text-[#1A1A1A] py-20 px-4 sm:px-6 lg:px-12 transition-colors">
      <div className="max-w-7xl mx-auto">
        {/* Editorial Subtitle */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center text-xs font-semibold uppercase tracking-[0.3em] text-[#8C6D37] mb-3">
              <span>MaM Resort Wellness &amp; Mindful Living</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-light text-[#1F2421] tracking-tight">
              Dịch vụ Dưỡng lành &amp; Trị liệu thư giãn
            </h2>
          </div>
          <p className="text-sm sm:text-base text-[#57534E] max-w-md font-light leading-relaxed">
            Hành trình đánh thức giác quan qua dược liệu Đông y bản địa và những nghi thức tĩnh tại
            giúp bạn tái tạo năng lượng nguyên bản.
          </p>
        </div>

        {/* Asymmetrical Layout (Matches Figure 3) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column (lg:col-span-7): Top Large Image + Bottom Card */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Top Large Photo (Spa Massage / Herbal compress hands) */}
            <div className="relative w-full h-[360px] sm:h-[440px] rounded-2xl overflow-hidden shadow-sm group">
              <img
                src="https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=1200&h=900&fit=crop&auto=format"
                alt="Mindful therapy hands"
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-6 left-6 text-white">
                <span className="text-xs uppercase tracking-[0.2em] font-medium bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                  Liệu pháp Nam Y Cổ truyền
                </span>
              </div>
            </div>

            {/* Bottom Card: WELLNESS INCLUSIVE JOURNEYS */}
            <div className="bg-[#FAF8F5] rounded-2xl p-8 sm:p-10 border border-[#DDD6C8] shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-display text-2xl sm:text-3xl uppercase tracking-wider text-[#1C1917] mb-4 font-normal">
                  WELLNESS INCLUSIVE JOURNEYS
                </h3>
                <p className="text-[#57534E] text-sm sm:text-base leading-relaxed font-light mb-6">
                  Gói chăm sóc sức khỏe 90 phút trọn gói mỗi ngày được bao gồm cho mỗi khách lưu trú
                  mỗi đêm tại khu nghỉ. Bao gồm 30 phút Thủy liệu pháp kết hợp thảo mộc bản địa hữu cơ
                  và 60 phút trị liệu phục hồi thân thể chuyên sâu.
                </p>
              </div>
              <div className="pt-4 border-t border-[#E7E0D3] flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.18em] font-semibold text-[#8C6D37]">
                  Đã bao gồm trong giá phòng
                </span>
                <button
                  type="button"
                  onClick={onBookSpa}
                  className="text-xs uppercase tracking-wider font-semibold text-[#1C1917] hover:text-[#8C6D37] flex items-center gap-1 transition cursor-pointer"
                >
                  <span>Đặt lịch trước</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column (lg:col-span-5): Top Card + Bottom Vertical Image & Info */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Top Card: MINDFUL RITUALS */}
            <div className="bg-[#FAF8F5] rounded-2xl p-8 sm:p-10 border border-[#DDD6C8] shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-display text-2xl sm:text-3xl uppercase tracking-wider text-[#1C1917] mb-4 font-normal">
                  MINDFUL RITUALS
                </h3>
                <p className="text-[#57534E] text-sm sm:text-base leading-relaxed font-light mb-8">
                  Một không gian hoàn hảo để chậm lại và hiện diện trọn vẹn hơn. Bạn được chào đón tham
                  gia các buổi vận động thở buổi sớm bên bờ biển hoặc trải nghiệm các nghi thức chánh niệm
                  đưa tâm trí về trạng thái cân bằng lúc bình minh và hoàng hôn.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={onExploreWellness}
                  className="px-6 py-3 border border-[#1C1917] text-[#1C1917] hover:bg-[#1C1917] hover:text-white rounded-none text-xs uppercase tracking-[0.2em] font-semibold transition-all duration-300 cursor-pointer"
                >
                  TÌM HIỂU THÊM
                </button>
              </div>
            </div>

            {/* Bottom: LUMINA WELLBEING & SPA (Photo + Text) */}
            <div className="bg-[#FAF8F5] rounded-2xl overflow-hidden border border-[#DDD6C8] shadow-sm flex flex-col flex-1">
              <div className="relative w-full h-[220px] sm:h-[260px] overflow-hidden group">
                <img
                  src="https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=900&h=650&fit=crop&auto=format"
                  alt="Lumina Wellbeing & Spa"
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
              </div>
              <div className="p-8 flex flex-col justify-between flex-1">
                <div>
                  <h3 className="font-display text-2xl sm:text-3xl uppercase tracking-wider text-[#1C1917] mb-3 font-normal">
                    LUMINA WELLBEING &amp; SPA
                  </h3>
                  <p className="text-[#57534E] text-sm sm:text-base leading-relaxed font-light mb-6">
                    Một chốn trú ngụ bình yên tách biệt hoàn toàn khỏi nhịp sống phố thị. Với tầm nhìn
                    hướng biển thoáng đạt, đội ngũ trị liệu Lumina Spa sẽ đồng hành cùng bạn bắt đầu từ
                    góc thảo dược truyền thống, tự tay chọn vị thuốc xông hơi và đắm chìm vào liệu trình tái tạo.
                  </p>
                </div>
                <div className="pt-4 border-t border-[#E7E0D3]">
                  <button
                    type="button"
                    onClick={onBookSpa}
                    className="w-full py-3 bg-[#1C1917] hover:bg-[#8C6D37] text-white text-xs uppercase tracking-[0.2em] font-medium transition-colors duration-300 cursor-pointer text-center"
                  >
                    ĐẶT LỊCH DỊCH VỤ SPA
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
export default CuratedServicesSection;
