import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { Room } from "../../shared/types/domain";
import { publicApi } from "../../shared/api/public";
import { customerApi } from "../../shared/api/customer";
import { authApi } from "../../shared/api/auth";
import { ApiError, apiErrorMessage } from "../../shared/api/client";
import type { PublicRoomAvailability, PublicRoomDetail, PublicRoomSummary, PublicRoomStatus } from "../../shared/types/public";
import type { CustomerReservation, HotelServiceBooking, HotelServiceBookingRequest } from "../../shared/types/customer";
import {
  Search, MapPin, Calendar, Users, Star, Wifi, Coffee, Car, Dumbbell,
  ChevronLeft, ChevronRight, ChevronDown, X, Heart, BedDouble, Maximize2, Eye,
  CheckCircle, ArrowLeft, Phone, Mail, Globe, Shield, Waves, Utensils, User
} from "lucide-react";

// Newly created luxury retreat components
import { LuxuryHero } from "./components/LuxuryHero";
import { AmenitiesMosaic } from "./components/AmenitiesMosaic";
import { CuratedServicesSection } from "./components/CuratedServicesSection";
import { RoomCardSection } from "./components/RoomCardSection";
import { RoomDetailPage } from "./components/RoomDetailPage";
import { LuxuryBookingModal } from "./components/LuxuryBookingModal";
import { LuxuryFnBView, type FnbService } from "./components/LuxuryFnBView";
import { CustomerProfileDropdown } from "./components/CustomerProfileDropdown";
import { VnpayPaymentResultPage } from "./components/VnpayPaymentResultPage";
import { localDateValue } from "../../shared/utils/localDate";

interface CustomerPortalProps {
  onBack: () => void;
  onLogin: () => void;
  onLogout?: () => void;
  isAuthenticated: boolean;
}

const fmtVND = (n: number) => n.toLocaleString("vi-VN") + " ₫";
const dateInputValue = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return localDateValue(date);
};

const displayRoomType = (value: string): Room["type"] => {
  const normalized = value.toLowerCase();
  if (normalized.includes("vip")) return "VIP Suite";
  if (normalized.includes("suite") || normalized.includes("gia đình") || normalized.includes("gia dinh")) return "Suite";
  if (normalized.includes("superior") || normalized.includes("sup")) return "Superior";
  if (normalized.includes("deluxe") || normalized.includes("dlx")) return "Deluxe";
  return "Standard";
};

const displayRoomStatus = (status: PublicRoomStatus, available?: boolean): Room["status"] => {
  if (available === false && status === "available") return "reserved";
  if (status === "cleaning") return "housekeeping";
  if (status === "maintenance" || status === "out_of_service") return "maintenance";
  return status;
};

const mapPublicRoom = (room: PublicRoomSummary | PublicRoomAvailability | PublicRoomDetail): Room => {
  const status = "status" in room ? room.status : room.current_status;
  const available = "available" in room ? room.available : undefined;
  const imageUrls = "image_urls" in room ? room.image_urls : [];
  const imageUrl = "image_url" in room ? room.image_url : imageUrls[0] ?? null;
  return {
    id: room.room_id,
    number: room.room_name,
    floor: room.floor,
    type: displayRoomType(room.room_type_name),
    roomTypeCode: room.room_type_code,
    roomTypeName: room.room_type_name,
    marketingName: room.marketing_name || undefined,
    tagline: room.marketing_tagline || undefined,
    pricePerNight: room.daily_price,
    pricePerHour: room.hourly_price,
    status: displayRoomStatus(status, available),
    availableForBooking: available,
    cleanStatus: status === "cleaning" ? "in-progress" : "clean",
    view: room.view || "—",
    beds: room.bed_type || "—",
    area: room.area ?? 0,
    amenities: room.amenities || [],
    image: imageUrl || "",
    imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    description: ("description" in room ? room.description : room.room_description)
      || room.marketing_description
      || room.room_type_description
      || undefined,
    maxOccupancy: room.max_occupancy ?? 2,
  };
};

const serviceTagColor: Record<string, string> = {
  "fine-dining": "#8B5CF6", inroom: "#22C55E", spa: "#EC4899",
  transport: "#3B82F6", laundry: "#3B82F6", recreation: "#F97316", business: "#B8944A",
};

interface CustomerBookingIdentity {
  fullName: string;
  phone: string;
  identityNumber: string;
  email: string;
}



