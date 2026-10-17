import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Download, Eye, FilePlus2, Pencil, Printer, RefreshCw, X } from "lucide-react";
import { personnelApi, type PersonnelDetails, type PersonnelProfile, type OnboardingRequest, type OnboardingStatus, type OnboardingDecision } from "../../shared/api/personnel";
import { apiErrorMessage } from "../../shared/api/client";
import { EMPLOYEE_ROLES, employeeRoleLabel, type EmployeeRole } from "../../shared/types/api";
import { downloadCsv } from "../../shared/utils/csv";
import { localDateValue } from "../../shared/utils/localDate";

const primary = "inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-50";
const secondary = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const field = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100";
const statusLabels: Record<OnboardingStatus, string> = { DRAFT: "Bản nháp", PENDING: "Chờ duyệt", NEEDS_REVISION: "Cần bổ sung", REJECTED: "Bị từ chối", APPROVED: "Đã duyệt" };
const contracts = { PROBATION: "Thử việc", PERMANENT: "Không thời hạn", FIXED_TERM: "Có thời hạn", SEASONAL: "Thời vụ" };
const genders = { MALE: "Nam", FEMALE: "Nữ", OTHER: "Khác", UNDISCLOSED: "Không cung cấp" };
const blankDetails = (): PersonnelDetails => ({ full_name: "", phone: null, email: null, address: null, gender: null, birth_date: null, identity_number: null, hire_date: null, contract_type: null });
const dateLabel = (date: string | null) => date ? date.split("-").reverse().join("/") : "Chưa cập nhật";
const timeLabel = (time: string | null) => time ? new Date(time).toLocaleString("vi-VN") : "—";
const statusColor = (status: OnboardingStatus) => ({ DRAFT: "bg-slate-100 text-slate-700", PENDING: "bg-amber-100 text-amber-800", NEEDS_REVISION: "bg-blue-100 text-blue-800", REJECTED: "bg-rose-100 text-rose-800", APPROVED: "bg-emerald-100 text-emerald-800" }[status]);
const detailsRows = (details: PersonnelDetails): [string, string][] => [
  ["Họ tên", details.full_name], ["Điện thoại", details.phone || "Chưa cập nhật"], ["Email", details.email || "Chưa cập nhật"],
  ["Địa chỉ", details.address || "Chưa cập nhật"], ["Giới tính", details.gender ? genders[details.gender] : "Chưa cập nhật"],
  ["Ngày sinh", dateLabel(details.birth_date)], ["CCCD / CMND", details.identity_number || "Chưa cập nhật"],
  ["Ngày vào làm", dateLabel(details.hire_date)], ["Loại hợp đồng", details.contract_type ? contracts[details.contract_type] : "Chưa cập nhật"],
];

function Dialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const id = useId(); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => previous?.focus();
  }, []);
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-3 sm:p-6">
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white font-sans text-slate-900 shadow-xl outline-none" onKeyDown={event => {
      if (event.key === "Escape" && !busy) onClose();
      if (event.key !== "Tab") return;
      const items = ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]');
      if (!items?.length) { event.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><h2 id={id} className="text-lg font-bold">{title}</h2><button type="button" aria-label="Đóng cửa sổ" disabled={busy} onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button></div>
      <div className="p-5">{children}</div>
    </div>
  </div>;
}

