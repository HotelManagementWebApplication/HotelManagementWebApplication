import { useState } from "react";
import { enterpriseApi } from "../../shared/api/enterprise";
import { apiErrorMessage } from "../../shared/api/client";
import { EMPLOYEE_ROLES, employeeRoleLabel } from "../../shared/types/api";

export function EmployeeProvisionModal({ role, onClose, onCreated }: { role: "manager" | "director"; onClose: () => void; onCreated: () => void }) {
  const roles = role === "director" ? EMPLOYEE_ROLES : EMPLOYEE_ROLES.filter(item => ["HR", "FRONT_DESK", "HOUSEKEEPING", "TECHNICAL", "KITCHEN", "ACCOUNTING"].includes(item));
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", role: "FRONT_DESK" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ employee_id: string; temporary_password: string } | null>(null);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
    <form role="dialog" aria-modal="true" aria-labelledby="employee-provision-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onSubmit={async event => {
      event.preventDefault(); if (saving || created) return; setSaving(true); setError(null);
      try { const result = await enterpriseApi.autoProvisionEmployee({ ...form, full_name: form.full_name.trim(), phone: form.phone.trim(), email: form.email.trim() }); setCreated(result); onCreated(); }
      catch (cause) { setError(apiErrorMessage(cause, "Không thể thêm nhân viên.")); }
      finally { setSaving(false); }
    }}>
      <h2 id="employee-provision-title" className="text-lg font-bold text-slate-900">Thêm nhân viên</h2>
      {created ? <div className="mt-4 space-y-3 text-sm">
        <p role="status" className="text-green-700">Đã tạo nhân viên {created.employee_id}. Hồ sơ đã có trong hệ thống.</p>
        <p>Mật khẩu tạm: <strong className="font-mono">{created.temporary_password}</strong></p>
        <p className="text-slate-600">Gửi mật khẩu tạm cho đúng nhân viên. Hệ thống yêu cầu đổi mật khẩu ở lần đăng nhập đầu.</p>
      </div> : <div className="mt-4 space-y-3 text-sm">
        <p className="text-slate-600">Tạo hồ sơ và tài khoản để HR tiếp nhận, phân ca và ghi nhận chấm công.</p>
        <label className="block">Họ tên *<input required minLength={2} maxLength={150} value={form.full_name} onChange={event => setForm({ ...form, full_name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
        <label className="block">Email *<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
        <label className="block">Điện thoại *<input required type="tel" pattern="[0-9+ ()-]{9,20}" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
        <label className="block">Vai trò *<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">{roles.map(item => <option key={item} value={item}>{employeeRoleLabel(item)}</option>)}</select></label>
      </div>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">{created ? "Đóng" : "Hủy"}</button>
        {!created && <button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Đang tạo…" : "Tạo nhân viên"}</button>}
      </div>
    </form>
  </div>;
}
