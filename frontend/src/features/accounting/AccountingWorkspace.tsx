import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRightLeft, Bell, CalendarDays, CheckCheck, ChevronDown, ClipboardList, FileText, LayoutDashboard, LogOut, Menu, RefreshCcw, Search, Wallet, X, type LucideIcon } from "lucide-react";
import { kitchenAccountingApi } from "../../shared/api/kitchenAccounting";
import { apiErrorMessage } from "../../shared/api/client";
import type { Approval } from "../../shared/types/kitchenAccounting";
import { formatVnd } from "../../shared/utils/money";
import { formatDateTimeVi } from "../../shared/utils/localDate";
import { EmployeeProfileDropdown } from "../../shared/components/EmployeeProfileDropdown";
import type { EmployeeProfileDto } from "../../shared/types/api";
import { employeeRoleLabel } from "../../shared/types/api";
import "./accountingWorkspace.css";

export type AccountingPage="handover"|"ledger"|"ota"|"vat"|"debt";
export interface AccountingMetric { label:string;val:string;sub:string;Icon:LucideIcon;iconBg:string;iconColor:string; }
const pages:{id:AccountingPage;label:string;title:string;description:string;Icon:LucideIcon}[]=[
  {id:"handover",label:"Tổng quan & Bàn giao",title:"Tổng quan & Bàn giao ca",description:"Kiểm soát dòng tiền, kiểm đếm két và theo dõi giao dịch trong ngày.",Icon:LayoutDashboard},
  {id:"ledger",label:"Sổ thanh toán",title:"Sổ thanh toán",description:"Tra cứu các khoản thu, hoàn tiền và phương thức thanh toán.",Icon:Wallet},
  {id:"vat",label:"Hóa đơn & VAT",title:"Hóa đơn & Biên lai",description:"Theo dõi hóa đơn, ghi nhận thanh toán và quản lý chứng từ VAT.",Icon:FileText},
  {id:"ota",label:"Đối soát kênh bán",title:"Đối soát kênh bán",description:"Đối chiếu giá trị đặt phòng và trạng thái xử lý của từng kênh bán.",Icon:ArrowRightLeft},
  {id:"debt",label:"Thu chi & Công nợ",title:"Thu chi & Công nợ",description:"Quản lý khoản chi, công nợ nhà cung cấp và lịch sử thanh toán.",Icon:ClipboardList},
];