export default function CustomerPortal({ onBack, onLogin, onLogout, isAuthenticated }: CustomerPortalProps) {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isDetailView, setIsDetailView] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [customerDisplayName, setCustomerDisplayName] = useState<string>("");
  const [customerBookingIdentity, setCustomerBookingIdentity] = useState<CustomerBookingIdentity | null>(null);
  const [bookingConfirmation, setBookingConfirmation] = useState<{
    code: string;
    reservationId: number;
    room: Room;
    rentalType: "night" | "hour";
    checkIn: string;
    checkOut: string;
    hourlyCheckIn?: string;
    hourlyCheckOut?: string;
    guests: number;
    total: number;
    depositAmount: number;
    paymentCode: string;
    paymentStatus: string;
    paymentMethod: "vnpay" | "hotel";
  } | null>(null);

  // Sync customer display name
  useEffect(() => {
    if (!isAuthenticated) {
      setCustomerDisplayName("");
      setCustomerBookingIdentity(null);
      return;
    }

    authApi.customerProfile()
      .then(p => {
        if (p?.guest?.full_name) setCustomerDisplayName(p.guest.full_name);
        setCustomerBookingIdentity({
          fullName: p.guest.full_name,
          phone: p.account.phone || p.guest.phone,
          identityNumber: p.guest.identity_number,
          email: p.guest.email || "",
        });
      })
      .catch(() => setCustomerBookingIdentity(null));
  }, [isAuthenticated]);

  // Search Dates & Guests
  const [checkIn, setCheckIn] = useState(() => dateInputValue(1));
  const [checkOut, setCheckOut] = useState(() => dateInputValue(3));
  const [guests, setGuests] = useState(2);
  const [searchLoading, setSearchLoading] = useState(false);

  // Theo dõi mục điều hướng đang chọn khi cuộn
  const [activeNav, setActiveNav] = useState<"sanctuary" | "rooms" | "fnb">("sanctuary");

  // Portal tab
  const [portalView, setPortalView] = useState<"sanctuary" | "rooms" | "fnb">("sanctuary");
  const [fnbCategory, setFnbCategory] = useState("all");
  const [tableModal, setTableModal] = useState(false);
  const [selectedService, setSelectedService] = useState<FnbService | null>(null);

  // Room data & service data
  // Dữ liệu catalog luôn lấy từ backend. Không dùng data.ts/DEFAULT_SERVICES làm dữ liệu dự phòng,
  // vì như vậy giao diện có thể hiển thị phòng hoặc dịch vụ không còn tồn tại trong database.
  const [roomList, setRoomList] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const [serviceList, setServiceList] = useState<FnbService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const [customerReservations, setCustomerReservations] = useState<CustomerReservation[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);

  // References for smooth scrolling
  const roomsRef = useRef<HTMLDivElement>(null);
  const wellnessRef = useRef<HTMLDivElement>(null);
  const serviceRequestRef = useRef<{ body: string; key: string } | null>(null);

  // Scroll spy to switch underline when user scrolls to Accommodation section
  useEffect(() => {
    if (portalView === "fnb") {
      setActiveNav("fnb");
      return;
    }

    const handleScroll = () => {
      if (!roomsRef.current) return;
      const rect = roomsRef.current.getBoundingClientRect();
      // When accommodation section reaches top 45% of viewport
      if (rect.top <= window.innerHeight * 0.45) {
        setActiveNav("rooms");
      } else {
        setActiveNav("sanctuary");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [portalView]);

  const fetchRooms = useCallback(() => {
    setRoomsLoading(true);
    setRoomsError(null);
    publicApi.rooms(undefined, 0, 100)
      .then(apiRooms => {
        if (!Array.isArray(apiRooms)) return;
        setRoomList(apiRooms.map(mapPublicRoom));
      })
      .catch(err => {
        console.warn("Backend public rooms query failed:", err);
        setRoomsError("Không thể tải danh sách phòng lưu trú. Vui lòng thử lại.");
        setRoomList([]);
      })
      .finally(() => {
        setRoomsLoading(false);
      });
  }, []);

  const fetchServices = useCallback(() => {
    setServicesLoading(true);
    setServicesError(null);
    publicApi.services(0, 100)
      .then(apiServices => {
        if (!Array.isArray(apiServices)) return;
        const mapped = apiServices.map((service): FnbService => {
          return {
            id: service.service_id,
            category: service.category,
            title: service.name,
            subtitle: service.unit ? `${service.name} · ${service.unit}` : service.name,
            price: service.price,
            unit: service.unit,
            desc: service.description ?? "",
            img: service.image_url || "",
            tag: service.price === 0 ? "Chưa niêm yết" : service.unit || "Dịch vụ",
            tagColor: serviceTagColor[service.category] ?? "#B8944A",
          };
        });
        setServiceList(mapped);
      })
      .catch(err => {
        console.warn("Backend public services query failed:", err);
        setServicesError("Không thể tải danh sách dịch vụ & trải nghiệm. Vui lòng thử lại.");
        setServiceList([]);
      })
      .finally(() => {
        setServicesLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    if (!isAuthenticated) { setCustomerReservations([]); return; }
    let active = true;
    customerApi.reservations()
      .then(rows => { if (active) setCustomerReservations(Array.isArray(rows) ? rows : []); })
      .catch(err => { console.warn("Unable to load stays for service booking:", err); if (active) setCustomerReservations([]); });
    return () => { active = false; };
  }, [isAuthenticated]);

  const handleSearch = async () => {
    if (!checkIn || !checkOut || new Date(checkIn) >= new Date(checkOut)) {
      window.alert("Ngày trả phòng phải sau ngày nhận phòng.");
      return;
    }
    setSearchLoading(true);
    try {
      const result = await publicApi.availability(`${checkIn}T14:00:00`, `${checkOut}T12:00:00`, undefined, 0, 100);
      if (Array.isArray(result)) setRoomList(result.map(mapPublicRoom));
      // Smooth scroll to rooms section
      roomsRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      console.warn("Availability API error:", error);
      roomsRef.current?.scrollIntoView({ behavior: "smooth" });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleOpenDetail = (room: Room) => {
    setSelectedRoom(room);
    setIsDetailView(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    void publicApi.room(room.id)
      .then(detail => {
        setSelectedRoom(current => current?.id === room.id ? mapPublicRoom(detail) : current);
      })
      .catch(err => console.warn("Backend room detail query failed:", err));
  };

  const handleOpenBooking = async (room: Room) => {
    if (!isAuthenticated) {
      sessionStorage.setItem("pending_booking_room_id", room.id);
      onLogin();
      return;
    }
    if (!checkIn || !checkOut || new Date(checkIn) >= new Date(checkOut)) {
      window.alert("Ngày trả phòng phải sau ngày nhận phòng.");
      return;
    }
    try {
      const result = await publicApi.availability(`${checkIn}T14:00:00`, `${checkOut}T12:00:00`, undefined, 0, 100);
      const matchingRoom = result.find((candidate) => candidate.room_id === room.id);
      if (matchingRoom && !matchingRoom.available) {
        setRoomList(result.map(mapPublicRoom));
        window.alert(`Phòng ${room.number} không còn trống trong khoảng thời gian đã chọn.`);
        return;
      }
      setSelectedRoom(matchingRoom ? mapPublicRoom(matchingRoom) : room);
    } catch (error) {
      // Availability is a guardrail; the reservation API remains the final authority
      // for concurrent bookings, so keep the booking flow usable if this read fails.
      console.warn("Availability pre-check failed:", error);
      setSelectedRoom(room);
    }
    setBookingModalOpen(true);
  };

  // Re-open pending booking if returning from login
  useEffect(() => {
    if (!isAuthenticated) return;

    const pendingRoomId = sessionStorage.getItem("pending_booking_room_id");
    if (pendingRoomId && roomList.length > 0) {
      const targetRoom = roomList.find((r) => r.id === pendingRoomId);
      if (targetRoom) {
        setSelectedRoom(targetRoom);
        setBookingModalOpen(true);
        sessionStorage.removeItem("pending_booking_room_id");
      }
    }

    const pendingServiceId = sessionStorage.getItem("pending_booking_service_id");
    if (pendingServiceId && serviceList.length > 0) {
      const targetService = serviceList.find((s) => s.id === pendingServiceId);
      if (targetService) {
        setPortalView("fnb");
        setSelectedService(targetService);
        setTableModal(true);
        sessionStorage.removeItem("pending_booking_service_id");
      }
    }

    const pendingCategory = sessionStorage.getItem("pending_booking_category");
    if (pendingCategory) {
      navigateToFnbCategory(pendingCategory);
      sessionStorage.removeItem("pending_booking_category");
    }
  }, [isAuthenticated, roomList, serviceList]);

  const handleConfirmBooking = async (bookingData: {
    room: Room;
    mode: "night" | "hour";
    checkIn: string;
    checkOut: string;
    hourlyCheckIn?: string;
    hourlyCheckOut?: string;
    guests: number;
    email: string;
    paymentMethod: "vnpay" | "hotel";
  }) => {
    if (!isAuthenticated) {
      sessionStorage.setItem("pending_booking_room_id", bookingData.room.id);
      setBookingModalOpen(false);
      onLogin();
      return;
    }
    setBookingLoading(true);
    try {
      const isHourly = bookingData.mode === "hour";
      const startDateTime = isHourly ? `${bookingData.hourlyCheckIn}:00` : `${bookingData.checkIn}T14:00:00`;
      const endDateTime = isHourly ? `${bookingData.hourlyCheckOut}:00` : `${bookingData.checkOut}T12:00:00`;

      const nightsCount = Math.max(1, Math.round((new Date(bookingData.checkOut).getTime() - new Date(bookingData.checkIn).getTime()) / 86400000));
      const hourlyDuration = isHourly && bookingData.hourlyCheckIn && bookingData.hourlyCheckOut
        ? Math.max(3, Math.ceil((new Date(bookingData.hourlyCheckOut).getTime() - new Date(bookingData.hourlyCheckIn).getTime()) / 3600000))
        : 3;
      const calculatedTotal = isHourly
        ? bookingData.room.pricePerHour * hourlyDuration
        : bookingData.room.pricePerNight * nightsCount;

      const res = await customerApi.createReservation({
          rental_type: isHourly ? "HOURLY" : "PACKAGE",
          booking_source: "DIRECT",
          rooms: [{
            room_id: bookingData.room.id,
            expected_check_in: startDateTime,
            expected_check_out: endDateTime,
            guest_count: bookingData.guests,
          }],
          idempotency_key: `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          payment_method: bookingData.paymentMethod === "vnpay" ? "VNPAY" : "PAY_AT_HOTEL",
          confirmation_email: bookingData.email.trim() || undefined,
      });

      if (!res?.id) throw new Error("Không thể hoàn tất đặt phòng. Vui lòng thử lại.");
      const confirmId = `BK-${res.id}`;
      setBookingConfirmation({
        code: confirmId,
        reservationId: res.id,
        room: bookingData.room,
        rentalType: bookingData.mode,
        checkIn: bookingData.checkIn,
        checkOut: bookingData.checkOut,
        hourlyCheckIn: bookingData.hourlyCheckIn,
        hourlyCheckOut: bookingData.hourlyCheckOut,
        guests: bookingData.guests,
        total: calculatedTotal,
        depositAmount: Number(res.deposit_amount ?? 0),
        paymentCode: res.deposit_payment?.payment_code ?? "",
        paymentStatus: res.deposit_payment?.status ?? "PENDING",
        paymentMethod: bookingData.paymentMethod,
      });
      setBookingModalOpen(false);
      setIsDetailView(false);
      if (bookingData.paymentMethod === "vnpay") {
        try {
          const checkout = await customerApi.createVnpayCheckout(res.id);
          window.location.assign(checkout.payment_url);
          return;
        } catch (paymentError) {
          window.alert(apiErrorMessage(paymentError,
            "Booking đã được tạo nhưng chưa thể mở VNPay. Bạn có thể bấm Thanh toán qua VNPay để thử lại."));
        }
      }
    } catch (e) {
      console.warn("Reservation submit failed:", e);
      if (
        (e instanceof ApiError && e.isUnauthorized) ||
        (e instanceof Error && /authentication|unauthorized/i.test(e.message))
      ) {
        sessionStorage.setItem("pending_booking_room_id", bookingData.room.id);
        setBookingModalOpen(false);
        onLogin();
        return;
      }
      window.alert(apiErrorMessage(e, "Không thể tạo đặt phòng. Vui lòng thử lại."));
    } finally {
      setBookingLoading(false);
    }
  };

  const handleBookService = async (request: HotelServiceBookingRequest): Promise<HotelServiceBooking | null> => {
    if (!isAuthenticated) {
      setTableModal(false);
      onLogin();
      return null;
    }
    try {
      const body = JSON.stringify(request);
      if (serviceRequestRef.current?.body !== body) {
        serviceRequestRef.current = { body, key: `service-${crypto.randomUUID()}` };
      }
      const result = await customerApi.bookService(request, serviceRequestRef.current.key);
      serviceRequestRef.current = null;
      return result;
    } catch (error) {
      if (
        (error instanceof ApiError && error.isUnauthorized) ||
        (error instanceof Error && /authentication|unauthorized/i.test(error.message))
      ) {
        setTableModal(false);
        onLogin();
        return null;
      }
      window.alert(apiErrorMessage(error, "Không thể đặt dịch vụ. Vui lòng kiểm tra booking và thời gian sử dụng."));
      return null;
    }
  };

  const loadServiceBookings = useCallback((reservationId: number) => customerApi.serviceBookings(reservationId), []);
  const cancelServiceBooking = useCallback((bookingId: number) => customerApi.cancelServiceBooking(bookingId), []);

  const openVnpayCheckout = useCallback(async (reservationId: number) => {
    try {
      const checkout = await customerApi.createVnpayCheckout(reservationId);
      window.location.assign(checkout.payment_url);
    } catch (error) {
      window.alert(apiErrorMessage(error, "Không thể mở cổng thanh toán VNPay."));
    }
  }, []);

  if (window.location.pathname === "/payment/vnpay-result") {
    return <VnpayPaymentResultPage isAuthenticated={isAuthenticated} onLogin={onLogin} />;
  }

  // 1. Success confirmation screen
  if (bookingConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] px-4 py-16">
        <div className="max-w-lg w-full bg-white rounded-3xl p-8 sm:p-10 border border-[#E2DDD4] shadow-xl text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-sm">
            <CheckCircle size={42} />
          </div>

          <span className="text-[11px] uppercase tracking-[0.25em] font-semibold text-[#8C6D37]">
            Đã tạo yêu cầu đặt phòng
          </span>
          <h2 className="font-display text-3xl sm:text-4xl text-[#1C1917] mt-1 mb-3">
            Hân hạnh Đón tiếp Quý khách
          </h2>
          <p className="text-sm text-[#78716C] mb-8 font-light">
            {bookingConfirmation.paymentMethod === "vnpay"
              ? "Đặt phòng đang được giữ trong 15 phút để quý khách hoàn tất tiền cọc qua VNPay."
              : "Yêu cầu đã được gửi tới lễ tân. Phòng chỉ được giữ sau khi lễ tân xác nhận."}
          </p>

          <div className="bg-[#FAF8F5] rounded-2xl p-6 mb-8 text-left border border-[#E7E2D6] space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-[#E2DDD4]">
              <span className="text-xs uppercase tracking-wider text-[#78716C]">Mã xác nhận:</span>
              <span className="font-mono text-base font-bold text-[#8C6D37]">
                {bookingConfirmation.code}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#78716C]">Trạng thái booking:</span>
              <span className="font-semibold text-amber-700">
                {bookingConfirmation.paymentMethod === "vnpay"
                  ? `Chờ thanh toán cọc (${bookingConfirmation.paymentStatus})`
                  : "Chờ lễ tân xác nhận"}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#78716C]">Mã thanh toán cọc:</span>
              <span className="font-mono font-semibold text-[#1C1917]">
                {bookingConfirmation.paymentCode || "Đang cập nhật"}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#78716C]">Số tiền cọc:</span>
              <span className="font-semibold text-[#8C6D37]">
                {fmtVND(bookingConfirmation.depositAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#78716C]">Không gian:</span>
              <span className="font-semibold text-[#1C1917]">
                Phòng {bookingConfirmation.room.number} – {bookingConfirmation.room.type}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#78716C]">{bookingConfirmation.rentalType === "hour" ? "Khung giờ thuê:" : "Thời gian nhận / trả:"}</span>
              <span className="font-semibold text-[#1C1917]">
                {bookingConfirmation.rentalType === "hour"
                  ? `${bookingConfirmation.hourlyCheckIn?.replace("T", " ")} đến ${bookingConfirmation.hourlyCheckOut?.replace("T", " ")}`
                  : `${bookingConfirmation.checkIn} đến ${bookingConfirmation.checkOut}`}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#78716C]">Số khách:</span>
              <span className="font-semibold text-[#1C1917]">
                {bookingConfirmation.guests} người
              </span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-[#E2DDD4]">
              <span className="text-sm font-semibold text-[#1C1917]">Tổng chi phí:</span>
              <span className="text-lg font-bold font-display text-[#8C6D37]">
                {fmtVND(bookingConfirmation.total)}
              </span>
            </div>
          </div>

          <button
            onClick={() => bookingConfirmation.paymentMethod === "vnpay"
              ? void openVnpayCheckout(bookingConfirmation.reservationId)
              : setBookingConfirmation(null)}
            className="w-full py-4 bg-[#1C1917] hover:bg-[#8C6D37] text-white text-xs uppercase tracking-[0.2em] font-semibold transition-all duration-300 rounded-xl shadow-md cursor-pointer"
          >
            {bookingConfirmation.paymentMethod === "vnpay" ? "Thanh toán qua VNPay" : "Quay về Trang chủ"}
          </button>
        </div>
      </div>
    );
  }

  // 2. Room Detail Page (Figure 5)
  if (isDetailView && selectedRoom) {
    return (
      <div className="min-h-screen bg-[#FAF8F5]">
        {/* Detail View Top Header */}
        <nav className="sticky top-0 z-40 px-6 py-4 flex items-center justify-between bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E2DDD4]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDetailView(false)}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#57534E] hover:text-[#1C1917] cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Trở về</span>
            </button>
            <div className="h-4 w-px bg-[#DDD6C8] hidden sm:block" />
            <div className="flex items-center gap-2">
              <img src="/hotel_logo.png" alt="MaM Hotel" className="w-7 h-auto object-contain" />
              <span className="font-display text-lg text-[#0D1117]">MaM Hotel</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 text-xs text-[#8C6D37] hover:text-[#1C1917] font-semibold bg-[#8C6D37]/10 hover:bg-[#8C6D37]/20 px-3.5 py-1.5 rounded-full border border-[#8C6D37]/30 transition cursor-pointer shadow-2xs group"
                  title="Hồ sơ, sửa thông tin, đổi mật khẩu"
                >
                  <User size={13} className="text-[#8C6D37] group-hover:scale-110 transition-transform" />
                  <span>{customerDisplayName || "Khách hàng"}</span>
                  <ChevronDown
                    size={13}
                    className={`text-[#8C6D37] transition-transform duration-200 ${
                      profileDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <CustomerProfileDropdown
                  isOpen={profileDropdownOpen}
                  onClose={() => setProfileDropdownOpen(false)}
                  onLogout={() => {
                    setProfileDropdownOpen(false);
                    onLogout?.();
                  }}
                  onProfileUpdated={(updatedName) => {
                    setCustomerDisplayName(updatedName);
                  }}
                  onNavigateToServices={() => {
                    setProfileDropdownOpen(false);
                    setPortalView("fnb");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onPayReservation={(reservationId) => void openVnpayCheckout(reservationId)}
                />
              </div>
            )}
            <button
              onClick={() => handleOpenBooking(selectedRoom)}
              disabled={selectedRoom.availableForBooking === false}
              title={selectedRoom.availableForBooking === false ? "Phòng không còn trống trong khoảng thời gian đã chọn" : undefined}
              className="px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#1C1917] hover:bg-[#8C6D37] disabled:bg-[#D6D3D1] disabled:text-[#78716C] disabled:cursor-not-allowed text-white transition cursor-pointer"
            >
              {selectedRoom.availableForBooking === false ? "Hết phòng" : "Đặt phòng này"}
            </button>
          </div>
        </nav>

        {/* Room Detail Page Component (Replicating Figure 5) */}
        <RoomDetailPage
          room={selectedRoom}
          onBack={() => setIsDetailView(false)}
          onBook={handleOpenBooking}
        />

        {/* Booking Modal */}
        <LuxuryBookingModal
          room={selectedRoom}
          isOpen={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          onConfirm={handleConfirmBooking}
          loading={bookingLoading}
          isAuthenticated={isAuthenticated}
          customerIdentity={customerBookingIdentity ?? undefined}
          onLogin={onLogin}
        />
      </div>
    );
  }

  const navigateToFnbCategory = (category: string, itemId?: string) => {
    const targetCategory = category === "spa" ? "spa" : category === "business" ? "business" : "fine-dining";
    setFnbCategory(targetCategory);
    setActiveNav("fnb");
    setPortalView("fnb");

    const performScroll = () => {
      const tabsEl = document.getElementById("fnb-tabs");
      if (tabsEl) {
        const headerOffset = 73;
        const targetY = tabsEl.getBoundingClientRect().top + window.pageYOffset - headerOffset;
        window.scrollTo({ top: Math.max(0, targetY), behavior: "instant" });
      }
      if (itemId) {
        const itemEl = document.getElementById(itemId);
        if (itemEl) {
          itemEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    };

    requestAnimationFrame(performScroll);
    setTimeout(performScroll, 60);
  };

  // 3. Main Hotel Customer Portal
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C1917] font-sans antialiased selection:bg-[#B8944A]/20">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 px-6 sm:px-10 py-4 flex items-center justify-between bg-[#FAF8F5]/85 backdrop-blur-xl border-b border-[#E7E2D6] transition-all">
        <div className="flex items-center gap-4">
          <button onClick={onBack} title="Quay lại chọn vai trò" className="text-[#78716C] hover:text-[#1C1917] transition cursor-pointer">
            <ArrowLeft size={18} />
          </button>

          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setPortalView("sanctuary")}>
            <img src="/hotel_logo.png" alt="MaM Hotel Logo" className="w-8 h-auto object-contain drop-shadow" />
            <div>
              <span className="font-display text-xl leading-none text-[#0D1117] tracking-tight block">MaM Hotel</span>
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#8C6D37] font-semibold block mt-0.5">Beach Hotel &amp; Spa</span>
            </div>
          </div>
        </div>

        {/* Navigation items with dynamic scroll-spy underline */}
        <div className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-[0.2em]">
          <button
            onClick={() => {
              setPortalView("sanctuary");
              setActiveNav("sanctuary");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`cursor-pointer transition pb-1 ${
              portalView !== "fnb" && activeNav === "sanctuary"
                ? "text-[#8C6D37] border-b-2 border-[#8C6D37]"
                : "text-[#57534E] hover:text-[#1C1917]"
            }`}
          >
            Nghỉ dưỡng
          </button>
          <button
            onClick={() => {
              setPortalView("sanctuary");
              setActiveNav("rooms");
              roomsRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            className={`cursor-pointer transition pb-1 ${
              portalView !== "fnb" && activeNav === "rooms"
                ? "text-[#8C6D37] border-b-2 border-[#8C6D37]"
                : "text-[#57534E] hover:text-[#1C1917]"
            }`}
          >
            Phòng &amp; Biệt thự
          </button>
          <button
            onClick={() => {
              setPortalView("fnb");
              setActiveNav("fnb");
            }}
            className={`cursor-pointer transition pb-1 ${
              portalView === "fnb"
                ? "text-[#8C6D37] border-b-2 border-[#8C6D37]"
                : "text-[#57534E] hover:text-[#1C1917]"
            }`}
          >
            Ẩm thực &amp; Tiện ích
          </button>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 text-xs text-[#8C6D37] hover:text-[#1C1917] font-semibold bg-[#8C6D37]/10 hover:bg-[#8C6D37]/20 px-3.5 py-1.5 rounded-full border border-[#8C6D37]/30 transition cursor-pointer shadow-2xs group"
                  title="Hồ sơ, sửa thông tin, đổi mật khẩu"
                >
                  <User size={13} className="text-[#8C6D37] group-hover:scale-110 transition-transform" />
                  <span>{customerDisplayName || "Khách hàng"}</span>
                  <ChevronDown
                    size={13}
                    className={`text-[#8C6D37] transition-transform duration-200 ${
                      profileDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Cửa sổ xổ xuống (Dropdown Menu) */}
                <CustomerProfileDropdown
                  isOpen={profileDropdownOpen}
                  onClose={() => setProfileDropdownOpen(false)}
                  onLogout={() => {
                    setProfileDropdownOpen(false);
                    onLogout?.();
                  }}
                  onProfileUpdated={(updatedName) => {
                    setCustomerDisplayName(updatedName);
                  }}
                  onNavigateToServices={() => {
                    setProfileDropdownOpen(false);
                    setPortalView("fnb");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onPayReservation={(reservationId) => void openVnpayCheckout(reservationId)}
                />
              </div>

              <button
                onClick={onLogout}
                className="px-4 py-2 rounded-full text-xs uppercase tracking-wider font-semibold bg-[#EDE8E0] hover:bg-[#DDD6C8] text-[#1C1917] transition cursor-pointer"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="px-5 py-2 rounded-full text-xs uppercase tracking-wider font-semibold bg-[#1C1917] hover:bg-[#8C6D37] text-white transition cursor-pointer shadow-sm"
            >
              Đăng nhập
            </button>
          )}
        </div>
      </header>

      {/* VIEW 1: FnB & Services */}
      {portalView === "fnb" && (
        <LuxuryFnBView
          fnbCategory={fnbCategory}
          setFnbCategory={setFnbCategory}
          tableModal={tableModal}
          setTableModal={setTableModal}
          services={serviceList}
          selectedService={selectedService}
          onSelectService={setSelectedService}
          onBookService={handleBookService}
          onLoadBookings={loadServiceBookings}
          onCancelBooking={cancelServiceBooking}
          reservations={customerReservations}
          isAuthenticated={isAuthenticated}
          onLogin={onLogin}
          loading={servicesLoading}
          error={servicesError}
          onRetry={fetchServices}
        />
      )}

      {/* VIEW 2: The Complete 5-Star Hotel Landing Flow */}
      {portalView === "sanctuary" && (
        <>
          {/* SECTION 1: High-Resolution Cinematic Hero with User's Video & Scroll Prompt */}
          <LuxuryHero
            onScrollToRooms={() => {
              document.getElementById("amenities")?.scrollIntoView({ behavior: "smooth" });
            }}
          />

          {/* SECTION 2: Hotel Amenities Mosaic / Layout (Figure 2 / Hình 2) */}
          <div id="amenities">
            <AmenitiesMosaic
              services={serviceList}
              onSelectCategory={(cat, itemId) => {
                if (cat === "rooms") {
                  roomsRef.current?.scrollIntoView({ behavior: "smooth" });
                } else if (cat === "fnb" || cat === "spa" || cat === "business") {
                  navigateToFnbCategory(cat, itemId);
                }
              }}
            />
          </div>

          {/* SECTION 3: Curated Mindful Services & Spa (Figure 3 / Hình 3) */}
          <div ref={wellnessRef} id="wellness">
            <CuratedServicesSection
              services={serviceList}
              onBookSpa={() => {
                if (!isAuthenticated) {
                  sessionStorage.setItem("pending_booking_category", "spa");
                  onLogin();
                  return;
                }
                navigateToFnbCategory("spa");
              }}
              onExploreWellness={() => navigateToFnbCategory("spa")}
            />
          </div>

          {/* SECTION 4: Room Cards Showcase & Search Bar (Figure 4 / Hình 4) - NO PRICE DISPLAYED */}
          <div ref={roomsRef} id="accommodation">
            <RoomCardSection
              rooms={roomList}
              onViewDetail={handleOpenDetail}
              onBookRoom={handleOpenBooking}
              checkIn={checkIn}
              setCheckIn={setCheckIn}
              checkOut={checkOut}
              setCheckOut={setCheckOut}
              guests={guests}
              setGuests={setGuests}
              onSearch={handleSearch}
              searchLoading={searchLoading}
              loading={roomsLoading}
              error={roomsError}
              onRetry={fetchRooms}
            />
          </div>
        </>
      )}

      {/* Booking Modal when user clicks "Đặt chỗ" anywhere */}
      {selectedRoom && (
        <LuxuryBookingModal
          room={selectedRoom}
          isOpen={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          onConfirm={handleConfirmBooking}
          loading={bookingLoading}
          isAuthenticated={isAuthenticated}
          customerIdentity={customerBookingIdentity ?? undefined}
          onLogin={onLogin}
        />
      )}

      {/* Features Strip */}
      <section className="py-16 px-4 bg-[#141A24] text-white border-t border-white/5">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8 text-center">
          {[
            [Wifi, "WiFi Toàn Khu", "Kết nối tốc độ cao không giới hạn"],
            [Car, "Đưa đón sân bay 24/7", "Dịch vụ xe sang đưa đón tận nơi"],
            [Waves, "Hồ bơi", "Hồ bơi vô cực ngắm trọn biển trời"],
            [Dumbbell, "Spa & Gym", "Trị liệu chuyên sâu & thể hình hiện đại"],
            [Utensils, "Ẩm Thực Cao Cấp", "Hương vị ẩm thực tinh hoa từ bếp trưởng"],
          ].map(([Icon, title, sub], i) => {
            const Ic = Icon as React.FC<{ size: number; className: string }>;
            return (
              <div key={i} className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-white/5 border border-[#B8944A]/30 flex items-center justify-center mb-4 text-[#D4AF6E]">
                  <Ic size={22} className="text-[#D4AF6E]" />
                </div>
                <h4 className="text-sm font-medium text-white mb-1">{title as string}</h4>
                <p className="text-xs text-white/50">{sub as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-14 px-6 bg-[#0B0F17] text-white border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <img src="/hotel_logo.png" alt="MaM Hotel" className="w-10 h-auto object-contain drop-shadow" />
            <div>
              <p className="font-display text-xl text-white">MaM Hotel</p>
              <p className="text-xs text-[#D4AF6E] tracking-widest uppercase">Vũng Tàu, Việt Nam</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-white/60">
            <span className="flex items-center gap-1.5"><MapPin size={13} className="text-[#D4AF6E]" /> Số 1 VVN, Vũng Tàu</span>
            <span className="flex items-center gap-1.5"><Phone size={13} className="text-[#D4AF6E]" /> Hotline: 1900 6789</span>
            <span className="flex items-center gap-1.5"><Mail size={13} className="text-[#D4AF6E]" /> retreat@mamresort.vn</span>
            <span className="flex items-center gap-1.5"><Globe size={13} className="text-[#D4AF6E]" /> www.mamresort.vn</span>
          </div>

          <p className="text-xs text-white/40">
          © 2026 MaM Hotel · All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
