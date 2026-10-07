import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  User,
  Lock,
  Globe,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  X,
  Phone,
  CreditCard,
  ShieldCheck,
  Mail,
  KeyRound,
  RotateCcw,
} from "lucide-react";
import { customerApi } from "../../shared/api/customer";
import { authApi } from "../../shared/api/auth";
import { apiErrorMessage } from "../../shared/api/client";
import { classifyAccount, formatAuthError } from "../../shared/utils/authValidation";

interface LoginPageProps {
  onLogin: (identity: string, password: string) => Promise<string | null> | string | null;
  onBack: () => void;
}

const DEMO_ROLES = [
  { label: "Khách hàng", email: "0901234567", desc: "Tài khoản Khách (Nguyễn Văn An)" },
  { label: "Lễ tân", email: "FRONTDESK", desc: "Quầy lễ tân" },
  { label: "Quản lý", email: "MANAGER", desc: "Tổng quan quản lý" },
  { label: "Giám đốc", email: "DIRECTOR", desc: "Tổng quan điều hành" },
  { label: "Buồng phòng", email: "HOUSEKEEP", desc: "Điều phối buồng phòng" },
  { label: "Kỹ thuật", email: "TECHNICAL", desc: "Kỹ thuật & bảo trì" },
  { label: "Kế toán", email: "ACCOUNTING", desc: "Điều phối kế toán" },
  { label: "Bếp & Nhà hàng", email: "KITCHEN", desc: "Điều phối nhà hàng & kho" },
  { label: "Nhân sự", email: "HR", desc: "Điều phối nhân sự" },
  { label: "Quản trị", email: "ADMIN", desc: "Quản trị hệ thống" },
  { label: "Nhân viên vận hành", email: "STAFF", desc: "Cổng nhân viên" },
];

