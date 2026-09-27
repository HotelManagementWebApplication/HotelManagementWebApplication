import React, { useState } from "react";
import { Room } from "../../../shared/types/domain";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Calendar,
  Users,
  ChevronDown,
  Building,
} from "lucide-react";

interface RoomCardSectionProps {
  rooms: Room[];
  onViewDetail: (room: Room) => void;
  onBookRoom: (room: Room) => void;
  checkIn: string;
  setCheckIn: (v: string) => void;
  checkOut: string;
  setCheckOut: (v: string) => void;
  guests: number;
  setGuests: (n: number) => void;
  onSearch: () => void;
  searchLoading?: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const getRoomImage = (room: Room): string => {
  return room.image;
};

import { getRoomFullName, getRoomDescription } from "../roomProfiles";

interface CategoryConfig {
  key: string;
  name: string;
  subtitle: string;
}

const isVipRoom = (room: Room) => room.roomTypeCode?.toUpperCase() === "VIP" || room.type === "VIP Suite";

/**
 * Interactive Figure 4 Carousel Component for a specific room category
 * - Premier room centered by default
 * - Left/Right preview slides peeking in
 * - Left/Right navigation arrows to cycle through all rooms of this type
 * - Room title, specs bar with divider pipes, narrative description, action buttons (NO PRICE)
 */
const CategoryRoomCarousel: React.FC<{
  config: CategoryConfig;
  categoryRooms: Room[];
  onViewDetail: (room: Room) => void;
  onBookRoom: (room: Room) => void;
}> = ({ config, categoryRooms, onViewDetail, onBookRoom }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!categoryRooms || categoryRooms.length === 0) return null;

  const total = categoryRooms.length;
  const safeActiveIndex = Math.min(activeIndex, total - 1);
  const prevIndex = (safeActiveIndex - 1 + total) % total;
  const nextIndex = (safeActiveIndex + 1) % total;

  const activeRoom = categoryRooms[safeActiveIndex];
  const prevRoom = categoryRooms[prevIndex];
  const nextRoom = categoryRooms[nextIndex];

