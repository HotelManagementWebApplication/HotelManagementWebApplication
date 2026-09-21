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
} from "lucide-react";
import { customerApi } from "../../shared/api/customer";
import { authApi } from "../../shared/api/auth";
import type { CustomerProfileDto } from "../../shared/types/api";
import type { CustomerReservation } from "../../shared/types/customer";

interface CustomerProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onProfileUpdated?: (name: string) => void;
}

type TabType = "overview" | "edit" | "password" | "bookings";

const fmtVND = (n: number) => n.toLocaleString("vi-VN") + " ₫";

export const CustomerProfileDropdown: React.FC<CustomerProfileDropdownProps> = ({
  isOpen,
  onClose,
  onLogout,
  onProfileUpdated,
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
        if (Array.isArray(resList)) setReservations(resList);
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
      setEditSuccess("Cập nhật thông tin vào cơ sở dữ liệu thành công!");
      setTimeout(() => {
        setEditSuccess("");
        setActiveTab("overview");
      }, 1200);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setEditError(apiErr?.message || "Không thể lưu thông tin vào cơ sở dữ liệu. Vui lòng thử lại.");
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
      setPwError(apiErr?.message || "Đổi mật khẩu thất bại. Vui lòng thử lại.");
    } finally {
      setSavingPw(false);
    }
  };

  const tierBadgeColor = (tier: string) => {
    switch (tier?.toUpperCase()) {
      case "DIAMOND":
        return "bg-cyan-500/15 text-cyan-700 border-cyan-300";
      case "GOLD":
        return "bg-amber-500/15 text-amber-700 border-amber-300";
      case "SILVER":
        return "bg-slate-400/15 text-slate-700 border-slate-300";
      default:
        return "bg-[#8C6D37]/15 text-[#8C6D37] border-[#8C6D37]/30";
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2.5 w-[340px] sm:w-[410px] bg-[#FAF8F5] rounded-2xl shadow-2xl border border-[#E7E2D6] z-50 overflow-hidden flex flex-col text-[#1C1917] animate-in fade-in slide-in-from-top-2 duration-150"
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
                  {profile?.guest?.membership_tier || "STANDARD"}
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
      <div className="p-4 max-h-[380px] overflow-y-auto space-y-3">
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
          <div className="space-y-2">
            {loadingReservations ? (
              <div className="py-6 flex flex-col items-center justify-center text-center">
                <div className="w-6 h-6 border-2 border-[#8C6D37] border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-[#78716C]">Đang tải danh sách đặt phòng...</p>
              </div>
            ) : reservations.length === 0 ? (
              <div className="py-8 text-center bg-white rounded-xl border border-stone-200 p-4">
                <BedDouble size={24} className="text-stone-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-stone-600">Chưa có đơn đặt phòng nào</p>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Các phòng quý khách đặt sẽ hiển thị tại đây.
                </p>
              </div>
            ) : (
              reservations.map((res) => (
                <div
                  key={res.id}
                  className="bg-white p-3 rounded-xl border border-[#E7E2D6] space-y-1.5 text-xs hover:border-[#8C6D37]/40 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1C1917]">Mã #{res.id}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        res.status === "CONFIRMED" || res.status === "CHECKED_IN"
                          ? "bg-emerald-100 text-emerald-800"
                          : res.status === "CANCELLED"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {res.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-stone-500 flex items-center justify-between">
                    <span>
                      {res.rooms?.[0]?.expected_check_in ? res.rooms[0].expected_check_in.slice(0, 10) : (res.booked_at ? res.booked_at.slice(0, 10) : "—")}
                      {res.rooms?.[0]?.expected_check_out ? ` đến ${res.rooms[0].expected_check_out.slice(0, 10)}` : ""}
                    </span>
                    <span className="font-semibold text-[#8C6D37]">
                      {fmtVND(res.deposit_amount || 0)}
                    </span>
                  </div>
                </div>
              ))
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