export default function LoginPage({ onLogin, onBack }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [showAllRoles, setShowAllRoles] = useState(false);
  const [hasPendingBooking, setHasPendingBooking] = useState(false);

  useEffect(() => {
    const hasPending = Boolean(
      sessionStorage.getItem("pending_booking_room_id") ||
      sessionStorage.getItem("pending_booking_service_id") ||
      sessionStorage.getItem("pending_booking_category")
    );
    setHasPendingBooking(hasPending);
    if (hasPending && import.meta.env.DEV) {
      setSelectedRole("Khách hàng");
      setUsername("0901234567");
      setPassword("hotel123");
    }
  }, []);

  // Modals
  const [registerOpen, setRegisterOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  // Register form state
  const [regStep, setRegStep] = useState<"form" | "otp">("form");
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regIdNumber, setRegIdNumber] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regOtp, setRegOtp] = useState("");
  const [regCountdown, setRegCountdown] = useState(0);
  const [regDevOtpHint, setRegDevOtpHint] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState(false);

  // Forgot password form state
  const [forgotStep, setForgotStep] = useState<"request" | "otp" | "success">("request");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [forgotCountdown, setForgotCountdown] = useState(0);
  const [forgotDevOtpHint, setForgotDevOtpHint] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");

  // Countdown timers for OTP resend
  useEffect(() => {
    if (regCountdown > 0) {
      const timer = setTimeout(() => setRegCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [regCountdown]);

  useEffect(() => {
    if (forgotCountdown > 0) {
      const timer = setTimeout(() => setForgotCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [forgotCountdown]);

  const resetRegisterModal = () => {
    setRegisterOpen(false);
    setRegStep("form");
    setRegFullName("");
    setRegEmail("");
    setRegPhone("");
    setRegIdNumber("");
    setRegPassword("");
    setRegOtp("");
    setRegCountdown(0);
    setRegDevOtpHint("");
    setRegError("");
    setRegSuccess(false);
  };

  const resetForgotModal = () => {
    setForgotOpen(false);
    setForgotStep("request");
    setForgotEmail("");
    setForgotOtp("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowNewPw(false);
    setForgotCountdown(0);
    setForgotDevOtpHint("");
    setForgotError("");
  };

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError("Vui lòng nhập đầy đủ thông tin đăng nhập.");
      return;
    }
    const account = classifyAccount(username);
    if (!account.valid) {
      setError("Tài khoản không hợp lệ");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const message = await onLogin(username, password);
      if (message) {
        setError(message);
      }
    } catch (err: unknown) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRole = (email: string, label: string) => {
    setUsername(email);
    setPassword("hotel123");
    setSelectedRole(label);
    setError("");
  };

  const handleSendRegisterOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim() || !regEmail.trim() || !regPhone.trim() || !regIdNumber.trim() || !regPassword) {
      setRegError("Vui lòng điền đầy đủ tất cả các trường.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail.trim())) {
      setRegError("Email không hợp lệ. Vui lòng nhập đúng định dạng (ví dụ: name@gmail.com).");
      return;
    }
    const phoneRegex = /^(0|\+84|84)[1-9]\d{8,9}$/;
    if (!phoneRegex.test(regPhone.trim())) {
      setRegError("Số điện thoại không hợp lệ. Vui lòng nhập 10 chữ số bắt đầu bằng số 0.");
      return;
    }
    if (regPassword.length < 8) {
      setRegError("Mật khẩu phải có tối thiểu 8 ký tự.");
      return;
    }

    setRegError("");
    setRegLoading(true);
    try {
      await authApi.sendRegistrationOtp(regEmail.trim());
      setRegCountdown(60);
      setRegStep("otp");
    } catch (err: unknown) {
      setRegError(apiErrorMessage(err, "Không thể gửi mã OTP. Vui lòng thử lại."));
    } finally {
      setRegLoading(false);
    }
  };

  const handleResendRegisterOtp = async () => {
    if (regCountdown > 0 || regLoading) return;
    setRegError("");
    setRegLoading(true);
    try {
      await authApi.sendRegistrationOtp(regEmail.trim());
      setRegCountdown(60);
    } catch (err: unknown) {
      setRegError(apiErrorMessage(err, "Không thể gửi lại mã OTP. Vui lòng thử lại."));
    } finally {
      setRegLoading(false);
    }
  };

  const handleConfirmRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = regOtp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setRegError("Vui lòng nhập đúng mã OTP gồm 6 chữ số.");
      return;
    }

    setRegError("");
    setRegLoading(true);
    try {
      await customerApi.register({
        full_name: regFullName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim(),
        identity_number: regIdNumber.trim(),
        password: regPassword,
        otp: cleanOtp,
      });
      setRegSuccess(true);
      // Tự động đăng nhập
      const loginErr = await onLogin(regPhone.trim(), regPassword);
      if (loginErr) {
        setRegError(loginErr);
        setRegSuccess(false);
      } else {
        setTimeout(() => resetRegisterModal(), 1200);
      }
    } catch (err: unknown) {
      setRegError(apiErrorMessage(err, "Đăng ký không thành công. Vui lòng kiểm tra mã OTP."));
    } finally {
      setRegLoading(false);
    }
  };

  const handleSendForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = forgotEmail.trim();
    if (!email) {
      setForgotError("Vui lòng nhập địa chỉ email của bạn.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setForgotError("Email không hợp lệ. Vui lòng nhập đúng định dạng email.");
      return;
    }

    setForgotError("");
    setForgotLoading(true);
    try {
      await authApi.sendForgotOtp(email);
      setForgotCountdown(60);
      setForgotStep("otp");
    } catch (err: unknown) {
      setForgotError(apiErrorMessage(err, "Không thể gửi mã OTP. Vui lòng thử lại."));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendForgotOtp = async () => {
    if (forgotCountdown > 0 || forgotLoading) return;
    setForgotError("");
    setForgotLoading(true);
    try {
      await authApi.sendForgotOtp(forgotEmail.trim());
      setForgotCountdown(60);
    } catch (err: unknown) {
      setForgotError(apiErrorMessage(err, "Không thể gửi lại mã OTP. Vui lòng thử lại."));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = forgotOtp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setForgotError("Vui lòng nhập đúng mã OTP gồm 6 chữ số.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setForgotError("Mật khẩu mới phải có tối thiểu 8 ký tự.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError("Xác nhận mật khẩu mới không khớp.");
      return;
    }

    setForgotError("");
    setForgotLoading(true);
    try {
      await authApi.resetPasswordWithOtp({
        email: forgotEmail.trim(),
        otp: cleanOtp,
        new_password: newPassword,
      });
      setForgotStep("success");
    } catch (err: unknown) {
      setForgotError(apiErrorMessage(err, "Đặt lại mật khẩu thất bại. Mã OTP có thể đã hết hạn hoặc không đúng."));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleFinishForgot = () => {
    const savedEmail = forgotEmail.trim();
    resetForgotModal();
    if (savedEmail) {
      setUsername(savedEmail);
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#FAF8F5] text-[#1C1917] font-sans antialiased selection:bg-[#B8944A]/25">
      {/* ── Left Panel: Majestic Cinematic Heritage Hotel ── */}
      <div className="relative hidden md:flex flex-col justify-between w-[48%] lg:w-[54%] xl:w-[58%] min-h-screen overflow-hidden bg-[#0D1117]">
        {/* Background Image */}
        <img
          src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600&h=1200&fit=crop&auto=format"
          alt="MaM Hotel Heritage Ambiance"
          className="absolute inset-0 w-full h-full object-cover object-center scale-105 transition-transform duration-1000 ease-out"
        />

        {/* Cinematic Multi-layer Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/70 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/75 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(184,148,74,0.18)_0%,transparent_75%)] pointer-events-none" />

        {/* Subtle Decorative Golden Border Frame inside left panel */}
        <div className="absolute inset-6 lg:inset-10 border border-[#D4AF6E]/20 pointer-events-none" />

        {/* 1. Top Brand Header */}
        <div className="relative z-10 p-8 lg:p-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/hotel_logo.png"
              alt="MaM Hotel Crest"
              className="w-12 lg:w-14 h-auto object-contain drop-shadow-[0_4px_16px_rgba(212,175,110,0.4)]"
            />
            <div>
              <span className="font-display text-xl lg:text-2xl text-white font-normal tracking-[0.2em] block leading-none">
                MaM Hotel
              </span>
              <span className="text-[10px] uppercase tracking-[0.35em] text-[#E6CA85] font-semibold block mt-1.5">
                Beachfront Retreat &amp; Spa · Biển Vũng Tàu
              </span>
            </div>
          </div>

          {/* 5 Golden Stars */}
          <div className="hidden lg:flex items-center gap-1.5 opacity-80">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="text-[#D4AF6E] text-xs">★</span>
            ))}
          </div>
        </div>

        {/* 2. Center Editorial Quote Block */}
        <div className="relative z-10 px-8 lg:px-16 my-auto max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-[#D4AF6E]/30 mb-6 text-[#E6CA85] text-[10px] tracking-[0.3em] uppercase font-semibold">
            <span>KHU NGHỈ DƯỠNG BIỂN CAO CẤP</span>
          </div>

          <h2 className="font-display font-light text-white text-3xl sm:text-4xl lg:text-5xl leading-[1.2] tracking-tight mb-6">
            Nơi từng khoảnh khắc{" "}
            <span className="italic text-[#E8C878] font-normal block mt-1">
              hòa cùng biển trời vô tận.
            </span>
          </h2>

          <div className="flex items-center gap-3 my-6 opacity-75">
            <div className="w-12 h-px bg-gradient-to-r from-transparent via-[#D4AF6E] to-transparent" />
            <span className="text-[#D4AF6E] text-xs">◆</span>
            <div className="w-12 h-px bg-gradient-to-r from-transparent via-[#D4AF6E] to-transparent" />
          </div>

          <p className="text-white/80 text-sm lg:text-base font-light leading-relaxed max-w-xl">
            Không gian kiến trúc trầm ấm bên bờ biển nguyên sơ lộng gió,
            mở ra kỳ nghỉ an trú tuyệt đối cùng nghệ thuật ẩm thực tinh hoa và các nghi thức dưỡng tâm cổ truyền.
          </p>
        </div>

        {/* 3. Bottom Experience Strip */}
        <div className="relative z-10 p-8 lg:p-14 pt-0">
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-6 text-[10px] uppercase tracking-[0.25em] text-white/60 font-light">
            <div className="flex items-center gap-6">
              <span>Biệt thự hướng biển</span>
              <span>·</span>
              <span>Ẩm thực thượng hạng</span>
              <span>·</span>
              <span>Trị liệu Nam Y</span>
            </div>
            <span className="text-[#D4AF6E]/80 font-normal">ĐẲNG CẤP VƯỢT THỜI GIAN</span>
          </div>
        </div>
      </div>

      {/* ── Right Panel: Classical Luxury Authentication Suite ── */}
      <div className="flex-1 flex flex-col justify-between min-h-screen bg-[#FAF8F5] relative p-6 sm:p-10 lg:p-12 border-l border-[#EAE4D8]">
        {/* Top Utility Bar */}
        <div className="flex items-center justify-between w-full max-w-lg mx-auto mb-4">
          <button
            type="button"
            onClick={onBack}
            className="group inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-semibold text-[#78716C] hover:text-[#8C6D37] transition cursor-pointer"
          >
            <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" />
            <span>Trang chủ</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-[#78716C]">
            <Globe size={14} className="text-[#8C6D37]" />
            <span className="font-semibold text-[#1C1917]">VI</span>
            <span className="text-[#D9D2C5]">/</span>
            <span className="hover:text-[#1C1917] cursor-pointer">EN</span>
          </div>
        </div>

        {/* Main Centered Form Card */}
        <div className="w-full max-w-[460px] mx-auto my-auto py-4">
          {/* Brand Crest & Title */}
          <div className="text-center mb-7">
            <img
              src="/hotel_logo.png"
              alt="MaM Hotel"
              className="w-12 h-auto mx-auto mb-3 object-contain drop-shadow-[0_4px_12px_rgba(184,148,74,0.35)]"
            />
            <h1 className="font-display text-3xl sm:text-4xl text-[#1C1917] font-normal tracking-tight">
              Đăng Nhập Hệ Thống
            </h1>
            
          </div>

          {/* Pending Booking Guidance Banner */}
          {hasPendingBooking && (
            <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-[#8C6D37]/30 text-[#8C6D37] text-xs flex items-start gap-3 shadow-sm animate-fadeIn">
              <ShieldCheck size={16} className="shrink-0 text-[#8C6D37]" />
              <div>
                <strong className="block font-semibold text-[#1C1917] mb-1">
                  Yêu cầu đăng nhập để hoàn tất đặt chỗ
                </strong>
                <span className="text-[#57534E] leading-relaxed block">
                  Quý khách vui lòng đăng nhập để tiếp tục đặt phòng / dịch vụ. Nếu chưa có tài khoản, hãy đăng ký thành viên mới để nhận ưu đãi đặc biệt.
                </span>
              </div>
            </div>
          )}

          {/* ── DEMO ACCOUNT SELECTOR (Development Only) ── */}
          {import.meta.env.DEV && (
            <div className="mb-5 rounded-2xl bg-white border border-[#E5DDD0] shadow-sm overflow-hidden transition-all duration-300">
              {/* Quick 1-click role chips */}
              <div className="p-3 bg-[#FDFBF7] border-b border-[#F0EBE1] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-[#8C6D37] font-semibold">      
                  <span className="text-[11px] uppercase tracking-wider">Mẫu:</span>
                </div>

                {/* Quick roles: Khách hàng, Lễ tân, Quản lý */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSelectRole("0901234567", "Khách hàng")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                      selectedRole === "Khách hàng"
                        ? "bg-[#8C6D37] text-white"
                        : "bg-white text-[#57534E] hover:text-[#1C1917] border border-[#E5DDD0]"
                    }`}
                  >
                    Khách hàng
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectRole("FRONTDESK", "Lễ tân")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                      selectedRole === "Lễ tân"
                        ? "bg-[#8C6D37] text-white"
                        : "bg-white text-[#57534E] hover:text-[#1C1917] border border-[#E5DDD0]"
                    }`}
                  >
                    Lễ tân
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectRole("MANAGER", "Quản lý")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                      selectedRole === "Quản lý"
                        ? "bg-[#8C6D37] text-white"
                        : "bg-white text-[#57534E] hover:text-[#1C1917] border border-[#E5DDD0]"
                    }`}
                  >
                    Quản lý
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectRole("DIRECTOR", "Giám đốc")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                      selectedRole === "Giám đốc"
                        ? "bg-[#8C6D37] text-white"
                        : "bg-white text-[#57534E] hover:text-[#1C1917] border border-[#E5DDD0]"
                    }`}
                  >
                    Giám đốc
                  </button>
                </div>

                {/* Toggle expand full grid */}
                <button
                  type="button"
                  onClick={() => setShowAllRoles(!showAllRoles)}
                  className="text-[#8C6D37] hover:text-[#1C1917] p-1 rounded transition cursor-pointer"
                  title={showAllRoles ? "Thu gọn danh sách" : `Xem tất cả ${DEMO_ROLES.length} vai trò`}
                >
                  {showAllRoles ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {/* Expanded Full Roles Grid */}
              {showAllRoles && (
                <div className="p-3.5 bg-white grid grid-cols-3 gap-2 border-t border-[#F0EBE1] animate-fadeIn">
                  {DEMO_ROLES.map((r) => {
                    const isCurrent = selectedRole === r.label;
                    return (
                      <button
                        key={r.email}
                        type="button"
                        onClick={() => handleSelectRole(r.email, r.label)}
                        className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                          isCurrent
                            ? "bg-[#FAF5EB] border-[#8C6D37] ring-1 ring-[#8C6D37]/30 shadow-xs"
                            : "bg-[#FCFAF7] hover:bg-white hover:border-[#8C6D37]/60 border-[#E8E2D6]"
                        }`}
                      >
                        <span className="font-semibold text-xs text-[#1C1917] block">
                          {r.label}
                        </span>
                        <span className="text-[10px] text-[#8C827A] truncate block mt-0.5">
                          {r.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Hint bar */}
              <div className="px-3.5 py-1.5 bg-[#FAF8F5] text-[10px] text-[#8C827A] flex items-center justify-between">
                <span>Mật khẩu mẫu: <strong className="text-[#8C6D37]">hotel123</strong></span>
                {selectedRole && (
                  <span className="text-[#8C6D37] font-medium flex items-center gap-1">
                    ✓ Đã chọn: {selectedRole}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Error Notice */}
          {error && (
            <div
              role="alert"
              className="mb-4 p-3.5 rounded-xl bg-red-50/90 border border-red-200 text-red-800 text-xs flex items-center gap-2.5 animate-fadeIn"
            >
              <AlertCircle size={16} className="shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Fields */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-4"
          >
            {/* Username / Phone / Employee ID */}
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] font-semibold text-[#8C6D37] mb-1.5">
                Tài khoản / Email / Số điện thoại
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8C6D37]">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  placeholder="Nhập email, số điện thoại hoặc mã NV"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-[#DDD5C7] rounded-xl text-sm text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#8C6D37] focus:ring-2 focus:ring-[#8C6D37]/15 transition shadow-xs"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] uppercase tracking-[0.2em] font-semibold text-[#8C6D37]">
                  Mật khẩu bảo mật
                </label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-[11px] text-[#8C6D37] hover:underline font-medium cursor-pointer"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8C6D37]">
                  <Lock size={16} />
                </div>
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Nhập mật khẩu của bạn"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 bg-white border border-[#DDD5C7] rounded-xl text-sm text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#8C6D37] focus:ring-2 focus:ring-[#8C6D37]/15 transition shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8C827A] hover:text-[#1C1917] cursor-pointer"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-[#DDD5C7] text-[#8C6D37] focus:ring-[#8C6D37]/25 accent-[#8C6D37] cursor-pointer"
                />
                <span className="text-xs text-[#57534E]">Ghi nhớ phiên đăng nhập</span>
              </label>
            </div>

            {/* Stately Luxury Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-6 rounded-xl bg-[#1C1917] hover:bg-[#8C6D37] text-white text-xs uppercase tracking-[0.25em] font-semibold transition-all duration-300 shadow-md hover:shadow-lg flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <span>Đăng Nhập Hệ Thống</span>
                  <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Ornamental Divider */}
          <div className="relative my-5 flex items-center justify-center">
            <div className="border-t border-[#E5DDD0] w-full" />
            <span className="bg-[#FAF8F5] px-4 text-[10px] uppercase tracking-[0.22em] text-[#8C827A] font-semibold shrink-0">
              Hoặc tiếp tục với
            </span>
          </div>

          {/* Social Logins */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              type="button"
              onClick={() => {
                setUsername("0900000001");
                setPassword("customer123");
                setSelectedRole("Khách hàng mẫu");
              }}
              className="flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white border border-[#DDD5C7] hover:border-[#8C6D37] hover:bg-[#FDFBF7] rounded-xl text-xs font-medium text-[#1C1917] transition shadow-xs cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              <span>Google</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setUsername("0900000001");
                setPassword("customer123");
                setSelectedRole("Khách hàng mẫu");
              }}
              className="flex items-center justify-center gap-2.5 py-2.5 px-4 bg-[#1C1917] hover:bg-[#2D2A26] text-white border border-[#1C1917] rounded-xl text-xs font-medium transition shadow-xs cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 18" fill="white">
                <path d="M13.173 9.7c-.02-2.017 1.645-2.99 1.72-3.038-.937-1.37-2.395-1.558-2.913-1.576-1.24-.126-2.424.732-3.051.732-.627 0-1.596-.715-2.626-.696-1.352.02-2.598.787-3.292 1.998-1.404 2.44-.36 6.062 1.012 8.045.668.972 1.46 2.065 2.505 2.025 1.007-.04 1.388-.652 2.607-.652 1.22 0 1.564.652 2.632.632 1.082-.02 1.765-.993 2.425-1.972.768-1.13 1.084-2.228 1.101-2.285-.024-.01-2.1-.806-2.12-3.213z"/>
                <path d="M11.14 3.217c.554-.672.928-1.604.826-2.534-.798.033-1.764.531-2.336 1.197-.513.595-.963 1.549-.842 2.461.89.069 1.797-.452 2.352-1.124z"/>
              </svg>
              <span>Apple ID</span>
            </button>
          </div>

          {/* Registration Invitation */}
          <div className="text-center pt-2">
            <p className="text-xs text-[#78716C]">
              Chưa có tài khoản lưu trú?{" "}
              <button
                type="button"
                onClick={() => setRegisterOpen(true)}
                className="text-[#8C6D37] hover:text-[#1C1917] font-semibold underline underline-offset-4 cursor-pointer ml-1 transition"
              >
                Đăng ký thành viên mới
              </button>
            </p>
          </div>
        </div>

        {/* Bottom Micro Footer */}
        <div className="w-full max-w-lg mx-auto text-center pt-4 border-t border-[#EDE6DC]">
          <p className="text-[11px] text-[#8C827A] font-light">
            © 2026 MaM Hotel &amp; Sanctuary · Beachfront Hotel &amp; Spa. Bảo mật thông tin chuẩn mực 5 sao.
          </p>
        </div>
      </div>

      {/* ── Modal: Đăng ký thành viên khách hàng mới với xác thực Email OTP ── */}
      {registerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#FAF8F5] rounded-3xl border border-[#E7E2D6] max-w-md w-full p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <button
              type="button"
              onClick={resetRegisterModal}
              className="absolute top-6 right-6 text-[#78716C] hover:text-[#1C1917] cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#8C6D37] block mb-1">
                {regStep === "form" ? "GIA NHẬP CÂU LẠC BỘ" : "BƯỚC 2: XÁC THỰC EMAIL"}
              </span>
              <h3 className="font-display text-2xl text-[#1C1917] font-normal">
                {regStep === "form" ? "Đăng Ký Thành Viên Đặc Quyền" : "Xác Thực Mã OTP"}
              </h3>
              <p className="text-xs text-[#78716C] mt-1">
                {regStep === "form"
                  ? "Đặt phòng và dịch vụ MaM Hotel trong cùng kỳ lưu trú"
                  : `Mã xác nhận 6 số đã được gửi đến hộp thư ${regEmail}`}
              </p>
            </div>

            {regSuccess ? (
              <div className="p-6 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] text-center">
                <CheckCircle2 size={40} className="text-green-600 mx-auto mb-2" />
                <h4 className="font-semibold text-green-800 text-base">Đăng ký thành công!</h4>
                <p className="text-xs text-green-700 mt-1">Hệ thống đang tự động đăng nhập vào tài khoản của bạn...</p>
              </div>
            ) : regStep === "form" ? (
              <form onSubmit={handleSendRegisterOtp} className="space-y-3.5">
                {regError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{regError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8C6D37] mb-1">
                    Họ và tên Quý khách *
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C6D37]" />
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Nguyễn Văn A"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#DDD5C7] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#8C6D37] focus:ring-1 focus:ring-[#8C6D37]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8C6D37] mb-1">
                    Email tài khoản (Nhận mã xác thực OTP) *
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C6D37]" />
                    <input
                      type="email"
                      required
                      placeholder="Ví dụ: khachhang@gmail.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#DDD5C7] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#8C6D37] focus:ring-1 focus:ring-[#8C6D37]"
                    />
                  </div>
                  <span className="text-[10px] text-[#8C827A] mt-1 block">
                    Bắt buộc nhập email để nhận mã OTP kích hoạt và xác nhận phòng.
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8C6D37] mb-1">
                    Số điện thoại liên hệ *
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C6D37]" />
                    <input
                      type="tel"
                      required
                      placeholder="Ví dụ: 0912345678"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#DDD5C7] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#8C6D37] focus:ring-1 focus:ring-[#8C6D37]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8C6D37] mb-1">
                    Số CCCD / Hộ chiếu *
                  </label>
                  <div className="relative">
                    <CreditCard size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C6D37]" />
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: 048090001234"
                      value={regIdNumber}
                      onChange={(e) => setRegIdNumber(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#DDD5C7] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#8C6D37] focus:ring-1 focus:ring-[#8C6D37]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8C6D37] mb-1">
                    Mật khẩu truy cập *
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C6D37]" />
                    <input
                      type="password"
                      required
                      placeholder="Tối thiểu 8 ký tự"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#DDD5C7] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#8C6D37] focus:ring-1 focus:ring-[#8C6D37]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full mt-4 py-3 bg-[#1C1917] hover:bg-[#8C6D37] text-white text-xs uppercase tracking-[0.2em] font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {regLoading ? "Đang gửi mã OTP..." : "Tiếp Tục & Nhận Mã OTP"}
                  <ArrowRight size={15} />
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmRegister} className="space-y-4">
                {regError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{regError}</span>
                  </div>
                )}

                <div className="p-3.5 bg-white border border-[#E7E2D6] rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-[#57534E] truncate">
                    <Mail size={15} className="text-[#8C6D37] shrink-0" />
                    <span className="font-medium text-[#1C1917] truncate">{regEmail}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRegStep("form")}
                    className="text-[#8C6D37] hover:underline text-[11px] font-medium shrink-0 ml-2 cursor-pointer"
                  >
                    Sửa email
                  </button>
                </div>

                {regDevOtpHint && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-center justify-between">
                    <span>Mã xác nhận tạm thời: <strong>{regDevOtpHint}</strong></span>
                    <button
                      type="button"
                      onClick={() => setRegOtp(regDevOtpHint)}
                      className="text-[#8C6D37] underline font-semibold hover:text-[#1C1917] cursor-pointer"
                    >
                      Điền nhanh
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8C6D37] mb-2 text-center">
                    Nhập mã xác thực OTP 6 chữ số *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    required
                    placeholder="••••••"
                    value={regOtp}
                    onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, ""))}
                    className="w-full py-3 px-4 bg-white border-2 border-[#D4AF6E] rounded-2xl text-center font-mono text-2xl tracking-[0.4em] font-bold text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#8C6D37]/30 shadow-inner"
                  />
                </div>

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full py-3 bg-[#1C1917] hover:bg-[#8C6D37] text-white text-xs uppercase tracking-[0.2em] font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {regLoading ? "Đang xác thực..." : "Xác Nhận & Hoàn Tất Đăng Ký"}
                </button>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setRegStep("form")}
                    className="text-[#78716C] hover:text-[#1C1917] cursor-pointer"
                  >
                    ← Quay lại sửa thông tin
                  </button>
                  <button
                    type="button"
                    disabled={regCountdown > 0 || regLoading}
                    onClick={handleResendRegisterOtp}
                    className={`cursor-pointer font-medium ${
                      regCountdown > 0 ? "text-gray-400 cursor-not-allowed" : "text-[#8C6D37] hover:underline"
                    }`}
                  >
                    {regCountdown > 0 ? `Gửi lại mã sau (${regCountdown}s)` : "Gửi lại mã OTP"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Quên mật khẩu & Khôi phục qua Email OTP ── */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#FAF8F5] rounded-3xl border border-[#E7E2D6] max-w-md w-full p-8 shadow-2xl relative">
            <button
              type="button"
              onClick={resetForgotModal}
              className="absolute top-6 right-6 text-[#78716C] hover:text-[#1C1917] cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-[#FAF0DC] flex items-center justify-center mx-auto mb-3 text-[#8C6D37]">
                <KeyRound size={22} />
              </div>
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#8C6D37] block mb-1">
                BẢO MẬT &amp; KHÔI PHỤC
              </span>
              <h3 className="font-display text-2xl text-[#1C1917] font-normal">
                {forgotStep === "request" && "Quên Mật Khẩu"}
                {forgotStep === "otp" && "Thiết Lập Mật Khẩu Mới"}
                {forgotStep === "success" && "Đổi Mật Khẩu Thành Công"}
              </h3>
              <p className="text-xs text-[#78716C] mt-1 max-w-sm mx-auto">
                {forgotStep === "request" && "Nhập địa chỉ email tài khoản để nhận mã OTP xác thực khôi phục mật khẩu."}
                {forgotStep === "otp" && `Nhập mã OTP đã gửi tới ${forgotEmail} và thiết lập mật khẩu mới.`}
                {forgotStep === "success" && "Mật khẩu của bạn đã được cập nhật thành công. Vui lòng đăng nhập lại."}
              </p>
            </div>

            {forgotStep === "success" ? (
              <div className="text-center space-y-4">
                <div className="p-6 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0]">
                  <CheckCircle2 size={42} className="text-green-600 mx-auto mb-2" />
                  <p className="text-xs text-green-800 font-medium">
                    Mật khẩu tài khoản của bạn đã được cập nhật an toàn.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleFinishForgot}
                  className="w-full py-3 bg-[#1C1917] hover:bg-[#8C6D37] text-white text-xs uppercase tracking-wider font-semibold rounded-xl transition cursor-pointer"
                >
                  Đăng Nhập Ngay
                </button>
              </div>
            ) : forgotStep === "request" ? (
              <form onSubmit={handleSendForgotOtp} className="space-y-4">
                {forgotError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8C6D37] mb-1.5">
                    Địa chỉ Email tài khoản *
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C6D37]" />
                    <input
                      type="email"
                      required
                      autoFocus
                      placeholder="Ví dụ: khachhang@gmail.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#DDD5C7] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#8C6D37] focus:ring-1 focus:ring-[#8C6D37]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 bg-[#1C1917] hover:bg-[#8C6D37] text-white text-xs uppercase tracking-wider font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {forgotLoading ? "Đang gửi mã OTP..." : "Gửi Mã OTP Khôi Phục"}
                  <ArrowRight size={15} />
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={resetForgotModal}
                    className="text-xs text-[#78716C] hover:text-[#1C1917] cursor-pointer"
                  >
                    ← Quay lại đăng nhập
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3.5">
                {forgotError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <div className="p-3 bg-white border border-[#E7E2D6] rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <Mail size={14} className="text-[#8C6D37] shrink-0" />
                    <span className="font-medium text-[#1C1917] truncate">{forgotEmail}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForgotStep("request")}
                    className="text-[#8C6D37] hover:underline text-[11px] font-medium shrink-0 ml-2 cursor-pointer"
                  >
                    Đổi email
                  </button>
                </div>

                {forgotDevOtpHint && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-center justify-between">
                    <span>Mã xác nhận tạm thời: <strong>{forgotDevOtpHint}</strong></span>
                    <button
                      type="button"
                      onClick={() => setForgotOtp(forgotDevOtpHint)}
                      className="text-[#8C6D37] underline font-semibold hover:text-[#1C1917] cursor-pointer"
                    >
                      Điền nhanh
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8C6D37] mb-1 text-center">
                    Mã xác nhận OTP (6 số) *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    required
                    placeholder="••••••"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                    className="w-full py-2.5 px-4 bg-white border-2 border-[#D4AF6E] rounded-xl text-center font-mono text-xl tracking-[0.3em] font-bold text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#8C6D37]/30 shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8C6D37] mb-1">
                    Mật khẩu mới *
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C6D37]" />
                    <input
                      type={showNewPw ? "text" : "password"}
                      required
                      placeholder="Tối thiểu 8 ký tự"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-white border border-[#DDD5C7] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#8C6D37] focus:ring-1 focus:ring-[#8C6D37]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                    >
                      {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#8C6D37] mb-1">
                    Nhập lại mật khẩu mới *
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C6D37]" />
                    <input
                      type={showNewPw ? "text" : "password"}
                      required
                      placeholder="Xác nhận lại mật khẩu mới"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#DDD5C7] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#8C6D37] focus:ring-1 focus:ring-[#8C6D37]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 bg-[#1C1917] hover:bg-[#8C6D37] text-white text-xs uppercase tracking-wider font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {forgotLoading ? "Đang xử lý..." : "Xác Nhận Đổi Mật Khẩu"}
                </button>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setForgotStep("request")}
                    className="text-[#78716C] hover:text-[#1C1917] cursor-pointer"
                  >
                    ← Quay lại
                  </button>
                  <button
                    type="button"
                    disabled={forgotCountdown > 0 || forgotLoading}
                    onClick={handleResendForgotOtp}
                    className={`cursor-pointer font-medium ${
                      forgotCountdown > 0 ? "text-gray-400 cursor-not-allowed" : "text-[#8C6D37] hover:underline"
                    }`}
                  >
                    {forgotCountdown > 0 ? `Gửi lại mã sau (${forgotCountdown}s)` : "Gửi lại mã OTP"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
