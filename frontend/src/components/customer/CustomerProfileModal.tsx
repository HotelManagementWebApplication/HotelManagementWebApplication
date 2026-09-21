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
}

type TabType = "overview" | "edit" | "password" | "bookings";

const fmtVND = (n: number) => n.toLocaleString("vi-VN") + " ₫";

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({
  isOpen,
  onClose,
  onLogout,
  onProfileUpdated,
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
        setProfileError("Không thể tải thông tin hồ sơ từ máy chủ.");
      })
      .finally(() => setLoadingProfile(false));

    // Load reservations
    setLoadingReservations(true);
    customerApi.reservations()
      .then((resList) => {
        if (Array.isArray(resList)) setReservations(resList);
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
      setPwError(err instanceof Error ? err.message : "Đổi mật khẩu thất bại. Vui lòng thử lại.");
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
                          Đặc quyền thành viên MaM
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
            <div className="space-y-3.5 animate-in fade-in duration-200">
              {loadingReservations ? (
                <div className="py-12 text-center text-xs text-[#78716C]">
                  Đang tải danh sách đặt phòng...
                </div>
              ) : reservations.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-2xl border border-[#E7E2D6] p-6">
                  <BedDouble size={32} className="mx-auto text-[#B8944A] mb-2 opacity-60" />
                  <p className="text-sm font-semibold text-[#1C1917]">Quý khách chưa có đơn đặt chỗ nào</p>
                  <p className="text-xs text-[#78716C] mt-1">
                    Hãy khám phá bộ sưu tập phòng và ẩm thực của MaM Resort để trải nghiệm ngay.
                  </p>
                </div>
              ) : (
                reservations.map((res) => (
                  <div
                    key={res.id}
                    className="p-4 rounded-2xl bg-white border border-[#E7E2D6] shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[#F0EBE1]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#8C6D37]">
                          BK-{res.id}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FAF5EB] text-[#8C6D37] font-semibold border border-[#8C6D37]/20">
                          {res.rental_type === "HOURLY" ? "Theo giờ" : "Trọn gói"}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-amber-700">
                        {res.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-[#57534E]">
                      <div>
                        <span className="text-[#8C827A] block text-[10px] uppercase">Phòng</span>
                        <span className="font-semibold text-[#1C1917]">
                          {res.rooms?.map((r) => `Phòng ${r.room_id}`).join(", ") || "Chưa gán"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8C827A] block text-[10px] uppercase">Tiền cọc yêu cầu</span>
                        <span className="font-semibold text-[#8C6D37]">
                          {fmtVND(Number(res.deposit_amount || 0))}
                        </span>
                      </div>
                    </div>

                    {res.deposit_payment?.payment_code && (
                      <div className="pt-2 border-t border-[#F0EBE1] text-[11px] flex justify-between items-center text-[#78716C]">
                        <span>Mã thanh toán cọc:</span>
                        <span className="font-mono font-bold text-[#1C1917]">
                          {res.deposit_payment.payment_code} ({res.deposit_payment.status})
                        </span>
                      </div>
                    )}
                  </div>
                ))
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
