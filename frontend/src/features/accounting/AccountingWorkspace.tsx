import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRightLeft, CalendarDays, ChevronDown, ClipboardList, FileText, LayoutDashboard, LogOut, Menu, RefreshCcw, Search, Wallet, X, type LucideIcon } from "lucide-react";
import { EmployeeProfileDropdown } from "../../shared/components/EmployeeProfileDropdown";
import type { EmployeeProfileDto } from "../../shared/types/api";
import { employeeRoleLabel } from "../../shared/types/api";
import "./accountingWorkspace.css";

export type AccountingPage = "handover" | "ledger" | "vat" | "ota" | "debt";
interface AccountingMetric { label: string; val: string; sub: string; Icon: LucideIcon; iconBg: string; iconColor: string; }
const pages = [
  { id: "handover", label: "Tổng quan & Bàn giao", description: "Theo dõi thu, hoàn tiền và tiếp nhận bàn giao từ lễ tân.", Icon: LayoutDashboard },
  { id: "ledger", label: "Sổ giao dịch", description: "Tra cứu các khoản thu, hoàn tiền và xuất giao dịch theo ngày.", Icon: Wallet },
  { id: "vat", label: "Hóa đơn & Thuế", description: "Hóa đơn theo toàn bộ lịch sử; bảng VAT theo ngày đối soát đã chọn.", Icon: FileText },
  { id: "ota", label: "Đối soát kênh bán", description: "Đối chiếu đặt phòng từ các kênh bán và cập nhật kết quả đối soát.", Icon: ArrowRightLeft },
  { id: "debt", label: "Thu chi & Công nợ", description: "Theo dõi khoản chi, công nợ nhà cung cấp và lịch sử thanh toán.", Icon: ClipboardList },
] satisfies { id: AccountingPage; label: string; description: string; Icon: LucideIcon }[];

export function AccountingWorkspace({ page, onPageChange, profile, loading, search, onSearchChange, date, onDateChange, onRefresh, onLogout, metrics, alerts, children }: {
  page: AccountingPage; onPageChange: (page: AccountingPage) => void; profile: EmployeeProfileDto | null; loading: boolean;
  search: string; onSearchChange: (value: string) => void; date: string; onDateChange: (value: string) => void;
  onRefresh: () => void; onLogout: () => void; metrics: AccountingMetric[]; alerts: ReactNode; children: ReactNode;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scrollArea.current) scrollArea.current.scrollTop = 0; }, [page]);
  useEffect(() => {
    const dialog = drawer.current;
    if (menuOpen) dialog?.showModal();
    else if (dialog?.open) dialog.close();
  }, [menuOpen]);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 901px)");
    const close = () => { if (wide.matches) setMenuOpen(false); };
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);
  const closeMenu = () => { setMenuOpen(false); menuButton.current?.focus(); };
  const navigate = (next: AccountingPage) => { onPageChange(next); setMenuOpen(false); };
  const current = pages.find(item => item.id === page)!;
  const name = profile?.full_name || (loading ? "Đang tải hồ sơ…" : "Không có hồ sơ");
  const role = profile?.role ? employeeRoleLabel(profile.role) : "Kế toán";
  const initials = profile?.full_name?.trim().split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase() || "?";
  const navigation = <>
    <div className="acct-brand"><img src="/hotel_logo.png" alt="MaM Hotel" /><div><strong>MaM Hotel</strong><span>KẾ TOÁN & TÀI CHÍNH</span></div></div>
    <nav className="acct-nav" aria-label="Điều hướng kế toán"><p>KHÔNG GIAN LÀM VIỆC</p>{pages.map(item =>
      <button key={item.id} type="button" aria-current={page === item.id ? "page" : undefined} onClick={() => navigate(item.id)}><item.Icon size={18} /><span>{item.label}</span></button>
    )}</nav>
    <div className="acct-sidebar-person"><span className="acct-avatar">{initials}</span><div><strong>{name}</strong><small>{role}</small></div></div>
    <button type="button" className="acct-logout" onClick={onLogout}><LogOut size={16} />Đăng xuất</button>
  </>;
  return <div className="accounting-workspace">
    <aside className="acct-sidebar">{navigation}</aside>
    <dialog ref={drawer} className="acct-drawer" aria-label="Menu kế toán" onCancel={event => { event.preventDefault(); closeMenu(); }} onClick={event => { if (event.target === event.currentTarget) closeMenu(); }}>
      <div className="acct-drawer-body"><button type="button" className="acct-icon-button acct-drawer-close" aria-label="Đóng menu kế toán" onClick={closeMenu}><X size={18} /></button>{navigation}</div>
    </dialog>
    <div className="acct-main">
      <header className="acct-topbar">
        <button ref={menuButton} type="button" className="acct-icon-button acct-menu-toggle" aria-label="Mở menu kế toán" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
        <div className="acct-search"><Search size={17} /><input aria-label="Tìm kiếm kế toán" value={search} onChange={event => onSearchChange(event.target.value)} placeholder={page === "vat" ? "Tìm hóa đơn theo mã đặt phòng..." : "Tra giao dịch: PAY, INV hoặc mã đặt phòng..."} /></div>
        <div className="acct-topbar-actions">
          <button type="button" className="acct-icon-button" aria-label="Tải lại dữ liệu kế toán" disabled={loading} onClick={onRefresh}><RefreshCcw size={17} className={loading ? "acct-spin" : undefined} /></button>
          <div className="acct-profile">
            <button type="button" className="acct-profile-trigger" aria-label="Hồ sơ nhân viên" aria-expanded={profileOpen} onClick={() => setProfileOpen(value => !value)}><span className="acct-avatar">{initials}</span><span className="acct-profile-name"><strong>{name}</strong><small>{role}</small></span><ChevronDown size={14} /></button>
            <EmployeeProfileDropdown isOpen={profileOpen} onClose={() => setProfileOpen(false)} onLogout={onLogout} align="top-right" currentRoleLabel={role} departmentName="Bộ phận Kế toán" />
          </div>
        </div>
      </header>
      <div ref={scrollArea} className="acct-workspace-scroll">
        <div className="acct-page-heading"><div><p className="acct-eyebrow">KẾ TOÁN & ĐỐI SOÁT TÀI CHÍNH</p><h1>{current.label}</h1><p className="acct-page-description">{current.description}</p></div>{page !== "ota" && <label className="acct-date"><CalendarDays size={17} /><span>Ngày đối soát</span><input aria-label="Ngày đối soát" type="date" value={date} onChange={event => { if (event.target.value) onDateChange(event.target.value); }} /></label>}</div>
        <div className="acct-alerts" aria-live="polite">{alerts}</div>
        {page === "handover" && <section className="acct-metrics" aria-label="Tổng hợp tài chính">{metrics.map(metric => <article className="acct-metric" key={metric.label}><span className="acct-metric-icon" style={{ background: metric.iconBg, color: metric.iconColor }}><metric.Icon size={20} /></span><div><p>{metric.label}</p><strong>{metric.val}</strong><small>{metric.sub}</small></div></article>)}</section>}
        <main className="acct-content">{children}</main>
      </div>
    </div>
  </div>;
}
