import React, { useState, useEffect, useRef } from "react";
import {
  X,
  User,
  Shield,
  KeyRound,
  Calendar,
  CreditCard,
  MapPin,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  LogOut,
  Sparkles,
  BedDouble,
  Clock,
  Edit3,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  UtensilsCrossed,
  Users,
  Layers,
  ArrowRight,
  Info,
} from "lucide-react";
import { customerApi } from "../../../shared/api/customer";
import { authApi } from "../../../shared/api/auth";
import type { CustomerProfileDto } from "../../../shared/types/api";
import type { CustomerReservation, CustomerStayChangeType } from "../../../shared/types/customer";
import { apiErrorMessage } from "../../../shared/api/client";
import { formatDateTimeVi, formatDateVi } from "../../../shared/utils/localDate";

interface CustomerProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onProfileUpdated?: (name: string) => void;
  onNavigateToServices?: () => void;
  onPayReservation?: (reservationId: number) => void;
}

type TabType = "overview" | "edit" | "password" | "bookings";

const fmtVND = (n: number) => (n ?? 0).toLocaleString("vi-VN") + " ₫";
const toDateTimeInput = (value?: string) => value ? value.slice(0, 16) : "";
const withSeconds = (value: string) => value.length === 16 ? `${value}:00` : value;
const localInputAfter = (value: string, milliseconds: number) => {
  const date = new Date(new Date(value).getTime() + milliseconds);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getReservationStatusMeta = (reservation: CustomerReservation) => {
  const status = reservation.status;
  switch (status?.toUpperCase()) {
    case "DRAFT":
      if (reservation.deposit_payment?.status === "NOT_REQUIRED") {
        return {
          label: "Chờ lễ tân xác nhận",
          badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
          dotClass: "bg-amber-500",
          desc: "Yêu cầu chưa giữ phòng; lễ tân sẽ kiểm tra khả dụng trước khi xác nhận.",
        };
      }
      return {
        label: "Chờ thanh toán cọc",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
        dotClass: "bg-amber-500",
        desc: "Đơn đang giữ phòng, vui lòng hoàn tất tiền cọc qua VNPay.",
      };
    case "DEPOSIT_PAID":
      return {
        label: "Đã cọc · Chờ nhận phòng",
        badgeClass: "bg-sky-50 text-sky-800 border-sky-300",
        dotClass: "bg-sky-500",
        desc: "Tiền cọc đã được ghi nhận. Phòng đã sẵn sàng đón tiếp quý khách.",
      };
    case "CONFIRMED":
      return {
        label: "Đã xác nhận phòng",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300",
        dotClass: "bg-emerald-500",
        desc: "Đơn đặt phòng và tiền cọc đã được xác nhận chính thức.",
      };
    case "CHECKED_IN":
      return {
        label: "Đang lưu trú",
        badgeClass: "bg-purple-50 text-purple-800 border-purple-300",
        dotClass: "bg-purple-500",
        desc: "Quý khách đang nhận phòng và lưu trú tại khách sạn.",
      };
    case "CHECKED_OUT":
      return {
        label: "Đã trả phòng (Check-out)",
        badgeClass: "bg-stone-100 text-stone-700 border-stone-300",
        dotClass: "bg-stone-400",
        desc: "Kỳ nghỉ đã kết thúc. Cảm ơn quý khách đã đồng hành cùng MaM Hotel.",
      };
    case "CANCELLED":
      return {
        label: "Đã hủy đơn",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-300",
        dotClass: "bg-rose-500",
        desc: "Đơn đặt phòng đã được hủy.",
      };
    case "NO_SHOW":
      return {
        label: "Không đến (No Show)",
        badgeClass: "bg-stone-100 text-stone-600 border-stone-300",
        dotClass: "bg-stone-400",
        desc: "Quá hạn nhận phòng.",
      };
    default:
      return {
        label: status || "Đang xử lý",
        badgeClass: "bg-stone-100 text-stone-700 border-stone-300",
        dotClass: "bg-stone-400",
        desc: "",
      };
  }
};

const getServiceStatusMeta = (status: string) => {
  switch (status?.toUpperCase()) {
    case "CONFIRMED":
      return {
        label: "Đã đặt trước",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "USED":
      return {
        label: "Đã phục vụ tại KS",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "CANCELLED":
      return {
        label: "Đã hủy",
        badgeClass: "bg-stone-100 text-stone-500 border-stone-200",
      };
    default:
      return {
        label: status || "Đã ghi nhận",
        badgeClass: "bg-stone-100 text-stone-600 border-stone-200",
      };
  }
};

const calculateStaySummary = (checkInStr?: string, checkOutStr?: string, rentalType?: string) => {
  if (!checkInStr || !checkOutStr) return "";
  try {
    const tIn = new Date(checkInStr).getTime();
    const tOut = new Date(checkOutStr).getTime();
    if (isNaN(tIn) || isNaN(tOut)) return "";
    const diffMs = Math.max(0, tOut - tIn);
    if (rentalType === "HOURLY") {
      const hours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
      return `${hours} giờ`;
    } else {
      const nights = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      return `${nights} đêm`;
    }
  } catch {
    return "";
  }
};

const cancellationPolicy = (reservation: CustomerReservation) => {
  const checkIn = reservation.rooms?.[0]?.expected_check_in;
  const hours = checkIn ? (new Date(checkIn).getTime() - Date.now()) / 3_600_000 : 0;
  if (reservation.deposit_payment?.status !== "PAID") {
    return { refund: false, label: "Hủy đặt phòng", note: "Chưa thanh toán cọc nên không phát sinh hoàn tiền." };
  }
  return hours > 48
    ? { refund: true, label: "Hủy miễn phí", note: "Hủy trước giờ nhận phòng hơn 48 giờ: hoàn toàn bộ tiền cọc." }
    : { refund: false, label: "Hủy phòng · Mất cọc", note: "Hủy trong vòng 48 giờ, kể cả đúng mốc 48 giờ: tiền cọc không được hoàn." };
};

export const CustomerProfileDropdown: React.FC<CustomerProfileDropdownProps> = ({
  isOpen,
  onClose,
  onLogout,
  onProfileUpdated,
  onNavigateToServices,
  onPayReservation,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Profile state
  const [profile, setProfile] = useState<CustomerProfileDto | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Edit profile state
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editIdNumber, setEditIdNumber] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editBirthYear, setEditBirthYear] = useState<string>("");
  const [editSuccess, setEditSuccess] = useState("");
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Change password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwError, setPwError] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  // Bookings state
  const [reservations, setReservations] = useState<CustomerReservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [bookingFilter, setBookingFilter] = useState<"all" | "active" | "past">("all");
  const [expandedResId, setExpandedResId] = useState<number | null>(null);
  const [cancellingReservationId, setCancellingReservationId] = useState<number | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [stayChange, setStayChange] = useState<{ reservationId: number; type: CustomerStayChangeType } | null>(null);
  const [changeCheckIn, setChangeCheckIn] = useState("");
  const [changeCheckOut, setChangeCheckOut] = useState("");
  const [changingReservationId, setChangingReservationId] = useState<number | null>(null);
  const [changeError, setChangeError] = useState("");
  const [changeSuccess, setChangeSuccess] = useState("");


  const handleCancelReservation = async (reservation: CustomerReservation) => {
    const policy = cancellationPolicy(reservation);
    const accepted = window.confirm(`${policy.note}\n\nBạn chắc chắn muốn hủy booking #BK-${reservation.id}?`);
    if (!accepted) return;
    setCancellingReservationId(reservation.id);
    setCancelError("");
    try {
      const updated = await customerApi.cancelReservation(
        reservation.id,
        "Khách hàng tự hủy trên website",
        `customer-cancel-${crypto.randomUUID()}`,
      );
      setReservations(rows => rows.map(row => row.id === updated.id ? updated : row));
    } catch (error) {
      setCancelError(apiErrorMessage(error, "Không thể hủy đặt phòng. Vui lòng thử lại."));
    } finally {
      setCancellingReservationId(null);
    }
  };

  const openStayChange = (reservation: CustomerReservation, type: CustomerStayChangeType) => {
    const room = reservation.rooms?.[0];
    if (!room) return;
    setStayChange({ reservationId: reservation.id, type });
    setChangeError("");
    setChangeSuccess("");
    if (type === "EXTEND") {
      setChangeCheckIn(toDateTimeInput(room.expected_check_out));
      setChangeCheckOut(localInputAfter(room.expected_check_out, 24 * 60 * 60 * 1000));
    } else {
      setChangeCheckIn(toDateTimeInput(room.expected_check_in));
      setChangeCheckOut(toDateTimeInput(room.expected_check_out));
    }
  };

  const handleRescheduleCheckIn = (reservation: CustomerReservation, value: string) => {
    setChangeCheckIn(value);
    const room = reservation.rooms?.[0];
    if (!room || !value) return;
    const duration = new Date(room.expected_check_out).getTime() - new Date(room.expected_check_in).getTime();
    setChangeCheckOut(localInputAfter(value, duration));
  };

  const submitStayChange = async (reservation: CustomerReservation) => {
    if (!stayChange || !changeCheckOut || (stayChange.type === "RESCHEDULE" && !changeCheckIn)) return;
    setChangingReservationId(reservation.id);
    setChangeError("");
    setChangeSuccess("");
    try {
      const updated = await customerApi.changeReservationStay(
        reservation.id,
        {
          type: stayChange.type,
          new_check_in: withSeconds(changeCheckIn),
          new_check_out: withSeconds(changeCheckOut),
        },
        `stay-change-${crypto.randomUUID()}`,
      );
      setReservations(rows => rows.map(row => row.id === updated.id ? updated : row));
      setStayChange(null);
      setChangeSuccess(stayChange.type === "EXTEND"
        ? "Đã giữ phần ngày thêm. Vui lòng thanh toán cọc bổ sung trước khi hết hạn."
        : "Đã đổi ngày lưu trú thành công.");
    } catch (error) {
      setChangeError(apiErrorMessage(error, "Không thể thay đổi lịch lưu trú. Vui lòng kiểm tra ngày và thử lại."));
    } finally {
      setChangingReservationId(null);
    }
  };

  // Handle click outside & Esc key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Load profile from API and merge local overrides
  useEffect(() => {
    if (!isOpen) return;
    setLoadingProfile(true);
    setProfileError("");

    authApi
      .customerProfile()
      .then((data) => {
        setProfile(data);
        setEditFullName(data.guest.full_name || "");
        setEditEmail(data.guest.email || "");
        setEditIdNumber(data.guest.identity_number || "");
        setEditAddress(data.guest.address || "");
        setEditBirthYear(data.guest.birth_year ? String(data.guest.birth_year) : "");
        onProfileUpdated?.(data.guest.full_name || "");
      })
      .catch((err) => {
        console.warn("Failed to load customer profile:", err);
        setProfileError("Không thể tải thông tin hồ sơ.");
      })
      .finally(() => setLoadingProfile(false));

    // Load reservations
    setLoadingReservations(true);
    customerApi
      .reservations()
      .then((resList) => {
        if (Array.isArray(resList)) {
          setReservations(resList);
          if (resList.length > 0) {
            setExpandedResId((prev) => prev ?? resList[0].id);
          }
        }
      })
      .catch((err) => console.warn("Failed to load reservations:", err))
      .finally(() => setLoadingReservations(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFullName.trim()) {
      setEditError("Vui lòng nhập Họ và tên.");
      return;
    }
    if (!editIdNumber.trim()) {
      setEditError("Vui lòng nhập Số CCCD / Hộ chiếu.");
      return;
    }
    setEditError("");
    setSavingEdit(true);

    try {
      const payload = {
        full_name: editFullName.trim(),
        identity_number: editIdNumber.trim(),
        email: editEmail.trim() || undefined,
        address: editAddress.trim() || undefined,
        birth_year: editBirthYear.trim() ? Number(editBirthYear.trim()) : undefined,
      };

      const updated = await customerApi.updateProfile(payload);
      setProfile(updated);
      onProfileUpdated?.(updated.guest.full_name || editFullName.trim());
      setEditSuccess("Cập nhật thông tin thành công!");
      setTimeout(() => {
        setEditSuccess("");
        setActiveTab("overview");
      }, 1200);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setEditError("Không thể lưu thông tin. Vui lòng thử lại.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");

    if (!newPassword) {
      setPwError("Vui lòng nhập mật khẩu mới.");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSavingPw(true);
    try {
      await customerApi.changePassword(newPassword);
      setPwSuccess("Đổi mật khẩu thành công!");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setPwSuccess("");
        setActiveTab("overview");
      }, 1500);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setPwError("Đổi mật khẩu thất bại. Vui lòng thử lại.");
    } finally {
      setSavingPw(false);
    }
  };

  const tierBadgeColor = (tier: string) => {
    switch (tier?.toUpperCase()) {
      case "PLATINUM":
        return "bg-cyan-500/15 text-cyan-700 border-cyan-300";
      case "GOLD":
        return "bg-amber-500/15 text-amber-700 border-amber-300";
      case "SILVER":
        return "bg-slate-400/15 text-slate-700 border-slate-300";
      default:
        return "bg-[#8C6D37]/15 text-[#8C6D37] border-[#8C6D37]/30";
    }
  };

  const tierLabel = (tier: string) => ({
    STANDARD: "Tiêu chuẩn",
    SILVER: "Bạc",
    GOLD: "Vàng",
    PLATINUM: "Bạch kim",
  }[tier?.toUpperCase()] ?? "Tiêu chuẩn");

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2.5 w-[360px] sm:w-[500px] md:w-[540px] max-w-[95vw] bg-[#FAF8F5] rounded-2xl shadow-2xl border border-[#E7E2D6] z-50 overflow-hidden flex flex-col text-[#1C1917] animate-in fade-in slide-in-from-top-2 duration-150"
      style={{
        boxShadow: "0 20px 45px -10px rgba(28, 25, 23, 0.22), 0 0 0 1px rgba(140, 109, 55, 0.15)",
      }}
    >
      {/* DROPDOWN HEADER: Avatar, Name, Phone & Membership */}
      <div className="bg-[#1C1917] text-white p-4.5 relative border-b border-[#8C6D37]/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#D4AF6E] to-[#8C6D37] flex items-center justify-center text-white font-serif font-bold text-lg shadow-md border-2 border-white/20 shrink-0">
              {profile?.guest?.full_name ? profile.guest.full_name.charAt(0).toUpperCase() : "K"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold text-white truncate max-w-[180px]">
                  {profile?.guest?.full_name || "Khách hàng"}
                </p>
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tierBadgeColor(
                    profile?.guest?.membership_tier || "STANDARD"
                  )} bg-white/10 text-[#EBD5B3] border-[#B8944A]/40`}
                >
                  {tierLabel(profile?.guest?.membership_tier || "STANDARD")}
                </span>
              </div>
              <p className="text-xs text-white/70 font-mono flex items-center gap-1 mt-0.5">
                <Phone size={11} className="text-[#D4AF6E]" />
                <span>{profile?.account?.phone || profile?.guest?.phone || "—"}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X size={16} />
          </button>
        </div>

        {/* Spend strip */}
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-white/60">Tích lũy chi tiêu:</span>
          <span className="font-semibold text-[#D4AF6E] font-mono">
            {fmtVND(profile?.guest?.total_spend ?? 0)}
          </span>
        </div>
      </div>

      {/* SEGMENTED TAB NAV */}
      <div className="grid grid-cols-4 bg-[#EDE8E0] p-1 border-b border-[#E2DDD4] text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`py-1.5 px-1 rounded-lg text-center transition cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 text-[11px] ${
            activeTab === "overview"
              ? "bg-white text-[#8C6D37] font-semibold shadow-xs"
              : "text-[#57534E] hover:text-[#1C1917]"
          }`}
        >
          <User size={12} />
          <span>Hồ sơ</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("edit")}
          className={`py-1.5 px-1 rounded-lg text-center transition cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 text-[11px] ${
            activeTab === "edit"
              ? "bg-white text-[#8C6D37] font-semibold shadow-xs"
              : "text-[#57534E] hover:text-[#1C1917]"
          }`}
        >
          <Edit3 size={12} />
          <span>Sửa</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("password")}
          className={`py-1.5 px-1 rounded-lg text-center transition cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 text-[11px] ${
            activeTab === "password"
              ? "bg-white text-[#8C6D37] font-semibold shadow-xs"
              : "text-[#57534E] hover:text-[#1C1917]"
          }`}
        >
          <KeyRound size={12} />
          <span>Mật khẩu</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("bookings")}
          className={`py-1.5 px-1 rounded-lg text-center transition cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 text-[11px] ${
            activeTab === "bookings"
              ? "bg-white text-[#8C6D37] font-semibold shadow-xs"
              : "text-[#57534E] hover:text-[#1C1917]"
          }`}
        >
          <Calendar size={12} />
          <span>Đơn đặt ({reservations.length})</span>
        </button>
      </div>

      {/* DROPDOWN CONTENT BODY */}
      <div className="p-3.5 sm:p-4 max-h-[460px] sm:max-h-[520px] overflow-y-auto space-y-3">
        {loadingProfile && activeTab === "overview" ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="w-6 h-6 border-2 border-[#8C6D37] border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs text-[#78716C]">Đang tải thông tin...</p>
          </div>
        ) : profileError && activeTab === "overview" ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{profileError}</span>
          </div>
        ) : null}

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-2.5">
            <div className="bg-white rounded-xl p-3 border border-[#E7E2D6] space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-stone-100">
                <span className="text-stone-500 flex items-center gap-1.5">
                  <User size={12} className="text-[#8C6D37]" /> Họ và tên
                </span>
                <span className="font-semibold text-[#1C1917]">
                  {profile?.guest?.full_name || "Chưa cập nhật"}
                </span>
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-stone-100">
                <span className="text-stone-500 flex items-center gap-1.5">
                  <Shield size={12} className="text-[#8C6D37]" /> CCCD / Hộ chiếu
                </span>
                <span className="font-mono text-[#1C1917]">
                  {profile?.guest?.identity_number || "Chưa cập nhật"}
                </span>
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-stone-100">
                <span className="text-stone-500 flex items-center gap-1.5">
                  <Clock size={12} className="text-[#8C6D37]" /> Năm sinh
                </span>
                <span className="text-[#1C1917]">
                  {profile?.guest?.birth_year || "Chưa cập nhật"}
                </span>
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-stone-100">
                <span className="text-stone-500 flex items-center gap-1.5">
                  <Mail size={12} className="text-[#8C6D37]" /> Email
                </span>
                <span className="text-[#1C1917] truncate max-w-[170px]" title={profile?.guest?.email || ""}>
                  {profile?.guest?.email || "Chưa cập nhật"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-stone-500 flex items-center gap-1.5">
                  <MapPin size={12} className="text-[#8C6D37]" /> Địa chỉ
                </span>
                <span className="text-[#1C1917] truncate max-w-[170px]" title={profile?.guest?.address || ""}>
                  {profile?.guest?.address || "Chưa cập nhật"}
                </span>
              </div>
            </div>

            {/* Quick Action Shortcuts */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActiveTab("edit")}
                className="py-2 px-2.5 rounded-xl border border-[#8C6D37]/30 bg-[#8C6D37]/10 hover:bg-[#8C6D37]/20 text-xs font-semibold text-[#8C6D37] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Edit3 size={13} />
                <span>Sửa thông tin</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("password")}
                className="py-2 px-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-[#1C1917] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <KeyRound size={13} className="text-[#8C6D37]" />
                <span>Đổi mật khẩu</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: EDIT PROFILE */}
        {activeTab === "edit" && (
          <form onSubmit={handleSaveProfile} className="space-y-2.5">
            {editSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>{editSuccess}</span>
              </div>
            )}
            {editError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-1.5">
                <AlertCircle size={14} className="text-red-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-[#57534E] mb-1">
                Họ và tên *
              </label>
              <input
                type="text"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="VD: Nguyễn Văn A"
                className="w-full text-xs px-3 py-2 bg-white border border-[#DDD6C8] rounded-xl focus:outline-none focus:border-[#8C6D37] focus:ring-1 focus:ring-[#8C6D37]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-[#57534E] mb-1">
                  CCCD / Hộ chiếu *
                </label>
                <input
                  type="text"
                  value={editIdNumber}
                  onChange={(e) => setEditIdNumber(e.target.value)}
                  placeholder="048099001234"
                  className="w-full text-xs px-3 py-2 bg-white border border-[#DDD6C8] rounded-xl focus:outline-none focus:border-[#8C6D37] font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#57534E] mb-1">
                  Năm sinh
                </label>
                <input
                  type="number"
                  min="1920"
                  max="2020"
                  value={editBirthYear}
                  onChange={(e) => setEditBirthYear(e.target.value)}
                  placeholder="1990"
                  className="w-full text-xs px-3 py-2 bg-white border border-[#DDD6C8] rounded-xl focus:outline-none focus:border-[#8C6D37]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#57534E] mb-1">Email</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="khachhang@email.com"
                className="w-full text-xs px-3 py-2 bg-white border border-[#DDD6C8] rounded-xl focus:outline-none focus:border-[#8C6D37]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#57534E] mb-1">Địa chỉ</label>
              <input
                type="text"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="VD: Hải Châu, Đà Nẵng"
                className="w-full text-xs px-3 py-2 bg-white border border-[#DDD6C8] rounded-xl focus:outline-none focus:border-[#8C6D37]"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className="w-1/3 py-2 text-xs font-semibold text-[#57534E] bg-[#EDE8E0] hover:bg-[#DDD6C8] rounded-xl transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="flex-1 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#8C6D37] rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                {savingEdit ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <span>Lưu thay đổi</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: CHANGE PASSWORD */}
        {activeTab === "password" && (
          <form onSubmit={handleChangePassword} className="space-y-2.5">
            {pwSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>{pwSuccess}</span>
              </div>
            )}
            {pwError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-1.5">
                <AlertCircle size={14} className="text-red-600 shrink-0" />
                <span>{pwError}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-[#57534E] mb-1">
                Mật khẩu mới (tối thiểu 8 ký tự) *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới"
                  className="w-full text-xs px-3 py-2 pr-9 bg-white border border-[#DDD6C8] rounded-xl focus:outline-none focus:border-[#8C6D37]"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#57534E] mb-1">
                Xác nhận mật khẩu mới *
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className="w-full text-xs px-3 py-2 bg-white border border-[#DDD6C8] rounded-xl focus:outline-none focus:border-[#8C6D37]"
                required
                minLength={8}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className="w-1/3 py-2 text-xs font-semibold text-[#57534E] bg-[#EDE8E0] hover:bg-[#DDD6C8] rounded-xl transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={savingPw}
                className="flex-1 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#8C6D37] rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                {savingPw ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang cập nhật...</span>
                  </>
                ) : (
                  <span>Cập nhật mật khẩu</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: BOOKINGS HISTORY */}
        {activeTab === "bookings" && (
          <div className="space-y-3">
            {/* Filter pills */}
            <div className="flex items-center gap-1.5 pb-1 border-b border-[#E7E2D6] text-[11px] overflow-x-auto">
              <button
                type="button"
                onClick={() => setBookingFilter("all")}
                className={`px-2.5 py-1 rounded-full font-medium transition cursor-pointer shrink-0 ${
                  bookingFilter === "all"
                    ? "bg-[#1C1917] text-white shadow-xs"
                    : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
                }`}
              >
                Tất cả ({reservations.length})
              </button>
              <button
                type="button"
                onClick={() => setBookingFilter("active")}
                className={`px-2.5 py-1 rounded-full font-medium transition cursor-pointer shrink-0 ${
                  bookingFilter === "active"
                    ? "bg-[#8C6D37] text-white shadow-xs"
                    : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
                }`}
              >
                Hiện tại / Sắp tới (
                {
                  reservations.filter((r) =>
                    ["DRAFT", "DEPOSIT_PAID", "CONFIRMED", "CHECKED_IN"].includes(r.status)
                  ).length
                }
                )
              </button>
              <button
                type="button"
                onClick={() => setBookingFilter("past")}
                className={`px-2.5 py-1 rounded-full font-medium transition cursor-pointer shrink-0 ${
                  bookingFilter === "past"
                    ? "bg-[#57534E] text-white shadow-xs"
                    : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
                }`}
              >
                Lịch sử (
                {
                  reservations.filter((r) =>
                    ["CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(r.status)
                  ).length
                }
                )
              </button>
            </div>

            {loadingReservations ? (
              <div className="py-10 flex flex-col items-center justify-center text-center">
                <div className="w-7 h-7 border-2 border-[#8C6D37] border-t-transparent rounded-full animate-spin mb-2.5" />
                <p className="text-xs text-[#78716C]">Đang tải danh sách đặt phòng & dịch vụ...</p>
              </div>
            ) : reservations.filter((r) => {
                if (bookingFilter === "active") {
                  return ["DRAFT", "DEPOSIT_PAID", "CONFIRMED", "CHECKED_IN"].includes(r.status);
                }
                if (bookingFilter === "past") {
                  return ["CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(r.status);
                }
                return true;
              }).length === 0 ? (
              <div className="py-10 text-center bg-white rounded-2xl border border-stone-200 p-6 space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#FAF5EB] text-[#8C6D37] flex items-center justify-center mx-auto mb-1 border border-[#8C6D37]/20">
                  <BedDouble size={24} />
                </div>
                <p className="text-sm font-semibold text-[#1C1917]">
                  {bookingFilter === "all"
                    ? "Chưa có đơn đặt phòng nào"
                    : bookingFilter === "active"
                    ? "Không có đơn đặt phòng nào đang hoạt động"
                    : "Chưa có lịch sử lưu trú"}
                </p>
                <p className="text-xs text-stone-500 max-w-xs mx-auto">
                  Các kỳ nghỉ và dịch vụ ẩm thực, tiện ích bạn đặt tại khách sạn sẽ được cập nhật đầy đủ tại đây.
                </p>
              </div>
            ) : (
              reservations
                .filter((r) => {
                  if (bookingFilter === "active") {
                    return ["DRAFT", "DEPOSIT_PAID", "CONFIRMED", "CHECKED_IN"].includes(r.status);
                  }
                  if (bookingFilter === "past") {
                    return ["CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(r.status);
                  }
                  return true;
                })
                .map((res) => {
                  const isExpanded = expandedResId === res.id;
                  const statusMeta = getReservationStatusMeta(res);
                  const primaryRoom = res.rooms?.[0];
                  const totalRooms = res.rooms?.length || 1;
                  const totalAmount =
                    res.total_amount && res.total_amount > 0
                      ? res.total_amount
                      : res.deposit_amount
                      ? res.deposit_amount * 2
                      : 0;
                  const staySummary = calculateStaySummary(
                    primaryRoom?.expected_check_in,
                    primaryRoom?.expected_check_out,
                    res.rental_type
                  );
                  const servicesCount = res.services?.length || 0;

                  return (
                    <div
                      key={res.id}
                      className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs ${
                        isExpanded
                          ? "border-[#8C6D37]/60 ring-1 ring-[#8C6D37]/20"
                          : "border-[#E7E2D6] hover:border-[#8C6D37]/40"
                      }`}
                    >
                      {/* CARD HEADER (Clickable to toggle) */}
                      <div
                        onClick={() => setExpandedResId(isExpanded ? null : res.id)}
                        className="p-3.5 cursor-pointer hover:bg-stone-50/60 transition select-none space-y-2"
                      >
                        {/* Line 1: Code, Rental type & Status badge */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-[#1C1917] tracking-tight">
                              #BK-{res.id}
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FAF5EB] text-[#8C6D37] border border-[#8C6D37]/20">
                              {res.rental_type === "HOURLY" ? "Thuê theo giờ" : "Thuê theo đêm"}
                            </span>
                          </div>

                          {/* Status Badge */}
                          <div
                            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusMeta.badgeClass}`}
                            title={statusMeta.desc}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                            <span>{statusMeta.label}</span>
                          </div>
                        </div>

                        {/* Line 2: Room info & Total Amount */}
                        <div className="flex items-start justify-between gap-2 pt-0.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1C1917]">
                              <BedDouble size={14} className="text-[#8C6D37] shrink-0" />
                              <span className="truncate">
                                {res.rooms?.map((r) => r.room_name || `Phòng ${r.room_id}`).join(", ") ||
                                  `Phòng ${primaryRoom?.room_id || "—"}`}
                              </span>
                              {totalRooms > 1 && (
                                <span className="text-[10px] text-stone-500 font-normal">
                                  ({totalRooms} phòng)
                                </span>
                              )}
                            </div>
                            {primaryRoom?.room_type_name && (
                              <p className="text-[11px] text-stone-500 pl-5 truncate">
                                Hạng phòng: {primaryRoom.room_type_name}
                              </p>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-stone-400 block uppercase font-medium">Tổng tiền</span>
                            <span className="text-sm font-bold text-[#8C6D37] font-mono">
                              {fmtVND(totalAmount)}
                            </span>
                          </div>
                        </div>

                        {/* Line 3: Dates + Services indicator + Expand button */}
                        <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1 border-t border-stone-100">
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className="text-stone-400 shrink-0" />
                            <span>
                              {primaryRoom?.expected_check_in
                                ? `${formatDateVi(primaryRoom.expected_check_in)} → ${formatDateVi(primaryRoom.expected_check_out)}`
                                : formatDateVi(res.booked_at)}
                              {staySummary ? ` (${staySummary})` : ""}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {servicesCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <UtensilsCrossed size={10} />
                                <span>{servicesCount} dịch vụ</span>
                              </span>
                            )}
                            <span className="text-stone-400 hover:text-[#8C6D37] transition flex items-center gap-0.5 text-[11px] font-medium">
                              <span>{isExpanded ? "Thu gọn" : "Chi tiết"}</span>
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* EXPANDED DETAILS ACCORDION */}
                      {isExpanded && (
                        <div className="p-3.5 bg-[#FAF8F5] border-t border-[#E7E2D6] space-y-3 text-xs animate-in fade-in duration-150">
                          {cancelError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-700">{cancelError}</p>}
                          {/* Status detail callout */}
                          {statusMeta.desc && (
                            <div className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${statusMeta.badgeClass}`}>
                              <Info size={13} className="shrink-0 mt-0.5" />
                              <span>{statusMeta.desc}</span>
                            </div>
                          )}
                          {res.status === "CANCELLED" && res.cancellation_outcome && (
                            <div className={`rounded-xl border p-2.5 text-[11px] ${res.cancellation_outcome === "REFUND" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
                              <strong>{res.cancellation_outcome === "REFUND" ? "Được hoàn toàn bộ tiền cọc" : res.cancellation_outcome === "FORFEIT" ? "Tiền cọc không được hoàn" : "Không phát sinh hoàn tiền"}</strong>
                              {res.cancellation_reason ? <span className="mt-1 block">Lý do: {res.cancellation_reason}</span> : null}
                            </div>
                          )}

                          {/* General info */}
                          <div className="flex items-center justify-between text-[11px] text-stone-500 bg-white p-2.5 rounded-xl border border-stone-200/80">
                            <span>
                              Ngày tạo đơn: <strong className="text-stone-800">{formatDateTimeVi(res.booked_at)}</strong>
                            </span>
                            <span>
                              Kênh đặt: <strong className="text-stone-800">{res.booking_source || "Website"}</strong>
                            </span>
                          </div>

                          {/* SECTION 1: ROOMS BREAKDOWN */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1C1917]">
                              <BedDouble size={13} className="text-[#8C6D37]" />
                              <span>Phòng đã đặt ({res.rooms?.length || 0})</span>
                            </div>

                            {res.rooms?.map((room, idx) => (
                              <div
                                key={room.room_id || idx}
                                className="bg-white rounded-xl p-3 border border-[#E7E2D6] space-y-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h4 className="font-semibold text-xs text-[#1C1917]">
                                      {room.room_name || `Phòng ${room.room_id}`}
                                    </h4>
                                    {room.room_type_name && (
                                      <p className="text-[11px] text-stone-500">
                                        Loại phòng: {room.room_type_name}
                                      </p>
                                    )}
                                  </div>
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md">
                                    <Users size={11} />
                                    <span>{room.guest_count || 1} khách</span>
                                  </span>
                                </div>

                                {/* Check-in / Check-out Schedule Grid */}
                                <div className="grid grid-cols-2 gap-2 bg-[#FAF8F5] p-2.5 rounded-lg border border-[#EBE5DA] text-[11px]">
                                  <div>
                                    <span className="text-stone-400 block text-[10px] uppercase font-semibold">
                                      Giờ nhận phòng (Check-in)
                                    </span>
                                    <span className="font-semibold text-[#1C1917] mt-0.5 block">
                                      {formatDateTimeVi(room.expected_check_in)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-stone-400 block text-[10px] uppercase font-semibold">
                                      Giờ trả phòng (Check-out)
                                    </span>
                                    <span className="font-semibold text-[#1C1917] mt-0.5 block">
                                      {formatDateTimeVi(room.expected_check_out)}
                                    </span>
                                  </div>
                                </div>

                                {/* Room Pricing */}
                                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-stone-100">
                                  <span className="text-stone-500">
                                    Thời gian: {calculateStaySummary(room.expected_check_in, room.expected_check_out, res.rental_type)}
                                    {room.unit_price ? ` · ${fmtVND(room.unit_price)}/${res.rental_type === "HOURLY" ? "giờ" : "đêm"}` : ""}
                                  </span>
                                  {room.total_price ? (
                                    <span className="font-semibold text-[#8C6D37]">
                                      {fmtVND(room.total_price)}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* SECTION 2: SERVICES BOOKED */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1C1917]">
                                <UtensilsCrossed size={13} className="text-[#8C6D37]" />
                                <span>Dịch vụ & Trải nghiệm đã đặt ({servicesCount})</span>
                              </div>

                              {onNavigateToServices && ["DRAFT", "DEPOSIT_PAID", "CONFIRMED", "CHECKED_IN"].includes(res.status) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onNavigateToServices();
                                  }}
                                  className="text-[11px] text-[#8C6D37] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Đặt thêm dịch vụ</span>
                                  <ArrowRight size={11} />
                                </button>
                              )}
                            </div>

                            {servicesCount > 0 ? (
                              <div className="space-y-2">
                                {res.services?.map((svc) => {
                                  const svcMeta = getServiceStatusMeta(svc.status);
                                  return (
                                    <div
                                      key={svc.id}
                                      className="bg-white rounded-xl p-3 border border-[#E7E2D6] space-y-1.5"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <h5 className="font-semibold text-xs text-[#1C1917] truncate">
                                            {svc.service_name || svc.service_id}
                                          </h5>
                                          <p className="text-[11px] text-stone-500">
                                            Phục vụ tại: <strong>Phòng {svc.room_id}</strong>
                                            {svc.meal_period ? ` · ${svc.meal_period === "LUNCH" ? "Bữa trưa" : "Bữa tối"}` : ""}
                                          </p>
                                        </div>
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${svcMeta.badgeClass}`}
                                        >
                                          {svcMeta.label}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-stone-100 text-stone-600">
                                        <span>
                                          Thời gian: <strong>{formatDateTimeVi(svc.scheduled_at)}</strong> · {svc.quantity} suất
                                          {svc.free_quantity > 0 ? ` (Miễn phí ${svc.free_quantity})` : ""}
                                        </span>
                                        <span className="font-semibold text-[#8C6D37] shrink-0 font-mono">
                                          {svc.amount_due > 0 ? fmtVND(svc.amount_due) : "Miễn phí"}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="bg-white/80 rounded-xl p-3 border border-dashed border-[#DDD6C8] text-center space-y-1.5">
                                <p className="text-[11px] text-stone-500">
                                  Quý khách chưa đặt dịch vụ ẩm thực hoặc trải nghiệm kèm theo đơn này.
                                </p>
                                {onNavigateToServices && ["DRAFT", "DEPOSIT_PAID", "CONFIRMED", "CHECKED_IN"].includes(res.status) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      onNavigateToServices();
                                    }}
                                    className="px-3 py-1.5 bg-[#FAF5EB] hover:bg-[#F2E8D3] text-[#8C6D37] rounded-lg text-xs font-semibold border border-[#8C6D37]/30 transition cursor-pointer inline-flex items-center gap-1.5"
                                  >
                                    <UtensilsCrossed size={12} />
                                    <span>Xem thực đơn & Đặt dịch vụ</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* SECTION 3: BILLING & DEPOSIT PAYMENT */}
                          <div className="bg-[#FAF5EB] rounded-xl p-3 border border-[#E8DFC9] space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-stone-600">Tổng chi phí dự kiến:</span>
                              <span className="font-bold text-sm text-[#1C1917] font-mono">
                                {fmtVND(totalAmount)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-[#E8DFC9]">
                              <span className="text-stone-600">Tiền đặt cọc phòng:</span>
                              <div className="text-right">
                                <span className="font-bold text-xs text-[#8C6D37] font-mono">
                                  {fmtVND(res.deposit_amount || 0)}
                                </span>
                                <span className="block text-[10px] text-stone-500">
                                  {res.pending_change
                                    ? "✓ Đã cọc ban đầu · chờ cọc bổ sung"
                                    : res.deposit_payment?.status === "PAID"
                                    ? "✓ Đã thanh toán cọc"
                                    : res.deposit_payment?.status === "PENDING"
                                    ? "⏳ Chờ thanh toán cọc"
                                    : "Chờ xác nhận cọc tại khách sạn"}
                                </span>
                              </div>
                            </div>

                            {/* Retry VNPay trên cùng booking trong thời gian giữ phòng. */}
                            {!res.pending_change && (res.status === "DRAFT" || res.deposit_payment?.status === "PENDING") && res.deposit_payment?.payment_code && (
                              <div className="mt-2 p-2.5 bg-white rounded-lg border border-amber-200 text-[11px] space-y-2 text-amber-900">
                                <div className="flex justify-between items-center text-[10px] text-stone-500 pt-0.5">
                                  <span>{res.pending_change ? "Cọc bổ sung qua VNPay:" : "Tiền cọc qua VNPay:"}</span>
                                  <strong className="text-[#8C6D37]">{fmtVND(res.deposit_payment?.amount || 0)}</strong>
                                </div>

                                {res.deposit_payment?.expires_at && (
                                  <p className="text-[10px] text-amber-700">
                                    Hạn chuyển cọc: {formatDateTimeVi(res.deposit_payment.expires_at)}
                                  </p>
                                )}
                                {onPayReservation && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onClose();
                                      onPayReservation(res.id);
                                    }}
                                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1C1917] px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-[#8C6D37]"
                                  >
                                    <CreditCard size={13} /> Thanh toán qua VNPay
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* SECTION 4: CUSTOMER-OWNED STAY CHANGE */}
                          {changeError && expandedResId === res.id && (
                            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-700">{changeError}</p>
                          )}
                          {changeSuccess && expandedResId === res.id && (
                            <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] text-emerald-800">{changeSuccess}</p>
                          )}

                          {res.pending_change ? (
                            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900">
                              <p className="font-semibold">Đang giữ ngày thêm đến {formatDateTimeVi(res.pending_change.payment_expires_at)}</p>
                              <p className="mt-1 leading-relaxed">
                                Phần lưu trú được nối tiếp từ {formatDateTimeVi(res.pending_change.previous_check_out)} đến {formatDateTimeVi(res.pending_change.new_check_out)}.
                                Cọc bổ sung: <strong>{fmtVND(res.pending_change.additional_deposit)}</strong>.
                              </p>
                              {onPayReservation && (
                                <button
                                  type="button"
                                  onClick={(event) => { event.stopPropagation(); onClose(); onPayReservation(res.id); }}
                                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-900 px-3 py-2 font-semibold text-white transition hover:bg-amber-800"
                                >
                                  <CreditCard size={13} /> Thanh toán cọc bổ sung
                                </button>
                              )}
                            </div>
                          ) : ["DEPOSIT_PAID", "CONFIRMED"].includes(res.status)
                              && res.deposit_payment?.status === "PAID"
                              && res.rental_type === "PACKAGE"
                              && Boolean(res.rooms?.[0]?.expected_check_in)
                              && new Date(res.rooms[0].expected_check_in).getTime() - Date.now() > 48 * 60 * 60 * 1000 ? (
                            <div className="rounded-xl border border-[#D8C7A5] bg-white p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold text-[#1C1917]">Điều chỉnh lịch lưu trú</p>
                                  <p className="mt-0.5 text-[10px] leading-relaxed text-stone-500">Chỉ thực hiện trước check-in hơn 48 giờ và khi phòng còn trống, sẵn sàng.</p>
                                </div>
                                <Calendar size={16} className="shrink-0 text-[#8C6D37]" />
                              </div>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => openStayChange(res, "EXTEND")} className="rounded-lg border border-[#C9AE78] bg-[#FAF5EB] px-2 py-2 text-[11px] font-semibold text-[#755725] hover:bg-[#F2E8D3]">
                                  Thêm ngày
                                </button>
                                <button type="button" onClick={() => openStayChange(res, "RESCHEDULE")} className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-[11px] font-semibold text-stone-700 hover:bg-stone-50">
                                  Đổi ngày
                                </button>
                              </div>

                              {stayChange?.reservationId === res.id && (
                                <div className="mt-3 space-y-2 rounded-lg border border-stone-200 bg-[#FAF8F5] p-2.5">
                                  <p className="text-[11px] font-semibold text-stone-800">
                                    {stayChange.type === "EXTEND" ? "Thêm ngày nối tiếp booking" : "Dời lịch, giữ nguyên số đêm"}
                                  </p>
                                  <label className="block text-[10px] font-medium text-stone-600">
                                    {stayChange.type === "EXTEND" ? "Ngày bắt đầu phần thêm (cố định)" : "Check-in mới"}
                                    <input
                                      aria-label={stayChange.type === "EXTEND" ? "Ngày bắt đầu phần thêm" : "Check-in mới"}
                                      type="datetime-local"
                                      value={changeCheckIn}
                                      readOnly={stayChange.type === "EXTEND"}
                                      onChange={(event) => handleRescheduleCheckIn(res, event.target.value)}
                                      className="mt-1 h-9 w-full rounded-lg border border-stone-300 bg-white px-2 text-[11px] read-only:bg-stone-100"
                                    />
                                  </label>
                                  <label className="block text-[10px] font-medium text-stone-600">
                                    Check-out mới
                                    <input
                                      aria-label="Check-out mới"
                                      type="datetime-local"
                                      min={stayChange.type === "EXTEND" ? changeCheckIn : undefined}
                                      value={changeCheckOut}
                                      readOnly={stayChange.type === "RESCHEDULE"}
                                      onChange={(event) => setChangeCheckOut(event.target.value)}
                                      className="mt-1 h-9 w-full rounded-lg border border-stone-300 bg-white px-2 text-[11px] read-only:bg-stone-100"
                                    />
                                  </label>
                                  <p className="text-[10px] leading-relaxed text-stone-500">
                                    {stayChange.type === "EXTEND"
                                      ? "Phần thêm luôn bắt đầu đúng giờ checkout cũ; hệ thống sẽ tính cọc bổ sung 50%."
                                      : "Check-out được tự tính để giữ nguyên số đêm của booking hiện tại."}
                                  </p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button type="button" onClick={() => setStayChange(null)} className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-[11px] font-semibold text-stone-600">Đóng</button>
                                    <button
                                      type="button"
                                      disabled={changingReservationId === res.id || !changeCheckOut}
                                      onClick={() => void submitStayChange(res)}
                                      className="rounded-lg bg-[#1C1917] px-2 py-2 text-[11px] font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                                    >
                                      {changingReservationId === res.id ? "Đang kiểm tra…" : "Kiểm tra & xác nhận"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : null}

                          {!res.pending_change && ["DRAFT", "DEPOSIT_PAID", "CONFIRMED"].includes(res.status) && (() => {
                            const policy = cancellationPolicy(res);
                            return (
                              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3">
                                <p className="text-[11px] leading-relaxed text-rose-800">{policy.note}</p>
                                <button
                                  type="button"
                                  disabled={cancellingReservationId === res.id}
                                  onClick={() => void handleCancelReservation(res)}
                                  className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60"
                                >
                                  <X size={12} />
                                  {cancellingReservationId === res.id ? "Đang hủy booking…" : policy.label}
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        )}
      </div>

      {/* DROPDOWN FOOTER: Logout button */}
      <div className="p-3 bg-[#F5F2EC] border-t border-[#E7E2D6] flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            onClose();
            onLogout();
          }}
          className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer"
        >
          <LogOut size={13} />
          <span>Đăng xuất tài khoản</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="text-xs text-stone-500 hover:text-stone-800 px-3 py-1.5 rounded-lg hover:bg-stone-200/50 transition cursor-pointer"
        >
          Đóng
        </button>
      </div>
    </div>
  );
};
