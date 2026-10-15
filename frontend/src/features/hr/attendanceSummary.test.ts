import { describe, expect, it } from "vitest";
import { summarizeAttendance } from "./attendanceSummary";
import type { AttendanceRecord, LeaveRequest } from "../../shared/types/enterprise";

const leave = (start: string, end: string, changes: Partial<LeaveRequest> = {}): LeaveRequest => ({
  id: 1, employee_id: "FD1", leave_type: "SICK", start_date: start, end_date: end,
  status: "APPROVED", reason: "Nghỉ ốm", requested_by: "HR", approver: "MANAGER",
  decided_at: null, created_at: start, shift_swap_with: null, ...changes,
});
const attendance = (date: string, status: string): AttendanceRecord => ({
  id: 1, employee_id: "FD1", work_date: date, status, clock_in: null, clock_out: null,
  source: "MANUAL", device_event_id: null, note: null,
});

describe("Monthly attendance reconciliation", () => {
  it("counts approved calendar days once across overlapping requests and month boundaries", () => {
    const result = summarizeAttendance("FD1", "2026-10", [], [
      leave("2026-09-29", "2026-10-02"), leave("2026-10-02", "2026-10-03"),
      leave("2026-10-31", "2026-11-02"),
      leave("2026-10-10", "2026-10-11", { status: "PENDING" }),
      leave("2026-10-12", "2026-10-13", { status: "REJECTED" }),
      leave("2026-10-15", "2026-10-15", { leave_type: "SHIFT_CHANGE" }),
      leave("2026-10-20", "2026-10-21", { employee_id: "OTHER" }),
    ]);
    expect(result).toMatchObject({ records: 0, leave: 4, conflicts: 0 });
  });
  it("does not double-count a leave punch or mark approved leave absent, and flags a conflicting presence", () => {
    const rows = [attendance("2026-10-13", "ON_LEAVE"), attendance("2026-10-14", "ABSENT"),
      { ...attendance("2026-10-15", "PRESENT"), clock_in: "2026-10-15T22:00:00", clock_out: "2026-10-16T06:00:00" }];
    expect(summarizeAttendance("FD1", "2026-10", rows, [leave("2026-10-13", "2026-10-15")]))
      .toMatchObject({ records: 3, leave: 3, absent: 0, worked: 1, hours: 8, conflicts: 1 });
  });
  it("keeps an empty date selection safe", () => {
    expect(summarizeAttendance("FD1", "", [], [])).toMatchObject({ records: 0, leave: 0 });
  });
});