export function AccountingWorkspace({page,onPageChange,profile,loading,search,onSearchChange,date,onDateChange,onRefresh,onLogout,metrics,alerts,children}:{
  page:AccountingPage;onPageChange:(page:AccountingPage)=>void;profile:EmployeeProfileDto|null;loading:boolean;
  search:string;onSearchChange:(value:string)=>void;date:string;onDateChange:(value:string)=>void;
  onRefresh:()=>void;onLogout:()=>void;metrics:AccountingMetric[];alerts:ReactNode;children:ReactNode;
}) {
  const [profileOpen,setProfileOpen]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  const [notifications,setNotifications]=useState<Approval[]>([]);
  const [notificationError,setNotificationError]=useState("");
  const [notificationsLoading,setNotificationsLoading]=useState(false);
  const [notificationVersion,setNotificationVersion]=useState(0);
  const [readNotifications,setReadNotifications]=useState<Set<string>>(new Set());
  const [unreadOnly,setUnreadOnly]=useState(false);
  const notificationPanel=useRef<HTMLDivElement>(null);
  const notificationButton=useRef<HTMLButtonElement>(null);
  const notificationKey=(row:Approval)=>`${row.id}:${row.status}`;
  const unreadCount=notifications.filter(row=>!readNotifications.has(notificationKey(row))).length;
  const visibleNotifications=notifications.filter(row=>!unreadOnly||!readNotifications.has(notificationKey(row)));
  useEffect(()=>{setReadNotifications(new Set());setNotifications([]);setNotificationsOpen(false);},[profile?.employee_id]);
  useEffect(()=>{
    if(!profile?.employee_id)return;
    let active=true;setNotificationsLoading(true);setNotificationError("");
    Promise.all([kitchenAccountingApi.financialRequests(),kitchenAccountingApi.refundRequests()])
      .then(([financial,refunds])=>{if(active)setNotifications([...new Map([...financial,...refunds].map(row=>[row.id,row])).values()].sort((a,b)=>Date.parse(b.decided_at??b.requested_at)-Date.parse(a.decided_at??a.requested_at)));})
      .catch(cause=>{if(active)setNotificationError(apiErrorMessage(cause,"Không tải được thông báo kế toán."));})
      .finally(()=>{if(active)setNotificationsLoading(false);});
    return()=>{active=false;};
  },[profile?.employee_id,notificationVersion]);
  useEffect(()=>{if(!profile?.employee_id)return;const timer=window.setInterval(()=>setNotificationVersion(value=>value+1),60000);return()=>window.clearInterval(timer);},[profile?.employee_id]);
  useEffect(()=>{
    if(!notificationsOpen)return;
    const outside=(event:PointerEvent)=>{if(!notificationPanel.current?.contains(event.target as Node))setNotificationsOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setNotificationsOpen(false);notificationButton.current?.focus();}};
    document.addEventListener("pointerdown",outside);document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
  },[notificationsOpen]);
  const openNotification=(row:Approval)=>{
    setReadNotifications(current=>new Set([...current,notificationKey(row)]));setNotificationsOpen(false);
    onPageChange(row.target_id.startsWith("finance:expense:")||row.target_id.startsWith("finance:settlement:")?"debt":"vat");onRefresh();
  };
  const current=pages.find(item=>item.id===page)!;
  const name=profile?.full_name||(loading?"Đang tải hồ sơ…":"Không có hồ sơ");
  const initials=profile?.full_name?.trim().split(/\s+/).slice(-2).map(part=>part[0]).join("").toUpperCase()||(loading?"…":"?");
  const role=profile?.role?employeeRoleLabel(profile.role):"Kế toán";
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setMenuOpen(false);};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close);},[]);
  return <div className="accounting-workspace">
    {menuOpen&&<button className="acct-sidebar-scrim" aria-label="Đóng điều hướng" onClick={()=>setMenuOpen(false)}/>}
    <aside className={`acct-sidebar${menuOpen?" is-open":""}`}>
      <div className="acct-brand"><img src="/hotel_logo.png" alt="MaM Hotel"/><div><strong>MaM Hotel</strong><span>KẾ TOÁN & TÀI CHÍNH</span></div><button className="acct-drawer-close" aria-label="Đóng menu" onClick={()=>setMenuOpen(false)}><X size={18}/></button></div>
      <nav aria-label="Điều hướng Kế toán" className="acct-nav"><p>KHÔNG GIAN LÀM VIỆC</p>{pages.map(item=><button key={item.id} aria-current={page===item.id?"page":undefined} onClick={()=>{onPageChange(item.id);setMenuOpen(false);}}><item.Icon size={18} strokeWidth={1.7}/><span>{item.label}</span></button>)}</nav>
      <div className="acct-sidebar-person"><span className="acct-avatar">{initials}</span><div><strong>{name}</strong><small>{role}</small></div></div>
      <button className="acct-logout" onClick={onLogout}><LogOut size={15}/>Đăng xuất</button>
    </aside>
    <div className="acct-main">
      <header className="acct-topbar">
        <button className="acct-menu-toggle acct-icon-button" aria-label="Mở điều hướng Kế toán" aria-expanded={menuOpen} onClick={()=>setMenuOpen(value=>!value)}><Menu size={20}/></button>
        <div className="acct-search"><Search size={17}/><input aria-label="Tìm kiếm kế toán" value={search} onChange={event=>onSearchChange(event.target.value)} placeholder={page==="vat"?"Tìm hóa đơn theo mã đặt phòng...":"Tra giao dịch: PAY, INV hoặc mã đặt phòng..."}/></div>
        <div className="acct-topbar-actions"><div className="acct-notifications" ref={notificationPanel}>
          <button ref={notificationButton} className="acct-icon-button acct-notification-trigger" aria-label={`Thông báo kế toán${unreadCount?`, ${unreadCount} chưa đọc`:""}`} aria-expanded={notificationsOpen} aria-controls="acct-notification-list" title="Thông báo" onClick={()=>{setNotificationsOpen(value=>!value);if(!notificationsOpen){setProfileOpen(false);setNotificationVersion(value=>value+1);}}}><Bell size={19}/>{unreadCount>0&&<span className="acct-notification-badge" aria-hidden="true">{unreadCount>99?"99+":unreadCount}</span>}</button>
          {notificationsOpen&&<section id="acct-notification-list" className="acct-notification-panel" aria-label="Danh sách thông báo kế toán">
            <header><div><h2>Thông báo kế toán</h2><p>Cập nhật yêu cầu thu, chi và hoàn tiền</p></div><button className="acct-icon-button" aria-label="Đóng thông báo" onClick={()=>{setNotificationsOpen(false);notificationButton.current?.focus();}}><X size={17}/></button></header>
            <div className="acct-notification-tools"><div><button aria-pressed={!unreadOnly} onClick={()=>setUnreadOnly(false)}>Tất cả</button><button aria-pressed={unreadOnly} onClick={()=>setUnreadOnly(true)}>Chưa đọc {unreadCount}</button></div><button title="Đánh dấu tất cả đã đọc" aria-label="Đánh dấu tất cả đã đọc" onClick={()=>setReadNotifications(new Set(notifications.map(notificationKey)))} disabled={!unreadCount}><CheckCheck size={18}/></button></div>
            <div className="acct-notification-items">
              {notificationsLoading&&<p className="acct-notification-empty" role="status">Đang tải thông báo…</p>}
              {notificationError&&<p className="acct-notification-empty" role="alert">{notificationError}</p>}
              {!notificationsLoading&&!notificationError&&!visibleNotifications.length&&<div className="acct-notification-empty"><Bell size={28}/><p>{unreadOnly?"Bạn đã đọc hết thông báo.":"Chưa có thông báo mới."}</p></div>}
              {!notificationError&&visibleNotifications.map(row=>{
                const unread=!readNotifications.has(notificationKey(row));
                const kind=row.action==="PAYMENT_REFUND"?"Hoàn tiền":row.target_id.startsWith("finance:payment:")?"Thu tiền":"Chi tiền";
                const status=({PENDING:"Chờ Giám đốc duyệt",APPROVED:"Đã duyệt — chờ thực hiện",REJECTED:"Yêu cầu bị từ chối",EXPIRED:"Yêu cầu đã hết hạn",CONSUMED:"Đã thực hiện"} as Record<string,string>)[row.status]??row.status;
                return <button key={row.id} className={`acct-notification-item${unread?" is-unread":""}`} onClick={()=>openNotification(row)}><span className={`acct-notification-symbol ${row.status.toLowerCase()}`}><FileText size={19}/></span><span className="acct-notification-copy"><strong>{kind} · {formatVnd(row.amount??0)}</strong><span>{status}</span><p>{row.reason}</p><small>{formatDateTimeVi(row.decided_at??row.requested_at)}</small></span>{unread&&<i aria-label="Chưa đọc"/>}</button>;
              })}
            </div>
            <footer><button onClick={()=>{setNotificationVersion(value=>value+1);onRefresh();}} disabled={notificationsLoading}><RefreshCcw size={15}/>Tải lại thông báo</button></footer>
          </section>}
        </div>
          <div className="acct-profile"><button className="acct-profile-trigger" aria-label="Hồ sơ nhân viên kế toán" aria-expanded={profileOpen} onClick={()=>setProfileOpen(value=>!value)}><span className="acct-avatar">{initials}</span><span className="acct-profile-name"><strong>{name}</strong><small>{role}</small></span><ChevronDown size={15}/></button>
            <EmployeeProfileDropdown isOpen={profileOpen} onClose={()=>setProfileOpen(false)} onLogout={onLogout} align="top-right" currentRoleLabel={role} departmentName="Bộ phận Kế toán"/>
          </div>
        </div>
      </header>
      <div className="acct-workspace-scroll" key={page}>
        <section className="acct-page-heading"><div><p className="acct-eyebrow">KẾ TOÁN & TÀI CHÍNH</p><h1>{current.title}</h1><p className="acct-page-description">{current.description}</p></div><label className="acct-date"><CalendarDays size={17}/><input aria-label="Ngày đối soát" type="date" value={date} onChange={event=>{if(event.target.value)onDateChange(event.target.value);}}/></label></section>
        <div className="acct-alerts">{alerts}</div>
        <section className="acct-metrics" aria-label="Tổng hợp tài chính trong ngày">{metrics.map((metric,index)=><article className="acct-metric" key={metric.label}><span className="acct-metric-icon" style={{background:metric.iconBg,color:metric.iconColor}}><metric.Icon size={22}/></span><div><p>{metric.label}</p><strong className={index===5?"acct-metric-pending":""}>{metric.val}</strong><small title={metric.sub}>{metric.sub}</small></div></article>)}</section>
        <main className="acct-content">{children}</main>
        <footer className="acct-workspace-footer"><span>MaM Hotel · Kế toán & Tài chính</span><span>Ngày làm việc: {date.split("-").reverse().join("/")}</span></footer>
      </div>
    </div>
  </div>;
}
