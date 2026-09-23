import React, { useState, useEffect } from "react";
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
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  UtensilsCrossed,
  Users,
  Info,
  ArrowRight,
} from "lucide-react";
import { customerApi } from "../../shared/api/customer";
import { authApi } from "../../shared/api/auth";
import type { CustomerProfileDto } from "../../shared/types/api";
import type { CustomerReservation } from "../../shared/types/customer";

interface CustomerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onProfileUpdated?: (name: string) => void;
  onNavigateToServices?: () => void;
}

type TabType = "overview" | "edit" | "password" | "bookings";

const fmtVND = (n: number) => (n ?? 0).toLocaleString("vi-VN") + " ₫";

const formatDateTimeVi = (isoString?: string) => {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString.replace("T", " ").slice(0, 16);
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${hours}:${mins}, ${day}/${month}/${year}`;
  } catch {
    return isoString.replace("T", " ").slice(0, 16);
  }
};

const formatDateVi = (isoString?: string) => {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString.slice(0, 10);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return isoString.slice(0, 10);
  }
};

const getReservationStatusMeta = (status: string) => {
  switch (status?.toUpperCase()) {
    case "DRAFT":
      return {
        label: "Chờ thanh toán cọc",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
        dotClass: "bg-amber-500",
        desc: "Đơn đang giữ phòng, vui lòng hoàn tất chuyển khoản tiền cọc.",
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
        desc: "Đơn đặt phòng đã được xác nhận chính thức.",
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

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({
  isOpen,
  onClose,
  onLogout,
  onProfileUpdated,
  onNavigateToServices,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Profile data
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

  // Bookings list state
  const [reservations, setReservations] = useState<CustomerReservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [bookingFilter, setBookingFilter] = useState<"all" | "active" | "past">("all");
  const [expandedResId, setExpandedResId] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    try {
      navigator.clipboard?.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // ignore
    }
  };

  // Load profile from API and merge local overrides
  useEffect(() => {
    if (!isOpen) return;
    setLoadingProfile(true);
    setProfileError("");

    authApi.customerProfile()
      .then((data) => {
        // Read local overrides if any
        try {
          const stored = localStorage.getItem("mam_customer_custom_profile");
          if (stored) {
            const parsed = JSON.parse(stored);
            data = {
              ...data,
              guest: {
                ...data.guest,
                ...parsed,
              },
            };
          }
        } catch {
          // ignore parsing error
        }

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
    customerApi.reservations()
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

  const handleSaveProfile = (e: React.FormEvent) => {
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
      const overrides = {
        full_name: editFullName.trim(),
        email: editEmail.trim() || undefined,
        identity_number: editIdNumber.trim(),
        address: editAddress.trim() || undefined,
        birth_year: editBirthYear.trim() ? Number(editBirthYear.trim()) : undefined,
      };

      localStorage.setItem("mam_customer_custom_profile", JSON.stringify(overrides));

      if (profile) {
        setProfile({
          ...profile,
          guest: {
            ...profile.guest,
            ...overrides,
          },
        });
      }

      onProfileUpdated?.(editFullName.trim());
      setEditSuccess("Cập nhật thông tin hồ sơ thành công!");
      setTimeout(() => setEditSuccess(""), 3000);
    } catch {
      setEditError("Có lỗi xảy ra khi lưu thông tin.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setPwError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setPwError("");
    setSavingPw(true);

    try {
      await customerApi.changePassword(newPassword);
      setPwSuccess("Đổi mật khẩu thành công! Mật khẩu mới đã được cập nhật.");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwSuccess(""), 4000);
    } catch (err) {
      console.warn("Change password failed:", err);
      setPwError("Đổi mật khẩu thất bại. Vui lòng thử lại.");
    } finally {
      setSavingPw(false);
    }
  };

  const guest = profile?.guest;
  const account = profile?.account;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-xl bg-[#FAF8F5] rounded-3xl overflow-hidden shadow-2xl border border-[#E2DDD4] flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-br from-[#1C1917] via-[#241F1A] to-[#141210] text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer"
          >
            <X size={16} />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#D4AF6E] to-[#8C6D37] p-0.5 shadow-md shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#1C1917] flex items-center justify-center text-[#E6CA85] font-display text-xl font-bold">
                {guest?.full_name ? guest.full_name.charAt(0).toUpperCase() : "K"}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-2xl text-white font-normal truncate">
                  {guest?.full_name || "Quý khách hàng"}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-[#8C6D37]/30 text-[#E6CA85] border border-[#8C6D37]/50 shrink-0">
                  {guest?.membership_tier || "STANDARD"}
                </span>
              </div>
              <p className="text-xs text-white/60 font-light mt-0.5 flex items-center gap-2">
                <span>{account?.phone || guest?.phone || "—"}</span>
                <span>·</span>
                <span className="text-emerald-400 font-medium">Tài khoản bảo mật</span>
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {[
              { id: "overview", label: "Hồ sơ", icon: User },
              { id: "edit", label: "Sửa thông tin", icon: Edit3 },
              { id: "password", label: "Đổi mật khẩu", icon: KeyRound },
              { id: "bookings", label: `Đơn đặt chỗ (${reservations.length})`, icon: Calendar },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    isActive
                      ? "bg-[#8C6D37] text-white shadow-sm"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {profileError && (
            <div className="p-3.5 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          {/* ── TAB 1: OVERVIEW ── */}
          {activeTab === "overview" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {loadingProfile ? (
                <div className="py-12 text-center text-xs text-[#78716C]">
                  Đang tải thông tin hồ sơ...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E7E2D6] shadow-2xs">
                      <span className="text-[10px] uppercase tracking-wider text-[#8C827A] block mb-1">
                        Họ và tên
                      </span>
                      <span className="text-sm font-semibold text-[#1C1917] block">
                        {guest?.full_name || "Chưa cập nhật"}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white border border-[#E7E2D6] shadow-2xs">
                      <span className="text-[10px] uppercase tracking-wider text-[#8C827A] block mb-1">
                        Số điện thoại
                      </span>
                      <span className="text-sm font-semibold text-[#1C1917] block">
                        {account?.phone || guest?.phone || "Chưa cập nhật"}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white border border-[#E7E2D6] shadow-2xs">
                      <span className="text-[10px] uppercase tracking-wider text-[#8C827A] block mb-1">
                        Số CCCD / Hộ chiếu
                      </span>
                      <span className="text-sm font-semibold text-[#1C1917] block">
                        {guest?.identity_number || "Chưa cập nhật"}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white border border-[#E7E2D6] shadow-2xs">
                      <span className="text-[10px] uppercase tracking-wider text-[#8C827A] block mb-1">
                        Email liên hệ
                      </span>
                      <span className="text-sm font-semibold text-[#1C1917] block truncate">
                        {guest?.email || "Chưa thiết lập email"}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white border border-[#E7E2D6] shadow-2xs">
                      <span className="text-[10px] uppercase tracking-wider text-[#8C827A] block mb-1">
                        Năm sinh
                      </span>
                      <span className="text-sm font-semibold text-[#1C1917] block">
                        {guest?.birth_year || "Chưa thiết lập"}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white border border-[#E7E2D6] shadow-2xs">
                      <span className="text-[10px] uppercase tracking-wider text-[#8C827A] block mb-1">
                        Địa chỉ thường trú
                      </span>
                      <span className="text-sm font-semibold text-[#1C1917] block truncate">
                        {guest?.address || "Chưa thiết lập"}
                      </span>
                    </div>
                  </div>

                  {/* Privileges & Loyalty Card */}
                  <div className="p-4 rounded-2xl bg-[#F4F1EA] border border-[#E4DEC4] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#8C6D37]/15 text-[#8C6D37] flex items-center justify-center">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <span className="text-xs uppercase tracking-wider font-semibold text-[#8C6D37] block">
                          Đặc quyền thành viên MaM Hotel
                        </span>
                        <span className="text-xs text-[#57534E]">
                          Tổng chi tiêu tích lũy:{" "}
                          <strong className="text-[#1C1917]">
                            {fmtVND(Number(guest?.total_spend ?? 0))}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab("edit")}
                      className="px-3.5 py-1.5 bg-white hover:bg-[#FAF8F5] border border-[#DDD5C7] rounded-xl text-xs font-semibold text-[#1C1917] transition cursor-pointer"
                    >
                      Sửa hồ sơ
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── TAB 2: EDIT PROFILE ── */}
          {activeTab === "edit" && (
            <form onSubmit={handleSaveProfile} className="space-y-4 animate-in fade-in duration-200">
              {editSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <span>{editSuccess}</span>
                </div>
              )}
              {editError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-red-600" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#78716C] mb-1.5">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Nhập họ và tên đầy đủ"
                  className="w-full px-4 py-2.5 bg-white border border-[#DDD5C7] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#8C6D37]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#78716C] mb-1.5">
                    Số CCCD / Hộ chiếu *
                  </label>
                  <input
                    type="text"
                    required
                    value={editIdNumber}
                    onChange={(e) => setEditIdNumber(e.target.value)}
                    placeholder="Số CCCD hoặc hộ chiếu"
                    className="w-full px-4 py-2.5 bg-white border border-[#DDD5C7] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#8C6D37]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#78716C] mb-1.5">
                    Năm sinh
                  </label>
                  <input
                    type="number"
                    min="1920"
                    max="2020"
                    value={editBirthYear}
                    onChange={(e) => setEditBirthYear(e.target.value)}
                    placeholder="Ví dụ: 1990"
                    className="w-full px-4 py-2.5 bg-white border border-[#DDD5C7] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#8C6D37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#78716C] mb-1.5">
                  Email nhận hóa đơn &amp; xác nhận đặt phòng
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="khachhang@email.com"
                  className="w-full px-4 py-2.5 bg-white border border-[#DDD5C7] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#8C6D37]"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#78716C] mb-1.5">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Địa chỉ cư trú hiện tại"
                  className="w-full px-4 py-2.5 bg-white border border-[#DDD5C7] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#8C6D37]"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-6 py-2.5 bg-[#1C1917] hover:bg-[#8C6D37] text-white text-xs uppercase tracking-wider font-semibold rounded-xl transition cursor-pointer shadow-md"
                >
                  {savingEdit ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          )}

          {/* ── TAB 3: CHANGE PASSWORD ── */}
          {activeTab === "password" && (
            <form onSubmit={handleChangePassword} className="space-y-4 animate-in fade-in duration-200">
              {pwSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <span>{pwSuccess}</span>
                </div>
              )}
              {pwError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-red-600" />
                  <span>{pwError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#78716C] mb-1.5">
                  Mật khẩu mới (Tối thiểu 8 ký tự) *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới"
                    className="w-full pl-4 pr-11 py-2.5 bg-white border border-[#DDD5C7] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#8C6D37]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#78716C] hover:text-[#1C1917] cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#78716C] mb-1.5">
                  Xác nhận mật khẩu mới *
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full px-4 py-2.5 bg-white border border-[#DDD5C7] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#8C6D37]"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPw}
                  className="px-6 py-2.5 bg-[#1C1917] hover:bg-[#8C6D37] text-white text-xs uppercase tracking-wider font-semibold rounded-xl transition cursor-pointer shadow-md"
                >
                  {savingPw ? "Đang xử lý..." : "Cập nhật mật khẩu"}
                </button>
              </div>
            </form>
          )}

          {/* ── TAB 4: BOOKINGS ── */}
          {activeTab === "bookings" && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* Filter pills */}
              <div className="flex items-center gap-1.5 pb-1 border-b border-[#E7E2D6] text-[11px] overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setBookingFilter("all")}
                  className={`px-3 py-1 rounded-full font-medium transition cursor-pointer shrink-0 ${
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
                  className={`px-3 py-1 rounded-full font-medium transition cursor-pointer shrink-0 ${
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
                  className={`px-3 py-1 rounded-full font-medium transition cursor-pointer shrink-0 ${
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
                <div className="py-12 flex flex-col items-center justify-center text-center">
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
                <div className="py-12 text-center bg-white rounded-2xl border border-[#E7E2D6] p-6 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[#FAF5EB] text-[#8C6D37] flex items-center justify-center mx-auto mb-1 border border-[#8C6D37]/20">
                    <BedDouble size={28} />
                  </div>
                  <p className="text-sm font-semibold text-[#1C1917]">
                    {bookingFilter === "all"
                      ? "Quý khách chưa có đơn đặt chỗ nào"
                      : bookingFilter === "active"
                      ? "Không có đơn đặt phòng nào đang hoạt động"
                      : "Chưa có lịch sử lưu trú"}
                  </p>
                  <p className="text-xs text-[#78716C] max-w-sm mx-auto">
                    Các phòng và dịch vụ ẩm thực, trải nghiệm quý khách đặt sẽ hiển thị chi tiết tại đây.
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
                    const statusMeta = getReservationStatusMeta(res.status);
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
                        {/* Header */}
                        <div
                          onClick={() => setExpandedResId(isExpanded ? null : res.id)}
                          className="p-4 cursor-pointer hover:bg-stone-50/60 transition select-none space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-[#1C1917]">
                                #BK-{res.id}
                              </span>
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FAF5EB] text-[#8C6D37] border border-[#8C6D37]/20">
                                {res.rental_type === "HOURLY" ? "Theo giờ" : "Trọn gói"}
                              </span>
                            </div>

                            <div
                              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusMeta.badgeClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                              <span>{statusMeta.label}</span>
                            </div>
                          </div>

                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1C1917]">
                                <BedDouble size={14} className="text-[#8C6D37] shrink-0" />
                                <span>
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
                                <p className="text-[11px] text-stone-500 pl-5">
                                  Hạng: {primaryRoom.room_type_name}
                                </p>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-stone-400 block uppercase">Tổng tiền</span>
                              <span className="text-sm font-bold text-[#8C6D37] font-mono">
                                {fmtVND(totalAmount)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1.5 border-t border-stone-100">
                            <div className="flex items-center gap-1.5">
                              <Clock size={12} className="text-stone-400" />
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
                              <span className="text-stone-400 hover:text-[#8C6D37] transition flex items-center gap-0.5 text-xs">
                                <span>{isExpanded ? "Thu gọn" : "Chi tiết"}</span>
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="p-4 bg-[#FAF8F5] border-t border-[#E7E2D6] space-y-3.5 text-xs animate-in fade-in duration-150">
                            {statusMeta.desc && (
                              <div className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${statusMeta.badgeClass}`}>
                                <Info size={14} className="shrink-0 mt-0.5" />
                                <span>{statusMeta.desc}</span>
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[11px] text-stone-500 bg-white p-2.5 rounded-xl border border-stone-200">
                              <span>Ngày tạo: <strong>{formatDateTimeVi(res.booked_at)}</strong></span>
                              <span>Kênh: <strong>{res.booking_source || "Website"}</strong></span>
                            </div>

                            {/* Rooms */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1C1917]">
                                <BedDouble size={14} className="text-[#8C6D37]" />
                                <span>Không gian lưu trú ({res.rooms?.length || 0})</span>
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
                                          Hạng: {room.room_type_name}
                                        </p>
                                      )}
                                    </div>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md">
                                      <Users size={11} />
                                      <span>{room.guest_count || 1} khách</span>
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 bg-[#FAF8F5] p-2.5 rounded-lg border border-[#EBE5DA] text-[11px]">
                                    <div>
                                      <span className="text-stone-400 block text-[10px] uppercase font-semibold">
                                        Check-in
                                      </span>
                                      <span className="font-semibold text-[#1C1917] mt-0.5 block">
                                        {formatDateTimeVi(room.expected_check_in)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-stone-400 block text-[10px] uppercase font-semibold">
                                        Check-out
                                      </span>
                                      <span className="font-semibold text-[#1C1917] mt-0.5 block">
                                        {formatDateTimeVi(room.expected_check_out)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-stone-100">
                                    <span className="text-stone-500">
                                      Thời lượng: {calculateStaySummary(room.expected_check_in, room.expected_check_out, res.rental_type)}
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

                            {/* Services */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1C1917]">
                                  <UtensilsCrossed size={14} className="text-[#8C6D37]" />
                                  <span>Dịch vụ & Trải nghiệm ({servicesCount})</span>
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
                                          <div>
                                            <h5 className="font-semibold text-xs text-[#1C1917]">
                                              {svc.service_name || svc.service_id}
                                            </h5>
                                            <p className="text-[11px] text-stone-500">
                                              Phục vụ tại: <strong>Phòng {svc.room_id}</strong>
                                              {svc.meal_period ? ` · ${svc.meal_period === "LUNCH" ? "Bữa trưa" : "Bữa tối"}` : ""}
                                            </p>
                                          </div>
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${svcMeta.badgeClass}`}>
                                            {svcMeta.label}
                                          </span>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-stone-100 text-stone-600">
                                          <span>
                                            Thời gian: <strong>{formatDateTimeVi(svc.scheduled_at)}</strong> · {svc.quantity} suất
                                            {svc.free_quantity > 0 ? ` (Miễn phí ${svc.free_quantity})` : ""}
                                          </span>
                                          <span className="font-semibold text-[#8C6D37] font-mono">
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
                                </div>
                              )}
                            </div>

                            {/* Billing & Deposit */}
                            <div className="bg-[#FAF5EB] rounded-xl p-3 border border-[#E8DFC9] space-y-2">
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
                                    {res.deposit_payment?.status === "PAID"
                                      ? "✓ Đã thanh toán cọc"
                                      : res.deposit_payment?.status === "PENDING"
                                      ? "⏳ Chờ thanh toán cọc"
                                      : "Không yêu cầu cọc"}
                                  </span>
                                </div>
                              </div>

                              {(res.status === "DRAFT" || res.deposit_payment?.status === "PENDING") && res.deposit_payment?.payment_code && (
                                <div className="mt-2 p-2.5 bg-white rounded-lg border border-amber-200 text-[11px] space-y-1.5 text-amber-900">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-amber-800 flex items-center gap-1">
                                      <AlertCircle size={12} className="text-amber-600" />
                                      Nội dung chuyển khoản cọc:
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopyCode(res.deposit_payment.payment_code);
                                      }}
                                      className="text-[10px] font-semibold text-[#8C6D37] hover:underline flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-300/60 cursor-pointer"
                                    >
                                      {copiedCode === res.deposit_payment.payment_code ? (
                                        <>
                                          <Check size={11} className="text-emerald-600" />
                                          <span className="text-emerald-700">Đã chép</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy size={11} />
                                          <span>Sao chép</span>
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  <div className="font-mono text-xs font-bold text-[#1C1917] bg-[#FAF8F5] p-1.5 rounded border border-stone-200 text-center tracking-wider select-all">
                                    {res.deposit_payment.payment_code}
                                  </div>

                                  <div className="flex justify-between items-center text-[10px] text-stone-500 pt-0.5">
                                    <span>Số tiền cọc:</span>
                                    <strong className="text-[#8C6D37]">{fmtVND(res.deposit_amount || 0)}</strong>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#FAF6EE] border-t border-[#EAE4D8] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-semibold cursor-pointer transition"
          >
            <LogOut size={14} />
            <span>Đăng xuất tài khoản</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white hover:bg-[#F2ECE1] border border-[#DDD5C7] rounded-xl text-xs font-semibold text-[#1C1917] transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerProfileModal;