  return (
    <div className="py-12 border-b border-[#EAE5DA] last:border-b-0">
      {/* Category Editorial Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <p className="text-xs uppercase tracking-[0.3em] font-semibold text-[#8C6D37] mb-2 flex items-center justify-center">
          <span>{config.subtitle} · {total} PHÒNG</span>
        </p>
        <h3 className="font-display text-2xl sm:text-3xl md:text-4xl font-light text-[#1F2421] tracking-tight">
          {categoryRooms[0]?.marketingName || categoryRooms[0]?.roomTypeName || config.name}
        </h3>
        <p className="text-xs sm:text-sm text-[#78716C] mt-2 font-light">
          {categoryRooms.find(room => room.tagline?.trim())?.tagline || "Thông tin loại phòng đang được cập nhật từ hệ thống."}
        </p>
      </div>

      {/* The 3-Slide Carousel Layout (Replicating Figure 4) */}
      <div className="relative w-full max-w-6xl mx-auto px-2 sm:px-6">
        <div className="flex items-center justify-center gap-2 sm:gap-4 overflow-hidden py-2">
          {/* Left Preview Card (Previous Room Peeking In) */}
          <div
            onClick={() => setActiveIndex(prevIndex)}
            className="hidden sm:block w-[14%] sm:w-[16%] h-[260px] sm:h-[360px] md:h-[440px] rounded-xl sm:rounded-2xl overflow-hidden opacity-40 hover:opacity-75 transition-all duration-300 cursor-pointer flex-shrink-0 scale-95 hover:scale-100 relative group"
            title={`Xem phòng ${prevRoom.number}`}
          >
            <img
              src={getRoomImage(prevRoom)}
              alt={prevRoom.number}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
            <div className="absolute bottom-3 left-3 text-white text-[11px] font-semibold tracking-wider">
              {prevRoom.number}
            </div>
          </div>

          {/* Thẻ phòng đang chọn ở trung tâm */}
          <div className="relative w-full sm:w-[68%] h-[300px] sm:h-[380px] md:h-[460px] lg:h-[500px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex-shrink-0 border border-[#DDD6C8] group bg-[#EAE6DF]">
            <img
              src={getRoomImage(activeRoom)}
              alt={activeRoom.number}
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />

            {/* Subtle Gradient Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20 pointer-events-none" />

            {/* Floor Badge Top-Right */}
            <div className="absolute top-4 right-4 z-10">
              <span className="px-3 py-1.5 text-[11px] uppercase font-bold tracking-wider rounded-lg bg-black/60 text-white backdrop-blur-md border border-white/20">
                {isVipRoom(activeRoom) ? "TẦNG VIP" : `TẦNG ${activeRoom.floor}`}
              </span>
            </div>

            {/* Room Index Counter Top-Left */}
            <div className="absolute top-4 left-4 z-10">
              <span className="px-3 py-1.5 text-[11px] font-semibold tracking-wider rounded-lg bg-black/60 text-[#E6CA85] backdrop-blur-md border border-white/20">
                Phòng {safeActiveIndex + 1} / {total}
              </span>
            </div>

            {/* Navigation Arrow Left */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex(prevIndex);
              }}
              aria-label="Phòng trước"
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/90 hover:bg-white text-[#1C1917] flex items-center justify-center backdrop-blur-md transition-all duration-200 cursor-pointer shadow-xl hover:scale-110 z-20"
            >
              <ChevronLeft size={22} />
            </button>

            {/* Navigation Arrow Right */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex(nextIndex);
              }}
              aria-label="Phòng kế tiếp"
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/90 hover:bg-white text-[#1C1917] flex items-center justify-center backdrop-blur-md transition-all duration-200 cursor-pointer shadow-xl hover:scale-110 z-20"
            >
              <ChevronRight size={22} />
            </button>
          </div>

          {/* Right Preview Card (Next Room Peeking In) */}
          <div
            onClick={() => setActiveIndex(nextIndex)}
            className="hidden sm:block w-[14%] sm:w-[16%] h-[260px] sm:h-[360px] md:h-[440px] rounded-xl sm:rounded-2xl overflow-hidden opacity-40 hover:opacity-75 transition-all duration-300 cursor-pointer flex-shrink-0 scale-95 hover:scale-100 relative group"
            title={`Xem phòng ${nextRoom.number}`}
          >
            <img
              src={getRoomImage(nextRoom)}
              alt={nextRoom.number}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
            <div className="absolute bottom-3 right-3 text-white text-[11px] font-semibold tracking-wider">
              {nextRoom.number}
            </div>
          </div>
        </div>

        {/* Room Narrative & Metadata Section Below (Figure 4) */}
        <div className="max-w-2xl mx-auto text-center mt-8 px-4">
          {/* Room Title */}
          <h4 className="font-display text-2xl sm:text-3xl text-[#171717] font-normal tracking-wide mb-2.5">
            {getRoomFullName(activeRoom)}
          </h4>

          {/* Specs Bar with Divider Pipes (Figure 4) */}
          <p className="text-[11px] sm:text-xs uppercase tracking-[0.2em] text-[#78716C] font-semibold mb-4 pb-3 border-b border-[#E7E2D6] flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
            <span>{activeRoom.view ? activeRoom.view.toUpperCase() : "—"}</span>
            <span className="text-[#CCC4B4]">|</span>
            <span>{activeRoom.beds ? activeRoom.beds.toUpperCase() : "—"}</span>
            <span className="text-[#CCC4B4]">|</span>
            <span>{activeRoom.area ? `${activeRoom.area} M²` : "—"}</span>
            <span className="text-[#CCC4B4]">|</span>
            <span>{isVipRoom(activeRoom) ? "TẦNG VIP" : `TẦNG ${activeRoom.floor}`}</span>
          </p>

          {/* Short Narrative Description */}
          <p className="text-xs sm:text-sm text-[#57534E] font-light leading-relaxed mb-6">
            {getRoomDescription(activeRoom)}
          </p>

          {/* Direct Dot Indicators for all rooms in this type */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {categoryRooms.map((r, idx) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  safeActiveIndex === idx
                    ? "w-8 bg-[#8C6D37]"
                    : "w-2 bg-[#D6CEBF] hover:bg-[#A89F8F]"
                }`}
                title={`Phòng ${r.number}`}
              />
            ))}
          </div>

          {/* Action Buttons: Đặt chỗ & Xem chi tiết (NO PRICE DISPLAYED) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => onBookRoom(activeRoom)}
              className="w-full py-3.5 px-6 bg-[#78716C] hover:bg-[#57534E] text-white text-xs font-semibold uppercase tracking-[0.2em] transition-colors rounded-none shadow-sm cursor-pointer text-center"
            >
              Đặt chỗ
            </button>

            <button
              type="button"
              onClick={() => onViewDetail(activeRoom)}
              className="w-full py-3.5 px-6 border border-[#78716C] text-[#292524] hover:bg-[#1C1917] hover:text-white text-xs font-semibold uppercase tracking-[0.2em] transition-all rounded-none cursor-pointer text-center"
            >
              Xem chi tiết
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RoomCardSection: React.FC<RoomCardSectionProps> = ({
  rooms,
  onViewDetail,
  onBookRoom,
  checkIn,
  setCheckIn,
  checkOut,
  setCheckOut,
  guests,
  setGuests,
  onSearch,
  searchLoading = false,
  loading = false,
  error = null,
  onRetry,
}) => {
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [floorFilter, setFloorFilter] = useState<string>("ALL");
  const [guestDropdownOpen, setGuestDropdownOpen] = useState(false);

  // Filter by floor if selected
  let baseRooms = (rooms || []).slice();
  if (floorFilter !== "ALL") {
    baseRooms = baseRooms.filter((r) => String(r.floor) === floorFilter);
  }

  // Danh mục và nhãn được dựng từ room_type_code/name của API; thêm loại phòng
  // trong database sẽ tự xuất hiện mà không cần sửa component này.
  const categories = Array.from(
    baseRooms.reduce((result, room) => {
      const key = room.roomTypeCode || room.roomTypeName || room.type;
      const existing = result.get(key);
      if (existing) {
        existing.rooms.push(room);
      } else {
        result.set(key, {
          config: {
            key,
            name: room.marketingName || room.roomTypeName || room.type,
            subtitle: room.tagline || room.roomTypeName || key,
          } satisfies CategoryConfig,
          rooms: [room],
        });
      }
      return result;
    }, new Map<string, { config: CategoryConfig; rooms: Room[] }>())
  ).map(([, value]) => value);

  const filterTabs = [
    { id: "ALL", label: "TẤT CẢ LOẠI PHÒNG" },
    ...categories.map(({ config }) => ({ id: config.key, label: config.name.toUpperCase() })),
  ];

  const renderedCategories = activeTab === "ALL"
    ? categories
    : categories.filter(({ config }) => config.key === activeTab);

  return (
    <section className="w-full bg-[#FAF8F5] py-16 px-4 sm:px-6 lg:px-12 border-t border-[#EDE8DF]">
      <div className="max-w-7xl mx-auto">
        {/* Floating Search Bar (Moved here from Hero) */}
        <div className="mb-14">
          <div
            className="rounded-3xl p-3 sm:p-4 shadow-xl border bg-white"
            style={{
              borderColor: "rgba(184, 148, 74, 0.3)",
              boxShadow: "0 15px 40px -10px rgba(0,0,0,0.08), 0 0 20px rgba(184,148,74,0.08)",
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-center">
              {/* Check-in */}
              <div className="flex flex-col px-4 py-3 rounded-2xl bg-[#F8F6F0]/80 hover:bg-[#F8F6F0] border border-[#E8E2D6] transition-colors">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#8C7A58] flex items-center gap-1.5 mb-1">
                  <Calendar size={13} />
                  Nhận phòng
                </span>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-[#1F2937] outline-none cursor-pointer"
                />
              </div>

              {/* Check-out */}
              <div className="flex flex-col px-4 py-3 rounded-2xl bg-[#F8F6F0]/80 hover:bg-[#F8F6F0] border border-[#E8E2D6] transition-colors">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#8C7A58] flex items-center gap-1.5 mb-1">
                  <Calendar size={13} />
                  Trả phòng
                </span>
                <input
                  type="date"
                  value={checkOut}
                  min={checkIn}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-[#1F2937] outline-none cursor-pointer"
                />
              </div>

              {/* Guests Selector */}
              <div className="relative">
                <div
                  onClick={() => setGuestDropdownOpen(!guestDropdownOpen)}
                  className="flex flex-col px-4 py-3 rounded-2xl bg-[#F8F6F0]/80 hover:bg-[#F8F6F0] border border-[#E8E2D6] transition-colors cursor-pointer"
                >
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-[#8C7A58] flex items-center gap-1.5 mb-1">
                    <Users size={13} />
                    Số khách
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#1F2937]">
                      {guests} người lớn
                    </span>
                    <ChevronDown size={14} className="text-[#8C7A58]" />
                  </div>
                </div>

                {guestDropdownOpen && (
                  <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-2xl p-4 shadow-xl border border-[#E2DDD4] z-50">
                    <p className="text-xs font-semibold text-[#6B7280] mb-3">Chọn số lượng khách</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            setGuests(num);
                            setGuestDropdownOpen(false);
                          }}
                          className={`py-2 text-xs rounded-xl font-semibold transition cursor-pointer ${
                            guests === num
                              ? "bg-[#0D1117] text-[#F7F5F0]"
                              : "bg-[#F7F5F0] text-[#374151] hover:bg-[#EAE6DD]"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* CTA Button */}
              <button
                onClick={onSearch}
                disabled={searchLoading}
                className="w-full h-full min-h-[56px] px-6 rounded-2xl font-semibold text-sm cursor-pointer flex items-center justify-center gap-2 text-[#0D1117] transition-all duration-300 shadow-md hover:shadow-lg hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #D4AF6E 0%, #C29849 50%, #B8944A 100%)",
                }}
              >
                <Search size={16} />
                <span>{searchLoading ? "Đang tìm..." : "Tìm phòng trống"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] font-semibold text-[#8C6D37] mb-2">
              Bộ sưu tập không gian lưu trú ({baseRooms.length} phòng)
            </p>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-light text-[#1F2421] tracking-tight">
              Accommodation
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Floor filter pill selector */}
            <div className="flex items-center gap-1.5 text-xs text-[#78716C] bg-white px-3 py-1.5 rounded-full border border-[#E2DDD4]">
              <Building size={14} className="text-[#8C6D37]" />
              <span>Xếp theo tầng:</span>
              <select
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                className="bg-transparent font-semibold text-[#1C1917] outline-none cursor-pointer"
              >
                <option value="ALL">Tất cả tầng</option>
                {Array.from(new Set(rooms.map((r) => r.floor).filter((f): f is number => typeof f === "number" && f > 0)))
                  .sort((a, b) => a - b)
                  .map((fl) => (
                    <option key={fl} value={String(fl)}>
                      Tầng {fl}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Category Navigation Tabs */}
        <div
          className="flex items-center gap-6 border-b border-[#E7E2D6] mb-8 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none" }}
        >
          {filterTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-xs uppercase tracking-[0.18em] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap relative ${
                  isActive ? "text-[#1C1917]" : "text-[#A8A29E] hover:text-[#57534E]"
                }`}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1C1917]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Render Category Carousels */}
        {renderedCategories.map(({ config, rooms: categoryRooms }) => {
          const sortedCategoryRooms = categoryRooms
            .sort((a, b) => {
              const floorA = Number(a.floor || 1);
              const floorB = Number(b.floor || 1);
              if (floorA !== floorB) return floorA - floorB;
              return String(a.number || "").localeCompare(String(b.number || ""));
            });

          if (sortedCategoryRooms.length === 0) return null;

          return (
            <CategoryRoomCarousel
              key={config.key}
              config={config}
              categoryRooms={sortedCategoryRooms}
              onViewDetail={onViewDetail}
              onBookRoom={onBookRoom}
            />
          );
        })}

        {loading && (
          <div className="py-20 text-center bg-white rounded-2xl border border-[#E2DDD4]">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#8C6D37] border-t-transparent mb-3" />
            <p className="text-sm text-[#78716C]">Đang tải danh mục phòng lưu trú từ hệ thống...</p>
          </div>
        )}

        {error && !loading && (
          <div className="py-20 text-center bg-white rounded-2xl border border-red-200">
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

        {!loading && !error && baseRooms.length === 0 && (
          <div className="py-20 text-center bg-white rounded-2xl border border-[#E2DDD4]">
            <p className="text-sm text-[#78716C]">Không có phòng phù hợp với bộ lọc hiện tại.</p>
            <button
              type="button"
              onClick={() => {
                setActiveTab("ALL");
                setFloorFilter("ALL");
              }}
              className="mt-3 text-xs font-semibold uppercase text-[#8C6D37] hover:underline cursor-pointer"
            >
              Xem lại tất cả phòng
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default RoomCardSection;