function DetailsFields({ value, onChange, complete, coreRequired = false }: { value: PersonnelDetails; onChange: (value: PersonnelDetails) => void; complete: boolean; coreRequired?: boolean }) {
  const set = (key: keyof PersonnelDetails, text: string) => onChange({ ...value, [key]: text || null });
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <label className="text-sm font-medium">Họ tên *<input className={field} required minLength={2} maxLength={100} value={value.full_name} onChange={event => onChange({ ...value, full_name: event.target.value })} autoComplete="name" /></label>
    <label className="text-sm font-medium">Điện thoại{complete || coreRequired ? " *" : ""}<input className={field} required={complete || coreRequired} type="tel" pattern="[0-9+ ().\-]{9,25}" maxLength={25} value={value.phone || ""} onChange={event => set("phone", event.target.value)} autoComplete="tel" /></label>
    <label className="text-sm font-medium">Email{complete ? " *" : ""}<input className={field} required={complete} type="email" maxLength={150} value={value.email || ""} onChange={event => set("email", event.target.value)} autoComplete="email" /></label>
    <label className="text-sm font-medium">Giới tính{complete ? " *" : ""}<select className={field} required={complete} value={value.gender || ""} onChange={event => set("gender", event.target.value)}><option value="">Chọn giới tính</option>{Object.entries(genders).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label className="text-sm font-medium">Ngày sinh{complete ? " *" : ""}<input className={field} required={complete} type="date" max={localDateValue()} value={value.birth_date || ""} onChange={event => set("birth_date", event.target.value)} /></label>
    <label className="text-sm font-medium">CCCD / CMND{complete ? " *" : ""}<input className={field} required={complete} inputMode="numeric" pattern="[0-9]{9}|[0-9]{12}" maxLength={12} value={value.identity_number || ""} onChange={event => set("identity_number", event.target.value)} /><span className="mt-1 block text-xs font-normal text-slate-500">9 hoặc 12 chữ số</span></label>
    <label className="text-sm font-medium">Ngày vào làm{complete ? " *" : ""}<input className={field} required={complete} type="date" value={value.hire_date || ""} onChange={event => set("hire_date", event.target.value)} /></label>
    <label className="text-sm font-medium">Loại hợp đồng{complete ? " *" : ""}<select className={field} required={complete} value={value.contract_type || ""} onChange={event => set("contract_type", event.target.value)}><option value="">Chọn loại hợp đồng</option>{Object.entries(contracts).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label className="text-sm font-medium sm:col-span-2">Địa chỉ<input className={field} maxLength={255} value={value.address || ""} onChange={event => set("address", event.target.value)} autoComplete="street-address" /></label>
  </div>;
}

function DetailsList({ details }: { details: PersonnelDetails }) {
  return <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">{detailsRows(details).map(([label, value]) => <div key={label} className="min-w-0 rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900">{value}</dd></div>)}</dl>;
}

function printableDocument(profile: PersonnelProfile): string {
  const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
  const rows = [["Mã nhân viên", profile.employee_id], ["Vai trò", employeeRoleLabel(profile.role)], ...detailsRows(profile.details), ["Cập nhật lúc", timeLabel(profile.updated_at)], ["Người cập nhật", profile.updated_by || "—"]];
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Hồ sơ ${escape(profile.employee_id)}</title><style>body{font:14px Arial,sans-serif;color:#142d25;margin:40px}h1{font-size:24px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px;border-bottom:1px solid #ddd;overflow-wrap:anywhere}th{width:32%}p{color:#52625d}@page{size:A4;margin:18mm}@media print{body{margin:0}button{display:none}}</style></head><body><h1>MaM Hotel · Hồ sơ nhân viên</h1><p>Ngày in: ${escape(new Date().toLocaleString("vi-VN"))}</p><table>${rows.map(([key, value]) => `<tr><th>${escape(key)}</th><td>${escape(value)}</td></tr>`).join("")}</table></body></html>`;
}

function PersonnelPrintDialog({ profile, onClose }: { profile: PersonnelProfile; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const documentHtml = useRef(printableDocument(profile));
  return <Dialog title={`Bản in hồ sơ · ${profile.employee_id}`} onClose={onClose}>
    <p className="mb-3 text-sm text-slate-600">Bản in chỉ gồm hồ sơ nhân viên đang chọn. Chọn “In / Lưu PDF” để mở hộp thoại in của trình duyệt.</p>
    <iframe ref={frame} title={`Bản in hồ sơ ${profile.employee_id}`} srcDoc={documentHtml.current} onLoad={() => setReady(true)} className="h-[58vh] w-full rounded-lg border border-slate-200 bg-white" />
    {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    <div className="mt-4 flex justify-end gap-2"><button type="button" className={secondary} onClick={onClose}>Đóng bản in</button><button type="button" disabled={!ready} className={primary} onClick={() => { try { if (!frame.current?.contentWindow) throw new Error(); frame.current.contentWindow.focus(); frame.current.contentWindow.print(); } catch { setError("Trình duyệt chưa mở được hộp thoại in. Hãy thử lại khi bản in tải xong."); } }}><Printer size={16} />In / Lưu PDF</button></div>
  </Dialog>;
}

function useMutationKeys() {
  const keys = useRef(new Map<string, string>());
  return (operation: string, body: unknown) => {
    const fingerprint = operation + JSON.stringify(body);
    if (!keys.current.has(fingerprint)) keys.current.set(fingerprint, crypto.randomUUID());
    return keys.current.get(fingerprint)!;
  };
}

function PersonnelEditor({ profile, request, onClose, onSaved }: { profile?: PersonnelProfile; request?: OnboardingRequest; onClose: () => void; onSaved: (outcome: "profile" | "draft" | "submitted") => void }) {
  const [details, setDetails] = useState<PersonnelDetails>({ ...(profile?.details || request?.details || blankDetails()) });
  const [proposedRole, setProposedRole] = useState<EmployeeRole>(request?.proposed_role || "FRONT_DESK");
  const [reason, setReason] = useState(profile ? "" : request?.reason || "");
  const [draft, setDraft] = useState(request);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const id = useRef(request?.id || crypto.randomUUID()); const mutationKey = useMutationKeys();
  const pendingSubmission = useRef<{ fingerprint: string; request: OnboardingRequest } | null>(null);
  const completeError = () => !details.phone || !details.email || !details.gender || !details.birth_date || !details.identity_number || !details.hire_date || !details.contract_type;
  const save = async (submit: boolean) => {
    if (busy) return;
    if (submit && completeError()) { setError("Cần đủ thông tin hồ sơ trước khi gửi duyệt. Hãy bổ sung các trường còn trống."); return; }
    setBusy(true); setError(null);
    try {
      if (profile) {
        const body = { details, version: profile.version, reason: reason.trim() };
        await personnelApi.update(profile.employee_id, body, mutationKey("profile", body));
      } else {
        const body = { details, proposed_role: proposedRole, reason: reason.trim(), version: draft?.version || 0 };
        const fingerprint = JSON.stringify({ details, proposedRole, reason: reason.trim() });
        const saved = submit && pendingSubmission.current?.fingerprint === fingerprint ? pendingSubmission.current.request : await personnelApi.save(id.current, body, mutationKey("draft", body));
        setDraft(saved);
        if (submit) {
          pendingSubmission.current = { fingerprint, request: saved };
          await personnelApi.submit(saved.id, saved.version, mutationKey("submit", { id: saved.id, version: saved.version }));
        }
      }
      onSaved(profile ? "profile" : submit ? "submitted" : "draft"); onClose();
    } catch (cause) { setError(apiErrorMessage(cause, "Không thể lưu hồ sơ. Vui lòng thử lại.")); }
    finally { setBusy(false); }
  };
  return <Dialog title={profile ? `Cập nhật hồ sơ · ${profile.employee_id}` : request ? "Chỉnh sửa đề nghị tiếp nhận" : "Lập đề nghị tiếp nhận nhân viên"} onClose={onClose} busy={busy}>
    <form onSubmit={event => { event.preventDefault(); const submitter = (event.nativeEvent as SubmitEvent).submitter; void save(submitter?.getAttribute("data-action") === "submit"); }}>
      <p className="mb-5 text-sm leading-6 text-slate-600">{profile ? "Thông tin hồ sơ được cập nhật cho cùng mã nhân viên. Mọi thay đổi có lưu người thao tác và lý do." : "Lưu nháp để bổ sung dần. Khi gửi duyệt, hồ sơ phải đầy đủ; tài khoản chỉ được tạo sau khi Quản lý hoặc Giám đốc chấp thuận."}</p>
      {request?.decision_reason && <p className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Ý kiến của {request.reviewer}: {request.decision_reason}</p>}
      <fieldset disabled={busy} className="space-y-4"><DetailsFields value={details} onChange={setDetails} complete={false} coreRequired={Boolean(profile)} />
        {!profile && <label className="block text-sm font-medium">Vai trò đề xuất *<select className={field} value={proposedRole} onChange={event => setProposedRole(event.target.value as EmployeeRole)}>{EMPLOYEE_ROLES.map(role => <option key={role} value={role}>{employeeRoleLabel(role)}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">Đề nghị Quản lý, Admin hoặc Giám đốc sẽ do Giám đốc xét duyệt.</span></label>}
        <label className="block text-sm font-medium">{profile ? "Lý do cập nhật" : "Lý do tiếp nhận"} *<textarea className={field} required maxLength={500} rows={3} value={reason} onChange={event => setReason(event.target.value)} /></label>
      </fieldset>
      {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error} {error.includes("tải lại") && "Đóng cửa sổ và bấm Tải lại để lấy hồ sơ mới nhất."}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
        <button className={secondary} type="button" disabled={busy} onClick={onClose}>Hủy</button>
        <button className={profile ? primary : secondary} type="submit" disabled={busy}>{busy ? "Đang lưu…" : profile ? "Lưu hồ sơ" : "Lưu nháp"}</button>
        {!profile && <button className={primary} type="submit" data-action="submit" disabled={busy}>{busy ? "Đang xử lý…" : "Lưu và gửi duyệt"}</button>}
      </div>
    </form>
  </Dialog>;
}

export function OnboardingReviewDialog({ request, initialDecision = "APPROVE", onClose, onChanged }: { request: OnboardingRequest; initialDecision?: OnboardingDecision; onClose: () => void; onChanged: () => void }) {
  const [decision, setDecision] = useState<OnboardingDecision>(initialDecision);
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ request: OnboardingRequest; temporary_password: string | null } | null>(null);
  const mutationKey = useMutationKeys();
  const item = result?.request || request;
  return <Dialog title={`Đề nghị tiếp nhận · ${item.details.full_name}`} onClose={onClose} busy={busy}>
    <div className="mb-4 flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor(item.status)}`}>{statusLabels[item.status]}</span><span className="text-sm text-slate-600">Vai trò đề xuất: <strong>{employeeRoleLabel(item.proposed_role)}</strong></span></div>
    <DetailsList details={item.details} />
    <dl className="my-4 space-y-2 text-sm"><div><dt className="font-semibold">Lý do tiếp nhận</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-600">{item.reason}</dd></div><div><dt className="font-semibold">Người lập</dt><dd>{item.requester} · {timeLabel(item.created_at)}</dd></div>{item.decision_reason && <div className="rounded-lg bg-slate-50 p-3"><dt className="font-semibold">Ý kiến xét duyệt · {item.reviewer}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{item.decision_reason}</dd></div>}</dl>
    {result?.request.status === "APPROVED" && <div role="status" className="my-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-bold">Đã cấp tài khoản {result.request.employee_id}</p>{result.temporary_password ? <><p className="mt-2">Mật khẩu tạm: <strong className="select-all font-mono">{result.temporary_password}</strong></p><p className="mt-2">Ghi lại và bàn giao riêng cho nhân viên. Mật khẩu chỉ hiển thị ở kết quả cấp tài khoản lần đầu; nhân viên phải đổi khi đăng nhập.</p></> : <p className="mt-2">Tài khoản đã được cấp trước đó. Nếu chưa nhận được mật khẩu, liên hệ người có quyền đặt lại mật khẩu.</p>}</div>}
    {request.can_review && !result ? <form onSubmit={async event => {
      event.preventDefault(); if (busy || !reason.trim()) return; setBusy(true); setError(null);
      const body = { decision, reason: reason.trim(), version: request.version };
      try { setResult(await personnelApi.review(request.id, body, mutationKey("review", body))); onChanged(); }
      catch (cause) { setError(apiErrorMessage(cause, "Không thể xét duyệt. Hãy tải lại hồ sơ và thử lại.")); }
      finally { setBusy(false); }
    }} className="mt-5 space-y-4 border-t border-slate-200 pt-4">
      <label className="block text-sm font-medium">Quyết định<select disabled={busy} className={field} value={decision} onChange={event => setDecision(event.target.value as OnboardingDecision)}><option value="APPROVE">Phê duyệt và cấp tài khoản</option><option value="REQUEST_REVISION">Yêu cầu HR bổ sung</option><option value="REJECT">Từ chối tiếp nhận</option></select></label>
      <label className="block text-sm font-medium">Lý do xét duyệt *<textarea disabled={busy} required maxLength={500} className={field} rows={3} value={reason} onChange={event => setReason(event.target.value)} /></label>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} className={secondary} onClick={onClose}>Đóng</button><button type="submit" disabled={busy || !reason.trim()} className={primary}>{busy ? "Đang xử lý…" : decision === "APPROVE" ? "Xác nhận duyệt và cấp tài khoản" : decision === "REQUEST_REVISION" ? "Gửi yêu cầu bổ sung" : "Xác nhận từ chối"}</button></div>
    </form> : <div className="mt-5 flex justify-end"><button type="button" className={secondary} onClick={onClose}>Đóng</button></div>}
  </Dialog>;
}

export function PersonnelWorkspace({ mode, onChanged, search = "" }: { mode: "hr" | "manager" | "director"; onChanged: () => void; search?: string }) {
  const [tab, setTab] = useState<"profiles" | "onboarding">(mode === "hr" ? "profiles" : "onboarding");
  const [profiles, setProfiles] = useState<PersonnelProfile[]>([]); const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [epoch, setEpoch] = useState(0); const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OnboardingStatus | "all">(mode === "hr" ? "all" : "PENDING");
  const [roleFilter, setRoleFilter] = useState("all"); const [employmentFilter, setEmploymentFilter] = useState("all");
  const [editor, setEditor] = useState<{ profile?: PersonnelProfile; request?: OnboardingRequest } | null>(null);
  const [detail, setDetail] = useState<PersonnelProfile | null>(null); const [review, setReview] = useState<OnboardingRequest | null>(null);
  const [printingProfile, setPrintingProfile] = useState<PersonnelProfile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    let active = true; setLoading(true); setError(null);
    Promise.all([personnelApi.profiles(), personnelApi.requests()]).then(([people, pending]) => { if (active) { setProfiles(people); setRequests(pending); } }).catch(cause => { if (active) setError(apiErrorMessage(cause, "Không thể tải hồ sơ nhân sự. Vui lòng thử lại.")); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [epoch, mode]);
  const refresh = () => { setEpoch(value => value + 1); onChanged(); };
  const searchText = `${search} ${query}`.trim().toLocaleLowerCase("vi");
  const matches = (text: string) => searchText.split(/\s+/).every(part => text.toLocaleLowerCase("vi").includes(part));
  const shownProfiles = profiles.filter(person => matches(`${person.employee_id} ${person.details.full_name} ${person.details.phone || ""} ${employeeRoleLabel(person.role)}`) && (roleFilter === "all" || person.role === roleFilter) && (employmentFilter === "all" || person.employment_status === employmentFilter));
  const shownRequests = requests.filter(item => (filter === "all" || item.status === filter) && matches(`${item.details.full_name} ${item.details.phone || ""} ${employeeRoleLabel(item.proposed_role)} ${item.employee_id || ""}`));
  const pending = requests.filter(item => item.status === "PENDING").length;
  return <section className="min-w-0 space-y-4 font-sans text-slate-900">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Hồ sơ & Tiếp nhận nhân viên</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{mode === "hr" ? "Lập đề nghị tiếp nhận, theo dõi xét duyệt và cập nhật hồ sơ nhân viên đã được cấp tài khoản." : "Xem hồ sơ HR gửi, yêu cầu bổ sung hoặc phê duyệt để cấp tài khoản theo đúng thẩm quyền."}</p></div><div className="flex flex-wrap gap-2"><button type="button" className={secondary} disabled={loading} onClick={refresh}><RefreshCw size={16} />Tải lại</button>{mode === "hr" && <button type="button" className={primary} disabled={loading || Boolean(error)} onClick={() => setEditor({})}><FilePlus2 size={16} />Lập đề nghị tiếp nhận</button>}</div></div>
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Hồ sơ nhân sự">
      <button type="button" role="tab" aria-selected={tab === "profiles"} onClick={() => setTab("profiles")} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === "profiles" ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500"}`}>Hồ sơ nhân viên ({profiles.length})</button>
      <button type="button" role="tab" aria-selected={tab === "onboarding"} onClick={() => setTab("onboarding")} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === "onboarding" ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500"}`}>Đề nghị tiếp nhận · {pending} chờ duyệt</button>
    </div>
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error} <button className="underline" onClick={refresh}>Thử lại</button></p>}
    {loading ? <p role="status" className="p-6 text-sm text-slate-500">Đang tải hồ sơ…</p> : !error && <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><label className="min-w-48 flex-1 text-xs font-medium text-slate-600">Tìm nhân viên<input type="search" value={query} onChange={event => setQuery(event.target.value)} className={field} placeholder="Tên, mã nhân viên, điện thoại…" /></label>
        {tab === "profiles" ? <><label className="text-xs font-medium text-slate-600">Bộ phận / Vai trò<select className={field} value={roleFilter} onChange={event => setRoleFilter(event.target.value)}><option value="all">Tất cả bộ phận</option>{EMPLOYEE_ROLES.map(role => <option value={role} key={role}>{employeeRoleLabel(role)}</option>)}</select></label><label className="text-xs font-medium text-slate-600">Trạng thái làm việc<select className={field} value={employmentFilter} onChange={event => setEmploymentFilter(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="WORKING">Đang làm việc</option><option value="ON_LEAVE">Đang nghỉ phép</option><option value="TERMINATED">Đã nghỉ việc</option></select></label><button type="button" className={secondary} disabled={!shownProfiles.length} onClick={() => downloadCsv(`ho-so-nhan-su-${localDateValue()}.csv`, [["Mã NV", "Họ tên", "Vai trò", "Email", "Điện thoại", "Ngày vào làm", "Loại hợp đồng", "Trạng thái"], ...shownProfiles.map(person => [person.employee_id, person.details.full_name, employeeRoleLabel(person.role), person.details.email || "", person.details.phone || "", person.details.hire_date || "", person.details.contract_type ? contracts[person.details.contract_type] : "", { WORKING: "Đang làm việc", ON_LEAVE: "Đang nghỉ phép", TERMINATED: "Đã nghỉ việc" }[person.employment_status]])])}><Download size={16} />Xuất CSV (Excel)</button></> : <label className="text-xs font-medium text-slate-600">Trạng thái đề nghị<select className={field} value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option value="all">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr>{(tab === "profiles" ? ["Nhân viên", "Liên hệ", "Hợp đồng / Ngày vào làm", "Trạng thái", "Thao tác"] : ["Hồ sơ đề nghị", "Vai trò đề xuất", "Trạng thái", "Người lập / Ngày gửi", "Thao tác"]).map(label => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{tab === "profiles" ? shownProfiles.map(person => <tr key={person.employee_id}><td className="px-4 py-4"><p className="font-semibold">{person.details.full_name}</p><p className="mt-1 text-xs text-slate-500">{person.employee_id} · {employeeRoleLabel(person.role)}</p></td><td className="px-4 py-4"><p>{person.details.phone || "—"}</p><p className="mt-1 text-xs text-slate-500">{person.details.email || "Chưa có email"}</p></td><td className="px-4 py-4"><p>{person.details.contract_type ? contracts[person.details.contract_type] : "Chưa cập nhật"}</p><p className="mt-1 text-xs text-slate-500">{dateLabel(person.details.hire_date)}</p></td><td className="px-4 py-4 text-xs"><p>{{ WORKING: "Đang làm việc", ON_LEAVE: "Đang nghỉ phép", TERMINATED: "Đã nghỉ việc" }[person.employment_status]}</p><p className={`mt-1 ${person.enabled ? "text-emerald-700" : "text-rose-700"}`}>{person.enabled ? "Tài khoản hoạt động" : "Tài khoản đã khóa"}</p></td><td className="px-4 py-4"><button className={secondary} onClick={() => setDetail(person)}><Eye size={15} />Xem hồ sơ</button></td></tr>) : shownRequests.map(item => <tr key={item.id}><td className="px-4 py-4"><p className="font-semibold">{item.details.full_name}</p><p className="mt-1 text-xs text-slate-500">{item.employee_id || "Chưa cấp tài khoản"}</p></td><td className="px-4 py-4">{employeeRoleLabel(item.proposed_role)}</td><td className="px-4 py-4"><span className={`inline-block whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${statusColor(item.status)}`}>{statusLabels[item.status]}</span></td><td className="px-4 py-4"><p>{item.requester}</p><p className="mt-1 text-xs text-slate-500">{timeLabel(item.submitted_at || item.created_at)}</p></td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button className={secondary} onClick={() => setReview(item)}>{item.can_review ? "Xem và xét duyệt" : "Xem đề nghị"}</button>{item.can_edit && <button className={secondary} onClick={() => setEditor({ request: item })}><Pencil size={15} />Chỉnh sửa</button>}</div></td></tr>)}
          {(tab === "profiles" ? !shownProfiles.length : !shownRequests.length) && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">{tab === "profiles" ? "Không có nhân viên phù hợp bộ lọc." : "Không có đề nghị phù hợp bộ lọc."}</td></tr>}
        </tbody></table></div>
    </>}
    {editor && <PersonnelEditor profile={editor.profile} request={editor.request} onClose={() => setEditor(null)} onSaved={outcome => { setNotice(outcome === "profile" ? "Đã lưu hồ sơ nhân viên." : outcome === "submitted" ? "Đã gửi đề nghị cho Quản lý/Giám đốc xét duyệt. Chưa cấp tài khoản." : "Đã lưu hồ sơ nháp. Chưa gửi duyệt và chưa cấp tài khoản."); setTab(editor.profile ? "profiles" : "onboarding"); refresh(); }} />}
    {detail && <Dialog title={`Hồ sơ nhân viên · ${detail.employee_id}`} onClose={() => setDetail(null)}><p className="mb-4 text-sm text-slate-600">{employeeRoleLabel(detail.role)} · Cập nhật: {timeLabel(detail.updated_at)}{detail.updated_by ? ` · ${detail.updated_by}` : ""}</p><DetailsList details={detail.details} /><div className="mt-5 flex flex-wrap justify-end gap-2"><button className={secondary} onClick={() => { setPrintingProfile(detail); setDetail(null); }}><Printer size={16} />In hồ sơ</button>{mode === "hr" && <button className={primary} onClick={() => { setEditor({ profile: detail }); setDetail(null); }}><Pencil size={16} />Cập nhật hồ sơ</button>}<button className={secondary} onClick={() => setDetail(null)}>Đóng</button></div></Dialog>}
    {printingProfile && <PersonnelPrintDialog profile={printingProfile} onClose={() => { setDetail(printingProfile); setPrintingProfile(null); }} />}
    {review && <OnboardingReviewDialog request={review} onClose={() => setReview(null)} onChanged={refresh} />}
  </section>;
}
