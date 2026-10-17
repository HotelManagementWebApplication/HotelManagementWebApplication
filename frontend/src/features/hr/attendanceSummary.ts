import type { AttendanceRecord, LeaveRequest } from "../../shared/types/enterprise";

/** Inclusive calendar days, clipped to the requested month and deduplicated. */
export function approvedLeaveDays(employeeId: string, month: string, leaves: LeaveRequest[]) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return new Set<string>();
  const first = `${month}-01`;
  const nextMonth = new Date(`${first}T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const after = nextMonth.toISOString().slice(0, 10);
  const days = new Set<string>();
  for (const leave of leaves) {
    if (leave.employee_id !== employeeId || leave.status !== "APPROVED" || leave.leave_type === "SHIFT_CHANGE") continue;
    const start = leave.start_date > first ? leave.start_date : first;
    const end = leave.end_date < after ? leave.end_date : after;
    for (let day = new Date(`${start}T00:00:00Z`); Number.isFinite(day.getTime()); day.setUTCDate(day.getUTCDate() + 1)) {
      const key = day.toISOString().slice(0, 10);
      if (key > end || key >= after) break;
      days.add(key);
    }
  }
  return days;
}

export function summarizeAttendance(employeeId: string, month: string, attendance: AttendanceRecord[], leaves: LeaveRequest[]) {
  const records = attendance.filter(row => row.employee_id === employeeId && row.work_date.startsWith(`${month}-`));
  const leaveDays = approvedLeaveDays(employeeId, month, leaves);
  records.filter(row => row.status === "ON_LEAVE").forEach(row => leaveDays.add(row.work_date));
  const workedDays = new Set(records.filter(row => row.status === "PRESENT" || row.status === "LATE").map(row => row.work_date));
  const hours = records.reduce((sum, row) => sum + (row.clock_in && row.clock_out
    ? Math.max(0, (new Date(row.clock_out).getTime() - new Date(row.clock_in).getTime()) / 3600000) : 0), 0);
  return {
    records: records.length,
    worked: workedDays.size,
    late: new Set(records.filter(row => row.status === "LATE").map(row => row.work_date)).size,
    absent: new Set(records.filter(row => row.status === "ABSENT" && !leaveDays.has(row.work_date)).map(row => row.work_date)).size,
    leave: leaveDays.size,
    hours: Number(hours.toFixed(1)),
    conflicts: [...workedDays].filter(day => leaveDays.has(day)).length,
  };
}
